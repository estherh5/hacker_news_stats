var gulp = require('gulp');
var sass = require('gulp-sass');
var minifyCss = require('gulp-minify-css');
var rename = require('gulp-rename');
var browserify = require('browserify');
var babelify = require('babelify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var inject = require('gulp-inject');
var replace = require('gulp-replace');


// Gulp tasks for compiling CSS, JS, assets, HTML
gulp.task('css', compileSass);

gulp.task('js', compileJs);

gulp.task('assets', compileAssets);

gulp.task('html', compileHtml);

gulp.task('build', gulp.series(
  gulp.parallel('css', 'js', 'assets'),
  'html')
);

gulp.task('watch', updateBuild);


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
  var browserified = browserify({
    entries: './src/main.js',
    debug: true,
    transform: [babelify.configure({
          presets: ['env']
        }), 'uglifyify']
  });

  return browserified.bundle()
    .pipe(source('./src/*.js'))
    .pipe(buffer())
    .pipe(rename('all.min.js'))
    .pipe(gulp.dest('./dist'));
}


// Add assets and images to dist folder
function compileAssets() {
  gulp.src('./src/favicon.ico')
    .pipe(gulp.dest('./dist'));

  gulp.src('./src/assets/*')
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
    .pipe(replace(
      '<!-- replace:copyright -->',
      '&copy; Copyright 2017-' + new Date().getFullYear() +
      ' <a href="https://crystalprism.io">Crystal Prism</a>'
    ))
    .pipe(inject(sources, {relative: true}));
}


// Update build whenever source file is changed
function updateBuild() {
  return gulp.watch('./src/*', gulp.series('build'));
}
