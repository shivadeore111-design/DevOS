---
name: minecraft-modpack-server
description: Set up and manage a modded Minecraft server using NeoForge or Forge with a modpack
category: gaming
version: 1.0.0
origin: aiden
tags: minecraft, neoforge, forge, modpack, server, java, gaming, mods, multiplayer
---

# Modded Minecraft Server Setup

Set up and manage a NeoForge or Forge modded Minecraft server on Windows. Covers server installation, modpack configuration, memory tuning, and startup automation.

## When to Use

- User wants to run a modded Minecraft server locally or on a VPS
- User wants to install a CurseForge or Modrinth modpack on a server
- User wants to configure server memory and JVM flags
- User wants to automate server startup with a batch script
- User wants to manage mods — add, remove, or update individual mods

## How to Use

### 1. Prerequisites

```powershell
# Verify Java 21+ is installed (required for 1.20.x+)
java -version
# Install from: https://adoptium.net/temurin/releases/?version=21

# Create server directory
New-Item -ItemType Directory -Path "C:\mc-server" -Force
Set-Location "C:\mc-server"
```

### 2. Install NeoForge server

```powershell
# Download NeoForge installer from https://neoforged.net/
# Get the installer for your Minecraft version
$neoforgeVersion = "21.1.99"   # replace with desired version
$installerUrl    = "https://maven.neoforged.net/releases/net/neoforged/neoforge/$neoforgeVersion/neoforge-$neoforgeVersion-installer.jar"
Invoke-WebRequest -Uri $installerUrl -OutFile "neoforge-installer.jar"

# Run installer (creates server files)
java -jar neoforge-installer.jar --installServer
```

### 3. Accept the EULA

```powershell
# Required before server will start
Set-Content -Path "eula.txt" -Value "eula=true"
```

### 4. Create an optimized startup script

```powershell
# start.bat — save in C:\mc-server\
$startBat = @'
@echo off
java -Xmx6G -Xms2G ^
  -XX:+UseG1GC ^
  -XX:+ParallelRefProcEnabled ^
  -XX:MaxGCPauseMillis=200 ^
  -XX:G1HeapRegionSize=16M ^
  -XX:G1ReservePercent=25 ^
  -jar libraries/net/neoforged/neoforge/21.1.99/neoforge-21.1.99-server.jar ^
  nogui
pause
'@
Set-Content -Path "C:\mc-server\start.bat" -Value $startBat
```

Adjust `-Xmx` (max RAM) and `-Xms` (initial RAM) based on available system memory.

### 5. Add mods to the server

```powershell
# Mods go in the mods/ directory
New-Item -ItemType Directory -Force -Path "C:\mc-server\mods"

# Download a mod from Modrinth (example: Fabric API replacement for NeoForge)
$modUrl = "https://cdn.modrinth.com/data/AANobbMI/versions/xxxxx/mod-name.jar"
Invoke-WebRequest -Uri $modUrl -OutFile "C:\mc-server\mods\mod-name.jar"

# List installed mods
Get-ChildItem "C:\mc-server\mods" -Filter "*.jar" | Select-Object Name, Length
```

### 6. Install a CurseForge modpack

```powershell
# 1. Download the server pack ZIP from CurseForge (not the client pack)
# 2. Extract to server directory
Expand-Archive -Path "modpack-server.zip" -DestinationPath "C:\mc-server" -Force

# 3. Run the modpack's install script (varies by pack)
Set-Location "C:\mc-server"
.\startserver.sh   # or start.bat depending on the pack
```

### 7. Configure server.properties

```powershell
# Key settings in server.properties
$config = @"
max-players=10
difficulty=normal
spawn-protection=0
view-distance=10
online-mode=true
motd=My Modded Server
"@
Add-Content -Path "C:\mc-server\server.properties" -Value $config
```

### 8. Start the server

```powershell
Set-Location "C:\mc-server"
.\start.bat
```

## Examples

**"Set up a NeoForge 1.21.1 server with 8GB RAM"**
→ Use steps 1–4. Adjust `-Xmx8G` in the startup script.

**"Add the Create mod to my existing server"**
→ Use step 5 — download the Create jar for NeoForge from Modrinth and place in `mods/`.

**"Install the All The Mods 9 server pack"**
→ Use step 6 — download the ATM9 server pack ZIP from CurseForge and extract with step 6.

## Cautions

- Always use the NeoForge/Forge version that matches your target Minecraft version exactly
- Client mods (rendering, shaders, HUD) must NOT be placed on the server — server-side only mods apply
- Increase `-Xmx` proportional to mod count — large packs (200+ mods) need at least 8-12GB
- `online-mode=true` requires all players to have a paid Minecraft account (prevents cracked clients)
- Back up the `world/` directory regularly — server crashes can corrupt world data
