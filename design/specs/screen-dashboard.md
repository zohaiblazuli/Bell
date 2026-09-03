# Screen — Dashboard (measured spec)

Figma page **`181:2` "Screen — Dashboard"**.

| composition | node | x,y | size | Color mode |
|---|---|---|---|---|
| Dashboard — Night | `181:3` | 0, 0 | 1320 x 860 | pinned Night (`3:2`) |
| Dashboard — Day | `202:236` | 1400, 0 | 1320 x 860 | pinned Day (`3:1`) |

Both are plain FRAMEs, `layoutMode NONE`, `clipsContent true`, radius 15 (`--r-win`, bound per
corner), fill `--ground`. Content geometry, layout, text and per-node token assignment are
**identical between the two**; the only differences are the resolved token values and the
background/chrome stack (§9).

Screen chrome (unchanged by the rebuild): `sidebar` 238 x 860 @ 0,0 · `topbar` 1082 x 56 @ 238,0 ·
`page recess` (Night only) 1082 x 804 @ 238,56. **`content` is the only thing this spec covers.**

---

## 0. LAYOUT MAP

```
content 181:147   269,82   1020 x 747   VERTICAL · gap 20 · pad 0 · MIN/MIN · FILL/HUG · fills []
                  inset in page recess:  left 31 · top 26 · right 31 · bottom 31

y=0    +-------------------------------------------------------------------+  44   greeting  183:72
       |  Good evening, Zohaib                     SF Pro Semibold 20      |
       |  Next up — Accounting 9706, ...           SF Pro Regular 12       |
y=64   +--------------------+ +-----------+ +-----------+ +-----------+    |  92   hero + stats 183:75
       | hero  495:8446     | | Stat      | | Stat      | | Stat      |    |       HORIZONTAL gap 14
       | grow 2    391.2    | | 195.6     | | 195.6     | | 195.6     |    |       grow 2:1:1:1
y=176  +-------------------------------------------------------------------+ 187   year activity 495:2009
       | THIS YEAR ----------------------------------  1 Sep 2025 — today  |       card, pad 16, gap 12
       | +--- graph 714 x 130 -------------+  28  +--- rail 246 x 90 ---+  |
       | | months 13 / grid 714x88 /       |      | current  | longest  |  |
       | | bands 4 / legend 13   gap 4     |      | days act | target   |  |
y=383  +-------------------------------------------------------------------+ 364   cols 184:91
       | +--- left 585 (7 col) ------+  24  +--- right 411 (5 col) ----+   |       HORIZONTAL gap 24
       | | CONTINUE ------      23   |      | DUE FOR REVIEW ---   23  |   |       both VERTICAL gap 16
       | | resume card          81   |      | due for review      135  |   |
       | | SUBJECT PROGRESS ..  24   |      | SESSION COVERAGE ..  24  |   |
       | | subject progress    186   |      | session coverage    134  |   |
       | +--- 362 tall --------------+      +--- 364 tall -------------+   |
y=747  +-------------------------------------------------------------------+
```

Row arithmetic: `44 + 20 + 92 + 20 + 187 + 20 + 364 = 747`. Content bottom = `82 + 747 = 829`.

The 7/5 split is grid-true: over 1020 with a 24 gutter, 12 columns of **63**; span `n` = `87n − 24`
→ 7 col = **585**, 5 col = **411**, `585 + 24 + 411 = 1020`. `cols` height = `max(362, 364) = 364`,
both columns `counterAxisAlignItems MIN` (top-aligned).

---

## 1. greeting `183:72` — 1020 x 44 @ 0,0

`VERTICAL · itemSpacing 6 · padding 0 · MIN/MIN · FILL/HUG · fills [] · clip false`

| y | node | w x h | type | token |
|---|---|---|---|---|
| 0 | `183:73` | 209 x 24 | SF Pro **Semibold 20** · ls **0** · single line | `--ink` |
| 30 | `183:74` | 510 x 14 | SF Pro **Regular 12** · ls 0 · single line | `--ink-3` |

Strings: `Good evening, Zohaib` · `Next up — Accounting 9706, May/June 2015 Paper 2. Three papers left in this week’s plan.` (curly apostrophe, em dash).
Both are HUG/HUG and **have no bound text style** — 20/Semibold is not in the library at all.

---

## 2. hero + stats `183:75` — 1020 x 92 @ 0,64

`HORIZONTAL · itemSpacing 14 · padding 0 · MIN (counter) · FILL/FIXED 92`, fills [].
Four children stretch to full height. Track = `1020 − 3·14 = 978`; `layoutGrow 2 : 1 : 1 : 1`.

| x | node | w | grow |
|---|---|---|---|
| 0 | `495:8446` hero · days to exam | **391.2** | 2 |
| 405.2 | `183:76` Stat · Papers this week | 195.6 | 1 |
| 614.8 | `183:79` Stat · Focus this week | 195.6 | 1 |
| 824.4 | `183:82` Stat · Average score | 195.6 | 1 |

### 2a. hero · days to exam `495:8446` — 391.2 x 92

