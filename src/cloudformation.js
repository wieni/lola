const AWS = require('aws-sdk');

/**
 * Abstraction layer above aws sdk.
 */
class Cloudformation {
    constructor(region) {
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
}

module.exports = Cloudformation;
