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
