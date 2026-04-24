---
name: google-hotels
description: Search Google Hotels for hotel prices, ratings, and availability using browser automation. Use when user asks to search hotels, find accommodation, compare hotel prices, check availability, or look up places to stay. Triggers include "search hotels", "find hotels", "hotels in", "where to stay", "accommodation", "hotel prices", "cheapest hotel", "best hotel", "places to stay", "hotel near", "book a hotel", "hotel ratings".
category: travel
tags: hotels, booking, travel, accommodation, google-hotels, hotel-search, places-to-stay
allowed-tools: Bash(agent-browser:*), Bash(echo*), Bash(printf*)
enabled: true
source: github:skillhub/hotel-search
imported-from: github:skillhub/hotel-search
---

# Google Hotels Search

Search Google Hotels via agent-browser to find hotel prices, ratings, amenities, and availability.

## When to Use

- User asks to search, find, or compare hotels or accommodation
- User wants hotel prices in a city, neighborhood, or near a landmark
- User asks about hotel availability for specific dates
- User wants the best-rated or cheapest hotel in an area

## When NOT to Use

- **Booking**: This skill searches only — never complete a purchase
- **Vacation rentals / Airbnb**: Google Hotels shows hotels, not rentals
- **Flights**: Use the google-flights skill
- **Historical prices**: Google Hotels shows current prices only
- **NEVER leave Google Hotels during search** — do not navigate to Booking.com, Expedia, Hotels.com, or any OTA as a search workaround. Exception: after results, you MAY visit a hotel's own website for direct booking/promo checks.

## Session Convention

Always use `--session hotels` for isolation.

## URL Fast Path (Preferred)

Build a URL with location and dates encoded. Loads results in 3 commands.

### Encoding Dates in the URL

Google Hotels uses a protobuf-encoded `ts` parameter. Use this bash function to generate it:

```bash
hotel_ts() {
  local ci_y=$1 ci_m=$2 ci_d=$3 co_y=$4 co_m=$5 co_d=$6 nights=$7
  local cyl=$(printf '%02x' $(( ($ci_y & 0x7f) | 0x80 )))
  local cyh=$(printf '%02x' $(($ci_y >> 7)))
  local col=$(printf '%02x' $(( ($co_y & 0x7f) | 0x80 )))
  local coh=$(printf '%02x' $(($co_y >> 7)))
  echo -n "08011a200a021a00121a12140a0708${cyl}${cyh}10$(printf '%02x' $ci_m)18$(printf '%02x' $ci_d)120708${col}${coh}10$(printf '%02x' $co_m)18$(printf '%02x' $co_d)18$(printf '%02x' $nights)32020801" \
    | xxd -r -p | base64 | tr -d '\n='
}
# hotel_ts CHECKIN_YEAR MONTH DAY CHECKOUT_YEAR MONTH DAY NIGHTS
# hotel_ts 2026 3 15 2026 3 20 5  → CAEaIAoCGgASGhIUCgcI6g8QAxgPEgcI6g8QAxgUGAUyAggB
```

Years 2025-2030, months 1-12, days 1-31, nights 1-127.

### Example: Hotels in Bangkok, March 15-20

```bash
ts=$(hotel_ts 2026 3 15 2026 3 20 5)
agent-browser --session hotels open "https://www.google.com/travel/search?q=Hotels+in+Bangkok&qs=CAE4AA&ts=${ts}&ap=MAE"
agent-browser --session hotels wait --load networkidle
agent-browser --session hotels snapshot -i
agent-browser --session hotels close
```

### Location Formats

City: `Hotels+in+Bangkok` | Neighborhood: `Hotels+in+Shibuya+Tokyo` | Near landmark: `Hotels+near+Eiffel+Tower` | Specific hotel: `Haus+im+Tal+Munich`

### Without Dates

Omit `ts`, `qs`, `ap` parameters — shows "starting from" prices:

```bash
agent-browser --session hotels open "https://www.google.com/travel/search?q=Hotels+in+Bangkok"
agent-browser --session hotels wait --load networkidle
agent-browser --session hotels snapshot -i
```

## Result Format

```
| # | Hotel | Stars | Rating | Price/Night | Total | Via | Key Amenities |
|---|-------|-------|--------|-------------|-------|-----|---------------|
| 1 | Sukhothai Bangkok | ★★★★★ | 9.2 | $185 | $925 | Hotels.com | Pool, Spa, WiFi |
| 2 | Centara Grand | ★★★★★ | 8.8 | $165 | $825 | Booking.com | Pool, Gym, WiFi |
| 3 | Ibis Sukhumvit | ★★★ | 7.4 | $45 | $225 | Agoda | WiFi, Restaurant |
```

## Key Rules

| Rule | Why |
|------|-----|
| Prefer URL fast path with `ts=` | 3 commands with dates vs 10+ interactive |
| `wait --load networkidle` | Smarter than fixed `wait 5000` |
| Use `fill` not `type` for text inputs | Clears existing text first |
| Wait 2s after typing location | Autocomplete needs API roundtrip |
| Click suggestions, never Enter | Enter is unreliable for autocomplete |
| Re-snapshot after every interaction | DOM changes invalidate refs |
| Check for "View prices" | Means dates aren't set yet |
| **Never leave Google Hotels during search** | OTA navigation during search breaks flow |
| Calendar navigation with "<" / ">" | May open on wrong month — navigate and re-snapshot |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Consent popup | Click "Accept all" or "Reject all" |
| URL fast path fails | Fall back to `google.com/travel/hotels` interactive flow |
| No results / "View prices" | Set check-in and check-out dates interactively |
| Calendar on wrong month | Use "<" / ">" arrows; re-snapshot after navigating |
| Calendar overlay blocking snapshot | Press Escape, re-snapshot, re-open date picker |
| CAPTCHA | Inform user. Do NOT solve. Retry after a short wait. |
| Map view instead of list | Click "List" or "View list" toggle |

## Post-Search: Direct Booking Check

After presenting results, offer: "Want me to check [hotel]'s direct website for promo codes or member rates? Direct booking is often cheaper."

```bash
agent-browser --session direct open "https://www.example-hotel.com"
agent-browser --session direct wait --load networkidle
agent-browser --session direct snapshot -i
agent-browser --session direct close
```

Look for: direct booking price (often 5-15% cheaper), promo banners, "Book Direct" incentives, loyalty member rates. For chain hotels (IHG, Marriott, Hilton, Accor, Hyatt), mention their loyalty programs.

For full interactive workflow (calendar navigation, guest/room selector, filters), see `references/interaction-patterns.md`.
