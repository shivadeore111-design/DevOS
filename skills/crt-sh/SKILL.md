---
name: crt.sh
description: Search certificate transparency logs to enumerate subdomains and TLS certificates for any domain — no API key required
category: security
version: 1.0.0
origin: aiden
tags: security, osint, certificates, subdomains, tls, ssl, ct-logs, recon, crt.sh
---

# Certificate Transparency Search (crt.sh)

Query [crt.sh](https://crt.sh) to enumerate all TLS/SSL certificates ever issued for a domain. Certificate transparency logs are public — no API key or account needed.

## When to Use

- User wants to find all subdomains of a domain (recon / asset discovery)
- User wants to see what TLS certificates have been issued for their domain
- User is doing OSINT on an organization's infrastructure
- User asks "what subdomains does X have" or "find all certs for domain"
- Security audit: discover forgotten or misconfigured subdomains

## How to Use

### List all certificates for a domain

```powershell
$domain = "taracod.com"
$url    = "https://crt.sh/?q=$domain&output=json"

$certs = Invoke-RestMethod -Uri $url
Write-Host "Found $($certs.Count) certificate records"
$certs | Select-Object -First 10 | Format-Table id, name_value, not_before, not_after -AutoSize
```

### Extract unique subdomain names

```powershell
$domain = "taracod.com"
$url    = "https://crt.sh/?q=$([Uri]::EscapeDataString("*.$domain"))&output=json"

$certs  = Invoke-RestMethod -Uri $url
$names  = $certs | ForEach-Object { $_.name_value -split "`n" } |
          Sort-Object -Unique |
          Where-Object { $_ -ne "" -and $_ -ne "*.$domain" }

Write-Host "Unique subdomains / names ($($names.Count)):"
$names | ForEach-Object { Write-Host "  $_" }
```

### Search for certificates by organization (CA issuance)

```powershell
$domain  = "taracod.com"
$url     = "https://crt.sh/?q=$domain&output=json"
$certs   = Invoke-RestMethod -Uri $url

$certs | Select-Object issuer_name, not_before, not_after, name_value |
    Sort-Object not_before -Descending |
    Select-Object -First 20 |
    Format-Table -AutoSize
```

### Find recently issued certificates (last 30 days)

```powershell
$domain    = "example.com"
$url       = "https://crt.sh/?q=$domain&output=json"
$certs     = Invoke-RestMethod -Uri $url
$cutoff    = (Get-Date).AddDays(-30)

$recent = $certs | Where-Object {
    [datetime]$_.not_before -gt $cutoff
} | Select-Object name_value, not_before, issuer_name

Write-Host "Certificates issued in the last 30 days: $($recent.Count)"
$recent | Format-Table -AutoSize
```

## Examples

**"Find all subdomains for google.com"**
→ Use the subdomain extraction snippet with `$domain = "google.com"`.

**"What TLS certificates has github.com had?"**
→ Use the first snippet with `$domain = "github.com"` and look at `not_before`/`not_after`.

**"Show me recently issued certs for competitor.com"**
→ Use the "recently issued" snippet — useful for tracking new infrastructure.

## Cautions

- crt.sh is a free public service — do not hammer it with rapid requests; add a short delay between bulk queries
- Results include historical (expired) certificates unless you filter by `not_after`
- Wildcard certificates (`*.example.com`) are returned — the `name_value` field may contain multiple names separated by newlines
- Subdomains found here may no longer be active — always verify with DNS before assuming they are live
- Certificate transparency data is public by design; this is open-source intelligence, not hacking

## Requirements

- No API key required — crt.sh is fully public
- PowerShell's `Invoke-RestMethod` handles JSON parsing automatically
