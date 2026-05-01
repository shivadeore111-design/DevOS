// DevOS example plugin — copy of _examples/hello/plugin.js
// Active: loaded on startup from workspace/plugins/hello.js
// Disable: rename to _hello.js

exports.name        = 'hello'
exports.version     = '1.0.0'
exports.description = 'Example plugin — registers the /hello slash command'
exports.author      = 'DevOS'

exports.init = async function init(ctx) {
  if (!ctx.commandCatalog) {
    ctx.log('commandCatalog not available — /hello will not be registered')
    return
  }

  ctx.commandCatalog.register('/hello', {
    desc:    'Hello from example plugin!',
    section: 'tools',
    origin:  'plugin',
    handler: async (_args) => {
      console.log('\n[hello plugin] Hello from example plugin!\n')
    },
  })

  ctx.log('/hello registered')

  return function dispose() {
    if (ctx.commandCatalog) {
      ctx.commandCatalog.unregister('/hello')
      ctx.log('/hello unregistered')
    }
  }
}
