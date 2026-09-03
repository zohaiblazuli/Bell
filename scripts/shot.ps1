# Captures the running Bell window to a PNG, for comparing against the Figma renders.
#
#   powershell -ExecutionPolicy Bypass -File scripts/shot.ps1 -Out .shots/library-day.png
#
# Why not PrintWindow: the sidebar, the top bar and the sheets all carry `backdrop-filter`, so
# WebView2 composites them on their own layers — and PrintWindow intermittently returns the frame
# without those layers, which reads as "the sidebar vanished" when nothing is wrong. Grabbing the
# screen instead captures whatever is actually composited, so the window has to be genuinely on
# top first. That is what the topmost dance below is for.

param(
  [string]$Out = ".shots/bell.png",
  [string]$ProcessName = "bell",
  [int]$SettleMs = 900
)

$ErrorActionPreference = 'Stop'

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class BellShot {
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int ht, uint flags);

  struct RECT { public int L, T, R, B; }
  static readonly IntPtr TOPMOST = new IntPtr(-1);
  static readonly IntPtr NOTOPMOST = new IntPtr(-2);
  const uint NOMOVE = 0x0002, NOSIZE = 0x0001, SHOWWINDOW = 0x0040;

  // Window area, for picking the real window when more than one dev instance is running. A stale
  // instance keeps a 16x16 handle, and `Select-Object -First 1` picked between them at random —
  // which reads as "the capture is empty" or, worse, sends a drive click to a screen coordinate.
  public static long Area(IntPtr h) {
    RECT r;
    if (!GetWindowRect(h, out r)) return 0;
    return (long)(r.R - r.L) * (r.B - r.T);
  }

  public static string Capture(IntPtr h, string path, int settleMs) {
    if (IsIconic(h)) { ShowWindow(h, 9); System.Threading.Thread.Sleep(settleMs); }

    // A background process cannot simply steal focus, so ask for topmost, raise, then activate.
    SetWindowPos(h, TOPMOST, 0, 0, 0, 0, NOMOVE | NOSIZE | SHOWWINDOW);
    BringWindowToTop(h);
    SetForegroundWindow(h);
    System.Threading.Thread.Sleep(settleMs);

    RECT r;
    GetWindowRect(h, out r);
    int w = r.R - r.L, ht = r.B - r.T;
    if (w < 400 || ht < 300) {
      SetWindowPos(h, NOTOPMOST, 0, 0, 0, 0, NOMOVE | NOSIZE);
      return "window is only " + w + "x" + ht + " — not captured";
    }

    try {
      using (var bmp = new Bitmap(w, ht))
      using (var g = Graphics.FromImage(bmp)) {
        g.CopyFromScreen(r.L, r.T, 0, 0, new Size(w, ht), CopyPixelOperation.SourceCopy);
        bmp.Save(path, ImageFormat.Png);
      }
    } finally {
      // Leave the window as it was found, so a capture never changes how the app behaves next.
      SetWindowPos(h, NOTOPMOST, 0, 0, 0, 0, NOMOVE | NOSIZE);
    }
    return "saved " + w + "x" + ht + " -> " + path;
  }
}
'@

$proc = Get-Process $ProcessName -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 } |
  Sort-Object { [BellShot]::Area($_.MainWindowHandle) } -Descending |
  Select-Object -First 1

if (-not $proc) {
  Write-Output "no '$ProcessName' window found - is the dev app running?"
  exit 1
}

$dir = Split-Path -Parent $Out
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

Write-Output ([BellShot]::Capture($proc.MainWindowHandle, (Resolve-Path -LiteralPath $dir).Path + "\" + (Split-Path -Leaf $Out), $SettleMs))
