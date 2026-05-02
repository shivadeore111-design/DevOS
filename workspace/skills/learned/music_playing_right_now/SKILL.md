---
name: music_playing_right_now
description: what music im playing right now
version: 1.0.0
origin: local
confidence: medium
trigger_phrase: "what music im playing right now"
tools_used: [now_playing, run_powershell, respond, shell_exec, replan_exhausted]
---

# Music Playing Right Now

## When to use this skill
Use this when the user asks to what music im playing right now.

## Steps
1. [now_playing] — execute now_playing step
2. [run_powershell] — execute run_powershell step
3. [respond] — execute respond step
4. [shell_exec] — execute shell_exec step
5. [replan_exhausted] — execute replan_exhausted step

## Example
User: "what music im playing right now"
Result: "I need your approval before I can do that.  **Blocked action:** This command requires explicit user approval before running: spotify --show-metadata-format %a - %t  Reply **yes** to confirm, or tell m"
