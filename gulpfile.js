var gulp = require('gulp');
var browserSync = require('browser-sync').create();

gulp.task('sync', function() {
 browserSync.init({
 proxy: "portfolio.dev",
 files: "*.css,*.php,css/*css"
});
});