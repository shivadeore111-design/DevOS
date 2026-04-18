# AUDIT_LOG.md — Prompt 11 Self-Test Results
# Auto-appended by `npm run test:audit`


## 2026-04-16T20:51:33.162Z — 7/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 120 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 104 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✗ | 0 | workspace path should be 'local', got 'aiden' |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 17 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-16T20:52:39.496Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 156 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 530 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 17 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 32 | ok |

## 2026-04-16T21:06:56.995Z — 6/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 3149 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 1 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 16 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 1 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 13 | ok |
| 7 | toolRegistry: run tool is registered and categorised as code | ✗ | 1 | Cannot read properties of undefined (reading 'run') |
| 8 | scripts/: directory exists and contains at least 5 example scripts | ✗ | 19 | Script bundle-api.js must use the aiden SDK (no "aiden." found) |

## 2026-04-16T21:07:32.993Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1021 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 15 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 1 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 14 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 1 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 1 | ok |

## 2026-04-16T21:07:39.746Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 121 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 112 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 18 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 1 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T05:12:17.643Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 4195 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 1 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 10 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 13 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 128 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 10 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 0 | ok |

## 2026-04-17T05:12:26.776Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 124 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 504 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 17 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T05:12:51.838Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 2324 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 15 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 0 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 13 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 0 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 49 | ok |

## 2026-04-17T05:12:59.928Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1820 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 1 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 12 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 10 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 89 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 9 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T05:13:08.519Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 170 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 1 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 427 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 0 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 18 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 43 | ok |

## 2026-04-17T05:13:12.823Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1067 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 1 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 15 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 0 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 14 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 1 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 1 | ok |

## 2026-04-17T05:13:17.922Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1636 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 1 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 1 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 11 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 11 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 25 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 11 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T06:18:19.913Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 162 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 562 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 0 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 47 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 36 | ok |

## 2026-04-17T06:18:24.180Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1119 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 16 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 0 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 12 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 0 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 59 | ok |

## 2026-04-17T06:18:29.160Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1732 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 1 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 11 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 10 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 130 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 11 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T06:18:32.363Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 0 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 82 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 34 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 1 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 1 | ok |

## 2026-04-17T06:30:24.789Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 144 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 1 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 1 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 139 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 57 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 2 | ok |

## 2026-04-17T06:30:29.628Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1281 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 17 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 0 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 14 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 1 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 1 | ok |

## 2026-04-17T06:30:34.664Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1775 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 1 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 14 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 1 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 12 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 27 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 12 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 0 | ok |

## 2026-04-17T06:30:37.858Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 0 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 80 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 4 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 1 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 1 | ok |

## 2026-04-17T06:49:24.420Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 2 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 3 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 2 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 1 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 0 | ok |

## 2026-04-17T06:49:31.525Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 121 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 110 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 19 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 1 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T06:49:35.398Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1008 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 1 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 14 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 1 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 13 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 1 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 3 | ok |

## 2026-04-17T06:49:39.796Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1540 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 1 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 11 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 10 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 28 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 9 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 0 | ok |

## 2026-04-17T06:49:42.692Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 0 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 72 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 3 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 1 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 1 | ok |

## 2026-04-17T06:49:45.513Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 2 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 2 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 2 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 0 | ok |

## 2026-04-17T07:27:49.239Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 118 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 96 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 17 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T07:27:53.149Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1021 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 15 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 0 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 12 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 1 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 1 | ok |

## 2026-04-17T07:27:57.670Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1594 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 1 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 12 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 11 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 26 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 11 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T07:28:00.685Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 0 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 77 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 4 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 1 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 1 | ok |

## 2026-04-17T07:28:03.570Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 2 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 3 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 3 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 1 | ok |

## 2026-04-17T07:28:06.485Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 10 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 3 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 2 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 0 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 5 | ok |

## 2026-04-17T07:44:13.088Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 117 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 113 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 0 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 17 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T07:44:16.964Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1051 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 15 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 0 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 13 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 0 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 1 | ok |

## 2026-04-17T07:44:21.778Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1806 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 11 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 1 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 9 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 26 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 10 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T07:44:24.751Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 0 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 72 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 3 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 1 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 0 | ok |

## 2026-04-17T07:44:27.721Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 3 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 2 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 0 | ok |

## 2026-04-17T07:44:30.650Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 9 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 3 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 1 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 0 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 5 | ok |

## 2026-04-17T07:44:33.506Z — 7/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✗ | 0 | McpServerConfig must have transport field with 'stdio' | 'http' |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 0 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 1 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 0 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 1 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 0 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 1 | ok |

## 2026-04-17T07:44:53.234Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 115 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 92 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 37 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T07:44:57.152Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1064 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 15 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 1 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 13 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 0 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 1 | ok |

## 2026-04-17T07:45:01.677Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1603 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 1 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 11 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 10 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 27 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 10 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T07:45:04.623Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 0 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 1 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 70 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 3 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 1 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 0 | ok |

## 2026-04-17T07:45:07.485Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 2 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 3 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 3 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 4 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 0 | ok |

## 2026-04-17T07:45:10.494Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 11 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 2 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 1 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 0 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 5 | ok |

## 2026-04-17T07:45:13.546Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 1 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 0 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 1 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 0 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 1 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 1 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 1 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 1 | ok |

## 2026-04-17T07:45:20.907Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 120 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 96 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 38 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 1 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T07:45:24.851Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1065 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 15 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 0 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 13 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 1 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 1 | ok |

## 2026-04-17T07:45:29.379Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1617 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 1 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 11 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 1 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 10 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 25 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 11 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T07:45:32.315Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 0 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 1 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 71 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 3 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 1 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 0 | ok |

## 2026-04-17T07:45:35.186Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 3 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 2 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 1 | ok |

## 2026-04-17T07:45:38.043Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 11 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 3 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 0 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 1 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 5 | ok |

## 2026-04-17T07:45:41.068Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 0 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 0 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 0 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 1 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 1 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 0 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 1 | ok |

## 2026-04-17T07:59:36.881Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 1 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.5.0 | ✓ | 1 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.5.0 | ✓ | 0 | ok |
| 5 | r2: download URL references v3.5.0/Aiden-Setup-3.5.0.exe | ✓ | 1 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.5.0" | ✓ | 0 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 1 | ok |
| 8 | r2: exactly 5 occurrences of "3.5.0" in landing.js | ✓ | 1 | ok |

## 2026-04-17T07:59:44.219Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 120 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 96 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 43 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T07:59:48.267Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1094 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 1 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 15 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 1 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 14 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 0 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 2 | ok |

## 2026-04-17T07:59:52.960Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1666 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 1 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 11 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 10 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 27 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 10 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 0 | ok |

## 2026-04-17T07:59:56.216Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 0 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 77 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 3 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 1 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 1 | ok |

## 2026-04-17T07:59:59.459Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 3 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 2 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 2 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 2 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 1 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 0 | ok |

## 2026-04-17T08:00:02.397Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 9 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 2 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 1 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 0 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 6 | ok |

## 2026-04-17T08:00:05.318Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 0 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 1 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 0 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 1 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 0 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 1 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 1 | ok |

## 2026-04-17T08:00:08.244Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 0 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.5.0 | ✓ | 0 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.5.0 | ✓ | 1 | ok |
| 5 | r2: download URL references v3.5.0/Aiden-Setup-3.5.0.exe | ✓ | 1 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.5.0" | ✓ | 0 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 0 | ok |
| 8 | r2: exactly 5 occurrences of "3.5.0" in landing.js | ✓ | 1 | ok |

## 2026-04-17T08:00:14.778Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 128 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 100 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 0 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 41 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T08:00:18.896Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1101 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 15 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 0 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 13 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 1 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 1 | ok |

## 2026-04-17T08:00:23.566Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1676 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 1 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 11 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 1 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 11 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 26 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 10 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T08:00:26.679Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 0 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 1 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 73 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 4 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 1 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 0 | ok |

## 2026-04-17T08:00:29.580Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 3 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 2 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 4 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 1 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 0 | ok |

## 2026-04-17T08:00:32.961Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 11 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 2 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 0 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 0 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 5 | ok |

## 2026-04-17T08:00:36.073Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 0 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 1 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 0 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 1 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 0 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 1 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 1 | ok |

## 2026-04-17T08:00:38.960Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 0 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.5.0 | ✓ | 0 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.5.0 | ✓ | 1 | ok |
| 5 | r2: download URL references v3.5.0/Aiden-Setup-3.5.0.exe | ✓ | 1 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.5.0" | ✓ | 0 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 0 | ok |
| 8 | r2: exactly 5 occurrences of "3.5.0" in landing.js | ✓ | 1 | ok |

## 2026-04-17T08:29:32.163Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 1 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 0 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 1 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 0 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 0 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 0 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 0 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 0 | ok |

## 2026-04-17T08:29:39.728Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 158 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 804 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 0 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 41 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T08:29:45.903Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 3193 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 14 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 0 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 14 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 0 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 74 | ok |

## 2026-04-17T08:29:51.439Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 2223 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 12 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 11 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 120 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 10 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T08:29:54.454Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 13 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 73 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 3 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 1 | ok |

## 2026-04-17T08:29:57.407Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 2 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 3 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 14 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 1 | ok |

## 2026-04-17T08:30:00.413Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 11 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 4 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 1 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 0 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 5 | ok |

## 2026-04-17T08:30:03.454Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 1 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 0 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 1 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 0 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 1 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 17 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 2 | ok |

## 2026-04-17T08:30:06.392Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 1 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.5.0 | ✓ | 0 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.5.0 | ✓ | 1 | ok |
| 5 | r2: download URL references v3.5.0/Aiden-Setup-3.5.0.exe | ✓ | 0 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.5.0" | ✓ | 0 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 1 | ok |
| 8 | r2: exactly 5 occurrences of "3.5.0" in landing.js | ✓ | 0 | ok |

## 2026-04-17T08:30:09.314Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 0 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 1 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 0 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 0 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 0 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 1 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 0 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 1 | ok |

## 2026-04-17T08:45:19.411Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 1 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 0 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 1 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 0 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 0 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 1 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 0 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 1 | ok |

## 2026-04-17T08:45:27.517Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 332 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 1 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 134 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 25 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 2 | ok |

## 2026-04-17T08:45:32.610Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1313 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 16 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 1 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 16 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 0 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 1 | ok |

## 2026-04-17T08:45:38.381Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1971 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 1 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 13 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 13 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 28 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 11 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T08:45:42.207Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 0 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 1 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 76 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 5 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 1 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 1 | ok |

## 2026-04-17T08:45:45.914Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 3 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 3 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 2 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 0 | ok |

## 2026-04-17T08:45:49.735Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 11 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 3 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 0 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 1 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 5 | ok |

## 2026-04-17T08:45:53.394Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 0 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 1 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 0 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 1 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 0 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 1 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 1 | ok |

## 2026-04-17T08:45:57.162Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 1 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 0 | ok |
| 3 | r2: nav badge contains v3.5.0 | ✓ | 1 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.5.0 | ✓ | 1 | ok |
| 5 | r2: download URL references v3.5.0/Aiden-Setup-3.5.0.exe | ✓ | 0 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.5.0" | ✓ | 1 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 0 | ok |
| 8 | r2: exactly 5 occurrences of "3.5.0" in landing.js | ✓ | 1 | ok |

