# Screens — Library & Settings (measured spec)

Source file `GnDdYtn8SaQjgmA4SQRCn7` ("Foolscap — Design System"). Four compositions, all **1320 x 860**.

| composition | node | kind | page |
|---|---|---|---|
| Library — Day | `40:1080` | **COMPONENT** (x 0, y 0) | `44:2` |
| Library — Night | `46:417` | FRAME (x 1400, y 0) | `44:2` |
| Settings — Night | `530:3` | FRAME | `530:2` |
| Settings — Day | `530:873` | FRAME | `530:2` |

Every value below is measured off `get_design_context`/`get_metadata`. Token names are the app's CSS
variables (Figma Code Syntax already emits them). Any raw hex written here is genuinely **unbound** in
Figma — see §7. All line heights AUTO → `line-height: normal`.

## 1. Window shell

```
frame  1320 x 860 · layoutMode NONE · clipsContent true · radius --r-win (15) · fill --ground
```

| | Day | Night |
|---|---|---|
| fill | `--ground` `#e7e9f2` | `--ground` `#111219` |
| shadow | `0 6 16 -10 rgba(18,20,50,.24)`, `0 24 60 -28 rgba(18,20,50,.42)` (`Shadow/Window/Day`) | `0 8 20 -12 rgba(0,0,0,.5)`, `0 30 70 -30 rgba(0,0,0,.7)` (`Shadow/Window/Night`) |

Geometry, structure, type and layout are **identical across all four**. Only the background stack
(§2), the tone pill (§4) and the resolved token values differ. Night frames pin the Color collection
to mode Night via `explicitVariableModes`.

## 2. Background stack (paint order, absolute inside the 1320x860 frame)

| z | Library D / Library N / Set N / Set D | name | x,y | w x h | paint |
|---|---|---|---|---|---|
| 0 | `44:4` / `46:418` / `530:4` / `530:874` | ambient-a | -686.4, -438.6 | 1584 x 946 | `--ambient-a` (radial `#6AA8FF`), LAYER_BLUR 160 |
| 1 | `44:5` / `46:419` / `530:5` / `530:875` | ambient-b | 594, 387 | 1452 x 946 | `--ambient-b` (radial `#58C8FF`) |
| 2 | `56:3686` / `56:3744` / `530:6` / `530:876` | clouds | 0,0 | 1320 x 860 | frame, clip. **Night only: node opacity 0.68** |
| 2a | — / `80:4823` / (same) / — | pattern 1 | -90,-135 | 1631.426 x 1145.153 | **Night only**: rotate 175.14°, `mix-blend-mode: hard-light`, child PNG 1550.788 x 1017.396 @ opacity 0.76, `object-fit: cover` |
| 2b | `56:3687` / `56:3745` / `530:8` / `530:877` | sky | 0,0 | 1320 x 520 | Day `linear-gradient(to bottom, rgba(140,148,199,.16), rgba(140,148,199,0))` · Night `rgba(77,84,140,.34) → rgba(77,84,140,0)` |
| 2c-2g | 5 base/highlight pairs | lobes | -170,-40 / -219.8,-73 · -240,300 / -264.6,258 · 760,210 / 736,163 · -120,590 / -167.4,550 · 330,120 / 311.4,90 | 1660x330 · 820x420 · 800x470 · 1580x400 · 620x300 | ellipse lobe clusters, base 27 % / highlight 52 % paint opacity (baked into the exported SVG) |
| 3 | `80:4822` / — / — / `530:934` | blue_orb 1 | -47, -24 | 1636 x 924 | **Day only**: raster PNG, `mix-blend-mode: darken`, node opacity **0.46**, `object-fit: cover` |
| 4 | — / `156:806` / `530:65` / — | veil | 0,0 | 1320 x 860 | **Night only**: `--ground-veil`, paint opacity 18 % |
| 5 | — / `156:807` / `530:66` / — | page recess | 238, 56 | 1082 x 804 | **Night only**: `--ground-veil`, paint opacity 24 % |

Day replaces the Night veil + page-recess pair with the single `blue_orb 1` darken layer. Do not ship
both.

## 3. Sidebar — 238 wide (identical on all four screens)

`sidebar` = Library `44:6` D / `46:420` N · Settings `530:67` N / `530:935` D

```
238 x 860 · VERTICAL · gap 4 · padding 14 / 12 / 14 / 12 · FIXED x FIXED · MIN / MIN · clip
fill --glass · border-right 1px --hair (INSIDE) · backdrop-filter: blur(13px)
```

Inner content width = 238 − 24 = **214**.

```
 0        12                                   226   238
 +---------+------------------------------------+-----+  0
 |         | window lights   62x16   @12,14     |     |
 |         | brand           111.6 x 50.8       |     |  34
 |         | nav-label Study 214x30             |     |  88.8
 |         | Nav Item x4     214x34 (pitch 38)  |     |  122.8
 |         | nav-label Subj  214x30             |     |  274.8
 |         | subj            214x311            |     |  308.8
 |         | mascot          214x191.2  (FLEX)  |     |  623.8
 |         | dev             214x27             |     |  819
 +---------+------------------------------------+-----+  860
```

