const AWS = require('aws-sdk');
const moment = require('moment');
const chalk = require('chalk');
const cmd = require('node-cmd-promise');
const { yamlParse } = require('yaml-cfn');
const fs = require('fs');
const inquirer = require('inquirer');
const zipdir = require('zip-dir');

async function zipDir(dir) {
    return new Promise((resolve, reject) => {
        zipdir(dir, (err, buf) => {
            if (err !== null) return reject(err);
            return resolve(buf);
        });
    });
}

/**
 * @param Object context
 */
async function runAction(context) {
    const { region } = context.config.environments[context.env][context.stackName];
    const { profile } = context.config.environments[context.env][context.stackName];
    const { params } = context.config.environments[context.env][context.stackName];

    AWS.config.credentials = new AWS.SharedIniFileCredentials({
        profile,
        region,
    });

    // Reverse engineer all the functions out of the template body.
    const templateBody = await fs.readFileSync(`${process.cwd()}/${context.config.stacks[context.stackName].template}`, 'utf8');
    const templateParsed = await yamlParse(templateBody);

    const lambdasExtra = ['-all-'];
    const lambdas = [];
    Object.keys(templateParsed.Resources).forEach((resource) => {
        if (templateParsed.Resources[resource].Type === 'AWS::Lambda::Function') {
            lambdas.push(resource);
            lambdasExtra.push(resource);
        }
    });

    // Make a decision about what to deploy.
    const input = await inquirer.prompt([
        {
            type: 'list',
            name: 'lambda',
            message: 'Which one to deploy?: ',
            choices: lambdasExtra,
        },
    ]);

    let chosenLambdas = [input.lambda];
    if (input.lambda === '-all-') {
        chosenLambdas = lambdas;
    }
    const s3 = new AWS.S3();
    const lambdaService = new AWS.Lambda({ region });
    const bucketName = params.LambdaBucket;

    for (const lambda of chosenLambdas) {
        // Get function name.
        let functionName;
        context.outputs.Outputs.forEach((output) => {
            if (output.OutputKey === lambda) {
                functionName = output.OutputValue;
            }
        });
        if (functionName === undefined) {
            throw new Error(`function name not found for ${lambda}`);
        }

        // Get local path.
        const s3key = templateParsed.Resources[lambda].Properties.Code.S3Key;
        const path = s3key.replace('.zip', '');

        // Build it.
        const output = await cmd(`(cd ${path}; rm -Rf node_modules; npm install --production)`);
        console.log(`[${chalk.gray(moment().format('HH:mm:ss'))}] Cleaning ${path}: ${output.stdout.replace(/(\r\n|\n|\r)/gm, '')}`);

        // Zip it.
        const zipData = await zipDir(`${process.cwd()}/${path}`);

        const uploadData = await s3.putObject({
            Bucket: bucketName,
            Key: s3key,
            Body: zipData,
        }).promise();
        console.log(`[${chalk.gray(moment().format('HH:mm:ss'))}] Uploaded ${s3key}`);

        // Trigger function update. Could we not send the zip directly?
        // But what with the cloudformation template then?
        await lambdaService.updateFunctionCode({
            FunctionName: functionName,
            Publish: true,
            S3Bucket: params.LambdaBucket,
            S3Key: s3key,
            S3ObjectVersion: uploadData.VersionId,
        }).promise();

        console.log(`[${chalk.gray(moment().format('HH:mm:ss'))}] Refreshed ${functionName}`);
    }

    console.log(`[${chalk.gray(moment().format('HH:mm:ss'))}] All done.`);
}

module.exports.runAction = runAction;
