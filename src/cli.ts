#!/usr/bin/env node
/*
 * SPDX-License-Identifier: Apache-2.0
 */

import * as sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

import * as yargs from 'yargs';
import Config from './config';

import ResourceFactory from './resourcefactory';

import { logger } from './logger';
import { readFileSync } from 'fs';
import * as path from 'path';

const pjson = readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8');
const version = JSON.parse(pjson).version;

const results: any = yargs
    .command(['create', '$0'], 'Create resources', {
        file: {
            alias: 'f',
            demandOption: true,
            describe: 'Name of the metadata file (json or yaml) to load',
            requiresArg: true,
        },
        outputdir: {
            alias: 'o',
            default: 'out',
            demandOption: true,
            describe: 'Directory files to be written to (will be created if does not exist)',
            requiresArg: true,
        },
        force: {
            type: 'boolean',
            default: 'false',
            describe: 'Force the outputdirectory to be cleaned if it has contents',
        },
        template: {
            alias: 't',
            demandOption: true,
            describe: 'The name of the template category to process the metadata ',
            requiresArg: true,
        },
        'template-dir': {
            alias: '',
            default: path.resolve(process.cwd(), 'templates'),
            describe: `The directory containing the templates, default is CWD ${path.resolve(
                process.cwd(),
                'templates',
            )}`,
            requiresArg: true,
        },
    })
    .help()
    .wrap(null)
    .alias('v', 'version')
    .version('0.0.1')
    .describe('v', 'show version information')
    .strict().argv;

// setup the config here..
const config: Config = {
    input: results.file,
    output: results.outputdir,
    template: results.template,
    templateDir: results['template-dir'],
    force: results.force,
};

const main = async (config: Config) => {
    logger.info(`v${version}`);
    logger.info(`${JSON.stringify(config)}`);

    // note in the resource generator, there is also a 'ConverterFactory' that
    // will allow input formats that are not JSON/YAML to be converted. Eg protobuf
    const rf = await ResourceFactory.create(config);

    // start processing
    await rf.start();
};

main(config)
    .then(() => {
        logger.info('System configured and running');
    })
    .catch((e: any) => {
        logger.error(e);
        logger.error(e.stack);
    });