`VERTICAL · itemSpacing 3 · padding 12 / 14 / 12 / 14 · MIN/MIN · FILL/FILL`
fill **`--accent-soft`** (Night `#6aa8ff` @16 %, Day `#1436c8` @12 % — the alpha is *in* the token) ·
stroke **1 px `--accent` at full strength**, INSIDE · radius **13 literal** (NOT `--r-card`) · no effects.

| y | node | w x h | layout / type | token |
|---|---|---|---|---|
| 12 | `495:8447` caption | 138 x 12 | **Label/Stat** SF Pro Semibold 10 · ls +6 % (0.6 px) · UPPER | `--ink-2` |
| 27 | `497:502` value row | 116 x 34 | HORIZONTAL · gap 8 · **BASELINE** · clip · HUG/HUG | — |
| ⤷ 0 | `497:503` value | 46 x 34 | **Geist Mono SemiBold 26** · ls −2 % (−0.52 px) · `263` | `--ink` |
| ⤷ 54 | `497:504` date | 62 x 13 (y 16) | **Body/Meta** SF Pro Regular 11 · `9 May 2027` | `--ink-2` |
| 64 | `497:505` meter row | 363.2 x 14 | HORIZONTAL · gap 10 · CENTER · clip · FILL/HUG | — |
| ⤷ 0 | `497:506` meter | 306.2 x 4 (y 5) | grow 1 · r999 literal · clip · track | `--hair` |
| ⤷⤷ | `497:507` fill | 153.1 x 4 | grow **1** · r999 | `--accent` |
| ⤷⤷ | `497:508` rest | 153.1 x 4 | grow **1** · fills [] | — |
| ⤷ 316.2 | `497:509` plan | 47 x 14 | **Mono/Small** Geist Mono Regular 11 · `48 / 96` | `--ink-2` |

Content sums to `12 + 12 + 3 + 34 + 3 + 14 = 78`, `+12` bottom padding = 90 → **2 px slack** at the
bottom because the tile is stretched to 92. The meter is a 50/50 grow pair, matching `48 / 96`.

### 2b. Stat tiles — instances of `Stat` `24:5`, 195.6 x 92 each

`VERTICAL · itemSpacing 2 · padding 12 / 14 / 12 / 14 · MIN/MIN · clipsContent` ·
fill `--card` · stroke 1 px `--card-brd` · radius **`var(--r-card)` = 13**.

| y | node (in `183:76`) | w x h | type | token |
|---|---|---|---|---|
| 12 | `I183:76;495:8187` value row | 97 x 25 | HORIZONTAL · gap 8 · BASELINE | — |
| ⤷ 0 | `I183:76;24:3` value | 23 x 25 | **Mono/Stat** Geist Mono SemiBold 19 · ls −2 % (−0.38 px) | `--ink` |
| ⤷ 31 | `I183:76;495:8188` delta | 66 x 14 (y 8) | **Mono/Small** Geist Mono Regular 11 | `--ink-2` |
| 39 | `I183:76;24:4` caption | 107 x 12 | **Label/Stat** SF Pro Semibold 10 · +6 % · UPPER | `--ink-3` |

| node | value | delta | caption |
|---|---|---|---|
| `183:76` | `12` | `+6 vs last` | `papers this week` |
| `183:79` | `4h 12m` | `−48m vs last` | `focused this week` |
| `183:82` | `68%` | `+4 pts` | `average score` |

Natural height 63 (`12+25+2+12+12`) stretched to 92 ⇒ **29 px of empty space under the caption**;
`primaryAxisAlignItems MIN`, so do not vertically centre. Deltas are deliberately **uncoloured** —
direction is carried by the sign glyph, and `−48m` uses U+2212 MINUS SIGN, not a hyphen.

---

## 3. year activity `495:2009` — 1020 x 187 @ 0,176

`VERTICAL · itemSpacing 12 · padding 16 all round · MIN/MIN · FILL/HUG` ·
fill `--card` · stroke 1 px `--card-brd` · radius **13 literal** · no effects.
`16 + 13 + 12 + 130 + 16 = 187`.

### 3a. head `495:8001` — 988 x 13 @ 16,16 · `HORIZONTAL · gap 8 · CENTER · FILL/HUG`

| x | node | w x h | type | token |
|---|---|---|---|---|
| 0 | `495:8002` label | 64 x 13 | **Label/Section** SF Pro Semibold 11 · +6 % (0.66 px) · UPPER · `this year` | `--ink-2` |
| 72 | `495:8003` strut | 804 x 1 (y 6) | grow 1 · **no fill** | — |
| 884 | `495:8004` range | 104 x 13 | **Body/Meta** SF Pro Regular 11 · `1 Sep 2025 — today` | `--ink-3` |

### 3b. main `495:2010` — 988 x 130 @ 16,41 · `HORIZONTAL · gap 28 · MIN/MIN · FILL/HUG`

`graph 495:2011` 714 x 130 @ 0,0 · `rail 495:8063` 246 x 90 @ 742,0 → `714 + 28 + 246 = 988`.
The 90-tall rail is top-aligned in a 130-tall row (40 px free beneath).

