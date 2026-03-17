---
name: web-search
description: Search the web for current information using a search API
version: 1.0.0
author: DevOS
tags: search, web, research
---

Use this skill when the user asks about current events, prices, news, or anything that requires up-to-date information.

To search the web, use shell_exec with:
- Windows: Use `curl` to query a search API
- The search results will be returned as JSON

Example usage:
search_query = "latest AI news 2026"
Use shell_exec: curl "https://api.duckduckgo.com/?q=<query>&format=json"
Parse the results and summarize the top 3 findings.
