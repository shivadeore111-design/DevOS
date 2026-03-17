---
name: code-runner
description: Write and execute code in Python, Node.js, or PowerShell
version: 1.0.0
author: DevOS
tags: code, execute, python, javascript
---

Use this skill to write and run code snippets.

For Python: Use shell_exec with: python -c "print('hello')"
For Node.js: Use shell_exec with: node -e "console.log('hello')"
For PowerShell: Use shell_exec with: powershell -Command "Write-Host 'hello'"

Always capture output and report results back to the user.
Save longer scripts to a temp file first, then execute.
