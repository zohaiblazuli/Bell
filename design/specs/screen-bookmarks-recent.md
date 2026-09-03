# Screen — Bookmarks & Screen — Recent (measured spec)

Two previously-unknown Figma pages: **`181:367` "Screen — Bookmarks"** and
**`181:723` "Screen — Recent"**. (Hunt log: see `screen-reader.md` §11.)

| composition | node | x,y | size | content node |
|---|---|---|---|---|
| Bookmarks — Night | `181:368` | 0, 0 | 1320 x 860 | `181:512` |
| Bookmarks — Day | `202:1588` | 1400, 0 | 1320 x 860 | `202:1732` |
| Recent — Night | `181:724` | 0, 0 | 1320 x 860 | `181:868` |
| Recent — Day | `202:4278` | 1400, 0 | 1320 x 860 | `202:4422` |

Both screens are **Library variants**: identical window, background, sidebar and topbar shell
(§1-§4), differing only in the content region (§5 Bookmarks, §6 Recent) and in which `Nav Item` is
active. All four are plain FRAMEs, `clipsContent: true`, radius `--r-win` (15), fill `--ground`.

Child-node ids follow a fixed offset from each composition's root, verified on all four:

| child | offset | Bookmarks N / D | Recent N / D |
|---|---|---|---|
| ambient-a | +1 | `181:369` / `202:1589` | `181:725` / `202:4279` |
| sidebar | +64 | `181:432` / `202:1652` | `181:788` / `202:4342` |
| topbar | +127 | `181:495` / `202:1715` | `181:851` / `202:4405` |
| content | +144 | `181:512` / `202:1732` | `181:868` / `202:4422` |

(Sidebar / topbar / content confirmed live; `ambient-a` confirmed on Bookmarks — Night.)

---

## 1. Layout map (all four compositions)

```
 0                        238    269                                           1289  1320
 +----------------------+--------------------------------------------------------------+ 0
 |                      | topbar  1082 x 56  --glass, border-BOTTOM 1px --hair, blur 13|
 | sidebar  238 x 860   +--------------------------------------------------------------+ 56
 | --glass              |        page recess 238,56  1082 x 804 (Night only)           |
 | border-RIGHT 1px     |   +------------------------------------------------------+   | 82
 | --hair, blur 13      |   | content  269,82   1020 x 592 (BM) / 593 (Recent)     |   |
 | VERTICAL gap 4       |   |          VERTICAL, fills []                          |   |
 | pad 12 x / 14 y      |   |                                                      |   |
 |  window lights       |   |                                                      |   |
 |  brand               |   |                                                      |   |
 |  nav-label Study     |   |                                                      |   |
 |  Nav Item x4         |   |                                                      |   |
 |  nav-label Subjects  |   |                                                      |   |
 |  subj (10 rows)      |   |                                                      |   |
 |  mascot (FILL)       |   +------------------------------------------------------+ 674/675
 |  dev                 |                                                              |
 +----------------------+--------------------------------------------------------------+ 860
```

## 2. Window + background

Window shadow: Night `0 8 20 -12 #00000080` + `0 30 70 -30 #000000b2`;
Day `0 6 16 -10 rgba(18,20,50,.24)` + `0 24 60 -28 rgba(18,20,50,.42)`.

Background stack is the shared 12-composition recipe — **identical to `screen-reader.md` §3**,
including `ambient-a` at `-686.4, -438.6` 1584 x 946 (verified equal on Bookmarks — Night), the
`clouds` frame at node opacity **0.68** Night / **1.0** Day with its rotated `pattern 1` raster and
five `base` / `highlight` pairs at 27% / 52% paint opacity, and Day's `blue_orb 1` at
`mix-blend-mode: darken`, node opacity **0.46**.

Only the scrims differ from the Reader, because the content region is a different rectangle:

| node (Bookmarks — Night) | x, y | w x h | paint | paint opacity |
|---|---|---|---|---|
| `181:430` veil | 0, 0 | 1320 x 860 | `--ground-veil` | **18%** |
| `181:431` page recess | **238, 56** | **1082 x 804** | `--ground-veil` | **24%** |

Day has **neither** — no `veil`, no `page recess`.

## 3. sidebar — 0,0 238 x 860

Fill `--glass`, **stroke on the RIGHT edge only**, 1px `--hair`, `backdrop-blur 13`.
**VERTICAL, gap 4, pad 12 horizontal / 14 vertical, align START**, not clipped.

