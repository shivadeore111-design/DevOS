---
name: taskscheduler
description: Create, list, enable, disable, and delete Windows Task Scheduler jobs using PowerShell ScheduledTasks module
category: windows
version: 1.0.0
platform: windows
tags: taskscheduler, scheduled, task, automation, cron, windows, powershell, trigger
license: Apache-2.0
---

# Task Scheduler

Manage Windows Task Scheduler jobs via PowerShell — create triggers, set actions, enable/disable tasks, and inspect run history. The Windows equivalent of cron.

## When to Use

- User wants to schedule a script or program to run at a specific time or interval
- User asks to list all scheduled tasks or find a specific one
- User wants to enable, disable, or delete a scheduled task
- User needs to check when a task last ran or why it failed
- User wants to create a daily, weekly, or startup-triggered task

## How to Use

### List all non-disabled tasks
```powershell
Get-ScheduledTask | Where-Object State -ne 'Disabled' |
  Select-Object TaskName, TaskPath, State |
  Sort-Object TaskName | Format-Table -AutoSize
```

### Get task details (last run, next run)
```powershell
Get-ScheduledTaskInfo -TaskName "MyTask"
```

### Create a daily task
```powershell
$action  = New-ScheduledTaskAction -Execute "powershell.exe" `
             -Argument "-NonInteractive -File C:\scripts\daily-backup.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At "08:00AM"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask -TaskName "DailyBackup" `
  -Action $action -Trigger $trigger -Settings $settings `
  -Description "Daily backup at 8 AM" -RunLevel Limited
```

### Create a task that runs at Windows startup
```powershell
$action  = New-ScheduledTaskAction -Execute "powershell.exe" `
             -Argument "-File C:\scripts\startup.ps1"
$trigger = New-ScheduledTaskTrigger -AtStartup

Register-ScheduledTask -TaskName "StartupScript" `
  -Action $action -Trigger $trigger -RunLevel Limited
```

### Create a task that runs every 30 minutes
```powershell
$action  = New-ScheduledTaskAction -Execute "python.exe" `
             -Argument "C:\scripts\monitor.py"
$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 30) -Once -At (Get-Date)

Register-ScheduledTask -TaskName "MonitorEvery30m" `
  -Action $action -Trigger $trigger -RunLevel Limited
```

### Enable or disable a task
```powershell
Enable-ScheduledTask  -TaskName "DailyBackup"
Disable-ScheduledTask -TaskName "DailyBackup"
```

### Run a task immediately
```powershell
Start-ScheduledTask -TaskName "DailyBackup"
```

### Delete a task
```powershell
Unregister-ScheduledTask -TaskName "DailyBackup" -Confirm:$false
```

### View task run history
```powershell
Get-WinEvent -LogName "Microsoft-Windows-TaskScheduler/Operational" |
  Where-Object { $_.Message -match "DailyBackup" } |
  Select-Object TimeCreated, Message |
  Select-Object -First 10
```

## Examples

**"Schedule a Python script to run every day at 9 AM"**
→ `New-ScheduledTaskAction` with `python.exe` + script path, `New-ScheduledTaskTrigger -Daily -At "09:00AM"`, then `Register-ScheduledTask`.

**"List all tasks that are currently ready to run"**
→ `Get-ScheduledTask | Where-Object State -eq 'Ready' | Select-Object TaskName, TaskPath`

**"When did my backup task last run and did it succeed?"**
→ `Get-ScheduledTaskInfo -TaskName "DailyBackup" | Select-Object LastRunTime, LastTaskResult` (0 = success)

## Cautions

- Tasks registered with `-RunLevel Limited` run as the current user without UAC prompt — preferred for most automation
- `-RunLevel Highest` requires the task to be created in an elevated session; it will not prompt the user during execution
- `LastTaskResult` of 0 means success; any other value is an error code
- Task Scheduler event log must be enabled to use `Get-WinEvent` history queries