## 2026-04-17T08:46:00.855Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 1 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 0 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 0 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 0 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 0 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 0 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 1 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 0 | ok |

## 2026-04-17T08:46:04.773Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 1 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 1 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 1 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 0 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 1 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 0 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 0 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 1 | ok |

## 2026-04-17T08:56:24.107Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 1 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 0 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 0 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 0 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 0 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 1 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 1 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 1 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✓ | 0 | ok |

## 2026-04-17T08:56:32.139Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 193 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 92 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 17 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 2 | ok |

## 2026-04-17T08:56:36.875Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1088 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 1 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 16 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 1 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 15 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 0 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 2 | ok |

## 2026-04-17T08:56:42.142Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1621 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 1 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 10 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 1 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 11 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 24 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 11 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 0 | ok |

## 2026-04-17T08:56:45.796Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 0 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 1 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 71 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 3 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 1 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 0 | ok |

## 2026-04-17T08:56:49.472Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 2 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 3 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 2 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 0 | ok |

## 2026-04-17T08:56:53.051Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 12 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 3 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 0 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 1 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 5 | ok |

## 2026-04-17T08:56:56.618Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 0 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 1 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 0 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 1 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 0 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 1 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 1 | ok |

## 2026-04-17T08:57:00.283Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 0 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.5.0 | ✓ | 0 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.5.0 | ✓ | 1 | ok |
| 5 | r2: download URL references v3.5.0/Aiden-Setup-3.5.0.exe | ✓ | 0 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.5.0" | ✓ | 1 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 0 | ok |
| 8 | r2: exactly 5 occurrences of "3.5.0" in landing.js | ✓ | 1 | ok |

## 2026-04-17T08:57:03.875Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 1 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 0 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 1 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 0 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 0 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 1 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 0 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 0 | ok |

## 2026-04-17T08:57:07.504Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 1 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 0 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 0 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 1 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 0 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 1 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 0 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 0 | ok |

## 2026-04-17T08:57:11.173Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 0 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 0 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 0 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 0 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 1 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 0 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 1 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 1 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✓ | 0 | ok |

## 2026-04-17T08:57:19.170Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 197 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 89 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 0 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 16 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 2 | ok |

## 2026-04-17T08:57:23.955Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1118 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 15 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 0 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 12 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 0 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 1 | ok |

## 2026-04-17T08:57:29.280Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1666 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 1 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 11 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 11 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 27 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 10 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 0 | ok |

## 2026-04-17T08:57:33.070Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 0 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 74 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 3 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 1 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 1 | ok |

## 2026-04-17T08:57:36.691Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 2 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 2 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 2 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 0 | ok |

## 2026-04-17T08:57:40.369Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 11 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 3 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 0 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 1 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 6 | ok |

## 2026-04-17T08:57:44.012Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 0 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 0 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 1 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 0 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 0 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 1 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 0 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 2 | ok |

## 2026-04-17T08:57:47.618Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 0 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.5.0 | ✓ | 0 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.5.0 | ✓ | 1 | ok |
| 5 | r2: download URL references v3.5.0/Aiden-Setup-3.5.0.exe | ✓ | 0 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.5.0" | ✓ | 1 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 0 | ok |
| 8 | r2: exactly 5 occurrences of "3.5.0" in landing.js | ✓ | 1 | ok |

## 2026-04-17T08:57:51.312Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 1 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 0 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 0 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 0 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 1 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 0 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 0 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 0 | ok |

## 2026-04-17T08:57:54.955Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 1 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 1 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 0 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 0 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 0 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 1 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 0 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 1 | ok |

## 2026-04-17T08:57:58.542Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 1 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 0 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 0 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 0 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 1 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 0 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 1 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 1 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✓ | 0 | ok |

## 2026-04-17T09:01:46.916Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 321 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 134 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 25 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 1 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T09:01:52.704Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1423 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 1 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 17 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 1 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 15 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 1 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 2 | ok |

## 2026-04-17T09:01:58.721Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 2192 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 1 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 13 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 1 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 13 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 34 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 17 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T09:02:02.885Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 0 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 76 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 3 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 1 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 1 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 0 | ok |

## 2026-04-17T09:02:07.368Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 3 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 2 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 2 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 2 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 1 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 0 | ok |

## 2026-04-17T09:02:11.568Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 12 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 3 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 0 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 1 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 6 | ok |

## 2026-04-17T09:02:15.223Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 0 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 1 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 0 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 0 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 1 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 0 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 1 | ok |

## 2026-04-17T09:02:19.176Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 0 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.5.0 | ✓ | 1 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.5.0 | ✓ | 0 | ok |
| 5 | r2: download URL references v3.5.0/Aiden-Setup-3.5.0.exe | ✓ | 1 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.5.0" | ✓ | 0 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 1 | ok |
| 8 | r2: exactly 5 occurrences of "3.5.0" in landing.js | ✓ | 0 | ok |

## 2026-04-17T09:02:23.192Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 0 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 0 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 1 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 0 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 0 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 1 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 1 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 0 | ok |

## 2026-04-17T09:02:27.039Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 1 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 0 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 0 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 0 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 1 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 1 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 1 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 0 | ok |

## 2026-04-17T09:02:30.897Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 0 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 0 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 0 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 0 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 1 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 0 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 1 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 1 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✓ | 0 | ok |

## 2026-04-17T09:18:23.253Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 194 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 90 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 16 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T09:18:27.878Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1093 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 15 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 0 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 14 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 0 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 2 | ok |

## 2026-04-17T09:18:33.054Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1601 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 11 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 10 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 26 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 11 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T09:18:36.642Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 1 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 71 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 3 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 1 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 1 | ok |

## 2026-04-17T09:18:40.167Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 2 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 2 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 2 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 2 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 1 | ok |

## 2026-04-17T09:18:43.751Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 11 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 3 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 0 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 1 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 5 | ok |

## 2026-04-17T09:18:47.587Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 1 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 0 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 1 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 0 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 1 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 0 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 0 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 1 | ok |

## 2026-04-17T09:18:51.285Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 0 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.5.0 | ✓ | 1 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.5.0 | ✓ | 0 | ok |
| 5 | r2: download URL references v3.5.0/Aiden-Setup-3.5.0.exe | ✓ | 1 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.5.0" | ✓ | 1 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 1 | ok |
| 8 | r2: exactly 5 occurrences of "3.5.0" in landing.js | ✓ | 1 | ok |

## 2026-04-17T09:18:54.776Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 0 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 0 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 0 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 0 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 1 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 0 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 1 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 0 | ok |

## 2026-04-17T09:18:58.267Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 0 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 0 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 0 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 0 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 0 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 1 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 1 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 0 | ok |

## 2026-04-17T09:19:01.821Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 0 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 1 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 0 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 0 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 0 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 1 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 1 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 0 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✓ | 1 | ok |

## 2026-04-17T09:19:09.234Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 192 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 90 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 17 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T09:19:13.983Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1069 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 1 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 14 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 0 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 12 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 0 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 2 | ok |

## 2026-04-17T09:19:19.276Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1678 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 1 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 12 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 14 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 27 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 14 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T09:19:23.247Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 0 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 87 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 3 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 1 | ok |

## 2026-04-17T09:19:27.080Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 3 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 2 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 2 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 1 | ok |

## 2026-04-17T09:19:30.753Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 10 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 3 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 0 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 1 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 6 | ok |

## 2026-04-17T09:19:34.370Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 1 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 0 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 1 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 0 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 1 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 0 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 1 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 1 | ok |

## 2026-04-17T09:19:37.978Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 0 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.5.0 | ✓ | 0 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.5.0 | ✓ | 1 | ok |
| 5 | r2: download URL references v3.5.0/Aiden-Setup-3.5.0.exe | ✓ | 0 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.5.0" | ✓ | 1 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 0 | ok |
| 8 | r2: exactly 5 occurrences of "3.5.0" in landing.js | ✓ | 0 | ok |

## 2026-04-17T09:19:41.595Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 1 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 0 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 0 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 1 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 0 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 1 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 0 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 0 | ok |

## 2026-04-17T09:19:45.290Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 1 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 0 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 0 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 0 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 1 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 0 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 0 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 0 | ok |

## 2026-04-17T09:19:48.907Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 0 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 0 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 0 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 0 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 0 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 0 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 1 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 1 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✓ | 0 | ok |

## 2026-04-17T09:19:56.662Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 199 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 90 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 17 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T09:20:01.484Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1134 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 1 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 15 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 0 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 11 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 1 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 1 | ok |

## 2026-04-17T09:20:06.860Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1674 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 1 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 10 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 1 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 11 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 25 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 11 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 0 | ok |

## 2026-04-17T09:20:10.606Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 0 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 1 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 74 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 3 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 0 | ok |

## 2026-04-17T09:20:14.324Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 2 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 3 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 2 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 1 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 0 | ok |

## 2026-04-17T09:20:18.005Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 10 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 2 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 1 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 1 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 6 | ok |

## 2026-04-17T09:20:21.738Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 1 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 1 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 0 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 1 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 0 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 1 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 1 | ok |

## 2026-04-17T09:20:25.423Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 0 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.5.0 | ✓ | 0 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.5.0 | ✓ | 1 | ok |
| 5 | r2: download URL references v3.5.0/Aiden-Setup-3.5.0.exe | ✓ | 0 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.5.0" | ✓ | 1 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 0 | ok |
| 8 | r2: exactly 5 occurrences of "3.5.0" in landing.js | ✓ | 1 | ok |

## 2026-04-17T09:20:29.084Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 0 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 1 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 0 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 0 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 0 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 1 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 0 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 0 | ok |

## 2026-04-17T09:20:32.691Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 1 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 0 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 0 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 0 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 0 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 1 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 0 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 0 | ok |

## 2026-04-17T09:20:36.336Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 1 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 1 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 0 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 0 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 0 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 1 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 1 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 0 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✓ | 1 | ok |

## 2026-04-17T09:24:23.723Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 194 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 92 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 0 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 16 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 2 | ok |

## 2026-04-17T09:24:28.445Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1110 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 14 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 1 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 13 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 0 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 2 | ok |

## 2026-04-17T09:24:33.751Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1669 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 12 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 10 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 25 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 11 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 0 | ok |

## 2026-04-17T09:24:37.528Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 0 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 71 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 3 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 1 | ok |

## 2026-04-17T09:24:41.087Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 2 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 3 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 1 | ok |

## 2026-04-17T09:24:44.711Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 11 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 3 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 0 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 1 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 4 | ok |

## 2026-04-17T09:24:48.420Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 1 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 1 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 0 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 1 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 1 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 0 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 1 | ok |

## 2026-04-17T09:24:52.053Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 1 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.5.0 | ✓ | 1 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.5.0 | ✓ | 0 | ok |
| 5 | r2: download URL references v3.5.0/Aiden-Setup-3.5.0.exe | ✓ | 1 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.5.0" | ✓ | 0 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 1 | ok |
| 8 | r2: exactly 5 occurrences of "3.5.0" in landing.js | ✓ | 0 | ok |

