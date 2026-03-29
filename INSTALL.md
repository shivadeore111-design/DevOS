# Installing Aiden

## Quick Install (Windows)

1. Download or clone this repo
2. Right-click `install.ps1` → Run with PowerShell
3. Double-click `Aiden` on your Desktop

## Requirements

- Windows 10/11
- Node.js 18+ (installer will check)
- 8GB RAM minimum (16GB recommended)
- Internet connection for first setup

## Manual Install

```powershell
# Install dependencies
npm install
cd dashboard-next && npm install && cd ..

# Start Aiden
START_AIDEN.bat
```

## Adding API Keys

Open Aiden → Settings → API Keys

Recommended: Add a free Groq key at [console.groq.com](https://console.groq.com)

## Troubleshooting

- **Port 4200 in use**: close other apps or restart — START_AIDEN.bat clears ports automatically
- **Ollama not found**: download from [ollama.com](https://ollama.com)
- **No response**: check Settings → API Keys
- **Errors on start**: check `workspace\aiden-error.log`
