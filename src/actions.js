/* eslint-disable global-require, import/no-dynamic-require */

const fs = require('fs');
const util = require('util');

const access = util.promisify(fs.access);

class Actions {
    static async getPathOfAction(config, stack, action) {
        let actionPath = false;
        console.log(config);
        if (config.stacks[stack].actions) {
            await Promise.all(Object.keys(config.stacks[stack].actions).map(async (actionName) => {
                if (action === actionName) {
                    actionPath = config.stacks[stack].actions[actionName];
                }
            }));
        }
        return actionPath;
    }

    static async validateAction(actionPath) {
        // Check if the file exists.
        try {
            await access(`${process.cwd()}/${actionPath}`);
        } catch (e) {
            throw new Error(e);
        }

        const actionFile = require(`${process.cwd()}/${actionPath}`);
        if (typeof actionFile.runAction !== 'function') {
            throw new Error(`runAction() function not found in ${actionPath}`);
        }
    }

    /**
     * @param {Object} context
     *   - config
     *   - stackName
     *   - action
     *   - env
     *   - outputs
     */
    static async runAction(context) {
        const actionPath = await Actions.getPathOfAction(
            context.config,
            context.stackName,
            context.action,
        );
        const actionFile = require(`${process.cwd()}/${actionPath}`);
        try {
            await actionFile.runAction(context);
        } catch (e) {
            throw new Error(e);
        }
    }
}

module.exports = Actions;
