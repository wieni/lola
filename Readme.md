# Lola

![image](https://david-dm.org/wieni/lola.svg)

Lola is an opiniated cli tool to orchestrate AWS Cloudformation templates.

## Installation

``` bash
  $ [sudo] npm install lola -g
```

## Usage

### lola.yml

Lola expects a config file (lola.yml) which holds information about the AWS Cloudformation stacks you wish to control.

```yml
# The name of your project. This is required and will be used in
# stack names, tags, etc.
project: <project-name>

# List of key-value tags that should be added to each stack. When set on this or a lower level,
# it wil override the default tags of project, environment and region.
tags:
  <name-of-tag>: <value-of-tag>
  <name-of-another-tag>: <value-of-another-tag>

# Stacks is a description of the different cloudformation stacks you'll want to
# manage and the specific order in which they'll need to be managed.
stacks:
    # Give that stack a name.
    <stack1>:
        template: <location of the template.yml file for this stack>
        description: <optionally describe this stack>
        actions:
            preDeploy: preDeployScript.js

environments:
    # This is reserved, you can set global stuff for each stack in each env. Optional.
    default:
        <stack1>:
            # This will override ANY region/profile for stack1 in ANY env below
            region: <aws region>
            profile: <~/.aws/credentails profile name>
            tags:
              <name-of-tag>: <value-of-tag>
              <name-of-another-tag>: <value-of-another-tag>
    # Give that environment a name.
    <dev>:
        # Environment params for <stack1>
        <stack1>:
            # Override the stackname for this env. Optional, if not present lola generates one.
            name: <my-stack-dev>
            region: <aws region>
            profile: <~/.aws/credentails profile name>
            tags:
              <name-of-tag>: <value-of-tag>
              <name-of-another-tag>: <value-of-another-tag>
            terminationProtection: <true|false>
            params:
                <Param1>: <Value1>
            hooks:
                pre-deploy:
                    - preDeploy
```

### cli

```
$ lola --help
Usage: lola [options] [command]

Do AWS Stuff

Options:
  -V, --version                                   output the version number
  -c, --config-file <configFile>                  Optional config file
  -o, --options-file <optionsFile>                Optional deploy options file
  -v, --verbose                                   Verbose output
  -s, --options-stack <optionsStack>              Stack
  -e, --options-environment <optionsEnvironment>  Environment
  -h, --help                                      display help for command

Commands:
  validate|v                                      Validates a stack
  status|s                                        Get the status of a stack
  deploy|d                                        Deploys a stack
  delete|x                                        Deletes a stack
  action|a                                        Runs an action on a stack/env
  protection|p                                    Toggles termination protection on a stack/env
  changeSet|c                                     Create and view changeset of a stack/env
  help [command]                                  display help for command
  ```

### Running lola

When running a lola command (validate, status, ..) without arguments, lola will ask about two things: **the stack** and the **environment**. These can also be provided through an input file (-o flag) or other input flags.


### deploy hooks

- pre-deploy

### actions

Each stack can define actions. Each action can be run on it's own or can be attached to one of the deploy hooks.

Since version 2.0.0, you can use traditional Common.js Modules or new ES Modules.

**Common.js Modules**\
In `package.json` set `"type": "commonjs"` or leave it empty or name file with `.cjs` extension, not `.js`.

```js
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

/**
 * @param Object context
 */
async function runAction(context) {
    const { region } = context.config.environments[context.env][context.stackName];
    const { profile } = context.config.environments[context.env][context.stackName];
    const { params } = context.config.environments[context.env][context.stackName];

    throw new Error('Error');
}

module.exports.runAction = runAction;
```

**ES Modules**\
In `package.json` set `"type": "module"` or name file with `.mjs` extension, not `.js`.

```js
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
/**
 * @param Object context
 */
export async function runAction(context) {
    const { region } = context.config.environments[context.env][context.stackName];
    const { profile } = context.config.environments[context.env][context.stackName];
    const { params } = context.config.environments[context.env][context.stackName];

    throw new Error('Error');
}
```
