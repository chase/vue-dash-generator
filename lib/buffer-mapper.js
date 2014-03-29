var through = require('through2')

module.exports = function(callback) {
  return through.obj(function (file, _, next) {

    if (typeof file !== 'object') return
      if (file.isNull()) {
        this.push(file)
        return next()
      }

      var callbackResult = callback(file)

      file = file.clone()
      file.contents = callbackResult
      this.push(file)

      next()
  })
}
