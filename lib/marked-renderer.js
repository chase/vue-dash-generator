var renderer = require('marked').Renderer,
    util = require('util')

module.exports = function(indexAdd,options) {
    // Extend the Marked default renderer
    renderer.call(this, options)

    this.indexAdd = indexAdd
}

util.inherits(module.exports, renderer)

// Most of the index information comes from h3 tags
// Wrapping also allows h2 and h3 tags to be added to the TOC
module.exports.prototype.heading = function(text, level, raw) {
    var _super = renderer.prototype.heading

    // h1 is just a normal header, so skip it
    if (level === 1) return _super.apply(this, [text, level, raw])

    var frontMatter = this.options.frontMatter || {},
        docType = frontMatter.type || '',
        docTitle = frontMatter.title || ''

    var path = this.options.path || docType + '/' + docTitle + '.html'

    var type = 'Section'

    if (docType === 'api' && level === 3) {
        switch (docTitle) {
            case 'Filters':
                type = 'Filter'
                break
            case 'Directives':
                type = 'Directive'
                break
            case 'Instance Properties':
                type = 'Property'
                break
            case 'Global Methods':
                type = 'Global'
                break
            case 'Instantiation Options':
                type = 'Option'
                break
            case 'Instance Methods':
                type = 'Method'
                break
        }
    }

    // Dash Table of Contents Anchor
    var tocAnchor = '//apple_ref/' + type + '/' + encodeURIComponent(text),
        anchorTag = '<a name="' + tocAnchor + '" class="dashAnchor">' + text + '</a>'

    // Only add API entries to the index, guides and examples are available as whole pages
    if (docType === 'api' && level === 3) {
        this.indexAdd.run(text, type, path + '#' + tocAnchor)
    }

    return _super.apply(this, [anchorTag, level, raw])
}

// Wrap link handling to make links relative instead of absolute
module.exports.prototype.link = function(href, title, text) {
    if (href[0] === '/')
        href = ".." + href
    return renderer.prototype.link.apply(this, [href, title, text])
}
