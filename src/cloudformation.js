const cfn = require('cfn');
const chalk = require('chalk');
const AWS = require('aws-sdk');

const Actions = require('./actions.js');

class Cloudformation {
    constructor(config, stackName, env) {
        this.config = config;
        this.stackName = stackName;
        this.env = env;

        this.region = this.config.environments[this.env][this.stackName].region;
        this.template = this.config.stacks[this.stackName].template;

        // Set credentials from profile.
        AWS.config.credentials = new AWS.SharedIniFileCredentials({
            profile: this.config.environments[this.env][this.stackName].profile,
            region: this.region,
        });

        this.cloudformation = new AWS.CloudFormation({
            region: this.region,
        });
    }

    async runValidate() {
        try {
            await cfn.validate(
                this.region,
                this.template,
            );
        } catch (error) {
            throw new Error(error);
        }
    }

    async describeStack() {
        const data = await this.cloudformation.describeStacks({
            StackName: this.getFullStackName(),
        }).promise();
        return data.Stacks[0];
    }

    async runStatus() {
        const result = [];

        const exists = await this.runExists();
        if (!exists) {
            result.push(`- Stack ${chalk.red(this.stackName)}: Does not exist (${this.getFullStackName()})`);
            return result;
        }

        result.push(`- Stack ${chalk.green(this.stackName)}: Exists`);

        // Get Stack Intel.
        const stackData = await this.describeStack();
        if (stackData) {
            result.push(`  * StackStatus: ${stackData.StackStatus}`);
            result.push(`  * CreationTime: ${stackData.CreationTime}`);
            result.push(`  * EnableTerminationProtection: ${stackData.EnableTerminationProtection}`);

            if (stackData.Parameters) {
                result.push('  * Parameters:');
                stackData.Parameters.forEach((element) => {
                    result.push(`    - ${element.ParameterKey}: ${element.ParameterValue}`);
                });
            }

            if (stackData.Outputs) {
                result.push('  * Outputs:');
                stackData.Outputs.forEach((element) => {
                    result.push(`    - ${element.OutputKey}: ${element.OutputValue}`);
                });
            }

            result.push(`  * Tags: ${stackData.Tags.join(', ')}`);
        }

        return result;
    }

    async runExists() {
        // Returns boolean if stack name 'foo-bar' exists
        const exists = await cfn.stackExists({
            name: this.getFullStackName(),
            awsConfig: {
                region: this.region,
            },
        });

        return !!exists;
    }

    async runDeploy() {
        // Does template validate?
        const exists = await this.runExists();

        let stackData = {};
        if (!exists) {
            console.warn('Stack does not exist, creating');
        } else {
            stackData = await this.describeStack();
        }

        // pre-deploy hook.
        if (this.config.environments[this.env][this.stackName].hooks['pre-deploy']) {
            await Promise.all(this.config.environments[this.env][this.stackName].hooks['pre-deploy'].map(async (action) => {
                try {
                    await Actions.runAction({
                        config: this.config,
                        stackName: this.stackName,
                        env: this.env,
                        action,
                        outputs: stackData,
                    });
                } catch (err) {
                    throw new Error(`pre-deploy: ${err}`);
                }
            }));
        }

        // Get params.
        let cfParams = {};
        if (this.config.environments[this.env][this.stackName].params) {
            cfParams = this.config.environments[this.env][this.stackName].params;
        }

        // Do the actual deploy.
        try {
            await cfn({
                name: this.getFullStackName(),
                template: this.template,
                cfParams,
                awsConfig: {
                    region: this.region,
                },
            });
        } catch (err) {
            throw new Error(`deploy: ${err}`);
        }

        stackData = await this.describeStack();

        // post-deploy hook.
        if (this.config.environments[this.env][this.stackName].hooks['post-deploy']) {
            await Promise.all(this.config.environments[this.env][this.stackName].hooks['post-deploy'].map(async (action) => {
                try {
                    await Actions.runAction({
                        config: this.config,
                        stackName: this.stackName,
                        env: this.env,
                        action,
                        outputs: stackData,
                    });
                } catch (err) {
                    throw new Error(`post-deploy: ${err}`);
                }
            }));
        }
    }

    async runDelete() {
        const exists = await this.runExists();
        if (!exists) {
            throw new Error(`Tried to delete non-existing stack: ${this.stackName}`);
        }

        const data = await this.cloudformation.deleteStack({
            StackName: this.getFullStackName(),
        }).promise();
        if (data.ResponseMetadata.RequestId) {
            console.log(data);
        }

        // await cfn.delete({
        //     name: this.getFullStackName(),
        //     awsConfig: {
        //         region: this.region,
        //     },
        // });
        return true;
    }

    getFullStackName() {
        let result = `${this.config.project}-${this.stackName}-${this.env}`;
        result = result.toLowerCase();

        // Allow overrides. Note: This makes it possible to uppercase stuff again.
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
