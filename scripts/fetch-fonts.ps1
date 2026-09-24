# Vendors the three type roles into the app so Bell renders identically with no network.
# Run once (or after changing weights); the produced woff2 files are committed with the app.
#   powershell -ExecutionPolicy Bypass -File scripts/fetch-fonts.ps1
#
# Two acquisition paths, because the two families are published two different ways:
#   SF Pro     -> Apple's SF-Pro.dmg  (dmg -> pkg -> Payload -> Payload~ -> Library/Fonts/*.otf)
#   Geist Mono -> the Vercel geist-font GitHub release zip (SIL OFL 1.1)
#
# Everything is then subset with fontTools to latin + latin-ext plus the punctuation this app
# actually renders, and written out as one woff2 per face. `tnum` is kept for tabular figures.
#
# Requires: 7-Zip, and Python with fontTools + brotli (pip install fonttools brotli).

$ErrorActionPreference = 'Stop'

$root    = Split-Path -Parent $PSScriptRoot
$outDir  = Join-Path $root 'src\assets\fonts'
$cssOut  = Join-Path $root 'src\styles\fonts.css'
$cache   = Join-Path $env:TEMP 'bell-fonts'
$ua      = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

$sevenZip = 'C:\Program Files\7-Zip\7z.exe'
if (-not (Test-Path $sevenZip)) { throw "7-Zip not found at $sevenZip — needed to open the SF Pro disk image." }

$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) { throw 'Python not found — needed for fontTools subsetting.' }
& $python -c "import fontTools, brotli" 2>$null
if ($LASTEXITCODE -ne 0) { throw 'Python is missing fontTools and/or brotli. Run: pip install fonttools brotli' }

# latin + latin-ext, plus the characters this UI actually uses that those ranges omit:
#   U+00B7 middot (card meta separators)   U+2014 em dash        U+2190-2193 arrows (palette)
#   U+23CE return symbol (kbd hints)       U+2665 heart (credit) U+2318 command  U+21E7 shift
$UR = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,' +
      'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,' +
      'U+1EF2-1EFF,U+2000-206F,U+2070-209F,U+20A0-20C0,U+2113,U+2122,U+2190-2193,U+2212,' +
      'U+2215,U+2318,U+21E7,U+23CE,U+2665,U+2C60-2C7F,U+A720-A7FF,U+FEFF,U+FFFD'

$FEATURES = 'kern,liga,calt,tnum,frac,ordn,ccmp,locl,mark,mkmk,rlig,ss01,zero'

if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
if (-not (Test-Path $cache))  { New-Item -ItemType Directory -Path $cache  -Force | Out-Null }
$srcDir = Join-Path $cache 'src'
if (-not (Test-Path $srcDir)) { New-Item -ItemType Directory -Path $srcDir -Force | Out-Null }

function Subset-Face {
  param([string]$Source, [string]$OutName)
  $target = Join-Path $outDir $OutName
  & $python -m fontTools.subset $Source "--unicodes=$UR" "--layout-features=$FEATURES" `
      '--flavor=woff2' "--output-file=$target" '--no-hinting' | Out-Null
  if (-not (Test-Path $target)) { throw "Subsetting produced nothing for $Source" }
  $kb = [math]::Round((Get-Item $target).Length / 1KB, 1)
  Write-Host ("  {0,-34} {1,7} KB" -f $OutName, $kb)
}

# ---------------------------------------------------------------- SF Pro (Apple)
Write-Host 'SF Pro'
$dmg = Join-Path $cache 'SF-Pro.dmg'
if (-not (Test-Path $dmg)) {
  Write-Host '  downloading SF-Pro.dmg (217 MB) ...'
  Invoke-WebRequest -Uri 'https://devimages-cdn.apple.com/design/resources/download/SF-Pro.dmg' `
    -UserAgent $ua -UseBasicParsing -OutFile $dmg
}

$sfFaces = @(
  @{ file = 'SF-Pro-Text-Regular.otf';      out = 'sf-pro-text-400-normal.woff2' },
  @{ file = 'SF-Pro-Text-Medium.otf';       out = 'sf-pro-text-500-normal.woff2' },
  @{ file = 'SF-Pro-Text-Semibold.otf';     out = 'sf-pro-text-600-normal.woff2' },
  @{ file = 'SF-Pro-Text-Bold.otf';         out = 'sf-pro-text-700-normal.woff2' },
  @{ file = 'SF-Pro-Display-Semibold.otf';  out = 'sf-pro-display-600-normal.woff2' },
  @{ file = 'SF-Pro-Display-Bold.otf';      out = 'sf-pro-display-700-normal.woff2' },
  # variable, not shipped — kept so the Bell wordmark's SF Pro Expanded Bold outlines can be
  # regenerated with fontTools.varLib.instancer (wdth 132). See src/ui/brand/.
  @{ file = 'SF-Pro.ttf';                   out = $null }
)

$needSf = $false
foreach ($f in $sfFaces) { if (-not (Test-Path (Join-Path $srcDir $f.file))) { $needSf = $true } }
if ($needSf) {
  Write-Host '  unpacking dmg -> pkg -> Payload ...'
  & $sevenZip e -y $dmg 'SFProFonts/SF Pro Fonts.pkg' "-o$cache" | Out-Null
  & $sevenZip e -y (Join-Path $cache 'SF Pro Fonts.pkg') 'SFProFonts.pkg/Payload' "-o$cache" | Out-Null
  & $sevenZip e -y (Join-Path $cache 'Payload') "-o$cache" | Out-Null
  foreach ($f in $sfFaces) {
    & $sevenZip e -y (Join-Path $cache 'Payload~') "./Library/Fonts/$($f.file)" "-o$srcDir" | Out-Null
  }
}
foreach ($f in $sfFaces) {
  if ($f.out) { Subset-Face -Source (Join-Path $srcDir $f.file) -OutName $f.out }
}

