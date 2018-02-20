#!/usr/bin/env node

const program = require('commander');
const chalk = require('chalk');
const moment = require('moment');
const AWS = require('aws-sdk');

const Config = require('./src/config.js');
const Options = require('./src/options.js');
const Cloudformation = require('./src/cloudformation.js');
// const Helpers = require('./src/helpers.js');

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

function log(message) {
    console.log(`[${chalk.gray(moment().format('HH:mm:ss'))}] ${message}`);
}

if (program.verbose) {
    log('Reading config file');
}

async function start() {
    try {
        // Read config file (not optional)
        if (program.verbose) log('Reading config');
        let config = await Config.readConfigFile(program.configFile);
        if (program.verbose) log(config);

        // Validate (and add stuff to) config.
        if (program.verbose) log('Validating config');
        config = await Config.validateConfig(config);

        // Set credentials from profile.
        AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: config.profile });

        // Read options file (optional).
        if (program.verbose) log('Reading options');
        let options = await Options.readOptionsFile(program.optionsFile);
        if (program.optionsStack) {
            options.stacks = [program.optionsStack];
        }
        if (program.optionsEnvironment) {
            options.environments = [program.optionsEnvironment];
        }
        if (program.optionsAction) {
            options.action = program.optionsAction;
        }

        if (program.verbose) log(options);

        // Validate (and add stuff to) options.
        if (program.verbose) log('Validating options');
        options = await Options.validateOptions(options, config);

        // Banner.
        log(chalk.yellow.bold(`Starting: ${config.project}`));

        options.stacks.forEach(async (stackName) => {
            options.environments.forEach(async (env) => {
                const cloudformation = new Cloudformation(config, stackName, env);

                switch (options.action) {
                default:
                case 'validate':
                    await cloudformation.runValidate()
                        .then(() => {
                            log(`- Template ${chalk.green(stackName)}: Valid`);
                        })
                        .catch((error) => {
                            log(`- Template ${chalk.red(stackName)}: ${error.message}`);
                        });
                    break;
                case 'status':
                    await cloudformation.runStatus()
                        .then((logs) => {
                            logs.forEach((message) => {
                                console.log(message);
                            });
                        })
                        .catch((error) => {
                            log(`- ${chalk.red(stackName)}: ${error.message}`);
                        });
                    break;
                case 'deploy':
                    await cloudformation.runDeploy()
                        .then(() => {
                            log(`- Deploying ${chalk.green(stackName)}: Done`);
                        })
                        .catch((error) => {
                            log(`- Deploying ${chalk.red(stackName)}: ${error.message}`);
                        });
                    break;
                case 'delete':
                    await cloudformation.runDelete()
                        .then(() => {
                            log(`- Deleted ${chalk.green(stackName)}`);
                        })
                        .catch((error) => {
                            log(`- Not deleted ${chalk.red(stackName)}: ${error.message}`);
                        });
                    break;
                }
            });
        });
    } catch (err) {
        log(chalk.red.underline(err));
    }
}

start();
