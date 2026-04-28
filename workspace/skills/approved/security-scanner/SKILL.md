---
name: security-scanner
description: Automated security scanning for your own servers and development environments using Decepticon
category: security
version: 1.0.0
origin: taracod
license: Apache-2.0
tags: security, scanning, pentesting, devops, vulnerability, audit
requires_confirmation: true
sandbox_required: true
compatible_agents: aiden, hermes, openclaw
min_agent_version: 3.14.0
---

# Security Scanner (Decepticon)

Runs automated security scanning against YOUR OWN local servers and development environments using [Decepticon](https://github.com/PurpleAILAB/Decepticon), an autonomous multi-agent red team testing framework.

**This skill is opt-in and requires explicit installation. It is not active by default.**

---

## ⚠️ SAFETY RULES — NEVER bypass these

- **ONLY scan targets explicitly owned by the user**
- **DEFAULT target is localhost / 127.0.0.1 ONLY**
- NEVER scan external domains without explicit user ownership confirmation
- ALWAYS show the target URL and ask "Is this your server?" before scanning
- If user asks to scan a domain you don't recognize → **refuse**
- If user asks to scan an IP outside `192.168.x.x`, `10.x.x.x`, or `127.x.x.x` → ask "Do you own this server? Type 'yes I own [target]' to confirm"
- If user cannot confirm ownership → refuse and explain why
- Log every scan target to `workspace/security-reports/scan-log.txt`
- Never run with `--aggressive` or `--exploit` flags
- Never store scan results outside `workspace/security-reports/`

---

## Prerequisites

Decepticon must be installed before using this skill:

```bash
git clone https://github.com/PurpleAILAB/Decepticon
cd Decepticon
pip install -r requirements.txt
```

Verify installation:
```bash
ls ./Decepticon/main.py
```

---

## When to Use This Skill

User says:
- "scan my localhost for vulnerabilities"
- "check my dev server for security issues"
- "run a pentest on my local app"
- "audit http://localhost:3000"
- "scan my server for vulnerabilities"
- "run security scan on localhost"

---

## Steps

### Step 1 — Confirm target with user

Always ask before scanning:

```
I'm about to scan [TARGET] using Decepticon.

⚠️  Is this a server you own? Type 'yes' to confirm before I proceed.
```

**Wait for explicit "yes" confirmation. Do not proceed without it.**

For external targets (not 127.x.x.x or 192.168.x.x):

```
[TARGET] appears to be an external server.

To confirm you own it, type exactly: 'yes I own [target]'
```

If confirmation is not received within the conversation turn → abort and explain.

### Step 2 — Check Decepticon is installed

```
shell_exec: ls ./Decepticon/main.py
```

If not found, output install instructions and stop.

### Step 3 — Log the scan

```
shell_exec: echo "[TIMESTAMP] Scanning [TARGET] — authorized by user" >> workspace/security-reports/scan-log.txt
```

### Step 4 — Run the scan

```
shell_exec: cd Decepticon && python main.py --target [TARGET] --output ../workspace/security-reports/report-[TIMESTAMP].json
```

Default target if none specified: `http://localhost`

Stream live output — show progress lines as they arrive.

### Step 5 — Parse and present results

```python
# run_python
import json, sys
from pathlib import Path

report_path = sorted(Path('workspace/security-reports').glob('report-*.json'))[-1]
data = json.loads(report_path.read_text())

findings = data.get('findings', [])
by_severity = {'HIGH': [], 'MEDIUM': [], 'LOW': [], 'INFO': []}
for f in findings:
    sev = f.get('severity', 'INFO').upper()
    by_severity.setdefault(sev, []).append(f)

print(f"Scan complete: {report_path.name}")
print(f"Total findings: {len(findings)}")
print()
for sev in ['HIGH', 'MEDIUM', 'LOW', 'INFO']:
    for f in by_severity[sev]:
        print(f"{sev}: {f.get('title', f.get('description', 'Unknown'))}")
        if f.get('location'):
            print(f"  at: {f['location']}")
```

### Step 6 — Notify completion

```
notify: "Security scan complete — [N] findings ([H] high, [M] medium, [L] low)"
```

---

## Example Output

```
HIGH:   SQL injection at /api/users
MEDIUM: Missing X-Frame-Options header
MEDIUM: Outdated dependency: express 4.18.0 (CVE-2024-xxxx)
LOW:    Debug endpoint exposed at /debug
INFO:   Server: Express/4.18.2
```

---

## What NOT to Do

- Never run without explicit user ownership confirmation
- Never scan external IPs unless user typed exact confirmation phrase
- Never use `--aggressive`, `--exploit`, or `--brute-force` flags
- Never store results outside `workspace/security-reports/`
- Never share scan results with third parties
- Never run against `.gov`, `.mil`, or banking domains under any circumstances
