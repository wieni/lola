#!/usr/bin/env node
const program = require('commander');
const chalk = require('chalk');
const AWS = require('aws-sdk');

const Logging = require('./src/logging.js');
const AwsCredentials = require('./src/awsCredentials.js');
const Config = require('./src/config.js');
const Options = require('./src/options.js');
const Cloudformation = require('./src/cloudformation.js');

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
            options.stacks = [program.optionsStack];
        }
        if (program.optionsEnvironment) {
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
            const cloudformation = new Cloudformation(config, stackName, env);

            switch (command) {
            default:
                Logging.logError('Unknown command', command);
                break;
            case 'validate':
                try {
                    await cloudformation.runValidate();
                    Logging.logOk(`Template ${stackName}`, 'Template is valid');
                } catch (error) {
                    Logging.logError(`Template ${stackName}`, error.message);
                }
                break;
            case 'status':
                try {
                    const output = await cloudformation.runStatus();
                    Logging.logOk(`Status ${stackName}`, 'Stack found');
                    Logging.logOk(`Status ${stackName}`, output, true);
                } catch (error) {
                    Logging.logError(`Status ${stackName}`, error.message);
                }
                break;
            case 'deploy':
                try {
                    await cloudformation.runDeploy();
                    Logging.logOk(`Deploy ${stackName}`, 'Done');
                } catch (error) {
                    Logging.logError(`Deploy ${stackName}`, error.message);
                }
                break;
            case 'delete':
                try {
                    await cloudformation.runDelete();
                    Logging.logOk(`Delete ${stackName}`, 'Done');
                } catch (error) {
                    Logging.logError(`Delete ${stackName}`, error.message);
                }
                break;
            case 'action':
                try {
                    await cloudformation.runAction();
                    Logging.logOk(`Running action on ${stackName}`, 'Done');
                } catch (error) {
                    Logging.logError(`Error running action on ${stackName}`, error.message);
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

// Require a command.
if (process.argv[2] === undefined) {
    program.outputHelp();
    process.exit(1);
}

program.parse(process.argv);

