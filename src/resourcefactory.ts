/*
 * SPDX-License-Identifier: Apache-2.0
 */

import fs = require('fs');

import jsonata from 'jsonata';
import mkdirp from 'mkdirp';

import { render, configure, renderString } from 'nunjucks';

import path = require('path');
import { load } from 'js-yaml';

import { logger } from './logger';
import { Config } from './config';

interface TemplateCfg {
    cfg: any;
    data: any;
    outputDir: string;
    env: any;
}

// for the json data
type AnyMap = {
    [id: string]: any;
};

/**
 * Resource Factory
 * Then call start() to produce the documentation
 */
export default class ResourceFactory {
    private jsonData: AnyMap;
    private subTemplateCfgs: TemplateCfg[];
    private outputRoot: string;
    private templateRoot: string;
    private force: boolean;

    /* Builder method to create an configured instance
     */
    static async create(config: Config): Promise<ResourceFactory> {
        const rf = new ResourceFactory(config);
        await rf.setup();
        return rf;
    }

    /**
     * Check the local of the input file, location of the output files
     * and create the directories if needed
     *
     * @param config
     */
    private constructor(config: Config) {
        logger.info(`Using the template rooted at ${config.template}`);
        if (!fs.existsSync(config.template)) {
            throw new Error(`Unknown template::${config.template}`);
        }

        this.templateRoot = path.resolve(config.template);
        // if (!fs.existsSync(path.join(this.templateRoot, '_cfg.yaml'))) {
        //     throw new Error(`Can not locate _cfg.yaml in the tempalte`);
        // }

        this.outputRoot = path.resolve(config.output);

        // Iterate over the inputs and validate the file is correct
        // then load the files assuming they are json for moment
        this.jsonData = {};
        let property: keyof typeof config.input;

        for (property in config.input) {
            const filename = path.resolve(config.input[property]);
            if (!fs.existsSync(filename)) {
                throw new Error(`Unable to locate ${filename}`);
            }

            const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
            this.jsonData[property] = data;
        }

        this.force = config.force;
        this.subTemplateCfgs = [];
    }

    private async isDirEmpty(): Promise<boolean> {
        return fs.promises.readdir(this.outputRoot).then((files) => {
            return files.length === 0;
        });
    }

    /**
     * For the given tempalte set, look for all sub-directories
     */
    public async setup(): Promise<void> {
        logger.info(`Using the output directory of ${this.outputRoot}`);

        // create the output directory cleaning if needed
        const exists = fs.existsSync(this.outputRoot);
        if (!exists) {
            logger.info('Creating output dir');
            await mkdirp(this.outputRoot);
        } else {
            const empty = await this.isDirEmpty();
            if (empty === false) {
                if (this.force === true) {
                    logger.info('Removing contents');
                    fs.rmSync(this.outputRoot, { recursive: true, force: true });
                } else {
                    logger.info('Directory not empty');
                    throw new Error(`${this.outputRoot} is not empty, use --force to overwrite`);
                }
            }
        }

        // load up the templates and the hierarchy
        logger.info('Setting up the templates');
        const dir = await fs.promises.opendir(this.templateRoot);
        for await (const dirent of dir) {
            if (dirent.isDirectory()) {
                logger.info(`Handling subdirectory ${dirent.name}`);
                const subCfg = await this.createSubTemplate(path.join(this.templateRoot, dirent.name));
                if (subCfg) this.subTemplateCfgs.push(subCfg);
            }
        }
    }

    /**
     * Load the cfg.yaml for each subtemplate, create the njk template engine with additionla
     * filters.
     *
     * @param inputpath
     * @returns
     */
    private async createSubTemplate(inputpath: string): Promise<TemplateCfg | undefined> {
        // Loop through all the files in the temp directory
        const inputCfgFile = path.join(inputpath, '_cfg.yaml');
        if (!fs.existsSync(inputCfgFile)) {
            logger.warn(`No _cfg.yaml found for ${inputpath}`);
            return undefined;
        }

        const subName = path.basename(inputpath);
        const outputDir = path.resolve(this.outputRoot, subName);
        logger.info(`${this.templateRoot} ${subName} Using the output directory of ${outputDir}`);

        mkdirp.sync(outputDir);

        const cfg = load(fs.readFileSync(inputCfgFile, 'utf-8'));

        // make the output directory
        const env = configure(inputpath);

        // trim out typenames and replace with void if needed
        env.addFilter('typename', (str = '') => {
            const typename = str.trim();
            if (typename === '') {
                return 'void';
            } else {
                return typename;
            }
        });

        // trim out typenames and replace with void if needed
        env.addFilter('objectname', (str = '') => {
            const typename = str.trim();
            // console.log(`=${typename.trim()}=`);
            if (typename.startsWith('#')) {
                return typename.substring(typename.lastIndexOf('/') + 1);
            } else {
                return typename;
            }
        });

        return { cfg, env, outputDir, data: this.jsonData };
    }

    /**
     * Starts the factory generating output based on the template configuration
     *
     */
    public async start(): Promise<void> {
        for (const templateCfg of this.subTemplateCfgs) {
            await this.part(templateCfg);
        }
    }

    /** For each part in the configuration, evaluate the JSONATA on the
     * input data, and pass that to the template engine
     */
    private async part(templateCfg: TemplateCfg): Promise<void> {
        const parts = templateCfg.cfg.parts;
        logger.info(`Parts = ${JSON.stringify(parts)}`);
        // todo: change this loop to a better foreach
        parts.forEach((step: any) => {
            // evaluate the JSONata against the input data to get the context needed
            logger.info(`${JSON.stringify(step)}`);
            const expression = jsonata(step['filter']);
            const result = expression.evaluate(templateCfg.data);
            logger.info(`${JSON.stringify(result)}`);
            // Assuming this is an array, iterate over the outputs

            result.forEach((action: any) => {
                const templateFile = step.template;

                const outputFilename = path.join(templateCfg.outputDir, renderString(step.filename, action));

                // render the output, and format is needed
                const output = render(templateFile, action);

                logger.info(`Writing output file ${outputFilename}`);
                fs.writeFileSync(`${outputFilename}`, output);
            });
        });
    }
}
