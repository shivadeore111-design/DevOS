const path = require('path')
const screenshot = require('..')

screenshot.listDisplays()
  .then((displays) => {
    console.log(displays)
    for (let index = 0; index < displays.length; index++) {
      const display = displays[index]
      const imgpath = path.join(__dirname, Date.now() + '_' + index + '.png')
      screenshot({ screen: display.id, filename: imgpath }).then((imgpath) => {
        console.log(imgpath)
      }).catch(err => {
        console.error(err)
      })
    }
  })

screenshot.listDisplays()
  .then((displays) => {
    console.log(displays)
    for (let index = 0; index < displays.length; index++) {
      const display = displays[index]
      screenshot({ screen: display.id }).then((imgbuf) => {
        console.log(imgbuf)
      }).catch(err => {
        console.error(err)
      })
    }
  })
