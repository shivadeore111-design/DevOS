# Contributing to Aiden

Thank you for your interest in contributing! Aiden is an AGPL-3.0 open source project maintained by [Taracod](https://taracod.com). All contributions — bug fixes, skills, documentation, translations — are welcome.

---

## Getting Started

### Prerequisites

- **Node.js ≥ 18** (LTS recommended — `node --version`)
- **Windows 10 or 11** (64-bit) — Aiden is Windows-only at this time
- **Git** with a configured user name and email
- **[Ollama](https://ollama.com)** installed and running locally (optional for most unit tests)

### First-time setup

```bash
git clone https://github.com/taracodlabs/aiden.git
cd aiden
npm install
cp .env.example .env        # fill in values you need for your work
npm run build               # TypeScript compile + CLI + API bundle
npm run cli                 # start the TUI to confirm it works
```

If `npm run build` fails, check Node version first (`node --version` must be ≥ 18).

---

## Development Workflow

### Branching

Branch off `master` using a descriptive name:

| Prefix | Purpose |
|--------|---------|
| `feature/` | New capabilities |
| `fix/` | Bug fixes |
| `chore/` | Build, CI, tooling |
| `docs/` | Documentation only |
| `skill/` | New or updated skills |

Example: `git checkout -b fix/ollama-ipv6-windows`

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(providers): add Cerebras streaming support
fix(ollama): use 127.0.0.1 to avoid IPv6 ECONNREFUSED on Windows
chore(deps): bump playwright to 1.58
docs(readme): update install section for v3.7
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`

### Before every commit

```bash
npx tsc --noEmit    # must be clean — zero errors, zero warnings
```

### Before opening a PR

```bash
npm run test:audit  # integration audit suite — confirm nothing regressed
```

The audit suite is zero-cost (curl + file reads, no token burn). Fix any failures before opening the PR.

---

## Adding a Skill

Skills are the easiest contribution. Each skill is a self-contained directory:

```
skills/
  your-skill-name/
    SKILL.md          ← required: manifest + prompt
    README.md         ← optional: user-facing docs
    tools.ts          ← optional: tool implementations
    examples/         ← optional: usage examples
```

### SKILL.md manifest format

```markdown
# skill-name

Short one-line description of what the skill does.

## Trigger

Phrases that activate this skill (used by the skill router):
- "do X"
- "help me with Y"

## Tools

List of tool names this skill exposes (if any).

## Prompt

The system prompt injected when this skill is active.
[Full skill context here]
```

### Testing a skill locally

1. Place your skill directory under `skills/your-skill-name/`
2. Start Aiden (`npm start` + `npm run cli`)
3. Type `/skills` to confirm it appears in the registry
4. Test your trigger phrases in the chat

### License note

Skills ship under **Apache-2.0** (see [LICENSE-SKILLS.md](LICENSE-SKILLS.md)), which allows commercial use without copyleft. By submitting a skill you agree to license it under Apache-2.0.

---

## Pull Request Process

1. Fork the repo, create your branch, commit your changes
2. Push to your fork and open a PR against `master`
3. Fill in the PR template — especially **how you tested** and whether there are **breaking changes**
4. The [CLA Assistant bot](https://cla-assistant.io) will prompt you to sign the Contributor License Agreement on your first PR — this is a one-time step
5. A maintainer will review within **3–7 business days** (Aiden is solo-maintained; please be patient)
6. Address review feedback with new commits (don't force-push during review)
7. Once approved, the maintainer will squash-merge

---

## Code Style

- **TypeScript strict mode** — `tsconfig.json` has `"strict": true`; no `any` escapes without a comment explaining why
- **No new runtime dependencies** without opening a discussion first — bundle size and supply-chain risk matter
- **Follow the file's existing patterns** — if a file uses a specific error-handling style, match it
- **No commented-out code** in PRs — delete it or add a `// TODO:` with a tracking issue number
- **Imports** — no default exports on new modules; named exports only

---

## Questions

- **Design questions / RFC-style discussion** → open a [GitHub Discussion](https://github.com/taracodlabs/aiden/discussions), not an Issue
- **Bug reports** → use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md)
- **Feature requests** → use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md)
- **Security vulnerabilities** → see [SECURITY.md](SECURITY.md); do **not** open a public issue
- **Anything sensitive** → hello@taracod.com
