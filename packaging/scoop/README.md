# Scoop Manifest — Aiden

This directory contains the [Scoop](https://scoop.sh) manifest for Aiden.

## Using the bucket

### One-time bucket setup

```powershell
scoop bucket add taracod https://github.com/taracodlabs/scoop-bucket
```

### Install Aiden

```powershell
scoop install taracod/aiden
```

### Upgrade

```powershell
scoop update taracod/aiden
```

### Uninstall

```powershell
scoop uninstall aiden
```

---

## Maintaining the bucket

The `aiden.json` manifest lives in a dedicated bucket repo:
**[taracodlabs/scoop-bucket](https://github.com/taracodlabs/scoop-bucket)**
(not this repo — copy `aiden.json` there when publishing).

### Publishing a new version

1. Build and publish the new `Aiden-Setup-<version>.exe` to GitHub Releases.
2. Compute the SHA256 hash:
   ```powershell
   (Get-FileHash -Algorithm SHA256 "Aiden-Setup-<version>.exe").Hash
   ```
3. Update `aiden.json`:
   - Bump `version`
   - Update `url` with the new filename
   - Replace `hash` value with `sha256:<new-hash>`
4. Push to `taracodlabs/scoop-bucket`. Scoop's `checkver` auto-detects the
   new GitHub release tag for automated manifest updates.

---

## Notes

- The `bin` field exposes `aiden` as a shim once installed.
- The installer runs NSIS silently (`/S`) — no UAC prompt.
- Uninstaller targets the NSIS-generated uninstaller at the default install path.
  If the user changed the install directory, uninstall via Add/Remove Programs.