| y | child | node (Lib Day) | size | layout |
|---|---|---|---|---|
| 14 | `window lights` INSTANCE | `44:7` | 62 x 16 | HORIZONTAL · gap 9 · padding 1 · HUG/HUG. Three 14px discs, `border-radius: 7px`, `--traffic-close` `#ff736a` / `--traffic-minimize` `#febc2e` / `--traffic-zoom` `#19c332`. Variant `Window=Active, Hover=No` → glyphs hidden. |
| 34 | `brand` | `44:14` | 111.6 x 50.8 | HORIZONTAL · gap 0 · padding **t6 r0 b14 l8** · HUG/HUG · clip |
| 40 | ↳ `logo` INSTANCE (`Bell / Lockup — Horizontal` `382:58`) | `390:4344` | 103.6 x 30.8 | **scale 0.35** of the 296x88 master. Mark occupies the left 33.78 %; wordmark "Bell" = SF Pro **Expanded Bold 33.6px** (96 x 0.35), tracking -0.672px, fill `--ink`. Both halves carry `drop-shadow(0 .7px .7px rgba(0,0,0,.25))`. Mark parts bind `--bell-cap-lo` (claws/legs/bridge), `--bell-cap-mid` (stalks/shell), `--bell-cap-hi` (lenses), `--page-ink` (pupils). |
| 88.8 | `nav-label Study` | `44:22` | 214 x 30 | HORIZONTAL · padding **t12 r0 b5 l10** · clip · text `Label/Section` fill **`--ink-3`** (not `--ink-2`), "STUDY" |
| 122.8 / 160.8 / 198.8 / 236.8 | `Nav Item` INSTANCE x4 | `44:23` `44:34` `44:46` `44:53` | 214 x 34 | HORIZONTAL · gap 11 · padding 8 / 10 · radius `--r-btn` (10) · FIXED width. Children: 18px icon, label `Body/Nav` FILL, count `Body/Nav` 11px HUG |
| 274.8 | `nav-label Subjects` | `44:70` | 214 x 30 | as Study |
| 308.8 | `subj` | `44:71` | 214 x 311 | VERTICAL · **gap 1** · padding-top 2 · clip. 10 rows, 30 tall, 31 pitch |
| 623.8 | `mascot` | `44:116` | 214 x 191.2 | **FILL / FILL, layoutGrow 1** — the vertical flex spacer. `min-height: 0`, clip |
| 819 | `dev` | `429:1043` D / `428:1042` N | 214 x 27 | VERTICAL · gap 3 · clip |

**mascot y is derived, not authored** — the flex spacer absorbs `860 − 14 − 14 − (7 gaps x 4) − 620 − 27`.
Move anything above it and the slot resizes; `dev` stays bottom-pinned.

### 3.1 Nav Item states

| # | label | count | node D / N (Library) | state | paint |
|---|---|---|---|---|---|
| 1 | Library | **13,447** | `44:23` / `46:431` | **Active** | bg `--accent-soft`; label AND count both `--accent`; `active indicator` `I…;25:22` 3 x 17 at x **-12**, y 9, `border-radius: 0 3px 3px 0`, `linear-gradient(90deg, --bell-cap-hi 0%, --bell-cap-mid 34%, --bell-cap-lo 67%, --bell-cap-deep 100%)` |
| 2 | Dashboard | — | `44:34` / `46:432` | Default | no bg; label `--ink-2`; `Show Count = false` |
| 3 | Bookmarks | — | `44:46` / `46:433` | Default | as above |
| 4 | Recent | — | `44:53` / `46:434` | Default | as above |

On **Settings** (`530:73-76` N / `530:941-944` D) **no** Nav Item is Active — all four are Default, the
`active indicator` is absent, and `Library` keeps its `13,447` count (`--ink-3`). The label fills there
are inconsistent: Library `--ink-2`, Dashboard `--ink-2`, Bookmarks `--ink-3`, Recent `--ink-3` (see TRAPS).

### 3.2 subj rows — ten, in this order

`subj-row <code>` · 214 x 30 · HORIZONTAL · gap 10 · padding **7 / 10** · radius `--r-btn` (10) · clip ·
children: `subject icon` INSTANCE **16 x 16**, label FILL `Body/Default` `--ink-2`, code HUG `Mono/Small`
11px `--ink-3`.

| y | code | subject | Subject Icon variant | node D / N |
|---|---|---|---|---|
| 2 | 9706 | Accounting | `accounting` | `44:72` / `46:439` — **bg `--accent-soft`** (the only lit row) |
| 33 | 9700 | Biology | `biology` | `44:76` / `46:443` |
| 64 | 9609 | Business | `business` | `44:80` / `46:447` |
| 95 | 9701 | Chemistry | `chemistry` | `44:84` / `46:451` |
| 126 | 9618 | Computer Science | `computing` | `44:88` / `46:455` |
| 157 | 9708 | Economics | `economics` | `44:92` / `46:459` |
| 188 | 9231 | Further Mathematics | `further-maths` | `44:96` / `46:463` |
| 219 | 9709 | Mathematics | `maths` | `44:100` / `46:467` |
| 250 | 9702 | Physics | `physics` | `44:104` / `46:471` |
| 281 | 9990 | Psychology | `psychology` | `44:108` / `46:475` |