| # | node | name | y (abs) | size | spec |
|---|---|---|---|---|---|
| 0 | `181:433` | window lights | 14 | 62 x 16 | instance, H gap 9 pad 1, 14px discs r7, `--traffic-*`, glyphs hidden |
| 1 | `181:434` | brand | 34 | 111.6 x 50.8 | H, clip, pad `l 8 / t 6 / b 14`; holds `logo` `390:4458` (`Bell / Lockup — Horizontal`) 103.6 x 30.8 — wordmark **only**, no separate brand-mark row |
| 2 | `181:441` | nav-label Study | 88.8 | 214 x 30 | pad `l 10 / t 12 / b 5`; text **Label/Section** `--ink-3` |
| 3 | `181:443` | Nav Item Library | 122.8 | 214 x 34 | count `13,447`, SF Pro **Medium 11** `--ink-3`, hard right |
| 4 | `181:444` | Nav Item Dashboard | 160.8 | 214 x 34 | |
| 5 | `181:445` | Nav Item Bookmarks | 198.8 | 214 x 34 | **Active on the Bookmarks screen** |
| 6 | `181:446` | Nav Item Recent | 236.8 | 214 x 34 | **Active on the Recent screen** (`181:802`, verified) |
| 7 | `181:447` | nav-label Subjects | 274.8 | 214 x 30 | as #2 |
| 8 | `181:449` | subj | 308.8 | 214 x 311 | VERTICAL gap **1**, `pt 2`, clip |
| 9 | `181:490` | mascot | 623.8 | 214 x 191.2 | `layoutGrow 1` (FILL height), `min-height: 0`, clip |
| 10 | `429:2955` | dev | 819 | 214 x 27 | VERTICAL gap 3, clip |

**Nav Item** (component `25:24`): H gap 11, `px 10 py 8`, r `--r-btn` (10), w 214.
Icon 18. Label **Body/Nav** (SF Pro Medium 13, -0.4%).

| state | row fill | label | extra |
|---|---|---|---|
| Default | none | `--ink-2` | — |
| Active | `--accent-soft` | `--accent` | `active indicator` 3 x 17 at **x -12, y 9**, radius `0 3 3 0`, `linear-gradient(90deg, --bell-cap-hi 0%, --bell-cap-mid 34%, --bell-cap-lo 67%, --bell-cap-deep 100%)` |

Exactly **4** nav rows on both screens; no Settings entry. The active row is the only one with a
fill — the iris is spent as the 3px sliver, never as a row fill.

**`subj` rows** — 10 rows, each 214 x 30: H gap 10, `px 10 py 7`, r `--r-btn`, clip.
Icon 16 in the subject's **hashed iris tint** (`--iris-1` `#6AA8FF`, `--iris-2` `#2C7BFF`,
`--iris-3` `#1436C8`, `--iris-4` `#F3B7C6` — all mode-invariant; Accounting = `--iris-3`).
Name SF Pro **Regular 13** `--ink-2`, FILL. Code **Mono/Small** `--ink-3`, hug right.
Row 1 (`181:450`, 9706) has fill `--accent-soft`; rows 2-10 have no fill.

| y (in `subj`) | node | subject | code |
|---|---|---|---|
| 2 | `181:450` | Accounting | 9706 |
| 33 | `181:454` | Biology | 9700 |
| 64 | `181:458` | Business | 9609 |
| 95 | `181:462` | Chemistry | 9701 |
| 126 | `181:466` | Computer Science | 9618 |
| 157 | `181:470` | Economics | 9708 |
| 188 | `181:474` | Further Mathematics | 9231 |
| 219 | `181:478` | Mathematics | 9709 |
| 250 | `181:482` | Physics | 9702 |
| 281 | `181:486` | Psychology | 9990 |

**`mascot`**: one `Mr. Bell` instance (`375:2698`) at **160 x 160** (0.625x of the 256 rig),
constraints `CENTER` / `MAX` → `bottom: 16.2px; left: calc(50% - 1px); transform: translateX(-50%)`.
Shadow `0 6 14 0 rgba(5,6,12,.38)` + `0 0 28 0 rgba(44,123,255,.20)`. The slot is `clipsContent`.

**`dev`**: `429:2956` "v0.4.2  ·  build 1284" SF Pro Reg 10 `--ink-3`; `429:2957` credit H gap 4 —
"Built with ♥ by" SF Pro Reg 10 `--ink-3` with the ♥ span in raw **`#ff4d6a`**, then
`Brand Mark / GitHub` at 11 x 11, then "zohaiblazuli" SF Pro Reg 10 `--ink-2`.

