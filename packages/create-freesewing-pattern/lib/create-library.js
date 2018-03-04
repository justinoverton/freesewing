'use strict'

const consolidate = require('consolidate')
const execa = require('execa')
const fs = require('fs')
const globby = require('globby')
const mkdirp = require('make-dir')
const ora = require('ora')
const path = require('path')
const pEachSeries = require('p-each-series')

const pkg = require('../package')

module.exports = async (info) => {
  const {
    dest,
    manager
  } = info

  await mkdirp(dest)

  const source = path.join(__dirname, '../template')
  const files = await globby(source, {
    dot: true
  })

  {
    const promise = pEachSeries(files, async (file) => {
      return module.exports.copyTemplateFile({
        file,
        source,
        dest,
        info
      })
    })
    ora.promise(promise, `Copying template to ${dest}`)
    await promise
  }

  {
    const promise = module.exports.initPackageManager({ dest, info })
    ora.promise(promise, `Running ${manager} install and ${manager} link`)
    await promise
  }

  {
    const promise = module.exports.initGitRepo({ dest })
    ora.promise(promise, 'Initializing git repo')
    await promise
  }
}

module.exports.copyTemplateFile = async (opts) => {
  const {
    file,
    source,
    dest,
    info
  } = opts

  const fileRelativePath = path.relative(source, file)
  const destFilePath = path.join(dest, fileRelativePath)
  const destFileDir = path.parse(destFilePath).dir

  const content = await consolidate.handlebars(file, info)

  await mkdirp(destFileDir)
  fs.writeFileSync(destFilePath, content, 'utf8')

  return fileRelativePath
}

module.exports.initPackageManager = async (opts) => {
  const {
    dest,
    info
  } = opts

  const example = path.join(dest, 'example')

  const commands = [
    {
      cmd: `${info.manager}`,
      cwd: dest
    },
    {
      cmd: `${info.manager} link`,
      cwd: dest
    }
  ].concat(info.manager === 'yarn' ? [
    {
      cmd: `${info.manager}`,
      cwd: example
    }
  ] : [ ]
  )

  return pEachSeries(commands, async ({ cmd, cwd }) => {
    return execa.shell(cmd, { cwd })
  })
}

module.exports.initGitRepo = async (opts) => {
  const {
    dest
  } = opts

  const cmd = `git init && git add . && git commit -m "init ${pkg.name}@${pkg.version}"`
  return execa.shell(cmd, { cwd: dest })
}