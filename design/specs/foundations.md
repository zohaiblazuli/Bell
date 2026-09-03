# Bell — Foundations spec (measured)

Source: Figma `GnDdYtn8SaQjgmA4SQRCn7` "Foolscap — Design System".
Read-only extraction of the three documentation frames plus a full sweep for paint / effect / text
styles. Every number below is measured off node paints, layout or the style definition — nothing
is inferred unless the row says `INFERRED`.

Frames covered: `9:2` Foundations — Colour (782x2208) · `11:2` Foundations — Elevation & Glass
(720x1312) · `12:2` Getting Started (760x941).

Universal type rule: every text style has line height AUTO → `line-height: normal` in CSS.
Figma letterSpacing is stored in **percent**; the px column is percent x fontSize.

---

## 1. Getting Started (`12:2`, 760x941)

Root: VERTICAL auto-layout, gap **40**, items-start, no padding, hug height.

```
12:2  Getting Started            760 x 941, col, gap 40
├─ 12:3  head                    y0    h73   col gap 10
│   ├─ "Getting Started"         Display/Setup Title, --ink
│   └─ blurb                     Body/Small, --ink-3, w760, h32
├─ 12:6  Governing principle     y113  h53   col gap 8
│   ├─ "STEAL THE DISCIPLINE, NOT THE POSTER"   Label/Section, --accent
│   └─ blurb                     Body/Small, --ink-3, w760, h32
├─ 12:9  Rules                   y206  h315  col gap 18 (label→first item)
│   ├─ "THE FIVE RULES"          Label/Section, --ink-3
│   └─ 5 x item                  row gap 16 · number 18x17 (Body/Strong-ish 13) · text col gap 4
│                                title Body/Strong --ink w726 · body Body/Small --ink-3 w726
├─ 12:36 Day / Night             y561  h63   col gap 8
└─ 12:39 Slop blocklist          y664  759x277, pad 24, r --r-card(13), bg --card, 1px --card-brd
    ├─ "DO NOT SHIP THESE"       Label/Section, --d5      (24,24)
    └─ 8 x item                  y49, pitch 27 (h15 + gap 12), row gap 10
                                 dash "—" w11 --ink-3 · text w690 Body/Small --ink-2
```

Item vertical pitch inside 12:9: 66 / 66 / 66 / 52 (item heights 48,48,48,34,34; gap 18).

### Verbatim content

**Header** — "This library mirrors src/styles/tokens.css in C:\ShinyPapersDesktop. The code is the
source of truth — when the two disagree, the code wins and this file gets corrected. Precedence:
Zohaib's words, then CLAUDE.md, then anyone's taste."

**Governing principle** — STEAL THE DISCIPLINE, NOT THE POSTER. "The aesthetic is the OS-glass
lineage — Aqua, then visionOS, then Liquid Glass — used as a material and an accent, never as
wallpaper. The hero of every screen is the bright white exam PDF."

**THE FIVE RULES**

| # | Rule | Body |
|---|------|------|
| 1 | Glass is chrome, never content. | Translucency, backdrop blur and a specular edge live only on the frame: sidebar, top bar, palette, sheets. Cards and the paper stay calm and mostly opaque. |
| 2 | One iridescent accent, spent as a line. | The iris gradient appears only on live elements — focus ring, active tab, timer ring, progress bar, selection, tool-active edge. It is never a fill or a wash. The single exception is the primary button. |
| 3 | Difficulty is a separate warm heat scale. | difficulty/1 through difficulty/5 are their own axis. Never mix them with the brand iris, and never retone them between Day and Night. |
| 4 | Content-first contrast. | The white paper is the brightest, highest-contrast thing on screen. Glass and accent never out-shout it. |
| 5 | Lush renders only where nothing competes. | App icon, onboarding, empty states, the session-complete moment, marketing. Never behind dense content. |

**SWITCHING TONE** — "Select a frame and set the Color collection to Day or Night. In the app this
is a product-level toggle on `.app[data-tone]`, never `prefers-color-scheme` — the user chooses,
not the OS. The Foundations — Colour page shows both modes side by side using per-frame overrides."

