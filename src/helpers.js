const chalk = require('chalk');
const moment = require('moment');

/**
 * Lola helper functions.
 *
*/
class Helpers {
    static async log(message) {
        console.log(`[${chalk.gray(moment().format('HH:mm:ss'))}] ${message}`);
    }

    static async logError(subject, message) {
        this.log(`${chalk.red(subject)}: ${message}`);
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

module.exports = Helpers;
