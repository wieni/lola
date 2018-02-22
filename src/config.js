const yaml = require('node-yaml');
const inquirer = require('inquirer');

const Actions = require('./actions.js');

const regions = [
    'eu-west-1',
    'eu-central-1',
    'eu-west-3',
];

class Config {
    /**
     * Read config from file,
     * @param {string} fileName
     */
    static readConfigFile(fileName = '') {
        let name = 'config.yml';
        if (fileName !== '') {
            name = fileName;
        }

        return yaml.read(`${process.cwd()}/${name}`);
    }

    static async validateConfig(config) {
        const newConfig = config;
        if (!newConfig.project) {
            throw new Error('"project" not found in config file');
        }

        if (!newConfig.region) {
            newConfig.region = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'region',
                    message: 'AWS Region: ',
                    choices: regions,
                },
            ]);
        }

        if (!newConfig.stacks) {
            throw new Error('"stacks" not found in config file');
        } else if (Object.keys(newConfig.stacks).length === 0) {
            throw new Error('No stacks defined in config file');
        }

        if (!newConfig.profile) {
            newConfig.profile = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'profile',
                    message: 'Profile (~/.aws/credentials): ',
                },
            ]);
        }

        await Promise.all(Object.keys(newConfig.stacks).map(async (stack) => {
            if (newConfig.stacks[stack].actions) {
                await Promise.all(Object.keys(newConfig.stacks[stack].actions).map(async (action) => {
                    await Actions.validateAction(newConfig.stacks[stack].actions[action]);
                }));
            }
        }));

        return newConfig;
    }
}

module.exports = Config;