**DO NOT SHIP THESE** (8 items, verbatim)
1. Default zinc/slate greys, or Inter / Space Grotesk / Geist as the type.
2. Full-bleed holographic wallpaper behind content; glass cards floating on a rainbow blur.
3. Violet-to-blue gradient heroes; the accent used as a fill instead of a line.
4. Emoji as section headings or bullets.
5. `rounded-2xl` on everything; everything centered; drop shadows on flat cards for no reason.
6. 01 / 02 / 03 markers unless the content is a real ordered sequence.
7. Lorem ipsum — always real paper codes, subjects, sessions, mark-scheme rows.
8. Mixing the difficulty heat scale with the brand iris.

---

## 2. Foundations — Colour (`9:2`, 782x2208)

Root: VERTICAL, gap **24**, items-start, hug.

```
9:2   Foundations — Colour                     782 x 2208, col, gap 24
├─ 9:3  "Colour"                               Display/Setup Title, --ink, h31
├─ 9:4  blurb                                  Body/Small, --ink-3, w760, h32
├─ 9:5  Day / Night                            782x1239  ROW gap 24, overflow-clip
│   ├─ 9:6   Swatches — DAY    379x1239  pad 28, col gap 9, bg --ground (Day override)
│   └─ 9:128 Swatches — NIGHT  379x1239  pad 28, col gap 9, bg --ground (Night override)
│        label "DAY"/"NIGHT"   Label/Section, --ink-3, then 9px to first row
│        30 x row              323x30, ROW gap 14, items-center, pitch 39
│          ├ swatch            52x30, r **7**, fill = the token, 1px border --hair
│          ├ token name        w150 FIXED, Body/Small, --ink
│          └ css var           hug,  Mono/Small, --ink-3
└─ 30:2 Contrast                               748x834, pad 24, col gap 14
```

Row order is identical in both columns (index → token): ground/base, ground/raised, ambient/a,
ambient/b, paper/base, paper/ink, paper/ink-2, paper/line, ink/1, ink/2, ink/3, glass/base,
glass/strong, glass/border, glass/highlight, hair/1, hair/2, card/fill, card/border, accent/base,
accent/soft, iris/1..4, difficulty/1..5.

Page blurb, verbatim: "30 semantic tokens, aliased to 47 primitives. 17 retone between Day and
Night; 13 are deliberately identical — the paper, the iris ramp and the difficulty heat scale never
change tone."  **Both counts are wrong — see TRAPS T1.**

### 2.1 The 30 swatched semantic tokens — both modes

| Figma variable | CSS var | Day | Night | retones? |
|---|---|---|---|---|
| ground/base | `--ground` | `#e7e9f2` | `#111219` | yes |
| ground/raised | `--ground-2` | `#dcdfeb` | `#0b0c12` | yes |
| ambient/a | `--ambient-a` | `#6aa8ff` | `#7fb6ff` | yes |
| ambient/b | `--ambient-b` | `#58c8ff` | `#6ed4ff` | yes |
| paper/base | `--paper` | `#ffffff` | `#ffffff` | no |
| paper/ink | `--page-ink` | `#1a1c24` | `#1a1c24` | no |
| paper/ink-2 | `--page-ink-2` | `#5b6072` | `#5b6072` | no |
| paper/line | `--page-line` | `#1a1c2424` | `#1a1c2424` | no |
| ink/1 | `--ink` | `#1b1d27` | `#ffffff` | yes |
| ink/2 | `--ink-2` | `#4c5165` | `#dfe3ef` | yes |
| ink/3 | `--ink-3` | `#62677c` | `#b9bece` | yes |
| glass/base | `--glass` | `#ffffff94` | `#20223085` | yes |
| glass/strong | `--glass-strong` | `#ffffffbd` | `#26283ab2` | yes |
| glass/border | `--glass-brd` | `#ffffffcc` | `#ffffff1f` | yes |
| glass/highlight | `--glass-hi` | `#ffffffa6` | `#ffffff24` | yes |
| hair/1 | `--hair` | `#181a341c` | `#ffffff24` | yes |
| hair/2 | `--hair-2` | `#181a3412` | `#ffffff17` | yes |
| card/fill | `--card` | `#f6f7fc` | `#24273ae5` | yes |
| card/border | `--card-brd` | `#181a3417` | `#ffffff29` | yes |
| accent/base | `--accent` | `#1436c8` | `#6aa8ff` | yes |
| accent/soft | `--accent-soft` | `#1436c81f` | `#6aa8ff29` | yes |
| iris/1 | `--iris-1` | `#6aa8ff` | `#6aa8ff` | no |
| iris/2 | `--iris-2` | `#2c7bff` | `#2c7bff` | no |
| iris/3 | `--iris-3` | `#1436c8` | `#1436c8` | no |
| iris/4 | `--iris-4` | `#f3b7c6` | `#f3b7c6` | no |
| difficulty/1 | `--d1` | `#8f6300` | `#ffd24a` | **yes** |
| difficulty/2 | `--d2` | `#9e5200` | `#ffae33` | **yes** |
| difficulty/3 | `--d3` | `#a63d08` | `#ff8a38` | **yes** |
| difficulty/4 | `--d4` | `#a82a1a` | `#ff6b47` | **yes** |
| difficulty/5 | `--d5` | `#a5103a` | `#ff4d6a` | **yes** |

