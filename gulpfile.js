var gulp = require('gulp');
var sass = require('gulp-sass');
var minifyCss = require('gulp-minify-css');
var rename = require('gulp-rename');
var concat = require('gulp-concat');
var babel = require('gulp-babel');
var uglify = require('gulp-uglify');
var jsmin = require('gulp-jsmin');
var inject = require('gulp-inject');


// Gulp tasks for compiling CSS, JS, images, HTML
gulp.task('css', compileSass);

gulp.task('js', gulp.series(
  compileJs,
  concatJs
));

gulp.task('images', compileImages);

gulp.task('html', compileHtml);

gulp.task('build', gulp.series(
  gulp.parallel('css', 'js', 'images'),
  'html')
);


// Compile Sass script by preprocessing it to CSS and minifying it
function compileSass() {
  return gulp.src('./src/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(minifyCss())
    .pipe(rename({suffix: '.min'}))
    .pipe(gulp.dest('./dist'));
}


// Compile main project script by transpiling, uglifying, and minifying it
function compileJs() {
  return gulp.src('./src/*.js')
    .pipe(babel({presets: ['env']}))
    .pipe(uglify())
    .pipe(jsmin())
    .pipe(rename('all.min.js'))
    .pipe(gulp.dest('./dist'));
}


// Concatenate required package scripts and main project script
function concatJs() {
  return gulp.src(['./node_modules/fetch-polyfill/fetch.js',
    './node_modules/highcharts/highcharts.js',
    './node_modules/highcharts/highcharts-more.js',
    './node_modules/highcharts/modules/wordcloud.js', './dist/all.min.js'])
    .pipe(concat('all.js'))
    .pipe(rename({suffix: '.min'}))
    .pipe(gulp.dest('./dist'));
}


// Add images to dist folder
function compileImages() {
  gulp.src('./src/favicon.ico')
    .pipe(gulp.dest('./dist'));

  return gulp.src('./src/images/*')
    .pipe(gulp.dest('./dist/images'));
}


// Compile HTML by injecting JS scripts and CSS stylesheets
function compileHtml() {
  var target = gulp.src('./src/index.html');
  var sources = gulp.src(['./dist/*.js', './dist/*.css'], {read: false});

  target.pipe(gulp.dest('./dist'));

  return target
    .pipe(inject(sources, {relative: true}));
}
