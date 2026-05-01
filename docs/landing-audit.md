# Landing Page Content Audit — v3.19.0

**Source:** https://aiden.taracod.com (curl snapshot, 2026-05-01)  
**Scope:** Content drift only. UI/theme/layout/fonts/colors are OUT-OF-SCOPE.  
**Action:** User reviews → approve/reject each item → text-only edits in a separate commit.

---

## Drift Items

### 1. Meta description — tool count

**Line:** 7  
**Element:** `<meta name="description" ...>`  
**Current:** `"80+ tools"`  
**Proposed:** `"89+ tools"`  
**Reason:** Tool registry ships 89 tools as of v3.19 Phase 1.

---

### 2. Stats block — tool count

**Line:** 299  
**Element:** `<em>80+</em>` (built-in tools stat)  
**Current:** `80+`  
**Proposed:** `89+`  
**Reason:** Same as #1.

---

### 3. Stats block — skills count

**Line:** 300  
**Element:** `<em>1,400+</em>` (skills stat)  
**Current:** `1,400+`  
**Proposed:** `1,500+`  
**Reason:** Skills repo count at time of v3.19 ship.

---

### 4. Body copy — skills reference

**Line:** 318  
**Context:** Paragraph body text  
**Current:** `"1,400+ skills."`  
**Proposed:** `"1,500+ skills."`  
**Reason:** Same as #3.

---

### 5. Body copy — combined count string

**Line:** 338  
**Context:** Inline marketing copy  
**Current:** `"1,400+ skills · 80+ tools"`  
**Proposed:** `"1,500+ skills · 89+ tools"`  
**Reason:** Both counts stale.

---

### 6. Provider pills — total count

**Line:** 432  
**Element:** Provider pill/badge  
**Current:** `"14+ total"` providers  
**Proposed:** `"15+"` providers  
**Reason:** Stats block at line 298 already says `15+` — the pill at 432 is inconsistent. NVIDIA NIM was promoted from executor-only to chat slots in v3.19, raising the usable provider count.  
**Note:** Confirm the canonical number before editing. If stats block (298) is correct at `15+`, pill (432) needs to match.

---

### 7. Instant actions count — NEEDS MANUAL VERIFICATION

**Line:** 499  
**Current:** `"15 instant actions"`  
**Status:** ⚠️ **Verify before editing**  
**Reason:** v3.19 Phase 3 removed 5 *fake* InstantActions (screenshot, volume_up, volume_down, mute, lock_screen) — they now route to real handlers that surface real errors rather than silently pretending to work. If these 5 are still exposed as instant actions (just honest ones), the count stays 15. If they were removed from the instant-action dispatch table entirely, the count drops to 10.  
**Action required:** Check `core/agentLoop.ts` instant-action list to confirm current count before changing this line.

---

### 8. Footer / secondary copy — skills count

**Line:** 944  
**Context:** Footer or secondary marketing section  
**Current:** `"1,400+ skills"`  
**Proposed:** `"1,500+ skills"`  
**Reason:** Same as #3.

---

### 9. Linux AppImage download link — version

**Line:** 1113  
**Element:** `href` on AppImage download button  
**Current:** hardcoded `v3.16.0` in URL  
**Proposed:** `v3.19.0`  
**Reason:** Release `v3.19.0` was created on `taracodlabs/aiden-releases` today. Download links are hardcoded, not dynamic.  
**Example pattern:** `https://github.com/taracodlabs/aiden-releases/releases/download/v3.16.0/Aiden-3.16.0.AppImage`  
→ `https://github.com/taracodlabs/aiden-releases/releases/download/v3.19.0/Aiden-3.19.0.AppImage`

---

### 10. Linux .deb download link — version

**Line:** 1113  
**Element:** `href` on .deb download button (same line as AppImage or adjacent)  
**Current:** hardcoded `v3.16.0` in URL  
**Proposed:** `v3.19.0`  
**Reason:** Same as #9.  
**Example pattern:** `https://github.com/taracodlabs/aiden-releases/releases/download/v3.16.0/aiden_3.16.0_amd64.deb`  
→ `https://github.com/taracodlabs/aiden-releases/releases/download/v3.19.0/aiden_3.19.0_amd64.deb`

---

### 11. Combined count string — footer/CTA area

**Line:** 1126  
**Context:** Footer CTA or closing section  
**Current:** `"1,400+ skills · 80+ tools · 15+ providers"`  
**Proposed:** `"1,500+ skills · 89+ tools · 15+ providers"`  
**Reason:** Skills and tools counts stale. Provider count (15+) already correct here.

---

## No-change items (verified accurate)

| Element | Value | Status |
|---------|-------|--------|
| Channel status: Web Dashboard | `● Live` | ✅ Accurate |
| Channel status: Telegram | `● Live` | ✅ Accurate |
| Channel status: WhatsApp | `● Live` | ✅ Accurate |
| Channel status: Discord | `● Live` | ✅ Accurate |
| Channel status: Slack | `● Live` | ✅ Accurate |
| Channel status: Email | `● Live` | ✅ Accurate |
| Stats block provider count (line 298) | `15+` | ✅ Accurate |

No "coming soon" labels found on any channel. All 6 live channels correctly marked.  
No explicit slash command count (91) found in the HTML — no stale count to fix.

---

## OUT-OF-SCOPE (do not touch)

- All CSS, colors, fonts, spacing, layout, component structure
- Any icon or image assets
- Animation or interaction behavior
- Non-content HTML attributes (class, id, data-*, aria-*)

---

## Summary

| # | Line | Fix type | Priority |
|---|------|----------|----------|
| 1 | 7 | meta description tool count | Low (SEO) |
| 2 | 299 | stats tool count | High (visible) |
| 3 | 300 | stats skills count | High (visible) |
| 4 | 318 | body copy skills | Medium |
| 5 | 338 | body copy combined | Medium |
| 6 | 432 | provider pill count | Medium |
| 7 | 499 | instant actions — verify first | ⚠️ Blocked |
| 8 | 944 | footer skills count | Medium |
| 9 | 1113 | AppImage download version | High (broken link) |
| 10 | 1113 | .deb download version | High (broken link) |
| 11 | 1126 | footer CTA combined counts | Medium |

**Highest priority:** Items 9 and 10 — download links point to `v3.16.0` assets that may not exist on the releases page. Users clicking "Download for Linux" get a 404 or old binary.