## 4. topbar — 238,0 1082 x 56

Fill `--glass`, **stroke on the BOTTOM edge only**, 1px `--hair`, `backdrop-blur 13`.
**HORIZONTAL, gap 12, px 16, align CENTER**, height fixed 56.

| node (BM Night) | name | x | size | spec |
|---|---|---|---|---|
| `181:496` | title | 16 | hug | **Title/Toolbar** (SF Pro Semibold 17, -1.2%) `--ink` — "Bookmarks" (92 wide) / "Recent" (58 wide) |
| `181:497` | search | **120** BM / **86** Recent | 420 x 34 | `--glass-strong` + 1px `--hair`, r `--r-pill`, `pl 12 pr 10`, H gap 9, clip |
| ↳ `181:498` | icon | +12 | 16 | `Icon=search` |
| ↳ `181:499` | placeholder | +37 | FILL | "Search papers, subjects, sessions" **Body/Default** `--ink-3` |
| ↳ `181:500` | Kbd | +358 | 52 x 18 | `--glass-strong` + 1px `--hair`, radius **6**, `px 6 py 2`, "Ctrl K" **Mono/Small** `--ink-3` |
| `181:501` | spacer | 552 / 518 | FILL x 1 | 331 (BM N) / 340 (BM D) / 365 (Rec N) / 374 (Rec D) |
| `181:506` | tone pill | 895 N / **904** D | 125 x 34 N / **116 x 34** D | `--glass-strong` + 1px `--hair`, r `--r-pill`, `pl 12 pr 6`, H gap 8; icon 16 (moon / sun); label SF Pro Reg 12 `--ink-2`; `sw` 44 x 24. Right edge is 1020 in both modes |
| `181:511` | Icon Button | 1032 | 34 x 34 | `Icon=sync`, icon 18, r `--r-btn`, no fill at rest |

## 5. Bookmarks content — `181:512` / `202:1732`, 269,82 1020 x 592

**VERTICAL, gap 0, `fills: []`**, six children whose own padding does the spacing.

```
y   0  filters              1020 x 58    H gap 8, pb 26
y  58  sec-label ACCOUNTING 1020 x 34    H gap 10, pt 6 pb 14
y  92  grid 2015            1020 x 304   V gap 14   (2 rows)
y 396  sec-label PHYSICS    1020 x 34
y 430  grid 2014            1020 x 162   V gap 14   (1 row)
y 592  end
```

**`filters` `190:212`** — H gap 8, align CENTER, `pb 26`, clip. Seven `Chip` instances (h 32,
r `--r-pill`, `px 12`, H gap 7) plus a bare 8 x 1 `gap` spacer between the level group and the
season group:

| x | w | node | label | chip style |
|---|---|---|---|---|
| 0 | 76 | `190:213` | All levels | **Selected**: fill `--accent-soft`, label `--ink` |
| 84 | 66 | `190:214` | A Level | **Level tint**: `linear-gradient(90deg, rgba(79,195,247,.4), rgba(106,168,255,.4))`, 1px `rgba(79,195,247,.9)`, label `--ink` |
| 158 | 61 | `190:215` | IGCSE | Rest: `--glass-strong` + 1px `--hair`, label `--ink-2` |
| 227 | 67 | `190:216` | O Level | Rest |
| 302 | 8 | `190:217` | (gap) | 8 x 1, no fill |
| 318 | 104 | `190:218` | May/June | **Season tint**: `linear-gradient(90deg, rgba(63,184,79,.28), rgba(126,212,140,.28))`, 1px `rgba(63,184,79,.7)`, 18px `Season Icon`, label `--ink` |
| 430 | 97 | `190:219` | Oct/Nov | Rest + 18px `Season Icon`, label `--ink-2` |
| 535 | 111 | `190:220` | Feb/March | Rest + 18px `Season Icon`, label `--ink-2` |

Chip label = **Body/Chip** (SF Pro Medium 12, 0%).
The two tint chips carry **raw, unbound** gradient stops and strokes — see TRAPS.

**`sec-label` rows** — H gap 10, align CENTER, `pt 6 pb 14`, FILL width:
`ACCOUNTING` / `PHYSICS` **Label/Section** `--ink-2`; count "6 saved" / "3 saved" **Mono/Small**
`--ink-3`; `rule` rounded-rect h1 FILL, `--hair` (x 149 w 871 / x 120 w 900).

