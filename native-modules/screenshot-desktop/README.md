# screenshot-desktop

> Capture a screenshot of your local machine

* Multi/Cross Platform
  * Linux: required ImageMagick `apt-get install imagemagick`
  * OSX: No dependencies required!
  * Windows: No dependencies required!
* Promise based API
* JPG output (by default)

## Install

    $ npm install --save screenshot-desktop

## Usage

```js
const screenshot = require('screenshot-desktop')

screenshot().then((img) => {
  // img: Buffer filled with jpg goodness
  // ...
}).catch((err) => {
  // ...
})
```

```js
const screenshot = require('screenshot-desktop')

screenshot({format: 'png'}).then((img) => {
  // img: Buffer filled with png goodness
  // ...
}).catch((err) => {
  // ...
})
```

```js
screenshot.listDisplays().then((displays) => {
  // displays: [{ id, name }, { id, name }]
  screenshot({ screen: displays[displays.length - 1].id })
    .then((img) => {
      // img: Buffer of screenshot of the last display
    });
})
```

```js
screenshot.all().then((imgs) => {
  // imgs: an array of Buffers, one for each screen
})
```

```js
screenshot({ filename: 'shot.jpg' }).then((imgPath) => {
  // imgPath: absolute path to screenshot
  // created in current working directory named shot.png
});

// absolute paths work too. so do pngs
screenshot({ filename: '/Users/brian/Desktop/demo.png' })
```

## screenshot() options

- `filename` Optional. Absolute or relative path to save output.
- `format` Optional. Valid values `png|jpg`. 
- `linuxLibrary` Optional. Linux only. Valid values `scrot|imagemagick`. Which library to use. Note that scrot does not support format or screen selection.

## Licence

MIT &copy; [Ben Evans](https://bencevans.io)
