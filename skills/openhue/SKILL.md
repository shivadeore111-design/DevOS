---
name: openhue
description: Control Philips Hue smart lights using the OpenHue CLI and local Hue Bridge REST API
category: smart-home
version: 1.0.0
origin: aiden
tags: hue, philips, smart-home, lights, openhue, cli, iot, automation, rgb, brightness
---

# Philips Hue Smart Light Control

Control Philips Hue lights using the OpenHue CLI or the local Hue Bridge REST API. Works entirely on your local network — no cloud required.

## When to Use

- User wants to turn lights on or off
- User wants to change light color or brightness
- User wants to activate a Hue scene
- User wants to list all lights and their current state
- User wants to set up automation rules for lights

## How to Use

### 1. Install OpenHue CLI

```powershell
# Install via winget
winget install openhue.cli

# Or via npm
npm install -g openhue-cli

# Verify
openhue --version
```

### 2. First-time setup — discover and pair with Bridge

```powershell
# Discover the Hue Bridge on your network
openhue discover

# Pair (press the button on the Bridge within 30 seconds, then run)
openhue pair --host 192.168.1.x   # use IP from discover output

# Save credentials
openhue configure --host 192.168.1.x --api-key YOUR_API_KEY
```

### 3. List all lights

```powershell
openhue get lights
```

### 4. Turn lights on and off

```powershell
# Turn specific light on/off (by ID or name)
openhue set light "Living Room 1" --on true
openhue set light "Living Room 1" --on false

# Turn all lights off
openhue set lights --on false
```

### 5. Change brightness and color

```powershell
# Brightness 0-100
openhue set light "Desk Lamp" --brightness 70

# Set color by hue/saturation (hue 0-360, saturation 0-100)
openhue set light "Desk Lamp" --hue 240 --saturation 80 --brightness 80

# Set color temperature in Kelvin (2000K warm to 6500K cool)
openhue set light "Desk Lamp" --color-temp 3000
```

### 6. Activate a scene

```powershell
# List available scenes
openhue get scenes

# Activate a scene in a room
openhue set scene "Relax" --room "Living Room"
```

### 7. Use the Hue local REST API directly

```powershell
$bridge  = "192.168.1.x"
$apiKey  = $env:HUE_API_KEY
$baseUrl = "https://$bridge/clip/v2"
$headers = @{ "hue-application-key" = $apiKey }

# List all lights
$lights = (Invoke-RestMethod -Uri "$baseUrl/resource/light" -Headers $headers -SkipCertificateCheck).data
$lights | Select-Object id, @{N="name";E={$_.metadata.name}}, @{N="on";E={$_.on.on}}

# Turn a specific light on
$lightId = $lights[0].id
$body    = @{ on = @{ on = $true } } | ConvertTo-Json
Invoke-RestMethod -Uri "$baseUrl/resource/light/$lightId" -Method Put -Headers $headers -Body $body -SkipCertificateCheck
```

## Examples

**"Turn off all the lights in the bedroom"**
→ Use step 4: `openhue set lights --room "Bedroom" --on false`

**"Set my desk lamp to a cool blue for focus mode"**
→ Use step 5: `--hue 220 --saturation 90 --brightness 75` for a cool blue light.

**"Activate the Movie scene in the living room"**
→ Use step 6: `openhue set scene "Movie" --room "Living Room"`.

## Cautions

- The Hue Bridge must be on the same local network as the machine running Aiden
- `-SkipCertificateCheck` is needed for direct API calls — the Bridge uses a self-signed certificate
- OpenHue CLI stores credentials in `~/.openhue/` — do not share this directory
- Hue API v2 uses UUIDs for light IDs — use the list command to find IDs before automating
- Color temperature range varies by bulb model — not all bulbs support full 2000K-6500K range
