---
name: censys
description: Search Censys for internet-exposed hosts, certificates, and services — host lookups, queries, and certificate analysis
category: security
version: 1.0.0
license: Apache-2.0
origin: aiden
tags: security, censys, osint, recon, ports, certificates, tls, asset-discovery, internet-scan
env_required:
  - CENSYS_API_ID
  - CENSYS_API_SECRET
---

# Censys — Internet Asset Discovery

Censys continuously scans the public internet and indexes detailed metadata about every reachable host: open ports, running services, TLS certificates, and BGP routing information. Complementary to Shodan with different scanner vantage points and richer certificate data.

**Requires:** `CENSYS_API_ID` and `CENSYS_API_SECRET` — free tier at https://search.censys.io/register (0.4 req/sec, 250 queries/month).

## When to Use

- Look up what Censys sees on a specific IP address
- Discover internet-exposed assets for a given organisation or ASN
- Investigate TLS certificates — find all hosts sharing a certificate or subject
- Security audit: verify which services are visible from the public internet
- User asks "what does Censys show for IP X", "find hosts with this certificate", "look up ASN exposure"

## How to Use

### Look up a specific host by IP

```powershell
$ip       = "8.8.8.8"
$id       = $env:CENSYS_API_ID
$secret   = $env:CENSYS_API_SECRET
$b64      = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${id}:${secret}"))
$headers  = @{ Authorization = "Basic $b64" }

$result = Invoke-RestMethod -Uri "https://search.censys.io/api/v2/hosts/$ip" -Headers $headers
$r      = $result.result
Write-Host "IP:           $($r.ip)"
Write-Host "AS:           $($r.autonomous_system.name) (ASN $($r.autonomous_system.asn))"
Write-Host "Country:      $($r.location.country)"
Write-Host "Open ports:"
$r.services | ForEach-Object {
    Write-Host "  $($_.port)/$($_.transport_protocol) — $($_.service_name)"
}
```

### Search with a query string

```powershell
$query    = "services.service_name: HTTP and location.country_code: IN"
$b64      = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("$($env:CENSYS_API_ID):$($env:CENSYS_API_SECRET)"))
$headers  = @{ Authorization = "Basic $b64" }
$encoded  = [Uri]::EscapeDataString($query)

$result = Invoke-RestMethod -Uri "https://search.censys.io/api/v2/hosts/search?q=$encoded" -Headers $headers
Write-Host "Total matches: $($result.result.total)"
$result.result.hits | Select-Object -First 10 | ForEach-Object {
    Write-Host "  $($_.ip) — $($_.autonomous_system.name) ($($_.location.country_name))"
}
```

### Look up a TLS certificate by SHA-256 fingerprint

```powershell
$sha256  = "YOUR_CERT_SHA256_HERE"
$b64     = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("$($env:CENSYS_API_ID):$($env:CENSYS_API_SECRET)"))
$headers = @{ Authorization = "Basic $b64" }

$result = Invoke-RestMethod -Uri "https://search.censys.io/api/v2/certificates/$sha256" -Headers $headers
$parsed = $result.result.parsed
Write-Host "Subject:   $($parsed.subject_dn)"
Write-Host "Issuer:    $($parsed.issuer_dn)"
Write-Host "Valid:     $($parsed.validity.start) → $($parsed.validity.end)"
Write-Host "SANs:      $($parsed.names_from_san -join ', ')"
```

## Examples

**"What is exposed on IP 1.2.3.4?"**
→ Host lookup: returns open ports, service names, ASN, and location.

**"Find all exposed Redis servers in Germany"**
→ Query: `services.service_name: REDIS and location.country_code: DE`

**"Who else uses this TLS certificate?"**
→ Certificate lookup by SHA-256 fingerprint — shows SAN names and validity.

**"Show me all hosts in ASN 15169"**
→ Query: `autonomous_system.asn: 15169`

## Cautions

- Free tier: 250 queries/month, 0.4 req/sec — pace bulk operations with `Start-Sleep -Milliseconds 2500`
- Censys data reflects last scan date — real-time state may differ
- Host lookup counts against your monthly quota
- Certificate search may return expired or revoked certs — check validity dates
- Never use Censys results to attempt unauthorised access; recon and awareness only

## Requirements

- `CENSYS_API_ID` and `CENSYS_API_SECRET` — free account at https://search.censys.io/register
