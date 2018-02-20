# Lola

Lola is an opiniated tool to do stuff within the AWS Cloud. The main focus is on creating/updating cloudformation templates but some peripheral activity should be possible as well.

## Requirements

- High enough node version. (8)

## Installation

1. Clone the repo
2. ```yarn install```

## Usage

### config.yml

This is the main project file. Lola reads this file to get a grip on what you want to get done.

```yml
# The name of your project. This is required and will be used in
# stack names etc.
project: <project-name>

# Region and profile are not required but will be asked if not present.
region: <aws region>
profile: <~/.aws/credentails profile name>

# Stacks is a description of the different cloudformation stacks you'll want to
# manage and the specific order in which they'll need to be managed.
stacks:
    # Give that stack a name.
    <stack1>:
        template: <location of the template.yml file for this stack>

environments:
    # Give that environment a name.
    <dev>:
        # Environment params for <stack1>
        <stack1>:
            # Override the stackname for this env. Optional, if not present lola generates one.
            name:
```

### options

There are some choices to be made when running lola:

* Which stacks you want to apply your action on
* Which env (if any) you want to apply your action on
* Which action you want to run

These will be asked when running lola but can also be provided through an input file (-o flag)