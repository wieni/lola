const yaml = require('node-yaml');

const Actions = require('./actions.js');

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

        // Projects have a name.
        if (!newConfig.project) {
            throw new Error('"project" not found in config file');
        }

        // Projects have stacks.
        if (!newConfig.stacks) {
            throw new Error('"stacks" not found in config file');
        } else if (Object.keys(newConfig.stacks).length === 0) {
            throw new Error('No stacks defined in config file');
        }

        // Stacks might have actions.
        await Promise.all(Object.keys(newConfig.stacks).map(async (stack) => {
            if (newConfig.stacks[stack].actions) {
                await Promise.all(Object.keys(newConfig.stacks[stack].actions).map(async (action) => {
                    await Actions.validateAction(newConfig.stacks[stack].actions[action]);
                }));
            }
        }));

        // Projects have environments.
        if (!newConfig.environments) {
            throw new Error('"environments" not found in config file. Please provide a "default" one at least.');
        } else if (Object.keys(newConfig.environments).length === 0) {
            throw new Error('No environments defined in config file. Please provide a "default" one at least.');
        }

        // There might be a default env params.
        let defaultOptions = {};
        if (newConfig.environments.default) {
            defaultOptions = newConfig.environments.default;
        }

        // Stack in environments have profile/region.
        await Promise.all(Object.keys(newConfig.environments).map(async (environmentName) => {
            await Promise.all(Object.keys(newConfig.environments[environmentName]).map(async (stackName) => {
                // Check or Fill in region.
                if (!newConfig.environments[environmentName][stackName].region) {
                    if (defaultOptions[stackName].region) {
                        newConfig.environments[environmentName][stackName].region = defaultOptions[stackName].region;
                    } else {
                        throw new Error(`Stack ${stackName} has no region.`);
                    }
                }
                // Check or fill in profile
                if (!newConfig.environments[environmentName][stackName].profile) {
                    if (defaultOptions[stackName].profile) {
                        newConfig.environments[environmentName][stackName].profile = defaultOptions[stackName].profile;
                    } else {
                        throw new Error(`Stack ${stackName} has no profile.`);
                    }
                }
            }));
        }));

        return newConfig;
    }
}

module.exports = Config;