## 2026-04-17T09:24:55.828Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 0 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 0 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 0 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 0 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 0 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 0 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 1 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 0 | ok |

## 2026-04-17T09:24:59.445Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 1 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 0 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 0 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 0 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 1 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 0 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 1 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 0 | ok |

## 2026-04-17T09:25:03.210Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 0 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 0 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 0 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 0 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 1 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 0 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 1 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 1 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✓ | 0 | ok |

## 2026-04-17T12:00:00.000Z — 38/38 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p21: all required new files present (voxcpm_runner.py, VOXCPM_SETUP.md) | ✓ | 0 | ok |
| 2 | p21: ToolCategory type includes 'voice' | ✓ | 0 | ok |
| 3 | p21: TOOL_CATEGORIES maps all 4 voice tools | ✓ | 0 | ok |
| 4 | p21: voice_speak implementation present in TOOLS | ✓ | 0 | ok |
| 5 | p21: voice_transcribe implementation present in TOOLS | ✓ | 0 | ok |
| 6 | p21: voice_clone implementation present in TOOLS | ✓ | 0 | ok |
| 7 | p21: voice_design implementation present in TOOLS | ✓ | 0 | ok |
| 8 | p21: TOOL_TIMEOUTS includes voice_speak | ✓ | 0 | ok |
| 9 | p21: TOOL_TIMEOUTS includes voice_transcribe | ✓ | 0 | ok |
| 10 | p21: TOOL_TIMEOUTS includes voice_clone | ✓ | 0 | ok |
| 11 | p21: TOOL_TIMEOUTS includes voice_design | ✓ | 0 | ok |
| 12 | p21: detectToolCategories adds 'voice' for speak/transcribe queries | ✓ | 0 | ok |
| 13 | p21: detectToolCategories voice regex covers speak, transcribe, clone, design | ✓ | 0 | ok |
| 14 | p21: voxcpm_runner.py reads JSON from stdin | ✓ | 0 | ok |
| 15 | p21: voxcpm_runner.py writes JSON to stdout | ✓ | 0 | ok |
| 16 | p21: voxcpm_runner.py handles clone mode | ✓ | 0 | ok |
| 17 | p21: voxcpm_runner.py handles design mode | ✓ | 0 | ok |
| 18 | p21: voxcpm_runner.py handles CUDA OOM gracefully | ✓ | 0 | ok |
| 19 | p21: TtsOptions.provider includes 'voxcpm' | ✓ | 0 | ok |
| 20 | p21: USE_VOXCPM=1 opt-in check present in tts.ts | ✓ | 0 | ok |
| 21 | p21: synthesize() calls synthesizeVoxCPM when enabled | ✓ | 0 | ok |
| 22 | p21: getTtsProviders() returns voxcpm entry | ✓ | 0 | ok |
| 23 | p21: referenceAudioPath and voiceDesignPrompt in TtsOptions | ✓ | 0 | ok |
| 24 | p21: /voice design subcommand present in CLI | ✓ | 0 | ok |
| 25 | p21: /voice clone subcommand present in CLI | ✓ | 0 | ok |
| 26 | p21: /voice reset subcommand present in CLI | ✓ | 0 | ok |
| 27 | p21: /voice providers subcommand present in CLI | ✓ | 0 | ok |
| 28 | p21: voiceDesign state field added to CLI | ✓ | 0 | ok |
| 29 | p21: voiceReferencePath state field added to CLI | ✓ | 0 | ok |
| 30 | p21: aiden.voice.speak() registered in SDK | ✓ | 0 | ok |
| 31 | p21: aiden.voice.clone() registered in SDK | ✓ | 0 | ok |
| 32 | p21: aiden.voice.design() registered in SDK | ✓ | 0 | ok |
| 33 | p21: aiden.voice.reset() registered in SDK | ✓ | 0 | ok |
| 34 | p21: aiden.voice.providers() registered in SDK | ✓ | 0 | ok |
| 35 | p21: VOXCPM_SETUP.md mentions OpenBMB | ✓ | 0 | ok |
| 36 | p21: VOXCPM_SETUP.md mentions Apache 2.0 license | ✓ | 0 | ok |
| 37 | p21: VOXCPM_SETUP.md has arXiv reference | ✓ | 0 | ok |
| 38 | p21: VOXCPM_SETUP.md has USE_VOXCPM=1 opt-in instruction | ✓ | 0 | ok |

## prompt_22 — Install experience

| # | label | pass | ms | status |
|---|-------|------|----|--------|
| 1 | p22: bin/aiden.cmd exists | ✓ | 0 | ok |
| 2 | p22: bin/aiden.cmd delegates to Aiden.exe | ✓ | 0 | ok |
| 3 | p22: bin/aiden (bash) exists | ✓ | 1 | ok |
| 4 | p22: bin/aiden checks WSL_DISTRO_NAME | ✓ | 0 | ok |
| 5 | p22: build/installer.nsh exists | ✓ | 0 | ok |
| 6 | p22: installer.nsh adds bin to HKCU PATH | ✓ | 0 | ok |
| 7 | p22: install.ps1 contains iwr one-liner comment | ✓ | 0 | ok |
| 8 | p22: install.ps1 fetches from taracodlabs/aiden-releases | ✓ | 0 | ok |
| 9 | p22: landing.js has /install.ps1 route | ✓ | 1 | ok |
| 10 | p22: winget manifests present with correct PackageIdentifier | ✓ | 0 | ok |
| 11 | p22: scoop manifest has checkver and bin fields | ✓ | 1 | ok |

2026-04-17T11:19:11.008Z — 11/11 passed

## prompt_23 — Repo split prep

| # | label | pass | ms | status |
|---|-------|------|----|--------|
| 1 | p23: CONTRIBUTING.md exists at repo root | ✓ | 0 | ok |
| 2 | p23: SKILL_TEMPLATE.md has all required sections | ✓ | 1 | ok |
| 3 | p23: .github/CLA.md exists | ✓ | 0 | ok |
| 4 | p23: .github/cla-bot-config.yml exists | ✓ | 0 | ok |
| 5 | p23: every SKILL.md has license field in frontmatter | ✓ | 11 | ok |
| 6 | p23: all SKILL.md license fields are Apache-2.0 | ✓ | 10 | ok |
| 7 | p23: packaging/skills-repo-manifest.md exists | ✓ | 0 | ok |
| 8 | p23: SKILL_TEMPLATE.md frontmatter has name/description/license/origin | ✓ | 0 | ok |
| 9 | p23: CONTRIBUTING.md references Apache-2.0 and CLA | ✓ | 1 | ok |
| 10 | p23: all SKILL.md origin values are aiden/community/local (or absent) | ✓ | 10 | ok |

2026-04-17T11:26:37.109Z — 10/10 passed

## 2026-04-17T11:28:48.330Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 305 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 194 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 32 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 2 | ok |

## 2026-04-17T11:28:54.790Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1516 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 16 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 1 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 14 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 1 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 4 | ok |

## 2026-04-17T11:29:01.122Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 2073 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 1 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 14 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 1 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 22 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 34 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 11 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T11:29:05.071Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 2 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 75 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 4 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 1 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 1 | ok |

## 2026-04-17T11:29:08.913Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 3 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 3 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 1 | ok |

## 2026-04-17T11:29:13.057Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 12 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 4 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 1 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 1 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 15 | ok |

## 2026-04-17T11:29:17.723Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 1 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 0 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 0 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 1 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 0 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 1 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 2 | ok |

## 2026-04-17T11:29:22.210Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 0 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.5.0 | ✓ | 0 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.5.0 | ✓ | 1 | ok |
| 5 | r2: download URL references v3.5.0/Aiden-Setup-3.5.0.exe | ✓ | 0 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.5.0" | ✓ | 0 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 1 | ok |
| 8 | r2: exactly 5 occurrences of "3.5.0" in landing.js | ✓ | 0 | ok |

## 2026-04-17T11:29:26.499Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 0 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 0 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 3 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 0 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 0 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 1 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 0 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 1 | ok |

## 2026-04-17T11:29:31.193Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 1 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 0 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 0 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 0 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 0 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 1 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 1 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 1 | ok |

## 2026-04-17T11:29:35.411Z — 9/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 0 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 1 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 0 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 0 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 1 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 0 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 0 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 2 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 1 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✗ | 0 | aidenSdk.ts must wire voice.synthesize() |

## 2026-04-17T11:29:47.245Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 273 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 1 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 140 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 28 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 2 | ok |

## 2026-04-17T11:29:52.645Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1384 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 18 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 1 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 16 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 1 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 2 | ok |

## 2026-04-17T11:29:58.861Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 2063 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 1 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 17 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 1 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 23 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 30 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 13 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T11:30:02.945Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 0 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 78 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 3 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 1 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 0 | ok |

## 2026-04-17T11:30:07.147Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 3 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 4 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 1 | ok |

## 2026-04-17T11:30:10.996Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 10 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 3 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 0 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 1 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 11 | ok |

## 2026-04-17T11:30:14.759Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 1 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 0 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 1 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 0 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 0 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 1 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 1 | ok |

## 2026-04-17T11:30:18.588Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 0 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.5.0 | ✓ | 0 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.5.0 | ✓ | 1 | ok |
| 5 | r2: download URL references v3.5.0/Aiden-Setup-3.5.0.exe | ✓ | 0 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.5.0" | ✓ | 1 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 1 | ok |
| 8 | r2: exactly 5 occurrences of "3.5.0" in landing.js | ✓ | 1 | ok |

## 2026-04-17T11:30:22.434Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 1 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 0 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 0 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 0 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 1 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 0 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 1 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 0 | ok |

## 2026-04-17T11:30:26.378Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 0 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 0 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 1 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 0 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 0 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 1 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 1 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 0 | ok |

## 2026-04-17T11:30:31.276Z — 9/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 0 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 0 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 0 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 1 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 0 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 1 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 2 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 1 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✗ | 0 | aidenSdk.ts must wire voice.synthesize() |

## 2026-04-17T11:30:41.347Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 263 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 127 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 0 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 21 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T11:30:46.764Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1384 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 1 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 17 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 0 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 14 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 1 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 1 | ok |

## 2026-04-17T11:30:52.865Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 2104 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 1 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 14 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 14 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 40 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 13 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 0 | ok |

## 2026-04-17T11:30:57.526Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 0 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 77 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 5 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 0 | ok |

## 2026-04-17T11:31:02.019Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 3 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 4 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 3 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 3 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 2 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 1 | ok |

## 2026-04-17T11:31:07.179Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 15 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 2 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 0 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 1 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 15 | ok |

## 2026-04-17T11:31:12.391Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 1 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 0 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 0 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 1 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 1 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 2 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 2 | ok |

