# Components — Data display (measured spec)

Bell / "Foolscap — Design System" `GnDdYtn8SaQjgmA4SQRCn7`. Read-only extraction.
Every px below is measured off the node, or arithmetic on measured nodes where marked *derived*.
All text styles are `lineHeight: AUTO` → **`line-height: normal`**, so hug heights land within a
px of the browser's own normal. Treat every "height" in this file as a hug result, not a value to
pin.

| component | node | kind | variants | master box |
|---|---|---|---|---|
| Stat | `24:5` | **COMPONENT** (no set) | — | 120 x 63 |
| Paper Card | `66:359` | COMPONENT_SET | 4 (State x Bookmarked) | 280 x 128 |
| Difficulty Meter | `23:68` | COMPONENT_SET | 6 (Band) | 248 x 16 |
| Nav Item | `25:24` | COMPONENT_SET | 3 (State) | 220 x 34 |
| Update Notice | `440:115` | COMPONENT_SET | 3 (State) | 214 x 30 |
| Doc Badge | `14:14` | COMPONENT_SET | 4 (Type) | 23 x 17 |
| Session Code | `15:8` | COMPONENT_SET | 2 (Style) | 30 x 16 / 20 x 14 |
| Window Lights | `41:46` | COMPONENT_SET | 4 (Window x Hover) | 62 x 16 |

Letter-spacing, px equivalents of the % in the style sheet:
`Mono/Stat` 19 @ -2% = **-0.38px** · `Title/Card` 15 @ -1% = **-0.15px** ·
`Body/Nav` 13 @ -0.4% = **-0.052px** · `Label/Stat` 10 @ +6% = **0.6px** ·
Doc Badge 10 @ +3% = **0.3px** (ad-hoc, no named style).

---

## 1. Stat — `24:5`

A plain COMPONENT, not a set. Dashboard figure.

```
120 x 63   VERTICAL  gap 2  pad 12/14  items-start (hug x hug)
+------------------------------------------+  fill --card, 1px --card-brd, r --r-card (13), clip
|  [14,12]  value row 56x25 ....... gap 8  |  HORIZONTAL, counterAxisAlignItems = BASELINE
|           1,284          +6              |  value Mono/Stat --ink | delta Mono/Small --ink-2
|  [14,39]  FOCUS MINUTES   92x12          |  caption Label/Stat --ink-3 UPPER
+------------------------------------------+
```

**Frame** `24:5` — 120 x 63, layout VERTICAL, `itemSpacing 2`, padding `12` top/bottom `14`
left/right, `primaryAxisSizing HUG` / `counterAxisSizing HUG`, `counterAxisAlignItems MIN`,
`clipsContent true`. Fill `--card`. Stroke 1px inside `--card-brd`. Radius `--r-card` = 13.

| child | node | x,y | box | layout | type | token |
|---|---|---|---|---|---|---|
| value row | `495:8187` | 14,12 | 56 x 25 | HORIZONTAL, gap **8**, **align BASELINE**, hug/hug, clip | — | — |
| › value | `24:3` | 0,0 | 56 x 25 | — | `Mono/Stat` Geist Mono SemiBold 19 / -0.38px | `--ink` |
| › delta | `495:8188` | 64,8 | 14 x 14 | — | `Mono/Small` Geist Mono Regular 11 / 0 | `--ink-2` |
| caption | `24:4` | 14,39 | 92 x 12 | — | `Label/Stat` SF Pro Semibold 10 / +0.6px UPPER | `--ink-3` |

**Properties** — 4:

| name | id | type | default |
|---|---|---|---|
| Value | (text on `24:3`) | TEXT | `1,284` |
| Caption | (text on `24:4`) | TEXT | `Focus minutes` (rendered uppercase by the style) |
| **Delta** | `#495:0` | TEXT | `+6` |
| **Show Delta** | `#495:1` | BOOLEAN | **false** — `495:8188` is `visible: false` in the master |