# ---------------------------------------------------------------- Geist Mono (Vercel, SIL OFL)
Write-Host 'Geist Mono'
$geistZip = Join-Path $cache 'geist-font.zip'
if (-not (Test-Path $geistZip)) {
  $rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/vercel/geist-font/releases/latest' -UserAgent $ua
  $asset = $rel.assets | Where-Object { $_.name -like '*.zip' } | Select-Object -First 1
  Write-Host ("  downloading {0} ..." -f $asset.name)
  Invoke-WebRequest -Uri $asset.browser_download_url -UserAgent $ua -UseBasicParsing -OutFile $geistZip
}

$geistFaces = @(
  @{ file = 'GeistMono-Regular.ttf';  out = 'geist-mono-400-normal.woff2' },
  @{ file = 'GeistMono-Medium.ttf';   out = 'geist-mono-500-normal.woff2' },
  @{ file = 'GeistMono-SemiBold.ttf'; out = 'geist-mono-600-normal.woff2' }
)
foreach ($f in $geistFaces) {
  if (-not (Test-Path (Join-Path $srcDir $f.file))) {
    & $sevenZip e -y $geistZip "geist-font/GeistMono/ttf/$($f.file)" "-o$srcDir" | Out-Null
  }
  Subset-Face -Source (Join-Path $srcDir $f.file) -OutName $f.out
}
& $sevenZip e -y $geistZip 'geist-font/OFL.txt' "-o$srcDir" | Out-Null
Copy-Item (Join-Path $srcDir 'OFL.txt') (Join-Path $outDir 'geist-mono-OFL.txt') -Force

# ---------------------------------------------------------------- Retire the old faces
# Schibsted Grotesk and IBM Plex Mono were the first-generation pair. Caveat went with them once the
# design file's `Ink/Annotation` style was deleted: it appears on no node, and the app never rendered
# ink as text anyway — annotations are canvas strokes, so 104 KB shipped for nothing.
Get-ChildItem $outDir -Filter 'schibsted-grotesk-*.woff2' -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem $outDir -Filter 'ibm-plex-mono-*.woff2'     -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem $outDir -Filter 'caveat-*.woff2'            -ErrorAction SilentlyContinue | Remove-Item -Force

# ---------------------------------------------------------------- Emit fonts.css
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('/* Generated by scripts/fetch-fonts.ps1 - do not edit by hand. */')
[void]$sb.AppendLine('/* Self-hosted so the app has no network dependency at runtime. */')
[void]$sb.AppendLine('/*')
[void]$sb.AppendLine(' * SF Pro     - UI and titles. Text 400/500/600/700 for 10-17px, Display 600/700 for 20px+.')
[void]$sb.AppendLine(' *              Apple''s optical crossover is 20pt, so Text carries almost the whole ramp.')
[void]$sb.AppendLine(' * Geist Mono - exam and machine data only: paper codes, /variant, marks, timer, difficulty')
[void]$sb.AppendLine(' *              score, session codes, kbd. SIL OFL 1.1 (see geist-mono-OFL.txt).')
[void]$sb.AppendLine(' *')
[void]$sb.AppendLine(' * One file per face for SF Pro and Geist Mono, so no unicode-range is declared: the face')
[void]$sb.AppendLine(' * either has the glyph or the browser falls back, which is what we want for a fixed set.')
[void]$sb.AppendLine(' */')

function Add-Face {
  param([string]$Family, [string]$Weight, [string]$File, [string]$Range)
  [void]$sb.AppendLine('')
  [void]$sb.AppendLine('@font-face {')
  [void]$sb.AppendLine("  font-family: '$Family';")
  [void]$sb.AppendLine('  font-style: normal;')
  [void]$sb.AppendLine("  font-weight: $Weight;")
  [void]$sb.AppendLine('  font-display: swap;')
  [void]$sb.AppendLine("  src: url('../assets/fonts/$File') format('woff2');")
  if ($Range) { [void]$sb.AppendLine("  unicode-range: $Range;") }
  [void]$sb.AppendLine('}')
}

Add-Face 'SF Pro Text'    '400' 'sf-pro-text-400-normal.woff2'
Add-Face 'SF Pro Text'    '500' 'sf-pro-text-500-normal.woff2'
Add-Face 'SF Pro Text'    '600' 'sf-pro-text-600-normal.woff2'
Add-Face 'SF Pro Text'    '700' 'sf-pro-text-700-normal.woff2'
Add-Face 'SF Pro Display' '600' 'sf-pro-display-600-normal.woff2'
Add-Face 'SF Pro Display' '700' 'sf-pro-display-700-normal.woff2'
Add-Face 'Geist Mono'     '400' 'geist-mono-400-normal.woff2'
Add-Face 'Geist Mono'     '500' 'geist-mono-500-normal.woff2'
Add-Face 'Geist Mono'     '600' 'geist-mono-600-normal.woff2'

[System.IO.File]::WriteAllText($cssOut, $sb.ToString())

$total = [math]::Round(((Get-ChildItem $outDir -Filter '*.woff2' | Measure-Object Length -Sum).Sum / 1KB), 0)
Write-Host ""
Write-Host "$total KB of woff2 -> src/styles/fonts.css"
