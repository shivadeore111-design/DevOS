/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  // Standalone mode: produces a self-contained server.js in .next/standalone
  // Required for Electron packaging — no `next start` needed, just `node server.js`
  output: 'standalone',

  // Pin tracing root to this directory so Next.js does NOT nest the output under
  // a monorepo subdirectory (e.g. standalone/dashboard-next/server.js).
  // With this set, server.js lands directly at .next/standalone/server.js.
  outputFileTracingRoot: path.join(__dirname),
}

module.exports = nextConfig
