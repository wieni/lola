const cfn = require('cfn');
const yaml = require('node-yaml');
const inquirer = require('inquirer');
const fs = require('fs');

const Actions = require('./actions.js');
const CloudFormation = require('./cloudformation.js');

class Commands {
    constructor(config, stackName, env) {
        this.config = config;
        this.stackName = stackName;
        this.env = env;

        this.profile = this.config.environments[this.env][this.stackName].profile;
        this.region = this.config.environments[this.env][this.stackName].region;
        this.template = this.config.stacks[this.stackName].template;
        this.hooks = this.config.environments[this.env][this.stackName].hooks;

        // To avoid confusion: this is our own class, not the aws-sdk one.
        this.cloudformation = new CloudFormation(this.region);
    }

    async runValidate() {
        try {
            const file = await fs.readFileAsync(this.template, 'utf8');
            await this.cloudformation.validateTemplate(file);
        } catch (error) {
            throw new Error(error);
        }
    }

    async runStatus() {
        const exists = await this.runExists();
        if (!exists) {
            throw new Error('Does not exist');
        }

        // Get Stack Intel.
        const stackData = await this.cloudformation.describeStack(this.getFullStackName());
        return yaml.dump(stackData);
    }

    async runExists() {
        try {
            await this.cloudformation.describeStack(this.getFullStackName());
            return true;
        } catch (err) {
            return false;
        }
    }

    async runDeploy() {
        // Does template validate?
        const exists = await this.runExists();

        let stackData = {};
        if (!exists) {
            console.warn('Stack does not exist, creating');
        } else {
            stackData = await this.cloudformation.describeStack(this.getFullStackName());
        }

        // pre-deploy hook.
        if (this.hooks && this.hooks['pre-deploy']) {
            await Promise.all(this.hooks['pre-deploy'].map(async (action) => {
                try {
                    const newContext = await Actions.runAction({
                        config: this.config,
                        stackName: this.stackName,
                        env: this.env,
                        action,
                        outputs: stackData,
                    });
                    // TODO: SHould validate this!
                    if (newContext && newContext.config) {
                        console.log(newContext);
                        this.config = newContext.config;
                    }
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
                tags: {
                    project: this.config.project.toLowerCase(),
                    creator: this.config.creator.toLowerCase(),
                    environment: this.env.toLowerCase(),
                    region: this.region.toLowerCase(),
                },
            });
        } catch (err) {
            throw new Error(`deploy: ${err}`);
        }

        stackData = await this.cloudformation.describeStack(this.getFullStackName());

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

        const stackData = await this.cloudformation.describeStack(this.getFullStackName());

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

    async runTerminationProtection() {
        const exists = await this.runExists();
        if (!exists) {
            throw new Error(`Non-existing stack: ${this.stackName}`);
        }

        const stackData = await this.cloudformation.describeStack(this.getFullStackName());
        let status = String(stackData.EnableTerminationProtection);

        const input = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: `Termination protection status is currently ${status}. Change status to: `,
                choices: ['true', 'false'],
            },
        ]);

        if (status !== input.action) {
            status = true;
            if (input.action === 'false') {
                status = false;
            }

            await this.cloudformation.updateTerminationProtection(this.getFullStackName(), status);

            return `Status changed to ${input.action}`;
        }

        return 'Status stays the same, no changes.';
    }

    async runChangeSet() {
        const exists = await this.runExists();
        if (!exists) {
            throw new Error(`Non-existing stack: ${this.stackName}`);
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

module.exports = Commands;
