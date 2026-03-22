#!/usr/bin/env node
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('\n🚀 DevOS — Personal AI OS\n')

// Check Ollama
try {
  execSync('ollama --version', { stdio: 'ignore' })
  console.log('✅ Ollama found')
} catch {
  console.log('⚠️  Ollama not found. Install from https://ollama.ai')
  console.log('   Then run: ollama pull llama3.2')
}

// Check Node version
const nodeVersion = process.versions.node.split('.')[0]
if (parseInt(nodeVersion) < 18) {
  console.log('⚠️  Node 18+ required. Current:', process.versions.node)
} else {
  console.log('✅ Node', process.versions.node)
}

console.log('\n📖 Quick start:')
console.log('   devos serve     — start API + dashboard')
console.log('   devos chat      — chat in terminal')
console.log('   devos goal      — run a goal')
console.log('   devos whatsapp  — connect WhatsApp\n')

console.log('💡 Optional — use cloud AI instead of Ollama:')
console.log('   devos provider set openai YOUR_API_KEY')
console.log('   devos provider set groq YOUR_API_KEY      (fast + free tier)')
console.log('   devos provider set anthropic YOUR_API_KEY')
console.log('   devos provider list                       (see all 10 providers)\n')
