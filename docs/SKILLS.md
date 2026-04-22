# Adding Skills to Aiden

Skills are markdown files (`SKILL.md`) that teach Aiden when and how to use a particular tool, API, or workflow. The skill system is context-injection based — the AI reads the relevant skill docs and uses them to guide its actions.

## How skills work

1. Aiden scans `skills/*/SKILL.md` and `workspace/skills/*/SKILL.md` at startup
2. On each user message, relevant skills are matched by keyword and injected into the prompt
3. The AI then follows the instructions in the skill — running PowerShell, calling APIs, etc.
4. No code execution happens automatically; the AI decides when a skill applies

Skills appear in `/skills` and in the dashboard skill browser.

---

## Adding a pure documentation skill

The simplest skill is a single `SKILL.md` in its own directory:

```
skills/
  my-skill/
    SKILL.md
```

### SKILL.md frontmatter

```markdown
---
name: my-skill
description: One-sentence description shown in /skills list
category: security         # security | developer | productivity | windows | research | ...
version: 1.0.0
origin: aiden              # aiden | community | local
tags: tag1, tag2, tag3
env_required:
  - MY_API_KEY             # list env vars the skill needs
---

# Skill Title

Description paragraph.

## When to Use

- Scenario 1
- Scenario 2

## How to Use

### Step title

```powershell
# Example command
```

## Cautions

- Any rate limits, ToS notes, destructive operations

## Requirements

- `MY_API_KEY` — how to obtain it
```

### Constraints enforced at load time

| Rule | Limit |
|------|-------|
| Max file size | 10 KB |
| Must have `#` header | if > 500 chars |
| Code/prose ratio | `codeBlocks × 10 ≤ totalLines` |
| No injection patterns | See `core/skillLoader.ts` for blocked patterns |

---

## Adding an API-backed skill (with TypeScript handler)

For skills that make HTTP API calls, use the `ApiSkill` base class to get auth injection, retries, rate limiting, and timeouts for free.

### File layout

```
skills/
  my-api-skill/
    SKILL.md       ← loaded by SkillLoader (shows in /skills)
    index.ts       ← programmatic TypeScript handler
```

### 1. Create `index.ts`

```typescript
import { ApiSkill, requireApiKey } from '../../core/apiSkillBase'

// Instantiate once at module level
const skill = new ApiSkill({
  name:       'my-api',
  baseUrl:    'https://api.example.com/v1',
  apiKeyEnv:  'MY_API_KEY',      // reads process.env.MY_API_KEY
  authType:   'header',          // 'bearer' | 'header' | 'query' | 'none'
  authHeader: 'x-api-key',       // header name (authType === 'header')
  rateLimit:  { requests: 10, windowMs: 60_000 },
  timeout:    20_000,
  retries:    3,
})

export async function lookup(query: string): Promise<string> {
  requireApiKey('MY_API_KEY')   // throws user-friendly error if missing

  const data = await skill.get('/search', { q: query })
  return JSON.stringify(data, null, 2)
}
```

### 2. `ApiSkillConfig` reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | required | Used in error messages |
| `baseUrl` | string | required | Base URL, trailing slash stripped |
| `apiKeyEnv` | string | — | Env var name (`process.env[apiKeyEnv]`) |
| `apiKey` | string | — | Literal key value (prefer `apiKeyEnv`) |
| `authType` | `'bearer'\|'header'\|'query'\|'none'` | required | How the key is sent |
| `authHeader` | string | `''` | Header name (when `authType === 'header'`) |
| `authQueryParam` | string | `''` | Query param name (when `authType === 'query'`) |
| `timeout` | number | `30_000` | Request timeout in ms |
| `retries` | number | `3` | Retries on 429 / 502 / 503 / 504 |
| `rateLimit.requests` | number | — | Token bucket size |
| `rateLimit.windowMs` | number | — | Window duration in ms |

### 3. Auth pattern examples

**Bearer token** (Authorization: Bearer `<key>`)
```typescript
authType: 'bearer'
```

**Custom header** (e.g. `hibp-api-key: <key>`)
```typescript
authType:   'header',
authHeader: 'hibp-api-key',
```

**Query parameter** (e.g. `?apikey=<key>`)
```typescript
authType:        'query',
authQueryParam:  'apikey',
```

**No auth** (public API)
```typescript
authType: 'none',
```

### 4. Add env var to `.env.example`

```bash
# My API skill
# Get key: https://example.com/api-keys
MY_API_KEY=
```

---

## Existing API skills

| Skill | Auth | Rate limit | Key env var |
|-------|------|------------|-------------|
| `haveibeenpwned` | header `hibp-api-key` | 1 req / 1.5s | `HIBP_API_KEY` |
| `crt.sh` | none | — | — |
| `urlscan` | header `API-Key` | 5 req / 60s | `URLSCAN_API_KEY` |

---

## Testing your skill

```powershell
# Verify it appears in the skills list
# (start Aiden and run in the CLI)
/skills

# Test the SKILL.md parser independently
node -e "
const { skillLoader } = require('./dist/core/skillLoader');
const s = skillLoader.loadAll().find(x => x.name === 'my-skill');
console.log(s ? 'loaded: ' + s.name : 'NOT FOUND');
"
```

If the skill does not appear, check:
1. `skills/my-skill/SKILL.md` exists (directory + file)
2. Frontmatter has valid `name:` field
3. File is under 10 KB
4. No injection-pattern keywords in the content
5. Code-block-to-line ratio is below the limit
