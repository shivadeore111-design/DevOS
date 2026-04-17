---
name: network-diagnostics
description: Diagnose Windows network issues — ping, traceroute, DNS lookup, port scan, interface info, and connection testing via PowerShell
category: windows
version: 1.0.0
tags: network, diagnostics, ping, dns, traceroute, port, connectivity, powershell, netstat
---

# Network Diagnostics

Diagnose Windows network connectivity — test connections, resolve DNS, trace routes, check open ports, and inspect network interfaces — all from PowerShell.

## When to Use

- User reports internet or network connectivity issues
- User wants to test if a host or port is reachable
- User asks for their IP address, gateway, or DNS settings
- User wants to run a traceroute or DNS lookup
- User needs to check what processes are using which ports

## How to Use

### Test connectivity to a host
```powershell
Test-Connection -ComputerName "8.8.8.8" -Count 4
Test-Connection -ComputerName "google.com" -Count 4 | Select-Object Address, Latency, Status
```

### Test TCP port connectivity
```powershell
Test-NetConnection -ComputerName "github.com" -Port 443
Test-NetConnection -ComputerName "smtp.gmail.com" -Port 587
```

### Get network interface info
```powershell
Get-NetIPAddress | Where-Object AddressFamily -eq 'IPv4' |
  Select-Object InterfaceAlias, IPAddress, PrefixLength |
  Where-Object IPAddress -notmatch '^169|^127'
```

### Get default gateway
```powershell
Get-NetRoute -DestinationPrefix "0.0.0.0/0" |
  Select-Object InterfaceAlias, NextHop, RouteMetric
```

### DNS lookup
```powershell
Resolve-DnsName "google.com"
Resolve-DnsName "google.com" -Type MX   # Mail records
Resolve-DnsName "google.com" -Type TXT  # TXT records
```

### Flush DNS cache
```powershell
Clear-DnsClientCache
```

### Traceroute
```powershell
Test-NetConnection -ComputerName "8.8.8.8" -TraceRoute
```

### View active TCP connections (netstat equivalent)
```powershell
Get-NetTCPConnection -State Established |
  Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, State |
  Sort-Object LocalPort
```

### Find process using a port
```powershell
$port = 3000
$conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($conn) {
  $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
  Write-Host "Port $port is used by: $($proc.Name) (PID $($conn.OwningProcess))"
} else {
  Write-Host "Port $port is free"
}
```

### Check Wi-Fi signal strength
```powershell
netsh wlan show interfaces | Select-String "Signal|SSID|State"
```

### Reset network stack
```powershell
# Requires elevated session
# netsh int ip reset
# netsh winsock reset
Write-Host "To reset network stack, run the above commands in an elevated PowerShell session"
```

## Examples

**"Can I reach GitHub from this machine?"**
→ `Test-NetConnection -ComputerName "github.com" -Port 443` — checks both DNS resolution and TCP handshake.

**"What's my local IP and gateway?"**
→ `Get-NetIPAddress` for IP + `Get-NetRoute -DestinationPrefix "0.0.0.0/0"` for gateway.

**"Which process is listening on port 8080?"**
→ Find the `OwningProcess` from `Get-NetTCPConnection` and cross-reference with `Get-Process`.

## Cautions

- `Test-NetConnection -TraceRoute` can be slow (30+ seconds) for distant hosts — warn the user
- `Get-NetTCPConnection` shows socket-level connections; some processes use UDP (`Get-NetUDPEndpoint`)
- Network reset commands require an elevated session and will briefly drop all connections
- DNS changes may take time to propagate; `Clear-DnsClientCache` only clears the local resolver cache