## 2026-04-17T11:31:16.860Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 0 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.5.0 | ✓ | 1 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.5.0 | ✓ | 0 | ok |
| 5 | r2: download URL references v3.5.0/Aiden-Setup-3.5.0.exe | ✓ | 1 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.5.0" | ✓ | 0 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 1 | ok |
| 8 | r2: exactly 5 occurrences of "3.5.0" in landing.js | ✓ | 1 | ok |

## 2026-04-17T11:31:21.159Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 1 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 0 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 1 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 0 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 1 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 1 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 0 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 0 | ok |

## 2026-04-17T11:31:25.564Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 0 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 0 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 0 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 0 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 0 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 1 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 1 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 0 | ok |

## 2026-04-17T11:31:30.179Z — 9/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 1 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 0 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 0 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 1 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 0 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 0 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 1 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 1 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✗ | 1 | aidenSdk.ts must wire voice.synthesize() |

## 2026-04-17T11:31:36.245Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 273 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 135 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 0 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 28 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 2 | ok |

## 2026-04-17T11:31:42.101Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1619 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 1 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 18 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 2 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 18 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 0 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 1 | ok |

## 2026-04-17T11:31:48.644Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 2116 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 1 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 14 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 1 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 24 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 37 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 14 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T11:31:53.360Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 0 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 86 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 4 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 1 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 0 | ok |

## 2026-04-17T11:31:57.684Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 4 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 3 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 3 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 1 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 0 | ok |

## 2026-04-17T11:32:02.173Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 14 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 3 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 0 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 1 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 15 | ok |

## 2026-04-17T11:32:06.555Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 1 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 0 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 1 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 0 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 0 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 2 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 5 | ok |

## 2026-04-17T11:32:11.190Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 0 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.5.0 | ✓ | 0 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.5.0 | ✓ | 0 | ok |
| 5 | r2: download URL references v3.5.0/Aiden-Setup-3.5.0.exe | ✓ | 1 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.5.0" | ✓ | 1 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 2 | ok |
| 8 | r2: exactly 5 occurrences of "3.5.0" in landing.js | ✓ | 1 | ok |

## 2026-04-17T11:32:15.161Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 0 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 1 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 0 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 0 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 0 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 1 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 0 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 0 | ok |

## 2026-04-17T11:32:19.215Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 0 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 0 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 0 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 0 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 1 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 0 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 0 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 1 | ok |

## 2026-04-17T11:32:23.227Z — 9/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 1 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 1 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 0 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 1 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 0 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 0 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 1 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 1 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✗ | 1 | aidenSdk.ts must wire voice.synthesize() |

## 2026-04-17T11:44:20.912Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 1 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 0 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 1 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 0 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 0 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 0 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 1 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 0 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✓ | 0 | ok |

## 2026-04-17T11:49:30.078Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 198 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 120 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 29 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 2 | ok |

## 2026-04-17T11:49:35.599Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1247 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 1 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 16 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 1 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 13 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 1 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 1 | ok |

## 2026-04-17T11:49:41.148Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1656 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 12 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 1 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 10 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 33 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 10 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T11:49:45.206Z — 7/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.5.0" | ✗ | 1 | package.json version must be "3.5.0", got "3.6.0" |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 0 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 74 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 4 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 1 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 1 | ok |

## 2026-04-17T11:50:25.354Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 202 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 1 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 97 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 16 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 2 | ok |

## 2026-04-17T11:50:30.288Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1154 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 15 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 1 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 12 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 1 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 1 | ok |

## 2026-04-17T11:50:35.723Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1620 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 1 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 12 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 20 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 26 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 11 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T11:50:39.643Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.6.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 0 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 73 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 3 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 1 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 1 | ok |

## 2026-04-17T11:50:43.463Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 3 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 3 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 0 | ok |

## 2026-04-17T11:50:47.307Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 11 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 3 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 1 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 0 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 12 | ok |

## 2026-04-17T11:50:51.290Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 1 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 0 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 1 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 0 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 1 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 0 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 1 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 1 | ok |

## 2026-04-17T11:50:55.156Z — 3/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 0 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.5.0 | ✗ | 1 | Nav badge must read "v3.5.0 · free to download" |
| 4 | r2: hero "JUST UPDATED" badge shows v3.5.0 | ✗ | 1 | Hero badge must read "JUST UPDATED — v3.5.0" |
| 5 | r2: download URL references v3.5.0/Aiden-Setup-3.5.0.exe | ✗ | 1 | Download href must point to v3.5.0/Aiden-Setup-3.5.0.exe |
| 6 | r2: download section h2 reads "Download Aiden v3.5.0" | ✗ | 0 | Download h2 must reference v3.5.0 |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 0 | ok |
| 8 | r2: exactly 5 occurrences of "3.5.0" in landing.js | ✗ | 1 | Expected exactly 5 occurrences of 3.5.0, found 0 |

## 2026-04-17T11:51:17.158Z — 7/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 1 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.6.0 | ✓ | 0 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.6.0 | ✓ | 1 | ok |
| 5 | r2: download URL references v3.6.0/Aiden-Setup-3.6.0.exe | ✓ | 0 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.6.0" | ✓ | 0 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 1 | ok |
| 8 | r2: exactly 5 occurrences of "3.6.0" in landing.js | ✗ | 1 | Expected exactly 5 occurrences of 3.6.0, found 0 |

## 2026-04-17T11:52:09.153Z — 7/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 0 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 0 | ok |
| 3 | r2: nav badge contains v3.6.0 | ✓ | 1 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.6.0 | ✓ | 0 | ok |
| 5 | r2: download URL references v3.6.0/Aiden-Setup-3.6.0.exe | ✓ | 1 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.6.0" | ✓ | 0 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 1 | ok |
| 8 | r2: exactly 5 occurrences of "3.6.0" in landing.js | ✗ | 1 | Expected exactly 5 occurrences of 3.6.0, found 0 |

## 2026-04-17T11:52:39.603Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 0 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.6.0 | ✓ | 0 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.6.0 | ✓ | 1 | ok |
| 5 | r2: download URL references v3.6.0/Aiden-Setup-3.6.0.exe | ✓ | 0 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.6.0" | ✓ | 1 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 1 | ok |
| 8 | r2: exactly 5 occurrences of "3.6.0" in landing.js | ✓ | 1 | ok |

## 2026-04-17T11:52:48.491Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 239 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 124 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 0 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 23 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T11:52:54.047Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1425 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 17 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 1 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 15 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 0 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 2 | ok |

## 2026-04-17T11:53:00.128Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 2023 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 1 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 21 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 14 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 41 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 13 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 0 | ok |

## 2026-04-17T11:53:04.187Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.6.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 1 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 74 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 4 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 1 | ok |

## 2026-04-17T11:53:08.058Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 2 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 3 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 4 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 0 | ok |

## 2026-04-17T11:53:11.938Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 11 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 2 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 1 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 0 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 11 | ok |

## 2026-04-17T11:53:15.921Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 0 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 1 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 1 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 1 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 0 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 0 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 2 | ok |

## 2026-04-17T11:53:19.748Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 0 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.6.0 | ✓ | 0 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.6.0 | ✓ | 0 | ok |
| 5 | r2: download URL references v3.6.0/Aiden-Setup-3.6.0.exe | ✓ | 0 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.6.0" | ✓ | 0 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 0 | ok |
| 8 | r2: exactly 5 occurrences of "3.6.0" in landing.js | ✓ | 1 | ok |

## 2026-04-17T11:53:23.710Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 1 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 0 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 0 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 1 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 0 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 1 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 0 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 0 | ok |

## 2026-04-17T11:53:27.656Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 0 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 0 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 0 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 1 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 0 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 1 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 1 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 0 | ok |

## 2026-04-17T11:53:31.665Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 1 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 0 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 1 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 0 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 0 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 1 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 1 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 1 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✓ | 0 | ok |

## 2026-04-17T11:57:24.281Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 223 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 115 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 21 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 1 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T11:57:29.992Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1189 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 1 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 15 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 1 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 13 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 0 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 1 | ok |

## 2026-04-17T11:57:36.132Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1819 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 1 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 13 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 1 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 11 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 38 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 12 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 0 | ok |

## 2026-04-17T11:57:40.524Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.6.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 1 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 83 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 5 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 0 | ok |

## 2026-04-17T11:57:45.126Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 3 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 2 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 2 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 3 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 1 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 0 | ok |

## 2026-04-17T11:57:49.405Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 11 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 3 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 0 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 1 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 12 | ok |

## 2026-04-17T11:57:53.403Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 1 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 0 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 1 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 0 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 1 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 1 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 2 | ok |

## 2026-04-17T11:57:57.411Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 0 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.6.0 | ✓ | 1 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.6.0 | ✓ | 0 | ok |
| 5 | r2: download URL references v3.6.0/Aiden-Setup-3.6.0.exe | ✓ | 1 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.6.0" | ✓ | 0 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 1 | ok |
| 8 | r2: exactly 5 occurrences of "3.6.0" in landing.js | ✓ | 0 | ok |

## 2026-04-17T11:58:01.421Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 1 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 0 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 1 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 0 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 0 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 1 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 0 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 0 | ok |

## 2026-04-17T11:58:05.397Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 0 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 0 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 0 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 0 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 0 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 1 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 1 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 0 | ok |

## 2026-04-17T11:58:09.425Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 1 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 0 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 1 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 0 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 0 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 0 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 1 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 0 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✓ | 1 | ok |

## 2026-04-17T13:18:02.832Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 249 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 131 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 22 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 2 | ok |

## 2026-04-17T13:18:08.487Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1519 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 16 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 1 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 15 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 0 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 1 | ok |

## 2026-04-17T13:18:14.733Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 2035 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 1 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 16 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 23 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 34 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 14 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T13:18:18.936Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.6.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 1 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 72 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 3 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 1 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 0 | ok |

## 2026-04-17T13:18:22.838Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 3 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 5 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 2 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 2 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 2 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 1 | ok |

## 2026-04-17T13:18:27.887Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 14 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 2 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 1 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 1 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 13 | ok |

## 2026-04-17T13:18:32.116Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 1 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 1 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 1 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 0 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 1 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 1 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 1 | ok |

## 2026-04-17T13:18:36.083Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 1 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.6.0 | ✓ | 0 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.6.0 | ✓ | 0 | ok |
| 5 | r2: download URL references v3.6.0/Aiden-Setup-3.6.0.exe | ✓ | 0 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.6.0" | ✓ | 0 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 1 | ok |
| 8 | r2: exactly 5 occurrences of "3.6.0" in landing.js | ✓ | 0 | ok |

## 2026-04-17T13:18:39.753Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 0 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 0 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 1 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 0 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 0 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 1 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 0 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 1 | ok |

## 2026-04-17T13:18:43.490Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 1 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 0 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 0 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 0 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 1 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 0 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 0 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 1 | ok |

## 2026-04-17T13:18:48.025Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 1 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 0 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 0 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 1 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 0 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 0 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 1 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 2 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✓ | 1 | ok |

## 2026-04-17T13:19:19.085Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 213 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 121 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 0 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 21 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 1 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T13:19:24.375Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1462 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 18 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 1 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 12 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 1 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 2 | ok |