Label frames are a fixed 131 wide in the master, so long names ("Further Mathematics") clip rather than
ellipsise — give the label `flex: 1 0 0; min-width: 0; overflow: hidden; text-overflow: ellipsis` in CSS.

### 3.3 mascot + dev footer

`Mr. Bell` INSTANCE (`374:77`, master 256x256) at **160 x 160** = scale 0.625, pinned inside `mascot`
CENTER / MAX: `left: calc(50% - 1px); transform: translateX(-50%); bottom: 16.2px` → absolute (38, 639).

| | Day (`375:828`) | Night (`375:925`) |
|---|---|---|
| shadow | `drop-shadow(0 6px 10px rgba(18,20,50,.14))` | `box-shadow: 0 6px 14px rgba(5,6,12,.38), 0 0 28px rgba(44,123,255,.2)` |

`dev` 214 x 27 · VERTICAL · gap 3:

| child | node D / N | size | spec |
|---|---|---|---|
| version TEXT | `429:1044` / `428:1043` | 93 x 12 | `v0.4.2  ·  build 1284` — SF Pro Regular **10**, `--ink-3`, `white-space: pre` (**two spaces each side of the middot**) |
| `credit` | `429:1045` / `428:1044` | 146 x 12 | HORIZONTAL · gap 4 · CENTER · clip |
| ↳ "Built with ♥ by" | `429:1046` / `428:1045` | 71 x 12 | SF Pro Regular **10**, `--ink-3`; the `♥` glyph is a **text range fill bound to `--d5`** → renders `#a5103a` Day / `#ff4d6a` Night |
| ↳ `Brand Mark / GitHub` | `429:1047` / `428:1046` | **11 x 11** | INSTANCE of `427:4` (24x24 master) at 0.458 scale, y 0.5 — **leaks, see §7** |
| ↳ "zohaiblazuli" | `429:1048` / `428:1048` | 56 x 12 | SF Pro Regular **10**, `--ink-2` |

## 4. Topbar — 1082 x 56 at (238, 0)

`topbar` = Library `45:39` D / `46:488` N · Settings `530:128` N / `530:996` D

```
1082 x 56 · HORIZONTAL · gap 12 · padding 0 / 16 · FIXED x FIXED · MIN / CENTER · clip
fill --glass · border-bottom 1px --hair (INSIDE) · backdrop-filter: blur(13px)
```

| x | child | node (Lib Day) | w x h | spec |
|---|---|---|---|---|
| 16 | title TEXT | `45:40` | 58 x 20 | `Title/Toolbar` (SF Pro Semibold 17, tracking **-0.204px**), `--ink`. "Library" · "Settings" |
| 86 | `search` | `45:41` | **420 x 34** FIXED/FIXED | radius `--r-pill` · fill `--glass-strong` · 1px `--hair` · padding **l12 r10** · gap 9 · clip. Children: `icon` 16 (`Icon=search`); placeholder TEXT **FILL** `Body/Default` `--ink-3` "Search papers, subjects, sessions"; `Kbd` INSTANCE **52 x 18**, radius **6** (literal, not tokenised), `--glass-strong` + 1px `--hair`, padding 2/6, `Mono/Small` `--ink-3` `Ctrl K` |
| 518 | `spacer` | `45:48` | 374 x **1** | **FILL / FIXED, layoutGrow 1** — a 1px-tall invisible flex strut, not a margin |
| 904 | `tone Day` / `tone Night` | `45:53` / `46:499` | **116** (Day) · **125** (Night) x 34, HUG/FIXED | radius `--r-pill` · `--glass-strong` + 1px `--hair` · padding **l12 r6** · gap 8 · clip. Children: `tone icon` 16 (`Icon=sun` Day / `Icon=moon` Night); label SF Pro Regular **12** `--ink-2` ("Day" / "Night"); `sw` 44 x 24 |
| 1032 | `Icon Button` | `45:57` | 34 x 34 | radius `--r-btn` (10), **fills [] and no stroke** at rest; 18px icon (`Icon=sliders`) |

Sum check (Day): `16 + 58 + 12 + 420 + 12 + 374 + 12 + 116 + 12 + 34 + 16 = 1082` ✓

### 4.1 The tone switch `sw` (44 x 24, radius 12 literal)

| | Day (`45:55`) | Night (`46:501`) |
|---|---|---|
| track | fill `--hair` (`#181A34` @ 11 %) + 1px `--hair` inset stroke | `linear-gradient(90deg, --bell-cap-lo #1436C8, --bell-cap-mid #2C7BFF)` (= `Blue/Primary Button 135`), no stroke |
| knob | white ⌀18 at **cx 11** → **OFF** | white ⌀18 at **cx 33** → **ON** |
| knob cast | `0 1px 3px rgba(0,0,0,.30)` | same |

Switch ON means Night. The standalone `Switch` component (`532:7`) used all over Settings is the same
44 x 24 geometry and treatment.

## 5. Library content region `lib` — 1020 x 592 at (269, 82)

`lib` = `45:65` D / `46:504` N. `VERTICAL · **gap 0** · padding 0 · FIXED x HUG · MIN/MIN · fills [] · clipsContent false`.
Inset inside the page recess (238,56 → 1320,860): left 31 · top 26 · right 31 · bottom **186**.