**Why 63 never moves** (*derived*): `12 + 25 + 2 + 12 + 12 = 63`. The value row's 25 is set by the
19px `Mono/Stat` value alone. The delta is only **14** tall and is **baseline**-aligned (y = 8
inside the row), so turning Show Delta on cannot grow the row, and therefore cannot grow the tile.
Do not switch the row to `items-center` or `items-end` — baseline is what keeps the "+6" sitting on
the same writing line as the big numeral.

CSS: `.stat { display:flex; flex-direction:column; gap:2px; padding:12px 14px; }`
`.stat-row { display:flex; gap:8px; align-items:baseline; }`

The delta is **uncoloured on purpose** (`--ink-2`): the system ships no success/danger tokens, so
direction must be carried by the string — `+6`, `−6`, `↑6`. Never tint it green/red.

---

## 2. Paper Card — `66:359`

Set frame 672 x 340. Four variants, **all exactly 280 x 128**:

| variant | node | x,y in set |
|---|---|---|
| State=Default, Bookmarked=No | `66:262` | 28,28 |
| State=Default, Bookmarked=Yes | `66:294` | 336,28 |
| State=Hover, Bookmarked=No | `66:326` | 28,184 |
| State=Hover, Bookmarked=Yes | `66:358` | 336,184 |

```
280 x 128   VERTICAL  gap 10  pad 16  items-start   r --r-card (13)  fill --card  clip
+--------------------------------------------------------+
| identity            VERTICAL gap 4, w-FILL (248)       |
|   subject row       HORIZONTAL, center, SPACE_BETWEEN  |
|     [icon 18] gap 9 Accounting ..............  [bm 16] |
|   code              HORIZONTAL gap 2, center           |
|     9706 /12                                           |
|                     <- gap 10                          |
| meta                HORIZONTAL gap 6, center, w-FILL   |
|   May/June 2015  ·  mark scheme · report               |
|                     <- gap 10                          |
| foot                HORIZONTAL center, w-FILL, pt 12   |
|   ---- 1px --hair-2 border-TOP only ----               |
|   ▬▬▬ ▬▬  Typical                     (no score)       |
+--------------------------------------------------------+
```

**Shell**

| prop | Default | Hover |
|---|---|---|
| fill | `--card` | `--card` |
| stroke 1px inside | `--card-brd` | **`--hair`** |
| effect | `Shadow/Card/Day`: `0 4 10 -2 rgba(18,20,50,.10)` + `0 1 2 0 rgba(18,20,50,.06)` | `Shadow/Card Hover/Day`: `0 12 28 -14 rgba(18,20,50,.28)` |
| radius | `--r-card` 13 | `--r-card` 13 |

Layout VERTICAL, `itemSpacing 10`, padding `16` on all four sides, `counterAxisAlignItems MIN`,
width **FIXED 280**, height HUG (= 128), `clipsContent true`.

**Rows** — every row is `layoutSizingHorizontal: FILL` → 248 wide (280 − 2×16).

