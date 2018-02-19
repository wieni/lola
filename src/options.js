const yaml = require('node-yaml');
const inquirer = require('inquirer');

const actions = [
    'validate',
    'deploy',
    'status',
    // 'delete',
];

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

        if (!deployOptions.stack) {
            deployOptions.stack = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'stack',
                    message: 'Stack: ',
                    choices: ['all'].concat(Object.keys(config.stacks)),
                },
            ]);
            if (deployOptions.stack.stack === 'all') {
                deployOptions.stack = Object.keys(config.stacks);
            } else {
                deployOptions.stack = [deployOptions.stack.stack];
            }
        }

        if (config.environments && !deployOptions.environment) {
            deployOptions.environment = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'environment',
                    message: 'Environment: ',
                    choices: ['all'].concat(Object.keys(config.environments)),
                },
            ]);
            if (deployOptions.environment.environment === 'all') {
                deployOptions.environment = Object.keys(config.environments);
            } else {
                deployOptions.environment = [deployOptions.environment.environment];
            }
        }
        if (!deployOptions.environment) {
            deployOptions.environment = ['default'];
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
