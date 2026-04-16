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
