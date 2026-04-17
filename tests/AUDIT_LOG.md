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