| node | name | layout | contents |
|---|---|---|---|
| `66:232` | identity | VERTICAL, gap **4**, items-start, FILL, clip | subject row + code |
| `66:233` | › subject row | HORIZONTAL, items **center**, **SPACE_BETWEEN**, FILL, clip | subject label + bookmark |
| `66:234` | ›› subject label | HORIZONTAL, gap **9**, items center, **FILL (flex-1, min-width 0)**, clip | icon + title |
| `66:235` | ››› subject icon | 18 x 18 | INSTANCE_SWAP → `Subject Icon` `47:81` |
| `66:241` | ››› subject title | FILL, min-width 0, 1 line + **ellipsis** | `Title/Card` SF Pro Semibold 15 / -0.15px, `--ink` |
| `66:242` | ›› bookmark | 16 x 16, hug | outline glyph when No; **solid `--accent`** when Yes (two exported assets) |
| `66:244` | › code | HORIZONTAL, gap **2**, items center, hug, clip | `Mono/Meta` Geist Mono Regular 12 / 0 |
| `66:245` | ›› paper code | hug | `9706` — `--ink-2` |
| `66:246` | ›› variant | hug | `/12` — `--ink-3` |
| `66:247` | meta | HORIZONTAL, gap **6**, items center, FILL, clip | `Body/Meta` SF Pro Regular 11 / 0, all `--ink-3` |
| `66:248` | › session | hug | `May/June 2015` |
| `66:249` | › separator | hug | `·` — **gated by Show Documents** |
| `66:250` | › documents | hug | `mark scheme · report` — gated by Show Documents |
| `66:251` | foot | HORIZONTAL, items center, FILL, **paddingTop 12**, **border-TOP 1px `--hair-2`** (top edge only), clip | the nested meter |
| `23:34` | › Difficulty Meter | instance of Band=Typical, width **FILL**, `Show Score = false` | see §3.1 |

**Properties** — 2 variant + 7 instance:

| name | type | default |
|---|---|---|
| State | VARIANT | `Default` \| `Hover` |
| Bookmarked | VARIANT | `No` \| `Yes` |
| Subject | TEXT | `Accounting` |
| Paper Code | TEXT | `9706` |
| Variant | TEXT | `/12` |
| Session | TEXT | `May/June 2015` |
| Documents | TEXT | `mark scheme · report` |
| Show Documents | BOOLEAN | true |
| Subject Icon | INSTANCE_SWAP | Accounting glyph |

The card is deliberately de-duplicated: subject name derives from the code, `Paper 1 · Variant 2`
from `/12`, `s15` from `May/June 2015`, and the numeral `58` from the meter — all four were cut.
`QP` is gone because every paper has one. `MS`/`ER` are plain words in the meta row now and vanish
entirely when there is nothing extra (Show Documents = false hides **both** `66:249` and `66:250`).

---

## 3. Difficulty Meter — `23:68`

Set frame 288 x 216. Six variants, all **248 x 16**, stacked at x = 20 on a 32px pitch:

| Band | node | y | lit pips | lit token | unlit pips | label token |
|---|---|---|---|---|---|---|
| Gentle | `23:12` | 20 | **1** | `--d1` | 4 × `--hair` | `--d1` |
| Steady | `23:23` | 52 | **2** | `--d2` | 3 × `--hair` | `--d2` |
| Typical | `23:34` | 84 | **3** | `--d3` | 2 × `--hair` | `--d3` |
| Tough | `23:45` | 116 | **4** | `--d4` | 1 × `--hair` | `--d4` |
| Brutal | `23:56` | 148 | **5** | `--d5` | 0 | `--d5` |
| **Unrated** | `23:67` | 180 | **0** | — | **5 × `--hair`** | **`--ink-3`** |

### The pip row — settled

```
248 x 16  root  HORIZONTAL  items-center  SPACE_BETWEEN  clip  no fill  (w FIXED, h HUG)
+------------------------------------------------------------------------+
| left  HORIZONTAL gap 10 items-center hug clip                      18  |
|   meter  HORIZONTAL gap 3 items-START hug clip  = 82 x 5              |
|   ▬▬ ▬▬ ▬▬ ░░ ░░   Typical                              score, hard R |
+------------------------------------------------------------------------+
   14  3 …                gap 10                          Mono/Meta 12
```

| fact | value |
|---|---|
| **pip count** | **exactly 5, in every band, always** — including Unrated |
| pip size | **14 w x 5 h** each |
| pip gap | **3** (`itemSpacing` on `meter`) |
| pip radius | **2** — a **raw px value, not a radius token** (the smallest token is `--r-chip` 9) |
| pip row width | 5×14 + 4×3 = **82** (*derived*) |
| pip row layout | HORIZONTAL, `counterAxisAlignItems MIN` (items-start), hug x hug, clip |
| **fill rule** | the first *N* pips take the band's single colour `--dN`; the remaining `5 − N` take `--hair` |
| **Unrated renders** | the same 5 pips, all `--hair`, plus the word `Unrated` in `--ink-3`. **Not** an empty row, **not** zero pips, **not** a dash |

