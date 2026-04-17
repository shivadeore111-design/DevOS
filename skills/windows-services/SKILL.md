---
name: windows-services
description: List, start, stop, restart, and configure Windows services via PowerShell Get-Service and Set-Service
category: windows
version: 1.0.0
tags: services, windows, powershell, daemon, startup, get-service, set-service
---

# Windows Services

Manage Windows background services — list, start, stop, restart, and change startup type — using PowerShell's built-in service cmdlets.

## When to Use

- User wants to list running or stopped Windows services
- User asks to start, stop, or restart a specific service
- User wants to change a service's startup type (automatic, manual, disabled)
- User needs to find which service owns a process or port
- User wants to check if a service is healthy or crashing

## How to Use

### List all running services
```powershell
Get-Service | Where-Object Status -eq 'Running' |
  Select-Object Name, DisplayName, Status |
  Sort-Object DisplayName
```

### Find a specific service
```powershell
Get-Service -Name "*sql*" | Select-Object Name, DisplayName, Status, StartType
```

### Start a service
```powershell
Start-Service -Name "wuauserv"   # Windows Update
```

### Stop a service
```powershell
Stop-Service -Name "wuauserv" -Force
```

### Restart a service
```powershell
Restart-Service -Name "Spooler"  # Print Spooler
```

### Check service startup type
```powershell
Get-Service -Name "wuauserv" | Select-Object Name, StartType, Status
```

### Change startup type to Manual
```powershell
Set-Service -Name "wuauserv" -StartupType Manual
```

### Change startup type to Disabled
```powershell
Set-Service -Name "DiagTrack" -StartupType Disabled
```

### List services that failed to start
```powershell
Get-Service | Where-Object { $_.StartType -eq 'Automatic' -and $_.Status -ne 'Running' } |
  Select-Object Name, DisplayName, Status
```

### Find service by process ID
```powershell
$pid = 1234
Get-WmiObject Win32_Service | Where-Object ProcessId -eq $pid |
  Select-Object Name, DisplayName, State, ProcessId
```

### View service dependencies
```powershell
(Get-Service -Name "LanmanServer").DependentServices
(Get-Service -Name "LanmanServer").ServicesDependedOn
```

## Examples

**"Is Windows Update service running?"**
→ `Get-Service -Name "wuauserv" | Select-Object Name, Status, StartType`

**"Stop and disable the Print Spooler service"**
→ `Stop-Service -Name "Spooler" -Force; Set-Service -Name "Spooler" -StartupType Disabled`

**"Which automatic services are currently stopped?"**
→ `Get-Service | Where-Object { $_.StartType -eq 'Automatic' -and $_.Status -ne 'Running' }`

## Cautions

- Stopping critical services (LanmanServer, DHCP, DNS) can disrupt network connectivity
- Starting/stopping services may require an elevated session depending on the service security descriptor
- `Set-Service -StartupType Disabled` prevents the service from starting even manually until re-enabled
- Use `Get-Service | Where-Object Status -eq 'Running' | Measure-Object` to get a quick service health count