**All vertical rhythm lives on each child's own padding, not on a parent gap.**

| # | child | node D / N | h | own padding | inner gap |
|---|---|---|---|---|---|
| 0 | `filters` | `45:66` / `46:505` | 58 | `pb 26` | 8 |
| 1 | `sec-label 2015` | `45:110` / `46:515` | 34 | `pt 6 · pb 14` | 10 |
| 2 | `grid 2015` | `45:114` / `46:519` | 304 | `pb 34` | 14 |
| 3 | `sec-label 2014` | `45:410` / `46:528` | 34 | `pt 6 · pb 14` | 10 |
| 4 | `grid 2014` | `45:414` / `46:532` | 162 | `pb 34` | 0 (single row) |

`58 + 34 + 304 + 34 + 162 = 592` ✓

### 5.1 `filters` — the chip row

`1020 x 58 · HORIZONTAL · gap 8 · padding-bottom 26 · FILL/HUG · MIN/CENTER · clip · fills []`
All chips: `h 32` FIXED · `radius --r-pill (999)` · `padding 0 12` · `gap 7` · HUG width · CENTER.

| # | node D / N | w | label | icon | extras | paint |
|---|---|---|---|---|---|---|
| 1 | `45:67` / `46:506` | 76 | All levels | — | — | **Filled/Neutral**: `--accent-soft`, **no border**, label `--ink` |
| 2 | `45:73` / `46:507` | 66 | A Level | — | — | **Board/A Level**: `linear-gradient(to right, rgba(79,195,247,.4), rgba(106,168,255,.4))` + 1px `rgba(79,195,247,.9)`, label `--ink` |
| 3 | `45:79` / `46:508` | 61 | IGCSE | — | — | Default/Neutral: `--glass-strong` + 1px `--hair`, label `--ink-2` |
| 4 | `45:84` / `46:509` | 67 | O Level | — | — | as #3 |
| — | `45:89` / `46:510` | **8 x 1** | `gap` strut | | | invisible spacer; with the row's own `gap 8` it produces a **24px break** between the level group and the season group |
| 5 | `45:90` / `46:511` | 104 | May/June | Season Icon 18 (`may-june`) | — | **Season/May-June**: `linear-gradient(to right, rgba(63,184,79,.28), rgba(126,212,140,.28))` + 1px `rgba(63,184,79,.7)`, label `--ink` |
| 6 | `45:95` / `46:512` | 97 | Oct/Nov | Season Icon 18 (`oct-nov`) | — | Default/Neutral |
| 7 | `45:100` / `46:513` | 111 | Feb/March | Season Icon 18 (`feb-march`) | — | Default/Neutral |
| 8 | `45:105` / `46:514` | 170 | Accounting | Subject Icon 18 (`accounting`) | `code` `9706` + `close` 14 | **Filled/Neutral**: `--accent-soft`, label `--ink` |

Chip label = `Body/Chip` (SF Pro Medium 12, tracking 0). The four palette gradients are paint **styles**
(`Board/A Level/Wash|Edge`, `Season/May-June/Wash|Edge`) with no variable behind them — they are
mode-invariant by design, not a leak.

### 5.2 `sec-label <year>` + trailing rule

`1020 x 34 · HORIZONTAL · gap 10 · padding-top 6 · padding-bottom 14 · **FILL**/HUG · MIN/CENTER · clip · fills []`

| child | Lib Day | Lib Night | spec |
|---|---|---|---|
| year TEXT | `45:111` / `45:411` | `46:516` / `46:529` | `Label/Section` (SF Pro Semibold 11, tracking **+0.66px**, UPPER), `--ink-2`. "2015" (29 wide) / "2014" (30) |
| count TEXT | `45:112` / `45:412` | `46:517` / `46:530` | `Mono/Small` (Geist Mono Regular 11), `--ink-3`. "6 papers" / "3 papers" (53 wide) |
| `rule` | `45:113` / `45:413` | `46:518` / `46:531` | **FILL / FIXED, layoutGrow 1**, h **1**, radius 0. Renders **918** wide (2015) / **917** (2014) |

Unlike the Dashboard's sec-labels (which HUG and therefore freeze their rules), these are **FILL**, so
the rule genuinely runs to the content's right edge — `flex: 1 0 0; min-width: 0; height: 1px`.
Rule paint is wrong in both modes — see §7.

### 5.3 `grid <year>` and the 330.67 stretch

```
grid   1020 x n · VERTICAL · gap 14 · padding-bottom 34 · FILL/HUG · fills []
 row   1020 x 128 · HORIZONTAL · gap 14 · FILL/HUG · MIN/MIN
  Paper Card x3 · layoutGrow 1 (flex: 1 0 0; min-width: 0)
```

The `Paper Card` master (`66:359`) is **280 x 128** with `layoutSizingHorizontal = FIXED`. Every instance
in the grid is set to **FILL**, so each column resolves to

```
(1020 − 2 x 14) / 3 = 992 / 3 = 330.6666…    → +50.67 px (+18.1 %) over the 280 master
```

