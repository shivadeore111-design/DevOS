---
name: outlook-native
description: Read and manage Outlook calendar and inbox via PowerShell COM interop or Microsoft Graph API
category: windows
version: 1.0.0
tags: outlook, calendar, email, inbox, meeting, schedule, microsoft
---

# Outlook Native

Read Outlook calendar events, check inbox, send emails, and schedule meetings using PowerShell COM automation or Microsoft Graph API — no browser required.

## When to Use

- User asks "what's on my calendar today / this week"
- User wants to check unread emails or a specific sender's messages
- User wants to send an email or schedule a meeting from Aiden
- User needs upcoming meeting reminders or free/busy info

## How to Use

### Check today's calendar (COM)
```powershell
$outlook = New-Object -ComObject Outlook.Application
$ns = $outlook.GetNamespace("MAPI")
$cal = $ns.GetDefaultFolder(9)  # 9 = olFolderCalendar
$today = [DateTime]::Today
$items = $cal.Items
$items.IncludeRecurrences = $true
$items.Sort("[Start]")
$filter = "[Start] >= '$($today.ToString('g'))' AND [Start] < '$($today.AddDays(1).ToString('g'))'"
$items.Restrict($filter) | Select-Object Subject, Start, End, Location
```

### Read unread emails (COM)
```powershell
$outlook = New-Object -ComObject Outlook.Application
$ns = $outlook.GetNamespace("MAPI")
$inbox = $ns.GetDefaultFolder(6)  # 6 = olFolderInbox
$inbox.Items | Where-Object { $_.UnRead -eq $true } |
  Select-Object Subject, SenderName, ReceivedTime |
  Sort-Object ReceivedTime -Descending |
  Select-Object -First 10
```

### Send email (COM)
```powershell
$outlook = New-Object -ComObject Outlook.Application
$mail = $outlook.CreateItem(0)  # 0 = olMailItem
$mail.To = "recipient@example.com"
$mail.Subject = "Subject here"
$mail.Body = "Message body"
$mail.Send()
```

### Schedule a meeting (COM)
```powershell
$outlook = New-Object -ComObject Outlook.Application
$appt = $outlook.CreateItem(1)  # 1 = olAppointmentItem
$appt.Subject = "Team Sync"
$appt.Start = "2026-04-20 14:00"
$appt.Duration = 60
$appt.Location = "Conference Room A"
$appt.RequiredAttendees = "colleague@example.com"
$appt.Save()
```

### Graph API fallback (requires GRAPH_TOKEN env var)
```powershell
$token = $env:GRAPH_TOKEN
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri "https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=$(Get-Date -Format o)&endDateTime=$((Get-Date).AddDays(1) | Get-Date -Format o)" -Headers $headers
```

## Examples

**"What meetings do I have today?"**
→ Run the COM calendar filter for today's date range, return Subject, Start, End, Location for each event.

**"Any unread emails from Vikram?"**
→ Filter inbox items where `UnRead -eq $true` and `SenderName -like '*Vikram*'`.

**"Send a quick email to team@company.com — subject: Sprint update, body: Demo at 3pm"**
→ Create olMailItem via COM, set fields, call Send().

## Cautions

- Outlook must be installed and the user must be logged in for COM to work
- COM operations open Outlook silently in the background — this is normal
- Graph API requires an access token (GRAPH_TOKEN); obtain via `az login` or the Microsoft identity platform
- Avoid sending bulk emails or automating mass replies
- Always confirm email content with the user before calling Send()
