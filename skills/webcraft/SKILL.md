---
name: webcraft
description: Clone any website as a React + Tailwind app
version: 1.0.0
author: DevOS
tags: web, clone, react, scrape
---
Scrapes a URL, extracts design system, generates matching React + Tailwind app.
Triggers: "clone", "recreate", "build something like", "copy the design of"

## Parameters

- `url` (required) — The website URL to clone
- `projectName` (optional, default: "my-clone") — Name for the generated project

## Steps

1. Fetch the target URL using browserFetcher (stealth Playwright)
2. Extract design system: colors (hex), typography, layout sections, component structure
3. Match base template via blueprintStore (e.g. "react frontend single-page")
4. Generate a complete React + Tailwind `App.tsx` that mirrors the design
5. Write component files into `workspace/<projectName>/src/`
6. Verify build passes with `npm run build`

## Output

Generates a runnable React + Tailwind project at `workspace/<projectName>/`.
Run with: `cd workspace/<projectName> && npm install && npm run dev`