### 3c. graph `495:2011` — 714 x 130 · `VERTICAL · gap 4 · pad 0`

| y | node | h |
|---|---|---|
| 0 | `495:7973` months | 13 |
| 17 | `495:2012` grid | **88** |
| 109 | `495:7986` exam sessions | 4 |
| 117 | `495:7990` legend | 13 |

`13 + 4 + 88 + 4 + 4 + 4 + 13 = 130`.

---

## 4. THE ACTIVITY GRID — exhaustive

`grid 495:2012` — **714 x 88** @ 0,17 in `graph`. `layoutMode NONE` (absolute), `fills []`.

```
      0        28                                                     704   714
      |<- 28 ->|<------------- 53 columns · pitch 13 -------------------->|
 d0   Sun      [w0][w1][w2][w3] ... ... ... ... ... ... ... ... [w51][w52]
 d1   Mon      [ ][ ][ ][ ]                                    [   ][   ]   y=13
 d2   Tue      ...                                                          y=26
 d3   Wed      ...                                             [   ][   ]   y=39
 d4   Thu      ...                                             [   ][ -- ]  y=52   w52 absent
 d5   Fri      ...                                             [   ][ -- ]  y=65   w52 absent
 d6   Sat      ...                                             [   ][ -- ]  y=78   w52 absent
```

| property | value |
|---|---|
| cell | 10 x 10, radius **2**, `overflow-clip` |
| gap | **3** both axes → **pitch 13** |
| cell position | `x = 28 + 13·w`, `y = 13·d`, `w ∈ 0..52`, `d ∈ 0..6` |
| day gutter | **28 px**, part of the 714 (cells occupy only 686 of it) |
| width check | `28 + 13·52 + 10 = 714` |
| height check | `13·6 + 10 = 88` |
| cell count | weeks 0–51 x 7 = 364, **week 52 = d0..d3 only (4 cells)** → **368** |
| fill | `--activity-0` … `--activity-4` by level |
| hairline | **0.5 px `--hair-2`, INSIDE, on EVERY cell including L0/empty** |
| naming | `w{week}d{day} L{level}`, ids sequential week-major from `495:2013` to `495:2380` |
| weekday | `d0 = Sunday` … `d6 = Saturday` |

The trailing week is **truncated, not padded** — there is no `w52d4/d5/d6` node. `368` is the number
the rail's `208 / 368` reads off.

### Day labels — children of `grid`, absolute, drawn after the cells

| node | text | x, y | w x h |
|---|---|---|---|
| `495:2381` | `Mon` | 0, **11** | 23 x 13 |
| `495:2382` | `Wed` | 0, **37** | 24 x 13 |
| `495:2383` | `Fri` | 0, **63** | 14 x 13 |

All **Body/Meta** SF Pro Regular 11, `--ink-3`, left-aligned in the gutter. `y = 13d − 2` for
`d = 1, 3, 5` — i.e. the label box centre sits **0.5 px above** the row centre. Sun/Tue/Thu/Sat
are unlabelled.

### months `495:7973` — 714 x 13, `layoutMode NONE`, every label at `top 0`

All **Body/Meta** SF Pro Regular 11, `--ink-3`, left-aligned on the first cell of the column.

| label | x | week | | label | x | week |
|---|---|---|---|---|---|---|
| Sep | 28 | 0 | | Mar | 366 | 26 |
| Oct | 80 | 4 | | Apr | 418 | 30 |
| Nov | 132 | 8 | | May | 470 | 34 |
| Dec | 197 | 13 | | Jun | 535 | 39 |
| Jan | 249 | 17 | | Jul | 587 | 43 |
| Feb | 314 | 22 | | Aug | 639 | 47 |

`x = 28 + 13·week`. A month is labelled on the **first week whose Saturday (d6) falls in that
month** — the GitHub rule. Column deltas run `4, 4, 5, 4, 5, 4, 4, 4, 5, 4, 4`; the final
**1-week stub (`w52`, September again) is deliberately unlabelled**, so 12 labels for 53 columns.

### exam sessions `495:7986` — 714 x 4, `layoutMode NONE`

Three bands, all `--accent` at **55 %**, height **3** at `top 0` (1 px slack below), radius **1.5**.

| node | name | x | w | weeks spanned |
|---|---|---|---|---|
| `495:7987` | Oct/Nov | 93 | 88 | w5 – w11 (7 columns) |
| `495:7988` | Feb/Mar | 314 | 62 | w22 – w26 (5 columns) |
| `495:7989` | May/Jun | 470 | 88 | w34 – w40 (7 columns) |

Band `x = 28 + 13·wStart`, `w = 13·(nCols − 1) + 10` — flush with the first and last cell of the
span, gutters included, no trailing gap.

### legend `495:7990` — 714 x 13, `HORIZONTAL · gap 8 · CENTER`

