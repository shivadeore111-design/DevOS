---
name: urlscan
description: Submit URLs for automated malware and phishing analysis, then retrieve safety verdicts and screenshots via urlscan.io
category: security
version: 1.0.0
origin: aiden
tags: security, malware, phishing, url, scan, osint, urlscan, threat-intel
env_required:
  - URLSCAN_API_KEY
---

# URL Safety Scanner (urlscan.io)

Submit any URL for analysis and receive a safety verdict, screenshot, and DNS/HTTP metadata. Uses the [urlscan.io](https://urlscan.io) API.

**Requires:** Free `URLSCAN_API_KEY` — sign up at urlscan.io, no credit card needed.

## When to Use

- User receives a suspicious link and wants to check it safely
- User wants to verify if a URL is phishing or malware
- User asks "is this link safe?" or "scan this URL for threats"
- Security review of links before sharing them
- OSINT: see what a URL looks like without visiting it yourself

## How to Use

### Submit a URL for scanning

```powershell
$url    = "https://suspicious-site.example.com"
$key    = $env:URLSCAN_API_KEY
$body   = '{"url": "' + $url + '", "visibility": "unlisted"}'

$submit = Invoke-RestMethod -Uri "https://urlscan.io/api/v1/scan/" `
    -Method POST `
    -Headers @{ "API-Key" = $key; "Content-Type" = "application/json" } `
    -Body $body

Write-Host "Scan submitted!"
Write-Host "UUID:    $($submit.uuid)"
Write-Host "Results: $($submit.result)"
Write-Host "Waiting 30 seconds for scan to complete..."
Start-Sleep -Seconds 30
```

### Retrieve scan results after waiting

```powershell
$uuid   = "PASTE-UUID-FROM-SUBMIT-STEP"
$key    = $env:URLSCAN_API_KEY

$result = Invoke-RestMethod -Uri "https://urlscan.io/api/v1/result/$uuid/" `
    -Headers @{ "API-Key" = $key }

Write-Host "Final URL:   $($result.page.url)"
Write-Host "IP:          $($result.page.ip)"
Write-Host "Country:     $($result.page.country)"
Write-Host "Malicious:   $($result.verdicts.overall.malicious)"
Write-Host "Phishing:    $($result.verdicts.overall.phishing)"
Write-Host "Score:       $($result.verdicts.overall.score)"
Write-Host "Screenshot:  https://urlscan.io/screenshots/$uuid.png"
```

### One-shot: submit and wait for result

```powershell
function Scan-Url {
    param([string]$TargetUrl, [string]$ApiKey = $env:URLSCAN_API_KEY)

    $body   = '{"url": "' + $TargetUrl + '", "visibility": "unlisted"}'
    $submit = Invoke-RestMethod -Uri "https://urlscan.io/api/v1/scan/" `
        -Method POST -Headers @{ "API-Key" = $ApiKey; "Content-Type" = "application/json" } `
        -Body $body
    $uuid = $submit.uuid

    Write-Host "Scanning $TargetUrl (uuid: $uuid)..."
    Start-Sleep -Seconds 30

    $result = Invoke-RestMethod -Uri "https://urlscan.io/api/v1/result/$uuid/" `
        -Headers @{ "API-Key" = $ApiKey }

    [PSCustomObject]@{
        URL       = $result.page.url
        IP        = $result.page.ip
        Malicious = $result.verdicts.overall.malicious
        Phishing  = $result.verdicts.overall.phishing
        Score     = $result.verdicts.overall.score
        Report    = "https://urlscan.io/result/$uuid/"
    }
}

Scan-Url -TargetUrl "https://example.com"
```

## Examples

**"Check if this link is safe: https://bit.ly/abc123"**
→ Submit with visibility "unlisted", wait 30 seconds, retrieve result.

**"Scan this suspicious email link for phishing"**
→ Use the one-shot function above. If `Phishing = True`, warn the user.

**"I want to see what this URL looks like without clicking it"**
→ Submit the scan, then use the screenshot URL: `https://urlscan.io/screenshots/{uuid}.png`

## Cautions

- Scans take 20–60 seconds to complete — always wait before fetching results
- `"visibility": "public"` makes the scan visible to all urlscan.io users — use `"unlisted"` for sensitive URLs
- Do not scan URLs that contain personal data or credentials in query parameters
- Free tier allows ~5 scans per minute — add delays for bulk scanning
- The API key is required to submit scans; public search results are accessible without a key

## Requirements

- `URLSCAN_API_KEY` — free account at https://urlscan.io (no credit card required)