Measured tally: **22 retone, 8 identical** (paper x4 + iris x4).

### 2.2 Variables that exist in the file but are NOT on this page

| Figma variable | Code Syntax emitted | value(s) | note |
|---|---|---|---|
| bell/cap-hi / -mid / -lo / -deep | *none* → `bell/cap-hi` | `#58c8ff` `#2c7bff` `#1436c8` `#0e2596` | mode-invariant; no CSS var mapping set |
| activity/0..4 | *none* → `activity/0` | Day `#e6eaf2` `#c3d4e7` `#77afee` `#1d85e4` `#2a5c92` | Night per brief `#2b2e40 #2f4665 #2d6bad #2892f7 #a6c8f2` (not re-measured) |
| white | *none* → `white` | `#ffffff` | used for Primary-button label |
| window/close · minimize · zoom | `--traffic-close` `--traffic-minimize` `--traffic-zoom` | `#ff736a` `#febc2e` `#19c332` | |
| radius/window·panel·card·button·chip·pill | `--r-win` `--r-panel` `--r-card` `--r-btn` `--r-chip` `--r-pill` | 15 / 16 / 13 / 10 / 9 / 999 | |
| ground/veil (`--ground-veil`) | — | — | **not found anywhere in the file** |

### 2.3 Contrast block (`30:2`, 748x834)

```
30:2  Contrast          pad 24, col gap 14, bg --card, r --r-card, 1px --card-brd
├─ "CONTRAST — MEASURED, NOT ASSUMED"    Label/Section, --ink-3        y24
├─ intro                                 Body/Small --ink-3 w700 h56  y51
├─ 30:5 header  700x17   cols  PAIR w300 | USED FOR w170 | DAY w115 | NIGHT w115
│                               all Label/Stat-metric text, --ink-3
├─ 14 x row     700x29   y152, pitch 43 · 1px border-TOP --hair-2 · py 7 · row, items-center
│   ├ pair       w300  Geist Mono Regular **11**   --ink
│   ├ used for   w170  SF Pro Regular **11.5**     --ink-3
│   ├ DAY cell   w115  row gap 7 · ratio Geist Mono SemiBold 11.5 · badge SF Pro Semibold 9.5 (+5%)
│   └ NIGHT cell w115  same
└─ footnote                              Body/Small --ink-3 w700 h56  y754
```

Badge colour is set on the CELL and inherited by both texts: `AA` → `--ink-2`,
`large only` → `--d2`, `fail` → `--d5`.

Intro, verbatim: "WCAG AA needs 4.5:1 for text under 18px. Every alpha token is composited over its
real ground before measuring. The warm heat scale is the problem: on the near-white Day card, Gentle
sits at 1.86:1 and Steady and Typical also fail, because a light warm hue on a light surface cannot
carry a 12px label. Night is fine throughout. This is inherited from the locked palette, not
introduced here — see the note under the table."

