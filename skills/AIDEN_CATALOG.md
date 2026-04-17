# Aiden Skills Catalog — Wave 1

> 20 Aiden-exclusive skills shipped in v3.5.0. Zero npm dependencies. Auto-loaded by skillLoader.ts on startup.

---

## Windows Native Skills (10)

| Skill | Description | Tags |
|-------|-------------|------|
| **outlook-native** | Read and manage Outlook calendar and inbox via PowerShell COM interop or Microsoft Graph API | outlook, calendar, email, inbox, meeting, schedule, microsoft |
| **powershell-pro** | Expert PowerShell operations — process management, services, WMI queries, REST calls, scheduled tasks, and script automation | powershell, process, wmi, service, automation, scripting, windows, rest |
| **onenote** | Read and write OneNote notebooks, sections, and pages via Microsoft Graph API or COM automation | onenote, notes, notebook, microsoft, graph, pages, sections |
| **wsl-bridge** | Run Linux commands inside WSL from Windows, share files between Windows and WSL, and manage WSL distributions | wsl, linux, ubuntu, bash, bridge, windows, distro, shell |
| **taskscheduler** | Create, list, enable, disable, and delete Windows Task Scheduler jobs using PowerShell ScheduledTasks module | taskscheduler, scheduled, task, automation, cron, windows, powershell, trigger |
| **clipboard-history** | Read, write, and manage Windows clipboard content including text, HTML, images, and clipboard history via PowerShell | clipboard, copy, paste, history, windows, powershell, text |
| **windows-registry** | Read, write, and query Windows Registry keys and values via PowerShell Registry provider | registry, regedit, windows, powershell, hklm, hkcu, settings, config |
| **windows-services** | List, start, stop, restart, and configure Windows services via PowerShell Get-Service and Set-Service | services, windows, powershell, daemon, startup, get-service, set-service |
| **defender-quickscan** | Trigger Windows Defender scans, check threat history, update signatures, and query protection status via PowerShell | defender, antivirus, security, scan, threat, malware, windows, powershell |
| **network-diagnostics** | Diagnose Windows network issues — ping, traceroute, DNS lookup, port scan, interface info, and connection testing via PowerShell | network, diagnostics, ping, dns, traceroute, port, connectivity, powershell, netstat |

---

## Indian Market Skills (10)

| Skill | Description | Tags |
|-------|-------------|------|
| **nse-scanner** | Scan NSE for top gainers, losers, volume surges, and 52-week highs/lows using NSE public APIs | nse, stock, india, scanner, gainers, losers, equity, market, screener |
| **nse-options** | Fetch NSE options chain data, analyze OI buildup, PCR ratio, max pain, and IV for Nifty and BankNifty | nse, options, derivatives, oi, pcr, maxpain, nifty, banknifty, iv, chain |
| **zerodha-kite** | Interact with Zerodha Kite Connect API — fetch holdings, positions, place/modify orders, and get live quotes | zerodha, kite, broker, india, trading, orders, holdings, positions, equity, portfolio |
| **upstox** | Interact with Upstox API v2 — fetch portfolio, live market data, place orders, and check P&L | upstox, broker, india, trading, orders, portfolio, equity, fno, market |
| **archon-bridge** | Bridge between Aiden and Indian broker platforms for unified portfolio aggregation and order routing | archon, broker, portfolio, aggregation, zerodha, upstox, angel, india, trading, unified |
| **nse-fii-dii** | Fetch FII and DII daily buying/selling activity from NSE to gauge institutional flow | fii, dii, institutional, flow, nse, india, equity, market, foreign |
| **nse-delivery** | Fetch NSE delivery percentage data to identify stocks with high delivery volume vs intraday noise | nse, delivery, volume, equity, india, stock, bulk, block |
| **india-economic-calendar** | Track upcoming Indian economic events — RBI policy dates, CPI/WPI releases, GDP data, Union Budget, and NSE expiry calendar | india, rbi, economic, calendar, cpi, gdp, budget, expiry, monetary, policy |
| **indian-tax-calc** | Calculate Indian income tax, capital gains tax (STCG/LTCG), advance tax, and TDS for FY 2025-26 | tax, india, income-tax, capital-gains, stcg, ltcg, itr, advance-tax, tds, fy2526 |
| **nse-corporate-actions** | Fetch NSE corporate actions — dividends, bonus issues, stock splits, rights issues, and buybacks | nse, corporate-actions, dividend, bonus, split, rights, buyback, india, equity |

---

## Loader Notes

- All skills live under `skills/<skill-name>/SKILL.md`
- Auto-detected by `core/skillLoader.ts` at startup — no registration required
- `origin` is auto-set to `'aiden'` for all skills in the `skills/` directory
- Skills are matched to user queries via `tags` + `description` keyword scoring in `findRelevant()`

---

*Last updated: v3.5.0 — Wave 1 (April 2026)*
