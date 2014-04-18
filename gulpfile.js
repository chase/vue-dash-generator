var buffer   = require('vinyl-buffer'),
    path     = require('path'),
    map      = require('./lib/buffer-mapper'),
    yaml     = require('yamljs'),
    rename   = require('gulp-rename'),
    stylus   = require('gulp-stylus'),
    footer   = require('gulp-footer'),
    filter   = require('gulp-filter'),
    clean    = require('gulp-clean'),
    tar      = require('gulp-tar'),
    gzip     = require('gulp-gzip'),
    ect      = require('ect'),
    sqlite   = require('sqlite3'),
    gulp     = require('gulp'),
    marked   = require('marked'),
    renderer = require('./lib/marked-renderer')

var vuejsWebsite = 'vendor/vuejs-website',
    vuejsSource  = vuejsWebsite + '/source',
    vuejsTheme   = vuejsWebsite + '/themes/vue/source',
    resources    = 'build/vuejs.docset/Contents/Resources',
    documents    = resources + '/Documents',
    sources      = ['api/*.md', 'guide/*.md', 'examples/*.md']

var templateEngine = ect({ root: __dirname + '/views' , ext: '.ect'})

// Late definition in prepareDB
var docSet,
    indexAdd

// Build Cleanup
// =============
gulp.task('cleanBuild', function(){
    return gulp.src('build/vuejs.docset', { read: false })
        .pipe(clean())
})


// Asset Management
// ================
gulp.task('copySkeleton', ['cleanBuild'], function(){
    var skeleton = 'assets/vuejs.docset-skeleton'

    return gulp.src(skeleton + '/**/*', { base: skeleton })
        .pipe(gulp.dest('build/vuejs.docset'))
})

gulp.task('copyLicense', ['cleanBuild'], function(){
    return gulp.src('LICENSE')
        .pipe(gulp.dest(resources))
})

gulp.task('buildCSS', ['cleanBuild'], function(){
    return gulp.src('css/page.styl', { cwd: vuejsTheme })
        .pipe(stylus({ use: ['nib'] }))
        .pipe(footer('a.dashAnchor { color: #2c3e50; }'))
        .pipe(gulp.dest(documents + '/css'))
})

gulp.task('copyJS', ['cleanBuild'], function(){
    return gulp.src('js/vue.min.js', { cwd: vuejsTheme })
        .pipe(gulp.dest(documents + '/js'))
})

gulp.task('copyImages', ['cleanBuild'], function(){
    return gulp.src('images/*', { cwd: vuejsTheme })
        .pipe(gulp.dest(documents + '/images'))
})

gulp.task('buildAssets', ['copySkeleton', 'buildCSS', 'copyJS', 'copyImages'])


// DB Management
// =============
gulp.task('prepareDB', ['copySkeleton'], function(){
    docSet = new sqlite.Database(resources + '/docSet.dsidx')
    docSet.serialize(function() {
        docSet.run("CREATE TABLE IF NOT EXISTS searchIndex(id INTEGER PRIMARY KEY, name TEXT, type TEXT, path TEXT)")
        docSet.run("CREATE UNIQUE INDEX IF NOT EXISTS anchor ON searchIndex (name, type, path)")

        // This lets the Renderer access indexAdd
        indexAdd = docSet.prepare("INSERT OR IGNORE INTO searchIndex(name, type, path) VALUES (?, ?, ?)")
        marked.setOptions({
            renderer: new renderer(indexAdd),
            breaks: true,
            smartypants: true
        })
    })
})

// Document Management
// ===================
// Generates docs while building the index using a customized Marked renderer
function generateDoc(file) {
    var contents    = file.contents.toString().split('\n---\n'),
        frontMatter = yaml.parse(contents[0]),
        relPath     = path.relative(vuejsSource, file.path),
        type        = 'Section'

    // Contents without front matter
    contents = contents.splice(1).join('\n---\n')

    switch (frontMatter.type) {
        case 'api':
            switch (frontMatter.title) {
                case 'Instance Properties':
                    type = 'Instance'
                break
                case 'Global Methods':
                    type = 'Class'
                break
                case 'Instantiation Options':
                    type = 'Constructor'
                break
                case 'Instance Methods':
                    type = 'Instance'
                break
            }
            break
        case 'guide':
            type = 'Guide'
            break
    }

    // Replace front-matter variables in files
    Object.getOwnPropertyNames(frontMatter).forEach(function(property){
        contents = contents.replace('{{'+property+'}}', frontMatter[property])
    })

    indexAdd.run(frontMatter.title, type, relPath)

    // Set the required front matter and file path for the index
    marked.defaults.frontMatter = frontMatter
    marked.defaults.path = relPath

    // Render the Markdown and wrap it in the template
    return new Buffer(templateEngine.render('template.ect', {
        content: marked(contents),
        page: frontMatter
    }))
}

// None of the examples work, because they rely on JSFiddle
// Filter examples until there is a solution for offline archiving of JSFiddles
var noExamples = filter('!examples/*')

gulp.task('generateDocs', ['prepareDB'], function(){
    return gulp.src(sources, { cwd: vuejsSource, cwdbase: true })
        .pipe(noExamples)
        .pipe(rename({ extname: '.html' }))
        .pipe(buffer())
        .pipe(map(generateDoc))
        .pipe(gulp.dest(documents))
})


// Default Task
// ============
gulp.task('default', ['cleanBuild', 'buildAssets', 'prepareDB', 'generateDocs'])


// Publishing
// ==========
var contribution = 'build/Dash-User-Contributions/docsets/vuejs'

gulp.task('copyContributionSkeleton', function(){
    var skeleton = 'assets/vuejs-skeleton'

    return gulp.src(skeleton + '/**/*', { base: skeleton })
        .pipe(gulp.dest(contribution))
})

// Prevents adding any .DS_Store file metadata files
var noDSStore = filter('!**/.DS_Store')

gulp.task('tarballDocset', function(){
    return gulp.src('build/vuejs.docset/**/*', { base: 'build' } )
        .pipe(noDSStore)
        .pipe(tar('VueJS.tar'))
        .pipe(gzip({ append: false }))
        .pipe(rename({ extname: '.tgz' }))
        .pipe(gulp.dest(contribution))
})

gulp.task('publish', ['copyContributionSkeleton', 'tarballDocset'])
