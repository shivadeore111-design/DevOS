# Installer Assets

These image files are required to build the Aiden-Setup.exe installer.

## Required Files

### icon.ico
- **Size**: Multi-resolution ICO with 16, 32, 48, 64, 128, 256px
- **Design**: Dark `#0e0e0e` background, orange `#f97316` rounded rectangle, white `A/` in JetBrains Mono Bold
- **Used for**: Installer icon, desktop shortcut, Add/Remove Programs entry
- **Generate**: See icon-spec.md for exact prompt and tools

### wizard-banner.bmp
- **Size**: 497 × 314 pixels, 24-bit BMP (no alpha)
- **Design**: Left side of the installer wizard pages
- **Style**: Dark background, Aiden logo top-left, subtle orange glow, "Your AI. Your Machine. Your Rules." tagline
- **Convert**: Any PNG → BMP at imagemagick: `magick banner.png -resize 497x314! banner.bmp`

### wizard-icon.bmp
- **Size**: 55 × 58 pixels, 24-bit BMP (no alpha)
- **Design**: Top-right small icon on wizard pages
- **Style**: Orange square with white A/ — same as icon.ico but BMP format
- **Convert**: `magick icon.png -resize 55x58! wizard-icon.bmp`

## Quick Placeholder (for testing without real assets)

Create a minimal 1×1 pixel BMP to let ISCC compile without the assets:

```powershell
# Creates tiny placeholder BMPs so ISCC doesn't fail
$bmp = [System.Drawing.Bitmap]::new(497, 314)
$bmp.Save("wizard-banner.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$bmp.Dispose()

$bmp2 = [System.Drawing.Bitmap]::new(55, 58)
$bmp2.Save("wizard-icon.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$bmp2.Dispose()
```

Note: For icon.ico, you must provide a real ICO file. ISCC will fail with a missing ICO.
See icon-spec.md for the generation prompt.