| x | node | w x h | type | token |
|---|---|---|---|---|
| 0 | `495:7991` note | 140 x 13 | Body/Meta · `Bands mark exam sessions` | `--ink-3` |
| 148 | `495:7992` strut | 425 x 1 (y 6) | grow 1 · **no fill** | — |
| 581 | `495:7993` | 24 x 13 | Body/Meta · `Less` | `--ink-3` |
| 613 | `495:7994` swatches | 66 x 10 (y 1.5) | HORIZONTAL · gap 4 · CENTER · clip · HUG | — |
| ⤷ | `495:7995`–`7999` L0–L4 | 10 x 10 at x 0/14/28/42/56 | r2 · 0.5 px `--hair-2` | `--activity-0..4` |
| 687 | `495:8000` | 27 x 13 | Body/Meta · `More` | `--ink-3` |

### rail `495:8063` — 246 x 90, `VERTICAL · gap 14 · pad 0 · MIN/MIN`

Two rows (`495:8064` @ y 0, `495:8071` @ y 52), each `HORIZONTAL · gap 12 · items-start · clip ·
FILL/HUG` with two `grow 1` tiles → **117 each** (`117 + 12 + 117 = 246`).
Tile: `VERTICAL · itemSpacing 1 · pad 0 · clip · grow 1`. Height `25 + 1 + 12 = 38`.

| tile | node | value (Mono/Stat 19, `--ink`) | value w | caption (Label/Stat 10, `--ink-3`) | caption w |
|---|---|---|---|---|---|
| current streak | `495:8065` | `6 days` | 67 | `current streak` | 100 |
| longest streak | `495:8068` | `20 days` | 78 | `longest streak` | 99 |
| days active | `495:8072` | `208 / 368` | 100 | `days active` | 72 |
| your target | `495:8075` | `4 / week` | 89 | `your target` | 78 |

Captions are stored lower-case with `textCase UPPER`.

---

## 5. cols `184:91` — 1020 x 364 @ 0,383

`HORIZONTAL · itemSpacing 24 · padding 0 · MIN/MIN · FILL/HUG`, fills [].

| x | node | w x h | sizing |
|---|---|---|---|
| 0 | `184:92` left | **585** x 362 | FIXED 585 / HUG · grow 0 |
| 609 | `184:93` right | **411** x 364 | FILL grow 1 / HUG |

Both columns: `VERTICAL · itemSpacing 16 · padding 0 · MIN/MIN · fills []`.

| left `184:92` | y | w x h | | right `184:93` | y | w x h |
|---|---|---|---|---|---|---|
| `185:82` sec-label CONTINUE | 0 | 186 x 23 | | `184:94` sec-label DUE FOR REVIEW | 0 | 194 x 23 |
| `185:85` resume card | 39 | 585 x 81 | | `184:97` due for review | 39 | 411 x 135 |
| `186:91` sec-label SUBJECT PROGRESS | 136 | 337 x 24 | | `187:111` sec-label SESSION COVERAGE | 190 | 209 x 24 |
| `186:95` subject progress | 176 | 585 x 186 | | `187:115` session coverage | 230 | 411 x 134 |

---

## 6. THE sec-label PATTERN (4 instances)

`HORIZONTAL · itemSpacing 10 · padding 5 / 0 / 5 / 0 · MIN/CENTER · **FIXED width** / HUG · fills []`

| node | frame w | label (stored string) | label w | meta | meta w | rule x | rule w |
|---|---|---|---|---|---|---|---|
| `185:82` | 186 | `CONTINUE` | 64 | — | — | 74 | 112 |
| `186:91` | 337 | `SUBJECT PROGRESS` | 125 | `weakest first` | 86 | 231 | 106 |
| `184:94` | 194 | `due for review` | 104 | — | — | 114 | 80 |
| `187:111` | 209 | `session coverage` | 123 | `10 of 40 sat` | 80 | 223 | **1** |

- **label** — **Label/Section** SF Pro Semibold 11 · ls +6 % (0.66 px) · `textCase UPPER` · `--ink-2` · h 13.
- **meta** (optional) — **Mono/Small** Geist Mono Regular 11 · ls 0 · `--ink-3` · h 14.
- **rule** — RECT h 1, no radius, fill **`--hair`**, `layoutGrow 1` (FILL/FIXED).
- Frame height is 23 without a meta (`5+13+5`) and 24 with one (`5+14+5`).
- Because the frames are FIXED width and deliberately shorter than the column, every rule stops well
  short of the column edge (112 / 106 / 80 px long inside 585 / 585 / 411 px columns).

---

## 7. LEFT COLUMN MODULES

### 7a. resume card `185:85` — 585 x 81 @ 0,39

`HORIZONTAL · itemSpacing 14 · padding 16 uniform · MIN/CENTER · FILL/HUG · clipsContent true`
fill `--card` · stroke 1 px `--card-brd` · radius `var(--r-card)` = 13 · **no shadow**. `16 + 49 + 16 = 81`.