**`grid <year>`** — VERTICAL gap 14, `clipsContent: **false**`. Each `row` is HORIZONTAL gap 14,
h 128, `clipsContent: false`, holding three `Paper Card` instances at `layoutGrow 1` →
**330.667 wide** (x 0 / 344.667 / 689.333).

### 5a. Paper Card (component `66:359`) — 330.667 x 128

Fill `--card`, 1px `--card-brd`, radius `--r-card` (13), `clipsContent: true`,
**VERTICAL gap 10, pad 16**. Shadow style `Shadow/Card/*`:
Night `0 1 2 0 #00000059` + `0 4 12 -2 #00000073`; Day `0 1 2 0 #1214320f` + `0 4 10 -2 #1214321a`.

```
identity   V gap 4, FILL
  subject row   H, space-between, FILL
     subject label  H gap 9, FILL : icon 18 (hashed iris)  +  name  Title/Card  --ink, ellipsis
     bookmark       16 x 16, --accent            <-- measured #6AA8FF in Night, #1436C8 in Day
  code          H gap 2 : "9706" Mono/Meta --ink-2  +  "/12" Mono/Meta --ink-3
meta       H gap 6, FILL, Body/Meta --ink-3 : session · "·" · extra docs
foot       border-TOP 1px --hair-2, pt 12, H, FILL
  difficulty (Difficulty Meter 23:68) H, space-between:
     meter  H gap 3 : five bars 14 x 5, r 2 — lit = --d<N>, unlit = --hair
     label  Label/Difficulty --d<N>          (gap 10 from the meter)
```

`Unrated` = five unlit bars and the word `Unrated`; no `--dN` token in play.
The score numeral is hidden via the nested meter's `Show Score` property.

The nine cards, in DOM order:

| # | node | code | session | extras | difficulty | lit bars | token |
|---|---|---|---|---|---|---|---|
| 1 | `190:228` | 9706 /12 | May/June 2015 | mark scheme · report | Typical | 3 | `--d3` |
| 2 | `190:229` | 9706 /22 | May/June 2015 | mark scheme · report | Tough | 4 | `--d4` |
| 3 | `190:230` | 9706 /32 | May/June 2015 | mark scheme | Steady | 2 | `--d2` |
| 4 | `190:232` | 9706 /11 | Oct/Nov 2015 | mark scheme · report | Gentle | 1 | `--d1` |
| 5 | `190:233` | 9706 /21 | Oct/Nov 2015 | mark scheme · report | Brutal | 5 | `--d5` |
| 6 | `190:234` | 9706 /31 | Oct/Nov 2015 | mark scheme | **Unrated** | 0 | — |
| 7 | `190:241` | 9702 /22 | May/June 2015 | mark scheme · report | Typical | 3 | `--d3` |
| 8 | `190:242` | 9702 /41 | Oct/Nov 2015 | mark scheme | Steady | 2 | `--d2` |
| 9 | `190:243` | 9702 /52 | May/June 2014 | mark scheme · report | Tough | 4 | `--d4` |

Cards 1-6 are Accounting (`grid 2015`), 7-9 Physics (`grid 2014`). **Every card is bookmarked** —
that is the whole point of the screen, so there is no un-bookmarked variant on this page.

## 6. Recent content — `181:868` / `202:4422`, 269,82 1020 x 593

**VERTICAL, gap 16, `fills: []`.**

```
y   0  head                        1020 x 36
y  52  sec-label TODAY               205 x 24     <-- HUG width, not FILL
y  92  list TODAY                  1020 x 146     card, 3 rows
y 254  sec-label YESTERDAY           254 x 24
y 294  list YESTERDAY              1020 x 146     card, 3 rows
y 456  sec-label EARLIER THIS WEEK   343 x 24
y 496  list EARLIER THIS WEEK      1020 x 97      card, 2 rows
y 593  end
```

**`head` `192:72`** — H gap 12, align CENTER, clip, FILL:
`192:73` "24 sessions in the last 7 days  ·  9h 48m total" SF Pro **Regular 12** `--ink-3`;
`192:74` spacer FILL x 1; `192:75` `view toggle` 71 x 36 at x 949.

