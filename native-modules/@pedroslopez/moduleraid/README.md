**NOTE** This package was modified from pixeldesu's original moduleRaid for compatibility with webpack v5 used in WhatsApp Web. No support will be given outside of anything strictly necessary to extract modules in WhatsApp Web.

<div align='center'>
  <img width=200px src='.github/logo.png?raw=true'>

  <h1>moduleRaid</h1>
  <p>moduleRaid is a utility to get modules and module constructors from <code>webpackJsonp</code> functions embedded on websites by Webpack. It also provides functions to search through returned modules.</p>
</div>

<h2 align='center'>Installation</h2>

You can get moduleRaid over npm

```
$ npm install moduleraid
```

Or if you directly want to use it in the browser

```html
<script src="https://unpkg.com/moduleraid@4.0.1/moduleraid.js"></script>
<!-- minified -->
<script src="https://unpkg.com/moduleraid@4.0.1/moduleraid.min.js"></script>
```

Alternatively, just copy the script from `moduleraid.js` and run it in a devtool console
on the site of your choosing.

<h2 align='center'>Usage</h2>

### Preparation

Using `moduleRaid` as a module, simply require and execute it somewhere where it will end up as a public facing script on a page that also
includes a Webpack build!

```js
const moduleRaid = require('moduleraid')

window.mR = moduleRaid()
```

If you a running the script from the console or loading it over a service like unpkg, no further need for preparations!

### The `moduleraid` object

Once `moduleRaid` is run or included on a page that includes a Webpack build (usually noted by a `webpackJsonp` function), it
will return a object, containing:

* `modules`: An object containing all modules we could get from Webpack
* `constructors`: An array containing all module constructor functions
* `get(id)`: Get the module from the specified `id`
* `findModule(query)`: Return the module that has `query` as a key in its exports
* `findFunction(query)`: Return functions that include `query` (`query` can be either a string or a function)

If you run the code in devtools or load it as external script from unpkg/etc. the `moduleRaid` object can be found in `window.mR` by default.

**Note:** If moduleRaid had to get modules through iteration, `constructors` will be empty and so `findFunction` will not work.

#### Debug Mode

If you call moduleRaid with an optional argument `true`, you will enable debug output. Debug output will show errors that are normally supressed.

In the version that is minified and you can't just add another argument easily, simply run `window.mRdebug = true` before adding the script and you should
be fine!

<h2 align='center'>How it works</h2>

There already was a script basically doing the same as `moduleRaid` some months earlier, called [`webcrack`](https://gist.github.com/no-boot-device/cb63762000e606e50690911cac1bcead) (made by [no-boot-device](https://github.com/no-boot-device)), which was rendered obsolute due to structural changes in how you can access Webpack modules from the outside.

This library is an effort to bring back the ability to inspect all available modules, for debugging or userscript purposes.

As noted above, Webpack exposes a function `webpackJsonp` containing all the code that has been bundled with Webpack. The function takes three
parameters, all of them being an array. The first two don't seem to really matter, the last one is interesting, it seems to directly return
a module given an index.

So, in a brute-forcy manner we simply run a `while` over `webpackJsonp([], [], [i])` until we get an exception from Webpack (trying to run `call`
on `undefined`), and now we have all modules (_or most of them_)!

<h2 align='center'>Known Issues</h2>

* There seem to be a lot of empty modules, I'm not sure if these are _padding_ or something is missing here

<h2 align='center'>License</h2>

moduleRaid is licensed under the MIT License