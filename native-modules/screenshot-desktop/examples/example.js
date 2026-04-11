const screenshot = require('../')
const fs = require('fs')

screenshot().then((img) => {
  fs.writeFile('out.jpg', img, function (err) {
    if (err) {
      throw err
    }
    console.log('written to out.jpg')
  })
}).catch((err) => {
  throw err
})
