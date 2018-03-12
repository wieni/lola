#!/usr/bin/env node
const program = require('commander');
const chalk = require('chalk');
const AWS = require('aws-sdk');

const Logging = require('./src/logging.js');
const AwsCredentials = require('./src/awsCredentials.js');
const Config = require('./src/config.js');
const Options = require('./src/options.js');
const Commands = require('./src/commands.js');

async function start(command) {
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
        // Read options file (optional).
        Logging.logIfVerbose('Reading options', program.verbose);
        options = await Options.readOptionsFile(program.optionsFile);
        if (program.optionsStack) {
            if (Object.keys(config.stacks).indexOf(program.optionsStack) === -1) {
                Logging.logError('Stack not found in config file', program.optionsStack);
                process.exit(1);
            }
            options.stacks = [program.optionsStack];
        }
        if (program.optionsEnvironment) {
            if (Object.keys(config.environments).indexOf(program.optionsEnvironment) === -1) {
                Logging.logError('Env not found in config file', program.optionsEnvironment);
                process.exit(1);
            }
            options.environments = [program.optionsEnvironment];
        }

        Logging.logIfVerbose(options, program.verbose);

        // Validate (and add stuff to) options.
        Logging.logIfVerbose('Validating options', program.verbose);
        options = await Options.validateOptions(options, config);
    } catch (err) {
        Logging.logError('Options', err);
    }

    // Banner.
    Logging.log(chalk.yellow.bold(`Starting: ${config.project}`));

    options.stacks.forEach(async (stackName) => {
        options.environments.forEach(async (env) => {
            // Set credentials. Do it each time again since this can switch per stack/env.
            AWS.config.credentials = await AwsCredentials.loadCredentials(config, stackName, env);

            // Run said action.
            const commands = new Commands(config, stackName, env);

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
}

program
    .version('0.0.1')
    .description('Do AWS Stuff')
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

// Require a command.
if (process.argv[2] === undefined) {
    program.outputHelp();
    process.exit(1);
}

program.parse(process.argv);

