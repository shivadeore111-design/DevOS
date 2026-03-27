# DevOS — Aiden

**Your personal AI OS. Runs locally. Works for everyone.**

Aiden searches the web, writes code, controls your computer,
learns from your files, and runs autonomously — all on your machine.
Free with Ollama. Zero telemetry. Your data never leaves.

---

## Quick Start

```bash
# Requirements: Node 18+, Ollama
npm install
npx ts-node index.ts serve
# Open http://localhost:3000
```

---

## What Aiden Can Do

**23 built-in tools:**

- Web search and deep research (SearxNG self-hosted + Brave + DDG fallback)
- Create, read, edit any file on your computer
- Run Python, Node.js, PowerShell scripts
- Control mouse, keyboard, take screenshots (vision loop)
- Deploy to Vercel, push to GitHub
- NSE / BSE stock data (Yahoo Finance + Finology)
- Upload books, research papers, PDFs → Aiden learns from them
- 6 communication channels: Telegram, WhatsApp, Discord, Slack, Email, Web

---

## Providers

Works with 10 LLM providers. Ollama is free and fully local.
Add API keys in **Settings → Providers** for cloud providers.

| Provider    | Free tier | Notes                    |
|-------------|-----------|--------------------------|
| Ollama      | ✓ Always  | Local, private, no limit |
| Groq        | ✓ Yes     | Fast inference           |
| Gemini      | ✓ Yes     | Google Flash models      |
| OpenRouter  | ✓ Yes     | 200+ models              |
| Cerebras    | ✓ Yes     | Ultra-fast               |
| NVIDIA      | ✓ Yes     | Llama 3.1 405B           |
| OpenAI      | Paid      | GPT-4o                   |
| Anthropic   | Paid      | Claude                   |
| Together AI | Paid      | Open models              |
| Mistral     | Paid      | European models          |

---

## Optional: Web Search Setup

For best search results, run SearxNG locally (free, unlimited):

```bash
# Docker required
docker compose -f docker-compose.searxng.yml up -d
# Or use the PowerShell helper:
.\scripts\start-searxng.ps1
```

Add to `.env` for Brave Search API fallback (2000 free queries/month):
```
BRAVE_SEARCH_API_KEY=your_key_here
```

---

## Optional: Voice Setup

Install Python packages for voice input/output:

```bash
pip install faster-whisper edge-tts
```

Once installed, the 🎤 and 🔊 buttons appear in the chat panel.

---

## Stress Test

Verify reliability after setup:

```bash
# Terminal 1 — start DevOS
npx ts-node index.ts serve

# Terminal 2 — run 20-task stress test
npm run stress-test
# Target: 90%+ pass rate
```

---

## Privacy

Everything stays on your machine:

- All conversations and task history
- Knowledge base files and embeddings (`workspace/knowledge/`)
- PDF, EPUB, document extractions — local only, no cloud OCR
- Memory, entity graph, semantic index
- Your API keys (stored in `config/config.json`)

---

## Built By

**Shiva Deore** · [Taracod](https://taracod.com) · White Lotus

contact@taracod.com

© 2026 All rights reserved · Apache 2.0 License
