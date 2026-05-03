---
name: shodan
description: Search Shodan for internet-connected devices, open ports, and services — host lookups and database queries
category: security
version: 1.0.0
license: Apache-2.0
origin: aiden
tags: security, shodan, osint, recon, ports, services, iot, asset-discovery, cve, infosec
env_required:
  - SHODAN_API_KEY
---

# Shodan — Internet Device Search

Shodan indexes internet-connected devices and exposes metadata: open ports, running services, banners, TLS certificates, and known CVEs. Use it for security audits, reconnaissance, and asset discovery.

**Requires:** `SHODAN_API_KEY` — free tier at https://account.shodan.io (1 req/sec, 100 queries/month).

## When to Use

- User wants to know what ports/services are exposed on a specific IP
- User wants to find vulnerable systems of a specific type (e.g. exposed databases)
- User is doing a security audit and needs external exposure info
- User asks "what does Shodan show for IP X" or "find exposed Redis servers"
- Asset discovery: find all internet-exposed assets for a company/ASN

## How to Use

### Look up a specific IP address

```powershell
$ip  = "8.8.8.8"
$key = $env:SHODAN_API_KEY
$url = "https://api.shodan.io/shodan/host/${ip}?key=${key}"

$host = Invoke-RestMethod -Uri $url
Write-Host "IP:           $($host.ip_str)"
Write-Host "Organization: $($host.org)"
Write-Host "OS:           $($host.os)"
Write-Host "Country:      $($host.country_name)"
Write-Host "Open ports:   $($host.ports -join ', ')"
Write-Host ""
Write-Host "Services:"
$host.data | ForEach-Object {
    Write-Host "  Port $($_.port)/$($_.transport) — $($_.product) $($_.version)"
}
```

### Search for exposed services by query

```powershell
$query = [Uri]::EscapeDataString("port:27017 product:MongoDB")
$key   = $env:SHODAN_API_KEY
$url   = "https://api.shodan.io/shodan/host/search?query=${query}&key=${key}"

$results = Invoke-RestMethod -Uri $url
Write-Host "Total results: $($results.total)"
$results.matches | Select-Object -First 10 | ForEach-Object {
    Write-Host "  $($_.ip_str):$($_.port) — $($_.org) ($($_.location.country_name))"
}
```

### Find CVEs on a host

```powershell
$ip   = "TARGET_IP"
$key  = $env:SHODAN_API_KEY
$host = Invoke-RestMethod -Uri "https://api.shodan.io/shodan/host/${ip}?key=${key}"

if ($host.vulns) {
    Write-Host "CVEs found on ${ip}:"
    $host.vulns.PSObject.Properties | ForEach-Object { Write-Host "  $($_.Name)" }
} else {
    Write-Host "No known CVEs found for ${ip}"
}
```

### Useful Shodan search filters

```
port:22 country:IN                  SSH servers in India
product:nginx version:1.14          Specific nginx version
org:"Amazon"                        Amazon-owned IPs
ssl.cert.subject.cn:*.example.com   Certs for a domain
http.title:"Dashboard" port:80      Web dashboards on port 80
vuln:CVE-2021-44228                 Log4Shell vulnerable hosts
```

## Examples

**"What is exposed on IP 1.2.3.4?"**
→ Use the host lookup. Shows open ports, services, OS.

**"Find all MongoDB servers with no auth"**
→ Query: `port:27017 product:MongoDB -authentication`

**"Search for Apache servers in India"**
→ Query: `product:Apache country:IN`

**"Does this IP have any known CVEs?"**
→ Use the CVE snippet above on the target IP.

## Cautions

- Free tier: 100 queries/month and 1 request/second — add `Start-Sleep -Milliseconds 1100` between bulk calls
- Shodan data is cached — it reflects the last scan date, not necessarily the current state
- Host lookups and scans data about publicly reachable services only — no active scanning is performed by this skill
- Never use Shodan results to attempt unauthorized access; this skill is for reconnaissance and awareness only
- The `vulns` field only appears when Shodan has matched CVE data to the service banner

## Requirements

- `SHODAN_API_KEY` — free account at https://account.shodan.io
