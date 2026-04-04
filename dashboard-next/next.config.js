/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone mode: produces a self-contained server.js in .next/standalone
  // Required for Electron packaging — no `next start` needed, just `node server.js`
  output: 'standalone',
}

module.exports = nextConfig
