#!/usr/bin/env node
const program = require('commander');
const chalk = require('chalk');
const moment = require('moment');
const semver = require('semver');

const { engines } = require('./package');
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

function log(message) {
    console.log(`[${chalk.gray(moment().format('HH:mm:ss'))}] ${message}`);
}

function logError(subject, message) {
    log(`${chalk.red(subject)}: ${message}`);
}

function logOk(subject, message, indent = false) {
    if (indent) {
        const result = `${chalk.green(subject)}: ${message}`;
        log(result.replace(/\n\r?/g, '\n\t'));
    } else {
        log(`${chalk.green(subject)}: ${message}`);
    }
}

function logIfVerbose(message) {
    if (program.verbose) {
        log(message);
    }
}

logIfVerbose('Reading config file');

async function start() {
    let config = {};
    try {
        // Read config file (not optional)
        logIfVerbose('Reading config');
        config = await Config.readConfigFile(program.configFile);
        logIfVerbose(config);

        // Validate (and add stuff to) config.
        logIfVerbose('Validating config');
        config = await Config.validateConfig(config);
    } catch (err) {
        logError('Config', err);
    }

    let options = {};
    try {
        // Read options file (optional).
        logIfVerbose('Reading options');
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

        logIfVerbose(options);

        // Validate (and add stuff to) options.
        logIfVerbose('Validating options');
        options = await Options.validateOptions(options, config);
    } catch (err) {
        logError('Options', err);
    }

    // Banner.
    log(chalk.yellow.bold(`Starting: ${config.project}`));

    options.stacks.forEach(async (stackName) => {
        options.environments.forEach(async (env) => {
            const cloudformation = new Cloudformation(config, stackName, env);

            switch (options.action) {
            default:
            case 'validate':
                try {
                    await cloudformation.runValidate();
                    logOk(`Template ${stackName}`, 'Template is valid');
                } catch (error) {
                    logError(`Template ${stackName}`, error.message);
                }
                break;
            case 'status':
                try {
                    const output = await cloudformation.runStatus();
                    logOk(`Status ${stackName}`, 'Stack found');
                    logOk(`Status ${stackName}`, output, true);
                } catch (error) {
                    logError(`Status ${stackName}`, error.message);
                }
                break;
            case 'deploy':
                try {
                    await cloudformation.runDeploy();
                    logOk(`Deploy ${stackName}`, 'Done');
                } catch (error) {
                    logError(`Deploy ${stackName}`, error.message);
                }
                break;
            }
        });
    });
}

start();
