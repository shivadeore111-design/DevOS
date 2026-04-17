# winget Manifest — Taracod.Aiden

These three YAML files are the winget package manifests required to publish
Aiden to the [Windows Package Manager Community Repository](https://github.com/microsoft/winget-pkgs).

## Files

| File | Purpose |
|------|---------|
| `Taracod.Aiden.yaml` | Version manifest — package ID + version |
| `Taracod.Aiden.installer.yaml` | Installer manifest — URL, SHA256, switches |
| `Taracod.Aiden.locale.en-US.yaml` | Locale manifest — description, publisher, tags |

## Submission steps

1. **Compute SHA256** for the release installer:
   ```powershell
   .\generate-sha256.ps1
   ```
   Paste the output hash into `Taracod.Aiden.installer.yaml` at `InstallerSha256`.

2. **Fork** [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs).

3. **Copy** these three files to:
   ```
   manifests/t/Taracod/Aiden/3.6.0/
   ```

4. **Open a Pull Request** against `microsoft/winget-pkgs` with title:
   ```
   New package: Taracod.Aiden version 3.6.0
   ```

5. The winget validation bot will run automated checks. Address any failures
   flagged by `winget-cli-validator`.

## After approval

Users can install with:
```powershell
winget install Taracod.Aiden
```

And upgrade with:
```powershell
winget upgrade Taracod.Aiden
```
