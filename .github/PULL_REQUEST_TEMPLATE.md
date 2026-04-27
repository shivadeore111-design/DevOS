## What this PR does

<!-- One sentence. e.g. "Fixes Ollama detection on Windows by switching localhost → 127.0.0.1" -->

## Why

<!-- Context: what problem does it solve, what issue does it close?
     Closes #___ -->

## How tested

<!-- Describe exactly how you verified the change works:
     - Manual test steps you ran
     - Which test:audit tests cover this area
     - New tests added (if any) -->

## Breaking changes

- [ ] No breaking changes
- [ ] Yes — describe below

<!-- If yes: what breaks, how to migrate -->

## Type of change

- [ ] Bug fix
- [ ] New feature (skill, tool, or capability)
- [ ] Documentation update
- [ ] Dependency update
- [ ] Other: ___

---

## Checklist

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` passes locally
- [ ] `npm run test:audit` passes (or failures are pre-existing and unrelated)
- [ ] CLA signed (the CLA Assistant bot will prompt you if not)
- [ ] PR title follows Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, etc.)
- [ ] No new runtime dependencies added without prior discussion

## Security checklist

- [ ] No new external API calls without justification
- [ ] No new npm dependencies without justification
- [ ] No changes to license validation system
- [ ] No hardcoded API keys or secrets
- [ ] I have NOT modified `api/server.ts`, `core/agentLoop.ts`, `SOUL.md`, or `cloudflare-worker/` without explaining above

<!-- PRs that modify core/, api/, or cloudflare-worker/ require extra scrutiny and may take longer to review -->
