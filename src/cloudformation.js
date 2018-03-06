const cfn = require('cfn');
const AWS = require('aws-sdk');
const yaml = require('node-yaml');
const inquirer = require('inquirer');

const Actions = require('./actions.js');

class Cloudformation {
    constructor(config, stackName, env) {
        this.config = config;
        this.stackName = stackName;
        this.env = env;

        this.profile = this.config.environments[this.env][this.stackName].profile;
        this.region = this.config.environments[this.env][this.stackName].region;
        this.template = this.config.stacks[this.stackName].template;
        this.hooks = this.config.environments[this.env][this.stackName].hooks;

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
        const exists = await this.runExists();
        if (!exists) {
            throw new Error('Does not exist');
        }

        // Get Stack Intel.
        const stackData = await this.describeStack();
        return yaml.dump(stackData);
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
        if (this.hooks && this.hooks['pre-deploy']) {
            await Promise.all(this.hooks['pre-deploy'].map(async (action) => {
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
        if (this.hooks && this.hooks['post-deploy']) {
            await Promise.all(this.hooks['post-deploy'].map(async (action) => {
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

        const input = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: `Delete ${this.stackName}: `,
            },
        ]);
        if (input.confirm) {
            await cfn.delete({
                name: this.getFullStackName(),
                awsConfig: {
                    region: this.region,
                },
            });
        } else {
            throw new Error('Operation aborted by user');
        }
    }

    async runAction() {
        // Get all actions for this stack.
        if (!this.config.stacks[this.stackName].actions || this.config.stacks[this.stackName].actions.length === 0) {
            throw new Error(`No actions found for ${this.stackName}`);
        }

        const input = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Action: ',
                choices: Object.keys(this.config.stacks[this.stackName].actions),
            },
        ]);

        const stackData = await this.describeStack();

        try {
            return await Actions.runAction({
                config: this.config,
                stackName: this.stackName,
                env: this.env,
                action: input.action,
                outputs: stackData,
            });
        } catch (err) {
            throw new Error(err);
        }
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
