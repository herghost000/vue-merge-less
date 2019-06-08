const path = require("path");
const glob = require("glob");
const AddlocalIdentName = require("./AddlocalIdentName");
const deleteRelativePath = require("./removeRelativePath");
const uniqBy = require("lodash.uniqby");
const prettier = require("prettier");
const getVueModuleStyle = require('./getVueModuleStyle');
const fs = require('fs');

// read less file list
const loopAllLess = async (parents, identIndex) => {
  const promiseList = [];
  let importFileList = [];
  const vueDir = path.join(parents, "/**/**.vue");
  const vuePromise = [];
  glob
    .sync(vueDir, {
      ignore: "**/node_modules/**"
    })
    .forEach(relaPath => {
      // post css add localIdentNameplugin
      const fileContent = getVueModuleStyle(relaPath);
      vuePromise.push(fileContent)
    });
  const vueContentArray = await Promise.all(vuePromise);
  vueContentArray.forEach((item, index) => {
    if (!item) return void 0;
    let [result, _identIndex] = item;
    if (!identIndex) {
      _identIndex = undefined;
    }
    const {
      css,
      opts
    } = result;
    const {
      from
    } = opts;
    promiseList.push(
      AddlocalIdentName(from, css, _identIndex).then(
        result => {
          importFileList = importFileList.concat(result.messages);
          return result.content.toString();
        },
        err => err
      )
    );
  })

  const lessContentArray = await Promise.all(promiseList);
  importFileList = deleteRelativePath(
    uniqBy(importFileList).map(file => {
      return `@import ${file};`;
    })
  );
  const content = importFileList.concat(lessContentArray).join("\n \n");

  return Promise.resolve(
    prettier.format(content, {
      parser: "less"
    })
  );
};

module.exports = loopAllLess;