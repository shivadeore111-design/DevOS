# Good First Issues

New to Aiden? Start here.
These are self-contained, well-scoped, and don't require
touching sensitive core files.

## Beginner (skills only)
No TypeScript needed. Just SKILL.md + skill.json.

- [ ] Build a "morning brief" skill (weather + news + stocks)
- [ ] Build a "focus mode" skill (blocks distracting sites)
- [ ] Build a "standup notes" skill (formats daily standup)
- [ ] Build a "git summary" skill (summarizes recent commits)
- [ ] Build a "clipboard history" skill (tracks last 10 copies)
- [ ] Add more NSE stock skills (sector analysis, portfolio tracker)

## Intermediate (new tools)
Requires adding a tool to toolRegistry.ts.

- [ ] Add `browser_wait_for` tool (wait for element to appear)
- [ ] Add `browser_get_url` tool (return current page URL)
- [ ] Add `get_clipboard_history` tool (last N clipboard entries)
- [ ] Add `pdf_read` tool (extract text from PDF)
- [ ] Add `zip_files` tool (compress files to ZIP)
- [ ] Add `get_network_info` tool (IP, connected devices)

## Advanced (architecture)
Requires reading ARCHITECTURE.md first.

- [ ] Add Mistral provider
- [ ] Add Cohere provider
- [ ] Add HuggingFace inference provider
- [ ] Implement provider health dashboard
- [ ] Add batch tool execution (run N tools in parallel)

## How to claim an issue
Comment "I'm working on this" on the relevant GitHub issue.
Ask questions in Discord: discord.gg/8mBwwBcp
