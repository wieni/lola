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
    async deleteStack(stackName) {
        const params = {
            StackName: stackName,
        };
        await this.cloudformation.deleteStack(params).promise();
        await this.cloudformation.waitFor('stackDeleteComplete', params).promise();
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
        const transposedTags = await Cloudformation.TransposeTags(tags);
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

    async describeChangeSet(stackName, changeSetName) {
        const result = await this.cloudformation.describeChangeSet({
            ChangeSetName: changeSetName,
            StackName: stackName,
        }).promise();

        return result;
    }

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
        return crypto.createHash('md5').update(stackName).digest('hex');
    }

    /**
     * Make a nice aws dimensioned tag array from a regular object.
     *
     * @param {Object} tags
     */
    static TransposeTags(tags) {
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

    static timeout(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = Cloudformation;
