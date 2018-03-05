#!/usr/bin/env node
const program = require('commander');
const chalk = require('chalk');
const semver = require('semver');
const AWS = require('aws-sdk');

const { engines } = require('./package');

const Helpers = require('./src/helpers.js');
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

// Read input.
program
    .version('0.0.1')
    .description('Do AWS Stuff')
    .option('-c, --config-file <configFile>', 'Optional config file')
    .option('-o, --options-file <optionsFile>', 'Optional deploy options file')
    .option('-v, --verbose', 'Verbose output')
    .option('-s, --options-stack <optionsStack>', 'Stack')
    .option('-e, --options-environment <optionsEnvironment>', 'Environment')
    .option('-a, --options-action <optionsaction>', 'Action')
    .parse(process.argv);
    }
}

    Helpers.logIfVerbose('Reading config file');


async function start() {
    let config = {};
    try {
        // Read config file (not optional)
        Helpers.logIfVerbose('Reading config');
        config = await Config.readConfigFile(program.configFile);
        Helpers.logIfVerbose(config);

        // Validate (and add stuff to) config.
        Helpers.logIfVerbose('Validating config');
        config = await Config.validateConfig(config);
    } catch (err) {
        Helpers.logError('Config', err);
    }

    let options = {};
    try {
        // Read options file (optional).
        Helpers.logIfVerbose('Reading options');
        options = await Options.readOptionsFile(program.optionsFile);
        if (program.optionsStack) {
            options.stacks = [program.optionsStack];
        }
        if (program.optionsEnvironment) {
            options.environments = [program.optionsEnvironment];
        }
        if (program.optionsAction) {
            options.action = program.optionsAction;
        }

        Helpers.logIfVerbose(options);

        // Validate (and add stuff to) options.
        Helpers.logIfVerbose('Validating options');
        options = await Options.validateOptions(options, config);
    } catch (err) {
        Helpers.logError('Options', err);
    }

    // Banner.
    Helpers.log(chalk.yellow.bold(`Starting: ${config.project}`));

    options.stacks.forEach(async (stackName) => {
        options.environments.forEach(async (env) => {
            // Set credentials. Do it each time again since this can switch per stack/env.
            AWS.config.credentials = await AwsCredentials.loadCredentials(config, stackName, env);

            // Run said action.
            const cloudformation = new Cloudformation(config, stackName, env);

            switch (options.action) {
            default:
            case 'validate':
                try {
                    await cloudformation.runValidate();
                    Helpers.logOk(`Template ${stackName}`, 'Template is valid');
                } catch (error) {
                    Helpers.logError(`Template ${stackName}`, error.message);
                }
                break;
            case 'status':
                try {
                    const output = await cloudformation.runStatus();
                    Helpers.logOk(`Status ${stackName}`, 'Stack found');
                    Helpers.logOk(`Status ${stackName}`, output, true);
                } catch (error) {
                    Helpers.logError(`Status ${stackName}`, error.message);
                }
                break;
            case 'deploy':
                try {
                    await cloudformation.runDeploy();
                    Helpers.logOk(`Deploy ${stackName}`, 'Done');
                } catch (error) {
                    Helpers.logError(`Deploy ${stackName}`, error.message);
                }
                break;
            }
        });
    });
}

start();
