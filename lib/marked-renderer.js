var renderer = require('marked').Renderer,
    highlight = require('./hexo-highlight')

// Extend the Marked default renderer
module.exports = function(indexAdd, options) {
    renderer.call(this, options)

    this.indexAdd = indexAdd
}

module.exports.prototype = new renderer()
module.exports.prototype.constructor = module.exports

// Most of the index information comes from h3 tags
// Wrapping also allows h2 and h3 tags to be added to the TOC
module.exports.prototype.heading = function(text, level, raw) {
    var _super = renderer.prototype.heading

    // h1 is just a normal header, so skip it
    if (level === 1) {
        return _super.call(this, text, level, raw)
    }

    var frontMatter = this.options.frontMatter || {},
        docType     = frontMatter.type || '',
        docTitle    = frontMatter.title || ''

    var path = this.options.path || docType + '/' + docTitle + '.html'

    var type    = 'Section',
        trimmed = text

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
            case 'Instantiation Options':
                type = 'Option'
                break
            case 'Global Methods':
            case 'Instance Methods':
                type = 'Method'
                break
        }

        // Remove arguments from index
        trimmed = trimmed.replace(/\(.*/, '')
    }

    // Dash Table of Contents Anchor
    var tocAnchor = '//apple_ref/' + type + '/' + encodeURIComponent(trimmed),
        anchorTag = '<a name="' + tocAnchor + '" class="dashAnchor">' + text + '</a>'

    // Only add API entries to the index, guides and examples are available as whole pages
    if (docType === 'api' && level === 3) {
        this.indexAdd.run(trimmed, type, path + '#' + tocAnchor)
    }

    return _super.call(this, anchorTag, level, raw)
}
// Ensure code blocks always use Hexo-esque highlighting
module.exports.prototype.code = function(code, lang) {
    /**
     * unescape function - from Marked's parser
     * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
     * https://github.com/chjj/marked
     */
    code = code.replace(/&([#\w]+);/g, function(_, n) {
        n = n.toLowerCase()
        if (n === 'colon') return ':'
        if (n.charAt(0) === '#') {
          return n.charAt(1) === 'x'
            ? String.fromCharCode(parseInt(n.substring(2), 16))
            : String.fromCharCode(+n.substring(1))
        }
        return ''
    })
    return highlight(code, {lang: lang })
}

// Wraps functions to make first argument link relative instead of absolute
function relativePathWrapper(original) {
    return function() {
        var args = arguments

        // Assumes the first argument is a path string
        if (args[0][0] === '/')
            args[0] = ".." + args[0]
        return original.apply(this, args)
    }
}

module.exports.prototype.link = relativePathWrapper(renderer.prototype.link)
module.exports.prototype.image = relativePathWrapper(renderer.prototype.image)

// Make local iframes sources relative instead of absolute
module.exports.prototype.html = function(html) {
    if (html.indexOf('iframe') !== -1)
        return html.replace(/(src=['"])\//, "$1../")

    return html
}

// Attempt to fix image sources, which are ironically not processed by image or html
module.exports.prototype.paragraph = function(text) {
    return renderer.prototype.paragraph.call(this, text.replace(/(src=['"])\//, "$1../"))
}
