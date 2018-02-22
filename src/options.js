const yaml = require('node-yaml');
const inquirer = require('inquirer');

const actions = [
    'validate',
    'deploy',
    'status',
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
        if (!deployOptions.stacks) {
            const input = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'stack',
                    message: 'Stack: ',
                    choices: Object.keys(config.stacks).concat([all]),
                },
            ]);
            if (input === all) {
                deployOptions.stacks = Object.keys(config.stacks);
            } else {
                deployOptions.stacks = [input.stack];
            }
        }
        deployOptions.stacks.forEach((name) => {
            if (Object.keys(config.stacks).indexOf(name) === -1) {
                throw new Error(`Stack not found in config file: ${name}`);
            }
        });

        // Environment.
        if (config.environments && !deployOptions.environments) {
            const input = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'environment',
                    message: 'Environment: ',
                    choices: Object.keys(config.environments).concat([all]),
                },
            ]);
            if (input === all) {
                deployOptions.environments = Object.keys(config.environments);
            } else {
                deployOptions.environments = [input.environment];
            }
        }
        if (!deployOptions.environments) {
            deployOptions.environments = ['default'];
        } else {
            deployOptions.environments.forEach((name) => {
                if (Object.keys(config.environments).indexOf(name) === -1) {
                    throw new Error(`Environment not found in config file: ${name}`);
                }
            });
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
