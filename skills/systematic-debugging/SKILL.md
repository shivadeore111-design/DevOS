---
name: systematic-debugging
description: Four-phase root cause investigation process for diagnosing bugs, errors, and unexpected behavior
category: developer
version: 1.0.0
origin: aiden
tags: debugging, root-cause, investigation, bug, error, diagnosis, troubleshooting, logs, testing
---

# Systematic Debugging

A structured four-phase process for diagnosing software bugs: **Reproduce → Isolate → Hypothesize → Verify**. Prevents guessing and ensures you find the root cause, not just a workaround.

## When to Use

- User reports a bug or unexpected behavior without an obvious cause
- An error message appears but the source is unclear
- A fix was applied but the problem persists
- Tests are failing intermittently (flaky tests)
- Production behavior differs from local behavior

## How to Use

### Phase 1: Reproduce reliably

A bug you can reproduce consistently is halfway solved.

```
1. Get the exact error message, stack trace, and environment
2. Identify exact steps to trigger the bug
3. Confirm the bug happens in a clean environment (not just local state)
4. Record: OS, runtime version, dependencies, config values
5. Try: does it fail on every run, or only sometimes?
```

If intermittent: add timing, logging, or retry logic to isolate the trigger.

### Phase 2: Isolate the failure

Narrow the failure to the smallest possible unit.

```
1. Add logging before/after suspected areas to find where state diverges
2. Binary search through code: comment out half, does it still fail?
3. Check: when did this last work? (git log, git bisect)
4. Check: what changed recently? (git diff main, dependency updates)
5. Reproduce in a minimal test case — strip away all unrelated code
```

```powershell
# git bisect to find the breaking commit
git bisect start
git bisect bad                  # current commit is broken
git bisect good v2.0.0          # last known good tag
# git will checkout commits — test each, then:
git bisect good   # or
git bisect bad
# Repeat until git identifies the culprit commit
git bisect reset
```

### Phase 3: Generate hypotheses

Form 2-3 specific, testable hypotheses about the root cause.

```
Bad hypothesis:  "Something is wrong with the database"
Good hypothesis: "The connection pool is exhausted under concurrent load
                  because maxConnections defaults to 5 in test config"

For each hypothesis:
- What evidence supports it?
- What evidence would refute it?
- What one-line change would test it?
```

Rank by probability and test from most to least likely.

### Phase 4: Verify and fix

Prove the fix, not just that the error goes away.

```
1. Apply the smallest change that addresses the root cause
2. Run the original reproduction steps — confirm bug is gone
3. Run the full test suite — confirm no regressions
4. Check edge cases: empty input, null values, concurrent access
5. Write a regression test that would have caught this bug
```

```python
# Regression test template
def test_issue_42_connection_pool_exhaustion():
  """
  Regression test: ensure concurrent requests don't exhaust the connection pool.
  Root cause: maxConnections was not configurable; defaulted to 5 in test.
  Fixed in commit abc123.
  """
  results = run_concurrent_requests(count=20)
  assert all(r.status_code == 200 for r in results), "Some requests failed under concurrency"
```

### Debugging cheat sheet

```
Error: KeyError / undefined           → check input shapes; add null guard
Error: Off-by-one                     → examine loop bounds and index math
Error: Works locally, fails in CI     → check env vars, file paths, timing
Error: Works first run, fails after   → check state mutation, cache, side effects
Error: Inconsistent / race condition  → check shared mutable state, locks
Error: Memory leak                    → profile allocations; check event listener cleanup
```

## Examples

**"My API returns 500 randomly but I can't reproduce it"**
→ Start at Phase 1 — add structured logging with request IDs. Once patterns emerge, apply Phase 2 binary search.

**"Tests pass locally but fail in GitHub Actions"**
→ Phase 2: diff the environments (OS, Node version, env vars). Often caused by missing env vars or OS path differences.

**"I fixed the bug but it came back after a week"**
→ Phase 4: add a regression test and check if the root cause fix addressed the underlying issue or just a symptom.

## Cautions

- Never apply multiple changes at once when debugging — you won't know which one fixed it
- "Works on my machine" is a Phase 1 failure — always reproduce in the target environment
- Logs and print statements are powerful — do not underestimate them in favor of complex tooling
- Document the root cause in the fix commit message so future developers understand why the change was made
