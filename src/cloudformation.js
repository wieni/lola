const cfn = require('cfn');
const chalk = require('chalk');
const AWS = require('aws-sdk');

class Cloudformation {
    constructor(config, stackName, env) {
        this.config = config;
        this.stackName = stackName;
        this.env = env;

        this.cloudformation = new AWS.CloudFormation({
            region: config.region,
        });
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

    async runStatus() {
        const result = [];
        try {
            const exists = await this.runExists();
            if (!exists) {
                result.push(`- Stack ${chalk.red(this.stackName)}: Does not exist`);
                return result;
            }

            result.push(`- Stack ${chalk.green(this.stackName)}: Exists`);

            // Get Stack Intel.
            const data = await this.cloudformation.describeStacks({
                StackName: this.getFullStackName(),
            }).promise();
            if (data.Stacks) {
                const stackData = data.Stacks[0];
                result.push(`  * StackStatus: ${stackData.StackStatus}`);
                result.push(`  * CreationTime: ${stackData.CreationTime}`);
                result.push(`  * EnableTerminationProtection: ${stackData.EnableTerminationProtection}`);
                result.push(`  * Parameters: ${stackData.Parameters.join(', ')}`);

                if (stackData.Outputs) {
                    result.push('  * Outputs:');
                    stackData.Outputs.forEach((element) => {
                        result.push(`    - ${element.OutputKey}: ${element.OutputValue}`);
                    });
                }

                result.push(`  * Tags: ${stackData.Tags.join(', ')}`);
            }
            // console.log(data);

            return result;
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
                    region: this.config.region,
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

    async runDeploy() {
        try {
            await this.runValidate();
            await cfn({
                name: this.getFullStackName(),
                template: this.config.stacks[this.stackName].template,
                cfParams: {},
                awsConfig: {
                    region: this.config.region,
                },
            });
        } catch (error) {
            throw new Error(error);
        }
    }

    async runDelete() {
        try {
            const exists = await this.runExists();
            if (!exists) {
                throw new Error(`Tried to delete non-existing stack: ${this.stackName}`);
            }
            await cfn.delete({
                name: this.getFullStackName(),
                awsConfig: {
                    region: this.config.region,
                },
            });
            return true;
        } catch (error) {
            throw new Error(error);
        }
    }

    getFullStackName() {
        let result = `${this.config.project}-${this.stackName}-${this.env}`;

        if (this.config.environments[this.env]
            && this.config.environments[this.env][this.stackName]
            && this.config.environments[this.env][this.stackName].name
        ) {
            result = this.config.environments[this.env][this.stackName].name;
        }

        return result;
    }
}

module.exports = Cloudformation;