Rendered x offsets: **0 · 344.667 · 689.333**. Height stays 128 (the card HUGs vertically and its content
does not grow). In CSS use `grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px` — do **not**
hard-code 280 or 330.67.

### 5.4 `Paper Card` internals (one card, then the roster)

```
Paper Card  330.667 x 128 · VERTICAL · gap 10 · padding 16 all round · radius --r-card (13) · clip
  fill --card · border 1px --card-brd
  shadow Day  0 4 10 -2 rgba(18,20,50,.10) , 0 1 2 0 rgba(18,20,50,.06)   (Shadow/Card/Day)
  shadow Night 0 4 12 -2 rgba(0,0,0,.45)  , 0 1 2 0 rgba(0,0,0,.35)       (Shadow/Card/Night)

  identity        VERTICAL gap 4, FILL
    subject row   HORIZONTAL SPACE_BETWEEN, FILL
      subject label  HORIZONTAL gap 9, FILL  →  Subject Icon 18 · title
      bookmark       16 x 16
    code          HORIZONTAL gap 2  →  paper code · variant
  meta            HORIZONTAL gap 6, FILL     →  session · "·" · documents
  foot            HORIZONTAL, border-top 1px --hair-2, padding-top 12, FILL
    Difficulty Meter  FILL, SPACE_BETWEEN  →  left(meter · band label) · score
```

| element | type | fill |
|---|---|---|
| title | `Title/Card` (SF Pro Semibold 15, tracking -0.15px), ellipsised | `--ink` |
| paper code | `Mono/Meta` (Geist Mono Regular 12) | `--ink-2` |
| variant | `Mono/Meta` | `--ink-3` |
| meta (3 texts) | `Body/Meta` (SF Pro Regular 11) | `--ink-3` |
| band label | `Label/Difficulty` (SF Pro Semibold 11, tracking 0) | matching `--d1…--d5` |
| meter bars | five **14 x 5**, radius **2** literal, gap **3** | lit `--d<n>`, unlit `--hair` |
| bookmark ON | filled glyph | `--iris-3` `#1436C8` (mode-invariant) |
| bookmark OFF | outline glyph | `--ink-3` |

All nine cards are `State=Default`; `Show Documents = true`; **`Show Score = false` on every one** (no
Geist Mono number on the right of the meter). Subject is "Accounting" / code "9706" throughout.

| slot | node Day | node Night | variant | session | documents | band | lit / token | bookmarked |
|---|---|---|---|---|---|---|---|---|
| 2015 r1c1 | `67:851` | `67:1223` | /12 | May/June 2015 | mark scheme · report | Typical | 3 / `--d3` | **Yes** |
| 2015 r1c2 | `67:897` | `67:1254` | /22 | May/June 2015 | mark scheme · report | Tough | 4 / `--d4` | No |
| 2015 r1c3 | `67:952` | `67:1294` | /32 | May/June 2015 | mark scheme | Steady | 2 / `--d2` | No |
| 2015 r2c1 | `67:992` | `67:1334` | /11 | Oct/Nov 2015 | mark scheme · report | Gentle | 1 / `--d1` | No |
| 2015 r2c2 | `67:1032` | `67:1374` | /21 | Oct/Nov 2015 | mark scheme · report | Brutal | 5 / `--d5` | **Yes** |
| 2015 r2c3 | `67:1072` | `67:1414` | /31 | Oct/Nov 2015 | mark scheme | Unrated | 0 / all `--hair` | No |
| 2014 r1c1 | `67:1112` | `67:1454` | /12 | May/June 2014 | mark scheme · report | Typical | 3 / `--d3` | No |
| 2014 r1c2 | `67:1143` | `67:1485` | /22 | May/June 2014 | mark scheme · report | Steady | 2 / `--d2` | No |
| 2014 r1c3 | `67:1183` | `67:1525` | /42 | May/June 2014 | mark scheme | Tough | 4 / `--d4` | No |

Row frames: `45:115` / `45:274` (grid 2015) and `45:415` (grid 2014) Day; `46:520` / `46:524` and `46:533` Night.
Note the 2015 header says "6 papers" and the 2014 header "3 papers" — both match the card count.

## 6. Settings content region — 1020 x 746 at (269, 82)

`content` = `533:379` N / `538:470` D.

```
content  1020 x 746 · VERTICAL · gap 20 · padding 0 · FIXED x HUG · MIN/MIN · fills [] · clip false
  header  1020 x 44   VERTICAL gap 6, FILL/HUG, clip
  cols    1020 x 682  HORIZONTAL gap 24, FILL/HUG, MIN/MIN
    left   585 x …   VERTICAL gap 16
    right  411 x …   VERTICAL gap 16
```

`585 + 24 + 411 = 1020`. That is a **7 / 5 split of the 996px of usable width** (a true 7/5 would be
581 / 415 — the authored widths are 585 / 411, so honour the px, not the ratio). `left` is FIXED 585;
`right` is the remainder.

`header`: title TEXT `533:381` — SF Pro **Semibold 20**, tracking 0, `--ink`, "Settings". Sub TEXT
`533:382` — `Body/Small` (SF Pro Regular 12), `--ink-3`, "Bell 0.4.2 · one watched folder, 13,447 papers
indexed". `24 + 6 + 14 = 44`.

