const cfn = require('cfn');

class Cloudformation {
    static async runValidate(stackName, config) {
        try {
            await cfn.validate(config.region, config.stacks[stackName].template);
        } catch (error) {
            throw new Error(error);
        }
    }

    static async runExists(stackName, config) {
        try {
            // Returns boolean if stack name 'foo-bar' exists
            const exists = await cfn.stackExists({
                name: stackName,
                awsConfig: {
                    region: config.Region,
                },
            });
            if (exists) {
                return true;
            }

            return false;
        } catch (error) {
            throw new Error(error);
        }
    }

    // static async runDeploy(stackName, config) {
    //     try {
    //         await cfn({
    //             name: stackName,
    //             template: config.Stacks[stackName].Template,
    //             cfParams: {},
    //             awsConfig: {
    //                 region: config.Region,
    //             },
    //         });

    //         // console.log(`- ${chalk.green(getFullName(stackName, env))}: Deployed.`);
    //     } catch (error) {
    //         // console.log(`- ${chalk.red(getFullName(stackName, env))}: ${error.message}`);
    //     }
    // }

    // static async runDelete(stackName, config) {
    //     try {
    //         await cfn.delete({
    //             name: stackName,
    //             awsConfig: {
    //                 region: config.Region,
    //             },
    //         });

    //         // console.log(`- ${chalk.green(getFullName(stackName, env))}: Deleted.`);
    //     } catch (error) {
    //         // console.log(`- ${chalk.red(getFullName(stackName, env))}: ${error.message}`);
    //     }
    // }
}

module.exports = Cloudformation;
