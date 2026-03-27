# DevOS v2 — Product Hunt Launch Assets

---

## Product Hunt

### Tagline
**Your personal AI OS. Runs locally. Works for everyone.**

### Description (300 characters)
DevOS is a fully local AI agent that runs on your machine. It searches the web, writes code, controls your computer, reads your files, and acts autonomously — all without sending data to the cloud. Free with Ollama. 23 built-in tools. Zero telemetry.

### Full Description
DevOS is a personal AI operating system that runs entirely on your computer.

**What Aiden (your AI) can do:**
- 🌐 Web search and deep research (SearxNG + Brave + DuckDuckGo fallback)
- 📁 Create, read, edit any file on your computer
- 🐍 Run Python, Node.js, and PowerShell scripts
- 🖥️ Control your mouse and keyboard, take screenshots
- 📚 Learn from your files — TXT, Markdown, **PDF**, **EPUB** (Pro)
- 🎤 Voice input and output — speak to Aiden, Aiden speaks back (Pro)
- 🚀 Deploy to Vercel, push to GitHub
- 📈 NSE / BSE stock data in real-time
- 💬 6 communication channels: Telegram, WhatsApp, Discord, Slack, Email, Web

**Why DevOS?**
- 🔒 **Zero telemetry** — your conversations, files, and API keys never leave your machine
- 🆓 **Free with Ollama** — run local models with no monthly bill
- ⚡ **Smart routing** — auto-switches between Groq, Gemini, OpenRouter, Cerebras, NVIDIA, and 5 more
- 🧠 **Semantic memory** — Aiden remembers what you've talked about across sessions
- 📊 **90%+ reliability** — 20-task automated stress test suite

**Get started in 30 seconds:**
```
npm install devos-ai
npx devos serve
```

### Tags
`AI`, `Productivity`, `Developer Tools`, `Open Source`, `Privacy`

### Launch Date
Recommendation: Tuesday or Wednesday (highest PH traffic days)

### Gallery Screenshots
1. Chat panel — Aiden researching and writing code
2. Power Mode — history + live view + activity bar open
3. Knowledge Base — PDF/EPUB upload with format badges
4. Settings — provider grid, Pro license tab
5. Stress test output — 20/20 ✓ (terminal)

---

## Maker's First Comment

> Hey Product Hunt! 👋
>
> I'm Shiva — I built DevOS because I wanted an AI that actually *lived* on my machine instead of sending everything to the cloud.
>
> The core idea: what if your AI had the same access to your computer that *you* do? It can open files, run scripts, take screenshots, browse the web, and act autonomously — all locally.
>
> **v2.0 ships today with:**
> - **PDF + EPUB ingestion** — feed Aiden your books and research papers
> - **Voice I/O** — speak to Aiden and hear responses back
> - **Pro license system** — sustains development while keeping the core free forever
> - **90%+ reliability target** — validated by a 20-task automated stress test
>
> It's free with Ollama. No data leaves your machine. No subscription needed for the core features.
>
> Would love your feedback — especially on the voice features and knowledge base. What would you upload first? 🤔
>
> — Shiva

---

## Twitter / X Launch Thread

**Tweet 1 (main)**
> DevOS v2 is live on Product Hunt 🚀
>
> A personal AI OS that runs entirely on your machine.
> 23 tools. Zero telemetry. Free with Ollama.
>
> New in v2: PDF/EPUB ingestion + voice I/O + Pro license
>
> 👉 [Product Hunt link]
>
> Thread on what it does 🧵

**Tweet 2**
> Aiden (your AI) can:
>
> 🌐 Search the web + do deep research
> 📁 Create, read, edit any file
> 🐍 Run Python, Node.js, PowerShell
> 🖥️ Control your mouse + keyboard
> 📚 Learn from your PDFs and EPUBs
> 🎤 Hear your voice and speak back
>
> All local. All private.

**Tweet 3**
> Privacy matters.
>
> DevOS stores everything on your machine:
> - All conversations + history
> - Your knowledge base (PDFs, books, notes)
> - API keys (local config file)
> - Memory, entity graph, semantic index
>
> Zero telemetry. Not even crash reports go out.

**Tweet 4**
> Smart provider routing means you can use it free.
>
> Groq → Gemini → OpenRouter → Cerebras → NVIDIA → Ollama
>
> DevOS auto-switches when one rate-limits. Per-provider reset windows (Groq resets in 15s, not 1hr like most tools assume).
>
> Never stuck waiting.

**Tweet 5**
> The 20-task stress test:
>
> ✓ Web search + weather + stocks
> ✓ File create + research + memory
> ✓ Python + Node.js execution
> ✓ Screenshot + vision loop
> ✓ Deep research (3-sentence LLM summary)
> ✓ Knowledge base + URL fetch
>
> Target: 90%+ pass rate
> We ship when it hits 90.

**Tweet 6**
> v2 Pro features:
>
> 📄 PDF ingestion — all local, no cloud OCR
> 📖 EPUB/book ingestion — feed Aiden your library
> 🎤 Voice input via Whisper (runs locally)
> 🔊 Text-to-speech via edge-tts
>
> One-time license key. 7-day offline grace period.
> Core always stays free.

**Tweet 7 (CTA)**
> Try it:
>
> ```
> npm install devos-ai
> npx devos serve
> ```
>
> Or clone + run locally with Ollama for completely free, unlimited usage.
>
> GitHub: [link]
> Product Hunt: [link]
>
> RT if you want local AI to win 🙌

---

## Reddit Posts

### r/LocalLLaMA

**Title:** DevOS v2 — local AI agent with PDF/EPUB ingestion, voice I/O, and 23 built-in tools

> I've been building DevOS for the past few months — it's a personal AI OS that runs on your machine. v2 ships today with PDF + EPUB ingestion (all local, no cloud OCR) and voice I/O via Whisper + edge-tts.
>
> Core features:
> - Web search (SearxNG self-hosted + Brave fallback)
> - File operations, Python/Node/PowerShell execution
> - Computer control (mouse, keyboard, screenshots)
> - Knowledge base from your files
> - Smart routing across Groq/Gemini/OpenRouter/Cerebras/NVIDIA/Ollama
>
> Works free with Ollama. Zero telemetry. Apache 2.0.
>
> Happy to answer questions about the architecture — especially the async KB upload, the provider routing, or the stress test suite.

### r/SideProject

**Title:** I built a local AI agent that can read your PDFs, control your computer, and remember everything — v2 just launched

> Been working on this for a while. DevOS is a personal AI OS — runs locally, stores nothing in the cloud, works with Ollama for free.
>
> v2 adds PDF/EPUB ingestion and voice. Launching on Product Hunt today.
>
> [link]

---

## Email to Early Users

**Subject:** DevOS v2 is live — PDF ingestion + voice I/O + Pro

Hi [Name],

DevOS v2 shipped today.

**What's new:**
- **PDF + EPUB ingestion** — upload books and research papers directly to Aiden's knowledge base (all local processing)
- **Voice input/output** — speak to Aiden, Aiden speaks back (Whisper STT + edge-tts)
- **Pro license** — sustains development; core features stay free forever
- **Reliability** — 90%+ pass rate on a 20-task automated stress test

**Upgrade:** `Settings → Pro License` → paste your key after purchase at taracod.com

Thanks for being an early user. Your feedback shaped v2.

— Shiva
contact@taracod.com
