#!/usr/bin/env node
const program = require('commander');
const chalk = require('chalk');
const semver = require('semver');
const AWS = require('aws-sdk');

const { engines } = require('./package');

const Logging = require('./src/logging.js');
const AwsCredentials = require('./src/awsCredentials.js');
const Config = require('./src/config.js');
const Options = require('./src/options.js');
const Cloudformation = require('./src/cloudformation.js');

// Check node version.
const version = engines.node;
if (!semver.satisfies(process.version, version)) {
    console.log(`Required node version ${version} not satisfied with current version ${process.version}.`);
    process.exit(1);
}

async function start(command) {
    Logging.logIfVerbose('Reading config file', program.verbose);

    let config = {};
    try {
        // Read config file (not optional)
        Logging.logIfVerbose('Reading config', program.verbose);
        config = await Config.readConfigFile(program.configFile);
        Logging.logIfVerbose(config, program.verbose);

        // Validate (and add stuff to) config.
        Logging.logIfVerbose('Validating config', program.verbose);
        config = await Config.validateConfig(config);
    } catch (err) {
        Logging.logError('Config', err);
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
                } catch (error) {
                    Helpers.logError(`Deploy ${stackName}`, error.message);
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

// Require a command.
if (process.argv[2] === undefined) {
    program.outputHelp();
    process.exit(1);
}

program.parse(process.argv);

