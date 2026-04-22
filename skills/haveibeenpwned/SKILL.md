---
name: haveibeenpwned
description: Check if an email address or username appears in known data breaches using the Have I Been Pwned v3 API
category: security
version: 1.0.0
origin: aiden
tags: security, breach, pwned, email, password, leak, osint, hibp
env_required:
  - HIBP_API_KEY
---

# Have I Been Pwned — Breach Checker

Look up whether an email address has appeared in any publicly known data breaches. Uses the [Have I Been Pwned](https://haveibeenpwned.com) v3 API.

**Requires:** `HIBP_API_KEY` in `.env` — $3.50/month subscription at haveibeenpwned.com/API/Key

## When to Use

- User wants to know if their email was part of a data breach
- User wants a list of breaches an email was found in
- User is auditing accounts before a security review
- User asks "was my email leaked" or "has X been pwned"

## How to Use

### Check a single email for breaches

```powershell
$email = "user@example.com"
$key   = $env:HIBP_API_KEY
$url   = "https://haveibeenpwned.com/api/v3/breachedaccount/$([Uri]::EscapeDataString($email))?truncateResponse=false"

$result = Invoke-RestMethod -Uri $url -Headers @{ "hibp-api-key" = $key } -ErrorAction SilentlyContinue

if ($null -eq $result) {
    Write-Host "✅ $email was NOT found in any known data breaches."
} else {
    Write-Host "⚠️  $email found in $($result.Count) breach(es):"
    $result | ForEach-Object {
        Write-Host "   • $($_.Name) ($($_.BreachDate)) — $($_.DataClasses -join ', ')"
    }
}
```

### Check which passwords were exposed (pastes)

```powershell
$email = "user@example.com"
$key   = $env:HIBP_API_KEY
$url   = "https://haveibeenpwned.com/api/v3/pasteaccount/$([Uri]::EscapeDataString($email))"

$result = Invoke-RestMethod -Uri $url -Headers @{ "hibp-api-key" = $key } -ErrorAction SilentlyContinue

if ($null -eq $result) {
    Write-Host "✅ No paste exposures found for $email"
} else {
    Write-Host "Found in $($result.Count) paste(s):"
    $result | Select-Object Source, Title, Date | Format-Table
}
```

### Bulk check a list of emails from a file

```powershell
$key   = $env:HIBP_API_KEY
$emails = Get-Content "emails.txt"

foreach ($email in $emails) {
    Start-Sleep -Milliseconds 1600   # respect 1 req/1.5s rate limit
    $url = "https://haveibeenpwned.com/api/v3/breachedaccount/$([Uri]::EscapeDataString($email))"
    $res = Invoke-RestMethod -Uri $url -Headers @{ "hibp-api-key" = $key } -ErrorAction SilentlyContinue
    $status = if ($res) { "PWNED ($($res.Count) breaches)" } else { "Clean" }
    Write-Host "$email — $status"
}
```

## Examples

**"Check if test@example.com has been in any breaches"**
→ Run the single-email check above with that address.

**"Was my email leaked in the Adobe breach?"**
→ Run the single check; then filter: `$result | Where-Object Name -eq 'Adobe'`

**"Check all emails in a file for breaches"**
→ Use the bulk check snippet — it respects the 1.5s rate limit automatically.

## Cautions

- API key is required — there is no free anonymous tier for the v3 breached-account endpoint
- Rate limit is 1 request per 1.5 seconds — always add `Start-Sleep -Milliseconds 1600` in loops
- HTTP 404 means the email was not found (not an error) — `Invoke-RestMethod -ErrorAction SilentlyContinue` handles this silently
- HIBP does not store plaintext passwords — it only records breach metadata and data class types
- For password hash checks (k-anonymity model), use the `/range/{hash5}` endpoint — no API key required

## Requirements

- `HIBP_API_KEY` — subscribe at https://haveibeenpwned.com/API/Key ($3.50/month)
