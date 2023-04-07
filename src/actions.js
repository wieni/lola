import fs from 'fs';
import util from 'util';

const access = util.promisify(fs.access);

export default class Actions {
    static async getPathOfAction(config, stack, action) {
        let actionPath = false;

        if (config.stacks[stack].actions) {
            await Promise.all(
                Object.keys(config.stacks[stack].actions).map(async (actionName) => {
                    if (action === actionName) {
                        actionPath = config.stacks[stack].actions[actionName];
                    }
                })
            );
        }
        return actionPath;
    }

    static async validateAction(actionPath) {
        // Check if the file exists.
        await access(`${process.cwd()}/${actionPath}`);

        try {
            const { default: actionFile } = await import(`${process.cwd()}/${actionPath}`);

            if (typeof actionFile.runAction !== 'function') {
                throw new Error(`runAction() function not found in ${actionPath}`);
            }
        } catch (error) {
            throw new Error(`${actionPath}: ${error}`);
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
        const actionPath = await Actions.getPathOfAction(context.config, context.stackName, context.action);
        const actionFile = await import(`${process.cwd()}/${actionPath}`);

        return actionFile.runAction(context);
    }
}
