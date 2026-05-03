---
name: github-issues
description: Create, list, view, and manage GitHub issues using the gh CLI
category: developer
version: 1.0.0
origin: aiden
license: Apache-2.0
tags: github, issues, bug-tracker, gh-cli, labels, milestones, comments, triage, project-management
---

# GitHub Issues Management

Manage GitHub issues — create, list, view, label, assign, and close issues — using the `gh` CLI. Requires `gh auth login` (see github-auth skill) or `GH_TOKEN` environment variable.

## When to Use

- User wants to create a bug report or feature request issue
- User wants to list open issues in a repository
- User wants to add a comment or close an issue
- User wants to filter issues by label, assignee, or milestone
- User wants to bulk-triage or update multiple issues

## How to Use

### 1. List open issues

```powershell
# List open issues in current repo
gh issue list

# List with specific filters
gh issue list --state open --label bug --limit 20

# List issues assigned to me
gh issue list --assignee @me
```

### 2. View an issue

```powershell
gh issue view 42
gh issue view 42 --comments
```

### 3. Create a new issue

```powershell
# Interactive (opens editor)
gh issue create

# Non-interactive with all fields
gh issue create --title "Login fails on mobile Safari" --body "Steps to reproduce:
1. Open app on iOS Safari
2. Tap Sign In
3. Form submits but returns to login page

Expected: successful login. Actual: redirect loop." --label bug --assignee "@me"
```

### 4. Add a comment

```powershell
gh issue comment 42 --body "Investigated — root cause is a CSRF token mismatch. Fix in progress."
```

### 5. Edit an issue (labels, assignees, milestone, title)

```powershell
# Add a label
gh issue edit 42 --add-label "priority:high"

# Remove a label and add another
gh issue edit 42 --remove-label bug --add-label wont-fix

# Assign to someone
gh issue edit 42 --add-assignee johndoe

# Change title
gh issue edit 42 --title "Login redirect loop on mobile Safari"
```

### 6. Close and reopen issues

```powershell
# Close (resolved)
gh issue close 42 --comment "Fixed in v2.1.3"

# Close as not planned
gh issue close 42 --reason "not planned"

# Reopen
gh issue reopen 42
```

### 7. Search issues across repos

```powershell
# Search open issues mentioning a keyword
gh issue list --repo owner/repo --search "authentication token" --state all

# GitHub search syntax in --search
gh issue list --repo owner/repo --search "label:bug created:>2026-01-01"
```

### 8. Bulk operations

```powershell
# Close all issues with a specific label
gh issue list --label "duplicate" --limit 100 --json number | 
  python -c "import json,sys; [print(i['number']) for i in json.load(sys.stdin)]" |
  ForEach-Object { gh issue close $_ --reason "not planned" }
```

## Examples

**"Create a GitHub issue for the login bug we just found"**
→ Use step 3 with title, body describing steps to reproduce, and `--label bug`.

**"Show me all open bugs assigned to me in this repo"**
→ Use step 1: `gh issue list --label bug --assignee @me`.

**"Close issue 42 and add a comment that it's fixed"**
→ Use step 6: `gh issue close 42 --comment "Fixed in latest release"`.

## Cautions

- `gh` must be authenticated — run `gh auth status` to verify before use
- Labels must already exist in the repository — creating non-existent labels with `--add-label` will error
- Bulk operations cannot be undone — confirm with the user before closing multiple issues
- Issue numbers are repository-specific — always confirm the correct repo with `--repo owner/repo` for multi-repo workflows