| Pair | Used for | Day | | Night | |
|---|---|---|---|---|---|
| ink/1 on ground | body | 13.85 | AA | 15.70 | AA |
| ink/2 on ground | secondary | 5.55 | AA | 8.17 | AA |
| ink/3 on ground | tertiary | 2.65 | fail | 4.45 | large only |
| ink/1 on card | card title 15.5 | 15.68 | AA | 14.58 | AA |
| ink/2 on card | card subtitle 12.5 | 6.29 | AA | 7.59 | AA |
| ink/3 on card | score / meta 11-12 | 3.00 | large only | 4.14 | large only |
| accent/base on card | accent text | 4.44 | large only | 6.22 | AA |
| difficulty/1 on card | Gentle label 12 | 1.86 | fail | 8.73 | AA |
| difficulty/2 on card | Steady label 12 | 2.07 | fail | 7.83 | AA |
| difficulty/3 on card | Typical label 12 | 2.57 | fail | 6.31 | AA |
| difficulty/4 on card | Tough label 12 | 3.26 | large only | 4.97 | AA |
| difficulty/5 on card | Brutal label 12 | 3.81 | large only | 4.26 | large only |
| paper/ink on paper | exam paper body | 17.00 | AA | 17.00 | AA |
| paper/ink-2 on paper | exam paper secondary | 6.25 | AA | 6.25 | AA |

Footnote, verbatim: "Not fixed here on purpose. The tokens are locked and ported verbatim, and
changing five hues is Zohaib's call, not a QA pass's. Two options when you want it: darken
difficulty/1-3 for Day only, keeping the same hue family so the scale still reads warm; or keep the
hues and stop using them for text, letting the meter bars carry the band while the word stays on
ink/2. The second is a smaller change and keeps the heat scale intact."

---

## 3. Foundations — Elevation & Glass (`11:2`, 720x1312)

Root: VERTICAL, gap **44**, items-start, hug.

```
11:2  Elevation & Glass                       720 x 1312, col, gap 44
├─ 11:3  "Elevation & Glass"                  Display/Setup Title, --ink
├─ 11:4  blurb                                Body/Small, --ink-3, w720, h28
├─ 11:5  Day / Night        628x575  ROW gap 24, overflow-clip
│   ├─ 11:6  Elevation — DAY    302x575  bg --ground, pad 36, r --r-panel, col gap 34
│   └─ 11:33 Elevation — NIGHT  302x575  same, Night override
│        label DAY/NIGHT        Label/Section --ink-3, then gap 34
│        5 x row               ROW gap 20, items-center
│          ├ surface           120x64, bg --card, 1px --card-brd, r **13 literal**, shadow=style
│          └ meta              col gap 2 · name SF Pro Semibold 12 --ink-2
│                                          · var  Geist Mono Regular 10 --ink-3
├─ 11:60 Glass              720x369  col gap 14
│   ├─ "GLASS IS CHROME, NEVER CONTENT"       Label/Section, **--accent**
│   ├─ blurb                                  Body/Small, --ink-3, w720, h28
│   └─ 11:63 Glass stage    720x300  bg --ground, r **16 literal**, overflow-clip, absolute kids
│        ├ bloom 11:64      420x320 @ (-40,-70)   exported SVG (radial iris bloom)
│        ├ bloom 11:65      380x300 @ (380, 90)   exported SVG
│        ├ 9 x rule         6x300, bg --ink-3 @ opacity 35%, x = 40,118,196,274,352,430,508,586,664
│        └ 11:75 Glass panel 560x150 @ (80,75)
│             bg --glass · 1px --glass-brd · r 16 · overflow-clip
│             effect Glass/Chrome Blur 26 → CSS `backdrop-filter: blur(13px)`
│             label @ (23,23) Mono/Small --ink-2 "glass/base  +  glass/border  +  Glass/Chrome Blur 26"
└─ 11:77 Radius             642x133  col gap 14
    ├─ "RADIUS"                                Label/Section, --ink-3
    └─ 11:79 radii          ROW gap 18 (pitch 110)
         6 x cell           col gap 8, items-center
           ├ swatch         92x64, bg --card, 1px --hair, r = the token
           ├ name           SF Pro Semibold 11 --ink-2
           └ var            Geist Mono Regular 10 --ink-3
```

