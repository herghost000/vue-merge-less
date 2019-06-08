/* eslint-disable */
const postcss = require('postcss')
const syntax = require('postcss-less')
const Tokenizer = require('css-selector-tokenizer')
const genericNames = require('generic-names')
const getLocalIdentName = require('./getLocalIdentName')
const uniqBy = require('lodash.uniqby')
const fileNameList = []
const path = require('path')

const walkRules = (less, callback) => {
  less.walkAtRules(atRule => {
    if (atRule.import) {
      atRule.remove()
      if (atRule.options !== '(less)') {
        fileNameList.push(atRule.filename)
      }
    }
  })
  less.walkRules(rule => {
    if (rule.parent.type !== 'atrule' || !/keyframes$/.test(rule.parent.name)) {
      if (rule.selector.indexOf('(') === -1) {
        callback(rule)
      }
    }
  })
  let lessDir = ''
  let lessFile = less.source.input.file.split(`src${path.sep}`)[1]
  if (lessFile) {
    lessDir = 'src'
  } else {
    lessFile = less.source.input.file.split(`.tmp${path.sep}`)[1]
    lessDir = '.tmp'
  }
  less.prepend(
    postcss.comment({
      text: `\n  Convert to from  ${lessDir}${path.sep}${lessFile}\n`
    })
  )
}

const trimNodes = nodes => {
  const firstIndex = nodes.findIndex(node => node.type !== 'spacing')
  const lastIndex = nodes
    .slice()
    .reverse()
    .findIndex(node => node.type !== 'spacing')
  return nodes.slice(firstIndex, nodes.length - lastIndex)
}

const isSpacing = node => node.type === 'spacing' || node.type === 'operator'

const isModifier = node =>
  node.type === 'pseudo-class' &&
  (node.name === 'local' || node.name === 'global')

function localizeNode(node, {
  mode,
  inside,
  getAlias
}) {
  const newNodes = node.nodes.reduce((acc, n, index, nodes) => {
    switch (n.type) {
      case 'spacing':
        if (isModifier(nodes[index + 1])) {
          return [
            ...acc,
            Object.assign({}, n, {
              value: ''
            })
          ]
        }
        return [...acc, n]

      case 'operator':
        if (isModifier(nodes[index + 1])) {
          return [
            ...acc,
            Object.assign({}, n, {
              after: ''
            })
          ]
        }
        return [...acc, n]

      case 'pseudo-class':
        if (isModifier(n)) {
          if (inside) {
            throw Error(
              `A :${n.name} is not allowed inside of a :${inside}(...)`
            )
          }
          if (index !== 0 && !isSpacing(nodes[index - 1])) {
            throw Error(`Missing whitespace before :${n.name}`)
          }
          if (index !== nodes.length - 1 && !isSpacing(nodes[index + 1])) {
            throw Error(`Missing whitespace after :${n.name}`)
          }
          // set mode
          mode = n.name
          return acc
        }
        return [...acc, n]

      case 'nested-pseudo-class':
        if (n.name === 'local' || n.name === 'global') {
          if (inside) {
            throw Error(
              `A :${n.name}(...) is not allowed inside of a :${inside}(...)`
            )
          }
          return [
            ...acc,
            ...localizeNode(n.nodes[0], {
              mode: n.name,
              inside: n.name,
              getAlias
            }).nodes
          ]
        } else {
          return [
            ...acc,
            Object.assign({}, n, {
              nodes: localizeNode(n.nodes[0], {
                mode,
                inside,
                getAlias
              }).nodes
            })
          ]
        }

        case 'id':
        case 'class':
          if (mode === 'local') {
            return [
              ...acc,
              Object.assign({}, n, {
                name: getAlias(n.name)
              })
            ]
          }
          return [...acc, n]

        default:
          return [...acc, n]
    }
  }, [])

  return Object.assign({}, node, {
    nodes: trimNodes(newNodes)
  })
}

