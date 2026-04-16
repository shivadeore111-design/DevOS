---
# SESSION_RULES.md — Working rules for Claude Code on Aiden

Read this file at the start of every session. Apply to all prompts in 
this repo unless explicitly overridden.

## Context pinning
Before starting, read these files ONCE and hold in context. Do NOT 
re-read between phases unless you've edited them:
- core/agentLoop.ts (main agent loop)
- core/planner.ts
- api/server.ts
- cli/aiden.ts  
- core/theme.ts
- core/panel.ts
- package.json

## Git diff over re-reads
Between phases, use `git log --oneline -10` and `git diff HEAD~1` to 
understand what changed. Do NOT re-read full files to see recent edits.

## Surgical reads
When inspecting a specific function in a large file, use grep to find 
line ranges, then view ONLY that range. Never cat a 2000-line file when 
you need 50 lines.

## No redundant listing
Run `ls` / `find` once, remember the structure. Only re-scan when new 
directories were created in the current phase.

## Concise summaries
Each phase summary ≤15 lines in this format:
- Files created: [list]
- Files modified: [list with one-line description]
- Assumptions: [any]
- TypeScript check: PASS/FAIL
- Commit: [hash + message]

Final prompt summary ≤30 lines.

## No test execution  
Only `npx tsc --noEmit` after each code phase. DO NOT run chat API 
calls, reliability tests, or anything that burns runtime tokens.

The self-test phase at the end of each prompt IS allowed to run 
`npm run test:audit` — that's zero-cost (curl + file reads only).

## File creation over dumping
When writing a file, write it directly. Don't echo the full content 
back in the chat. Confirm the path, move on.

## Assume Aiden is running
For self-test phases, assume Aiden API is at http://localhost:4200. 
If not running, tests will fail with connection errors — note and 
move on, don't try to start the service.
---
