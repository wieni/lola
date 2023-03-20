#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import AWS from 'aws-sdk';

import Logging from './src/logging.js';
import AwsCredentials from './src/awsCredentials.js';
import Config from './src/config.js';
import Options from './src/options.js';
import Commands from './src/commands.js';

const start = async (command) => {
    Logging.logIfVerbose('Reading config file', program.verbose);

    let config = {};
    try {
        // Read config file (not optional)
        Logging.logIfVerbose('Reading config', program.verbose);
        config = await Config.readConfigFile(program.configFile);
        Logging.logIfVerbose(config, program.verbose);
    } catch (err) {
        Logging.logError('Config', err);
        process.exit(1);
    }

    try {
        // Validate (and add stuff to) config.
        Logging.logIfVerbose('Validating config', program.verbose);
        config = await Config.validateConfig(config);
    } catch (err) {
        Logging.logError('Config', err);
        process.exit(1);
    }

    let options = {};
    try {
        const programOpts = program.opts();

        // Read options file (optional).
        Logging.logIfVerbose('Reading options', programOpts.verbose);
        options = await Options.readOptionsFile(programOpts.optionsFile);
        if (programOpts.optionsStack) {
            if (Object.keys(config.stacks).indexOf(programOpts.optionsStack) === -1) {
                Logging.logError('Stack not found in config file', programOpts.optionsStack);
                process.exit(1);
            }
            options.stacks = [programOpts.optionsStack];
        }
        if (programOpts.optionsEnvironment) {
            if (Object.keys(config.environments).indexOf(programOpts.optionsEnvironment) === -1) {
                Logging.logError('Env not found in config file', programOpts.optionsEnvironment);
                process.exit(1);
            }
            options.environments = [programOpts.optionsEnvironment];
        }

        Logging.logIfVerbose(options, programOpts.verbose);

        // Validate (and add stuff to) options.
        Logging.logIfVerbose('Validating options', programOpts.verbose);
        options = await Options.validateOptions(options, config);
    } catch (err) {
        Logging.logError('Options', err);
    }

    options.stacks.forEach(async (stackName) => {
        options.environments.forEach(async (env) => {
            // Set credentials. Do it each time again since this can switch per stack/env.
            AWS.config.credentials = await AwsCredentials.loadCredentials(config, stackName, env);

            // Run said action.
            const commands = new Commands(config, stackName, env);

            // Banner.
            Logging.log(
                `${chalk.green(`${command.toUpperCase()}`)}: ${chalk.yellow.bold(
                    `${config.project} - ${stackName} - ${env}`
                )}`
            );

            switch (command) {
                default:
                    Logging.logError('Unknown command', command);
                    break;
                case 'validate':
                    try {
                        await commands.runValidate();
                        Logging.logOk(`Template ${stackName}`, 'Template is valid');
                    } catch (error) {
                        Logging.logError(`Template ${stackName}`, error.message);
                    }
                    break;
                case 'status':
                    try {
                        const output = await commands.runStatus();
                        Logging.logOk(`Status ${stackName}`, 'Stack found');
                        Logging.logOk(`Status ${stackName}`, output, true);
                    } catch (error) {
                        Logging.logError(`Status ${stackName}`, error.message);
                    }
                    break;
                case 'deploy':
                    try {
                        await commands.runDeploy();
                        Logging.logOk(`Deploy ${stackName}`, 'Done');
                    } catch (error) {
                        Logging.logError(`Deploy ${stackName}`, error.message);
                    }
                    break;
                case 'delete':
                    try {
                        await commands.runDelete();
                        Logging.logOk(`Delete ${stackName}`, 'Done');
                    } catch (error) {
                        Logging.logError(`Delete ${stackName}`, error.message);
                    }
                    break;
                case 'action':
                    try {
                        await commands.runAction();
                        Logging.logOk(`Running action on ${stackName}`, 'Done');
                    } catch (error) {
                        Logging.logError(`Error running action on ${stackName}`, error.message);
                    }
                    break;
                case 'protection':
                    try {
                        const feedback = await commands.runTerminationProtection();
                        Logging.logOk(`Running protection on ${stackName}`, feedback);
                    } catch (error) {
                        Logging.logError(`Error running protection on ${stackName}`, error.message);
                    }
                    break;
                case 'changeSet':
                    try {
                        const output = await commands.runChangeSet();
                        Logging.logOk(`ChangeSet ${stackName}`, output, true);
                    } catch (error) {
                        Logging.logError(`ChangeSet ${stackName}`, error.message);
                    }
                    break;
            }
        });
    });
};

program
    .version('1.0.2')
    .description('Reads a config file (lola.yml) and acts on the AWS Cloudformation stacks defined in that file')
    .option('-c, --config-file <configFile>', 'Optional config file')
    .option('-o, --options-file <optionsFile>', 'Optional deploy options file')
    .option('-v, --verbose', 'Verbose output')
    .option('-s, --options-stack <optionsStack>', 'Stack')
    .option('-e, --options-environment <optionsEnvironment>', 'Environment');

program
    .command('validate')
    .alias('v')
    .description('Validates a stack')
    .action(() => {
        start('validate');
    });

program
    .command('status')
    .alias('s')
    .description('Get the status of a stack')
    .action(() => {
        start('status');
    });

program
    .command('deploy')
    .alias('d')
    .description('Deploys a stack')
    .action(() => {
        start('deploy');
    });

program
    .command('delete')
    .alias('x')
    .description('Deletes a stack')
    .action(() => {
        start('delete');
    });

program
    .command('action')
    .alias('a')
    .description('Runs an action on a stack/env')
    .action(() => {
        start('action');
    });

program
    .command('protection')
    .alias('p')
    .description('Toggles termination protection on a stack/env')
    .action(() => {
        start('protection');
    });

program
    .command('changeSet')
    .alias('c')
    .description('Create and view changeset of a stack/env')
    .action(() => {
        start('changeSet');
    });

const lola = async () => {
    // Require a command.
    if (process.argv[2] === undefined) {
        program.outputHelp();
        process.exit(1);
    }

    program.parse(process.argv);
};

export default lola;
