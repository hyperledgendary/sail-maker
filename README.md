# sail-maker

A Templating Tool but dialled up to 11!

Sail pulls together one or more data files (eg JSON) and then applies these through a template engine. And where this goes up to 11 is that before each template engine, you can manipulate the input data; either to make the templates themselves easier to write and maintain, transform and merge data. 

- Input formats: currently JSON and YAML (multiple of each file supported)
- Template engine: njk
- Data transformation: jsonata

The details of the templates and transaction are store in "Template Packages".

Let's say there is a single input file...xxxx.json it will be loaded and the configuration of the template package loaded. 
This configuration will supply the name of the template file and a JSONATA transformation.  Before passing the data to the template negine, it will be processed by jsonata. It's that processed data that is passed to the template engine.

## Template Package

A Template is directory with

- one or more subdirectories (only 1 level deep please) that contain the template configurations. Each containing
    - a `_cfg.yaml` file describing the configuration
    - one or more template files reference by the `_cfg.yaml`

Output path is specified on the cmd line; the output tree will match the naming of the template configuration directories

## CLI


## Example Walkthrough





- plain file copy