### 6.1 `sec-label` (Settings variant)

`FILL x HUG · HORIZONTAL · gap 10 · padding 5 / 0 · MIN / CENTER · clip · fills []`
Children: label `Label/Section` `--ink-2` UPPER; *optional* `Mono/Small` meta `--ink-3`; `rule` FILL 1px
`--hair` (correctly bound here in **both** modes). Only the Library group carries a meta ("13,447 papers").

### 6.2 The grouped-list card pattern — build it exactly like this

```
card   FILL x HUG · VERTICAL · **padding 0** · **gap 0** · MIN/MIN
       fill --card · border 1px --card-brd (INSIDE)
       cornerRadius: all four fields bound to radius/card → --r-card (13)
       clipsContent TRUE          ← required, so rows corner-clip against the radius
  row      FILL x HUG · HORIZONTAL · padding **11 / 16** · SPACE_BETWEEN / CENTER · gap 0 · clip
    text   HUG (or FILL where the helper must wrap) · VERTICAL · gap 2 · MIN/MIN · clip
      label   Body/Default (SF Pro Regular 13, tracking -0.052px)  → --ink
      helper  Body/Meta  (SF Pro Regular 11)                       → --ink-3
    control  HUG, right-aligned
  divider  FILL x 1px · fill --hair-2 · no radius
```

The card holds **zero** padding and **zero** gap; every row supplies its own `11 / 16`. That is what makes
the `--hair-2` dividers **full-bleed** — they are siblings of the rows inside the card, so they span the
whole 585 / 411 width and are clipped by the card's 13px corners. Do not move the padding onto the card,
and do not use `border-bottom` on the rows (the last row would then need a special case).

