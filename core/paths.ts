// core/paths.ts — Cross-platform user-data directory helpers.
//
// Windows : %APPDATA%\aiden          (roaming)
//           %LOCALAPPDATA%\aiden\cache
// macOS   : ~/Library/Application Support/aiden
//           ~/Library/Caches/aiden
// Linux   : $XDG_DATA_HOME/aiden     (default ~/.local/share/aiden)
//           $XDG_CACHE_HOME/aiden    (default ~/.cache/aiden)
//           $XDG_CONFIG_HOME/aiden   (default ~/.config/aiden)
//
// All paths can be overridden at runtime via AIDEN_USER_DATA / AIDEN_CONFIG_DIR.

import os   from 'os'
import path from 'path'

const APP_NAME = 'aiden'

/** Primary user-data root (config, workspace, logs). */
export function getUserDataDir(): string {
  if (process.env.AIDEN_USER_DATA) return process.env.AIDEN_USER_DATA

  switch (process.platform) {
    case 'win32':
      return path.join(
        process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
        APP_NAME,
      )
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME)
    default:
      // Linux / FreeBSD / WSL
      return path.join(
        process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'),
        APP_NAME,
      )
  }
}

/** Config directory (separate from data on Linux/XDG). */
export function getConfigDir(): string {
  if (process.env.AIDEN_CONFIG_DIR) return process.env.AIDEN_CONFIG_DIR

  if (process.platform === 'linux') {
    return path.join(
      process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
      APP_NAME,
    )
  }
  // Windows and macOS keep config inside the data dir
  return path.join(getUserDataDir(), 'config')
}

/** Cache directory (safe to delete without data loss). */
export function getCacheDir(): string {
  switch (process.platform) {
    case 'win32':
      return path.join(
        process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
        APP_NAME,
        'cache',
      )
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Caches', APP_NAME)
    default:
      return path.join(
        process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'),
        APP_NAME,
      )
  }
}
