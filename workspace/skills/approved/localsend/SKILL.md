---
name: localsend
description: "Send and receive files between devices on the same WiFi network using LocalSend — AirDrop alternative for Windows, Linux, macOS, iOS, Android."
version: 1.0.0
author: taracod
license: Apache-2.0
tools_used: send_file_local, receive_file_local, shell_exec
trigger_phrases:
  - send this file to my phone
  - send file to my laptop
  - transfer file to device
  - send screenshot to phone
  - receive file from phone
  - airdrop this file
tags: [files, networking, transfer]
---

# LocalSend — LAN File Transfer

## Prerequisites
LocalSend must be installed and running.
Download: https://localsend.org

## When to use
- "send this screenshot to my phone"
- "transfer this file to my laptop"
- "receive a file from my phone"
- "airdrop [file] to [device]"

## Steps

### Sending a file
1. Check LocalSend is running:
   shell_exec: curl -s http://localhost:53317/api/v2/info

2. Discover devices on network:
   send_file_local with op: 'discover'

3. Send file to device:
   send_file_local with file path + device name

### Receiving a file
1. receive_file_local — waits for incoming transfer
2. Notify when file arrives

## Example
User: "send screenshot to my phone"
1. Take screenshot → workspace/screenshots/screenshot_X.png
2. Discover devices → find "Shiva's iPhone"
3. Send via LocalSend → confirm sent
