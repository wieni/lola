const cfn = require('cfn');

class Cloudformation {
    constructor(config, stackName, env) {
        this.config = config;
        this.stackName = stackName;
        this.env = env;
    }

    async runValidate() {
        try {
            await cfn.validate(
                this.config.region,
                this.config.stacks[this.stackName].template,
            );
        } catch (error) {
            throw new Error(error);
        }
    }

    async runExists() {
        try {
            // Returns boolean if stack name 'foo-bar' exists
            const exists = await cfn.stackExists({
                name: this.getFullStackName(),
                awsConfig: {
                    region: this.config.Region,
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

    static async runDeploy(stackName, config) {
        try {
            await cfn.validate(config.region, config.stacks[stackName].template);
            await cfn({
                name: stackName,
                template: config.Stacks[stackName].Template,
                cfParams: {},
                awsConfig: {
                    region: config.Region,
                },
            });
        } catch (error) {
            throw new Error(error);
        }
    }

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

    getFullStackName() {
        let result = `${this.config.project}-${this.stackName}-${this.env}`;
        console.log(this.config.environments);
        console.log(this.env);
        if (this.config.environments[this.env]
            && this.config.environments[this.env].stackName
            && this.config.environments[this.env].stackName.name
        ) {
            result = this.config.environments[this.env].stackName.name;
        }

        return result;
    }
}

module.exports = Cloudformation;
