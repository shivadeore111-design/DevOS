# Aiden Icon Specification

## Design

- **Background**: `#0e0e0e` (near-black)
- **Shape**: Rounded rectangle, `#f97316` orange, corner radius ~22% of size
- **Text**: `A/` in JetBrains Mono Bold, white `#ffffff`, centered
- **Font size**: ~45% of icon height

## Required Sizes

| Size (px) | Use |
|-----------|-----|
| 16×16     | Windows taskbar, small icons |
| 32×32     | Standard desktop icon |
| 48×48     | Windows Explorer list view |
| 64×64     | Medium icons |
| 128×128   | Large icons |
| 256×256   | Extra-large, modern Windows |

All sizes must be in a single `.ico` file.

## Generation

### Step 1 — Generate PNG at recraft.ai or ideogram.ai

**Prompt (ideogram.ai, Magic prompt OFF):**
```
App icon. Dark square with slightly rounded corners. Background color #0e0e0e (very dark gray).
Large orange rounded rectangle (#f97316) centered, taking up 70% of the canvas.
White text "A/" in bold monospace font centered on the orange rectangle.
Clean, minimal, flat design. No gradients. No shadows. Suitable as a software icon.
```

**Prompt (recraft.ai):**
```
Software app icon. Dark background #0e0e0e. Orange (#f97316) rounded rectangle centered.
Bold white monospace text "A/" centered. Flat minimal icon style. Square format.
```

### Step 2 — Export as PNG

Export at 1024×1024 px for best quality.

### Step 3 — Convert PNG to ICO

Option A — icoconvert.com (free, online):
1. Go to https://icoconvert.com
2. Upload your 1024×1024 PNG
3. Select sizes: 16, 32, 48, 64, 128, 256
4. Download icon.ico

Option B — ImageMagick (local):
```
magick icon-1024.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

Option C — Greenfish Icon Editor Pro (Windows, free):
1. Open PNG
2. File > Save As > .ico
3. Check all required sizes

### Step 4 — Create BMP variants for Inno Setup

```powershell
# Requires ImageMagick
magick icon-1024.png -resize 55x58! -background "#0e0e0e" -flatten wizard-icon.bmp

# For the banner, create a 497x314 design or use this quick placeholder:
magick -size 497x314 xc:#0e0e0e `
  -fill '#f97316' -draw 'roundrectangle 20,20 80,70 10,10' `
  -fill white -font JetBrainsMono-Bold -pointsize 28 -gravity West `
  -annotate +30+0 'A/' `
  -fill '#888888' -font Outfit-Regular -pointsize 14 -gravity Center `
  -annotate 0x0+0+80 'Your AI. Your Machine. Your Rules.' `
  wizard-banner.bmp
```

## Reference

The orange square with `A/` matches the favicon already used on aiden.taracod.com —
see the `<div class="lsq">` element in cloudflare-worker/landing.js for the web version.
