# Brand — Bell Wordmark & Lockups (measured spec)

Figma page **`379:2` "Brand — Bell Logo"**, file `GnDdYtn8SaQjgmA4SQRCn7`.
Read-only measurement. Numbers come from `get_metadata` (native px), from
`get_design_context` insets resolved against the parent box, and — for the type — from the
**SVG outline export of `382:2`**, which is the only way to get real glyph geometry.

## 0. Node map

| thing | node | x,y | size | layout |
|---|---|---|---|---|
| Bell / Wordmark (variant set) | `383:57` | 0,100 | 220x226 | set container — not a design surface |
| — Specs=On | `382:2` | 0,0 in set | **196x88** | NONE (absolute) |
| — Specs=Off | `383:48` | 0,120 in set | **196x88** | NONE (absolute) |
| Lockup — Horizontal | `382:58` | 0,400 | **296x88** | NONE (absolute) |
| Lockup — Stacked | `382:59` | 360,400 | **196x200** | NONE (absolute) |
| Mr. Bell Mark (referenced) | `363:5` | — | **64x64** native | NONE (absolute) |
| scale specimen | `384:4316` | 0,940 | 640x160 | NONE; fill `--ground`, radius `--r-panel` (16), clips |
| preview — night / day | `383:60` / `383:80` | 0,690 / 600,690 | 560x168 | NONE; fill `--ground`; lockup instance at 140,40 |

**No auto-layout anywhere in the identity components.** Every child is absolutely placed, so
"gap" below always means a measured box-edge distance, never a flex gap. Both variants share one
196x88 box; the 220x226 set frame is Figma chrome (32px row gap between variants).

## 1. The type

| property | value |
|---|---|
| family | SF Pro **Expanded** |
| style | Bold |
| variable axes as Figma emits them | `font-weight: 760`, `font-variation-settings: "wdth" 132` |
| size | **96px** |
| tracking | -2% = **-1.92px** |
| line height | AUTO → `line-height: normal`, resolves to **115px** (1.19792em) |
| fill | `--ink` — Day `#1b1d27`, Night `#ffffff` (the only part of the logo that inverts) |
| string | `Bell` — cap B, lowercase e, two lowercase l |

Text node (`379:3` in On, `383:49` in Off), auto-width, **relative to the 196x88 component box**:

| | x | y | w | h | spans |
|---|---|---|---|---|---|
| text node box | **-5** | **-6** | **197** | **115** | x -5→192, y -6→109 |

The text node deliberately overhangs its own component box (5px left, 21px below). The *ink* does
not — §2. Identical coordinates in both variants.

## 2. Measured ink of the word at 96px

Component coordinates inside the 196x88 box. Taken from the outline export, so these are the real
glyph edges, not the text frame.

| edge | value |
|---|---|
| ink left (B stem) | **0.531** |
| ink right (l 2) | **186.443** |
| **ink width** | **185.912** |
| ink top = cap line = l-ascender line | **18.359** |
| **baseline** | **86.000** |
| ink bottom (e overshoot) | 87.219 |
| cap height | 67.641 (0.70459 em) |
| x-height | 51.641 (0.53793 em) |
| e overshoot below baseline | 1.219 |

Per-glyph subpath boxes (5 subpaths, in path order):

| subpath | x | y |
|---|---|---|
| B bowl + arms | 9.578 → 72.344 | 18.359 → 86.000 |
| B stem | 0.531 → 18.344 | 18.359 → 86.000 |
| e | 75.439 → 138.814 | 34.359 → 87.219 |
| **l 1** | **144.160 → 161.551** | 18.359 → 86.000 |
| **l 2** | **169.053 → 186.443** | 18.359 → 86.000 |

Side bearings: left **5.531** (text box -5 → ink 0.531), right **5.557** (ink 186.443 → text box
192) — near-symmetric, which is why the designer nudged the text to x=-5: it lands the B ink half a
pixel off the box's left edge. The baseline sits **2px above the box bottom**; the cap line sits
**18.359px below the box top**, and that headroom is exactly where the spectacles live.

## 3. THE TWO VERIFICATION NUMBERS

| number | value | how to check the generated SVG |
|---|---|---|
| width-to-size ratio (ink) | **1.93658** = 185.912 / 96 | tight bbox width of the outlined word ÷ font size |
| gap between the two l stems | **7.502px** at 96 (0.07815 em) | l1 right 161.551 → l2 left 169.053 |

