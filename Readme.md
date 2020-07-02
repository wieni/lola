# Lola

![image](https://david-dm.org/wieni/lola.svg)

Lola is an opiniated cli tool to organise and deploy AWS Cloudformation templates.

## Installation

``` bash
  $ [sudo] npm install lola -g
```

## Usage

### lola.yml

This is the main project file. Lola reads this file to get a grip on what you want to get done.

```yml
# The name of your project. This is required and will be used in
# stack names, tags, etc.
project: <project-name>

# Email adress of the creator. Will be used as tag in each stack.
creator: <e-mail address>


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
    # This is reserved, you can set global stuff for each stack in each env
    default:
        <stack1>:
            # This will override ANY region/profile for stack1 in ANY env below
            region: <aws region>
            profile: <~/.aws/credentails profile name>
    # Give that environment a name.
    <dev>:
        # Environment params for <stack1>
        <stack1>:
            # Override the stackname for this env. Optional, if not present lola generates one.
            name: <my-stack-dev>
            terminationProtection: <true|false>
            params:
                <Param1>: <Value1>
            hooks:
                pre-deploy:
                    - preDeploy
```

### options

There are some choices to be made when running lola:

* Which stacks you want to apply your action on
* Which env (if any) you want to apply your action on

These will be asked when running lola but can also be provided through an input file (-o flag) or other input flags.

### deploy hooks

- pre-deploy

### actions

Each stack can define actions. Each action can be run on it's own or can be attached to one of the deploy hooks.


```js
/**
 *
 * @param Object config
 *   The full config object file
 * @param String stackName
 *   The stackName currently running
 * @param String env
 *   The env for which the current stack is running.
 */
function runAction(config, stackName, env) {
    console.log(config);

    throw new Error('Error');
}

module.exports.runAction = runAction;
```
