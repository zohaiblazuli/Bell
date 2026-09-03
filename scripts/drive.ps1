# Clicks and types into the running Bell window, so a screenshot sweep can actually reach every
# screen instead of stopping at whatever the app booted into.
#
#   powershell -ExecutionPolicy Bypass -File scripts/drive.ps1 -Click "85,179"
#   powershell -ExecutionPolicy Bypass -File scripts/drive.ps1 -Click "85,293" -Then "85,179"
#   powershell -ExecutionPolicy Bypass -File scripts/drive.ps1 -Key Escape
#
# Coordinates are CLIENT coordinates — the same ones you read off a `npm run shot` capture, with
# (0,0) at the window's top-left. They are translated to screen space here, so a moved or resized
# window needs no arithmetic on the caller's side.
#
# Why real input rather than a dev-only route: the point of the sweep is to check what the app
# actually does when a nav row is pressed, including the state it carries across. A URL that jumps
# straight to a screen would skip exactly the thing being verified.
#
# IT DRIVES THE REAL APP AGAINST THE REAL STATE DIRECTORY. A stray click is a real preference change,
# and a click that lands 450 ms before a slow screen finishes rendering lands on whatever was still
# on screen. This has already flipped `settings.seasons` to a single series and turned auto-update on
# — silently, because a settings row that has been pressed looks exactly like one that was set on
# purpose. Before a sweep that presses anything other than the sidebar, copy
# `%APPDATA%\com.bell.study\state` aside, or point the app at a scratch identifier. Reading a screen
# is safe; pressing controls inside one is not.

param(
  [string[]]$Click = @(),
  [string[]]$Then = @(),
  [string]$Key = "",
  [string]$Type = "",
  [string]$ProcessName = "bell",
  [int]$SettleMs = 450
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public class BellDrive {
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern void mouse_event(uint flags, uint dx, uint dy, uint data, IntPtr extra);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);

  struct RECT { public int L, T, R, B; }
  const uint LEFTDOWN = 0x0002, LEFTUP = 0x0004;

  public static void Focus(IntPtr h, int settleMs) {
    if (IsIconic(h)) { ShowWindow(h, 9); System.Threading.Thread.Sleep(settleMs); }
    BringWindowToTop(h);
    SetForegroundWindow(h);
    System.Threading.Thread.Sleep(settleMs);
  }

  // The window has no decorations, so its rect IS its client area and no AdjustWindowRect is needed.
  public static string ClickClient(IntPtr h, int cx, int cy, int settleMs) {
    RECT r;
    GetWindowRect(h, out r);
    int x = r.L + cx, y = r.T + cy;
    SetCursorPos(x, y);
    System.Threading.Thread.Sleep(90);
    mouse_event(LEFTDOWN, 0, 0, 0, IntPtr.Zero);
    System.Threading.Thread.Sleep(40);
    mouse_event(LEFTUP, 0, 0, 0, IntPtr.Zero);
    System.Threading.Thread.Sleep(settleMs);
    return "click " + cx + "," + cy + " -> screen " + x + "," + y;
  }
}
'@

$proc = Get-Process $ProcessName -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 } |
  Select-Object -First 1

if (-not $proc) {
  Write-Output "no '$ProcessName' window found - is the dev app running?"
  exit 1
}

$h = $proc.MainWindowHandle
[BellDrive]::Focus($h, $SettleMs)

foreach ($pair in @($Click) + @($Then)) {
  if (-not $pair) { continue }
  $parts = $pair -split ','
  Write-Output ([BellDrive]::ClickClient($h, [int]$parts[0].Trim(), [int]$parts[1].Trim(), $SettleMs))
}

# SendKeys needs the window focused, which Focus above has already done.
if ($Key -or $Type) {
  Add-Type -AssemblyName System.Windows.Forms
  if ($Type) { [System.Windows.Forms.SendKeys]::SendWait($Type); Write-Output "typed: $Type" }
  if ($Key)  { [System.Windows.Forms.SendKeys]::SendWait("{$Key}"); Write-Output "key: $Key" }
  Start-Sleep -Milliseconds $SettleMs
}