**All lit pips in a band share one colour.** Tough is four `--d4` pips — it is *not* a
`d1 → d2 → d3 → d4` ramp. Verified per-node on every variant.

| part | node (per band) | spec |
|---|---|---|
| root | `23:12 / 23 / 34 / 45 / 56 / 67` | 248 FIXED x 16 HUG, HORIZONTAL, items-center, SPACE_BETWEEN, clip |
| left | `23:3 / 14 / 25 / 36 / 47 / 58` | HORIZONTAL, gap **10**, items-center, hug, clip |
| meter | `23:4 / 15 / 26 / 37 / 48 / 59` | HORIZONTAL, gap **3**, items-start, hug (82 x 5), clip |
| label | `23:10 / 21 / 32 / 43 / 54 / 65` | `Label/Difficulty` SF Pro Semibold 11 / 0, colour = band colour |
| score | `23:11` | `Mono/Meta` Geist Mono Regular 12 / 0, `--ink-3`, pushed hard right by SPACE_BETWEEN |

**Properties**: `Band` VARIANT (6) · `Score` TEXT default `18` · `Show Score` BOOLEAN default
**true**.

Mode behaviour: the meter uses the *same tokens* in Day and Night — it is never re-toned to a
different axis. The `--d1..--d5` tokens themselves do flip per mode
(Day `#8f6300 #9e5200 #a63d08 #a82a1a #a5103a` → Night `#ffd24a #ffae33 #ff8a38 #ff6b47 #ff4d6a`),
and `--hair` flips with them. Never substitute an iris/accent token here.

Band boundaries, from the component description (`34 / 50 / 67 / 84`, logic in
`src/lib/difficulty.ts`) — *inferred mapping*: `<34` Gentle · `34–49` Steady · `50–66` Typical ·
`67–83` Tough · `>=84` Brutal · no parsed grade thresholds → Unrated. Never guess a score.

### 3.1 The nested meter inside Paper Card — how it differs

Instance of **Band=Typical** (`23:34`) placed in `foot` `66:251`. The answer: **the pips are
identical; only the width mode and the score change.**

| | standalone `23:68` | inside Paper Card |
|---|---|---|
| width | **FIXED 248** | **FILL** → resolves to 248 (280 − 2×16) |
| height | 16 | ~13–14 (*derived* — hug shrinks once the 12px mono score is gone) |
| pip count / size / gap / radius | 5 · 14x5 · 3 · 2 | **identical, unchanged** |
| gap pips → label | 10 | 10 |
| label | `Label/Difficulty` 11, `--d3` | identical |
| `Show Score` | **true** (`18`, `--ink-3`) | **false** |
| justify | SPACE_BETWEEN | SPACE_BETWEEN, but with the score hidden there is nothing to push apart → content sits flush left |

So the 248 master width is **not arbitrary**: it is exactly the Paper Card's inner width, which is
why the instance can be FILL and still measure the same. Build one component; the card just sets
`Show Score = false` and `width: 100%`.

---

## 4. Nav Item — `25:24`

Set frame 280 x 186. Three variants, all **220 x 34**, at x = 36, y = 24 / 76 / 128 (52 pitch).

```
        220 x 34   HORIZONTAL  gap 11  pad 8/10  items-center   r --r-btn (10)   NO CLIP
   -12
    ▐|  [icon 18] gap 11  Library ................ flex-1   13,447  |
    ↑                                                              ↑
 active indicator 3x17, ABSOLUTE, OUTSIDE the box            count hard right
```

