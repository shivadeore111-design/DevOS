---
name: use_browser_click_tool_click
description: use browser_click tool to click the first video
version: 1.0.0
origin: local
confidence: medium
trigger_phrase: "use browser_click tool to click the first video"
tools_used: [browser_click, open_browser, wait, browser_extract]
---

# Use Browser Click Tool Click

## When to use this skill
Use this when the user asks to use browser_click tool to click the first video.

## Steps
1. [browser_click] — execute browser_click step
2. [open_browser] — execute open_browser step
3. [wait] — execute wait step
4. [browser_extract] — execute browser_extract step

## Example
User: "use browser_click tool to click the first video"
Result: "IN Skip navigation Sign in Home Shorts Subscriptions You All Shorts Unwatched Watched Videos Recently uploaded Live Filters 3:51 Now playing Gehra Hua | Dhurandhar | Ranveer Singh, Sara Arjun, Shashwa"
