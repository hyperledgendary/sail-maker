import { src, dest, series } from 'gulp';
import through2 from 'through2';

const transform = function (this: any, file: any, _: any, cb: any) {
    if (file.extname === '.njk') {
        // let's see if we can double the file and update the filename
        console.log(`Duplicating`);
        const newFile = file.clone();
        newFile.stem = `new ${file.stem}`;

        this.push(file);
        this.push(newFile);
        cb();
    } else {
        console.log(`staight copy of ${file.path}`);
        cb(null, file);
    }
};

function copy() {
    return src('templates/client-contract/typescript/**/*').pipe(through2.obj(transform)).pipe(dest('output/'));
}

function callback() {
    console.log(callback);
}

const taskFn = series(copy);
taskFn(callback);
