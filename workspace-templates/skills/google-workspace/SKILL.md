---
name: google-workspace
description: Interact with Gmail, Google Calendar, Drive, Sheets, and Docs via the Google API with service account or OAuth credentials
category: productivity
version: 1.0.0
origin: aiden
license: Apache-2.0
tags: google, gmail, calendar, drive, sheets, docs, workspace, api, oauth, email
---

# Google Workspace Integration

Access Gmail, Google Calendar, Drive, Sheets, and Docs through the Google REST APIs. Requires either a service account JSON key (`GOOGLE_APPLICATION_CREDENTIALS`) or an OAuth2 access token.

## When to Use

- User wants to read or send Gmail messages
- User wants to list or create Google Calendar events
- User wants to read/write a Google Sheet
- User wants to list Google Drive files
- User wants to read or update a Google Doc

## How to Use

### 1. Authenticate — OAuth token (quickest)

Get a short-lived access token via `gcloud` CLI (requires Google Cloud SDK installed):

```powershell
# One-time login (opens browser)
gcloud auth login
# Get token for API calls
$token = (gcloud auth print-access-token)
$headers = @{ "Authorization" = "Bearer $token" }
```

For service accounts, set `GOOGLE_APPLICATION_CREDENTIALS` to the JSON key path and use `gcloud auth application-default print-access-token`.

### 2. List recent Gmail messages

```powershell
$resp = Invoke-RestMethod -Uri "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10" -Headers $headers
$resp.messages | ForEach-Object {
  $msg = Invoke-RestMethod -Uri "https://gmail.googleapis.com/gmail/v1/users/me/messages/$($_.id)?format=metadata&metadataHeaders=Subject,From,Date" -Headers $headers
  $msg.payload.headers | Where-Object { $_.name -in @("Subject","From","Date") } | Select-Object name,value
}
```

### 3. List today's Calendar events

```powershell
$now   = [System.DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
$end   = [System.DateTime]::UtcNow.AddDays(1).ToString("yyyy-MM-ddTHH:mm:ssZ")
$resp  = Invoke-RestMethod -Uri "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=$now&timeMax=$end&singleEvents=true&orderBy=startTime" -Headers $headers
$resp.items | Select-Object summary, @{N="start";E={$_.start.dateTime}}
```

### 4. Read a Google Sheet

```powershell
$spreadsheetId = "your-sheet-id"   # from URL: /spreadsheets/d/<id>/
$range         = "Sheet1!A1:E20"
$resp = Invoke-RestMethod -Uri "https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values/$range" -Headers $headers
$resp.values | ForEach-Object { $_ -join "`t" }
```

### 5. Write to a Google Sheet

```powershell
$spreadsheetId = "your-sheet-id"
$range         = "Sheet1!A1"
$writeHeaders  = $headers.Clone(); $writeHeaders["Content-Type"] = "application/json"
$payload = @{ values = @(@("Name","Score"),@("Alice","95"),@("Bob","87")) } | ConvertTo-Json
Invoke-RestMethod -Uri "https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values/$range`?valueInputOption=RAW" -Method Put -Headers $writeHeaders -Body $payload
```

### 6. List Google Drive files

```powershell
$resp = Invoke-RestMethod -Uri "https://www.googleapis.com/drive/v3/files?pageSize=20&fields=files(id,name,mimeType,modifiedTime)" -Headers $headers
$resp.files | Select-Object name, mimeType, modifiedTime | Format-Table -AutoSize
```

### 7. Read a Google Doc

```powershell
$docId = "your-doc-id"   # from URL: /document/d/<id>/
$resp  = Invoke-RestMethod -Uri "https://docs.googleapis.com/v1/documents/$docId" -Headers $headers
$resp.body.content | Where-Object { $_.paragraph } |
  ForEach-Object { $_.paragraph.elements.textRun.content } | Where-Object { $_ } | Out-String
```

## Examples

**"Show me my unread Gmail emails from today"**
→ Use step 2 with query parameter `q=is:unread after:2026/04/17`.

**"What meetings do I have tomorrow?"**
→ Use step 3 with tomorrow's date range for `timeMin`/`timeMax`.

**"Read the sales data from my Google Sheet"**
→ Use step 4 with the sheet ID from the URL and the relevant range.

## Cautions

- OAuth tokens expire after 1 hour — refresh with `gcloud auth print-access-token` as needed
- Service account must be granted Workspace domain-wide delegation to impersonate users
- Google Sheets API ranges use A1 notation — specify exact range to avoid reading entire sheet
- Drive API returns a maximum of 1000 files per page; use `nextPageToken` for pagination
- Sending emails requires the `gmail.send` scope — confirm scope during OAuth setup