## 2026-04-17T13:19:30.109Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1947 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 1 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 13 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 1 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 13 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 43 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 12 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T13:19:34.110Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.6.0" | ✓ | 0 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 1 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 72 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 3 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 1 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 1 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 0 | ok |

## 2026-04-17T13:19:37.806Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 3 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 2 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 2 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 1 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 0 | ok |

## 2026-04-17T13:19:41.524Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 11 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 2 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 1 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 0 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 11 | ok |

## 2026-04-17T13:19:45.205Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 1 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 0 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 1 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 0 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 1 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 1 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 1 | ok |

## 2026-04-17T13:19:48.968Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 1 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 0 | ok |
| 3 | r2: nav badge contains v3.6.0 | ✓ | 0 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.6.0 | ✓ | 1 | ok |
| 5 | r2: download URL references v3.6.0/Aiden-Setup-3.6.0.exe | ✓ | 0 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.6.0" | ✓ | 1 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 0 | ok |
| 8 | r2: exactly 5 occurrences of "3.6.0" in landing.js | ✓ | 1 | ok |

## 2026-04-17T13:19:52.701Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 1 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 0 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 0 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 0 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 0 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 1 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 0 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 0 | ok |

## 2026-04-17T13:19:56.414Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 1 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 0 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 0 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 0 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 1 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 0 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 1 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 0 | ok |

## 2026-04-17T13:20:00.130Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 0 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 1 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 0 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 0 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 0 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 1 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 1 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 1 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✓ | 0 | ok |

## 2026-04-17T13:20:44.555Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 215 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 118 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 0 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 22 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 2 | ok |

## 2026-04-17T13:20:49.989Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1500 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 1 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 31 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 1 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 30 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 0 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 2 | ok |

## 2026-04-17T13:20:56.119Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 2174 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 17 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 1 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 13 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 40 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 13 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T13:21:00.438Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.6.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 0 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 79 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 3 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 1 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 1 | ok |

## 2026-04-17T13:21:04.643Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 3 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 3 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 3 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 1 | ok |

## 2026-04-17T13:21:09.148Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 13 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 3 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 0 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 1 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 13 | ok |

## 2026-04-17T13:21:13.048Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 1 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 1 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 0 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 1 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 1 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 0 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 1 | ok |

## 2026-04-17T13:21:16.912Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 1 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 0 | ok |
| 3 | r2: nav badge contains v3.6.0 | ✓ | 0 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.6.0 | ✓ | 1 | ok |
| 5 | r2: download URL references v3.6.0/Aiden-Setup-3.6.0.exe | ✓ | 0 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.6.0" | ✓ | 1 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 0 | ok |
| 8 | r2: exactly 5 occurrences of "3.6.0" in landing.js | ✓ | 1 | ok |

## 2026-04-17T13:21:20.929Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 2 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 0 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 1 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 0 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 1 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 5 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 1 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 0 | ok |

## 2026-04-17T13:21:24.864Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 1 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 0 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 1 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 0 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 0 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 1 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 1 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 0 | ok |

## 2026-04-17T13:21:28.659Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 1 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 0 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 0 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 1 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 0 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 0 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 1 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 2 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✓ | 0 | ok |

## prompt_release_v3_6 — v3.6.0 release integrity

| # | label | pass | ms | status |
|---|-------|------|----|--------|
| 1 | rv36: CHANGELOG.md has v3.6.0 header and Scale positioning | ✓ | 1 | ok |
| 2 | rv36: release/Aiden-Setup-3.6.0.exe exists and is > 100 MB | ✓ | 0 | ok |
| 3 | rv36: installer.nsh includes WinMessages.nsh and uses nsExec for uninstall | ✓ | 0 | ok |
| 4 | rv36: core/mcpClient.ts exists (native MCP client feature) | ✓ | 0 | ok |
| 5 | rv36: exactly 56 SKILL.md files exist under skills/ | ✓ | 5 | ok |
| 6 | rv36: local git tag v3.6.0 exists | ✓ | 70 | ok |
| 7 | rv36: package.json version === "3.6.0" | ✓ | 0 | ok |

2026-04-17T13:23:34.244Z — 7/7 passed

## 2026-04-17T13:23:43.473Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 228 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 119 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 20 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 1 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T13:23:48.800Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1365 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 19 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 0 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 15 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 1 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 1 | ok |

## 2026-04-17T13:23:54.690Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1965 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 1 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 14 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 11 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 39 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 12 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T13:23:58.570Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.6.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 0 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 69 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 2 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 1 | ok |

## 2026-04-17T13:24:02.584Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 3 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 3 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 3 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 1 | ok |

## 2026-04-17T13:24:06.413Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 11 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 2 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 1 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 0 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 12 | ok |

## 2026-04-17T13:24:10.655Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 1 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 0 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 1 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 0 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 1 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 0 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 1 | ok |

## 2026-04-17T13:24:14.746Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 0 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.6.0 | ✓ | 1 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.6.0 | ✓ | 1 | ok |
| 5 | r2: download URL references v3.6.0/Aiden-Setup-3.6.0.exe | ✓ | 2 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.6.0" | ✓ | 1 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 1 | ok |
| 8 | r2: exactly 5 occurrences of "3.6.0" in landing.js | ✓ | 0 | ok |

## 2026-04-17T13:24:18.581Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 1 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 0 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 0 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 0 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 1 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 0 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 0 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 0 | ok |

## 2026-04-17T13:24:22.497Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 0 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 0 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 1 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 0 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 0 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 1 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 1 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 0 | ok |

## 2026-04-17T13:24:26.264Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 1 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 0 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 1 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 0 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 0 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 0 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 1 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 1 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✓ | 1 | ok |

## 2026-04-17T17:47:42.780Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | timer: cli/aiden.ts renderActivity() shows elapsed seconds | ✓ | 1 | ok |
| 2 | timer: cli/aiden.ts status bar passes startedAt-based elapsedMs | ✓ | 1 | ok |
| 3 | timer: cli/aiden.ts printBanner reads version from package.json | ✓ | 1 | ok |
| 4 | timer: electron/preload.js has no hardcoded 3.5.0 | ✓ | 1 | ok |
| 5 | timer: cloudflare-worker/license-server.js has no 3.5.0 references | ✓ | 1 | ok |
| 6 | timer: index.ts startup log fallback is not 3.5.0 | ✓ | 0 | ok |
| 7 | timer: core/skillTeacher.ts min size gate is 200 bytes | ✓ | 0 | ok |
| 8 | timer: core/skillTeacher.ts has SESSION_SKILL_LIMIT = 2 | ✓ | 1 | ok |
| 9 | timer: core/skillTeacher.ts dedup includes BUNDLED_SKILLS_DIR | ✓ | 0 | ok |
| 10 | timer: workspace/skills/learned/ and approved/ are empty | ✓ | 1 | ok |

## 2026-04-17T18:08:20.591Z — 10/11 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | speed: isSimpleMessage("hi") returns true | ✓ | 0 | ok |
| 2 | speed: isSimpleMessage rejects messages with tool keywords | ✓ | 1 | ok |
| 3 | speed: isSimpleMessage rejects messages containing URLs or file paths | ✗ | 0 | isSimpleMessage must block https:// URLs |
| 4 | speed: findRelevant scores by category field (CATEGORY_KEYWORD_MAP) | ✓ | 0 | ok |
| 5 | speed: findRelevant returns [] when isSimpleMessage is true | ✓ | 0 | ok |
| 6 | speed: needsMemory returns false for routine messages | ✓ | 0 | ok |
| 7 | speed: needsMemory returns true for past-context references | ✓ | 0 | ok |
| 8 | speed: router reads and writes primaryProvider via loadConfig/saveConfig | ✓ | 1 | ok |
| 9 | speed: markRateLimited auto-unpins primaryProvider after 3 failures | ✓ | 0 | ok |
| 10 | speed: agentLoop capabilitiesSection is empty for simple messages | ✓ | 1 | ok |
| 11 | speed: agentLoop always injects LESSONS section (not gated) | ✓ | 1 | ok |

## 2026-04-17T18:08:39.777Z — 10/11 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | speed: isSimpleMessage("hi") returns true | ✓ | 1 | ok |
| 2 | speed: isSimpleMessage rejects messages with tool keywords | ✓ | 0 | ok |
| 3 | speed: isSimpleMessage rejects messages containing URLs or file paths | ✗ | 1 | isSimpleMessage must block file-path separators (backslash / forward-slash) |
| 4 | speed: findRelevant scores by category field (CATEGORY_KEYWORD_MAP) | ✓ | 0 | ok |
| 5 | speed: findRelevant returns [] when isSimpleMessage is true | ✓ | 0 | ok |
| 6 | speed: needsMemory returns false for routine messages | ✓ | 0 | ok |
| 7 | speed: needsMemory returns true for past-context references | ✓ | 0 | ok |
| 8 | speed: router reads and writes primaryProvider via loadConfig/saveConfig | ✓ | 1 | ok |
| 9 | speed: markRateLimited auto-unpins primaryProvider after 3 failures | ✓ | 0 | ok |
| 10 | speed: agentLoop capabilitiesSection is empty for simple messages | ✓ | 1 | ok |
| 11 | speed: agentLoop always injects LESSONS section (not gated) | ✓ | 1 | ok |

## 2026-04-17T18:09:19.637Z — 11/11 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | speed: isSimpleMessage("hi") returns true | ✓ | 0 | ok |
| 2 | speed: isSimpleMessage rejects messages with tool keywords | ✓ | 0 | ok |
| 3 | speed: isSimpleMessage rejects messages containing URLs or file paths | ✓ | 1 | ok |
| 4 | speed: findRelevant scores by category field (CATEGORY_KEYWORD_MAP) | ✓ | 0 | ok |
| 5 | speed: findRelevant returns [] when isSimpleMessage is true | ✓ | 0 | ok |
| 6 | speed: needsMemory returns false for routine messages | ✓ | 0 | ok |
| 7 | speed: needsMemory returns true for past-context references | ✓ | 0 | ok |
| 8 | speed: router reads and writes primaryProvider via loadConfig/saveConfig | ✓ | 1 | ok |
| 9 | speed: markRateLimited auto-unpins primaryProvider after 3 failures | ✓ | 0 | ok |
| 10 | speed: agentLoop capabilitiesSection is empty for simple messages | ✓ | 0 | ok |
| 11 | speed: agentLoop always injects LESSONS section (not gated) | ✓ | 0 | ok |

## 2026-04-17T18:09:29.987Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 218 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 1025 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 18 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T18:09:38.095Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 3549 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 1 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 16 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 0 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 13 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 1 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 85 | ok |

## 2026-04-17T18:09:45.492Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 2637 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 1 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 24 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 1 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 14 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 149 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 10 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T18:09:49.820Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.6.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 13 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 74 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 47 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 1 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 0 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 1 | ok |

## 2026-04-17T18:09:53.928Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 3 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 2 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 2 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 17 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 0 | ok |

