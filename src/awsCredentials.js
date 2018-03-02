const AWS = require('aws-sdk');
const { join, dirname } = require('path');
const { readFileSync } = require('fs');
const { parse } = require('ini');
const { homedir } = require('os');

class AwsCredentials {
    static async loadCredentials(config, stackName, env) {
        const { profile } = config.environments[env][stackName];
        const { region } = config.environments[env][stackName];

        return this.assumeRole(profile, region)
            .then(credentials => credentials)
            .catch(() => new AWS.SharedIniFileCredentials({ profile, region }));
    }

    static async assumeRole(profile, region) {
        return new Promise((resolve, reject) => {
            // This is just used to determine the config location
            const creds = new AWS.SharedIniFileCredentials();

            const awsProfileDir = creds.filename ? dirname(creds.filename) : join(homedir(), '.aws');
            const file = process.env.AWS_CONFIG_FILE || join(awsProfileDir, 'config');

            const config = parse(readFileSync(file, 'utf-8'))[`profile ${profile}`];
            const sts = new AWS.STS({
                credentials: new AWS.SharedIniFileCredentials({
                    profile: config.source_profile,
                    region,
                }),
            });

            const options = {
                RoleArn: config.role_arn,
                RoleSessionName: `${profile}-${Date.now()}`,
            };
            sts.assumeRole(options, (error, response) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(new AWS.Credentials(
                        response.Credentials.AccessKeyId,
                        response.Credentials.SecretAccessKey,
                        response.Credentials.SessionToken,
                    ));
                }
            });
        });
    }
}

module.exports = AwsCredentials;
