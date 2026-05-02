---
name: analyse_oracle_shares_details_over
description: can you analyse oracle shares details over past few days and create file on desktop with details
version: 1.0.0
origin: local
confidence: medium
trigger_phrase: "can you analyse oracle shares details over past few days and create file on desk"
tools_used: [get_market_data, file_write]
---

# Analyse Oracle Shares Details Over

## When to use this skill
Use this when the user asks to can you analyse oracle shares details over past few days and create file on desk.

## Steps
1. [get_market_data] — execute get_market_data step
2. [file_write] — execute file_write step

## Example
User: "can you analyse oracle shares details over past few days and create file on desktop with details"
Result: "The attempt to fetch market data for Oracle (ORCL) failed with the following message:  `Error: Could not retrieve real-time stock data for ORCL. Please check the ticker symbol or try again later.`  Fu"
