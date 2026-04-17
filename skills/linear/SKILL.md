---
name: linear
description: Manage Linear issues, projects, and cycles via the Linear GraphQL API
category: productivity
version: 1.0.0
origin: aiden
license: Apache-2.0
tags: linear, issues, project-management, graphql, engineering, sprint, cycle, team, tasks
---

# Linear Issue Tracking

Query and mutate Linear data — issues, projects, cycles, and teams — using the Linear GraphQL API. Requires `LINEAR_API_KEY` set as an environment variable.

## When to Use

- User wants to list open issues in a Linear team or project
- User wants to create a new Linear issue
- User wants to update issue status or priority
- User wants to see issues assigned to them
- User wants to look up current cycle/sprint progress

## How to Use

### 1. Set API key

Generate a Personal API key at https://linear.app/settings/api — select `read` and `write` scopes.

```powershell
$env:LINEAR_API_KEY = "lin_api_..."
```

### 2. Run a GraphQL query helper

All Linear API calls are POST to `https://api.linear.app/graphql`.

```powershell
function Invoke-Linear($query, $variables = @{}) {
  $body    = @{ query = $query; variables = $variables } | ConvertTo-Json -Depth 10
  $headers = @{ "Authorization" = $env:LINEAR_API_KEY; "Content-Type" = "application/json" }
  (Invoke-RestMethod -Uri "https://api.linear.app/graphql" -Method Post -Headers $headers -Body $body).data
}
```

### 3. List my assigned issues

```powershell
$q = '{ viewer { assignedIssues(first: 20, filter: { state: { type: { in: ["started","unstarted"] } } }) { nodes { identifier title priority state { name } } } } }'
(Invoke-Linear $q).viewer.assignedIssues.nodes | Format-Table identifier, title, priority
```

### 4. List issues in a team

```powershell
$q = 'query($key:String!) { team(key:$key) { issues(first:30, filter:{state:{type:{in:["started","unstarted"]}}}) { nodes { identifier title assignee { name } state { name } } } } }'
(Invoke-Linear $q @{ key = "ENG" }).team.issues.nodes | Format-Table identifier, title
```

### 5. Create a new issue

```powershell
# First get teamId
$teamQ = '{ teams { nodes { id key name } } }'
$teams = (Invoke-Linear $teamQ).teams.nodes
$teamId = ($teams | Where-Object key -eq "ENG").id

$mutation = 'mutation($input:IssueCreateInput!) { issueCreate(input:$input) { issue { identifier title url } } }'
$vars = @{ input = @{ teamId = $teamId; title = "Fix login timeout bug"; description = "Users are being logged out after 5 min of inactivity."; priority = 2 } }
(Invoke-Linear $mutation $vars).issueCreate.issue
```

### 6. Update issue state

```powershell
# Get state IDs for the team first
$stateQ = 'query($key:String!) { team(key:$key) { states { nodes { id name } } } }'
$states = (Invoke-Linear $stateQ @{ key = "ENG" }).team.states.nodes
$doneId = ($states | Where-Object name -eq "Done").id

$mutation = 'mutation($id:String! $stateId:String!) { issueUpdate(id:$id input:{stateId:$stateId}) { issue { identifier state { name } } } }'
(Invoke-Linear $mutation @{ id = "ENG-42"; stateId = $doneId }).issueUpdate.issue
```

### 7. List current cycle

```powershell
$q = 'query($key:String!) { team(key:$key) { activeCycle { name startsAt endsAt progress issues(first:50) { nodes { identifier title state { name } } } } } }'
(Invoke-Linear $q @{ key = "ENG" }).team.activeCycle | Select-Object name, progress
```

## Examples

**"Show me all my open Linear issues"**
→ Use steps 2–3 to list viewer's assigned unstarted/in-progress issues.

**"Create a Linear issue: 'Update onboarding flow' in the PRODUCT team"**
→ Use step 5 — fetch team ID for PRODUCT, then create with given title.

**"What's the progress on the current sprint?"**
→ Use step 7 — ask user for their team key, then show activeCycle progress.

## Cautions

- Linear API keys are personal — they act as the user who created them
- Priority values: 0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low
- Issue IDs look like `ENG-42` but mutations need the UUID — always fetch UUID from the issues list
- GraphQL depth limit is ~6 levels — avoid deeply nested queries
