---
name: ssllabs
description: Comprehensive TLS/SSL analysis via Qualys SSL Labs — grades cipher suites, certificate chains, protocol versions, and known vulnerabilities
category: security
version: 1.0.0
license: Apache-2.0
origin: aiden
tags: security, ssl, tls, certificates, ssllabs, qualys, https, ciphers, heartbleed, poodle, compliance
---

# SSL Labs — TLS/SSL Deep Analysis

Qualys SSL Labs performs a comprehensive TLS/SSL scan and assigns a grade from A+ to F. It checks cipher suite strength, certificate validity and chain, protocol support (TLS 1.0–1.3), forward secrecy, and known vulnerabilities like Heartbleed, POODLE, DROWN, and LOGJAM.

**No API key required.** Scans can take 60–120 seconds for first-time analysis.

## When to Use

- Verify TLS configuration before or after a certificate renewal
- Compliance check: confirm TLS 1.0/1.1 is disabled, HSTS is set
- Incident response: check if a server is vulnerable to Heartbleed or POODLE
- User asks "what grade is my SSL?", "is the TLS cert on X valid?", "does site support TLS 1.3?"

## How to Use

### Start a scan and poll for results

```powershell
$host   = "github.com"
$apiUrl = "https://api.ssllabs.com/api/v3/analyze"

# Start new scan
$result = Invoke-RestMethod -Uri "$apiUrl`?host=$host&publish=off&startNew=on&all=done"
Write-Host "Status: $($result.status)"

# Poll until ready (may take 1-2 minutes)
while ($result.status -ne 'READY' -and $result.status -ne 'ERROR') {
    Start-Sleep -Seconds 20
    $result = Invoke-RestMethod -Uri "$apiUrl`?host=$host&publish=off&all=done"
    Write-Host "Status: $($result.status) — $(($result.endpoints | Measure-Object).Count) endpoint(s)"
}

$result.endpoints | ForEach-Object {
    Write-Host "  $($_.ipAddress)  Grade: $($_.grade)  $($_.statusMessage)"
}
```

### Check TLS protocols and known vulnerabilities

```powershell
$host   = "example.com"
$result = Invoke-RestMethod -Uri "https://api.ssllabs.com/api/v3/analyze?host=$host&publish=off&all=done"

while ($result.status -ne 'READY') {
    Start-Sleep -Seconds 15
    $result = Invoke-RestMethod -Uri "https://api.ssllabs.com/api/v3/analyze?host=$host&publish=off&all=done"
}

$ep = $result.endpoints[0]
Write-Host "Grade:      $($ep.grade)"
Write-Host "TLS protocols supported:"
$ep.details.protocols | ForEach-Object { Write-Host "  $($_.name) $($_.version)" }
Write-Host ""
Write-Host "Vulnerabilities:"
Write-Host "  Heartbleed:   $($ep.details.heartbleed)"
Write-Host "  POODLE (SSL): $($ep.details.poodleSsl)"
Write-Host "  FREAK:        $($ep.details.freak)"
Write-Host "  LOGJAM:       $($ep.details.logjam)"
Write-Host "  DROWN:        $($ep.details.drownVulnerable)"
```

### Get the direct report URL (instant — no waiting)

```powershell
$host    = "taracod.com"
$encoded = [Uri]::EscapeDataString($host)
$url     = "https://www.ssllabs.com/ssltest/analyze.html?d=$encoded&hideResults=on&ignoreMismatch=on"
Write-Host "Open in browser: $url"
Start-Process $url
```

## Examples

**"What SSL grade does github.com get?"**
→ Scan and poll — typically returns A+ in ~90 seconds.

**"Is my server vulnerable to Heartbleed?"**
→ Scan and check `endpoints[0].details.heartbleed` — should be false.

**"Does this server still support TLS 1.0?"**
→ Check `endpoints[0].details.protocols` — TLS 1.0 and 1.1 should be absent for A grade.

**"Just give me the SSL Labs link for my site"**
→ Use `quickScan` — returns the browser URL instantly without waiting.

## Cautions

- First-time scans for a new host take 60–120 seconds — cached results return in seconds
- `publish=off` is essential — without it, results appear on the public leaderboard
- SSL Labs API rate limits: 1 request per 2 seconds — do not spam the poll loop
- Scans from the same IP on the same host within 24h return cached results by default
- A READY result with `gradeTrustIgnored` different from `grade` means there is a certificate trust issue

## Requirements

- None — no API key needed
- For bulk scanning, respect the rate limits or use the direct URL and view in browser