Supporting figures: stem width **17.391 / 17.390** (0.18116 em) · stem centres **152.856** and
**177.748** · stem pitch **24.892**. If you measure the text *frame* instead of the ink you get
197/96 = **2.05208** — a different number; do not mix them.

More than ~0.5% off on either means the width axis is wrong (must be `wdth 132`, not the default
100) or the -1.92px tracking was dropped.

## 4. Specs=On — the spectacles (`382:2`)

Eight children, all absolutely placed in the 196x88 box. Every rect is **corner radius 0** (plain
`<rect>`, no `rx` in the export — do not apply any `--r-*` token). Row order = paint order,
back to front.

| z | name | node | x | y | w | h | fill |
|---|---|---|---|---|---|---|---|
| 1 | Bell (text) | `379:3` | -5 | -6 | 197 | 115 | `--ink` |
| 2 | bridge | `380:3` | **165** | **6** | **5** | **8** | `--bell-cap-lo` |
| 3 | temple L | `381:2` | **139** | **8** | **6** | **4** | `--bell-cap-lo` |
| 4 | temple R | `381:3` | **190** | **8** | **6** | **4** | `--bell-cap-lo` |
| 5 | lens L | `380:4` | **145** | **0** | **20** | **20** | `--bell-cap-hi` |
| 6 | lens R | `380:5` | **170** | **0** | **20** | **20** | `--bell-cap-hi` |
| 7 | pupil L | `380:6` | **152** | **7** | **6** | **6** | `--page-ink` |
| 8 | pupil R | `380:7` | **177** | **7** | **6** | **6** | `--page-ink` |

Exact derived rules — build from these, they are consistent to the pixel:

- lens band occupies y **0..20**; lenses are 20x20 at a **25px pitch** (145, 170) leaving a **5px**
  gap at x 165..170.
- bridge fills that gap exactly (x 165..170) and is **vertically centred in the band** (6 above,
  6 below). It is painted *under* the lenses but nothing of it is covered.
- temples are 6x4, **vertically centred in the band** (y 8..12), flush against the outer edge of
  each lens: L x 139..145, R x 190..196. **temple R's right edge is the component's right edge.**
- pupils are 6x6 **centred in their lens** — 7px inset on all four sides.
- lens centres land at x **155** and **180**; the temple/lens assembly spans x 139..196.

```
      x 139  145        165 170        190  196
y  0         +----------+   +----------+            lens L / lens R      --bell-cap-hi
y  6         |          |###|          |            bridge 5x8           --bell-cap-lo
y  7         |  [pupL]  |###|  [pupR]  |            pupils 6x6           --page-ink
y  8  [tmpL]=|          |   |          |=[tmpR]     temples 6x4          --bell-cap-lo
y 12  ‾‾‾‾‾‾ |          |   |          |
y 20         +----------+   +----------+
y 18.359 ─────── cap line: top of B / e-less letters and both l stems ───────
              l1 stem 144.160..161.551      l2 stem 169.053..186.443
y 86.000 ═══════════════ BASELINE ═══════════════
y 87.219 ── e overshoot ──          y 88 ── box bottom ──
```

The join is deliberately imperfect: the lens pitch (25) is not the stem pitch (24.892) and the
lens centres are ~2.15px right of the stem centres. See TRAPS 1–2.

## 5. Specs=Off (`383:48`)

Same 196x88 box, same text node at the same `-5,-6 / 197x115`, spectacle rects removed. Nothing
else differs — no re-tracking, no re-centring, no width change.

## 6. Mr. Bell Mark (`363:5`) — reference geometry both lockups need

Native **64x64**, 16 rects, radius 0, on a strict 4px grid. Paint order = row order.

