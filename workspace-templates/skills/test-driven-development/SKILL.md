---
name: test-driven-development
description: Write software using the RED-GREEN-REFACTOR cycle for reliable, well-tested code
category: developer
version: 1.0.0
origin: aiden
license: Apache-2.0
tags: tdd, testing, red-green-refactor, unit-tests, pytest, jest, vitest, quality, development
---

# Test-Driven Development (TDD)

Use the RED-GREEN-REFACTOR cycle to write reliable, well-tested software. Write tests first, then write the minimal code to pass them, then clean up.

## When to Use

- User wants to implement a new function or module correctly
- User wants to ensure edge cases are handled before they become bugs
- User is refactoring and wants a safety net
- User wants tests for business-critical logic
- User wants to document behavior through executable tests

## How to Use

### The TDD cycle

```
RED    → Write a failing test for the behavior you want
GREEN  → Write the minimum code to make the test pass
REFACTOR → Clean up the code without breaking tests
Repeat for each small behavior increment
```

### Phase 1: RED — Write a failing test first

Write the test before the implementation. It must fail to prove the test works.

```python
# test_calculator.py — write this BEFORE calculator.py
import pytest
from calculator import add

def test_add_two_positive_numbers():
  assert add(2, 3) == 5

def test_add_negative_number():
  assert add(-1, 5) == 4

def test_add_floats():
  assert abs(add(0.1, 0.2) - 0.3) < 1e-9
```

Run the tests — they should fail with `ModuleNotFoundError` or `ImportError`:

```powershell
pytest test_calculator.py -v
# Expected: FAILED (module not found)
```

### Phase 2: GREEN — Minimal implementation to pass

Write only enough code to make the tests pass — nothing more.

```python
# calculator.py
def add(a, b):
  return a + b
```

```powershell
pytest test_calculator.py -v
# Expected: 3 PASSED
```

### Phase 3: REFACTOR — Improve code quality

Clean up implementation and tests while keeping all tests green.

```python
# calculator.py — add type hints and docstring
def add(a: float, b: float) -> float:
  """Return the sum of a and b."""
  return a + b
```

```powershell
pytest test_calculator.py -v  # must still pass after refactor
```

### Write tests with pytest (Python)

```python
# Parametrize for multiple cases
@pytest.mark.parametrize("a,b,expected", [
  (2, 3, 5),
  (-1, 5, 4),
  (0, 0, 0),
  (1.5, 2.5, 4.0),
])
def test_add(a, b, expected):
  assert add(a, b) == expected

# Test exceptions
def test_add_rejects_string():
  with pytest.raises(TypeError):
    add("hello", 2)
```

### Write tests with Vitest / Jest (TypeScript / JavaScript)

```typescript
// calculator.test.ts
import { describe, it, expect } from 'vitest'
import { add } from './calculator'

describe('add()', () => {
  it('adds two positive numbers', () => {
    expect(add(2, 3)).toBe(5)
  })

  it('handles negative numbers', () => {
    expect(add(-1, 5)).toBe(4)
  })

  it('throws on non-number input', () => {
    expect(() => add('a' as any, 2)).toThrow()
  })
})
```

### TDD for API endpoints

```python
# test_api.py — RED first
def test_create_user_returns_201(client):
  resp = client.post("/users", json={"name": "Alice", "email": "alice@example.com"})
  assert resp.status_code == 201
  assert resp.json()["id"] is not None

def test_create_user_rejects_missing_email(client):
  resp = client.post("/users", json={"name": "Alice"})
  assert resp.status_code == 422

# Then implement the /users endpoint to make these pass
```

## Examples

**"Implement a function that validates Indian phone numbers"**
→ RED: write tests for +91 10-digit numbers, reject 9-digit, reject letters. GREEN: implement regex. REFACTOR: add named groups, docstring.

**"Add a discount calculator to the checkout module"**
→ RED: test 10% off, 0% off, 100% off, reject negative discount. GREEN: minimal implementation. REFACTOR: extract constants, add type hints.

**"I want to refactor this function but keep it working"**
→ Write characterization tests first (tests that document current behavior), then refactor with test safety net.

## Cautions

- Never skip the RED phase — a test that was never failing might not actually test anything
- Tests should be independent — each test must set up its own state and not depend on test order
- Aim for one assertion per test — tests with multiple assertions are harder to diagnose when they fail
- TDD is slower upfront but faster overall — set this expectation with the user
- Mock external services (APIs, databases) in unit tests — test real integrations separately
