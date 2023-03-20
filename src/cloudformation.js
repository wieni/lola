import {
    CloudFormationClient,
    CreateChangeSetCommand,
    CreateStackCommand,
    DeleteChangeSetCommand,
    DeleteStackCommand,
    DescribeChangeSetCommand,
    DescribeStackEventsCommand,
    DescribeStacksCommand,
    UpdateStackCommand,
    UpdateTerminationProtectionCommand,
    ValidateTemplateCommand,
} from '@aws-sdk/client-cloudformation';
import { fromIni } from '@aws-sdk/credential-providers';
import crypto from 'crypto';

/**
 * Abstraction layer above aws sdk.
 */
export default class Cloudformation {
    // Bit bold but no mercy.
    capabilities = ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM', 'CAPABILITY_AUTO_EXPAND'];

    cloudformation;

    constructor(region, profile) {
        this.cloudformation = new CloudFormationClient({
            region,
            credentials: fromIni({
                profile,
                region,
            }),
        });
    }

    /**
     * Validate a template.
     *
     * @param {string} body
     */
    async validateTemplate(TemplateBody) {
        await this.cloudformation.send(
            new ValidateTemplateCommand({
                TemplateBody,
            })
        );
    }

    /**
     * Updates termination protection on a stack.
     *
     * @param {string} stackName
     * @param {string} status
     */
    async updateTerminationProtection(StackName, status) {
        await this.cloudformation.send(
            new UpdateTerminationProtectionCommand({
                EnableTerminationProtection: status,
                StackName,
            })
        );
    }

    /**
     * Get the stack events with a certain optional token
     *
     * @param {string} StackName
     * @param {string} ClientRequestToken
     */
    async describeStackEvents(StackName, ClientRequestToken) {
        const events = await this.cloudformation.send(
            new DescribeStackEventsCommand({
                StackName,
            })
        );

        // Filter out only the good events.
        let result;
        if (events.StackEvents) {
            result = await events.StackEvents.filter(
                (event) => !ClientRequestToken || event.ClientRequestToken === ClientRequestToken
            );
        }

        return result;
    }

    async updateStack(StackName, ClientRequestToken, parameters, TemplateBody, tags) {
        const transposedParams = Cloudformation.transposeParams(parameters);
        const transposedTags = Cloudformation.transposeTags(tags);

        return this.cloudformation.send(
            new UpdateStackCommand({
                StackName,
                Capabilities: this.capabilities,
                ClientRequestToken,
                Parameters: transposedParams,
                Tags: transposedTags,
                TemplateBody,
            })
        );
    }

    /**
     * Creates a new stack.
     *
     * @param {sting} StackName
     * @param {string} ClientRequestToken
     * @param {array} parameters
     * @param {string} TemplateBody
     * @param {array} tags
     */
    async createStack(StackName, ClientRequestToken, parameters, TemplateBody, tags) {
        const transposedParams = Cloudformation.transposeParams(parameters);
        const transposedTags = Cloudformation.transposeTags(tags);

        return this.cloudformation.send(
            new CreateStackCommand({
                StackName,
                Capabilities: this.capabilities,
                EnableTerminationProtection: true,
                ClientRequestToken,
                OnFailure: 'DELETE',
                Parameters: transposedParams,
                Tags: transposedTags,
                TemplateBody,
                // TimeoutInMinutes: 0
            })
        );
    }

    /**
     * Get intel about ONE stack.
     *
     * @param {string} stackName
     */
    async describeStack(StackName) {
        const data = await this.cloudformation.send(
            new DescribeStacksCommand({
                StackName,
                credentials: this.credentials,
            })
        );
        return data.Stacks[0];
    }

    /**
     * Deletes a stack.
     *
     * @param {string} stackName
     */
    async deleteStack(StackName, ClientRequestToken) {
        return this.cloudformation.send(
            new DeleteStackCommand({
                StackName,
                ClientRequestToken,
            })
        );
    }

    /**
     * Create a change set for a stack.
     *
     * @param {string} stackName
     * @param {string} body
     * @param {array} params
     * @param {array} tags
     * @param {string} changeSetType
     *
     * @return string
     */
    async createChangeSet(stackName, body, params, tags, changeSetType = 'UPDATE') {
        const transposedParams = Cloudformation.transposeParams(params);
        const transposedTags = Cloudformation.transposeTags(tags);
        const hash = Cloudformation.getHash(stackName);

        // Create the change set.
        const result = await this.cloudformation.send(
            new CreateChangeSetCommand({
                ChangeSetName: hash,
                StackName: stackName,
                Capabilities: this.capabilities,
                ChangeSetType: changeSetType,
                ClientToken: hash,
                Parameters: transposedParams,
                Tags: transposedTags,
                TemplateBody: body,
            })
        );

        return result.Id;
    }

    /**
     * Get the contents of a change set.
     *
     * @param {string} stackName
     * @param {string} changeSetName
     */
    async describeChangeSet(StackName, ChangeSetName) {
        return this.cloudformation.send(
            new DescribeChangeSetCommand({
                ChangeSetName,
                StackName,
            })
        );
    }

    /**
     * Deletes a change set.
     *
     * @param {string} stackName
     * @param {string} changeSetName
     */
    async deleteChangeSet(StackName, ChangeSetName) {
        return this.cloudformation.send(
            new DeleteChangeSetCommand({
                ChangeSetName,
                StackName,
            })
        );
    }

    /**
     * Returns a hash based on stackName to use as ChangeSetName or smth.
     *
     * @param {string} stackName
     */
    static getHash(stackName) {
        return `lola-${crypto.createHash('md5').update(stackName).digest('hex')}`;
    }

    /**
     * Make a nice aws dimensioned tag array from a regular object.
     *
     * @param {Object} tags
     */
    static transposeTags(tags) {
        const result = [];
        Object.keys(tags).forEach((key) => {
            result.push({
                Key: key,
                Value: tags[key],
            });
        });

        return result;
    }

    /**
     * Make a nice aws dimensioned params array from a regular object.
     *
     * @param {Object} params
     */
    static transposeParams(params) {
        const result = [];
        Object.keys(params).forEach((key) => {
            result.push({
                ParameterKey: key,
                ParameterValue: params[key],
            });
        });

        return result;
    }

    /**
     * @param {int} ms
     */
    static timeout(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
