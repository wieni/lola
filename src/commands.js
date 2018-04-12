// const cfn = require('cfn');
const yaml = require('node-yaml');
const inquirer = require('inquirer');
const fs = require('fs');

const Logging = require('./logging.js');
const Actions = require('./actions.js');
const CloudFormation = require('./cloudformation.js');

class Commands {
    constructor(config, stackName, env) {
        this.config = config;
        this.stackName = stackName;
        this.env = env;

        // Make some stuff easier.
        this.profile = this.config.environments[this.env][this.stackName].profile;
        this.region = this.config.environments[this.env][this.stackName].region;
        this.template = this.config.stacks[this.stackName].template;
        this.hooks = this.config.environments[this.env][this.stackName].hooks;

        this.params = {};
        if (this.config.environments[this.env][this.stackName].params) {
            this.params = this.config.environments[this.env][this.stackName].params;
        }

        // To avoid confusion: this is our own class, not the aws-sdk one.
        this.cloudformation = new CloudFormation(this.region);
    }

    async runValidate() {
        try {
            const file = await this.getTemplateBody();
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
        if (exists) {
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
                        this.config = newContext.config;
                    }
                } catch (err) {
                    throw new Error(`pre-deploy: ${err}`);
                }
            }));
        }

        // Do the actual deploy.
        if (exists) {
            stackData = await this.cloudformation.describeStack(this.getFullStackName());
            const token = await this.generateToken('update');
            const file = await this.getTemplateBody();

            await this.cloudformation.updateStack(
                this.getFullStackName(),
                token,
                this.params,
                file,
                this.getTags(),
            );

            await this.loopEvents('UPDATE_IN_PROGRESS', token);
        } else {
            const token = await this.generateToken('create');
            const file = await this.getTemplateBody();

            await this.cloudformation.createStack(
                this.getFullStackName(),
                token,
                this.params,
                file,
                this.getTags(),
            );

            await this.loopEvents('CREATE_IN_PROGRESS', token);
        }

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

        if (!input.confirm) {
            throw new Error('Operation aborted by user');
        }

        const token = this.generateToken('delete');
        await this.cloudformation.deleteStack(this.getFullStackName(), token);

        try {
            await this.loopEvents('DELETE_IN_PROGRESS', token);
        } catch (error) {
            if (error.code !== 'ValidationError') {
                throw new Error(error);
            }
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
        await this.runValidate();

        // For now only on existing stacks.
        const exists = await this.runExists();
        if (!exists) {
            throw new Error(`Non-existing stack: ${this.stackName}`);
        }

        // Check if we already HAVE one (which is a problem - delete that one).
        try {
            await this.cloudformation.describeChangeSet(
                this.getFullStackName(),
                CloudFormation.getHash(this.getFullStackName()),
            );
            await this.cloudformation.deleteChangeSet(this.getFullStackName(), CloudFormation.getHash(this.getFullStackName()));
        } catch (error) {
            if (error.code !== 'ChangeSetNotFound') {
                throw new Error(error);
            }
        }

        // Create new one.
        const body = await this.getTemplateBody();
        const changeSetId = await this.cloudformation.createChangeSet(
            this.getFullStackName(),
            body,
            this.params,
            this.getTags(),
            'UPDATE',
        );

        // Wait until it's created.
        let changes = [];
        /* eslint-disable no-await-in-loop */
        do {
            changes = await this.cloudformation.describeChangeSet(this.getFullStackName(), changeSetId);
            await CloudFormation.timeout(1000);
            if (changes.Status === 'FAILED') {
                break;
            }
        } while (changes.Status !== 'CREATE_COMPLETE');
        /* eslint-enable no-await-in-loop */

        await this.cloudformation.deleteChangeSet(this.getFullStackName(), changeSetId);

        if (changes.Changes.length === 0) {
            return 'No changes';
        }

        return `\n${yaml.dump(changes.Changes)}`;
    }

    async loopEvents(successAction, token) {
        let stackData;
        let eventData;

        let noun = 'Create';
        if (successAction === 'DELETE_IN_PROGRESS') {
            noun = 'Delete';
        }
        if (successAction === 'UPDATE_IN_PROGRESS') {
            noun = 'Update';
        }

        /* eslint-disable no-await-in-loop,no-loop-func */
        const eventIds = [];
        do {
            stackData = await this.cloudformation.describeStack(this.getFullStackName());
            eventData = await this.cloudformation.describeStackEvents(this.getFullStackName(), token);

            eventData.forEach(async (event) => {
                if (eventIds.indexOf(event.EventId) === -1) {
                    await Logging.logEvent(this.stackName, noun, event);
                    await eventIds.push(event.EventId);
                }
            });
            await CloudFormation.timeout(250);
        } while (stackData.StackStatus === successAction);
        /* eslint-enable no-await-in-loop,no-loop-func */
    }

    getTags() {
        return {
            project: this.config.project.toLowerCase(),
            creator: this.config.creator.toLowerCase(),
            environment: this.env.toLowerCase(),
            region: this.region.toLowerCase(),
            Name: this.getFullStackName(),
        };
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

    getTemplateBody() {
        return fs.readFileSync(this.template, 'utf8');
    }

    generateToken(action) {
        const cleanStackName = this.stackName.replace('_', '-');
        return `lola-${action}-${cleanStackName}-${Date.now()}`;
    }
}

module.exports = Commands;
