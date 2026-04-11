const exec = require('child_process').exec
const path = require('path')
const defaultAll = require('../utils').defaultAll

const EXAMPLE_DISPLAYS_OUTPUT = `Screen 0: minimum 320 x 200, current 5760 x 1080, maximum 8192 x 8192
eDP-1 connected (normal left inverted right x axis y axis)
  2560x1440     60.00 +
  1920x1440     60.00
  1856x1392     60.01
  1792x1344     60.01
  1920x1200     59.95
  1920x1080     59.93
  1600x1200     60.00
  1680x1050     59.95    59.88
  1600x1024     60.17
  1400x1050     59.98
  1280x1024     60.02
  1440x900      59.89
  1280x960      60.00
  1360x768      59.80    59.96
  1152x864      60.00
  1024x768      60.04    60.00
  960x720       60.00
  928x696       60.05
  896x672       60.01
  960x600       60.00
  960x540       59.99
  800x600       60.00    60.32    56.25
  840x525       60.01    59.88
  800x512       60.17
  700x525       59.98
  640x512       60.02
  720x450       59.89
  640x480       60.00    59.94
  680x384       59.80    59.96
  576x432       60.06
  512x384       60.00
  400x300       60.32    56.34
  320x240       60.05
DP-1 disconnected (normal left inverted right x axis y axis)
HDMI-1 connected primary 1920x1080+0+0 (normal left inverted right x axis y axis) 476mm x 268mm
  1920x1080     60.00*+  50.00    50.00    59.94
  1680x1050     59.88
  1600x900      60.00
  1280x1024     60.02
  1440x900      59.90
  1280x800      59.91
  1280x720      60.00    50.00    59.94
  1024x768      60.00
  800x600       60.32
  720x576       50.00
  720x480       60.00    59.94
  640x480       60.00    59.94
  720x400       70.08
DP-2 disconnected (normal left inverted right x axis y axis)
HDMI-2 disconnected (normal left inverted right x axis y axis)
DP-2-1 connected 1920x1080+3840+0 (normal left inverted right x axis y axis) 476mm x 268mm
  1920x1080     60.00*+  50.00    50.00    59.94
  1680x1050     59.88
  1600x900      60.00
  1280x1024     60.02
  1440x900      59.90
  1280x800      59.91
  1280x720      60.00    50.00    59.94
  1024x768      60.00
  800x600       60.32
  720x576       50.00
  720x480       60.00    59.94
  640x480       60.00    59.94
  720x400       70.08
DP-2-2 connected 1920x1080+1920+0 (normal left inverted right x axis y axis) 476mm x 268mm
  1920x1080     60.00*+  50.00    50.00    59.94
  1680x1050     59.88
  1600x900      60.00
  1280x1024     60.02
  1440x900      59.90
  1280x800      59.91
  1280x720      60.00    50.00    59.94
  1024x768      60.00
  800x600       60.32
  720x576       50.00
  720x480       60.00    59.94
  640x480       60.00    59.94
  720x400       70.08
DP-2-3 disconnected (normal left inverted right x axis y axis)`

function parseDisplaysOutput (out) {
  return out
    .split('\n')
    .filter(line => line.indexOf(' connected ') > 0)
    .filter(line => line.search(/\dx\d/) > 0)
    .map((line, ix) => {
      const parts = line.split(' ')
      const name = parts[0]
      const primary = parts[2] === 'primary'
      const crop = primary ? parts[3] : parts[2]
      const resParts = crop.split(/[x+]/)
      const width = +resParts[0]
      const height = +resParts[1]
      const offsetX = +resParts[2]
      const offsetY = +resParts[3]

      return {
        width,
        height,
        name,
        id: name,
        offsetX,
        offsetY,
        primary,
        crop
      }
    })
}

function listDisplays () {
  return new Promise((resolve, reject) => {
    exec('xrandr --current', (err, stdout) => {
      if (err) {
        return reject(err)
      }
      return resolve(parseDisplaysOutput(stdout))
    })
  })
}

function maxBuffer (screens) {
  let total = 0
  screens.forEach((screen) => {
    total += screen.height * screen.width
  })
  return total
}

function guessFiletype (filename) {
  switch (path.extname(filename)) {
    case '.jpg':
    case '.jpeg':
      return 'jpeg'
    case '.png':
      return 'png'
  }

  return 'jpeg'
}

function linuxSnapshot (options = {}) {
  return new Promise((resolve, reject) => {
    listDisplays().then((screens) => {
      const screen = screens.find(options.screen ? screen => screen.id === options.screen : screen => screen.primary || screen.id === 'default') || screens[0]

      // Validate format
      const allowedFormats = ['jpg', 'jpeg', 'png', 'tiff', 'bmp', 'gif']
      const filetype = (options.format || guessFiletype(options.filename || '')).toLowerCase()
      if (!allowedFormats.includes(filetype)) {
        return reject(new Error('Invalid format'))
      }

      // Sanitize filename
      const filename = options.filename ? options.filename.replace(/[^a-zA-Z0-9._\-/]/g, '') : '-'
      const execOptions =
        options.filename
          ? {}
          : {
              encoding: 'buffer',
              maxBuffer: maxBuffer(screens)
            }

      let cmd, args
      switch (options.linuxLibrary) {
        case 'scrot':
          cmd = 'scrot'
          args = [filename, '-e', '-z', 'echo "' + filename + '"']
          break
        case 'imagemagick':
        default:
          cmd = 'import'
          args = ['-silent', '-window', 'root', '-crop', screen.crop, '-screen', filetype + ':' + filename]
          break
      }

      require('child_process').execFile(cmd, args, execOptions, (err, stdout) => {
        if (err) {
          return reject(err)
        } else {
          return resolve(options.filename ? path.resolve(filename) : stdout)
        }
      })
    })
  })
}

linuxSnapshot.listDisplays = listDisplays
linuxSnapshot.parseDisplaysOutput = parseDisplaysOutput
linuxSnapshot.EXAMPLE_DISPLAYS_OUTPUT = EXAMPLE_DISPLAYS_OUTPUT
linuxSnapshot.all = () => defaultAll(linuxSnapshot)
module.exports = linuxSnapshot
