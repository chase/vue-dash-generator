var buffer = require('vinyl-buffer'),
    path   = require('path'),
    map    = require('./lib/buffer-mapper'),
    yaml   = require('yamljs'),
    rename = require('gulp-rename'),
    stylus = require('gulp-stylus'),
    footer = require('gulp-footer'),
    ect    = require('ect'),
    sqlite = require('sqlite3'),
    gulp   = require('gulp')

var vuejsWebsite = 'vendor/vuejs-website',
    vuejsSource  = vuejsWebsite + '/source',
    vuejsTheme   = vuejsWebsite + '/themes/vue/source',
    resources    = 'build/vuejs.docset/Contents/Resources',
    documents    = resources + '/Documents',
    sources      = ['api/*.md', 'guide/*.md', 'examples/*.md']

var templateEngine = ect({ root: __dirname + '/views' , ext: '.ect'})

var docSet,
    indexAdd

var marked   = require('marked'),
    renderer = require('./lib/marked-renderer')

// Asset Management
// =============
gulp.task('copySkeleton', function(){
    var skeleton = 'assets/vuejs.docset-skeleton'
    return gulp.src(skeleton + '/**/*', { base: skeleton })
        .pipe(gulp.dest('build/vuejs.docset'))
})

gulp.task('copyLicense', ['copySkeleton'], function() {
    return gulp.src('LICENSE')
        .pipe(gulp.dest(resources))
})

gulp.task('buildCSS', ['copySkeleton'], function(){
    return gulp.src('css/page.styl', { cwd: vuejsTheme })
        .pipe(stylus({ use: ['nib'] }))
        .pipe(footer('a.dashAnchor { color: #2c3e50; }'))
        .pipe(gulp.dest(documents + '/css'))
})

gulp.task('copyJS', ['copySkeleton'], function(){
    return gulp.src(['js/vue.min.js'], { cwd: vuejsTheme })
        .pipe(gulp.dest(documents + '/js'))
})

gulp.task('copyImages', function(){
    return gulp.src(['images/*'], { cwd: vuejsTheme })
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

// Generates docs while building the index using a customized Marked renderer
function generateDoc(file) {
    var contents = file.contents.toString().split('\n---\n')
    var frontMatter = yaml.parse(contents[0])
    contents = contents.splice(1).join('\n---\n')
    relPath = path.relative(vuejsSource, file.path)

    var type = 'Section'

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
        case 'examples':
            type = 'Sample'
            break
    }

    indexAdd.run(frontMatter.title, type, relPath)

    // Set the required front matter and file path for the index
    marked.defaults.frontMatter = frontMatter
    marked.defaults.path = relPath

    // Render the Markdown
    var rendered = marked(contents)

    // Then wrap it in the template
    return new Buffer(templateEngine.render('template.ect', {
        content: rendered,
        page: frontMatter
    }))
}

// Document Management
// =============
gulp.task('generateDocs', ['prepareDB'], function(){
    return gulp.src(sources, { cwd: vuejsSource, cwdbase: true })
        .pipe(rename({ extname: '.html' }))
        .pipe(buffer())
        .pipe(map(generateDoc))
        .pipe(gulp.dest(documents))
})

gulp.task('default', ['buildAssets', 'prepareDB', 'generateDocs'])
