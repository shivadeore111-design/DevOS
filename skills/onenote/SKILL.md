---
name: onenote
description: Read and write OneNote notebooks, sections, and pages via Microsoft Graph API or COM automation
category: windows
version: 1.0.0
tags: onenote, notes, notebook, microsoft, graph, pages, sections
license: Apache-2.0
---

# OneNote

Access, create, and update OneNote notebooks, sections, and pages using PowerShell COM or Microsoft Graph API — capture meeting notes, append to journals, and query your knowledge base.

## When to Use

- User wants to capture meeting notes or action items into OneNote
- User asks to read a specific OneNote page or section
- User wants to create a new page or append content to an existing one
- User needs to list available notebooks and sections
- User wants to search across OneNote pages

## How to Use

### List notebooks (Graph API)
```powershell
$headers = @{ Authorization = "Bearer $env:GRAPH_TOKEN" }
Invoke-RestMethod -Uri "https://graph.microsoft.com/v1.0/me/onenote/notebooks" -Headers $headers |
  Select-Object -ExpandProperty value |
  Select-Object id, displayName, lastModifiedDateTime
```

### List sections in a notebook
```powershell
$notebookId = "YOUR_NOTEBOOK_ID"
$headers = @{ Authorization = "Bearer $env:GRAPH_TOKEN" }
Invoke-RestMethod -Uri "https://graph.microsoft.com/v1.0/me/onenote/notebooks/$notebookId/sections" -Headers $headers |
  Select-Object -ExpandProperty value |
  Select-Object id, displayName
```

### Get pages in a section
```powershell
$sectionId = "YOUR_SECTION_ID"
$headers = @{ Authorization = "Bearer $env:GRAPH_TOKEN" }
Invoke-RestMethod -Uri "https://graph.microsoft.com/v1.0/me/onenote/sections/$sectionId/pages" -Headers $headers |
  Select-Object -ExpandProperty value |
  Select-Object id, title, createdDateTime
```

### Create a new page in a section
```powershell
$sectionId = "YOUR_SECTION_ID"
$headers = @{
  Authorization  = "Bearer $env:GRAPH_TOKEN"
  "Content-Type" = "application/xhtml+xml"
}
$html = @"
<!DOCTYPE html>
<html><head><title>Meeting Notes — $(Get-Date -Format 'yyyy-MM-dd')</title></head>
<body>
  <h1>Meeting Notes</h1>
  <p>Action items:</p>
  <ul><li>Follow up with team</li></ul>
</body></html>
"@
Invoke-RestMethod -Uri "https://graph.microsoft.com/v1.0/me/onenote/sections/$sectionId/pages" `
  -Method POST -Headers $headers -Body $html
```

### Read page content (HTML)
```powershell
$pageId = "YOUR_PAGE_ID"
$headers = @{ Authorization = "Bearer $env:GRAPH_TOKEN" }
Invoke-RestMethod -Uri "https://graph.microsoft.com/v1.0/me/onenote/pages/$pageId/content" -Headers $headers
```

### Search pages by keyword
```powershell
$headers = @{ Authorization = "Bearer $env:GRAPH_TOKEN" }
Invoke-RestMethod -Uri "https://graph.microsoft.com/v1.0/me/onenote/pages?`$search=meeting" -Headers $headers |
  Select-Object -ExpandProperty value |
  Select-Object title, createdDateTime
```

## Examples

**"Create a page in my Daily Notes section with today's date as the title"**
→ POST HTML page to the Daily Notes section ID with `<title>` set to `$(Get-Date -Format 'yyyy-MM-dd')`.

**"List all my notebooks"**
→ GET `/me/onenote/notebooks` and display `displayName` + `lastModifiedDateTime`.

**"Search my notes for action items"**
→ GET `/me/onenote/pages?$search=action+items` and list matching page titles.

## Cautions

- Graph API requires `Notes.ReadWrite` scope — obtain token via `az login` or OAuth device flow
- Page content is returned as HTML; parse with PowerShell XML or pass to an HTML renderer
- OneNote COM automation (via `onenote.exe`) is less reliable than Graph API for programmatic access
- Large notebooks with many pages may require `$top` and `$skip` pagination parameters