`view toggle` = **Segmented Control** `42:111`: fill `--hair-2`, 1px `--hair`, r `--r-pill`,
pad 4, H. `Segment 1` 30 x 28 r 999, no fill, `Icon=grid` @16. `separator` 3 x 20 `--hair` at
**opacity 0** (hidden because it neighbours the selection). `Segment 2` 30 x 28 r 999 **selected**:
fill `--glass-strong` + `0 4 10 -2 rgba(18,20,50,.10)` + `0 1 2 0 rgba(18,20,50,.06)`,
`Icon=list` @16.

**`sec-label` rows** — H gap 10, align CENTER, `py 5`, **width HUG** (205 / 254 / 343):
`Label/Section` `--ink-2` heading, **Mono/Small** `--ink-3` count ("3 papers" / "3 papers" /
"2 papers"), then `rule` h1 FILL `--hair`.

**`list <BUCKET>`** — fill `--card`, 1px `--card-brd`, radius `--r-card` (13),
VERTICAL gap 0, clip, FILL width. Rows are 48 tall, separated by a 1px `sep` rect in `--hair-2`
spanning the full width (so 3 rows = 48+1+48+1+48 = 146; 2 rows = 97).

Row layout — **H gap 14, `px 16 py 14`, align CENTER, FILL**, fixed-width slots:

| slot | x (in row) | width | style |
|---|---|---|---|
| subject icon | 16 | 20 | `Subject Icon` @20, stroke `--ink-2` 1.75 (**not** the iris tint used in the sidebar) |
| subject name | 50 | **124** | SF Pro **Medium 13** `--ink-2` |
| code | 188 | **76** | **Mono/Meta** (Geist Mono Reg 12) `--ink-2` — e.g. "9706 /12" as one string |
| session | 278 | **112** | **Mono/Small** (Geist Mono Reg 11) `--ink-3` |
| spacer | 404 | 426 FILL | h 1, no fill |
| difficulty | 844 | **60** | **Label/Difficulty** `--d<N>` |
| elapsed | 918 | **56** | **Mono/Small** `--ink-3` |
| open | 988 | 16 | `Icon=chev` @16 **rotated -90°**, stroke `--ink-2` 1.75 |

The eight rows:

| bucket | node (Night) | subject | code | session | difficulty | token | elapsed |
|---|---|---|---|---|---|---|---|
| TODAY | `192:102` | Accounting | 9706 /12 | May/June 2015 | Typical | `--d3` | 2h ago |
| TODAY | `192:118` | Physics | 9702 /22 | Oct/Nov 2015 | Tough | `--d4` | 4h ago |
| TODAY | `192:132` | Mathematics | 9709 /31 | May/June 2014 | Steady | `--d2` | 6h ago |
| YESTERDAY | `193:113` | Chemistry | 9701 /42 | Feb/March 2015 | Brutal | `--d5` | 1d ago |
| YESTERDAY | `193:127` | Accounting | 9706 /21 | Oct/Nov 2015 | Gentle | `--d1` | 1d ago |
| YESTERDAY | `193:143` | Economics | 9708 /12 | May/June 2015 | Typical | `--d3` | 1d ago |
| EARLIER | `193:161` | Biology | 9700 /32 | May/June 2014 | Steady | `--d2` | 4d ago |
| EARLIER | `193:174` | Physics | 9702 /41 | Oct/Nov 2014 | Tough | `--d4` | 5d ago |

No `Paper Card`, no `Difficulty Meter` bars and no bookmark glyph anywhere in the Recent list —
difficulty is the word alone.

## 7. Day ↔ Night delta

Geometry, structure, type and token *names* are identical across all four compositions. Only these
change:

| thing | Night | Day |
|---|---|---|
| `--ground` | `#111219` | `#e7e9f2` |
| window shadow | `Shadow/Window/Night` | `Shadow/Window/Day` |
| card shadow | `Shadow/Card/Night` `0 1 2 #00000059`, `0 4 12 -2 #00000073` | `Shadow/Card/Day` `0 1 2 #1214320f`, `0 4 10 -2 #1214321a` |
| background | `clouds` 0.68 + `veil` 18% + `page recess` 24% | `clouds` 1.0 + `blue_orb 1` darken 46%, **no scrims** |
| `--glass` / `--glass-strong` | `rgba(32,34,48,.52)` / `rgba(38,40,58,.70)` | `rgba(255,255,255,.58)` / `rgba(255,255,255,.74)` |
| `--hair` / `--hair-2` | `#ffffff24` / `#ffffff17` | `#181a341c` / `#181a3412` |
| `--card` / `--card-brd` | `#24273ae5` / `#ffffff29` | `#f6f7fc` / `#181a3417` |
| `--ink` / `-2` / `-3` | `#ffffff` / `#dfe3ef` / `#b9bece` | `#1b1d27` / `#4c5165` / `#62677c` |
| `--accent` / `--accent-soft` | `#6aa8ff` / `#6aa8ff29` | `#1436c8` / `#1436c81f` |
| `--d1..--d5` | `#ffd24a #ffae33 #ff8a38 #ff6b47 #ff4d6a` | `#8f6300 #9e5200 #a63d08 #a82a1a #a5103a` |
| tone pill | 125 x 34 at x 895, moon, "Night" | **116 x 34 at x 904**, sun, "Day" |
| topbar `spacer` | 331 (BM) / 365 (Recent) | 340 (BM) / 374 (Recent) |
| chip tint gradients, `♥`, traffic lights, `--iris-*`, `--bell-cap-*` | unchanged | unchanged |

## 8. TRAPS

1. **`get_design_context` on any sub-node of a Night frame returns DAY hex fallbacks.** The Night mode override lives on the top-level frame and is lost when you request a child; every `var(--x, #hex)` fallback inside `181:512`, `181:868`, `181:432`, `181:495` came back in Day values even though those nodes are on the Night composition. Use the token names, and use `get_variable_defs` on the same node to get correct Night values.
2. **The two full screen frames are too large for `get_design_context`** — it returns sparse metadata and tells you to descend. `get_metadata` on those frames returns **zero children**. Use the +64 / +127 / +144 offset table at the top to reach `sidebar` / `topbar` / `content` directly.
3. **The Bookmarks/Recent `page recess` is 238,56 1082 x 804** — different from the Reader's `140,52 912 x 808`. It hugs the content region, so it moves with the chrome.
4. **Sidebar stroke is right-edge-only; topbar stroke is bottom-edge-only.** The Reader's chrome uses all four edges. Do not share one CSS rule across both screens.
5. **`grid <year>` and `row` have `clipsContent: false` on purpose.** The Paper Card's shadow reaches 12px below and 8px to the sides; every ancestor used to clip it. If you re-enable overflow hidden anywhere in `content → grid → row`, the card shadows get sliced again.
6. **The two tinted filter chips carry raw, unbound paints** — `rgba(79,195,247,.4)→rgba(106,168,255,.4)` with a `rgba(79,195,247,.9)` stroke (level) and `rgba(63,184,79,.28)→rgba(126,212,140,.28)` with `rgba(63,184,79,.7)` (season). They do **not** retone between Day and Night and are not in the token vocabulary. Treat them as chip-variant constants, not as design tokens.
7. **Subject icons are tinted differently in three places**: sidebar `subj` rows and Paper Card use the subject's hashed **iris** tint (mode-invariant, e.g. Accounting `--iris-3` `#1436C8`, verified by pixel-sampling the Night render); the Recent list rows use plain `--ink-2`. Same component, three colour rules.
8. **Paper Card `bookmark` is `--accent`, not `--iris-3`.** In Day both resolve to `#1436c8`, so a Day-mode extraction cannot tell them apart; the Night render is `#6AA8FF`, which settles it.
9. **`sec-label` width differs between the two screens**: FILL (1020) on Bookmarks, HUG (205 / 254 / 343) on Recent. The rule inside still stretches, so they look the same — but the frame boxes are not interchangeable.
10. **Recent's `separator` inside the segmented control is present at opacity 0.** Keep the node (or the 3px of layout width) or the 71px toggle width will not come out right.
11. **`mascot` is the flex slot, not the crab.** It takes `layoutGrow 1` with `min-height: 0`; the 160px `Mr. Bell` is bottom-pinned inside it at `bottom: 16.2px`. Adding a 5th nav row shrinks the slot to ~153px and the crab does not move; adding a whole nav *group* takes it to ~115px and cuts his art.
12. **`13,447` is the only Nav Item count on the screen** and it sits on Library, not on the active row. It is SF Pro Medium 11 `--ink-3`, not mono.
13. **Recent rows use fixed-width text slots** (124 / 76 / 112 / 60 / 56). Long subject names are not truncated by an ellipsis in the design — they would simply overflow their slot. Add your own truncation and note the deviation.
14. `Recent` content is **593** tall, Bookmarks **592**. Not a typo — the bucket arithmetic lands one pixel apart.