## 2026-04-17T18:09:57.961Z — 4/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 1 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 1 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 1 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✗ | 0 | must reject content < 50 bytes |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 12 | ok |

## 2026-04-17T18:10:20.153Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 208 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 101 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 0 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 17 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-17T18:10:25.514Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1311 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 1 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 15 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 1 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 13 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 0 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 2 | ok |

## 2026-04-17T18:10:31.619Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 1813 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 1 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 11 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 1 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 22 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 28 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 11 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 1 | ok |

## 2026-04-17T18:10:36.488Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.6.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 1 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 85 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 3 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 1 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 0 | ok |

## 2026-04-17T18:10:40.917Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 2 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 3 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 3 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 4 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 3 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 0 | ok |

## 2026-04-17T18:10:45.165Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 0 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 1 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 0 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 1 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 13 | ok |

## 2026-04-17T18:10:49.268Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 1 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 0 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 1 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 0 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 1 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 0 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 1 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 1 | ok |

## 2026-04-17T18:10:53.427Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 1 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 87 | ok |
| 3 | r2: nav badge contains v3.6.0 | ✓ | 1 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.6.0 | ✓ | 1 | ok |
| 5 | r2: download URL references v3.6.0/Aiden-Setup-3.6.0.exe | ✓ | 0 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.6.0" | ✓ | 1 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 2 | ok |
| 8 | r2: exactly 5 occurrences of "3.6.0" in landing.js | ✓ | 2 | ok |

## 2026-04-17T18:10:57.742Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 1 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 0 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 25 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 0 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 1 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 1 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 1 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 0 | ok |

## 2026-04-17T18:11:01.973Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 0 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 0 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 0 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 0 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 1 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 1 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 0 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 1 | ok |

## 2026-04-17T18:11:06.184Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 1 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 1 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 0 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 0 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 0 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 1 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 1 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 1 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✓ | 0 | ok |

## 2026-04-17T18:11:38.368Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | timer: cli/aiden.ts renderActivity() shows elapsed seconds | ✓ | 1 | ok |
| 2 | timer: cli/aiden.ts status bar passes startedAt-based elapsedMs | ✓ | 1 | ok |
| 3 | timer: cli/aiden.ts printBanner reads version from package.json | ✓ | 1 | ok |
| 4 | timer: electron/preload.js has no hardcoded 3.5.0 | ✓ | 0 | ok |
| 5 | timer: cloudflare-worker/license-server.js has no 3.5.0 references | ✓ | 1 | ok |
| 6 | timer: index.ts startup log fallback is not 3.5.0 | ✓ | 0 | ok |
| 7 | timer: core/skillTeacher.ts min size gate is 200 bytes | ✓ | 0 | ok |
| 8 | timer: core/skillTeacher.ts has SESSION_SKILL_LIMIT = 2 | ✓ | 1 | ok |
| 9 | timer: core/skillTeacher.ts dedup includes BUNDLED_SKILLS_DIR | ✓ | 0 | ok |
| 10 | timer: workspace/skills/learned/ and approved/ are empty | ✓ | 0 | ok |

## 2026-04-17T18:11:42.210Z — 11/11 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | speed: isSimpleMessage("hi") returns true | ✓ | 0 | ok |
| 2 | speed: isSimpleMessage rejects messages with tool keywords | ✓ | 0 | ok |
| 3 | speed: isSimpleMessage rejects messages containing URLs or file paths | ✓ | 1 | ok |
| 4 | speed: findRelevant scores by category field (CATEGORY_KEYWORD_MAP) | ✓ | 0 | ok |
| 5 | speed: findRelevant returns [] when isSimpleMessage is true | ✓ | 0 | ok |
| 6 | speed: needsMemory returns false for routine messages | ✓ | 0 | ok |
| 7 | speed: needsMemory returns true for past-context references | ✓ | 1 | ok |
| 8 | speed: router reads and writes primaryProvider via loadConfig/saveConfig | ✓ | 0 | ok |
| 9 | speed: markRateLimited auto-unpins primaryProvider after 3 failures | ✓ | 0 | ok |
| 10 | speed: agentLoop capabilitiesSection is empty for simple messages | ✓ | 0 | ok |
| 11 | speed: agentLoop always injects LESSONS section (not gated) | ✓ | 1 | ok |

## 2026-04-18T05:39:50.181Z — 9/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | provider: raceProviders has pin-first check for primaryProvider | ✓ | 2 | ok |
| 2 | provider: raceProviders calls fetchProviderResponse on pin, skips racing | ✓ | 1 | ok |
| 3 | provider: raceProviders falls back to race on pin failure | ✓ | 1 | ok |
| 4 | provider: fetchProviderResponse returns { text, apiName, model } | ✓ | 1 | ok |
| 5 | provider: streamChat emits meta event after raceProviders succeeds | ✓ | 1 | ok |
| 6 | provider: streamChat emits meta event in sequential (non-race) path | ✓ | 1 | ok |
| 7 | provider: CLI SSE loop handles evt.event === "meta" | ✓ | 1 | ok |
| 8 | provider: /primary list fetches /api/providers/state | ✓ | 1 | ok |
| 9 | provider: /primary <unknown> errors without mutation | ✗ | 1 | validation must appear before POST in /primary handler |
| 10 | provider: /api/providers/state marks isPrimary correctly | ✓ | 1 | ok |

## 2026-04-18T05:40:12.136Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | provider: raceProviders has pin-first check for primaryProvider | ✓ | 1 | ok |
| 2 | provider: raceProviders calls fetchProviderResponse on pin, skips racing | ✓ | 1 | ok |
| 3 | provider: raceProviders falls back to race on pin failure | ✓ | 1 | ok |
| 4 | provider: fetchProviderResponse returns { text, apiName, model } | ✓ | 1 | ok |
| 5 | provider: streamChat emits meta event after raceProviders succeeds | ✓ | 0 | ok |
| 6 | provider: streamChat emits meta event in sequential (non-race) path | ✓ | 0 | ok |
| 7 | provider: CLI SSE loop handles evt.event === "meta" | ✓ | 1 | ok |
| 8 | provider: /primary list fetches /api/providers/state | ✓ | 1 | ok |
| 9 | provider: /primary <unknown> errors without mutation | ✓ | 0 | ok |
| 10 | provider: /api/providers/state marks isPrimary correctly | ✓ | 1 | ok |

## 2026-04-18T05:40:30.979Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 237 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 1 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 115 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 19 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-18T05:40:36.150Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1334 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 0 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 1 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 17 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 0 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 15 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 0 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 37 | ok |

## 2026-04-18T05:40:42.080Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 2012 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 0 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 1 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 13 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 21 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 57 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 12 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 0 | ok |

## 2026-04-18T05:40:45.885Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.6.0" | ✓ | 1 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 2 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 58 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 23 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 1 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 0 | ok |

## 2026-04-18T05:40:49.648Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 3 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 3 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 2 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 2 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 2 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 2 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 0 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 0 | ok |

## 2026-04-18T05:40:53.391Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 1 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 0 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 1 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 0 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 13 | ok |

## 2026-04-18T05:40:57.170Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 0 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 0 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 0 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 1 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 0 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 1 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 2 | ok |

## 2026-04-18T05:41:00.969Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 2 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.6.0 | ✓ | 0 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.6.0 | ✓ | 1 | ok |
| 5 | r2: download URL references v3.6.0/Aiden-Setup-3.6.0.exe | ✓ | 1 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.6.0" | ✓ | 0 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 1 | ok |
| 8 | r2: exactly 5 occurrences of "3.6.0" in landing.js | ✓ | 2 | ok |

## 2026-04-18T05:41:05.467Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 1 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 0 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 34 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 0 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 0 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 1 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 0 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 0 | ok |

## 2026-04-18T05:41:10.152Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 0 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 0 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 0 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 1 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 0 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 1 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 1 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 0 | ok |

## 2026-04-18T05:41:14.510Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 1 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 1 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 0 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 0 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 1 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 0 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 1 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 1 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✓ | 1 | ok |

## 2026-04-18T05:41:47.692Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | timer: cli/aiden.ts renderActivity() shows elapsed seconds | ✓ | 2 | ok |
| 2 | timer: cli/aiden.ts status bar passes startedAt-based elapsedMs | ✓ | 1 | ok |
| 3 | timer: cli/aiden.ts printBanner reads version from package.json | ✓ | 1 | ok |
| 4 | timer: electron/preload.js has no hardcoded 3.5.0 | ✓ | 0 | ok |
| 5 | timer: cloudflare-worker/license-server.js has no 3.5.0 references | ✓ | 0 | ok |
| 6 | timer: index.ts startup log fallback is not 3.5.0 | ✓ | 0 | ok |
| 7 | timer: core/skillTeacher.ts min size gate is 200 bytes | ✓ | 0 | ok |
| 8 | timer: core/skillTeacher.ts has SESSION_SKILL_LIMIT = 2 | ✓ | 1 | ok |
| 9 | timer: core/skillTeacher.ts dedup includes BUNDLED_SKILLS_DIR | ✓ | 0 | ok |
| 10 | timer: workspace/skills/learned/ and approved/ are empty | ✓ | 0 | ok |

## 2026-04-18T05:41:51.816Z — 11/11 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | speed: isSimpleMessage("hi") returns true | ✓ | 3 | ok |
| 2 | speed: isSimpleMessage rejects messages with tool keywords | ✓ | 1 | ok |
| 3 | speed: isSimpleMessage rejects messages containing URLs or file paths | ✓ | 1 | ok |
| 4 | speed: findRelevant scores by category field (CATEGORY_KEYWORD_MAP) | ✓ | 1 | ok |
| 5 | speed: findRelevant returns [] when isSimpleMessage is true | ✓ | 0 | ok |
| 6 | speed: needsMemory returns false for routine messages | ✓ | 1 | ok |
| 7 | speed: needsMemory returns true for past-context references | ✓ | 1 | ok |
| 8 | speed: router reads and writes primaryProvider via loadConfig/saveConfig | ✓ | 1 | ok |
| 9 | speed: markRateLimited auto-unpins primaryProvider after 3 failures | ✓ | 0 | ok |
| 10 | speed: agentLoop capabilitiesSection is empty for simple messages | ✓ | 2 | ok |
| 11 | speed: agentLoop always injects LESSONS section (not gated) | ✓ | 1 | ok |

## 2026-04-18T05:41:56.085Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | provider: raceProviders has pin-first check for primaryProvider | ✓ | 2 | ok |
| 2 | provider: raceProviders calls fetchProviderResponse on pin, skips racing | ✓ | 1 | ok |
| 3 | provider: raceProviders falls back to race on pin failure | ✓ | 1 | ok |
| 4 | provider: fetchProviderResponse returns { text, apiName, model } | ✓ | 1 | ok |
| 5 | provider: streamChat emits meta event after raceProviders succeeds | ✓ | 1 | ok |
| 6 | provider: streamChat emits meta event in sequential (non-race) path | ✓ | 1 | ok |
| 7 | provider: CLI SSE loop handles evt.event === "meta" | ✓ | 1 | ok |
| 8 | provider: /primary list fetches /api/providers/state | ✓ | 1 | ok |
| 9 | provider: /primary <unknown> errors without mutation | ✓ | 1 | ok |
| 10 | provider: /api/providers/state marks isPrimary correctly | ✓ | 1 | ok |

