#!/usr/bin/env node

const program = require('commander');

program
    .version('0.0.1')
    .description('Do AWS Stuff')
    .option('-c, --config-file <configFile>', 'Optional config file')
    .option('-d, --deploy-file <deployFile>', 'Optional deploy file')
    .parse(process.argv);

console.log('START');