| z | name | x | y | w | h | fill |
|---|---|---|---|---|---|---|
| 1 | claw L | 4 | 36 | 8 | 8 | `--bell-cap-lo` |
| 2 | claw L tip | 4 | 44 | 4 | 4 | `--bell-cap-lo` |
| 3 | claw R | 52 | 36 | 8 | 8 | `--bell-cap-lo` |
| 4 | claw R tip | 56 | 44 | 4 | 4 | `--bell-cap-lo` |
| 5 | leg 1 | 14 | 52 | 12 | 4 | `--bell-cap-lo` |
| 6 | leg 2 | 26 | 52 | 12 | 4 | `--bell-cap-lo` |
| 7 | leg 3 | 38 | 52 | 12 | 4 | `--bell-cap-lo` |
| 8 | stalk L | 16 | 28 | 4 | 4 | `--bell-cap-mid` |
| 9 | stalk R | 44 | 28 | 4 | 4 | `--bell-cap-mid` |
| 10 | shell | 12 | 32 | 40 | 20 | `--bell-cap-mid` |
| 11 | bridge | 28 | 14 | 8 | 8 | `--bell-cap-lo` |
| 12 | lens L | 8 | 8 | 20 | 20 | `--bell-cap-hi` |
| 13 | lens R | 36 | 8 | 20 | 20 | `--bell-cap-hi` |
| 14 | pupil L | 14 | 14 | 8 | 8 | `--page-ink` |
| 15 | pupil R | 42 | 14 | 8 | 8 | `--page-ink` |

**Mark ink bbox (native): x 4..60, y 8..56** → 56x48 ink inside a 64x64 box (4px left/right, 8px
top/bottom of slack). Scale it, never restyle it:

| used at | scale | box | ink bbox in box |
|---|---|---|---|
| Lockup — Horizontal | 1.25 | 80x80 | x 5..75, y 10..70 |
| Lockup — Stacked | 1.50 | 96x96 | x 6..90, y 12..84 |

## 7. Lockup — Horizontal (`382:58`) — 296x88

| child | node | variant | x | y | w | h |
|---|---|---|---|---|---|---|
| Mr. Bell Mark | `382:7` | — | **0** | **9** | **80** | **80** |
| Bell / Wordmark | `382:23` | **Specs=Off** | **100** | **0** | **196** | **88** |

| measurement | value |
|---|---|
| box gap, mark → wordmark | **20px** (80 → 100) |
| optical gap, mark ink right (75) → B ink left (100.531) | **25.531px** |
| mark vertical | box y 9..89 → **ink y 19..79** |
| mark ink top (19) vs cap line (18.359) | mark is 0.641px low — **cap-top aligned** |
| mark ink bottom (79) vs baseline (86) | mark stops **7px above** the baseline |
| wordmark ink in lockup coords | x 100.531..286.443, y 18.359..87.219, **baseline y 86** |
| lockup ink extent | x **5..286.443** (281.44 wide), y 18.359..87.219 |
| dead space at right edge | **9.557px** (Specs=Off does not use the temple overhang) |

```
0        80  100                                            296
|<--mark-->| gap |<---------- wordmark box 196 ------------->|
   80x80    20                Specs=Off
   y 9..89                    baseline y 86
   ink 5..75 / y 19..79       ink 100.531..286.443
                              ^ cap line y 18.359 ≈ mark ink top y 19
```

**The mark hangs 1px below the frame** (9+80 = 89 vs height 88). Real, not rounding.

## 8. Lockup — Stacked (`382:59`) — 196x200

| child | node | variant | x | y | w | h |
|---|---|---|---|---|---|---|
| Mr. Bell Mark | `382:33` | — | **48** | **0** | **96** | **96** |
| Bell / Wordmark | `382:49` | **Specs=Off** | **0** | **112** | **196** | **88** |

| measurement | value |
|---|---|
| box gap, mark → wordmark | **16px** (96 → 112) |
| optical gap, mark ink bottom (84) → cap line (130.359) | **46.359px** |
| mark ink in lockup coords | x 54..138, y 12..84 |
| wordmark ink in lockup coords | x 0.531..186.443, y 130.359..199.219 |
| **baseline** | **y 198** (2px above the 200 frame bottom) |
| mark box / ink centre x | **96** |
| frame centre x | 98 |
| type ink centre x | 93.487 |

```
        48            144            196
  y 0    +--- mark 96x96 ---+                mark ink x 54..138, y 12..84
  y 96   +------------------+
         |     16px gap     |
  y 112  +---- wordmark box 196x88 --------+  Specs=Off
  y 198  ============ BASELINE ============
  y 200  +--------------------------------+
```

The mark is horizontally **2px left of the frame centre** and 2.5px right of the type-ink centre.
Ship x=48; see TRAP 6.

