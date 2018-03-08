const yaml = require('node-yaml');
const inquirer = require('inquirer');

const all = '*all*';

class Options {
    /**
     * Read config from file,
     * @param {string} fileName
     */
    static readOptionsFile(fileName = '') {
        return fileName ? yaml.read(`${process.cwd()}/${fileName}`) : {};
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

        // Environments.
        const allowedEnvs = [];
        Object.keys(config.environments).forEach((env) => {
            // Default is reserved env.
            if (env !== 'default') {
                deployOptions.stacks.forEach((name) => {
                    if (config.environments[env][name]) {
                        allowedEnvs.push(env);
                    }
                });
            }
        });
        if (deployOptions.environments) {
            // TODO Validate them.
        } else if (allowedEnvs.length === 1) {
            deployOptions.environments = allowedEnvs;
        } else {
            const input = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'environment',
                    message: 'Environment: ',
                    choices: allowedEnvs.concat([all]),
                },
            ]);
            if (input === all) {
                deployOptions.environments = allowedEnvs;
            } else {
                deployOptions.environments = [input.environment];
            }
        }
        deployOptions.environments.forEach((name) => {
            if (Object.keys(config.environments).indexOf(name) === -1) {
                throw new Error(`Environment not found in config file: ${name}`);
            }
        });

        return deployOptions;
    }
}

module.exports = Options;
