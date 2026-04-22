---
name: powershell-pro
description: Expert PowerShell operations — process management, services, WMI queries, REST calls, scheduled tasks, and script automation
category: windows
version: 1.0.0
platform: windows
tags: powershell, process, wmi, service, automation, scripting, windows, rest
license: Apache-2.0
---

# PowerShell Pro

Advanced PowerShell operations for system automation, process management, WMI queries, and REST API calls — all without leaving the terminal.

## When to Use

- User asks to list, start, or stop a Windows process or service
- User wants to query system info via WMI (CPU, RAM, disk, motherboard)
- User needs to call a REST API from the command line
- User wants to automate a task or write a reusable script
- User asks about scheduled tasks, environment variables, or system events

## How to Use

### List running processes (sorted by CPU)
```powershell
Get-Process | Sort-Object CPU -Descending | Select-Object -First 15 Name, Id, CPU, WorkingSet
```

### Kill a process by name
```powershell
Stop-Process -Name "notepad" -Force
```

### Query system info via WMI
```powershell
# CPU info
Get-WmiObject Win32_Processor | Select-Object Name, NumberOfCores, MaxClockSpeed

# RAM total
(Get-WmiObject Win32_ComputerSystem).TotalPhysicalMemory / 1GB

# Disk drives
Get-WmiObject Win32_DiskDrive | Select-Object Model, Size, MediaType
```

### REST API call with Invoke-RestMethod
```powershell
$response = Invoke-RestMethod -Uri "https://api.example.com/data" `
  -Method GET `
  -Headers @{ "Authorization" = "Bearer $env:API_TOKEN" }
$response | ConvertTo-Json -Depth 5
```

### List scheduled tasks
```powershell
Get-ScheduledTask | Where-Object State -ne 'Disabled' |
  Select-Object TaskName, TaskPath, State |
  Sort-Object TaskName
```

### Read Windows Event Log (last 20 errors)
```powershell
Get-EventLog -LogName System -EntryType Error -Newest 20 |
  Select-Object TimeGenerated, Source, Message
```

### Export output to CSV
```powershell
Get-Process | Select-Object Name, Id, CPU, WorkingSet |
  Export-Csv -Path "$env:USERPROFILE\Desktop\processes.csv" -NoTypeInformation
```

## Examples

**"Show me what's eating memory right now"**
→ `Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 10 Name, Id, @{N='MB';E={[math]::Round($_.WorkingSet/1MB,1)}}`

**"Call the GitHub API and get my rate limit status"**
→ `Invoke-RestMethod -Uri "https://api.github.com/rate_limit" -Headers @{Authorization="Bearer $env:GITHUB_TOKEN"}`

**"List all scheduled tasks that run on startup"**
→ `Get-ScheduledTask | Where-Object { $_.Triggers | Where-Object CimClass -match 'BootTrigger' }`

## Cautions

- `Stop-Process -Force` kills without saving — confirm with user before running on critical processes
- WMI queries can be slow on first run; subsequent calls are faster
- Invoke-RestMethod requires `-UseBasicParsing` on older PowerShell versions
- Environment variables set in a script session don't persist to the OS — use `[Environment]::SetEnvironmentVariable()` for persistence
