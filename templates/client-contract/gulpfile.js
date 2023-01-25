const { src, dest, series } = require('gulp');
const nunjucks = require('gulp-nunjucks');
function copy() {
  return src('typescript/**/*')
    .pipe(nunjucks.precompile({name: 'Sindre'}))

    .pipe(dest('output/'));
}

series(copy)();