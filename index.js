const fs = require('fs')
const path = require('path')
const loopAllLess = require('./loopAllLess')

class VueMergeLessPlugin {
  constructor(options) {
    const defaulOptions = {
      stylesDir: path.join(__dirname, './src/'),
      outFile: path.join(__dirname, './.tmp/tg-lottery-pro.less'),
    }
    this.options = Object.assign(defaulOptions, options)
    this.generated = false
  }

  test() {
    const {
      options
    } = this
    const {
      outFile
    } = options
    if (fs.existsSync(outFile)) {
      fs.unlinkSync(outFile)
    } else if (!fs.existsSync(path.dirname(outFile))) {
      fs.mkdirSync(path.dirname(outFile))
    }
    loopAllLess(options.stylesDir).then(content => {
      fs.writeFileSync(outFile, content.replace(/:global\((.*?)\)/gim, '$1'))
    })
  }

  apply(compiler) {
    const {
      options
    } = this
    compiler.plugin('emit', function (compilation, callback) {
      const {
        outFile
      } = options
      if (fs.existsSync(outFile)) {
        fs.unlinkSync(outFile)
      } else if (!fs.existsSync(path.dirname(outFile))) {
        fs.mkdirSync(path.dirname(outFile))
      }
      loopAllLess(options.stylesDir, options.excludeIdent).then(
        content => {
          fs.writeFileSync(
            outFile,
            content.replace(/:global\((.*?)\)/gim, '$1')
          )
          callback()
        },
        () => {
          callback()
        }
      )
    })
  }
}
module.exports = VueMergeLessPlugin