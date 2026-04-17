; installer.nsh — Custom NSIS macros for Aiden
; Adds $INSTDIR\resources\bin to the user PATH on install,
; and removes it on uninstall.
;
; electron-builder picks this up via nsis.include in package.json.
; Install uses a direct registry write; uninstall uses PowerShell for
; safe string-based PATH removal without requiring NSIS string plugins.

!include "WinMessages.nsh"

!macro customInstall
  ; Add bin\ to user PATH (HKCU — no admin required)
  WriteRegExpandStr HKCU "Environment" "PATH" "$INSTDIR\resources\bin;%PATH%"
  ; Broadcast the change so open Explorer/taskbar windows pick it up
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=1000
!macroend

!macro customUnInstall
  ; Remove our bin\ entry from user PATH via PowerShell (no NSIS string plugin needed).
  ; NSIS expands $INSTDIR before passing the string to nsExec.
  ; PowerShell variables ($p, $entries, $_) are escaped as $$ so NSIS does not
  ; interpret them as NSIS variables; they become $ in the final command string.
  nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command "& { $$p = [Environment]::GetEnvironmentVariable(''PATH'',''User''); $$entries = ($$p -split '';'') | Where-Object { $$_ -ne ''$INSTDIR\resources\bin'' }; [Environment]::SetEnvironmentVariable(''PATH'', ($$entries -join '';''), ''User'') }"'
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=1000
!macroend
