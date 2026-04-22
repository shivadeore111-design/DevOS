---
name: greynoise
description: Classify IP addresses as internet scanners (benign/malicious) or targeted attackers — filters noise from security alerts
category: security
version: 1.0.0
origin: aiden
tags: security, greynoise, scanner, threat-intel, ip, osint, soc, incident-response, noise-filtering
env_required:
  - GREYNOISE_API_KEY
---

# GreyNoise — Internet Scanner Intelligence

GreyNoise collects and analyses internet-wide scan traffic. It tells you whether an IP hitting your firewall is a known mass-scanner (benign research tool or malicious crawler) versus a targeted attacker — helping SOC teams filter out internet noise from real threats.

**Community tier:** The `/v3/community/{ip}` endpoint works with limited volume even without a key. Set `GREYNOISE_API_KEY` for higher rate limits.

## When to Use

- An IP triggers a firewall rule and you want to know if it is just background internet noise
- SOC triage: is this alert a known scanner or a targeted attack?
- Filter false positives from SIEM before escalating an alert
- User asks "is this IP a scanner?", "is this noisy traffic?", "is IP X benign?"

## How to Use

### Check if an IP is a known internet scanner

```powershell
$ip      = "71.6.135.131"
$headers = @{}
if ($env:GREYNOISE_API_KEY) { $headers['key'] = $env:GREYNOISE_API_KEY }

$result = Invoke-RestMethod -Uri "https://api.greynoise.io/v3/community/$ip" -Headers $headers
Write-Host "IP:             $($result.ip)"
Write-Host "Noise:          $($result.noise)"        # true = mass-scanner
Write-Host "RIOT:           $($result.riot)"         # true = trusted benign service
Write-Host "Classification: $($result.classification)"  # benign | malicious | unknown
Write-Host "Name:           $($result.name)"
Write-Host "Last seen:      $($result.last_seen)"
Write-Host "Link:           $($result.link)"
Write-Host "Message:        $($result.message)"
```

### Triage a batch of IPs from a firewall log

```powershell
$ips = @("1.1.1.1", "8.8.8.8", "71.6.135.131", "45.83.66.42")
$headers = @{}
if ($env:GREYNOISE_API_KEY) { $headers['key'] = $env:GREYNOISE_API_KEY }

foreach ($ip in $ips) {
    try {
        $r = Invoke-RestMethod -Uri "https://api.greynoise.io/v3/community/$ip" -Headers $headers
        $tag = if ($r.riot) { '[RIOT-trusted]' } elseif ($r.noise) { '[SCANNER]' } else { '[TARGETED?]' }
        Write-Host "$ip  $tag  $($r.classification)  $($r.name)"
    } catch {
        Write-Host "$ip  [ERROR]  $($_.Exception.Message)"
    }
    Start-Sleep -Milliseconds 200
}
```

### Interpret the results

```
noise = true   → IP is a known mass-scanner (benign researchers, crawlers, etc.)
riot  = true   → IP belongs to a trusted service (Cloudflare, Google, AWS, etc.)
classification = "malicious"  → Known malicious scanner — block and investigate
classification = "benign"     → Probably safe background noise — may deprioritise
classification = "unknown"    → No data — treat with caution
```

## Examples

**"Is 71.6.135.131 an attacker?"**
→ Returns classification: malicious, noise: true — known malicious scanner.

**"This IP keeps hitting our web server — is it just background noise?"**
→ `noise: true` means it is scanning the whole internet, not targeting you specifically.

**"Is 8.8.8.8 a threat?"**
→ `riot: true` — belongs to Google DNS, trusted RIOT (Rule It Out) list.

## Cautions

- Community endpoint returns limited data — `GREYNOISE_API_KEY` unlocks full context
- `noise: false` and `riot: false` does not mean the IP is malicious — GreyNoise may simply have no data for it
- Data reflects GreyNoise's scanner observations — gaps exist for low-volume IPs
- Free community endpoint: ~50 lookups/day per source IP without a key

## Requirements

- No key required for low-volume community lookups
- `GREYNOISE_API_KEY` — free community key at https://viz.greynoise.io/account