Control types used: **Switch** (44 x 24), **chip row** (`choice` / `tone choice`: HORIZONTAL gap 8 of
32-tall `--r-pill` chips, `padding 0 12`, `gap 7`), **Button** (Secondary: `h 34`, `--r-btn`, `padding 0 14`,
`gap 8`, `--glass-strong` + 1px `--hair`, label `Body/Strong` `--ink`), **value + chevron** (HORIZONTAL
gap 6), **plain text** (`Mono/Meta` `--ink-2`), and **nothing at all** (About's credit row).

### 6.3 LEFT column (585) — every row verbatim

Node ids are the **Night** frame (`530:3`); the Day frame `530:873` is structurally identical with ids in
the `538:4xx-538:6xx` range (`content 538:470`, `header 538:471`, `cols 538:474`, `left 538:475`,
`right 538:550`).

**APPEARANCE** — sec-label `534:379` (no meta) · card `534:382`

| row | node | label | helper | control |
|---|---|---|---|---|
| Tone | `534:383` | `Tone` | `Match system follows the macOS appearance setting` | `tone choice` `534:387`: 3 chips — **`Day`** `534:388` (`--glass-strong` + 1px `--hair`, 18px sun icon, label `--ink-2`) · **`Night`** `534:403` (**`--accent-soft`, no border**, 18px moon icon, label `--ink`) · **`Match system`** `534:421` (`--glass-strong` + `--hair`, no icon, label `--ink-2`) |
| Show Mr. Bell | `534:431` | `Show Mr. Bell` | `The crab keeps watch at the foot of the sidebar` | Switch `534:435` — **On** |
| Reduce motion | `534:439` | `Reduce motion` | `Cut the tone crossfade and page transitions` | Switch `534:443` — **Off** |

Dividers `534:430`, `534:438`.

**LIBRARY** — sec-label `535:396` + meta `13,447 papers` · card `535:400`

| row | node | label | helper | control |
|---|---|---|---|---|
| Papers folder | `535:401` | `Papers folder` | `~/Documents/Bell/Papers` — **`Mono/Small`** (Geist Mono 11), not SF Pro | Button `535:405` `Choose…` (no icon) |
| Index on launch | `535:411` | `Index on launch` | `Re-scan the watched folder each time Bell opens` | Switch `535:415` — **On** |
| Include mark schemes | `535:419` | `Include mark schemes` | — | Switch `535:422` — **On** |
| Include examiner reports | `535:426` | `Include examiner reports` | — | Switch `535:429` — **Off** |
| (`row · null`) | `535:432` | **none** | `Last indexed 4 minutes ago · 41 new papers found` — `Body/Meta` `--ink-3`, sits in the label slot | Button `535:435` `Re-index` **with a 16px `sync` icon** |

Dividers `535:410`, `535:418`, `535:425`, `535:431`.

**EXAM SESSIONS** — sec-label `537:418` (no meta) · card `537:421`

| row | node | label | helper | control |
|---|---|---|---|---|
| Default level | `537:422` | `Default level` | — | `choice` `537:425`: **`A Level`** `537:426` (Board/A Level gradient `rgba(79,195,247,.4)→rgba(106,168,255,.4)` + 1px `rgba(79,195,247,.9)`, label `--ink`) · `IGCSE` `537:447` · `O Level` `537:464` (both `--glass-strong` + `--hair`, `--ink-2`) |
| Default session | `537:482` | `Default session` | — | `choice` `537:485`: **`May/June`** `537:486` (Season/May-June gradient `rgba(63,184,79,.28)→rgba(126,212,140,.28)` + 1px `rgba(63,184,79,.7)`, Season Icon 18, `--ink`) · `Oct/Nov` `537:506` · `Feb/March` `537:525` (both `--glass-strong` + `--hair`, Season Icon 18, `--ink-2`) |

Divider `537:481`. Neither row has a helper, so the label stack is one line and the row is
`11 + 16 + 11 = 38` tall (16 = a 13px line box at `line-height: normal`). A row **with** a helper is
`11 + 16 + 2 + 13 + 11 = 53`.

### 6.4 RIGHT column (411) — every row verbatim

**FOCUS** — sec-label `536:406` · card `536:409`

| row | node | label | helper | control |
|---|---|---|---|---|
| Start the timer… | `536:410` | `Start the timer when a paper opens` | — | Switch `536:413` — **On** |
| Session length | `536:417` | `Session length` | — | `value` `536:420` HORIZONTAL gap 6: `Mono/Timer` (Geist Mono Regular **15**) `50:00` `--ink` + 16px `icon chev` `536:422` |
| Pause when idle | `536:425` | `Pause when idle` | `Stops the clock after 3 minutes without input` | Switch `536:429` — **On** |

Dividers `536:416`, `536:424`. In this column the `text` stacks are **FILL (`flex: 1 0 0; min-width: 0`)**,
not HUG, because 411px is narrow enough that the helpers must wrap — the Pause-when-idle helper is
authored `min-width: 100%; width: min-content` so it wraps rather than clipping.

**UPDATES** — sec-label `536:432` · card `536:435`

| row | node | contents |
|---|---|---|
| `notice slot` | `536:436` | **padding 14 / 16** (not 11/16) · HORIZONTAL · MIN/MIN. Holds `Update Notice` `536:437` at **FILL** (`flex: 1 0 0`) — so the 214-wide master stretches to 379. Recipe: `--glass-strong` + 1px **`--glass-brd`** · radius `--r-chip` (9) · padding 8 / 10 · SPACE_BETWEEN · shadow `0 3px 10px rgba(18,20,51,.14)`. Left `label` group gap 6: 6px `dot` + `Body/Chip` `Restart to update` `--ink`. Right: 14px icon. Variant **`State=Ready`** |
| Check automatically | `536:447` | label `Check automatically`, helper `Daily, in the background`, Switch `536:451` — **On** |

Divider `536:446`.

**DATA** — sec-label `537:544` · card `537:547`

| row | node | label | helper | control |
|---|---|---|---|---|
| Storage used | `537:548` | `Storage used` | `13,447 papers · 41 mark schemes` | plain TEXT `537:552` — `Mono/Meta` (Geist Mono Regular 12) `1.2 GB`, **`--ink-2`**. No button, no chevron |
| (`row · meta`) | `537:554` | **none** | `Cached page previews and thumbnails` — `Body/Meta` `--ink-3` in the label slot | Button `537:557` `Clear cache` (no icon) |

Divider `537:553`.

**ABOUT** — sec-label `538:451` · card `538:454`

| row | node | label | helper | control |
|---|---|---|---|---|
| Bell 0.4.2 | `538:455` | `Bell 0.4.2` — **`Body/Strong`** (SF Pro **Semibold** 13), `--ink` | `build 1284 · September 2026` — **`Mono/Small`** (Geist Mono 11), `--ink-3` | Button `538:459` `Release notes` (no icon) |
| (`row · meta`) | `538:464` | holds `credit` `538:466` — a second copy of the sidebar credit row: gap 4 · SF Pro Regular **10** · `Built with ` `--ink-3` + `♥` `--d5` + ` by` · `Brand Mark / GitHub` `538:468` **11px** · `zohaiblazuli` `--ink-2` | — | **none** — the row is still SPACE_BETWEEN with a single child, so it left-aligns |

Divider `538:463`.

## 7. Non-local colour sources on the Library screens

Four foreign paints leak in. They pair up: the same two nodes are hand-painted a dark value in Day and a
light value in Night, instead of being bound once to a mode-aware token.

| # | source | hex | frame | carrier node(s) | map to |
|---|---|---|---|---|---|
| 1 | `Style/#070707` — a raw paint style literally named after its own hex | `#070707` | Library — **Day** `40:1080` | `45:113` (`sec-label 2015 → rule`) and `45:413` (`sec-label 2014 → rule`); **and** the `stroke` on all four Nav Item icon vectors — `I44:23;25:17`, `I44:34;25:3`, `I44:46;25:3`, `I44:53;25:3` | rules → **`--hair`**; nav icons → **`--accent`** on the Active row and **`--ink-2`** on the other three (that is what the Night twins bind) |
| 2 | `Glyphs/Neutral - Idle` (macOS 26 kit) | `#1A1A1A` | Library — **Day** | `429:1047` — `dev → credit → Brand Mark / GitHub` (11px). It also carries `mix-blend-mode: darken`, and its sibling `429:1048` "zohaiblazuli" carries `mix-blend-mode: difference` to compensate | **`--ink-3`** — exactly what the component's own description already claims ("fill bound to ink/3 so it tracks the text colour by mode"). Delete both blend modes once bound. |
| 3 | `Backgrounds/Primary` (macOS 26 kit) | `#FFFFFF` | Library — **Night** `46:417` | `428:1046` — `dev → credit → Brand Mark / GitHub`. Both Settings frames report the same style, so at least one of their two marks (`530:126` sidebar, `538:468` About) is painted the same way | **`--ink-3`** |
| 4 | `Fills - Vibrant/Tertiary` (macOS 26 kit) | `#ededed` | Library — **Night** | `46:531` — `sec-label 2014 → rule` | **`--hair`** |

Two more that are not on the brief but are the same class of defect:

| carrier | current paint | map to |
|---|---|---|
| `46:518` — `sec-label 2015 → rule`, Library Night | bound to `paper/base` → **`--paper` (`#FFFFFF`)**. A local token, but the wrong one — and its sibling rule in the same frame uses `#ededed` instead, so the two rules are wrong in two different ways | **`--hair`** |
| `Mr. Bell → lens L` / `lens R`, inside `375:828` (Day) and `375:925` (Night) | raw literals `fill="#0079B5"`, `stroke="black"`, mode-invariant | **`--bell-cap-hi`** for the lens, **`--page-ink`** for the outline — matching the `Mr. Bell Mark` used in the lockup |

**Settings gets the rule right in both modes** — `534:381`, `535:399`, `537:420`, `536:408`, `536:434`,
`537:546`, `538:453` (Night) and `538:574` (Day) all bind `--hair`. That is the proof `--hair` is the
intended token, so fix Library toward Settings, not the other way round.

## 8. TRAPS

1. **`Library — Day` is a COMPONENT (`40:1080`), not a FRAME.** It exposes no component properties; treat
   it as a frame. Its Night twin `46:417` *is* a plain FRAME. Do not instantiate either.
2. **`get_metadata` returns zero children** for `46:417`, `530:3` and `530:873`, and it cannot enumerate
   pages. Night child ids are **not** contiguous with Day's: sidebar `46:420`, then topbar `46:488` and
   `lib` `46:504`, while `46:484`-`46:487` do not exist. Probe or use `get_design_context`; never extrapolate.
3. **A partial `get_design_context` on a Night sub-node resolves variables in DAY mode** — the frame's
   `explicitVariableModes` is not inherited. `46:420` comes back as `--glass, rgba(255,255,255,0.58)`.
   Trust the var **name**, never the fallback hex, on any sub-node request. Exported icon SVGs are
   Day-resolved too, even inside Night frames.
4. `backdrop-blur-[13px]` in the emitted CSS vs the Figma style **`Glass/Chrome Blur 26`**
   (BACKGROUND_BLUR radius 26) — Figma halves the radius for CSS. Ship `backdrop-filter: blur(13px)`.
5. **`lib` has `gap: 0`.** All vertical rhythm is per-child padding (§5). Setting a parent gap adds it
   four times.
6. The `filters` row hides an **8 x 1 `gap` strut** (`45:89`): the level→season break is **24px**, not 8.
7. The topbar `spacer` is a **1px-tall FILL strut**, not a margin.
8. **Four fixed-width masters get resized in place**: Paper Card 280 → 330.667 (FILL in a 3-up row),
   Difficulty Meter 248 → FILL inside `foot`, Nav Item 220 → 214, Update Notice 214 → 379 in the Settings
   notice slot. Never hard-code the master width.
9. Radii `--r-win` 15 / `--r-panel` 16 / `--r-card` 13 / `--r-btn` 10 / `--r-chip` 9 / `--r-pill` 999 are
   tokenised; **`Kbd` 6, `sw` 12, meter bar 2 and traffic-light disc 7 are literals.** Leave them literal.
10. The Settings page title is **SF Pro Semibold 20** — a size that is *not* in the published type ramp
    (nearest: Title/Toolbar 17, Display/Setup Title 26). Same ad-hoc 20 as the Dashboard greeting.
11. **Settings — Day `530:873` still marks `chip Night` as the selected Tone chip** (`--accent-soft`) while
    its own topbar pill reads "Day". Content bug — bind the selected chip to the live mode.
12. On both Settings frames **no Nav Item is Active**, and the four Default labels use inconsistent inks:
    Library `--ink-2`, Dashboard `--ink-2`, Bookmarks `--ink-3`, Recent `--ink-3`. Standardise on `--ink-2`.
13. Three rows (`535:432`, `537:554`, `538:464`) have **no label** — a `Body/Meta` `--ink-3` string sits in
    the label slot instead. Don't model a row as "label required"; `538:464` has no control either.
14. The `♥` is a **text range fill** inside a longer string, correctly bound to `--d5`
    (`#a5103a` Day / `#ff4d6a` Night). `get_design_context` prints it as a raw hex anyway — **not a leak.**
15. Sidebar subject labels are a fixed **131** wide in the master, so "Further Mathematics" clips. Give the
    label `flex: 1 0 0; min-width: 0; overflow: hidden; text-overflow: ellipsis`.
16. `dev`'s version string is `v0.4.2  ·  build 1284` with **two spaces each side of the middot** and
    `white-space: pre`.
17. All four compositions return "this design contains animated nodes" (cloud lobes + Mr. Bell). Nothing
    static here depends on it — timings live on `331:289`, `391:2` and `443:2`.
