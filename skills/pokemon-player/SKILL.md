---
name: pokemon-player
description: Run and automate Pokémon games using headless emulation, RAM state reading, and programmatic button inputs
category: gaming
version: 1.0.0
origin: aiden
license: Apache-2.0
tags: pokemon, emulator, gameboy, automation, mgba, rom, ram, scripting, gaming, bot
---

# Pokémon Game Automation

Automate Pokémon games using mGBA (Game Boy Advance emulator) with scripting support. Read RAM state, inject button inputs, and build bots for grinding, breeding, or exploration.

## When to Use

- User wants to automate repetitive tasks in a Pokémon game (grinding, breeding, shiny hunting)
- User wants to read game state (player position, party HP, item count) programmatically
- User wants to build a battle or movement bot
- User wants to run a headless emulator for scripted playthrough
- User wants to replay a battle or scenario automatically

## How to Use

### 1. Install mGBA

```powershell
# Download mGBA from https://mgba.io/downloads.html
# Portable version — no install required
# Extract to C:\tools\mGBA\
# Verify
& "C:\tools\mGBA\mgba.exe" --version
```

### 2. Understand mGBA scripting (Lua)

mGBA has a built-in Lua scripting interface accessible via Tools → Scripting Console.

```lua
-- Read a memory address (example: Pokémon FireRed player X position)
-- Addresses vary by game — look up RAM maps for your ROM
local playerX = memory.read8(0x02036E2C)
local playerY = memory.read8(0x02036E28)
print(string.format("Player position: %d, %d", playerX, playerY))
```

### 3. Send button inputs via Lua

```lua
-- Simulate pressing A button
input.press("A")
emu.frameadvance()   -- advance one frame

-- Walk right 5 steps
for i = 1, 5 do
  input.press("Right")
  emu.frameadvance()
  emu.frameadvance()
end
```

### 4. Automate shiny hunting (soft reset loop)

```lua
-- Pokémon FireRed shiny hunting — keep soft resetting until shiny found
-- Shiny flag address varies by game version
local SHINY_ADDR = 0x020244B0   -- example address

local resets = 0
while true do
  local isShiny = memory.read8(SHINY_ADDR)
  if isShiny == 1 then
    print(string.format("SHINY FOUND after %d resets!", resets))
    break
  end
  resets = resets + 1
  -- Soft reset: L+R+Start+Select
  input.press("L"); input.press("R"); input.press("Start"); input.press("Select")
  emu.frameadvance()
  emu.reset()
end
```

### 5. Read party Pokémon HP

```lua
-- FireRed/LeafGreen party struct base addresses (Gen 3)
local PARTY_BASE = 0x02024284
local STRUCT_SIZE = 100   -- bytes per Pokémon in party

for slot = 0, 5 do
  local base   = PARTY_BASE + slot * STRUCT_SIZE
  local species = memory.read16(base + 0)
  local hpCurr  = memory.read16(base + 56)
  local hpMax   = memory.read16(base + 58)
  if species > 0 then
    print(string.format("Slot %d: species=%d HP=%d/%d", slot+1, species, hpCurr, hpMax))
  end
end
```

### 6. Control mGBA from Python via socket

mGBA can expose a scripting socket for external control:

```lua
-- mGBA side: open a socket and listen
local sock = socket.tcp()
sock:bind("127.0.0.1", 8888)
sock:listen(1)
local client = sock:accept()
while true do
  local cmd = client:receive("*l")
  if cmd == "press_a" then input.press("A") end
  emu.frameadvance()
end
```

```python
import socket, time

s = socket.socket()
s.connect(("127.0.0.1", 8888))

def press(btn):
  s.sendall(f"press_{btn}\n".encode())
  time.sleep(0.05)

press("a")
press("right")
```

## Examples

**"Automate grinding by walking in tall grass until party is fainted"**
→ Use step 3 to loop walking movements. Read party HP from step 5 to detect all fainted.

**"Count how many soft resets it takes to find a shiny Starter"**
→ Use step 4 with the game's shiny flag address. It increments the counter and stops on shiny.

**"Read my current party's HP and print a status report"**
→ Use step 5 inside the mGBA Lua scripting console.

## Cautions

- ROM files are copyrighted — only use ROMs of games you legally own
- RAM addresses differ between game versions (FireRed v1.0 vs v1.1, Japanese vs English) — verify with RAM maps from romhacking.net
- mGBA Lua API differs from older emulators (VBA-M, BizHawk) — code is not directly portable
- Automated soft-reset loops run very fast — add frame limits to avoid 100% CPU usage
- mGBA's socket scripting is not enabled by default — must be started from Tools → Scripting