Page blurb, verbatim: "Effect styles cannot be mode-aware, so each of the five shadows exists
twice. Day shadows are blue-black at low alpha; Night shadows go to pure black and deepen."

Glass blurb, verbatim: "Translucency, backdrop blur and a hair-thin specular edge belong to the
frame only — sidebar, top bar, palette, sheets. Figma has no equivalent for saturate(165%), so this
reads very slightly flatter than the app."

---

## 4. Effect styles — complete set (11)

Figma lists effects top-down; the CSS `box-shadow` list below is written in **CSS order**
(first = painted on top), which is the reverse of the Figma order. All are DROP_SHADOW with
offset-x 0 except the one blur style.

| Style | CSS `box-shadow` |
|---|---|
| Shadow/Card/Day | `0 4px 10px -2px #1214321a, 0 1px 2px 0 #1214320f` |
| Shadow/Card Hover/Day | `0 12px 28px -14px #12143247` |
| Shadow/Window/Day | `0 24px 60px -28px #1214326b, 0 6px 16px -10px #1214323d` |
| Shadow/Paper/Day | `0 32px 60px -30px #12143257, 0 8px 20px -14px #12143238` |
| Shadow/Popover/Day | `0 30px 70px -24px #0e102c80` |
| Shadow/Card/Night | `0 4px 12px -2px #00000073, 0 1px 2px 0 #00000059` |
| Shadow/Card Hover/Night | `0 16px 34px -16px #00000099` |
| Shadow/Window/Night | `0 30px 70px -30px #000000b2, 0 8px 20px -12px #00000080` |
| Shadow/Paper/Night | `0 40px 80px -34px #000000bf, 0 10px 24px -16px #0000008c` |
| Shadow/Popover/Night | `0 40px 90px -28px #000000cc` |
| Glass/Chrome Blur 26 | `backdrop-filter: blur(13px)` — Figma BACKGROUND_BLUR **radius 26** |

Day shadow inks: `#121432` (all five Day styles except Popover) and `#0e102c` (Popover only).
Night shadow ink: `#000000` throughout.

There is exactly **one unnamed local shadow** worth porting: the Primary Button glow
`0 10px 24px -14px #6f76f2e6` (rgba(111,118,242,0.9)) — present on Button/Primary Default, Hover
**and** Disabled. It is not a style; author it as `--shadow-btn-primary`.

---

## 5. Gradient paint styles — complete set (14)

There are **14** gradient paint styles, not 16 — see TRAPS T2 for where the extra two come from.
`get_variable_defs` returns every one of them with an empty value, so all stops below were read off
node paints.

