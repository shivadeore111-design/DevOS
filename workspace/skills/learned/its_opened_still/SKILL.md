---
name: its_opened_still
description: its not opened still
version: 1.0.0
origin: local
confidence: medium
trigger_phrase: "its not opened still"
tools_used: [app_launch, shell_exec]
---

# Its Opened Still

## When to use this skill
Use this when the user asks to its not opened still.

## Steps
1. [app_launch] — execute app_launch step
2. [shell_exec] — execute shell_exec step

## Example
User: "its not opened still"
Result: "FAILED: No app specified"