| node | name | spec |
|---|---|---|
| `25:8` | State=Default | fill **none** |
| `25:15` | State=Hover | fill **`--hair-2`** |
| `25:23` | State=Active | fill **`--accent-soft`** |

Root: HORIZONTAL, `itemSpacing 11`, padding `8` top/bottom `10` left/right,
`counterAxisAlignItems CENTER`, width **FIXED 220**, height HUG (= 34), radius `--r-btn` = **10**,
`clipsContent` **false** (it must not clip — see the indicator).

| child | node (D / H / A) | box | spec |
|---|---|---|---|
| icon | `25:3` / `25:10` / `25:17` | 18 x 18, hug | INSTANCE_SWAP → `Icon` set `17:119`. Glyph colour follows the label: `--ink-2` / `--ink` / `--accent` |
| label | `25:6` / `25:13` / `25:20` | **FILL, min-width 0** | `Body/Nav` SF Pro Medium 13 / -0.052px. Colour `--ink-2` / `--ink` / **`--accent`** |
| count | `25:7` / `25:14` / `25:21` | hug | SF Pro **Medium 11 / 0** — **ad-hoc, no named style**. Colour `--ink-3` / `--ink-3` / **`--accent`** |
| active indicator | `25:22` (Active only) | 3 x 17 | see below |

**Active indicator** `25:22` — the whole point of the component:

| prop | value |
|---|---|
| positioning | **ABSOLUTE** (`layoutPositioning: ABSOLUTE`), ignored by the auto-layout |
| x, y | **left `-12`**, top `9` |
| box | **3 w x 17 h** |
| radius | TL `0`, TR **3**, BR **3**, BL `0` — right corners only |
| fill | LINEAR gradient, **90° left→right**: `--bell-cap-hi` 0% → `--bell-cap-mid` 34% → `--bell-cap-lo` 67% → `--bell-cap-deep` 100% (`#58c8ff → #2c7bff → #1436c8 → #0e2596`, mode-invariant) |

It occupies x `-12 … -9`, i.e. a 3px sliver with a **9px air gap** before the row's left edge — so it
lives entirely in the sidebar's left gutter, outside the 220 box. Vertically 9…26 in a 34-tall row
(8px below → optically centred, half a px high). The accent is "spent as a line", which is why the
row itself only gets `--accent-soft` and never an iris fill.

CSS: `.nav.active::before { content:''; position:absolute; left:-12px; top:9px; width:3px;
height:17px; border-radius:0 3px 3px 0; background:linear-gradient(90deg, var(--bell-cap-hi) 0%,
var(--bell-cap-mid) 34%, var(--bell-cap-lo) 67%, var(--bell-cap-deep) 100%); }`
with `.nav { position:relative; overflow:visible; }` **and no `overflow:hidden` on the sidebar
column**, or the sliver disappears.

**Properties**: `State` VARIANT (Default | Hover | Active) · `Label` TEXT `Library` ·
`Count` TEXT `13,447` · `Show Count` BOOLEAN true · `Icon` INSTANCE_SWAP.

---

## 5. Update Notice — `440:115`

Three variants, all **214 x 30**. Compact glass pill, sized to sit in the sidebar above the dev
footer. 30 tall is deliberate — taller starves the sidebar mascot slot.

```
214 x 30  HORIZONTAL  items-center  SPACE_BETWEEN  pad 8/10  r --r-chip (9)  CLIP
fill --glass-strong · 1px --glass-brd · shadow 0 3 10 0 rgba(18,20,51,.14)

Available   | ● Update available                      ⟳ |   dot 6 + text 12 | icon 14
Downloading |▓▓▓▓▓▓▓▓▓▓▓▓▓ Downloading            62%  |   progress rect BEHIND everything
Ready       | ● Restart to update                    ↵ |
```

| variant | node |
|---|---|
| State=Available | `440:112` |
| State=Downloading | `440:113` |
| State=Ready | `440:114` |