## 2026-04-18T05:42:04.834Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | panel(): no-title top/bottom border equals body row width | ✓ | 235 | ok |
| 2 | panel(): titled top border equals body row width | ✓ | 0 | ok |
| 3 | panel(): minimum outer width is 50 chars | ✓ | 0 | ok |
| 4 | Skill interface: origin field present on parsed skills | ✓ | 117 | ok |
| 5 | SkillLoader: origin inferred as aiden vs local from filePath | ✓ | 1 | ok |
| 6 | parseLessons(): returns [] safely when LESSONS.md absent | ✓ | 19 | ok |
| 7 | filterLessons(): keyword filter returns correct subset | ✓ | 0 | ok |
| 8 | COMMAND_DETAIL: no section is named Hermes (renamed to Core) | ✓ | 1 | ok |

## 2026-04-18T05:42:10.340Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime | ✓ | 1595 | ok |
| 2 | aidenSdk: getSdkMethods() covers all required namespaces | ✓ | 1 | ok |
| 3 | aidenSdk: getSdkNamespaces() returns sorted array | ✓ | 0 | ok |
| 4 | aidenSdk: buildSdkSurface() includes expected namespace headers | ✓ | 17 | ok |
| 5 | aidenSdk: buildSdkRuntime() returns object with all namespace keys | ✓ | 0 | ok |
| 6 | runSandbox: module exports runInSandbox function | ✓ | 16 | ok |
| 7 | toolRegistry: run tool is registered + getToolsForCategories includes run | ✓ | 1 | ok |
| 8 | scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK | ✓ | 1 | ok |

## 2026-04-18T05:42:17.383Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces | ✓ | 2150 | ok |
| 2 | spawnManager: getActiveSpawns() returns an array (empty or otherwise) | ✓ | 1 | ok |
| 3 | spawnManager: killSpawn("nonexistent") returns false | ✓ | 0 | ok |
| 4 | spawnManager: IterationBudget shape used in budget inheritance formula | ✓ | 0 | ok |
| 5 | swarmManager: exports swarmSubagents function + SwarmStrategy types | ✓ | 16 | ok |
| 6 | swarmManager: source contains vote, merge, best strategy branches | ✓ | 0 | ok |
| 7 | sessionSearch: exports searchSessions and getIndexSize | ✓ | 30 | ok |
| 8 | sessionSearch: searchSessions("test") returns an array | ✓ | 38 | ok |
| 9 | hybridSearch: exports hybridSearch function | ✓ | 14 | ok |
| 10 | toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES | ✓ | 0 | ok |

## 2026-04-18T05:42:22.080Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | release: package.json version === "3.6.0" | ✓ | 0 | ok |
| 2 | release: CHANGELOG.md contains "## v3.5.0" header | ✓ | 2 | ok |
| 3 | release: local git tag v3.5.0 exists | ✓ | 56 | ok |
| 4 | release: no stale 3.1.0 or 3.4.0 version strings in source files | ✓ | 4 | ok |
| 5 | release: CHANGELOG.md references "34 zero-cost audits across 4 suites" | ✓ | 0 | ok |
| 6 | release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB | ✓ | 0 | ok |
| 7 | release: package.json test:audit script includes prompt_r1 | ✓ | 1 | ok |
| 8 | release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1) | ✓ | 0 | ok |

## 2026-04-18T05:42:26.594Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | skills: all 20 SKILL.md files exist | ✓ | 3 | ok |
| 2 | skills: each SKILL.md has name, description, version, tags in frontmatter | ✓ | 2 | ok |
| 3 | skills: each SKILL.md has a # H1 header | ✓ | 2 | ok |
| 4 | skills: each SKILL.md has "When to Use" and "How to Use" sections | ✓ | 3 | ok |
| 5 | skills: no SKILL.md contains security-blocked injection patterns | ✓ | 4 | ok |
| 6 | skills: each SKILL.md is under 10 KB | ✓ | 1 | ok |
| 7 | skills: AIDEN_CATALOG.md exists and references all 20 skills | ✓ | 1 | ok |
| 8 | skills: package.json test:audit script includes prompt_15 | ✓ | 0 | ok |

## 2026-04-18T05:42:31.467Z — 5/5 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cleanup: all workspace/skills files pass structural validation | ✓ | 1 | ok |
| 2 | cleanup: no duplicate skill names across learned/ and approved/ | ✓ | 0 | ok |
| 3 | cleanup: known garbage skills have been deleted | ✓ | 1 | ok |
| 4 | cleanup: skillTeacher.ts has header, origin:local, and size validation | ✓ | 1 | ok |
| 5 | cleanup: all official skills/ pass structural validation | ✓ | 15 | ok |

## 2026-04-18T05:42:36.599Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | mcp: McpServerConfig and McpTool interfaces exported from mcpClient | ✓ | 1 | ok |
| 2 | mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool | ✓ | 0 | ok |
| 3 | mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call | ✓ | 0 | ok |
| 4 | mcp: workspace/config/mcp.json template exists with servers array | ✓ | 1 | ok |
| 5 | shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS | ✓ | 0 | ok |
| 6 | mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool | ✓ | 0 | ok |
| 7 | sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace | ✓ | 1 | ok |
| 8 | cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand | ✓ | 2 | ok |

## 2026-04-18T05:42:40.875Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r2: cloudflare-worker/landing.js exists and is non-trivial | ✓ | 1 | ok |
| 2 | r2: landing.js contains zero occurrences of 3.3.1 | ✓ | 1 | ok |
| 3 | r2: nav badge contains v3.6.0 | ✓ | 1 | ok |
| 4 | r2: hero "JUST UPDATED" badge shows v3.6.0 | ✓ | 0 | ok |
| 5 | r2: download URL references v3.6.0/Aiden-Setup-3.6.0.exe | ✓ | 1 | ok |
| 6 | r2: download section h2 reads "Download Aiden v3.6.0" | ✓ | 0 | ok |
| 7 | r2: Razorpay integration preserved (≥1 occurrence) | ✓ | 1 | ok |
| 8 | r2: exactly 5 occurrences of "3.6.0" in landing.js | ✓ | 0 | ok |

## 2026-04-18T05:42:44.664Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | r3: electron-updater present in package.json dependencies | ✓ | 1 | ok |
| 2 | r3: electron-builder publish config has github/taracodlabs/aiden-releases | ✓ | 0 | ok |
| 3 | r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify | ✓ | 0 | ok |
| 4 | r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update | ✓ | 1 | ok |
| 5 | r3: electron/preload.js exposes aidenUpdater with installNow and checkNow | ✓ | 0 | ok |
| 6 | r3: cli/aiden.ts /refresh handler references update-check function | ✓ | 2 | ok |
| 7 | r3: no localhost/127.0.0.1 in update-related config in main.js | ✓ | 1 | ok |
| 8 | r3: publish config structure is valid for electron-updater GitHub provider | ✓ | 0 | ok |

## 2026-04-18T05:42:48.826Z — 8/8 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p16: ChannelAdapter interface has name, start, stop, send, isHealthy | ✓ | 1 | ok |
| 2 | p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation | ✓ | 0 | ok |
| 3 | p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret | ✓ | 0 | ok |
| 4 | p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check | ✓ | 0 | ok |
| 5 | p16: ChannelManager class has register, startAll, getStatus | ✓ | 0 | ok |
| 6 | p16: /channels command is in CLI COMMANDS array | ✓ | 1 | ok |
| 7 | p16: no process.exit or uncaught throw in adapter config loading sections | ✓ | 0 | ok |
| 8 | p16: ALLOWED_ env var used in discord, slack, and webhook adapters | ✓ | 1 | ok |

## 2026-04-18T05:42:52.652Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders() | ✓ | 0 | ok |
| 2 | p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain | ✓ | 0 | ok |
| 3 | p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders() | ✓ | 0 | ok |
| 4 | p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain | ✓ | 1 | ok |
| 5 | p17: tts.ts exports cleanForTTS() that strips markdown | ✓ | 0 | ok |
| 6 | p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable() | ✓ | 0 | ok |
| 7 | p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters | ✓ | 0 | ok |
| 8 | p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand | ✓ | 1 | ok |
| 9 | p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on | ✓ | 2 | ok |
| 10 | p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface | ✓ | 1 | ok |

## 2026-04-18T05:43:23.334Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | timer: cli/aiden.ts renderActivity() shows elapsed seconds | ✓ | 1 | ok |
| 2 | timer: cli/aiden.ts status bar passes startedAt-based elapsedMs | ✓ | 0 | ok |
| 3 | timer: cli/aiden.ts printBanner reads version from package.json | ✓ | 0 | ok |
| 4 | timer: electron/preload.js has no hardcoded 3.5.0 | ✓ | 0 | ok |
| 5 | timer: cloudflare-worker/license-server.js has no 3.5.0 references | ✓ | 1 | ok |
| 6 | timer: index.ts startup log fallback is not 3.5.0 | ✓ | 0 | ok |
| 7 | timer: core/skillTeacher.ts min size gate is 200 bytes | ✓ | 0 | ok |
| 8 | timer: core/skillTeacher.ts has SESSION_SKILL_LIMIT = 2 | ✓ | 0 | ok |
| 9 | timer: core/skillTeacher.ts dedup includes BUNDLED_SKILLS_DIR | ✓ | 1 | ok |
| 10 | timer: workspace/skills/learned/ and approved/ are empty | ✓ | 0 | ok |

## 2026-04-18T05:43:27.408Z — 11/11 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | speed: isSimpleMessage("hi") returns true | ✓ | 1 | ok |
| 2 | speed: isSimpleMessage rejects messages with tool keywords | ✓ | 1 | ok |
| 3 | speed: isSimpleMessage rejects messages containing URLs or file paths | ✓ | 0 | ok |
| 4 | speed: findRelevant scores by category field (CATEGORY_KEYWORD_MAP) | ✓ | 1 | ok |
| 5 | speed: findRelevant returns [] when isSimpleMessage is true | ✓ | 0 | ok |
| 6 | speed: needsMemory returns false for routine messages | ✓ | 0 | ok |
| 7 | speed: needsMemory returns true for past-context references | ✓ | 0 | ok |
| 8 | speed: router reads and writes primaryProvider via loadConfig/saveConfig | ✓ | 0 | ok |
| 9 | speed: markRateLimited auto-unpins primaryProvider after 3 failures | ✓ | 0 | ok |
| 10 | speed: agentLoop capabilitiesSection is empty for simple messages | ✓ | 0 | ok |
| 11 | speed: agentLoop always injects LESSONS section (not gated) | ✓ | 1 | ok |

