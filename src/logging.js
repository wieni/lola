const chalk = require('chalk');
const moment = require('moment');

/**
 * Lola logging functions.
 *
*/
class Logging {
    static async log(message) {
        console.log(`[${chalk.gray(moment().format('HH:mm:ss'))}] ${message}`);
    }

    static async logError(subject, message) {
        this.log(`${chalk.red(subject)}: ${message}`);
    }

    static async logEvent(stackName, action, event) {
        /* eslint-disable max-len */
        console.log(`[${chalk.gray(moment(event.Timestamp).format('HH:mm:ss'))}] ${action} ${chalk.cyan(stackName)}: ${event.ResourceType} - ${chalk.yellow(event.LogicalResourceId)} ${chalk.green(event.ResourceStatus)} ${event.ResourceStatusReason || ''}`);
        /* eslint-enable max-len */
    }

    static async logOk(subject, message, indent = false) {
        if (indent) {
            const result = `${chalk.green(subject)}: ${message}`;
            this.log(result.replace(/\n\r?/g, '\n\t'));
        } else {
            this.log(`${chalk.green(subject)}: ${message}`);
        }
    }

    static async logIfVerbose(message, verbose) {
        if (verbose) {
            this.log(message);
        }
    }
}

module.exports = Logging;
