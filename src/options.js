const yaml = require('js-yaml');
const inquirer = require('inquirer');
const fs = require('fs');

class Options {
    /**
     * Read config from file,
     * @param {string} fileName
     */
    static readOptionsFile(fileName = '') {
        return fileName ? yaml.safeLoad(fs.readFileSync(`${process.cwd()}/${fileName}`, 'utf8')) : {};
    }

    static async validateOptions(options, config) {
        const deployOptions = options;

        const stackChoices = [];
        Object.keys(config.stacks).forEach((stack) => {
            stackChoices.push({
                name: config.stacks[stack].description ? `${stack.padEnd(45)}${config.stacks[stack].description}` : stack,
                value: stack,
            });
        });

        // Stack.
        if (!deployOptions.stacks) {
            const input = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'stack',
                    message: 'Stack: ',
                    choices: stackChoices,
                },
            ]);
            deployOptions.stacks = [input.stack];
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
                    choices: allowedEnvs,
                },
            ]);

            deployOptions.environments = [input.environment];
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
