---
name: google-flights
description: Search Google Flights for flight prices and schedules using browser automation. Use when user asks to search flights, find airfare, compare prices, check flight availability, or look up routes. Triggers include "search flights", "find flights", "how much is a flight", "flights from X to Y", "cheapest flight", "flight prices", "airfare", "flight schedule", "nonstop flights", "when should I fly".
category: travel
tags: flights, airfare, booking, travel, airline, airport, google-flights, nonstop, itinerary
allowed-tools: Bash(agent-browser:*)
enabled: true
source: github:skillhq/flight-search
imported-from: github:skillhq/flight-search
---

# Google Flights Search

Search Google Flights via agent-browser to find flight prices, schedules, and availability.

## When to Use

- User asks to search/find/compare flights or airfare
- User wants to know flight prices between cities
- User asks about flight schedules or availability
- User wants to find the cheapest flight for specific dates

## When NOT to Use

- **Completing purchases**: This skill finds flights and extracts booking links, but do not attempt to complete a purchase on a booking site.
- **Hotels/rental cars**: Use other tools for non-flight travel searches.
- **Historical price data**: Google Flights shows current prices, not historical.

## Session Convention

- **Economy only** (default for domestic): `--session flights`
- **Economy + Business comparison** (international or user requests): `--session econ` and `--session biz`
- **Interactive fallback**: `--session flights`

## Domestic vs International Detection

**Domestic flights default to economy only.** Business class on US domestic routes is typically 3-5x the price and rarely worth showing unless asked.

A flight is **domestic** if both origin and destination are US airports. Common US IATA codes: ATL, BOS, BWI, CLT, DEN, DFW, DTW, EWR, FLL, HNL, IAD, IAH, JFK, LAS, LAX, LGA, MCO, MDW, MIA, MSP, OAK, ORD, PHL, PHX, PDX, SAN, SEA, SFO, SJC, SLC, TPA.

**When to show business class:**
- International flights (always show economy + business comparison)
- User explicitly asks for "business class" or "business"
- User asks to "compare cabins" or "show all classes"

**When to skip business class:**
- Domestic US flights (economy only by default)
- User explicitly asks for "economy" or "cheapest"

## Fast Path: URL-Based Search (Preferred)

Construct a URL with a natural language `?q=` parameter. Loads results directly — **3 commands total**.

### URL Template

```
https://www.google.com/travel/flights?q=Flights+from+{ORIGIN}+to+{DEST}+on+{DATE}[+returning+{DATE}][+one+way][+business+class][+N+passengers]
```

### Default: Economy Only (Domestic)

For domestic flights, run a single session - **2 tool calls total**:

```bash
# Open and wait in one call
agent-browser --session flights open "https://www.google.com/travel/flights?q=Flights+from+MIA+to+SFO+on+2026-04-28+returning+2026-04-30" && agent-browser --session flights wait --load networkidle

# Snapshot results
agent-browser --session flights snapshot -i
# Keep session alive for booking links
```

Then present results in **compact list format** (see Output Format section below).

### Economy + Business Comparison (International)

For international flights, run two parallel sessions to show the price delta:

```bash
# Open both and wait in parallel
(agent-browser --session econ open "https://www.google.com/travel/flights?q=Flights+from+BKK+to+NRT+on+2026-03-20+returning+2026-03-27" && agent-browser --session econ wait --load networkidle) &
(agent-browser --session biz open "https://www.google.com/travel/flights?q=Flights+from+BKK+to+NRT+on+2026-03-20+returning+2026-03-27+business+class" && agent-browser --session biz wait --load networkidle) &
wait

# Snapshot both in parallel
agent-browser --session econ snapshot -i &
agent-browser --session biz snapshot -i &
wait

# Close biz (only needed for delta); keep econ alive for booking links
agent-browser --session biz close
```