Root: HORIZONTAL, padding `8` top/bottom `10` left/right, `counterAxisAlignItems CENTER`,
`SPACE_BETWEEN`, width **FIXED 214**, height HUG (= 30), radius `--r-chip` = **9**,
fill `--glass-strong`, stroke 1px `--glass-brd`, effect `0 3 10 0 rgba(18,20,51,.14)`,
**`clipsContent true`** (load-bearing — it is what rounds the progress bar).

| part | node (Available / Downloading / Ready) | spec |
|---|---|---|
| label group | `438:109` / `438:116` / `438:122` | HORIZONTAL, gap **6**, items-center, hug, clip |
| › dot | `438:110` / `438:117` / `438:123` | **6 x 6** exported glyph, `--accent` |
| › text | `438:111` / `438:118` / `438:124` | `Body/Chip` SF Pro Medium 12 / 0, `--ink`. `Update available` / `Downloading` / `Restart to update` |
| trailing icon | `438:112` / — / `438:125` | **14 x 14** exported SVG. Available = refresh arc, Ready = return arrow. **Absent in Downloading** |
| trailing pct | — / `438:119` / — | `Mono/Small` Geist Mono Regular 11 / 0, **`--ink-2`**, `62%`. **Only in Downloading** |
| progress | — / `438:120` / — | see below |

### The progress bar — the pill's own fill

`438:120` "progress", **Downloading only**:

| prop | value |
|---|---|
| positioning | **ABSOLUTE**, and it is the **first child in z-order** → paints *behind* the label group and the percentage |
| x, y | left **`-1`**, top **`-1`** |
| box | **133 x 30** |
| fill | **`--accent-soft`** (Day `#1436c81f`, Night `#6aa8ff29`) |
| radius | **0** — it has none of its own |
| how it gets rounded | the parent's `clipsContent: true` + `--r-chip` 9 clips it to the pill's own left cap |

There is **no separate bar, no track and no radius**. The rect simply overpaints the glass fill
from the left edge and is cropped by the pill outline, which is why the -1 offsets exist: they push
the rect out over the 1px stroke so the fill reaches the true left/top edge instead of stopping
inside the border.

**Percent → width**: `133 / 214 = 62.1%` and the label reads `62%`, so
**`width = round(pct / 100 × 214)`** measured across the full outer pill width.

CSS:
```css
.notice { position:relative; overflow:hidden; border-radius:var(--r-chip); }
.notice__bar {                       /* behind everything: first child, or z-index:0 */
  position:absolute; inset:0 auto 0 0;
  width:calc(var(--pct) * 1%);       /* 62 → 62% of 214 = 132.7px */
  background:var(--accent-soft);
}
.notice > :not(.notice__bar) { position:relative; }
```

Use `inset:0 auto 0 0` (full height), **not** the literal Figma numbers — see TRAPS #8.

---

## 6. Doc Badge — `14:14`

Set frame 160 x 49. Four variants, **all exactly 23 x 17**, at y = 16, x = 16 / 51 / 86 / 121
(35 pitch). All four are two glyphs of a monospace face, so the hug width is constant.

| Type | node | text |
|---|---|---|
| QP | `14:4` | `QP` question paper |
| MS | `14:7` | `MS` mark scheme |
| ER | `14:10` | `ER` examiner report |
| GT | `14:13` | `GT` grade thresholds |

| prop | value |
|---|---|
| layout | HORIZONTAL, items-center, hug x hug (23 x 17), clip |
| padding | **5** left/right, **2** top/bottom |
| fill | **none** |
| stroke | 1px inside **`--hair`** |
| radius | **5** — raw px, **no token** |
| text | `14:3 / 6 / 9 / 12` — Geist Mono **Medium 10**, tracking **+0.3px**, **`--ink-3`**. No named text style |

Mono because it is machine data. `.doc` in `src/styles/app.css`.

