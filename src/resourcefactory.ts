/*
 * SPDX-License-Identifier: Apache-2.0
 */
// import { src, dest, series } from 'gulp';
// import through2 from 'through2';
import nunjucks = require('nunjucks');
import fs = require('fs');

import jsonata from 'jsonata';
import mkdirp from 'mkdirp';

import { configure } from 'nunjucks';

import path = require('path');
import { load } from 'js-yaml';

import { logger } from './logger';
import { Config } from './config';

interface TemplateCfg {
    parts: PartMap;
    data: AnyMap;
    outputDir: string;
    env: AnyMap;
    rootPath: string;
}

interface Part {
    name: string;
    inputs: string[];
    template: string;
    filename: string;
    filter: string;
}

// for the json data
type AnyMap = {
    [id: string]: any;
};

type PartMap = {
    [id: string]: Part;
};

/**
 * Resource Factory
 * Then call start() to produce the documentation
 */
export default class ResourceFactory {
    private jsonData: AnyMap;
    private subTemplateCfgs?: TemplateCfg;
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
        if (!fs.existsSync(path.join(this.templateRoot, '_cfg.yaml'))) {
            throw new Error(`Can not locate _cfg.yaml in the tempalte`);
        }

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
        this.subTemplateCfgs = await this.createSubTemplate(this.templateRoot);

        // const dir = await fs.promises.opendir(this.templateRoot);
        // for await (const dirent of dir) {
        //     if (dirent.isDirectory()) {
        //         logger.info(`Handling subdirectory ${dirent.name}`);
        //         const subCfg = await this.createSubTemplate(path.join(this.templateRoot, dirent.name));
        //         if (subCfg) this.subTemplateCfgs.push(subCfg);
        //     }
        // }
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

        const cfg: any = load(fs.readFileSync(inputCfgFile, 'utf-8'));

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

        const partMap = cfg.parts.reduce((map: any, obj: any) => {
            map[obj.template] = obj;
            return map;
        }, {});

        return { parts: partMap, env, outputDir, data: this.jsonData, rootPath: cfg['rootPath'] };
    }

    /**
     * Starts the factory generating output based on the template configuration
     *
     */
    public async start(): Promise<void> {
        // console.log(this.subTemplateCfgs);

        // let's start the streaming....
        // const taskFn = series(() => {
        //     return src(`${this.subTemplateCfgs?.rootPath}/**/*`)
        //         .pipe(through2.obj(this.transform))
        //         .pipe(dest(`${this.subTemplateCfgs?.outputDir}`));
        // });

        // taskFn((args: any) => {
        //     logger.info(JSON.stringify(args));
        // });

        for (const p in this.subTemplateCfgs?.parts) {
            const part = this.subTemplateCfgs?.parts[p];
            if (!part) {
                throw new Error();
            }
            this.singlePartRun(part);
        }
    }

    public async singlePartRun(part: Part): Promise<void> {
        const filter = 'filter';
        const expression = jsonata(part[filter]);
        const result = expression.evaluate(this.jsonData);

        // logger.info(part);
        // iterate over the results
        result.forEach((action: any) => {
            const outputFilename = path.join(`${this.subTemplateCfgs?.outputDir}`, action._filename);
            const templateFile = path.join(`${this.subTemplateCfgs?.rootPath}`, part.template);
            // logger.info(action._data);
            // writeout the data as well for debug purposes
            // fs.writeFileSync(path.join(this.output, `data-${action._filename}.json`), JSON.stringify(action._data));

            // render the output, and format is needed
            const output = nunjucks.render(templateFile, action._data);

            // if (action._prettier && action._prettier !== 'none') {

            //     output = prettier.format(output, action._prettier);
            // }
            logger.info(`Writing output file ${outputFilename}`);
            fs.writeFileSync(`${outputFilename}${action._extension}`, output);
        });
    }

    transform(this: any, file: any, _: any, cb: any) {
        // it's a Transform
        if (file.extname === '.njk') {
            // let's see if we can double the file and update the filename
            console.log(`Duplicating`);

            // so this needs the part of the code that does the templating as before
            // look up the part configuration based on the filename/template name
            // evaluate the JSONata against the input data to get the context needed

            const expression = jsonata(this.subTemplateCfgs['filter']);
            const result = expression.evaluate(this.subTemplateCfgs.data);
            logger.info(`${JSON.stringify(result)}`);
            // Assuming this is an array, iterate over the outputs

            result.forEach((action: any) => {
                const templateFile = this.subTemplateCfgs.template;
                const outputFilename = path.join(
                    this.subTemplateCfg.outputDir,
                    this.subTemplateCfg.filename,
                ); /*renderString(step.filename, action);*/
                // render the output, and format is needed
                const output = nunjucks.render(templateFile, action);

                logger.info(`Writing output file ${outputFilename}`);
                const newFile = file.clone();
                newFile.stem = outputFilename;
                file.fs.writeFileSync(`${outputFilename}`, output);
            });
            // evalaute the jsonata

            // and create tne files via the filter

            const newFile = file.clone();
            newFile.stem = `new ${file.stem}`;

            this.push(file);
            this.push(newFile);
            cb();
        } else {
            console.log(`staight copy of ${file.path}`);
            cb(null, file);
        }
    }

    /** For each part in the configuration, evaluate the JSONATA on the
     * input data, and pass that to the template engine
     */
    // private async part(templateCfg: TemplateCfg): Promise<void> {
    //     const parts = templateCfg.parts;
    //     logger.info(`Parts = ${JSON.stringify(parts)}`);
    //     // todo: change this loop to a better foreach
    //     parts.forEach((step: any) => {
    //         // evaluate the JSONata against the input data to get the context needed
    //         logger.info(`${JSON.stringify(step)}`);
    //         const expression = jsonata(step['filter']);
    //         const result = expression.evaluate(templateCfg.data);
    //         logger.info(`${JSON.stringify(result)}`);
    //         // Assuming this is an array, iterate over the outputs

    //         result.forEach((action: any) => {
    //             const templateFile = step.template;

    //             const outputFilename = path.join(templateCfg.outputDir, renderString(step.filename, action));

    //             // render the output, and format is needed
    //             const output = render(templateFile, action);

    //             logger.info(`Writing output file ${outputFilename}`);
    //             fs.writeFileSync(`${outputFilename}`, output);
    //         });
    //     });
    // }
}
