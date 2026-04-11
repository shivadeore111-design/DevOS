const exec = require('child_process').exec
const temp = require('temp')
const fs = require('fs')
const utils = require('../utils')
const path = require('path')

const { unlinkP, readAndUnlinkP } = utils

function darwinSnapshot (options = {}) {
  const performScreenCapture = displays => new Promise((resolve, reject) => {
    // validate displayId
    const totalDisplays = displays.length
    if (totalDisplays === 0) {
      return reject(new Error('No displays detected try dropping screen option'))
    }
    const maxDisplayId = totalDisplays - 1
    const displayId = options.screen || 0
    if (!Number.isInteger(displayId) || displayId < 0 || displayId > maxDisplayId) {
      const validChoiceMsg = (maxDisplayId === 0) ? '(valid choice is 0 or drop screen option altogether)' : `(valid choice is an integer between 0 and ${maxDisplayId})`
      return reject(new Error(`Invalid choice of displayId: ${displayId} ${validChoiceMsg}`))
    }

    // Validate format
    const allowedFormats = ['jpg', 'jpeg', 'png', 'tiff', 'bmp', 'gif', 'pdf']
    const format = (options.format || 'jpg').toLowerCase()
    if (!allowedFormats.includes(format)) {
      return reject(new Error('Invalid format'))
    }

    // Sanitize filename
    let filename, suffix
    if (options.filename) {
      // Only allow safe characters in filename
      const safeFilename = options.filename.replace(/[^a-zA-Z0-9._\-/]/g, '')
      const ix = safeFilename.lastIndexOf('.')
      suffix = ix >= 0 ? safeFilename.slice(ix) : `.${format}`
      filename = safeFilename
    } else {
      suffix = `.${format}`
    }

    const tmpPaths = Array(displayId + 1)
      .fill(null)
      .map(() => temp.path({ suffix }))

    let pathsToUse = []
    if (options.filename) {
      tmpPaths[displayId] = filename
    }
    pathsToUse = tmpPaths.slice(0, displayId + 1)

    // Use execFile for safe argument passing
    const args = ['-x', '-t', format, ...pathsToUse]
    require('child_process').execFile('screencapture', args, function (err, stdOut) {
      if (err) {
        return reject(err)
      } else if (options.filename) {
        resolve(path.resolve(filename))
      } else {
        fs.readFile(tmpPaths[displayId], function (err, img) {
          if (err) {
            return reject(err)
          }
          Promise.all(pathsToUse.map(unlinkP))
            .then(() => resolve(img))
            .catch((err) => reject(err))
        })
      }
    })
  })

  return listDisplays().then((displays) => { return performScreenCapture(displays) })
}

const EXAMPLE_DISPLAYS_OUTPUT = `
Graphics/Displays:

    Intel Iris:

      Chipset Model: Intel Iris
      Type: GPU
      Bus: Built-In
      VRAM (Dynamic, Max): 1536 MB
      Vendor: Intel (0x8086)
      Device ID: 0x0a2e
      Revision ID: 0x0009
      Displays:
        Color LCD:
          Display Type: Retina LCD
          Resolution: 2560 x 1600 Retina
          Retina: Yes
          Pixel Depth: 32-Bit Color (ARGB8888)
          Main Display: Yes
          Mirror: Off
          Online: Yes
          Built-In: Yes
        HP 22cwa:
          Resolution: 1920 x 1080 @ 60Hz (1080p)
          Pixel Depth: 32-Bit Color (ARGB8888)
          Display Serial Number: 6CM7201231
          Mirror: Off
          Online: Yes
          Rotation: Supported
          Television: Yes
`

function extractEntries (output) {
  const entries = []

  const entryPattern = /(\s*)(.*?):(.*)\n/g
  let match
  while ((match = entryPattern.exec(output)) !== null) {
    entries.push({
      indent: match[1].length,
      key: match[2].trim(),
      value: match[3].trim()
    })
  }

  return entries
}

function makeSubtree (currIndent, subtree, entries) {
  let entry
  while ((entry = entries.shift())) {
    if (entry.value === '') {
      if (currIndent < entry.indent) {
        while (entry.key in subtree) {
          entry.key += '_1'
        }
        subtree[entry.key] = {}
        makeSubtree(entry.indent, subtree[entry.key], entries)
      } else {
        entries.unshift(entry)
        return
      }
    } else {
      while (entry.key in subtree) {
        entry.key += '_1'
      }
      subtree[entry.key] = entry.value
    }
  }
}

function movePrimaryToHead (displays) {
  const primary = displays.filter(e => e.primary)
  const notPrimary = displays.filter(e => !e.primary)
  return [...primary, ...notPrimary]
}

function addId (displays) {
  let id = 0
  return displays
    .map(display => {
      return Object.assign({}, display, { id: id++ })
    })
}

function parseDisplaysOutput (output) {
  const tree = {}
  makeSubtree(-1, tree, extractEntries(output))

  if (!tree['Graphics/Displays']) {
    return []
  }

  const firstGpuKeys = Object.keys(tree['Graphics/Displays'])
  if (!firstGpuKeys || firstGpuKeys.length <= 0) {
    return []
  }

  let displayinfos = []

  firstGpuKeys.forEach(gpukey => {
    const gpu = tree['Graphics/Displays'][gpukey]
    if (gpu.Displays) {
      const temp = Object.entries(gpu.Displays)
        .map(([name, props]) => {
          const primary = props['Main Display'] === 'Yes'
          return { name, primary }
        })
      displayinfos = displayinfos.concat(temp)
    }
  })

  return addId(movePrimaryToHead(displayinfos))
}

function listDisplays () {
  return new Promise((resolve, reject) => {
    exec(
      'system_profiler SPDisplaysDataType',
      (err, stdout) => {
        if (err) {
          return reject(err)
        }
        resolve(parseDisplaysOutput(stdout))
      })
  })
}

function all () {
  return new Promise((resolve, reject) => {
    listDisplays()
      .then((displays) => {
        const tmpPaths = displays.map(() => temp.path({ suffix: '.jpg' }))
        exec('screencapture -x -t jpg ' + tmpPaths.join(' '), function (err, stdOut) {
          if (err) {
            return reject(err)
          } else {
            Promise.all(tmpPaths.map(readAndUnlinkP))
              .then(resolve)
              .catch(reject)
          }
        })
      })
  })
}

darwinSnapshot.listDisplays = listDisplays
darwinSnapshot.all = all
darwinSnapshot.parseDisplaysOutput = parseDisplaysOutput
darwinSnapshot.EXAMPLE_DISPLAYS_OUTPUT = EXAMPLE_DISPLAYS_OUTPUT

module.exports = darwinSnapshot