| Style | Geometry | Stops (position → colour, bound variable) | Read from |
|---|---|---|---|
| Blue/Primary Button 135 | 135° box diagonal (Figma) | `0%` **bell/cap-lo** `#1436c8` → `100%` **bell/cap-mid** `#2c7bff` | Button/Primary `22:36` |
| Blue/Line 90 | 90° (left→right) | `0%` **bell/cap-hi** `#58c8ff` · `34%` **bell/cap-mid** `#2c7bff` · `67%` **bell/cap-lo** `#1436c8` · `100%` **bell/cap-deep** `#0e2596` | Nav Item active indicator `25:22` |
| Board/A Level/Wash | 90° | `0%` `#4fc3f7` @ .40 · `100%` `#6aa8ff` @ .40 — **unbound** | Chip `83:27` |
| Board/A Level/Edge | 90° (1px stroke) | `0%` `#4fc3f7` @ .90 · `100%` `#6aa8ff` @ .90 `INFERRED` | Chip `83:27` |
| Board/IGCSE/Wash | 90° | `0%` **bell/cap-mid** `#2c7bff` · `100%` **bell/cap-hi** `#58c8ff` | Chip `83:39` |
| Board/IGCSE/Edge | 90° (1px) | `0%` **bell/cap-mid** `#2c7bff` · `100%` **bell/cap-hi** `INFERRED` | Chip `83:39` |
| Board/O Level/Wash | 90° | `0%` **bell/cap-lo** `#1436c8` · `100%` **bell/cap-mid** `#2c7bff` | Chip `83:51` |
| Board/O Level/Edge | 90° (1px) | `0%` **bell/cap-lo** `#1436c8` · `100%` **bell/cap-mid** `INFERRED` | Chip `83:51` |
| Season/May-June/Wash | 90° | `0%` `#3fb84f` @ .28 · `100%` `#7ed48c` @ .28 — unbound | Chip `110:76` |
| Season/May-June/Edge | 90° (1px) | `0%` `#3fb84f` @ .70 · `100%` `#7ed48c` @ .70 `INFERRED` | Chip `110:76` |
| Season/Oct-Nov/Wash | 90° | `0%` `#1a8b93` @ .28 · `100%` `#46b0ae` @ .28 — unbound | Chip `110:91` |
| Season/Oct-Nov/Edge | 90° (1px) | `0%` `#1a8b93` @ .70 · `100%` `#46b0ae` @ .70 `INFERRED` | Chip `110:91` |
| Season/Feb-March/Wash | 90° | `0%` `#8fcfe6` @ .28 · `100%` `#b8e3f2` @ .28 — unbound | Chip `110:61` |
| Season/Feb-March/Edge | 90° (1px) | `0%` `#8fcfe6` @ .70 · `100%` `#b8e3f2` @ .70 `INFERRED` | Chip `110:61` |

### 5.1 Ship these as CSS

```css
--grad-btn:   linear-gradient(135deg, var(--bell-cap-lo)  0%,  var(--bell-cap-mid) 100%);
--grad-line:  linear-gradient(90deg,  var(--bell-cap-hi)  0%,  var(--bell-cap-mid) 34%,
                                      var(--bell-cap-lo) 67%,  var(--bell-cap-deep) 100%);
/* board / season pairs, wash then edge */
--wash-alevel:   linear-gradient(90deg, #4fc3f766, #6aa8ff66);   --edge-alevel:   linear-gradient(90deg, #4fc3f7e6, #6aa8ffe6);
--wash-igcse:    linear-gradient(90deg, #2c7bff,  #58c8ff);      --edge-igcse:    linear-gradient(90deg, #2c7bff,  #58c8ff);
--wash-olevel:   linear-gradient(90deg, #1436c8,  #2c7bff);      --edge-olevel:   linear-gradient(90deg, #1436c8,  #2c7bff);
--wash-mayjune:  linear-gradient(90deg, #3fb84f47, #7ed48c47);   --edge-mayjune:  linear-gradient(90deg, #3fb84fb3, #7ed48cb3);
--wash-octnov:   linear-gradient(90deg, #1a8b9347, #46b0ae47);   --edge-octnov:   linear-gradient(90deg, #1a8b93b3, #46b0aeb3);
--wash-febmarch: linear-gradient(90deg, #8fcfe647, #b8e3f247);   --edge-febmarch: linear-gradient(90deg, #8fcfe6b3, #b8e3f2b3);
```

Edge gradients are 1px strokes; in CSS use `border: 1px solid transparent` +
`background: linear-gradient(...) border-box` with a `padding-box` inner fill, or the
`::before` ring pattern already used by `.nav.active::before` in `src/styles/app.css`.

---

## 6. Text styles — definitive census

**16 local text styles exist. All 16 are in active use. The "19" in the notes is stale.**
Every style: line height AUTO (`line-height: normal`), `fontVariationSettings: "wdth" 100` on the
SF Pro ones. `letterSpacing` is percent in Figma; the px column is the value at the style's own size.