| x | node | w x h | detail |
|---|---|---|---|
| 16 | `185:86` subject icon | 28 x 28 (y 26.5) | `Subject Icon` instance, 24-box vectors, 1.75 stroke, `--ink-2` |
| 58 | `185:92` body | 386 x 49 (y 16) | VERTICAL · gap 7 · pad 0 · **FILL grow 1** / HUG |
| ⤷ 0 | `185:93` identity | 386 x 18 | HORIZONTAL · gap 9 · CENTER · FILL/HUG |
| ⤷⤷ 0 | `185:94` | 84 x 18 | `Accounting` — SF Pro **Semibold 15 · ls 0** · `--ink` |
| ⤷⤷ 93 | `185:95` | 58 x 16 (y 1) | `9706 /12` — **Mono/Meta** Geist Mono Regular 12 · `--ink-2` |
| ⤷ 0 | `185:96` | 291 x 13 (y 25) | **Body/Meta** SF Pro Regular 11 · `--ink-3` |
| ⤷ 0 | `185:97` meter | 386 x 4 (y 45) | r999 · clip · track `--hair` |
| ⤷⤷ | `185:98` done | 220.02 | grow **57** · `--accent` · no own radius |
| ⤷⤷ | `185:99` rest | 165.98 | grow **43** · fills [] |
| 458 | `185:100` Resume | 111 x 38 (y 21.5) | `Button` Primary instance |

Meta string, with **double spaces** either side of each middle dot:
`May/June 2015  ·  opened 2 hours ago  ·  question 4 of 7`

**Resume button** — `HORIZONTAL · gap 8 · padding 0/18/0/18 · MIN/CENTER · HUG/FIXED 38 · clip ·
radius var(--r-btn) = 10`. Fill = paint style **`Blue/Primary Button 135`**, LINEAR at 161.10°,
stop 0 = `--bell-cap-lo` `#1436c8`, stop 0.70711 = `--bell-cap-mid` `#2c7bff` (both mode-invariant).
Effect: `DROP_SHADOW 0 10px 24px −14px rgba(111,118,242,0.9)` — **unbound legacy indigo `#6f76f2`**,
identical in both modes. Icon 16 x 16 check glyph, stroke `--white` 1.167. Label `Resume` =
**Body/Strong** SF Pro Semibold 13 · ls −0.4 % (−0.052 px) · `--white`.

### 7b. subject progress `186:95` — 585 x 186 @ 0,176

`VERTICAL · itemSpacing 0 · padding 6 / 16 / 6 / 16 · MIN/MIN · FILL/HUG · clipsContent true`
fill `--card` · stroke 1 px `--card-brd` · radius `var(--r-card)` = 13. Inner width **553**.
Separation is explicit `sep` RECTs (553 x 1, FILL/FIXED, fill **`--hair-2`**, no radius), not gap.
`6 + 5·34 + 4·1 + 6 = 186` (row pitch **35**).

Row — `HORIZONTAL · itemSpacing 12 · padding 8 / 0 / 8 / 0 · MIN/CENTER · FILL/HUG · clip · fills []`, h **34**:

| x | child | w x h | sizing | type | token |
|---|---|---|---|---|---|
| 0 | subject icon | 18 x 18 (y 8) | FIXED | `Subject Icon` instance | `--ink-2` |
| 30 | name | **130** x 14 (y 10) | **FIXED** | **Body/Chip** SF Pro Medium 12 · ls 0 | `--ink` |
| 172 | difficulty | **58** x 13 (y 10.5) | **FIXED** | **Label/Difficulty** SF Pro Semibold 11 · ls 0 | `--d1..--d5` |
| 242 | meter | 265 x 4 (y 15) | FILL grow 1 | r999 · clip · track | `--hair` |
| ⤷ | fill | — | grow = pct | r999 | `--accent` |
| ⤷ | rest | — | grow = 100 − pct | fills [] | — |
| 519 | pct | **34** x 14 (y 10) | **FIXED**, align RIGHT | **Mono/Small** Geist Mono Regular 11 | `--ink-3` |

`meter x = 18+12+130+12+58+12 = 242` · `meter w = 553 − 242 − 12 − 34 = 265`.

Rows, **sorted weakest-first by pct**:

| # | node | subject | code | pct | grow fill/rest | fill px | difficulty | token |
|---|---|---|---|---|---|---|---|---|
| 1 | `499:2149` | Biology | 9700 | 12 % | 12 / 88 | 31.80 | `Steady` | `--d2` |
| 2 | `499:2160` | Economics | 9708 | 22 % | 22 / 78 | 58.30 | `Tough` | `--d4` |
| 3 | `499:2172` | Chemistry | 9701 | 38 % | 38 / 62 | 100.70 | `Brutal` | `--d5` |
| 4 | `499:2184` | Physics | 9702 | 52 % | 52 / 48 | 137.80 | `Tough` | `--d4` |
| 5 | `499:2196` | Mathematics | 9709 | 61 % | 61 / 39 | 161.65 | `Typical` | `--d3` |

The difficulty word is the **paper-difficulty band, independent of progress** — ladder
`Gentle --d1 · Steady --d2 · Typical --d3 · Tough --d4 · Brutal --d5` (matches
`src/lib/difficulty.ts`). `--d1 / Gentle` does not occur anywhere on this screen.

---

## 8. RIGHT COLUMN MODULES

### 8a. due for review `184:97` — 411 x 135 @ 0,39

