---
name: cveapi
description: Look up CVE vulnerability details by ID via MITRE CVE API with NVD fallback — severity, CVSS score, affected products, and references
category: security
version: 1.0.0
origin: aiden
tags: security, cve, vulnerability, nvd, mitre, cvss, patch, incident-response, compliance
---

# CVE API — Vulnerability Lookup

Look up any CVE (Common Vulnerabilities and Exposures) by ID to get severity, CVSS score, affected products, and reference links. Uses the MITRE CVE API (cveawg.mitre.org) with automatic fallback to the NVD (National Vulnerability Database) for richer data.

**No API key required.** Optionally set `NVD_API_KEY` for higher rate limits on the NVD endpoint.

## When to Use

- User asks about a specific CVE by ID (e.g. "what is CVE-2021-44228?")
- Security team needs severity and CVSS score for patch prioritization
- Incident response: quickly triage whether a reported CVE is critical
- Compliance audit: confirm affected software versions for a given vulnerability
- User asks "is this CVE critical?", "what does CVE-XXXX-XXXXX affect?"

## How to Use

### Look up a single CVE (MITRE CVE API)

```powershell
$cveId = "CVE-2021-44228"
$url   = "https://cveawg.mitre.org/api/cve/$cveId"

$result = Invoke-RestMethod -Uri $url
$cna    = $result.containers.cna
$desc   = ($cna.descriptions | Where-Object { $_.lang -eq 'en' } | Select-Object -First 1).value
$cvss   = $cna.metrics | ForEach-Object {
    $_.PSObject.Properties | Where-Object { $_.Name -like 'cvssV3*' } |
    Select-Object -First 1 -ExpandProperty Value
} | Select-Object -First 1

Write-Host "CVE:          $($result.cveMetadata.cveId)"
Write-Host "State:        $($result.cveMetadata.state)"
Write-Host "Published:    $($result.cveMetadata.datePublished)"
Write-Host "Score:        $($cvss.baseScore) ($($cvss.baseSeverity))"
Write-Host "Description:  $desc"
Write-Host "References:   $(($cna.references | Select-Object -First 3 -ExpandProperty url) -join ', ')"
```

### Look up via NVD (richer data, optional API key)

```powershell
$cveId   = "CVE-2021-44228"
$headers = @{}
if ($env:NVD_API_KEY) { $headers['apiKey'] = $env:NVD_API_KEY }

$url    = "https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=$cveId"
$result = Invoke-RestMethod -Uri $url -Headers $headers
$cve    = $result.vulnerabilities[0].cve
$desc   = ($cve.descriptions | Where-Object { $_.lang -eq 'en' } | Select-Object -First 1).value
$metric = $cve.metrics.cvssMetricV31[0].cvssData

Write-Host "CVE:       $($cve.id)"
Write-Host "Published: $($cve.published)"
Write-Host "Score:     $($metric.baseScore) ($($metric.baseSeverity))"
Write-Host "Vector:    $($metric.vectorString)"
Write-Host "Desc:      $($desc.Substring(0, [Math]::Min(200, $desc.Length)))..."
```

### Batch lookup — check multiple CVEs

```powershell
$cveIds = @("CVE-2021-44228", "CVE-2023-4863", "CVE-2024-3094")

foreach ($id in $cveIds) {
    try {
        $url    = "https://cveawg.mitre.org/api/cve/$id"
        $result = Invoke-RestMethod -Uri $url
        $cna    = $result.containers.cna
        $cvss   = ($cna.metrics | Where-Object { $_.PSObject.Properties.Name -like 'cvssV3*' } |
                   Select-Object -First 1).PSObject.Properties.Value | Select-Object -First 1
        Write-Host "$id  Score: $($cvss.baseScore ?? 'N/A')  ($($cvss.baseSeverity ?? 'UNKNOWN'))"
    } catch {
        Write-Host "$id  ERROR: $($_.Exception.Message)"
    }
    Start-Sleep -Milliseconds 200   # polite rate limiting
}
```

## Examples

**"Look up CVE-2021-44228"**
→ Returns Log4Shell details: CVSS 10.0 CRITICAL, affects Apache Log4j 2.x.

**"What's the severity of CVE-2023-4863?"**
→ Returns WebP heap buffer overflow: CVSS 8.8 HIGH, affects Chrome/libwebp.

**"Get details for CVE-2024-3094"**
→ Returns XZ Utils backdoor: CVSS 10.0 CRITICAL, supply-chain attack.

**"Is CVE-2024-12345 critical?"**
→ Looks up and reports severity tier: CRITICAL / HIGH / MEDIUM / LOW / NONE.

## Cautions

- MITRE CVE API has no documented rate limit — use 1–2 req/sec as a courtesy
- NVD has stricter rate limiting: 5 req/30s without a key, 50 req/30s with `NVD_API_KEY`
- Some CVEs are `RESERVED` (not yet disclosed) — the API returns limited data
- CVSS score may be absent for very new or disputed CVEs
- NVD and MITRE may have slightly different data — NVD is generally more complete

## Requirements

- No key required for basic use
- `NVD_API_KEY` (optional) — free at https://nvd.nist.gov/developers/request-an-api-key