**Matching logic**: Match flights by airline name and departure time. Not all economy flights have a business equivalent (budget carriers like ZIPAIR, Air Japan don't offer business). Show "-" when no business match exists.

**Tip**: When an airline appears in business results but not economy (e.g., Philippine Airlines), it may operate business-only pricing on that route. Include it with "-" for economy.

### One Way

Add `+one+way` to the URL. For international, run both economy and business in parallel:

```bash
# Domestic (economy only)
agent-browser --session flights open "https://www.google.com/travel/flights?q=Flights+from+LAX+to+JFK+on+2026-04-15+one+way" && agent-browser --session flights wait --load networkidle

# International (economy + business comparison)
(agent-browser --session econ open "https://www.google.com/travel/flights?q=Flights+from+LAX+to+LHR+on+2026-04-15+one+way" && agent-browser --session econ wait --load networkidle) &
(agent-browser --session biz open "https://www.google.com/travel/flights?q=Flights+from+LAX+to+LHR+on+2026-04-15+one+way+business+class" && agent-browser --session biz wait --load networkidle) &
wait
```

### When User Asks for Business Only

If the user specifically asks for business class (not a comparison), run just the business session:

```bash
agent-browser --session flights open "https://www.google.com/travel/flights?q=Flights+from+JFK+to+CDG+on+2026-06-01+returning+2026-06-15+business+class"
agent-browser --session flights wait --load networkidle
agent-browser --session flights snapshot -i
# Keep session alive for booking links
```

### First Class / Multiple Passengers

```bash
agent-browser --session flights open "https://www.google.com/travel/flights?q=Flights+from+JFK+to+CDG+on+2026-06-01+returning+2026-06-15+first+class+2+adults+1+child"
agent-browser --session flights wait --load networkidle
agent-browser --session flights snapshot -i
# Keep session alive for booking links
```

### What Works via URL

| Feature | URL syntax | Status |
|---------|-----------|--------|
| Round trip | `+returning+YYYY-MM-DD` | Works |
| One way | `+one+way` | Works |
| Business class | `+business+class` | Works |
| First class | `+first+class` | Works |
| N passengers (adults) | `+N+passengers` | Works |
| Adults + children | `+2+adults+1+child` | Works |
| IATA codes | `BKK`, `NRT`, `LAX` | Works |
| City names | `Bangkok`, `Tokyo` | Works |
| Dates as YYYY-MM-DD | `2026-03-20` | Works (best) |
| Natural dates | `March+20` | Works |
| **Premium economy** | `+premium+economy` | **Fails** |
| **Multi-city** | N/A | **Fails** |

### What Requires Interactive Fallback

- **Premium economy** cabin class
- **Multi-city** trips (3+ legs)
- **Infant passengers** (seat vs lap distinction)
- **URL didn't load results** (consent banner, CAPTCHA, locale issue)

### Reading Results from Snapshot

Each flight appears as a `link` element with a full description:

```
link "From 20508 Thai baht round trip total. Nonstop flight with Air Japan.
     Leaves Suvarnabhumi Airport at 12:10 AM on Friday, March 20 and arrives
     at Narita International Airport at 8:15 AM on Friday, March 20.
     Total duration 6 hr 5 min. Select flight"
```

Parse economy + business snapshots into the **compact list format**:

```
1. JAL — Nonstop · 5h 55m
   8:05 AM → 4:00 PM
   Economy: THB 23,255 · Business: THB 65,915 (+183%)

2. THAI — Nonstop · 5h 50m
   10:30 PM → 6:20 AM+1
   Economy: THB 28,165 · Business: THB 75,000 (+166%)

3. Air Japan — Nonstop · 6h 05m
   12:10 AM → 8:15 AM
   Economy: THB 20,515 · Business: —

4. ZIPAIR — Nonstop · 5h 45m
   11:45 PM → 7:30 AM+1
   Economy: THB 21,425 · Business: —
```

**Matching**: Pair economy and business results by airline + departure time. Budget carriers without business class show "—". Include "Best"/"Cheapest" labels from Google when present.

## Booking Options Handoff

After presenting the results table, **always offer booking links**: "Want booking links for any of these? Just say which one."

When the user picks a flight, extract booking options by clicking the flight's `link` element in the snapshot. Google Flights shows a panel with booking providers (airlines, OTAs) each with a price and a "Continue" link to the booking site.

### Workflow

```bash
# User picks flight #N — click the corresponding link from the results snapshot
# Use --session flights (domestic) or --session econ (international comparison)
agent-browser --session flights click @eN
agent-browser --session flights wait 3000
agent-browser --session flights snapshot -i
```

The booking panel snapshot will show `link` elements like:

```
link "Book with Emirates THB 28,960" → href="https://..."
link "Book with Booking.com THB 29,512" → href="https://..."
link "Book with Teaflight THB 28,171" → href="https://..."
```

Extract the provider name, price, and `href` URL from each link.

### Output Format

```
📋 Booking Options for JAL BKK→NRT (5h 55m, Nonstop)

| Provider | Price | Book |
|----------|-------|------|
| Emirates | THB 28,960 | [Continue](https://...) |
| Booking.com | THB 29,512 | [Continue](https://...) |
| Teaflight | THB 28,171 | [Continue](https://...) |
```

### Notes

- **Session lifecycle**: Keep the results session (`flights` or `econ`) alive for booking links. For international comparisons, close `--session biz` immediately after extracting prices. Close the results session after the user gets booking links or declines.
- **If booking panel fails to load**: Re-snapshot and wait longer before retrying.

## Interactive Workflow (Fallback)

Use for multi-city, premium economy, or when the URL path fails.

### Open and Snapshot

```bash
agent-browser --session flights open "https://www.google.com/travel/flights"
agent-browser --session flights wait 3000
agent-browser --session flights snapshot -i
```

If a consent banner appears, click "Accept all" or "Reject all" first.

### Set Trip Type (if not Round Trip)

```bash
agent-browser --session flights click @eN   # Trip type combobox ("Round trip")
agent-browser --session flights snapshot -i
agent-browser --session flights click @eN   # "One way" or "Multi-city"
agent-browser --session flights wait 1000
agent-browser --session flights snapshot -i
```

### Set Cabin Class / Passengers (if non-default)

**Cabin class:**
```bash
agent-browser --session flights click @eN   # Cabin class combobox
agent-browser --session flights snapshot -i
agent-browser --session flights click @eN   # Select class
agent-browser --session flights wait 1000
agent-browser --session flights snapshot -i
```

**Passengers:**
```bash
agent-browser --session flights click @eN   # Passengers button
agent-browser --session flights snapshot -i
agent-browser --session flights click @eN   # "+" for Adults/Children/Infants
agent-browser --session flights snapshot -i
agent-browser --session flights click @eN   # "Done"
agent-browser --session flights wait 1000
agent-browser --session flights snapshot -i
```

### Enter Airport (Origin or Destination)

```bash
agent-browser --session flights click @eN   # Combobox field
agent-browser --session flights wait 1000
agent-browser --session flights snapshot -i
agent-browser --session flights fill @eN "BKK"
agent-browser --session flights wait 2000   # CRITICAL: wait for autocomplete
agent-browser --session flights snapshot -i
agent-browser --session flights click @eN   # Click suggestion (NEVER press Enter)
agent-browser --session flights wait 1000
agent-browser --session flights snapshot -i
```

### Set Dates

```bash
agent-browser --session flights click @eN   # Date textbox
agent-browser --session flights wait 1000
agent-browser --session flights snapshot -i
# Calendar shows dates as buttons: "Friday, March 20, 2026"
agent-browser --session flights click @eN   # Click target date
agent-browser --session flights wait 500
agent-browser --session flights snapshot -i
# Click "Done" to close calendar
agent-browser --session flights click @eN   # "Done" button
agent-browser --session flights wait 1000
agent-browser --session flights snapshot -i
```

### Search

**"Done" only closes the calendar. You MUST click "Search" separately.**

```bash
agent-browser --session flights click @eN   # "Search" button
agent-browser --session flights wait --load networkidle
agent-browser --session flights snapshot -i
# Keep session alive for booking links
```

### Multi-City Specifics

After selecting "Multi-city" trip type, the form shows one row per leg:

- Each leg has: origin combobox, destination combobox, departure date textbox
- **Origins auto-fill** from the previous leg's destination
- Click "Add flight" to add more legs (default: 2 legs shown)
- Click "Remove flight from X to Y" buttons to remove legs
- Results show flights for the **first leg**, with prices reflecting the **total multi-city cost**

Fill each leg's destination + date in order, then click "Search".

## Output Format

**Always use compact list format** — never markdown tables. Output is typically displayed in chatbot interfaces (Telegram, etc.) where tables render poorly.

### Economy + Business comparison (default)

```
1. JAL — Nonstop · 5h 55m
   8:05 AM → 4:00 PM
   Economy: THB 23,255 · Business: THB 65,915 (+183%)

2. THAI — Nonstop · 5h 50m
   10:30 PM → 6:20 AM+1
   Economy: THB 28,165 · Business: THB 75,000 (+166%)

3. Air Japan — Nonstop · 6h 05m
   12:10 AM → 8:15 AM
   Economy: THB 20,515 · Business: —
```

### Economy only

```
1. JAL — Nonstop · 5h 55m
   8:05 AM → 4:00 PM · THB 23,255

2. THAI — Nonstop · 5h 50m
   10:30 PM → 6:20 AM+1 · THB 28,165
```

### Format rules

- One flight per numbered block, blank line between flights
- Line 1: Airline — Stops · Duration
- Line 2: Departure → Arrival times
- Line 3: Prices (economy, business delta if applicable)
- No code blocks around the flight list — plain text reads best
- Keep the "Best value" recommendation as a plain text paragraph after the list

## Key Rules

| Rule | Why |
|------|-----|
| Prefer URL fast path | 2 tool calls (domestic) or 3 (international) vs 15+ interactive |
| Chain open+wait with `&&` | Eliminates a round-trip between tool calls |
| Skip business for domestic | US domestic business is 3-5x price, rarely useful unless asked |
| Parallel snapshots with `&` + `wait` | Both snapshots run concurrently for international |
| `wait --load networkidle` | Smarter than fixed `wait 5000` - returns when network settles |
| Use `fill` not `type` for airports | Clears existing text first |
| Wait 2s after typing airport codes | Autocomplete needs API roundtrip |
| Always CLICK suggestions, never Enter | Enter is unreliable for autocomplete |
| Re-snapshot after every interaction | DOM changes invalidate refs |
| "Done" ≠ Search | Calendar Done only closes picker |
| After presenting results, offer booking links | Users almost always want to book - prompt them |
| Keep results session alive; close `biz` after results | Results session needed for booking clicks; biz only for delta |

## Troubleshooting

**Consent popups**: Click "Accept all" or "Reject all" in the snapshot.

**URL fast path didn't work**: Fall back to interactive. Some regions/locales handle `?q=` differently.

**No results**: Verify airports (check combobox labels), dates in the future, or wait longer.

**Bot detection / CAPTCHA**: Inform user. Do NOT solve CAPTCHAs. Retry after a short wait.

## Deep-Dive Reference

See [references/interaction-patterns.md](references/interaction-patterns.md) for:
- Full annotated walkthrough (every command + expected output)
- Airport autocomplete failure modes and recovery
- Date picker calendar navigation
- Multi-city searches
- Scrolling for more results