`VERTICAL · itemSpacing 0 · padding 6 / 16 / 6 / 16 · MIN/MIN · FILL/HUG` · **no clipsContent** ·
fill `--card` · stroke 1 px `--card-brd` · radius **13 literal**. Inner width **379**.
`sep` RECTs 379 x 1, fill `--hair-2`. `6 + 4·30 + 3·1 + 6 = 135` (row pitch **31**).

Row — `HORIZONTAL · itemSpacing 10 · padding 7 / 0 / 7 / 0 · MIN/CENTER · FILL/HUG · clip`, h **30**:

| x | child | w x h | sizing | type | token |
|---|---|---|---|---|---|
| 0 | subject icon | 16 x 16 (y 7) | FIXED | `Subject Icon` instance | `--ink-2` |
| 26 | name | **84** x 14 (y 8) | FIXED | **Body/Chip** SF Pro Medium 12 | `--ink` |
| 120 | code | **34** x 14 (y 8) | FIXED | **Mono/Small** Geist Mono Regular 11 | `--ink-3` |
| 164 | strut | 115 x 1 (y 14.5) | FILL grow 1 | **no fill — pure spacer, not a rule** | — |
| 289 | pct | **30** x 14 (y 8), RIGHT | FIXED | **Mono/Small** Geist Mono Regular 11 | `--ink-2` |
| 329 | difficulty | **50** x 13 (y 8.5), RIGHT | FIXED | **Label/Difficulty** SF Pro Semibold 11 | `--d*` |

`strut w = 379 − (16+84+34+30+50) − 5·10 = 115`.

| node | subject | code | pct | word | token |
|---|---|---|---|---|---|
| `501:497` | Chemistry | 9701 | `42%` | `Brutal` | `--d5` |
| `501:508` | Physics | 9702 | `51%` | `Tough` | `--d4` |
| `501:519` | Economics | 9708 | `58%` | `Tough` | `--d4` |
| `501:530` | Biology | 9700 | `new` | `Steady` | `--d2` |

Weakest-first by pct, with the unscored (`new`) row last.

### 8b. session coverage `187:115` — 411 x 134 @ 0,230

`VERTICAL · itemSpacing 4 · padding 10 / 16 / 10 / 16 · MIN/MIN · FILL/HUG` ·
fill `--card` · stroke 1 px `--card-brd` · radius `var(--r-card)` = 13. Inner width **379**.
`10 + 14 + 4 + (5·16 + 4·4) + 10 = 134`. **No separators** — spacing is the gap 4.

One column geometry, shared by the header row and all five data rows.
Every row: `HORIZONTAL · itemSpacing 8 · CENTER · clip · FILL/HUG`.

| x | slot | w | header `503:508` (h 14) | data row (h 16) |
|---|---|---|---|---|
| 0 | label | **96** | `503:509 pad` 96 x 1, **no fill** | `label` frame (see below) |
| 104 | m24 | 20 | text, CENTER | cell |
| 132 | s24 | 20 | text, CENTER | cell |
| 160 | w24 | 20 | text, CENTER | cell |
| 188 | m25 | 20 | text, CENTER | cell |
| 216 | s25 | 20 | text, CENTER | cell |
| 244 | w25 | 20 | text, CENTER | cell |
| 272 | m26 | 20 | text, CENTER | cell |
| 300 | s26 | 20 | text, CENTER | cell |
| 328 | strut | 13 | grow 1, **no fill** | grow 1, **no fill** |
| 349 | sat / count | **30** | `sat`, RIGHT | `n/8`, RIGHT |

Session-column pitch **28** (20 + 8). Header texts and `sat`: **Mono/Small** Geist Mono Regular 11,
`--ink-3`. Row count `n/8`: **Mono/Small**, `--ink-2`, RIGHT.

`label` frame (96 x 14, y 1) — `HORIZONTAL · gap 6 · CENTER · clip · FIXED 96`:
`subject icon` 14 x 14 + name **76** FIXED, **Body/Chip** SF Pro Medium 12, **`--ink-2`**
(dimmer than the other two lists, which use `--ink`). `14 + 6 + 76 = 96`.

Cell — 20 x 16, radius **3**, stroke **0.5 px `--hair-2`** INSIDE:

| state | fill |
|---|---|
| `none` | `--hair` @ 100 % |
| `partial` | `--accent` @ **38 %** |
| `done` | `--accent` @ 100 % |

Matrix (`–` none · `P` partial · `D` done), rows **alphabetical by subject**:

| row | node | m24 | s24 | w24 | m25 | s25 | w25 | m26 | s26 | count |
|---|---|---|---|---|---|---|---|---|---|---|
| Biology | `503:520` | – | – | P | – | – | – | – | – | `0/8` |
| Economics | `503:536` | – | P | D | P | – | – | – | – | `1/8` |
| Chemistry | `503:553` | P | D | D | P | P | – | – | – | `2/8` |
| Physics | `503:570` | D | D | P | D | P | – | – | – | `3/8` |
| Mathematics | `503:587` | D | D | D | P | D | P | – | – | `4/8` |

`n/8` counts **`done` only** (partials do not count). Total 10 → the sec-label meta `10 of 40 sat`.
Row ordering differs from the other two lists, which are weakest-first.