const localizeSelectors = (selectors, mode, getAlias) => {
  const node = Tokenizer.parse(selectors)
  return Tokenizer.stringify(
    Object.assign({}, node, {
      nodes: node.nodes.map(n =>
        localizeNode(n, {
          mode,
          getAlias
        })
      )
    })
  )
}
const getValue = (messages, name) =>
  messages.find(msg => msg.type === 'icss-value' && msg.value === name)

const isRedeclared = (messages, name) =>
  messages.find(msg => msg.type === 'icss-scoped' && msg.name === name)

const LocalIdentNameplugin = postcss.plugin('LocalIdentNameplugin', options => {
  const generateScopedName =
    options.generateScopedName ||
    genericNames('[name]__[local]---[hash:base64:5]')
  const aliases = {}
  return (less, result) => {
    try {
      function excludePrimaryColor(less) {
        const rootNodes = less.nodes
        for (let root_index = 0; root_index < rootNodes.length; root_index++) {
          const rootNode = rootNodes[root_index]
          const nodes = rootNode.nodes
          if (rootNode.type === 'decl') {
            const propValue = rootNode.value
            if (propValue.indexOf('@') === -1) {
              rootNode.remove()
              root_index--
            }
          } else if (rootNode.type === 'rule') {
            for (let i = 0; i < nodes.length; i++) {
              const node = nodes[i]
              if (node.type === 'decl') {
                const propValue = node.value
                if (propValue.indexOf('@') === -1) {
                  node.remove()
                  i--
                }
              } else if (node.type === 'rule') {
                excludePrimaryColor(node)
                if (node.nodes.length === 0) {
                  node.remove()
                  i--
                }
              } else if (node.type === 'comment') {
                node.remove()
                i--
              } else if (rootNode.type === 'atrule' && rootNode.variable) {
                rootNode.remove()
                root_index--
              }
            }
          } else if (rootNode.type === 'comment') {
            rootNode.remove()
            root_index--
          } else if (rootNode.type === 'atrule' && rootNode.variable) {
            rootNode.remove()
            root_index--
          }
          if (nodes && nodes.length === 0) {
            rootNode.remove()
            root_index--
          }
        }
      }
      excludePrimaryColor(less)
    } catch (e) {
      console.log('excludePrimaryColor::', e)
    }
    walkRules(less, rule => {
      const getAlias = name => {
        if (aliases[name]) {
          return aliases[name]
        }
        // icss-value contract
        const valueMsg = getValue(result.messages, name)
        if (valueMsg) {
          aliases[valueMsg.name] = name
          return name
        }
        const alias = generateScopedName(name)
        aliases[name] = alias
        // icss-scoped contract
        if (isRedeclared(result.messages, name)) {
          result.warn(`'${name}' already declared`, {
            node: rule
          })
        }
        return alias
      }
      try {
        // 如果为 less mixin  variable  params 不需要处理
        const selector = localizeSelectors(
          rule.selector,
          options.mode === 'global' ? 'global' : 'local',
          getAlias
        )
        if (selector) {
          rule.selector = selector
        } else {
          //selector 为空，说明是个 :global{}
          // 从他的父节点中删除他，并且插入他的子节点
          // 这个写法是因为 css 与 less 的不同导致的，
          // 因为 css 下会是 :golbal .classname,但是 less 是 :golbal{.classname}
          // 直接 selector 删除会出现问题
          rule.replaceWith(rule.nodes)
          return
        }
      } catch (e) {
        throw rule.error(e.message)
      }
    })
  }
})

const AddlocalIdentName = (lessPath, lessText, identIndex) => {
  lessPath = lessPath
  return postcss([
      LocalIdentNameplugin({
        generateScopedName: className => {
          const suffix = identIndex === undefined ? '' : `_${identIndex}`;
          return getLocalIdentName(lessPath) + className + suffix;
        }
      })
    ])
    .process(lessText, {
      from: lessPath,
      syntax
    })
    .then(result => {
      result.messages = uniqBy(fileNameList)
      return result
    })
}

module.exports = AddlocalIdentName