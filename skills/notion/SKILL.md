---
name: notion
description: Read, create, and update Notion pages and databases via the Notion REST API
category: productivity
version: 1.0.0
origin: aiden
tags: notion, notes, database, pages, workspace, api, knowledge-base, tasks
---

# Notion API Integration

Interact with Notion workspaces through the official REST API. Requires an Internal Integration token (`NOTION_TOKEN`) and pages/databases shared with that integration.

## When to Use

- User wants to read content from a Notion page
- User wants to create a new page or database entry
- User wants to query a Notion database with filters
- User wants to append blocks to an existing page
- User wants to search across their Notion workspace

## How to Use

### 1. Set up the integration token

The user must create an Internal Integration at https://www.notion.so/my-integrations and share their pages/databases with it.

```powershell
# Set token in session (or add to .env)
$env:NOTION_TOKEN = "ntn_..."
```

### 2. Search workspace

```powershell
$headers = @{ "Authorization" = "Bearer $env:NOTION_TOKEN"; "Notion-Version" = "2022-06-28"; "Content-Type" = "application/json" }
$body    = '{"query": "meeting notes"}'
$resp    = Invoke-RestMethod -Uri "https://api.notion.com/v1/search" -Method Post -Headers $headers -Body $body
$resp.results | Select-Object -ExpandProperty properties | ConvertTo-Json -Depth 5
```

### 3. Read a page

```powershell
$pageId  = "your-page-id"   # from Notion URL: notion.so/Page-Title-<pageId>
$headers = @{ "Authorization" = "Bearer $env:NOTION_TOKEN"; "Notion-Version" = "2022-06-28" }
$page    = Invoke-RestMethod -Uri "https://api.notion.com/v1/pages/$pageId" -Headers $headers
$blocks  = Invoke-RestMethod -Uri "https://api.notion.com/v1/blocks/$pageId/children" -Headers $headers
$blocks.results | ForEach-Object { $_.paragraph.rich_text.plain_text }
```

### 4. Query a database

```powershell
$dbId    = "your-database-id"
$headers = @{ "Authorization" = "Bearer $env:NOTION_TOKEN"; "Notion-Version" = "2022-06-28"; "Content-Type" = "application/json" }
$filter  = '{"filter": {"property": "Status", "select": {"equals": "In Progress"}}}'
$resp    = Invoke-RestMethod -Uri "https://api.notion.com/v1/databases/$dbId/query" -Method Post -Headers $headers -Body $filter
$resp.results | ForEach-Object { $_.properties.Name.title.plain_text }
```

### 5. Create a page in a database

```powershell
$dbId    = "your-database-id"
$headers = @{ "Authorization" = "Bearer $env:NOTION_TOKEN"; "Notion-Version" = "2022-06-28"; "Content-Type" = "application/json" }
$payload = @{
  parent     = @{ database_id = $dbId }
  properties = @{
    Name = @{ title = @(@{ text = @{ content = "My New Page" } }) }
  }
} | ConvertTo-Json -Depth 10
Invoke-RestMethod -Uri "https://api.notion.com/v1/pages" -Method Post -Headers $headers -Body $payload
```

### 6. Append text blocks to a page

```powershell
$pageId  = "your-page-id"
$headers = @{ "Authorization" = "Bearer $env:NOTION_TOKEN"; "Notion-Version" = "2022-06-28"; "Content-Type" = "application/json" }
$payload = @{
  children = @(@{
    object    = "block"
    type      = "paragraph"
    paragraph = @{ rich_text = @(@{ type = "text"; text = @{ content = "Appended content here." } }) }
  })
} | ConvertTo-Json -Depth 10
Invoke-RestMethod -Uri "https://api.notion.com/v1/blocks/$pageId/children" -Method Patch -Headers $headers -Body $payload
```

## Examples

**"Show me all In Progress tasks in my Notion project database"**
→ Use step 4 with a Status filter. Ask for database ID from the Notion URL.

**"Create a new meeting notes page in Notion for today"**
→ Use step 5 to create a page, then step 6 to append an agenda block.

**"Search my Notion workspace for anything about Q2 planning"**
→ Use step 2 with query `Q2 planning`.

## Cautions

- Integration must be explicitly shared with each page/database — it won't see everything by default
- Page IDs are the 32-character hex string at the end of Notion URLs
- API rate limit is 3 requests/second per integration — add delays for bulk operations
- Rich text properties have nested structure — always check `rich_text[0].plain_text` for text values