## 2026-04-18T05:43:31.426Z — 10/10 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | provider: raceProviders has pin-first check for primaryProvider | ✓ | 1 | ok |
| 2 | provider: raceProviders calls fetchProviderResponse on pin, skips racing | ✓ | 1 | ok |
| 3 | provider: raceProviders falls back to race on pin failure | ✓ | 1 | ok |
| 4 | provider: fetchProviderResponse returns { text, apiName, model } | ✓ | 1 | ok |
| 5 | provider: streamChat emits meta event after raceProviders succeeds | ✓ | 2 | ok |
| 6 | provider: streamChat emits meta event in sequential (non-race) path | ✓ | 1 | ok |
| 7 | provider: CLI SSE loop handles evt.event === "meta" | ✓ | 1 | ok |
| 8 | provider: /primary list fetches /api/providers/state | ✓ | 1 | ok |
| 9 | provider: /primary <unknown> errors without mutation | ✓ | 1 | ok |
| 10 | provider: /api/providers/state marks isPrimary correctly | ✓ | 1 | ok |

## 2026-04-18T06:06:30.689Z — 16/19 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | streaming: streamTokens async generator exists in server.ts | ✓ | 1 | ok |
| 2 | streaming: streamTokens returns on [DONE] in SSE path | ✓ | 1 | ok |
| 3 | streaming: streamTokens reads message?.content for Ollama NDJSON | ✓ | 1 | ok |
| 4 | streaming: streamTokens buffers and suppresses on "tool_calls":[ | ✗ | 1 | streamTokens must check for OpenAI tool_calls marker in buffer |
| 5 | streaming: streamTokens buffers and suppresses on "type":"tool_use" | ✓ | 1 | ok |
| 6 | streaming: conversational fast-path no longer replays tokens word-by-word | ✗ | 0 | conversational path must NOT use the old word-by-word setTimeout replay |
| 7 | streaming: conversational fast-path forwards events via send(d) | ✓ | 0 | ok |
| 8 | streaming: SSE send function tracks _firstTokenAt for timing | ✓ | 1 | ok |
| 9 | streaming: SSE done event injects first_token_ms / total_ms / completion_tokens | ✓ | 1 | ok |
| 10 | streaming: CLI state object has lastTimingData field | ✗ | 1 | CLI state must declare lastTimingData field |
| 11 | streaming: CLI done handler captures evt.timing into state.lastTimingData | ✓ | 1 | ok |
| 12 | streaming: CLI streamChat calls _rl.pause() before fetch | ✓ | 0 | ok |
| 13 | streaming: CLI streamChat calls _rl.resume() in finally block | ✓ | 1 | ok |
| 14 | cli: /timing registered in COMMANDS array | ✓ | 1 | ok |
| 15 | cli: /timing handler displays first_token_ms timing field | ✓ | 0 | ok |
| 16 | cli: /version registered in COMMANDS array | ✓ | 0 | ok |
| 17 | cli: /version handler invokes checkForUpdate | ✓ | 1 | ok |
| 18 | version: semverGt is a named export in core/updateCheck.ts | ✓ | 0 | ok |
| 19 | version: updateCheck.ts has 6-hour rate limiting | ✓ | 0 | ok |

## 2026-04-18T06:07:36.724Z — 19/19 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | streaming: streamTokens async generator exists in server.ts | ✓ | 1 | ok |
| 2 | streaming: streamTokens returns on [DONE] in SSE path | ✓ | 1 | ok |
| 3 | streaming: streamTokens reads message?.content for Ollama NDJSON | ✓ | 1 | ok |
| 4 | streaming: streamTokens buffers and suppresses on "tool_calls":[ | ✓ | 1 | ok |
| 5 | streaming: streamTokens buffers and suppresses on "type":"tool_use" | ✓ | 0 | ok |
| 6 | streaming: conversational fast-path no longer replays tokens word-by-word | ✓ | 0 | ok |
| 7 | streaming: conversational fast-path forwards events via send(d) | ✓ | 1 | ok |
| 8 | streaming: SSE send function tracks _firstTokenAt for timing | ✓ | 1 | ok |
| 9 | streaming: SSE done event injects first_token_ms / total_ms / completion_tokens | ✓ | 2 | ok |
| 10 | streaming: CLI state object has lastTimingData field | ✓ | 1 | ok |
| 11 | streaming: CLI done handler captures evt.timing into state.lastTimingData | ✓ | 1 | ok |
| 12 | streaming: CLI streamChat calls _rl.pause() before fetch | ✓ | 1 | ok |
| 13 | streaming: CLI streamChat calls _rl.resume() in finally block | ✓ | 1 | ok |
| 14 | cli: /timing registered in COMMANDS array | ✓ | 1 | ok |
| 15 | cli: /timing handler displays first_token_ms timing field | ✓ | 0 | ok |
| 16 | cli: /version registered in COMMANDS array | ✓ | 1 | ok |
| 17 | cli: /version handler invokes checkForUpdate | ✓ | 1 | ok |
| 18 | version: semverGt is a named export in core/updateCheck.ts | ✓ | 0 | ok |
| 19 | version: updateCheck.ts has 6-hour rate limiting | ✓ | 0 | ok |

## 2026-04-18T06:15:39.010Z — 12/15 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cli-prod: package.json has build:cli script | ✓ | 1 | ok |
| 2 | cli-prod: build:cli entry point is cli/aiden.ts | ✓ | 0 | ok |
| 3 | cli-prod: build:cli outputs to dist-bundle/cli.js | ✓ | 0 | ok |
| 4 | cli-prod: build:cli marks electron as external dependency | ✓ | 0 | ok |
| 5 | cli-prod: main build script invokes build:cli | ✓ | 0 | ok |
| 6 | cli-prod: electron-builder ships dist-bundle via extraResources | ✓ | 0 | ok |
| 7 | cli-prod: bin/aiden.cmd handles "tui" subcommand | ✓ | 0 | ok |
| 8 | cli-prod: bin/aiden.cmd handles "pc" subcommand | ✓ | 0 | ok |
| 9 | cli-prod: bin/aiden.cmd uses Aiden.exe --cli (not node) for tui | ✓ | 0 | ok |
| 10 | cli-prod: bin/aiden (bash) handles tui and pc subcommands | ✓ | 0 | ok |
| 11 | cli-prod: electron/main.js detects --cli flag via process.argv | ✓ | 0 | ok |
| 12 | cli-prod: --cli mode sets ELECTRON_RUN_AS_NODE=1 on spawned child | ✓ | 1 | ok |
| 13 | cli-prod: --cli mode path does not call createMainWindow() | ✗ | 0 | isCliMode block must appear before else block |
| 14 | cli-prod: --cli mode starts API server before spawning CLI child | ✗ | 0 | --cli block must require(API_BUNDLE) to start API in-process |
| 15 | cli-prod: --cli mode hides macOS dock icon | ✗ | 1 | app.dock.hide() must be inside the isCliMode block, not the GUI block |

## 2026-04-18T06:16:24.642Z — 15/15 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cli-prod: package.json has build:cli script | ✓ | 0 | ok |
| 2 | cli-prod: build:cli entry point is cli/aiden.ts | ✓ | 1 | ok |
| 3 | cli-prod: build:cli outputs to dist-bundle/cli.js | ✓ | 0 | ok |
| 4 | cli-prod: build:cli marks electron as external dependency | ✓ | 0 | ok |
| 5 | cli-prod: main build script invokes build:cli | ✓ | 1 | ok |
| 6 | cli-prod: electron-builder ships dist-bundle via extraResources | ✓ | 0 | ok |
| 7 | cli-prod: bin/aiden.cmd handles "tui" subcommand | ✓ | 0 | ok |
| 8 | cli-prod: bin/aiden.cmd handles "pc" subcommand | ✓ | 0 | ok |
| 9 | cli-prod: bin/aiden.cmd uses Aiden.exe --cli (not node) for tui | ✓ | 0 | ok |
| 10 | cli-prod: bin/aiden (bash) handles tui and pc subcommands | ✓ | 0 | ok |
| 11 | cli-prod: electron/main.js detects --cli flag via process.argv | ✓ | 0 | ok |
| 12 | cli-prod: --cli mode sets ELECTRON_RUN_AS_NODE=1 on spawned child | ✓ | 1 | ok |
| 13 | cli-prod: --cli mode path does not call createMainWindow() | ✓ | 0 | ok |
| 14 | cli-prod: --cli mode starts API server before spawning CLI child | ✓ | 0 | ok |
| 15 | cli-prod: --cli mode hides macOS dock icon | ✓ | 0 | ok |

## 2026-04-18T07:50:49.741Z — 20/20 passed

| # | Test | Pass | Ms | Reason |
|---|------|------|----|--------|
| 1 | cli-prod: package.json has build:cli script | ✓ | 1 | ok |
| 2 | cli-prod: build:cli entry point is cli/aiden.ts | ✓ | 0 | ok |
| 3 | cli-prod: build:cli outputs to dist-bundle/cli.js | ✓ | 0 | ok |
| 4 | cli-prod: build:cli marks electron as external dependency | ✓ | 1 | ok |
| 5 | cli-prod: main build script invokes build:cli | ✓ | 0 | ok |
| 6 | cli-prod: electron-builder ships dist-bundle via extraResources | ✓ | 0 | ok |
| 7 | cli-prod: bin/aiden.cmd handles "tui" subcommand | ✓ | 12 | ok |
| 8 | cli-prod: bin/aiden.cmd handles "pc" subcommand | ✓ | 1 | ok |
| 9 | cli-prod: bin/aiden.cmd uses Aiden.exe --cli (not node) for tui | ✓ | 0 | ok |
| 10 | cli-prod: bin/aiden (bash) handles tui and pc subcommands | ✓ | 9 | ok |
| 11 | cli-prod: electron/main.js detects --cli flag via process.argv | ✓ | 0 | ok |
| 12 | cli-prod: --cli mode sets ELECTRON_RUN_AS_NODE=1 on spawned child | ✓ | 1 | ok |
| 13 | cli-prod: --cli mode path does not call createMainWindow() | ✓ | 0 | ok |
| 14 | cli-prod: --cli mode spawns API server as isolated child process | ✓ | 0 | ok |
| 15 | cli-prod: --cli mode hides macOS dock icon | ✓ | 0 | ok |
| 16 | cli-prod: build:api script exists and targets api/entry.ts | ✓ | 1 | ok |
| 17 | cli-prod: dist-bundle/index.js contains API server code | ✓ | 142 | ok |
| 18 | cli-prod: dist-bundle/index.js must not contain legacy v1.0 CLI banner | ✓ | 239 | ok |
| 19 | cli-prod: API spawn in --cli mode passes ELECTRON_RUN_AS_NODE=1 | ✓ | 1 | ok |
| 20 | cli-prod: root index.ts has been moved to legacy/ (not present at repo root) | ✓ | 0 | ok |
