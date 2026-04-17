; installer.nsh — Custom NSIS macros for Aiden
; Adds $INSTDIR\resources\bin to the user PATH on install,
; and removes it on uninstall.
;
; electron-builder picks this up via nsis.include in package.json.
; No external plugin required — uses native NSIS registry calls.

!macro customInstall
  ; Add bin\ to user PATH (HKCU — no admin required)
  WriteRegExpandStr HKCU "Environment" "PATH" "$INSTDIR\resources\bin;%PATH%"
  ; Broadcast the change so open Explorer/taskbar windows pick it up
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=1000
!macroend

!macro customUnInstall
  ; Remove bin\ from user PATH on uninstall
  ; Read current value, strip our entry, write back
  ReadRegStr $0 HKCU "Environment" "PATH"
  ${StrRep} $1 "$0" "$INSTDIR\resources\bin;" ""
  ${StrRep} $2 "$1" "$INSTDIR\resources\bin"  ""
  WriteRegExpandStr HKCU "Environment" "PATH" "$2"
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=1000
!macroend