## 9. Scale specimen (`384:4316`) and the specs threshold

Frame 640x160, fill `--ground`, radius 16 (`--r-panel`), clips content. Four instances of
`383:57`, uniformly scaled (the scale carries into font-size and tracking — these are Scale-tool
instances, not resized ones):

| step | node | left,top | w x h | scale | font-size | tracking | variant | baseline y |
|---|---|---|---|---|---|---|---|---|
| 1 | `384:4317` | 32,33 | 196 x 88 | 1.00 | 96px | -1.92 | **On** | 119.0 |
| 2 | `384:4326` | 260,68 | 117.6 x 52.8 | 0.60 | **57.6px** | -1.152 | **On** | 119.6 |
| 3 | `384:4335` | 410,85 | 78.4 x 35.2 | 0.40 | **38.4px** | -0.768 | **Off** | 119.4 |
| 4 | `384:4345` | 520,98 | 49 x 22 | 0.25 | 24px | -0.48 | **Off** | 119.5 |

Baselines agree within 0.6px at y ≈ 119.5, so the specimen is **baseline-aligned, not
box-aligned** — an independent confirmation that the baseline is `86 x scale` down from each box's
top. To baseline-align the wordmark in code, offset by `0.89583 x height` (86/96) from the top of
the box, or just remember: 2px of the 88 sits below the baseline at scale 1.

**Threshold rule: Specs=On at font-size >= 58px (box width >= ~118px); Specs=Off below it.**
Last On step is 57.6px, first Off step is 38.4px, and the page note (`385:90`) reads "the pixel
lenses hold to roughly 58px; below that switch to Specs=Off". Also use Specs=Off for one-colour
print and in any composition where Mr. Bell already appears.

## 10. Live usage — the sidebar logo (0.35)

Verified in **Library — Day** (`40:1080`) → `sidebar` `44:6` (238x860):