---

## 9. DAY / NIGHT DELTA

**Inside `content` there is no structural delta at all.** Geometry, layout modes, gaps, padding,
sizing, strings, text styles and per-node *token assignments* are identical; every paint is
variable-bound, so Day is a pure mode swap of the `Color` collection (Day `3:1`, Night `3:2`, pinned
per screen frame via `explicitVariableModes`). Verified by screenshot parity of `202:236` against
`181:147`. Two content-region paints are mode-invariant: the Resume gradient (`--bell-cap-lo` to
`--bell-cap-mid`) and its `rgba(111,118,242,.9)` glow.

Tokens actually used by this screen's content:

| token | Day | Night | where |
|---|---|---|---|
| `--ground` | `#e7e9f2` | `#111219` | frame only |
| `--card` | `#f6f7fc` (opaque) | `#24273a` @ **90 %** | 6 card surfaces |
| `--card-brd` | `#181a34` @ 9 % | `#ffffff` @ 16 % | all card strokes |
| `--hair` | `#181a34` @ 11 % | `#ffffff` @ 14 % | sec-label rules, meter tracks, coverage `none` |
| `--hair-2` | `#181a34` @ 7 % | `#ffffff` @ 9 % | row `sep`, every grid + coverage cell hairline |
| `--ink` | `#1b1d27` | `#ffffff` | greeting title, stat values, list names |
| `--ink-2` | `#4c5165` | `#dfe3ef` | sec-label labels, hero caption/date/plan, deltas, coverage names + counts, review pct |
| `--ink-3` | `#62677c` | `#b9bece` | greeting subline, stat captions, months/days/legend, codes, pcts |
| `--accent` | `#1436c8` | `#6aa8ff` | hero border, all meter fills, exam bands, coverage done/partial |
| `--accent-soft` | `#1436c8` @ **12 %** | `#6aa8ff` @ **16 %** | hero wash |
| `--activity-0..4` | `#e6eaf2 #c3d4e7 #77afee #1d85e4 #2a5c92` | `#2b2e40 #2f4665 #2d6bad #2892f7 #a6c8f2` | 368 grid cells + 5 legend swatches |
| `--d2 --d3 --d4 --d5` | `#9e5200 #a63d08 #a82a1a #a5103a` | `#ffae33 #ff8a38 #ff6b47 #ff4d6a` | difficulty words |
| `--r-card` 13 / `--r-btn` 10 | same | same | mode-invariant |

Two of those are traps rather than simple swaps:

- **`--activity-*` reverses direction.** Day runs **light to dark** (`#e6eaf2` to `#2a5c92`); Night
  runs **dark to light** (`#2b2e40` to `#a6c8f2`). Both encode "more activity = more contrast against
  the card", so a single ramp with an inverted lightness curve will not reproduce it.
- **`--card` is translucent in Night only** (90 %), so the aurora shows through every card there and
  not in Day. A flat opaque card colour in Night is visibly wrong.

Frame / chrome delta, outside `content`, for completeness (measured earlier; see
`~/.bell-ref/day-bg.md` and `night-bg.md`):

| thing | Day `202:236` | Night `181:3` |
|---|---|---|
| child count | **7** | **8** |
| `veil` / `page recess` | **absent** (`ground/veil` is `#ffffff` @ 0 in Day) | `veil` 1320x860 at 18 % + `page recess` 1082x804 @ 238,56 at 24 %, both `ground/veil` |
| `blue_orb 1` | RECT 1636x924 @ (-47,-24), node opacity **0.46**, blend **DARKEN**, index 3 | **absent** |
| `clouds` node opacity | 1.0 | **0.68** |
| `clouds` children | 11 (sky + 5 base/highlight pairs) | 12 (extra `pattern 1` HARD_LIGHT raster, parked outside the clip) |
| `sky` gradient stop 0 | `#8c94c7` @ 16 % | `#4d548c` @ 34 % |
| cloud `highlight` groups | opacity **0.52** | opacity **0.26** (Day is exactly 2x) |
| `ambient/a` and `ambient/b` | `#6aa8ff` and `#58c8ff` | `#7fb6ff` and `#6ed4ff` |
| window shadow | 2 **inline**: `#121432` 42 % (0,24) r60 s-28 + `#121432` 24 % (0,6) r16 s-10 | style `Shadow/Window/Night`: `#000000` 70 % (0,30) r70 s-30 + 50 % (0,8) r20 s-12 |
| `glass/base` and `hair/1` | `#ffffff` @ 58 % and `#181a34` @ 11 % | `#202230` @ 52 % and `#ffffff` @ 14 % |
| chrome blur | BACKGROUND_BLUR 26, inline | BACKGROUND_BLUR 26, via style `Glass/Chrome Blur 26` |
| `Mr. Bell` sidebar shadow | 1: `#121432` 14 % (0,6) r20 | 2: `#2c7bff` 20 % (0,0) r28 glow + `#05060c` 38 % (0,6) r14 |

---

## TRAPS

