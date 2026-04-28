# Contributing to Aiden

Thanks for your interest! Aiden is built by the community.

## Ways to contribute
- 🐛 Report bugs (use bug report template)
- 💡 Suggest features (use feature request template)
- 🔧 Fix issues (look for "good first issue" label)
- 🧩 Build skills (see skill development guide below)
- 📖 Improve docs
- 🌍 Add translations

## Before you start
1. Check existing issues — your idea may already exist
2. For big changes, open an issue first to discuss
3. Read the architecture docs: docs/ARCHITECTURE.md

## Development setup
```bash
git clone https://github.com/taracodlabs/aiden.git
cd aiden
npm install
cp .env.example .env
# Add GROQ_API_KEY (free at console.groq.com)
npm run build
npm start          # terminal 1
npm run cli        # terminal 2
```

## What gets merged
| Type | Notes |
|------|-------|
| Bug fixes | Always welcome |
| New skills | Easy path, see skill guide |
| New tools | Discuss in issue first |
| Core changes (agentLoop, server) | Maintainer review required |
| Provider additions | Welcome with tests |
| Security changes | Security team review only |

## Sensitive files (require maintainer approval)
- api/server.ts
- core/agentLoop.ts
- core/toolRegistry.ts
- SOUL.md
- cloudflare-worker/

## Skill development (easiest contribution)
See docs/SKILL-DEVELOPMENT.md for the full guide.
Skills need: SKILL.md + skill.json + optional tool handlers.
No core code changes needed.

## Code style
- TypeScript strict mode
- Async/await over callbacks
- Errors must be caught — never let tool failures crash the server
- New tools need: name, description, inputSchema, handler

## CLA
By submitting a PR you agree to the CLA at .github/CLA.md

## Questions?
Discord: discord.gg/8mBwwBcp
