#!/usr/bin/env bash
# Aiden uninstall script — Linux / macOS / WSL
# Usage: curl -fsSL aiden.taracod.com/uninstall.sh | bash
set -e

BOLD="\033[1m"
RED="\033[31m"
GREEN="\033[32m"
DIM="\033[2m"
RESET="\033[0m"

echo ""
echo -e "${BOLD}Aiden — Uninstaller${RESET}"
echo -e "${DIM}────────────────────────────────────${RESET}"

# ── Paths ────────────────────────────────────────────────────────────────────
AIDEN_DATA="$HOME/.local/share/aiden"
AIDEN_CONFIG="$HOME/.config/aiden"
AIDEN_MACOS_SUPPORT="$HOME/Library/Application Support/aiden"  # macOS only
AIDEN_MACOS_PREFS="$HOME/Library/Preferences/com.taracod.aiden.plist"

removed=0

remove_path() {
  local path="$1"
  if [ -e "$path" ] || [ -L "$path" ]; then
    rm -rf "$path"
    echo -e "  ${GREEN}removed${RESET}  $path"
    removed=$((removed + 1))
  else
    echo -e "  ${DIM}skipped${RESET}  $path (not found)"
  fi
}

echo ""
echo "Removing Aiden data and config..."
remove_path "$AIDEN_DATA"
remove_path "$AIDEN_CONFIG"

# macOS-specific locations
if [ "$(uname)" = "Darwin" ]; then
  remove_path "$AIDEN_MACOS_SUPPORT"
  remove_path "$AIDEN_MACOS_PREFS"
fi

# ── npm global uninstall (if installed via npm) ───────────────────────────────
if command -v npm >/dev/null 2>&1; then
  if npm list -g devos-ai --depth=0 >/dev/null 2>&1; then
    echo ""
    echo "Removing npm global package devos-ai..."
    npm uninstall -g devos-ai
    echo -e "  ${GREEN}removed${RESET}  npm global: devos-ai"
    removed=$((removed + 1))
  fi
fi

# ── Workspace (optional, prompt) ─────────────────────────────────────────────
WORKSPACE="$HOME/.local/share/aiden/workspace"
if [ -d "$WORKSPACE" ]; then
  echo ""
  echo -e "${DIM}Note: your workspace at $WORKSPACE was already removed above.${RESET}"
fi

echo ""
if [ "$removed" -gt 0 ]; then
  echo -e "${GREEN}${BOLD}Done.${RESET} Aiden has been uninstalled ($removed item(s) removed)."
else
  echo -e "${DIM}Nothing to remove — Aiden does not appear to be installed.${RESET}"
fi
echo ""
