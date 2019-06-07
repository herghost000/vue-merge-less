const path = require('path');

module.exports = (pathstr) => {
  const antdProPath = pathstr.match(/src(.*)/)[1].replace('.less', '').replace('.vue', '');
  const arr = antdProPath
    .split('/')
  return `tg-src${arr.join('-')}-`.replace(/--/g, '-');
};