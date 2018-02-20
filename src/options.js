const yaml = require('node-yaml');
const inquirer = require('inquirer');

const actions = [
    'validate',
    'exists',
    'deploy',
    // 'status',
    // 'delete',
];

const all = '*all*';

class Options {
    /**
     * Read config from file,
     * @param {string} fileName
     */
    static readOptionsFile(fileName = '') {
        if (fileName !== '') {
            return yaml.read(`${process.cwd()}/${fileName}`);
        }
        return {};
    }

    static async validateOptions(options, config) {
        const deployOptions = options;

        // Stack.
        if (!deployOptions.stack) {
            deployOptions.stack = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'stack',
                    message: 'Stack: ',
                    choices: Object.keys(config.stacks).concat([all]),
                },
            ]);
            if (deployOptions.stack.stack === all) {
                deployOptions.stack = Object.keys(config.stacks);
            } else {
                deployOptions.stack = [deployOptions.stack.stack];
            }
        }
        if (Object.keys(config.stacks).indexOf(deployOptions.stack) === -1) {
            throw new Error(`Stack not found in config file: ${deployOptions.stack}`);
        }

        // Environment.
        if (config.environments && !deployOptions.environment) {
            deployOptions.environment = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'environment',
                    message: 'Environment: ',
                    choices: Object.keys(config.environments).concat([all]),
                },
            ]);
            if (deployOptions.environment.environment === all) {
                deployOptions.environment = Object.keys(config.environments);
            } else {
                deployOptions.environment = [deployOptions.environment.environment];
            }
        }
        if (!deployOptions.environment) {
            deployOptions.environment = ['default'];
        } else if (Object.keys(config.environments).indexOf(deployOptions.environment) === -1) {
            throw new Error(`Environment not found in config file: ${deployOptions.environment}`);
        }

        if (!deployOptions.action) {
            deployOptions.action = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'Action: ',
                    choices: actions,
                },
            ]);
            deployOptions.action = deployOptions.action.action;
        }

        return deployOptions;
    }
}

module.exports = Options;