**Currently unused by Paper Card `66:359`** — that card dropped `QP` (every paper has one, so it
carried no information) and turned `MS`/`ER` into plain words in the meta row. Keep Doc Badge for a
paper-detail or reader surface; do not reintroduce it into the library grid.

---

## 7. Session Code — `15:8`

Set frame 98 x 48. Two variants. A CAIE session code: `s` = May/June, `w` = Oct/Nov,
`m` = Feb/March, plus a two-digit year.

| Style | node | box | spec |
|---|---|---|---|
| **Boxed** | `15:4` | **30 x 16** | HORIZONTAL, items-center, hug, clip. Padding **5** l/r, **1** t/b. Fill none. Stroke 1px `--hair`. Radius **5** (raw px, no token) |
| **Bare** | `15:7` | **20 x 14** | HORIZONTAL, items-center, hug, clip. **No padding, no stroke, no fill, no radius** — the text alone |

Text `15:3`, identical in both: `Mono/Small` Geist Mono Regular **11** / 0, **`--ink-3`**.
Property `Code` TEXT default `s24`.

*Derived*: Bare 20 x 14 is the raw text box; Boxed = 20 + 2x5 = 30 wide, 14 + 2x1 = 16 tall.

Placement: **Boxed** on a card meta row (`.card-meta .sc`), **Bare** in the sidebar subject list
(`.subj-row .code`). Always mono, always `--ink-3` — it never takes accent or a difficulty colour.

---

## 8. Window Lights — `41:46`

Four variants (2 booleans), all **62 x 16**. macOS traffic lights at Apple's **Standard** metric,
measured off the macOS 26 kit in this file.

```
62 x 16   HORIZONTAL  gap 9  pad 1 (all sides)  items-center  hug  clip  no fill
  |- 1 -|
  ( * )  9  ( * )  9  ( * )      each disc 14 x 14, radius 7, glyph 7 x 7 centred
```

| variant | node | discs | glyphs |
|---|---|---|---|
| Window=Yes, Hover=No | `41:12` | live colours | none |
| Window=Yes, Hover=Yes | `41:23` | live colours | **all three, 7 x 7** |
| Window=No, Hover=No | `41:34` | all `--traffic-inactive` | none |
| Window=No, Hover=Yes | `41:45` | all `--traffic-inactive` | **none** |

| disc | node (focused) | token | hex (mode-invariant) |
|---|---|---|---|
| Close | `41:3` | `--traffic-close` | `#ff736a` |
| Minimize | `41:6` | `--traffic-minimize` | `#febc2e` |
| Zoom | `41:9` | `--traffic-zoom` | `#19c332` |
| any, unfocused | `41:25 / 28 / 31`, `41:36 / 39 / 42` | **`--traffic-inactive`** | `rgba(0,0,0,0.15)` |

Each disc: HORIZONTAL, items-center, **justify-center**, 14 x 14 fixed, radius **7** (a true circle),
clip. Glyph children `41:15` (close x), `41:18` (minimize −), `41:21` (zoom arrows) are **7 x 7**
exported SVGs, present **only when Window=Yes AND Hover=Yes**.

*Derived* box: 3x14 + 2x9 = 60, +2x1 padding = **62**; 14 + 2x1 = **16**.

Colours **do not retone in Night** — macOS keeps them constant.

**Drift against the app**: `.lights` in `src/styles/app.css` currently ships **11px discs at 7px
gaps** with the older Big Sur hexes — that is Apple's *Utility* (small-window) metric. Adopting this
spec grows each disc by 3px and the whole cluster from 47 to 62 wide; budget for the titlebar
reflow before changing it.

---

## TRAPS

1. **Difficulty Meter always renders 5 pips** — Gentle included, and **Unrated included**. Unrated is
   five `--hair` pips plus the word `Unrated` in `--ink-3`; it is not an empty row, not zero pips
   and not a dash.
