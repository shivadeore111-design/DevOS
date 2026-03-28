# Aiden Test Suite

Complete testing infrastructure for DevOS Aiden.
Target: **90%+ pass rate** before Product Hunt launch.

---

## Quick Start

```bash
# Make sure Aiden is running first
npm run dev

# In a second terminal — run all tests
npm test

# Fast mode (skips slow memory tests, ~15 min)
npm run test:fast

# Single suite
npm run test:tools
npm run test:personality
npm run test:memory
npm run test:failure
npm run test:safety
npm run stress-test
```

---

## What each suite tests

| Suite | Tests | What it checks |
|-------|-------|----------------|
| `tool-test` | 14 | Every tool works in isolation — file_write, run_python, web_search etc |
| `personality-test` | 7 | Aiden sounds like Aiden, not ChatGPT |
| `memory-test` | 4 | Remembers facts, multi-turn context, KB search |
| `failure-test` | 5 | Graceful handling of bad input, crashes, concurrency |
| `safety-test` | 7 | CommandGate fires, no API key leaks, jailbreak blocked |
| `stress-test` | 20 | End-to-end tasks from real use cases |

**Total: ~57 tests** (plus 20 stress tasks)

---

## Reports

Every run saves to `workspace/test_reports/`:

```
test_report_2026-03-28T10-30-00.json   ← full data
test_report_2026-03-28T10-30-00.html   ← open in browser
test_report_2026-03-28T10-30-00.csv    ← Evidently AI input
```

Open the HTML report in your browser for a visual dashboard.

---

## Evidently AI (optional — deeper analytics)

```bash
pip install evidently

# Start Evidently UI with your test reports
evidently ui --workspace ./workspace/test_reports

# Open browser: http://localhost:8000
```

Evidently gives you:
- Score distributions across test runs
- Which tests are consistently failing
- Trend over time (is Aiden getting better or worse?)
- Data drift detection between runs

---

## Environment variables

```bash
# .env or environment
AIDEN_URL=http://localhost:4200    # Aiden server URL
OLLAMA_URL=http://localhost:11434  # Ollama for LLM judge
JUDGE_MODEL=qwen2.5-coder:7b      # Model used to judge responses
TEST_TIMEOUT_MS=30000              # Per-test timeout
PASS_THRESHOLD=0.90                # Pass rate needed (0.0-1.0)
REPORT_DIR=workspace/test_reports  # Where to save reports
```

---

## Scoring

Each test returns a score from 0.0 to 1.0:

| Verdict | Score range | Meaning |
|---------|-------------|---------|
| PASS | 0.7 – 1.0 | Working correctly |
| WARN | 0.3 – 0.7 | Partially working, needs attention |
| FAIL | 0.0 – 0.3 | Broken, must fix before launch |
| SKIP | — | Test skipped (config dependent) |

**Suite verdict:**
- `READY` — 90%+ pass rate
- `NEEDS_WORK` — 60–90%
- `BROKEN` — below 60%

---

## What to do with failures

After running `npm test`, look at the HTML report.

**Red (FAIL):** Fix before launch. These are broken features.

**Yellow (WARN):** Fix if possible. These work partially.

**Common fixes:**

```
TOOL-XX failing    → Check the tool's implementation in core/
PERS-XX failing    → Rewrite AIDEN_IDENTITY in aidenPersonality.ts
MEM-XX failing     → Check conversationMemory.ts compression
FAIL-XX failing    → Check error handling in api/server.ts  
SAFE-XX failing    → Check CommandGate in core/controlKernel.ts
```

---

## Adding a new test

Open `tests/runAllTests.ts` and add a test case to any suite:

```typescript
{
  id: "TOOL-15",
  suite: "Tools",
  description: "my new tool works",
  run: async () => {
    const r = await ask("Do the thing");
    const ok = r.response.includes("expected output");
    return {
      id: "TOOL-15",
      suite: "Tools",
      description: "my new tool works",
      verdict: ok ? "PASS" : "FAIL",
      score: ok ? 1 : 0,
      durationMs: r.durationMs,
      detail: ok ? "Worked" : "Did not work",
    };
  },
},
```

That's it. It will be included in the next `npm test` run.
