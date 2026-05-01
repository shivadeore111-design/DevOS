# Hello — Example Plugin

Demonstrates how a DevOS plugin registers a slash command that appears in the
CLI Tab-dropdown and is dispatchable at runtime.

## Activating this example

```bash
cp workspace/plugins/_examples/hello/plugin.js workspace/plugins/hello.js
# then restart the CLI, or POST /api/plugins/reload
```

## How plugins extend slash commands (v3.19+)

The plugin system uses a flat `.js` file format. Any file in
`workspace/plugins/` that:
- ends in `.js`
- does **not** start with `_`

…is automatically loaded on server startup. Files starting with `_` are skipped
(use this to disable a plugin without deleting it).

### Plugin API

Your `init(ctx)` function receives a context object:

```js
exports.init = async function(ctx) {

  // 1. Register a slash command
  ctx.commandCatalog.register('/mycommand', {
    desc:    'What /mycommand does',
    section: 'tools',   // info | session | tools | memory | power | debug
    origin:  'plugin',
    handler: async (args) => {
      // args = string[] — everything typed after /mycommand
      // e.g. "/mycommand foo bar" → args = ['foo', 'bar']
    },
  })

  // 2. Register a custom agent tool
  ctx.registerTool({
    name: 'my_tool',
    description: 'Does something useful',
    input_schema: { type: 'object', properties: { query: { type: 'string' } } },
    execute: async ({ query }) => ({ result: `you asked: ${query}` }),
  })

  // 3. Lifecycle hooks
  ctx.hooks.onSessionStart(async (sessionId, sessionCtx) => { /* ... */ })
  ctx.hooks.preTool(async (tool, input) => ({ input }))  // can mutate input or skip

  // 4. Logging
  ctx.log('plugin loaded')   // prints [Plugin:myplugin] plugin loaded

  // 5. Return dispose() for cleanup on reload/shutdown
  return function dispose() {
    ctx.commandCatalog.unregister('/mycommand')
  }
}
```

### How the dropdown works

`commandCatalog.register()` bumps an internal `_generation` counter.
`buildSlashCommands()` in the CLI checks this counter on every keystroke and
rebuilds its cache only when it changes — so the new command appears
**immediately** after registration, with zero restart required (when hot-reload
is used via `POST /api/plugins/reload`).

### Disabling a plugin

```bash
# Option A: prefix with _
mv workspace/plugins/hello.js workspace/plugins/_hello.js

# Option B: delete it
rm workspace/plugins/hello.js

# Then either restart or:
curl -X POST http://localhost:PORT/api/plugins/reload
```

When a plugin is unloaded, its `dispose()` function is called, which should
call `ctx.commandCatalog.unregister('/name')` to remove the command from the
dropdown.
