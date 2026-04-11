const exec = require('child_process').exec
const temp = require('temp')
const path = require('path')
const utils = require('../utils')
const fs = require('fs')
const os = require('os')

const {
  readAndUnlinkP,
  defaultAll
} = utils

function copyToTemp () {
  const tmpBat = path.join(os.tmpdir(), 'screenCapture', 'screenCapture_1.3.2.bat')
  const tmpManifest = path.join(os.tmpdir(), 'screenCapture', 'app.manifest')
  const includeBat = path.join(__dirname, 'screenCapture_1.3.2.bat').replace('app.asar', 'app.asar.unpacked')
  const includeManifest = path.join(__dirname, 'app.manifest').replace('app.asar', 'app.asar.unpacked')
  if (!fs.existsSync(tmpBat)) {
    const tmpDir = path.join(os.tmpdir(), 'screenCapture')
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir)
    }
    const sourceData = {
      bat: fs.readFileSync(includeBat),
      manifest: fs.readFileSync(includeManifest)
    }
    fs.writeFileSync(tmpBat, sourceData.bat)
    fs.writeFileSync(tmpManifest, sourceData.manifest)
  }
  return tmpBat
}

function windowsSnapshot (options = {}) {
  return new Promise((resolve, reject) => {
    // Validate format
    const allowedFormats = ['jpg', 'jpeg', 'png', 'bmp']
    const format = (options.format || 'jpg').toLowerCase()
    if (!allowedFormats.includes(format)) {
      return reject(new Error('Invalid format'))
    }

    // Sanitize filename (allow spaces)
    let imgPath
    let requestedPath = null
    if (options.filename) {
      // Always use a temp path for screenshot output to avoid issues
      imgPath = temp.path({ suffix: `.${format}` })
      // Prepare requested path for final output
      const originalDir = path.dirname(options.filename)
      const originalBase = path.basename(options.filename)
      const safeBase = originalBase.replace(/[^a-zA-Z0-9._\- ]/g, '')
      requestedPath = path.isAbsolute(options.filename)
        ? path.join(originalDir, safeBase)
        : path.join(process.cwd(), originalDir, safeBase)
      requestedPath = path.normalize(requestedPath)
      // Ensure output directory exists
      const outDir = path.dirname(requestedPath)
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true })
      }
    } else {
      imgPath = temp.path({ suffix: `.${format}` })
    }
    // ...existing code...

    const displayName = options.screen ? String(options.screen) : ''

    const tmpBat = copyToTemp()
    const batArgs = [imgPath]
    if (displayName) {
      batArgs.push('/d', displayName)
    }
    const args = ['/c', tmpBat, ...batArgs]
    // ...existing code...
    require('child_process').execFile('cmd.exe', args, {
      cwd: path.join(os.tmpdir(), 'screenCapture'),
      windowsHide: true
    }, (err, stdout, stderr) => {
      // ...existing code...
      if (err) {
        return reject(err)
      }
      if (options.filename) {
        // Copy temp file to requested path
        fs.copyFile(imgPath, requestedPath, (err) => {
          if (err) return reject(err)
          resolve(requestedPath)
        })
      } else {
        readAndUnlinkP(imgPath)
          .then(resolve)
          .catch(reject)
      }
    })
  })
}

const EXAMPLE_DISPLAYS_OUTPUT = '\r\nC:\\Users\\devetry\\screenshot-desktop\\lib\\win32>//  2>nul  || \r\n\\.\\DISPLAY1;0;1920;1080;0\r\n\\.\\DISPLAY2;0;3840;1080;1920\r\n'

function parseDisplaysOutput (output) {
  const displaysStartPattern = /2>nul {2}\|\| /
  const {
    0: match,
    index
  } = displaysStartPattern.exec(output)
  return output.slice(index + match.length)
    .split('\n')
    .map(s => s.replace(/[\n\r]/g, ''))
    .map(s => s.match(/(.*?);(.?\d+);(.?\d+);(.?\d+);(.?\d+);(.?\d*[\.,]?\d+)/)) // eslint-disable-line
    .filter(s => s)
    .map(m => ({
      id: m[1],
      name: m[1],
      top: +m[2],
      right: +m[3],
      bottom: +m[4],
      left: +m[5],
      dpiScale: +m[6].replace(',', '.')
    }))
    .map(d => Object.assign(d, {
      height: d.bottom - d.top,
      width: d.right - d.left
    }))
}

function listDisplays () {
  return new Promise((resolve, reject) => {
    const tmpBat = copyToTemp()
    exec(
      '"' + tmpBat + '" /list', {
        cwd: path.join(os.tmpdir(), 'screenCapture')
      },
      (err, stdout) => {
        if (err) {
          return reject(err)
        }
        resolve(parseDisplaysOutput(stdout))
      })
  })
}

windowsSnapshot.listDisplays = listDisplays
windowsSnapshot.availableDisplays = listDisplays
windowsSnapshot.parseDisplaysOutput = parseDisplaysOutput
windowsSnapshot.EXAMPLE_DISPLAYS_OUTPUT = EXAMPLE_DISPLAYS_OUTPUT
windowsSnapshot.all = () => defaultAll(windowsSnapshot)

module.exports = windowsSnapshot
