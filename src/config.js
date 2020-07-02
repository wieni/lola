const yaml = require('js-yaml');
const fs = require('fs');

const Actions = require('./actions.js');

class Config {
    /**
     * Read config from file,
     * @param {string} fileName
     */
    static readConfigFile(fileName = 'lola.yml') {
        return yaml.safeLoad(fs.readFileSync(`${process.cwd()}/${fileName}`, 'utf8'));
    }

    static async validateConfig(config) {
        const newConfig = config;

        // Projects have a name.
        if (!newConfig.project) {
            throw new Error('"project" not found in config file');
        }

        // Projects have a creator.
        if (!newConfig.creator) {
            throw new Error('"creator" not found in config file');
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
            throw new Error('"environments" not found in config file. Please provide a "standard" one at least.');
        } else if (Object.keys(newConfig.environments).length === 0) {
            throw new Error('No environments defined in config file. Please provide a "standard" one at least.');
        }

        // There might be a default env params.
        let defaultOptions = {};
        if (newConfig.environments.default) {
            defaultOptions = newConfig.environments.default;
        }

        // Stack in environments have profile/region.
        await Promise.all(Object.keys(newConfig.environments).map(async (environmentName) => {
            await Promise.all(Object.keys(newConfig.environments[environmentName]).map(async (stackName) => {
                if (defaultOptions[stackName]) {
                    // Fill in region.
                    if (!newConfig.environments[environmentName][stackName].region &&
                        defaultOptions[stackName].region
                    ) {
                        newConfig.environments[environmentName][stackName].region = defaultOptions[stackName].region;
                    }
                    // Fill in profile.
                    if (!newConfig.environments[environmentName][stackName].profile &&
                        defaultOptions[stackName].profile
                    ) {
                        newConfig.environments[environmentName][stackName].profile = defaultOptions[stackName].profile;
                    }
                    // Fill in actions.
                    if (!newConfig.environments[environmentName][stackName].hooks &&
                        defaultOptions[stackName].hooks
                    ) {
                        newConfig.environments[environmentName][stackName].hooks = defaultOptions[stackName].hooks;
                    }
                }

                if (!newConfig.environments[environmentName][stackName].region) {
                    throw new Error(`Stack ${stackName} has no region in ${environmentName}`);
                }
                if (!newConfig.environments[environmentName][stackName].profile) {
                    throw new Error(`Stack ${stackName} has no profile in ${environmentName}`);
                }
            }));
        }));

        // Stacks in environments might have options. Validate them and/or copy over from default.

        return newConfig;
    }
}

module.exports = Config;