2. **Lit pips are monochrome per band.** Tough = four `--d4` pips. There is no `d1 → d4` ramp across
   the row. Getting this wrong is the single most likely visual bug.
3. **Pip radius is `2` raw px**, and Doc Badge / Session Code Boxed use **`5` raw px**. All three sit
   below the smallest radius token (`--r-chip` 9). Do **not** substitute a token.
4. **The meter's `Score` is a plain TEXT prop** and reads `18` on all six variants — it does not
   track the band, and Unrated will happily display a score. Gate it: `Show Score = false` whenever
   there are no parsed thresholds.
5. **Paper Card's nested meter is the same component**, differing only by `Show Score = false` and
   `width: FILL`. Its 248 master width equals the card's inner width (280 − 2x16), so it measures
   identically either way. Do not build a second "small" meter.
6. **Nav Item's active indicator sits at `left: -12`, outside the 220 box.** The row has
   `clipsContent: false` for exactly this reason. Any `overflow: hidden` on the row *or* on the
   sidebar column erases it. Its radius is right-corners-only (`0 3px 3px 0`).
7. **Nav Item's count is SF Pro Medium 11 with zero tracking — an ad-hoc size.** It is not
   `Body/Meta` (Regular 11) and not `Label/Difficulty` (Semibold 11). Doc Badge's
   `Geist Mono Medium 10 / +0.3px` is likewise unnamed.
8. **Update Notice's progress rect has an off-by-one in the source**: `top: -1` with `height: 30`
   inside a 30-tall frame means it renders y `0…29` after clipping and leaves a 1px unfilled sliver
   at the **bottom**. Ship it full-bleed (`inset: 0 auto 0 0`) — the -1 was meant to cover the
   stroke, not to shift the band up.
9. **Downloading is not a recolour of Available.** It swaps the 14 x 14 trailing icon for an 11px
   mono percentage (a different node) and adds the absolute progress rect as the **first** child so
   it paints behind the label.
10. **The progress fill is `--accent-soft`** — the very same token as Nav Item Active's background.
    There is no dedicated progress/track token in this system; do not invent one.
11. **Stat's height cannot move.** `12 + 25 + 2 + 12 + 12 = 63`. Show Delta adds a 14-tall node into
    a 25-tall row at `align: BASELINE`, so the tile stays 63. Switching that row to `center`/`end`
    breaks both the alignment and the promise.
12. **Stat's delta must stay `--ink-2`.** No success/danger tokens exist; direction is carried by the
    string (`+6`, `−6`, `↑6`).
13. **Stat's 120 width and the caption's 92 are hug artefacts** of the default `Focus minutes`
    string. Stat is hug/hug — do not hard-code either.
14. **`--traffic-inactive` (`rgba(0,0,0,0.15)`) is a fourth traffic-light token** missing from the
    handed-down vocabulary. Add `window/inactive → --traffic-inactive`.
15. **Window Lights glyphs need focus AND hover.** `Window=No, Hover=Yes` shows grey discs with no
    glyphs — hovering an unfocused window must not reveal them.
16. **Only the Day card shadows came back from `66:359`** (`Shadow/Card/Day`,
    `Shadow/Card Hover/Day`). Locate the `Night` pair in `11:2 Foundations — Elevation & Glass`
    before shipping dark mode; do not reuse the Day values.
17. **Paper Card's `foot` border is top-edge only** (1px `--hair-2`), not a full box stroke, and it
    sits *above* the 12px `paddingTop`. In Figma the stroke does not occupy layout height; in CSS
    `border-top` does, so use `border-top` + `padding-top: 12px` and accept the 1px, or
    `box-shadow: inset 0 1px 0 var(--hair-2)` with `padding-top: 13px`.
18. **Every line height is AUTO.** Use `line-height: normal` and let 128 / 63 / 34 / 30 / 16 fall out
    as hug results. Pinning them will crop descenders on a machine with different font metrics.
