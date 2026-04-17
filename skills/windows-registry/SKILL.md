---
name: windows-registry
description: Read, write, and query Windows Registry keys and values via PowerShell Registry provider
category: windows
version: 1.0.0
tags: registry, regedit, windows, powershell, hklm, hkcu, settings, config
---

# Windows Registry

Read and write Windows Registry keys and values using PowerShell's built-in Registry provider — inspect startup entries, app settings, and system configuration without regedit.

## When to Use

- User wants to read a registry value (e.g., installed software, startup entries)
- User asks to create or modify a registry key or value
- User wants to list all values under a registry path
- User needs to check what programs run at Windows startup
- User asks to remove a registry value or key

## How to Use

### Read a single registry value
```powershell
Get-ItemPropertyValue -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer" `
  -Name "ShellState"
```

### List all values under a key
```powershell
Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion"
```

### Check startup programs (current user)
```powershell
Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
```

### Check startup programs (all users)
```powershell
Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
```

### Create a new registry key
```powershell
New-Item -Path "HKCU:\Software\Aiden" -Force
```

### Set a registry value (string)
```powershell
Set-ItemProperty -Path "HKCU:\Software\Aiden" -Name "Version" -Value "3.5.0" -Type String
```

### Set a registry value (DWORD)
```powershell
Set-ItemProperty -Path "HKCU:\Software\Aiden" -Name "Enabled" -Value 1 -Type DWord
```

### Delete a registry value
```powershell
Remove-ItemProperty -Path "HKCU:\Software\Aiden" -Name "OldSetting"
```

### Delete a registry key and all subkeys
```powershell
Remove-Item -Path "HKCU:\Software\Aiden" -Recurse -Force
```

### Search registry for a value name
```powershell
Get-ChildItem -Path "HKLM:\SOFTWARE" -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.Property -contains "DisplayName" } |
  Get-ItemProperty |
  Select-Object DisplayName, DisplayVersion, Publisher |
  Sort-Object DisplayName
```

### List installed software
```powershell
Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" |
  Select-Object DisplayName, DisplayVersion, Publisher, InstallDate |
  Where-Object DisplayName |
  Sort-Object DisplayName
```

## Examples

**"What programs launch at startup for my user?"**
→ `Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"` — each value name is an entry, value data is the command.

**"List all installed software with version numbers"**
→ Query both HKLM and HKCU Uninstall keys and merge results.

**"Add a registry entry to run a script at login"**
→ `Set-ItemProperty -Path "HKCU:\...\Run" -Name "MyScript" -Value "powershell.exe -File C:\scripts\login.ps1"`

## Cautions

- Modifying HKLM keys requires an elevated session (UAC dialog) — HKCU keys do not
- Always read a key before modifying it to understand the current state
- Deleting registry keys is permanent — there is no Recycle Bin for registry changes
- Back up a key before editing: `reg export "HKCU\Software\Aiden" C:\backup\aiden-backup.reg`
- Registry paths in PowerShell use `\` as separator (not `/`) and hive aliases like `HKCU:` and `HKLM:`
