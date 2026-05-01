// ============================================================
// Example Plugin: hello
// DevOS Plugin API — flat .js format (v3.19+)
//
// To activate: copy this file to workspace/plugins/hello.js
// To disable:  prefix the file with _ (e.g. _hello.js)
//              or delete it, then restart the CLI / call
//              POST /api/plugins/reload
// ============================================================

exports.name        = 'hello'
exports.version     = '1.0.0'
exports.description = 'Example plugin — registers the /hello slash command'
exports.author      = 'DevOS'

/**
 * init(ctx) is called once when the plugin is loaded.
 *
 * ctx provides:
 *   ctx.commandCatalog  — register/unregister CLI slash commands
 *   ctx.registerTool()  — register custom agent tools
 *   ctx.registerHook()  — register lifecycle hooks (pre_compact, etc.)
 *   ctx.hooks           — preTool / postTool / onSessionStart / onSessionEnd
 *   ctx.log()           — prefixed console.log for this plugin
 *
 * Return a dispose() function if you need cleanup on unload/reload.
 */
exports.init = async function init(ctx) {
  // Guard: commandCatalog is only injected when running through the full
  // server stack. Skip gracefully if running in a minimal test harness.
  if (!ctx.commandCatalog) {
    ctx.log('commandCatalog not available — /hello will not be registered')
    return
  }

  ctx.commandCatalog.register('/hello', {
    desc:    'Hello from example plugin!',
    section: 'tools',
    origin:  'plugin',
    handler: async (_args) => {
      // In the full CLI, output goes through the session response pipeline.
      // For a real plugin, call a tool or write to the session output buffer.
      // This simple example logs to stdout — replace with your real logic.
      console.log('\n[hello plugin] Hello from example plugin!\n')
    },
  })

  ctx.log('/hello registered')

  // Return a dispose function — called on reload or server shutdown
  return function dispose() {
    if (ctx.commandCatalog) {
      ctx.commandCatalog.unregister('/hello')
      ctx.log('/hello unregistered')
    }
  }
}
