---
name: its_now_close_google_chrome
description: ok its open now, close google chrome
version: 1.0.0
origin: local
confidence: medium
trigger_phrase: "ok its open now, close google chrome"
tools_used: [app_close, respond]
---

# Its Now Close Google Chrome

## When to use this skill
Use this when the user asks to ok its open now, close google chrome.

## Steps
1. [app_close] — execute app_close step
2. [respond] — execute respond step

## Example
User: "ok its open now, close google chrome"
Result: "FAILED: No app/process name provided I'm not sure how to help with that right now. Could you rephrase your request?"