| Style | Family | Style / weight | Size | LS % | LS px | Seen on |
|---|---|---|---|---|---|---|
| Display/Setup Title | SF Pro | Bold 700 | 26 | -2.2 | -0.572 | `9:3`, `11:3`, `12:4`, Onboarding |
| Title/Toolbar | SF Pro | Semibold 590 | 17 | -1.2 | -0.204 | Library, Dashboard, Settings, Update Dialog |
| Title/Card | SF Pro | Semibold 590 | 15 | -1.0 | -0.15 | Paper Card `66:359`, Library |
| Body/Nav | SF Pro | Medium 510 | 13 | -0.4 | -0.052 | Nav Item `25:24`, Library, Dashboard, Settings |
| Body/Default | SF Pro | Regular 400 | 13 | -0.4 | -0.052 | `9:x`, `12:x`, Library, Settings, Onboarding |
| Body/Strong | SF Pro | Semibold 590 | 13 | -0.4 | -0.052 | Button `22:47`, Dashboard, Update Dialog |
| Body/Small | SF Pro | Regular 400 | 12 | 0 | 0 | swatch rows, all doc blurbs, Settings |
| Body/Chip | SF Pro | Medium 510 | 12 | 0 | 0 | Chip `21:20`, Library, Settings |
| Body/Meta | SF Pro | Regular 400 | 11 | 0 | 0 | Paper Card, Library, Dashboard, Onboarding |
| Label/Section | SF Pro | Semibold 590 | 11 | +6 | 0.66 | every section header (UPPER) |
| Label/Difficulty | SF Pro | Semibold 590 | 11 | 0 | 0 | Difficulty Meter, Paper Card, Library |
| Label/Stat | SF Pro | Semibold 590 | 10 | +6 | 0.60 | Stat `24:5`, Dashboard (UPPER) |
| Mono/Stat | Geist Mono | SemiBold 600 | 19 | -2 | -0.38 | Stat `24:5`, Dashboard |
| Mono/Timer | Geist Mono | Regular 400 | 15 | 0 | 0 | Settings `530:873` only |
| Mono/Meta | Geist Mono | Regular 400 | 12 | 0 | 0 | Paper Card, Library |
| Mono/Small | Geist Mono | Regular 400 | 11 | 0 | 0 | swatch var labels, Session Code `15:8`, Chip code |

### 6.1 The three questioned styles — all three are GONE

| Style | Verdict | Evidence |
|---|---|---|
| Title/Wordmark | **Deleted.** | Wordmark set `383:57` and Lockups apply no text style at all — the wordmark is outlined vector bound to `bell/cap-lo` / `bell/cap-hi`. No node in the file references it. |
| Mono/Paper Code | **Deleted.** | Session Code set `15:8` uses **Mono/Small** for the code; Paper Card `66:359` uses Mono/Meta + Body/Meta. No node references it. |
| Ink/Annotation (Caveat) | **Deleted.** | Caveat does not appear as a font family on any node swept (both Foundations frames, Getting Started, Library, Dashboard, Settings, Onboarding, Startup, Update, Brand, Icon set). No node references it. |

Sweep method: `get_variable_defs` (which returns applied text styles) on `9:2`, `9:128`, `11:2`,
`12:2`, `40:1080`, `202:236`, `530:873`, `494:7520`, `391:3`, `437:7`, `383:57`, `374:77`, `363:5`,
`66:359`, `24:5`, `15:8`, `17:119`, plus `get_design_context` on `21:20`, `22:47`, `25:24`,
`42:111`, `532:7`. Union = exactly the 16 above.

---

## 7. TRAPS

**T1 — The Colour page's own arithmetic is wrong, and Rule 3 is factually false.**
The blurb claims "17 retone / 13 identical" and Rule 3 says difficulty "never retones between Day
and Night". Measured: `difficulty/1..5` have five *different* Night values (`#ffd24a #ffae33 #ff8a38
#ff6b47 #ff4d6a`) versus Day (`#8f6300 #9e5200 #a63d08 #a82a1a #a5103a`). Real tally is
**22 retone / 8 identical** (only paper x4 and iris x4 are mode-invariant). Build the difficulty
ramp as mode-aware. Do not "fix" the doc numbers in code — port the variables.

**T2 — 14 gradients, not 16. The other two are imported solid paint styles.**
The file has 16 *paint* styles total: the 14 gradients in §5 plus two foreign solids inherited from
the macOS 26 (Tahoe) kit the Segmented Control was measured against — `Style/#070707` (`#070707`)
and `Glyphs/Neutral - Idle` (`#1a1a1a`). Both surface on the Library screen `40:1080`. They are not
Bell tokens; do not port them, and do not let them leak into a token file.

