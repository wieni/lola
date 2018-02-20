#!/usr/bin/env node

const program = require('commander');
const chalk = require('chalk');
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
    .parse(process.argv);

if (program.verbose) {
    console.log('Reading config file');
}

async function start() {
    try {
        // Read config file (not optional)
        if (program.verbose) console.log('Reading config');
        let config = await Config.readConfigFile(program.configFile);
        if (program.verbose) console.log(config);

        // Validate (and add stuff to) config.
        if (program.verbose) console.log('Validating config');
        config = await Config.validateConfig(config);

        // Set credentials from profile.
        AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: config.profile });

        // Read options file (optional).
        if (program.verbose) console.log('Reading options');
        let options = await Options.readOptionsFile(program.optionsFile);
        if (program.optionsStack) {
            options.stack = program.optionsStack;
        }
        if (program.optionsEnvironment) {
            options.environment = program.optionsEnvironment;
        }

        if (program.verbose) console.log(options);

        // Banner.
        console.log(chalk.yellow.bold(`\n${config.project}\n`));

        // Validate (and add stuff to) options.
        if (program.verbose) console.log('Validating options');
        options = await Options.validateOptions(options, config);

        options.stack.forEach(async (stackName) => {
            options.environment.forEach(async (env) => {
                const cloudformation = new Cloudformation(config, stackName, env);

                switch (options.action) {
                default:
                case 'validate':
                    cloudformation.runValidate()
                        .then(() => {
                            console.log(`- Template ${chalk.green(stackName)}: Valid`);
                        })
                        .catch((error) => {
                            console.log(`- Template ${chalk.red(stackName)}: ${error.message}`);
                        });
                    break;
                case 'exists':
                    cloudformation.runExists()
                        .then((exists) => {
                            if (exists) {
                                console.log(`- Stack ${chalk.green(stackName)}: Exists (${cloudformation.getFullStackName()})`);
                            } else {
                                console.log(`- Stack ${chalk.green(stackName)}: Does not exist (${cloudformation.getFullStackName()})`);
                            }
                        })
                        .catch((error) => {
                            console.log(`- ${chalk.red(stackName)}: ${error.message}`);
                        });
                    break;
                case 'deploy':
                    Cloudformation.runDeploy()
                        .then((exists) => {
                            if (exists) {
                                console.log(`- Stack ${chalk.green(stackName)}: Exists`);
                            } else {
                                console.log(`- Stack ${chalk.green(stackName)}: Does not exist`);
                            }
                        })
                        .catch((error) => {
                            console.log(`- ${chalk.red(stackName)}: ${error.message}`);
                        });
                    break;
                }
            });
        });
    } catch (err) {
        console.log(chalk.red.underline(err));
    }
}

start();
