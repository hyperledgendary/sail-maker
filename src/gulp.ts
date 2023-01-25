import { src, dest, series } from 'gulp';
import through2 from 'through2';

function sailFilter(file: any, _: any, cb: any) {
    if (file.extname === 'njk'){
        // let's see if we can double the file and update the filename
        console.log(`Duplicating`)
        
    } else{
        console.log(`staight copy of ${file.name}`)
        cb(null, file);
    }
        
}

function copy() {
    return src('templates/client-contract/typescript/**/*')
        .pipe(
            through2.obj(sailFilter),
        )
        .pipe(dest('output/'));
}

function callback() {
    console.log(callback);
}

const taskFn = series(copy);
taskFn(callback);

