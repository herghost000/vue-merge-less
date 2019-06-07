const fs = require('fs-extra');
const path = require('path');
const parse = require('vue-loader/lib/parser')
const postcss = require('postcss')
const syntax = require('postcss-less')
const atImport = require('postcss-easy-import');
const less = require("less");
const NpmImportPlugin = require('less-plugin-npm-import');

function render(text, paths) {
  return less.render.call(less, text, {
    paths: paths,
    javascriptEnabled: true,
    plugins: [new NpmImportPlugin({
      prefix: '~'
    })]
  });
}

const getVueModuleStyle = (relaPath) => {
  let styleContent = '';
  const {
    dir,
    base
  } = path.parse(relaPath);
  const vueBuffer = fs.readFileSync(relaPath, 'utf8');
  const vueString = vueBuffer.toString();
  const parts = parse(
    vueString,
    base,
    false,
    dir,
    false
  )
  let styleIndex = 0;
  for (let i in parts.styles) {
    const style = parts.styles[i];
    const {
      content = '',
        module: isModule,
        lang
    } = style;
    if (isModule && lang === 'less') {
      styleContent = content.trim();
      styleIndex = Number(i);
      break;
    }
  }
  if (!styleContent) {
    return Promise.resolve()
  }
  return new Promise((r) => {
    postcss()
      .use(atImport())
      .process(styleContent, {
        // `from` option is needed here
        from: relaPath,
        syntax
      })
      .then(function (result) {
        const {
          css = ''
        } = result;
        r([{
          ...result,
        }, styleIndex])
        // render(css, [
        //   path.join(process.cwd(), 'node_modules', 'iview/src/styles')
        // ]).then((renderRet) => {
        //   r([{
        //     ...result,
        //     ...renderRet
        //   }, styleIndex])
        // });
      })
  })
}

module.exports = getVueModuleStyle;
