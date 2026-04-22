---
name: securityheaders
description: Audit HTTP security headers for any URL and receive a grade (A+ to F) with specific recommendations for missing headers
category: security
version: 1.0.0
origin: aiden
tags: security, http, headers, csp, hsts, xframe, audit, web, hardening, compliance
---

# Security Headers — HTTP Header Audit

Check any website for missing or misconfigured HTTP security headers. Returns a grade from A+ to F with a list of which headers are present, which are absent, and why each matters for protection against XSS, clickjacking, MIME sniffing, and data leakage.

**No API key required.** Powered by securityheaders.com.

## When to Use

- Audit a website before a security review or penetration test
- Verify that a newly deployed application has the correct security headers
- Check compliance with security baselines (OWASP, NIST, CIS)
- User asks "check security headers for X", "is example.com missing HSTS?", "grade the headers on my site"

## How to Use

### Check security headers for a URL

```powershell
$target  = "https://taracod.com"
$encoded = [Uri]::EscapeDataString($target)
$url     = "https://securityheaders.com/?q=$encoded&followRedirects=on&hide=on"

$response = Invoke-WebRequest -Uri $url -UseBasicParsing
# Extract grade from HTML badge
$grade = if ($response.Content -match 'class="[^"]*reportTitle[^"]*"[^>]*>[\s\S]*?label[^"]*"([^"]+)"') {
    $Matches[1] -replace 'label[- ]', '' -replace 'success', 'A' -replace 'warning', 'B/C' -replace 'danger', 'D/F'
} else { 'check manually' }

Write-Host "URL:   $target"
Write-Host "Grade: $grade"
Write-Host "Full report: $url"
```

### Audit headers and list missing ones

```powershell
$target   = "https://example.com"
$encoded  = [Uri]::EscapeDataString($target)
$response = Invoke-WebRequest -Uri "https://securityheaders.com/?q=$encoded&followRedirects=on&hide=on" -UseBasicParsing
$html     = $response.Content

# Extract missing headers (rows marked as warnings/missing)
$pattern  = '<div[^>]*class="[^"]*missing[^"]*"[^>]*>([\s\S]*?)<\/div>'
$missing  = [regex]::Matches($html, $pattern) | ForEach-Object {
    $_.Groups[1].Value -replace '<[^>]+>', '' -replace '\s+', ' '
} | Where-Object { $_.Trim() }

Write-Host "Missing headers:"
$missing | ForEach-Object { Write-Host "  ✗ $($_.Trim())" }
Write-Host ""
Write-Host "Report: https://securityheaders.com/?q=$encoded&followRedirects=on"
```

### Key security headers and what they do

```
Strict-Transport-Security  → Forces HTTPS; prevents downgrade attacks
Content-Security-Policy    → Restricts content sources; blocks XSS
X-Frame-Options            → Prevents clickjacking (deprecated by CSP)
X-Content-Type-Options     → Blocks MIME-sniffing attacks
Referrer-Policy            → Controls referrer data leakage
Permissions-Policy         → Restricts browser feature access (camera, location, etc.)
```

## Examples

**"Audit security headers for taracod.com"**
→ Returns grade, lists present and missing headers with fix suggestions.

**"Does github.com have Content-Security-Policy?"**
→ Check the headers report — CSP row shows value if present.

**"My site is getting an F — what headers am I missing?"**
→ Audit returns the full missing-headers list with descriptions.

**"Check HSTS on my production domain"**
→ Look for Strict-Transport-Security in the report — check max-age value.

## Cautions

- `hide=on` prevents results from appearing in the public "recent scans" feed — always use it
- `followRedirects=on` ensures the final destination URL is scanned, not just the redirect
- The tool scans what headers are **sent** — not what your server config says it should send
- Rate-limit: do not hammer the free service; add delays when scanning multiple URLs
- Grade is based on header presence, not perfect configuration — review values manually

## Requirements

- None — no API key needed
