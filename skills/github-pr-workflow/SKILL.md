---
name: github-pr-workflow
description: Full pull request lifecycle — create, review, merge, and manage PRs using the gh CLI
category: developer
version: 1.0.0
origin: aiden
tags: github, pull-request, pr, review, merge, gh-cli, code-review, workflow, branch, diff
---

# GitHub Pull Request Workflow

Manage the full lifecycle of GitHub pull requests — create, review, approve, request changes, merge, and clean up — using the `gh` CLI.

## When to Use

- User wants to create a pull request from the current branch
- User wants to review or approve a PR
- User wants to merge a PR after approval
- User wants to check PR status, checks, or reviews
- User wants to list open PRs or find a specific PR

## How to Use

### 1. Create a pull request

```powershell
# Interactive (opens editor for body)
gh pr create

# Non-interactive with all fields
gh pr create --title "feat: add user authentication" --body "## Summary
- Add JWT-based auth
- Add login/logout endpoints
- Add middleware for protected routes

## Test plan
- [ ] Login with valid credentials
- [ ] Reject invalid credentials
- [ ] Access protected route with token" --base main --draft
```

### 2. List open PRs

```powershell
gh pr list
gh pr list --state all --limit 20
gh pr list --author "@me"
gh pr list --label "ready for review"
```

### 3. View PR details and diff

```powershell
# View PR summary
gh pr view 15

# View with comments
gh pr view 15 --comments

# Show diff
gh pr diff 15
```

### 4. Check PR status and CI checks

```powershell
gh pr checks 15
gh pr status   # shows PRs relevant to you (authored, assigned, review requested)
```

### 5. Review a PR (approve / request changes / comment)

```powershell
# Approve
gh pr review 15 --approve --body "LGTM! Clean implementation."

# Request changes
gh pr review 15 --request-changes --body "Please add unit tests for the auth middleware."

# Leave a general comment
gh pr review 15 --comment --body "Looks mostly good — just one question inline."
```

### 6. Merge a PR

```powershell
# Squash merge (recommended for feature branches)
gh pr merge 15 --squash --delete-branch

# Merge commit (preserves all commits)
gh pr merge 15 --merge

# Rebase merge
gh pr merge 15 --rebase --delete-branch
```

### 7. Checkout a PR locally

```powershell
# Checkout a PR branch for local testing
gh pr checkout 15

# Return to main when done
git checkout main
```

### 8. Edit a PR (title, body, labels, reviewers)

```powershell
# Mark draft as ready for review
gh pr ready 15

# Add reviewer
gh pr edit 15 --add-reviewer alice,bob

# Add label
gh pr edit 15 --add-label "ready for review"
```

### 9. Close a PR without merging

```powershell
gh pr close 15 --comment "Closing in favour of PR #16 which takes a different approach."
```

## Examples

**"Create a PR from my current branch to main"**
→ Use step 1 — fill in title and body describing the changes and test plan.

**"Show me what CI checks are failing on PR 15"**
→ Use step 4: `gh pr checks 15` to see check names, status, and links to logs.

**"Approve PR 22 and merge it with squash"**
→ Use step 5 to approve, then step 6 with `--squash --delete-branch`.

## Cautions

- Always check CI status (`gh pr checks`) before merging — do not merge PRs with failing required checks
- `--delete-branch` removes the remote branch after merge — confirm this is desired
- Squash merge rewrites history — use merge commit for PRs where individual commit history matters
- Merging from `gh pr merge` requires merge permissions — the user needs write access to the repo
