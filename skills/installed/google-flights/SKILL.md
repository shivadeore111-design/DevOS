---
name: google-flights
description: Search Google Flights for flight prices and schedules using browser automation. Use when user asks to search flights, find airfare, compare prices, check flight availability, or look up routes. Triggers include "search flights", "find flights", "how much is a flight", "flights from X to Y", "cheapest flight", "flight prices", "airfare", "flight schedule", "nonstop flights", "when should I fly".
category: travel
tags: flights, airfare, booking, travel, airline, airport, google-flights, nonstop, itinerary
allowed-tools: Bash(agent-browser:*)
enabled: true
source: github:skillhub/flight-search
imported-from: github:skillhub/flight-search
---

# Google Flights Search

**Tool**: `shell_exec` — run `agent-browser` commands (NOT web_search)

```bash
# Typical usage — 2 commands for domestic, 3 for international
agent-browser --session flights open "https://www.google.com/travel/flights?q=Flights+from+BOM+to+DXB+on+2026-12-20+one+way" && agent-browser --session flights wait --load networkidle
agent-browser --session flights snapshot -i
```

Search Google Flights via agent-browser to find flight prices, schedules, and availability.

## When to Use

- User asks to search/find/compare flights or airfare
- User wants to know flight prices between cities
- User asks about flight schedules or availability
- User wants to find the cheapest flight for specific dates

## When NOT to Use

- **Completing purchases**: Find flights and provide booking links — do not complete a purchase
- **Hotels/rental cars**: Use the hotels skill for accommodation
- **Historical price data**: Google Flights shows current prices only

## Session Convention

- **Economy only** (domestic, default): `--session flights`
- **Economy + Business comparison** (international or user requests): `--session econ` + `--session biz`

## Domestic vs International

**Domestic** = both origin and destination are US airports. Show economy only by default. Show business class when user asks for it or it's an international route.

## Fast Path: URL-Based Search (Preferred)

```
https://www.google.com/travel/flights?q=Flights+from+{ORIGIN}+to+{DEST}+on+{DATE}[+returning+{DATE}][+one+way][+business+class][+N+passengers]
```

Supports: round trip, one way, business/first class, N passengers, adults+children, IATA codes, city names, YYYY-MM-DD dates.
Does NOT support via URL: premium economy, multi-city.

### Domestic (economy only) — 2 tool calls

```bash
agent-browser --session flights open "https://www.google.com/travel/flights?q=Flights+from+MIA+to+SFO+on+2026-04-28+returning+2026-04-30" && agent-browser --session flights wait --load networkidle
agent-browser --session flights snapshot -i
```

### International (economy + business) — 3 tool calls

```bash
(agent-browser --session econ open "https://www.google.com/travel/flights?q=Flights+from+BOM+to+DXB+on+2026-12-20" && agent-browser --session econ wait --load networkidle) &
(agent-browser --session biz open "https://www.google.com/travel/flights?q=Flights+from+BOM+to+DXB+on+2026-12-20+business+class" && agent-browser --session biz wait --load networkidle) &
wait
agent-browser --session econ snapshot -i &
agent-browser --session biz snapshot -i &
wait
agent-browser --session biz close
```

### Output Format

Parse snapshot `link` elements (each flight = one `link` with airline, times, duration, price). Present as compact list:

```
1. Air India — Nonstop · 3h 10m
   6:00 AM → 8:10 AM
   Economy: ₹8,250 · Business: ₹42,000 (+409%)

2. Emirates — 1 stop · 7h 25m
   10:00 PM → 3:25 AM+1
   Economy: ₹12,100 · Business: ₹58,500 (+383%)

3. IndiGo — Nonstop · 3h 05m
   9:15 AM → 12:20 PM
   Economy: ₹7,800 · Business: —
```

Economy-only format (domestic): `Airline — Stops · Duration\nTimes · Price`

## Booking Links Handoff

After results, always offer: "Want booking links for any of these? Just say which one."

When user picks a flight:
```bash
agent-browser --session flights click @eN   # click the flight link from snapshot
agent-browser --session flights wait 3000
agent-browser --session flights snapshot -i
```

Extract provider name, price, and URL from the booking panel links.

## Interactive Fallback

Use for: multi-city, premium economy, or when URL path fails.

```bash
agent-browser --session flights open "https://www.google.com/travel/flights"
agent-browser --session flights wait 3000
agent-browser --session flights snapshot -i
# 1. Set trip type (combobox: Round trip / One way / Multi-city)
# 2. Set cabin class and passengers (if non-default)
# 3. Enter airports: click field → fill "BOM" → wait 2s → snapshot → click suggestion
# 4. Set dates: click date field → click calendar date → click "Done"
# 5. Click "Search" button ("Done" only closes calendar — search is separate)
agent-browser --session flights wait --load networkidle
agent-browser --session flights snapshot -i
```

Key rules: use `fill` not `type` for airports; always click suggestions (never press Enter); wait 2s after typing for autocomplete; re-snapshot after every interaction.

## Key Rules

| Rule | Why |
|------|-----|
| Prefer URL fast path | 2-3 calls vs 15+ interactive |
| Chain `open && wait` with `&&` | Saves a round-trip |
| Skip business for domestic | US domestic business is 3-5x cost, rarely needed unless asked |
| Parallel snapshots with `&` + `wait` | Both run concurrently for international |
| `wait --load networkidle` | Smarter than fixed `wait 5000` |
| Keep results session alive | Needed for booking clicks; close `biz` after price delta extracted |
| Always offer booking links after results | Users almost always want to book |

## Troubleshooting

- **Consent popup**: Click "Accept all" or "Reject all"
- **URL fast path failed**: Fall back to interactive — some regions handle `?q=` differently
- **No results**: Verify airports, dates are in the future, or wait longer
- **CAPTCHA**: Inform user. Do NOT solve. Retry after a short wait.

For annotated walkthroughs, airport autocomplete edge cases, calendar navigation, and multi-city steps — see `references/interaction-patterns.md`.