1. **`get_metadata` on `181:3` and `202:236` returns zero children.** Enter the Night composition at
   `181:147`. The **Day mirror node ids are not recoverable** — `202:237/238` are `ambient-a/b`,
   `clouds` is `207:243`, and the rest are not sequential (`202:378` and `207:382` do not exist). Day
   parity here is screenshot-verified, not id-by-id.
2. **Codegen fallback hexes are DAY values even inside the Night frame** — e.g. `var(--ink,#1b1d27)`
   on a node that actually renders `#ffffff`. Trust the token name only. `get_variable_defs` on the
   same node resolves correctly in the frame's pinned mode.
3. **Codegen silently drops paint-level opacity on variable-bound fills.** The `exam sessions` bands
   (`--accent` at 55 %) and the coverage `partial` cells (`--accent` at 38 %) both come back as a
   flat `var(--accent)`. Apply the alpha at the COLOUR level — `color-mix` or an rgba — and **not**
   as element opacity, or the 0.5 px hairline on the coverage cells fades with it.
4. **Radius bindings are inconsistent.** `resume card`, `subject progress`, `session coverage` and
   the `Stat` component use `var(--r-card)`; `hero`, `due for review` and `year activity` use a
   **literal 13**. All render 13, so this only bites on a radius re-theme. Confirmed:
   `get_variable_defs` on `495:2009` returns no radius variable at all.
5. **Stat tiles are 92 tall but hold only 63 tall of content** — **29 px of dead space** below the
   caption; the hero has 2 px of the same. `primaryAxisAlignItems MIN`, so do not vertically centre.
   Nothing in the row defines 92 naturally: `hero + stats` is authored FIXED 92.
6. **The hero days figure is Geist Mono SemiBold 26**, deliberately above Mono/Stat's 19, keeping the
   -2 % tracking (-0.52 px). It is not a bound text style.
7. **The greeting is entirely unbound type.** Title = SF Pro Semibold **20 / ls 0**, which does not
   exist in the library; the subline matches Body/Small's metrics but has no `textStyleId` either.
8. **The resume card's "Accounting" is SF Pro Semibold 15 with ls 0**, not `Title/Card` (which is -1 %).
9. **`sec-label SESSION COVERAGE` (`187:111`) overflows its own frame.** It is 209 wide but its
   content runs to 223, so the trailing rule collapses to **1 x 1 px starting 15 px past the right
   edge** — effectively no rule. Either widen the frame to about 330 or omit the rule in that header.
10. **Three near-identical 1 px flex spacers are not interchangeable.** The sec-label `rule` is
    filled `--hair`; the `strut` in `head`, in `legend`, in every `due for review` row and every
    `session coverage` row, and the coverage header `pad`, all have **no fill**.
11. **Two different separator idioms.** `subject progress` and `due for review` use `itemSpacing 0`
    plus explicit `sep` RECTs (`--hair-2`); `session coverage` uses `gap 4` and no separators at all.
12. **The `--hair` / `--hair-2` split is load-bearing.** `--hair`: sec-label rules, every meter
    track, coverage `none` cells. `--hair-2`: row separators, and the hairline on all 368 grid cells
    plus all 40 coverage cells.
13. **The activity grid trailing week is 4 cells, not 7.** Do not pad it out to a rectangle — the
    total is **368**, and the rail's `208 / 368` reads off exactly that number.
14. **The grid is absolutely positioned (`layoutMode NONE`)**, not auto-layout or CSS grid, and the
    28 px day gutter lives inside the 714 width, so cells occupy only 686 of it.
15. **Only 12 of 53 columns carry a month label**, left-aligned on that column's first cell, chosen
    by the month containing the week's **Saturday**; the final 1-week stub (`w52`, September again)
    is deliberately unlabelled.
16. **Day labels are Mon/Wed/Fri only**, at `y = 13d - 2` for `d = 1,3,5` — half a pixel above true
    row centre. Sun/Tue/Thu/Sat have no label.
17. **`--activity-*` reverses ramp direction between modes** (see section 9).
18. **`--card` is 90 % opaque in Night**, so cards are translucent over the aurora there and fully
    opaque in Day.
19. **The Resume button glow is `rgba(111,118,242,.9)`** — the retired indigo `#6f76f2`, unbound, in
    both modes. The file was otherwise audited purple-free; this one shadow was missed.
20. **Character-exact strings matter.** The Focus stat's delta is `−48m vs last` with a U+2212
    MINUS SIGN, not a hyphen; the greeting uses a curly apostrophe (`week’s`) and an em dash
    (`Next up —`); the year-activity range is `1 Sep 2025 — today`; and the resume card's meta
    line has **double spaces** either side of each `·`.
21. **Nothing in the content region has a shadow, cards included.** The only effect anywhere inside
    `content` is the Resume button drop shadow.
22. The whole composition is **auto-layout plus `layoutGrow` ratios** — there are no Figma layout
    grids on this page. The 7/5 column split and the 2:1:1:1 hero row are grow ratios that happen to
    land exactly on a 12 x 63 / 24 grid; reproduce them as flex ratios, not fixed widths, or the
    fractional 391.2 / 195.6 values will drift.
