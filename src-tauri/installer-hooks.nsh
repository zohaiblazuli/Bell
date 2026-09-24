; Bell — NSIS installer hooks.
;
; Tauri's NSIS template invokes these macros at fixed points (this file is wired in via
; bundle.windows.nsis.installerHooks in tauri.conf.json). We use the post-install hook — which also
; runs during the updater's silent in-place install — to flush the Windows shell icon cache.
;
; The problem it fixes: after an update swaps Bell.exe in place, the new icon is already embedded in
; the binary, but Explorer, the desktop and the taskbar keep serving the icon they cached against the
; unchanged path. Nothing about the running app can reach that cache. SHChangeNotify with
; SHCNE_ASSOCCHANGED is the documented signal that tells the shell an association/icon changed and it
; should re-read icons, so the updated Bell icon shows without a reboot or a manual cache clear.
;
;   SHChangeNotify(LONG wEventId, UINT uFlags, LPCVOID dwItem1, LPCVOID dwItem2)
;   wEventId = SHCNE_ASSOCCHANGED (0x08000000), uFlags = SHCNF_IDLIST (0x0000), both items NULL.

!macro NSIS_HOOK_POSTINSTALL
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