**T3 — Gradient strokes only report stop 0 through the MCP.**
The Tailwind reference code flattens a gradient stroke to `border-[<stop0 colour>]`. Every
`.../Edge` style's second stop is therefore marked `INFERRED` (same hue as the matching Wash's
second stop, same alpha as the Edge's stop 0). The pattern is consistent across all six pairs, but
verify the six second stops by eye in Figma before locking them.

**T4 — "Blue/Primary Button 135" does not render at 135deg in CSS.**
On the 38px-tall Primary button the MCP emits
`linear-gradient(163.8238066383916deg, bell/cap-lo 0%, bell/cap-mid 70.711%)`. The `70.711%` is
1/sqrt(2): Figma's handle is the *box diagonal*, so both the angle and the last stop position are
projections of that specific box. Never copy those numbers. Ship `linear-gradient(135deg, lo, mid)`.

**T5 — Figma BACKGROUND_BLUR radius is 2x the CSS blur.**
`Glass/Chrome Blur 26` renders as `backdrop-filter: blur(13px)`. Also: Figma cannot express the
app's `saturate(165%)`, so every glass surface in the file reads flatter than production. Keep the
saturate in CSS.

**T6 — Code Syntax is only set on part of the collection.**
`ground/*, ink/*, glass/*, hair/*, card/*, accent/*, iris/*, difficulty/*, paper/*, ambient/*,
radius/*, window/*` emit `var(--x)`. `bell/cap-*`, `activity/0..4` and `white` emit **raw Figma
names** (`bell/cap-lo`, `activity/3`, `white`). The token vocabulary's `--bell-cap-*` and
`--activity-*` names are the app's, not Figma's — map them yourself.
`ground/veil` / `--ground-veil` does not exist in this file at all.

**T7 — The doc frames' own type is off-ramp.** The Contrast table (Geist Mono 11, SF Pro 11.5,
SF Pro Semibold 9.5 @ +5%), the elevation meta labels (SF Pro Semibold 12, Geist Mono 10) and the
radius captions (SF Pro Semibold 11, Geist Mono 10) use **no** text style. They are documentation
chrome; do not derive product type from them.

**T8 — Two radii are hard-coded, not tokenised.** The elevation surfaces use literal `13` (not
`--r-card`) and the Glass stage / glass panel use literal `16` (not `--r-panel`). The Colour page's
swatch chips use literal `7`, which is not in the radius scale at all.

**T9 — Effect order flips between Figma and CSS.** Figma lists Shadow/Card/Day as
`#1214320f (0,1) r2` then `#1214321a (0,4) r10 s-2`; CSS must emit the 4/10/-2 layer first. §4 is
already in CSS order.

**T10 — The Chip component description contradicts its own board/season variants.** It says
"Filled is the selected state on accent-soft with no border" — true only for `palette=Neutral`.
Every board and season Filled variant has both a Wash gradient fill **and** a 1px Edge gradient
border. Hover for those palettes drops the gradient and keeps `--glass-strong` + a solid border
equal to the Edge's stop 0.

**T11 — Board/O Level and Board/IGCSE washes read fully opaque.** Their stops are variable-bound so
the MCP prints `var(bell/cap-lo)` with no alpha, while the A Level and all three season washes carry
explicit .28/.40 alphas. Either the two blue washes are deliberately bolder, or a paint-level
opacity is being dropped by the extractor. Check those two in Figma before shipping — a fully
opaque `#1436c8 → #2c7bff` pill with `--ink` label text would fail contrast badly.

**T12 — Figma MCP rate limit.** Education plan: 200 tool calls/day, 10/min, shared across parallel
agents. Budget re-verification runs; `get_variable_defs` is the cheap way to enumerate applied
styles, `get_design_context` the only way to get paint stops.

**T13 — `search_design_system` is useless on this file.** It returns `[]` even for styles that
demonstrably exist (`Title/Card`), because the library is unpublished. Style existence can only be
established by sweeping node usage.







