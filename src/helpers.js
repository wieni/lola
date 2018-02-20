
class Helpers {
    static createFullStackName(config, stackName, env) {
        let result = `${config.project}-${stackName}-${env}`;

        if (config.environments[env]
            && config.environments[env].stackName
            && config.environments[env].stackName.name
        ) {
            result = config.environments[env].stackName.name;
        }

        return result;
    }
}

module.exports = Helpers;
