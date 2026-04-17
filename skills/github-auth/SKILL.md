---
name: github-auth
description: Set up GitHub authentication via gh CLI, SSH keys, and HTTPS personal access tokens
category: developer
version: 1.0.0
origin: aiden
license: Apache-2.0
tags: github, auth, ssh, pat, token, credentials, gh-cli, authentication, git, https
---

# GitHub Authentication Setup

Configure GitHub authentication for `git` and `gh` CLI operations using the GitHub CLI (`gh`), SSH keys, or HTTPS personal access tokens (PATs).

## When to Use

- User needs to authenticate with GitHub from a new machine
- User is getting `Permission denied (publickey)` or `Authentication failed` errors
- User wants to switch from HTTPS to SSH authentication
- User wants to create or rotate a personal access token
- User wants to verify their current GitHub credentials are working

## How to Use

### 1. Authenticate with gh CLI (recommended)

```powershell
# Interactive login — opens browser for OAuth
gh auth login

# Choose: GitHub.com → HTTPS → Authenticate with browser
# Or choose SSH if preferred

# Verify authentication
gh auth status
```

### 2. Create an SSH key

```powershell
# Generate Ed25519 key (modern, secure)
ssh-keygen -t ed25519 -C "your-email@example.com" -f "$env:USERPROFILE\.ssh\github_ed25519"

# Start ssh-agent and add key
Start-Service ssh-agent
ssh-add "$env:USERPROFILE\.ssh\github_ed25519"

# Display public key to copy to GitHub
Get-Content "$env:USERPROFILE\.ssh\github_ed25519.pub"
```

After running step 2, the user must add the public key at https://github.com/settings/keys → New SSH key.

### 3. Configure SSH to use the key for GitHub

```powershell
# Create or append to SSH config
$config = @"

Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_ed25519
"@
Add-Content "$env:USERPROFILE\.ssh\config" $config

# Test SSH connection
ssh -T git@github.com
```

### 4. Create a Personal Access Token (HTTPS)

Direct the user to: https://github.com/settings/tokens/new
- Select scopes: `repo`, `read:org` (for org repos), `workflow` (for Actions)
- Copy the token — it is shown only once

```powershell
# Configure git to cache HTTPS credentials
git config --global credential.helper wincred

# Test — will prompt for username + PAT as password
git clone https://github.com/your-org/your-repo.git
```

### 5. Configure gh CLI with a PAT

```powershell
# Authenticate gh CLI with a PAT non-interactively
$env:GH_TOKEN = "ghp_your_token_here"
gh auth status
```

### 6. Verify and list configured credentials

```powershell
# Check gh auth
gh auth status

# Check git remote URL type
git remote -v

# Test SSH
ssh -T git@github.com
# Expected: "Hi username! You've successfully authenticated..."
```

### 7. Switch a repo from HTTPS to SSH

```powershell
# Show current remote
git remote get-url origin

# Change to SSH
git remote set-url origin git@github.com:owner/repo.git
git remote -v   # verify
```

## Examples

**"I'm on a new machine and need to set up GitHub access"**
→ Use step 1 (`gh auth login`) for the quickest setup. If SSH is preferred, use steps 2–3 then step 1 with SSH option.

**"I'm getting Authentication failed when pushing to GitHub"**
→ Use step 6 to diagnose. If HTTPS, rotate the PAT (step 4). If SSH, run `ssh -T git@github.com` to test.

**"Generate a new SSH key and add it to GitHub"**
→ Use steps 2–3 and instruct user to paste the public key at github.com/settings/keys.

## Cautions

- Never store PATs in code files or commit them to git — use environment variables or the system keychain
- PATs shown on GitHub are one-time — copy immediately when created
- SSH keys without passphrases are convenient but less secure — recommend a passphrase for shared machines
- `gh auth login` stores credentials in the system keychain — do not use on untrusted machines
