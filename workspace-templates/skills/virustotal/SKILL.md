---
name: virustotal
description: Check file hashes, URLs, domains, and IP addresses against 70+ antivirus engines and threat intelligence feeds via VirusTotal
category: security
version: 1.0.0
license: Apache-2.0
origin: aiden
tags: security, virustotal, malware, antivirus, threat-intel, hash, url, domain, ip, incident-response
env_required:
  - VIRUSTOTAL_API_KEY
---

# VirusTotal — Threat Intelligence

VirusTotal aggregates results from 70+ antivirus engines and threat intelligence feeds. Check file hashes, URLs, domains, and IP addresses for known malware, phishing, and suspicious activity.

**Requires:** `VIRUSTOTAL_API_KEY` — free at https://www.virustotal.com/gui/my-apikey (4 req/min on free tier).

## When to Use

- User has a file hash and wants to know if it is malware
- User has a suspicious URL and wants a reputation check
- User is investigating an incident and needs threat context for a domain or IP
- User asks "is this hash malicious?", "check this URL", or "is this domain flagged?"
- SOC/IR workflow: triage IOCs (indicators of compromise) quickly

## How to Use

### Check a file hash (MD5, SHA-1, or SHA-256)

```powershell
$hash = "44d88612fea8a8f36de82e1278abb02f"   # EICAR test file
$key  = $env:VIRUSTOTAL_API_KEY
$url  = "https://www.virustotal.com/api/v3/files/$hash"

$result = Invoke-RestMethod -Uri $url -Headers @{ "x-apikey" = $key }
$stats  = $result.data.attributes.last_analysis_stats
Write-Host "File: $($result.data.attributes.meaningful_name)"
Write-Host "Malicious:  $($stats.malicious) / $($stats.malicious + $stats.undetected + $stats.harmless)"
Write-Host "Suspicious: $($stats.suspicious)"
Write-Host "First seen: $($result.data.attributes.first_submission_date)"
```

### Check a URL for malware or phishing

```powershell
$targetUrl = "https://example.com"
$key       = $env:VIRUSTOTAL_API_KEY

# URL id = URL-safe base64 without padding
$bytes  = [System.Text.Encoding]::UTF8.GetBytes($targetUrl)
$b64    = [Convert]::ToBase64String($bytes).Replace('+','-').Replace('/','_').TrimEnd('=')
$url    = "https://www.virustotal.com/api/v3/urls/$b64"

$result = Invoke-RestMethod -Uri $url -Headers @{ "x-apikey" = $key }
$stats  = $result.data.attributes.last_analysis_stats
Write-Host "URL: $targetUrl"
Write-Host "Malicious:  $($stats.malicious)"
Write-Host "Phishing:   $($result.data.attributes.categories -join ', ')"
Write-Host "Reputation: $($result.data.attributes.reputation)"
```

### Check a domain's reputation

```powershell
$domain = "example.com"
$key    = $env:VIRUSTOTAL_API_KEY
$url    = "https://www.virustotal.com/api/v3/domains/$domain"

$result = Invoke-RestMethod -Uri $url -Headers @{ "x-apikey" = $key }
$attrs  = $result.data.attributes
Write-Host "Domain:     $domain"
Write-Host "Reputation: $($attrs.reputation)"
Write-Host "Categories: $($attrs.categories.PSObject.Properties.Value -join ', ')"
$stats  = $attrs.last_analysis_stats
Write-Host "Malicious:  $($stats.malicious) engines"
```

### Check an IP address

```powershell
$ip  = "1.1.1.1"
$key = $env:VIRUSTOTAL_API_KEY
$url = "https://www.virustotal.com/api/v3/ip_addresses/$ip"

$result = Invoke-RestMethod -Uri $url -Headers @{ "x-apikey" = $key }
$attrs  = $result.data.attributes
$stats  = $attrs.last_analysis_stats
Write-Host "IP:           $ip"
Write-Host "AS Owner:     $($attrs.as_owner)"
Write-Host "Country:      $($attrs.country)"
Write-Host "Reputation:   $($attrs.reputation)"
Write-Host "Malicious:    $($stats.malicious) engines"
```

## Examples

**"Is hash 44d88612fea8a8f36de82e1278abb02f malware?"**
→ Use the file hash check — malicious count > 0 means confirmed threats.

**"Check if https://suspicious-login.com is phishing"**
→ Use the URL check — look at `malicious` and `phishing` categories.

**"I got an alert for domain evil-c2.net — is it known bad?"**
→ Use the domain check — look at reputation score and malicious engine count.

**"This IP keeps hitting our firewall — is it a known attacker?"**
→ Use the IP check — `reputation < 0` and high malicious count = treat as threat.

## Cautions

- Free tier rate limit: 4 requests per minute — add `Start-Sleep -Seconds 16` between calls when checking multiple IOCs
- VirusTotal results reflect last scan time; for fresh analysis you must submit (POST /files or POST /urls) — not covered here
- A clean result (0 detections) does not guarantee safety — new malware may not yet be in the database
- File hashes are public — never submit sensitive files directly; only submit the hash
- Reputation score: positive = clean, 0 = neutral, negative = suspicious/malicious

## Requirements

- `VIRUSTOTAL_API_KEY` — free account at https://www.virustotal.com/gui/join-us
