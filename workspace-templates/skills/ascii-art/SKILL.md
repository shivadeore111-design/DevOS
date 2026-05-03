---
name: ascii-art
description: Generate ASCII art text banners, box art, and decorative text using pyfiglet, cowsay, and boxes CLI tools
category: creative
version: 1.0.0
origin: aiden
license: Apache-2.0
tags: ascii, art, banner, text, figlet, cowsay, terminal, decoration, cli, creative
---

# ASCII Art Generation

Create ASCII art text banners, speech bubbles, box decorations, and large display text using `pyfiglet`, `cowsay`, and `boxes` — all CLI/Python tools.

## When to Use

- User wants a stylized text banner for a terminal script or README
- User wants a fun cowsay/fortune-style message
- User wants decorative box borders around text
- User wants large ASCII letters for display purposes
- User wants ASCII art for CLI tool headers or splash screens

## How to Use

### 1. Install tools

```powershell
pip install pyfiglet
pip install cowsay

# boxes (optional, for border art)
# Windows: winget install info-zip.unzip  # then download boxes binary
```

### 2. Generate a text banner with pyfiglet

```python
import pyfiglet

# Default font (Standard)
print(pyfiglet.figlet_format("Hello World"))

# Specific font
print(pyfiglet.figlet_format("DevOS", font="banner3-D"))

# List all available fonts
fonts = pyfiglet.FigletFont.getFonts()
print(f"Available fonts: {len(fonts)}")
print(fonts[:20])
```

### 3. Sample popular pyfiglet fonts

```python
import pyfiglet

text = "AIDEN"
for font in ["banner3", "big", "block", "colossal", "doom", "epic", "isometric1", "larry3d", "ogre", "slant", "speed", "starwars"]:
  print(f"\n--- {font} ---")
  print(pyfiglet.figlet_format(text, font=font))
```

### 4. Generate cowsay messages

```python
import cowsay

# Default cow
cowsay.cow("Hello from Aiden!")

# Different characters
cowsay.tux("Linux penguin says hi")
cowsay.dragon("Deploy to production!")
cowsay.cheese("It is time to cheese")

# List available characters
print(cowsay.char_names)
```

### 5. Create a custom cowsay-style speech bubble

```python
def speech_bubble(text, speaker="Aiden"):
  width  = max(len(line) for line in text.split("\n")) + 4
  border = "─" * width
  lines  = [f"│ {line.ljust(width-2)} │" for line in text.split("\n")]
  bubble = [f"┌{border}┐"] + lines + [f"└{border}┘"]
  bubble.append(f"  {speaker}")
  print("\n".join(bubble))

speech_bubble("Task complete.\n3 files created.\nAll tests passing.", speaker="🤖 Aiden")
```

### 6. Create ASCII box borders

```python
def boxed(text, style="double"):
  styles = {
    "single": ("┌","─","┐","│","└","┘"),
    "double": ("╔","═","╗","║","╚","╝"),
    "round":  ("╭","─","╮","│","╰","╯"),
  }
  tl,h,tr,v,bl,br = styles.get(style, styles["single"])
  lines  = text.split("\n")
  width  = max(len(l) for l in lines) + 2
  border = h * width
  print(f"{tl}{border}{tr}")
  for line in lines:
    print(f"{v} {line.ljust(width-1)}{v}")
  print(f"{bl}{border}{br}")

boxed("System Status: OK\nUptime: 99.9%\nTasks: 0 pending", style="double")
```

### 7. Color the output

```python
import pyfiglet

CYAN  = "\033[96m"
RESET = "\033[0m"
banner = pyfiglet.figlet_format("DEVOS", font="slant")
print(CYAN + banner + RESET)
```

## Examples

**"Create a banner saying 'AIDEN' for the CLI startup screen"**
→ Use step 2 with font `slant` or `doom`, then step 7 to add cyan color.

**"Make a cowsay message that says 'Deployment successful'"**
→ Use step 4: `cowsay.tux("Deployment successful!")`.

**"Add a decorative box around my summary output"**
→ Use step 6 with `style="double"` for a professional-looking double-line box.

## Cautions

- pyfiglet output width depends on font — some fonts produce very wide output; use short text (< 12 chars) for block fonts
- Terminal color codes (ANSI) may not render correctly in all terminals — test before using in production scripts
- cowsay requires `pip install cowsay` (Python port) — the Unix `cowsay` binary is separate
- Some pyfiglet fonts are available only if `pyfiglet[all]` is installed — run `pip install pyfiglet[all]` for the full set
