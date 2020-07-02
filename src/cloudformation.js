const AWS = require('aws-sdk');
const crypto = require('crypto');

/**
 * Abstraction layer above aws sdk.
 */
class Cloudformation {
    constructor(region) {
        // Bit bold but no mercy.
        this.capabilities = [
            'CAPABILITY_IAM',
            'CAPABILITY_NAMED_IAM',
        ];

        this.cloudformation = new AWS.CloudFormation({
            region,
        });
    }

    /**
     * Validate a template.
     *
     * @param {string} body
     */
    async validateTemplate(body) {
        await this.cloudformation.validateTemplate({
            TemplateBody: body,
        }).promise();
    }

    /**
     * Updates termination protection on a stack.
     *
     * @param {string} stackName
     * @param {string} status
     */
    async updateTerminationProtection(stackName, status) {
        return this.cloudformation.updateTerminationProtection({
            EnableTerminationProtection: status,
            StackName: stackName,
        }).promise();
    }

    /**
     * Get the stack events with a certain optional token
     *
     * @param {string} StackName
     * @param {string} ClientRequestToken
     */
    async describeStackEvents(StackName, ClientRequestToken) {
        const events = await this.cloudformation.describeStackEvents({
            StackName,
            // NextToken: 'STRING_VALUE',

        }).promise();

        // Filter out only the good events.
        let result;
        if (events.StackEvents) {
            result = await events.StackEvents.filter((event) => !ClientRequestToken || event.ClientRequestToken === ClientRequestToken);
        }

        return result;
    }

    async updateStack(StackName, ClientRequestToken, parameters, TemplateBody, tags) {
        const transposedParams = await Cloudformation.transposeParams(parameters);
        const transposedTags = await Cloudformation.transposeTags(tags);

        const params = {
            StackName,
            Capabilities: this.capabilities,
            ClientRequestToken,
            Parameters: transposedParams,
            Tags: transposedTags,
            TemplateBody,
        };
        return this.cloudformation.updateStack(params).promise();
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
        const transposedParams = await Cloudformation.transposeParams(parameters);
        const transposedTags = await Cloudformation.transposeTags(tags);

        return this.cloudformation.createStack({
            StackName,
            Capabilities: this.capabilities,
            EnableTerminationProtection: true,
            ClientRequestToken,
            OnFailure: 'DELETE',
            Parameters: transposedParams,
            Tags: transposedTags,
            TemplateBody,
            // TimeoutInMinutes: 0
        }).promise();
    }

    /**
     * Get intel about ONE stack.
     *
     * @param {string} stackName
     */
    async describeStack(stackName) {
        const data = await this.cloudformation.describeStacks({
            StackName: stackName,
        }).promise();
        return data.Stacks[0];
    }

    /**
     * Deletes a stack.
     *
     * @param {string} stackName
     */
    async deleteStack(StackName, ClientRequestToken) {
        return this.cloudformation.deleteStack({
            StackName,
            ClientRequestToken,
        }).promise();
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
        const transposedParams = await Cloudformation.transposeParams(params);
        const transposedTags = await Cloudformation.transposeTags(tags);
        const hash = await Cloudformation.getHash(stackName);

        // Create the change set.
        const result = await this.cloudformation.createChangeSet({
            ChangeSetName: hash,
            StackName: stackName,
            Capabilities: this.capabilities,
            ChangeSetType: changeSetType,
            ClientToken: hash,
            Parameters: transposedParams,
            Tags: transposedTags,
            TemplateBody: body,
        }).promise();

        return result.Id;
    }

    /**
     * Get the contents of a change set.
     *
     * @param {string} stackName
     * @param {string} changeSetName
     */
    async describeChangeSet(stackName, changeSetName) {
        const result = await this.cloudformation.describeChangeSet({
            ChangeSetName: changeSetName,
            StackName: stackName,
        }).promise();

        return result;
    }

    /**
     * Deletes a change set.
     *
     * @param {string} stackName
     * @param {string} changeSetName
     */
    async deleteChangeSet(stackName, changeSetName) {
        const result = await this.cloudformation.deleteChangeSet({
            ChangeSetName: changeSetName,
            StackName: stackName,
        }).promise();

        return result;
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

module.exports = Cloudformation;