| level | node | value |
|---|---|---|
| `brand` frame | `44:14` | x 12, y 34, **111.6 x 50.8**, hug. **AUTO-LAYOUT: row, align center, padding 6 / 0 / 14 / 8** (t/r/b/l) |
| `logo` instance | `390:4344` | **Lockup — Horizontal at 0.35** → **103.6 x 30.8** (rounds to the 104x31 the app uses) |
| nested type | — | font-size **33.6px**, tracking **-0.672px**, **Specs=Off** |
| nested mark | — | 80 x 0.35 = **28px** (the Mark component's documented floor is 26px, so this is in spec) |
| effect override | — | both halves carry `drop-shadow(0 0.7px 0.7px rgba(0,0,0,0.25))` = **`0 2px 2px rgba(0,0,0,.25)` at scale 1**. The base component `382:58` has **no** shadow — this is an instance override in the sidebar. |

`104 x 31` is the **horizontal lockup** at 0.35 (296x88 → 103.6x30.8). The bare wordmark at 0.35
would be 68.6x30.8, so if you see 104 wide, it is the lockup. At 0.35 the 1px mark overhang becomes
0.35px and disappears into the rounded 31px box.

The same sidebar separately hosts the full **Mr. Bell** rig (`375:828`, 160x160) in a `mascot`
frame at y 623.8 — which is why the lockup's wordmark is Specs=Off: the spectacles appear once per
screen.

## 11. Reference outline — ship this, not live text

SF Pro Expanded is Apple-licensed and not a webfont. Live text falls back off Apple platforms, the
stems move, and the spectacles desync from the letters. Export the word once as outlines and place
the spectacle rects against it. This is the exact path from Figma, in the **196x88** wordmark
coordinate space (5 subpaths: B bowl, B stem, e, l1, l2; `fill-rule` default nonzero):

```svg
<svg viewBox="0 0 196 88" width="196" height="88" role="img" aria-label="Bell">
  <path fill="var(--ink)" d="M9.57812 86V73.625H43.0469C46.5781 73.625 49.2969 72.9219 51.2031 71.5156C53.1094 70.1094 54.0625 68.0625 54.0625 65.375V65.3281C54.0625 63.5156 53.6094 62 52.7031 60.7812C51.8281 59.5625 50.5156 58.6562 48.7656 58.0625C47.0469 57.4375 44.9219 57.125 42.3906 57.125H9.57812V46.2031H40.3281C43.8594 46.2031 46.5781 45.5312 48.4844 44.1875C50.3906 42.8125 51.3438 40.875 51.3438 38.375V38.2812C51.3438 35.8438 50.5 33.9844 48.8125 32.7031C47.1562 31.3906 44.8438 30.7344 41.875 30.7344H9.57812V18.3594H46.8438C51.4688 18.3594 55.4375 19.0312 58.75 20.375C62.0938 21.7188 64.6562 23.6406 66.4375 26.1406C68.2188 28.6406 69.1094 31.625 69.1094 35.0938V35.1875C69.1094 37.8125 68.5312 40.1719 67.375 42.2656C66.25 44.3281 64.6406 46.0469 62.5469 47.4219C60.4844 48.7969 58.0469 49.7344 55.2344 50.2344V50.4688C58.7656 50.8438 61.7969 51.7656 64.3281 53.2344C66.8906 54.6719 68.8594 56.5625 70.2344 58.9062C71.6406 61.25 72.3438 63.9219 72.3438 66.9219V67.0156C72.3438 70.9844 71.3438 74.3906 69.3438 77.2344C67.3438 80.0781 64.4688 82.25 60.7188 83.75C57 85.25 52.5156 86 47.2656 86H9.57812ZM0.53125 86V18.3594H18.3438V86H0.53125ZM107.971 87.2188C101.252 87.2188 95.455 86.1875 90.58 84.125C85.7363 82.0625 82.0019 79.0781 79.3769 75.1719C76.7519 71.2344 75.4394 66.5 75.4394 60.9688V60.9219C75.4394 55.4531 76.7675 50.7344 79.4238 46.7656C82.1113 42.7969 85.8456 39.7344 90.6269 37.5781C95.4081 35.4219 100.971 34.3594 107.314 34.3906C113.783 34.4219 119.377 35.5469 124.096 37.7656C128.814 39.9844 132.439 43.1094 134.971 47.1406C137.533 51.1406 138.814 55.8438 138.814 61.25V64.4844H84.3925V55.5312H127.611L122.549 62.0938V58.9531C122.549 56.1719 121.955 53.7969 120.768 51.8281C119.611 49.8281 117.924 48.2969 115.705 47.2344C113.486 46.1719 110.814 45.6406 107.689 45.6406C104.439 45.6406 101.658 46.1719 99.3456 47.2344C97.0331 48.2656 95.2519 49.8125 94.0019 51.875C92.7831 53.9062 92.1738 56.4219 92.1738 59.4219V62.0469C92.1738 65.3906 92.8769 68.0938 94.2831 70.1562C95.6894 72.2188 97.6113 73.7188 100.049 74.6562C102.518 75.5938 105.346 76.0625 108.533 76.0625C110.596 76.0625 112.518 75.8281 114.299 75.3594C116.08 74.8906 117.611 74.2344 118.893 73.3906C120.205 72.5469 121.189 71.5469 121.846 70.3906L121.986 70.1094H138.111L137.971 70.625C137.252 73.1562 136.018 75.4531 134.268 77.5156C132.549 79.5469 130.393 81.2969 127.799 82.7656C125.205 84.2031 122.236 85.2969 118.893 86.0469C115.549 86.8281 111.908 87.2188 107.971 87.2188ZM144.16 86V18.3594H161.551V86H144.16ZM169.053 86V18.3594H186.443V86H169.053Z"/>
  <rect x="165" y="6"  width="5"  height="8"  fill="var(--bell-cap-lo)"/>
  <rect x="139" y="8"  width="6"  height="4"  fill="var(--bell-cap-lo)"/>
  <rect x="190" y="8"  width="6"  height="4"  fill="var(--bell-cap-lo)"/>
  <rect x="145" y="0"  width="20" height="20" fill="var(--bell-cap-hi)"/>
  <rect x="170" y="0"  width="20" height="20" fill="var(--bell-cap-hi)"/>
  <rect x="152" y="7"  width="6"  height="6"  fill="var(--page-ink)"/>
  <rect x="177" y="7"  width="6"  height="6"  fill="var(--page-ink)"/>
</svg>
```

Four assets, one geometry:

| asset | viewBox | contents |
|---|---|---|
| `wordmark-specs-on` | `0 0 196 88` | path + 7 rects above |
| `wordmark-specs-off` | `0 0 196 88` | path only |
| `lockup-h` | `0 0 296 89` — **89, not 88** | `<g transform="translate(0 9) scale(1.25)">` mark `</g>` + `<g transform="translate(100 0)">` path `</g>` |
| `lockup-stacked` | `0 0 196 200` | `<g transform="translate(48 0) scale(1.5)">` mark `</g>` + `<g transform="translate(0 112)">` path `</g>` |

Keep the layout box at 296x88 for the horizontal lockup even though its viewBox is 89 tall, or
crop to 88 and lose 1px of the leg row. Do not set `shape-rendering: crispEdges` — at 0.35 the
mark's 4px grid lands on 1.4px steps and the legs will jitter.

## TRAPS

1. **Lens centres are not stem centres.** Lens centres are 155 / 180; measured stem centres are
   152.856 / 177.748. The spectacles sit ~2.15px right of the type. Deliberate — place the lenses
   at x **145** and **170** and do not "fix" the alignment. (The component description quotes the
   centres, 155/180; the rect origins are 145/170. Two different numbers for the same thing.)
2. **Lens gap (5px) is not stem gap (7.502px).** The bridge is 5 wide because it spans lens-to-lens,
   not stem-to-stem. Never derive the bridge width from the letters.
3. **The text node is bigger than its component box**: 197x115 at (-5,-6) inside 196x88. The ink is
   fully inside (0.531..186.443 / 18.359..87.219), so clipping the wordmark at 196x88 is safe — but
   `overflow: hidden` on the *horizontal lockup* costs you 1px of leg (see 4).
4. **Horizontal lockup mark overhangs the frame by 1px**: y 9 + h 80 = 89 vs frame height 88. Use
   viewBox height 89 for the standalone asset.
5. **Two component descriptions are stale.** `382:58` says "Mr. Bell Mark at native 64px" — the
   instance measures **80x80** (1.25x). `383:57` says "Use Specs=Off below ~40px" while the page
   note and the specimen put the switch at **~58px**. Trust the measurements: 80px mark, 58px
   threshold.
6. **"The mark is centred on the wordmark ink" (stacked) is not literally true.** Mark centre 96,
   type ink centre 93.487, frame centre 98. Ship the measured x=**48**.
7. **`--page-ink` is mode-invariant** (`#1a1c24`). Verified by reading the same nodes in a Day
   context (`--ink` → `#1b1d27`) and a Night context (`--ink` → `#ffffff`) — `--page-ink` did not
   move. The pupils therefore stay dark on Night; do not bind them to `--ink`.
8. **`--bell-cap-hi / -mid / -lo` are also mode-invariant.** The only part of the identity that
   inverts is the word itself (`--ink`). The blue is the logo's one fixed accent.
9. **SF Pro is not a webfont.** Live text will fall back off Apple platforms, the stems shift, and
   the spectacles land in the wrong place. Ship §11's outline; keep text only as `aria-label`.
10. **"Expanded" = `wdth` 132 and weight 760**, not 100/700 and not 125. Get the axis wrong and
    both verification numbers in §3 break.
11. **Both lockups use Specs=Off** (confirmed by the nested text node id `383:49`). Never pair
    Specs=On with the mark — that would put spectacles on the crab *and* on the word.
12. **The lockups inherit the wordmark's 196-wide box even with Specs=Off**, and that box was sized
    for the temple overhang. So the horizontal lockup carries **9.557px of dead space at its right
    edge**; its ink spans x 5..286.443. Centre on the ink (145.72), not on the box (148).
13. **Every rect in the wordmark and the mark has corner radius 0.** No `--r-*` token applies
    anywhere in the identity.
14. **All line heights are AUTO** → `line-height: normal`. At 96px that resolves to 115px; if you
    hard-code a line-height you move the baseline off 86.
15. `get_metadata` on the 1320x860 screen frames (`46:417`, `202:236`) returns **zero children**;
    the Library **component** `40:1080` does enumerate, which is how §10 was measured.

## Not in the file

No formal clear-space rule is defined. The only evidence is the preview frames (`383:60` /
`383:80`, 560x168, fill `--ground`): the 296x88 lockup sits at 140,40, i.e. 40px above and below,
140 left / 124 right — a specimen layout, not a rule. If you need one, 40px at scale 1 (≈0.45 x the
lockup height) is the only number the file supports.
