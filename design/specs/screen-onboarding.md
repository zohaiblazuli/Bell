# Screen — Onboarding — measured spec

Source: Figma `GnDdYtn8SaQjgmA4SQRCn7` · page **485:490 "Screen — Onboarding"**. Read-only.
Target: React + CSS, tokens per `src/styles/app.css`. All line heights are AUTO → `line-height: normal`.
Every colour below is a token name. Where a paint is genuinely unbound it is called out as **RAW**.

## 0. Frame inventory

14 frames, all **1320x860**, `radius --r-win` (15), `clipsContent: true`, `layoutMode: NONE`.
Night column x=0, Day column x=1400. `panel = body − 9` and `body = frame + 74` (Night) / `+72` (Day).

| step | Night frame | Night panel | Night body | Day frame | Day panel | Day body | y |
|---|---|---|---|---|---|---|---|
| shell | 485:491 | 487:2 | 487:11 | 485:864 | — | — | 0 |
| 01 Name | 494:7337 | 494:7402 | 494:7411 | 494:7520 | 494:7583 | 494:7592 | 960 |
| 02 Board | 494:9222 | 494:9287† | 494:9296 | 494:9405 | 494:9468† | 494:9477† | 1920 |
| 03 Subjects | 494:798 | 494:863 | 494:872 | 494:981 | 494:1044 | 494:1053 | 2880 |
| 04 Plan | 494:218 | 494:283† | 494:292 | 494:401 | 494:464† | 494:473 | 3840 |
| 05 Building | 494:7937 | 494:8002† | 494:8011 | 494:8120 | 494:8183† | 494:8192 | 4800 |
| 06 Ready | 494:8584 | 494:8649† | 494:8658 | 494:8767 | 494:8830† | 494:8839 | 5760 |

† id derived from the offset rule, not read back. Everything else was read directly.

Each frame pins the **Color** collection: Night → mode `3:2`, Day → mode `3:1` (Day is the collection default).

## 1. Window frame

| prop | Night | Day |
|---|---|---|
| fill | `--ground` | `--ground` |
| radius | `--r-win` 15, all four bound to `radius/window` | same |
| shadow | `0 30px 70px -30px #000000B2`, `0 8px 20px -12px #00000080` (style `Shadow/Window/Night`) | `0 24px 60px -28px #121432 @.42`, `0 6px 16px -10px #121432 @.24` (style `Shadow/Window/Day`) ‡ |

‡ Day frame shadow read off `Dashboard — Day` (202:236), which carries these values inline; not re-read on
this page. Night values were read directly off 485:491.

**No sidebar, no topbar, no content frame.** The onboarding window is chrome + one sheet.

## 2. Layer stack (Night shell 485:491, bottom → top)

```
0  ambient-a       ELLIPSE  -686.4,-438.6  1584x946   fill --ambient-a   LAYER_BLUR 160
1  ambient-b       ELLIPSE   594,387       1452x946   fill --ambient-b   LAYER_BLUR 160
2  clouds          FRAME     0,0           1320x860   op 0.68  clip  12 children
3  veil            RECT      0,0           1320x860   fill --ground-veil  paint-op 0.18
4  page recess     RECT      0,0           1320x860   fill --ground-veil  paint-op 0.24
5  window lights   AL-H      12,14          62x16
6  panel           AL-V      140,120      1040x640
7  Mr. Bell        INSTANCE  56,616        160x160
```

`clouds` = `pattern 1` (IMAGE, rot -175.14, op 0.76, HARD_LIGHT) → `sky` (RECT 1320x520, linear
gradient 90deg `#4D548C @.34` → `@0`, **RAW**) → five `base`/`highlight` pairs. Full lobe geometry is
already dumped in `~/.bell-ref/night-bg.md` (Night) and `~/.bell-ref/day-bg.md` (Day) — reuse verbatim,
it is identical here.

**Day shell differences:** `veil` and `page recess` do not exist (`ground/veil` resolves to
`#FFFFFF @ alpha 0` in Day, so both layers were deleted rather than zeroed), and Day adds
`blue_orb 1` RECT -47,-24 1636x924 op 0.46 blend DARKEN above `clouds`.

## 3. Panel — the shared sheet

`AUTO_LAYOUT` VERTICAL · **1040x640 at (140,120)** · FIXEDxFIXED · `padding 48` all sides ·
`itemSpacing 32` · `primaryAxisAlignItems MIN` · `counterAxisAlignItems MIN`.

| prop | value |
|---|---|
| fill | `--card` (**not** `--glass` — a sheet this size in chrome glass reads muddy) |
| border | 1px `--card-brd`, INSIDE |
| radius | `--r-panel` 16 |
| effects | `BACKGROUND_BLUR 26` → CSS `backdrop-filter: blur(13px)` · `DROP_SHADOW 0 12px 20px` Night `#05060c @.34` / Day `#181a34 @.12` |

```
panel 1040x640 @ (140,120)
+--48--------------------------------------------------------------------48--+
|  rail row            944 x 13   FILLxHUG   H  center                       |
|  [44x6][6][44x6][6][44x6][6][44x6]  <--strut flex:1-->  "Step 1 of 4"      |
|                              gap 32                                        |
|  body                944 x 429  FILLxFILL  V   (per-step, section 5)       |
|                              gap 32                                        |
|  actions             944 x 38   FILLxHUG   H  justify-end  align CENTER    |
|                                            [ Back 34 ]  [ Continue 38 ]    |
+----------------------------------------------------------------------------+
```

Height closes exactly: `640 − 48 − 48 = 544`; `544 − 13 − 32 − 38 − 32 = 429`.
On **05 Building** the Continue button is Secondary (34 tall), so `body` grows to **433** and content
stays optically centred. Nothing else changes.

### 3.1 rail row

`rail row` AL-H, FILLxHUG, `itemSpacing 0`, `counterAxisAlignItems CENTER`, clip on. Three children:

| child | type | size | notes |
|---|---|---|---|
| `rail` | AL-H HUGxHUG, gap 6 | 182x6 | four segments |
| `seg 1..4` | RECT | 44x6 each | radius **RAW 3** |
| `strut` | FRAME | flex:1 x 1px | no fill, `layoutGrow 1` |
| `step` | TEXT | hug | Body/Meta `--ink-3`, right end of the row |

Segment fill: lit = `--accent` at paint-op 1; unlit = `--hair` at paint-op **0.14 Night / 0.11 Day**
(which is exactly what `--hair` already resolves to per mode, so in CSS just use `--hair`).

Row height 13 comes from the 11px Body/Meta line box, not from the 6px segments.

### 3.2 Rail + step state machine — 4 segments, 6 screens

| screen | seg1 | seg2 | seg3 | seg4 | `step` text |
|---|---|---|---|---|---|
| 01 Name | accent | hair | hair | hair | `Step 1 of 4` |
| 02 Board | accent | accent | hair | hair | `Step 2 of 4` |
| 03 Subjects | accent | accent | accent | hair | `Step 3 of 4` |
| 04 Plan | accent | accent | accent | accent | `Step 4 of 4` |
| 05 Building | accent | accent | accent | accent | `Setting up` |
| 06 Ready | accent | accent | accent | accent | `All set` |

05 and 06 are outside the counted flow: all four segments filled, and the label switches from
"Step N of 4" to a status word. Do not add a fifth or sixth segment.

### 3.3 actions row

`actions` AL-H, FILLxHUG, `itemSpacing 12`, `primaryAxisAlignItems MAX` (justify-end),
`counterAxisAlignItems CENTER` — the centring is load-bearing: Primary is 38 tall and Secondary 34,
so without it the two buttons sit on different baselines.

| screen | Back | Continue |
|---|---|---|
| 01 Name | hidden | Primary · `Continue` · **no icon** · 94x38 |
| 02 Board | Secondary `Back` 60x34 | Primary · `Continue` · icon `chev` 17:46 16px · 118x38 |
| 03 Subjects | Secondary `Back` 60x34 | Primary · `Continue with 6` · icon `chev` 16px · 160x38 |
| 04 Plan | Secondary `Back` 60x34 | Primary · `Build my library` · icon `check` 17:70 16px · 159x38 |
| 05 Building | hidden | **Secondary** · `Run in the background` · no icon · 171x34 |
| 06 Ready | hidden | Primary · `Open Bell` · icon `ret` 17:89 16px · 38 tall |

Button recipes (component set 22:47):

| variant | fill | border | height | padding-x | gap | radius | label |
|---|---|---|---|---|---|---|---|
| Secondary | `--glass-strong` | 1px `--hair` | 34 | 14 | 8 | `--r-btn` 10 | Body/Strong `--ink` |
| Primary | gradient style `Blue/Primary Button 135`: 135° in Figma, `--bell-cap-lo 0%` → `--bell-cap-mid 70.711%` | none | 38 | 18 | 8 | `--r-btn` 10 | Body/Strong `--white` |

Primary also carries `box-shadow: 0 10px 24px -14px rgba(111,118,242,0.9)` — **RAW**, both modes.

### 3.4 window lights (instance of 41:46)

`AL-H` at **(12,14)**, 62x16, `padding 1`, `itemSpacing 9`, clip on. Three 14x14 discs, radius 7,
fills `--traffic-close` `#ff736a` / `--traffic-minimize` `#febc2e` / `--traffic-zoom` `#19c332`.
These do **not** retone in Night — macOS keeps them constant. Glyphs appear on hover only.

### 3.5 Mr. Bell (instance of 374:77)

**160x160 absolute at (56,616)**, i.e. the mascot's own 256px rig at 0.625x. Top of the layer stack,
so it renders **above** the panel.

```
panel x-range 140..1180        Mr. Bell x-range  56..216   -> 76px of overlap on the left edge
panel y-range 120..760         Mr. Bell y-range 616..776   -> 144px overlap, 16px hangs below panel
frame bottom 860                                           -> 84px clear beneath the mascot
```

Shadow (Night, measured): `0 6px 14px rgba(5,6,12,0.38)`, `0 0 28px rgba(44,123,255,0.2)` — both
**RAW**. Day equivalent not read back on this page.

## 4. Shared body primitives

Three recipes recur across steps. Build them once.

**Selectable surface** — used by 02 board cards, 03 subject tiles, 04 rhythm cards:

| state | fill | border | radius |
|---|---|---|---|
| resting | `--ground` paint-op 1 | **1px** `--hair` | 13 |
| selected | `--accent-soft` (0.16 Night / 0.12 Day) | **2px** `--accent` | 13 |

The 1px→2px border swap means the selected card's inner box is 2px narrower on each axis; every
selectable in this screen is FIXED width, so nothing reflows. Do not compensate with padding.

**Input field** — 01 name field and 03 search:

| | fill | border | radius | height |
|---|---|---|---|---|
| 01 `name field` (focused) | `--ground` | **2px `--accent`** (the focus ring) | `--r-btn` 10 | 48 |
| 03 `search` (resting) | `--ground` | 1px `--hair` | `--r-btn` 10 | 40 |

Figma cannot layer a second stroke, so the focus ring *replaces* the resting 1px `--hair` rather than
sitting outside it. In CSS prefer `box-shadow: 0 0 0 2px var(--accent) inset` if you want both.

**Chip** (instance of 21:20) — 32 tall, `padding-x 12`, `itemSpacing 7`, radius `--r-pill`:

| variant | fill | border | label |
|---|---|---|---|
| Default | `--glass-strong` | 1px `--hair` | Body/Chip `--ink-2` |
| Filled (02, A Level) | gradient → right, `rgba(79,195,247,0.4)` → `rgba(106,168,255,0.4)` — style `Board/A Level/Wash`, **RAW** | 1px `rgba(79,195,247,0.9)` — `Board/A Level/Edge`, **RAW** | Body/Chip `--ink` |
| Filled (04, May/June) | gradient → right, `rgba(63,184,79,0.28)` → `rgba(126,212,140,0.28)` — `Season/May-June/Wash`, **RAW** | 1px `rgba(63,184,79,0.7)` — `Season/May-June/Edge`, **RAW** | Body/Chip `--ink` |

Icons inside chips render at **18x18** (down from the 24 box). Icons in tiles/rows render at **16x16**,
except the 03 subject glyph which is **22x22**.

## 5. Step bodies

`body` is always 944 wide, 429 tall (433 on 05), AL-V, `counterAxisAlignItems MIN`, no fill.
`primaryAxisAlignItems` and `itemSpacing` vary — given per step.

### 5.1 — 01 Name

`body` gap **24**, align **CENTER**. Content 187 tall → 121px slack split top/bottom.

```
+-- body 944x429 ------------------------------------------------------------+
|                                                                           |
|  heading            HUGxHUG  V  gap 10                                    |
|    "What should I call you?"        Display/Setup Title  --ink            |
|    "It only shows up in your ..."   Body/Default --ink-2  W=520 FIXED     |
|                          gap 24                                           |
|  name field  420x48  FIXEDxFIXED  H  pad-x 14  gap 2  align CENTER        |
|    "Zohaib"  Body/Default --ink   [caret 2x18 r1 --accent]               |
|                          gap 24                                           |
|  hint  HUGxHUG  H  gap 8  align CENTER                                    |
|    "Press"  [Kbd 52x18 "return"]  "to continue"      Body/Meta --ink-3   |
+---------------------------------------------------------------------------+
```

| child | node (N) | layout | size | notes |
|---|---|---|---|---|
| `heading` | 495:1511 | V HUGxHUG gap 10 | ~520x73 | — |
| `headline` | 495:1512 | TEXT hug | — | Display/Setup Title, `--ink` |
| `sub` | 495:1513 | TEXT **FIXED 520**, autoresize HEIGHT | 520x32 | Body/Default, `--ink-2`; wraps to 2 lines |
| `name field` | 495:1514 | H FIXEDxFIXED, pad-x 14, gap 2, CENTER | 420x48 | fill `--ground`, 2px `--accent`, r `--r-btn` |
| `value` | 495:1515 | TEXT hug | — | Body/Default, `--ink` |
| `caret` | 495:1516 | RECT | 2x18 | radius **RAW 1**, fill `--accent` |
| `hint` | 495:1517 | H HUGxHUG gap 8, CENTER | ~18 tall | — |
| `Kbd` | 495:1519 | INSTANCE 13:4 | 52x18 | `--glass-strong`, 1px `--hair`, radius **RAW 6**, pad 6/2, Mono/Small `--ink-3` |

Day mirrors: `heading` 495:7872, `name field` 495:7875, `hint` 495:7878.

Verbatim copy:
- headline: `What should I call you?`
- sub: `It only shows up in your dashboard greeting, and you can change it whenever you like.`
- field value: `Zohaib` · Kbd key: `return` · hint: `Press` / `to continue`

At 520 the sub rags badly — it breaks to a one-word second line ("like."). Kept at 520 deliberately;
tightening to ~440 balances it if the implementer prefers.

### 5.2 — 02 Board

`body` gap **24**, align **CENTER**. Content 326 tall (57 + 24 + 208 + 24 + 13) → 51.5px top slack.

```
+-- body 944x429 ------------------------------------------------------------+
|  intro  HUGxHUG V gap 10   (560 wide)                                     |
|    "Which qualification are you studying?"   Display/Setup Title --ink     |
|    "This filters the library ..."            Body/Default --ink-2 W=560    |
|                          gap 24                                           |
|  boards  FILLxHUG  H  gap 28   944x208                                    |
|  +-- 296x208 --+ 28 +-- 296x208 --+ 28 +-- 296x208 --+                    |
|  | A Level  *  |    | IGCSE       |    | O Level     |   * = check @262,12|
|  | selected    |    | resting     |    | resting     |                    |
|  +-------------+    +-------------+    +-------------+                    |
|                          gap 24                                           |
|  note  "Studying more than one? ..."   Body/Meta --ink-3  (448 wide)      |
+---------------------------------------------------------------------------+
```

Board card — AL-V, **296x208 FIXEDxFIXED**, `padding 20`, `itemSpacing 12`, align MIN,
radius bound `radius/card` (13):

| # | child | node (A Level) | layout | notes |
|---|---|---|---|---|
| 0 | `chip` | 495:8232 | INSTANCE 21:20, 32 tall | A Level = Filled; IGCSE / O Level = Default |
| 1 | title | 495:8253 | TEXT hug | Title/Card, `--ink` |
| 2 | blurb | 495:8254 | TEXT **FILL** width, autoresize HEIGHT | Body/Small, `--ink-3`; 28 tall / 2 lines |
| 3 | `strut` | 495:8255 | FRAME, `layoutGrow 1`, FILL width | no fill; 26 tall as rendered |
| 4 | `stat` | 495:8256 | AL-H HUGxHUG gap 6, **counterAxis BASELINE** | Mono/Meta `--ink-2` count + Body/Meta `--ink-3` unit |
| — | `check` | 495:8307 | ABSOLUTE **262,12**, 18x18 | A Level only. Icon `check` 17:70, vector **stroke** bound `--accent` |

Cards, verbatim:

| card | chip | title | blurb | stat |
|---|---|---|---|---|
| A Level (selected) | `A Level` | `AS & A Level` | `The two-year route. Papers 1-5, AS and A2 sittings.` | `5,420` + `papers` |
| IGCSE | `IGCSE` | `IGCSE` | `Core and Extended tiers, with all regional variants.` | `6,180` + `papers` |
| O Level | `O Level` | `O Level` | `The traditional syllabus, still sat across South Asia.` | `1,847` + `papers` |

- intro headline: `Which qualification are you studying?`
- intro sub: `This filters the library and the subject list. You can add another qualification later.`
- note: `Studying more than one? Pick the main one now — you can add the rest from Settings.`
  (em dash, U+2014)

`stat` unit is the bare word `papers`, no leading space — `itemSpacing 6` supplies the gap.

Night ids: `intro` 495:8159, `boards` 495:8162, cards 495:8231 / 495:8259 / 495:8283, `note` 495:8163.

### 5.3 — 03 Subjects

`body` gap **20**, align **MIN** (top-aligned — this is the densest screen).
Content 396 tall (53+20+40+20+230+20+13) → **33px slack sits at the bottom**, by design.

```
+-- body 944x429 ------------------------------------------------------------+
|  headline row  FILLxHUG  H  gap 0  align CENTER            944x53         |
|   "Pick your subjects"                       <--strut-->        6        |
|   "Only these appear in your library ..."                   SELECTED     |
|                          gap 20                                          |
|  search  440x40  FIXED  H  pad-x 12  gap 10  CENTER                      |
|   [16px glyph] "Search 34 A Level subjects"                              |
|                          gap 20                                          |
|  grid  FILLxHUG  V  gap 16   944x230                                     |
|   row1  224 16 224 16 224 16 224   = 944                                 |
|   row2  ...                                                              |
|   row3  ...                          each tile 224x66                    |
|                          gap 20                                          |
|  showing row  H gap 6 CENTER: "Showing 12 of 34"  "Show all subjects"    |
+--------------------------------------------------------------------------+
```

`headline row` 494:9162 — AL-H, FILLxHUG, `itemSpacing 0`, align CENTER. Separation comes from the
`layoutGrow: 1` strut, not from a gap.

| child | node | layout | contents |
|---|---|---|---|
| `headline` | 494:9163 | V HUGxHUG gap **6** | Display/Setup Title `--ink` + Body/Default `--ink-2` |
| `strut` | 494:9166 | 1px tall, `layoutGrow 1` | no fill |
| `count` | 494:9167 | V HUGxHUG gap **2**, align **MAX** (right) | Mono/Stat `--accent` `6` + Label/Stat `--ink-3` `selected` |

`search` 495:7862 — 440x40 FIXEDxFIXED, AL-H, `padding-x 12`, `itemSpacing 10`, align CENTER,
fill `--ground`, 1px `--hair`, radius bound `radius/button` (10). Children: 16x16 `search glyph`
(Icon 17:23, vector **stroke** `--ink-3`) then Body/Default `--ink-3` placeholder.

Subject tile — **224x66 FIXEDxFIXED**, AL-H, `padding 14`, `itemSpacing 12`, align CENTER,
radius bound `radius/card` (13):

```
[ subject icon 22x22 ] 12 [ label V gap 2 ] 12 [ strut flex:1 ] 12 [ check 16x16 ]
                              name  Body/Chip --ink                  selected only
                              code  Mono/Small --ink-3
```

Grid contents, in DOM order, verbatim (name / syllabus code / state):

| row | col 1 | col 2 | col 3 | col 4 |
|---|---|---|---|---|
| 1 | **Accounting** 9706 ✓ | **Biology** 9700 ✓ | Business 9609 | **Chemistry** 9701 ✓ |
| 2 | Computer Science 9618 | **Economics** 9708 ✓ | Further Mathematics 9231 | **Mathematics** 9709 ✓ |
| 3 | **Physics** 9702 ✓ | Psychology 9990 | English Language 9093 | Information Technology 9626 |

Six selected (bold ✓) = `--accent-soft` + 2px `--accent` + trailing 16px check.
Six resting = `--ground` + 1px `--hair`, no check (the strut still holds the right gutter).

- headline: `Pick your subjects`
- sub: `Only these appear in your library and your dashboard.`
- count: `6` / `selected` (Label/Stat uppercases via style, string is lowercase)
- search: `Search 34 A Level subjects`
- showing row: `Showing 12 of 34` (`--ink-3`) then `Show all subjects` (`--accent`), gap 6, Body/Meta

No truncation is applied. The two longest names measure 137px ("Information Technology") and 121px
("Further Mathematics") against a 224 tile — neither clips, so do not add ellipsis.

Night ids: `grid` 495:8018, rows 495:8019 / 495:8078 / 495:8117, `showing row` 495:8164.
Day mirrors: 495:8309 (headline row), 495:8317 (search), 495:8320 (grid), 495:8402 (showing row).

### 5.4 — 04 Plan

`body` gap **28**, align **MIN**. Content ~349 tall → ~80px slack at the bottom.

```
+-- body 944x429 ------------------------------------------------------------+
|  intro  HUGxHUG V gap 8   (600 wide)                                      |
|    "When are you sitting these?"      Display/Setup Title --ink            |
|    "Your target session drives ..."   Body/Default --ink-2 W=600 FIXED     |
|                          gap 28                                           |
|  target session  FILLxHUG V gap 12                                        |
|    TARGET SESSION                        Label/Section --ink-2             |
|    [May/June 2027 *] 10 [Oct/Nov 2026] 10 [Feb/March 2027]   32 tall      |
|    "263 days"  "until your first paper — 9 May 2027"      BASELINE row    |
|                          gap 28                                           |
|  weekly rhythm  FILLxHUG V gap 12                                         |
|    WEEKLY RHYTHM                         Label/Section --ink-2             |
|    +--304x96--+ 16 +--304x96--+ 16 +--304x96--+        = 944              |
|    | Casual   |    | Steady * |    | Intense  |                           |
|    +----------+    +----------+    +----------+                           |
|    "This is what counts as a day in your streak. ..."   Body/Meta --ink-3 |
+---------------------------------------------------------------------------+
```

| child | node (N) | layout | notes |
|---|---|---|---|
| `intro` | 494:7930 | V HUGxHUG gap **8** | sub is TEXT **FIXED 600**, autoresize HEIGHT, one line |
| `target session` | 494:7933 | V FILL(944)xHUG gap 12 | 3 children |
| eyebrow | 494:7934 | TEXT hug | Label/Section `--ink-2`; style uppercases, string stays lowercase |
| `session chips` | 494:8521 | H HUGxHUG gap **10** | 3 Chip instances, each with an 18x18 Season Icon |
| `countdown` | 494:8581 | H HUGxHUG gap **8**, **counterAxis BASELINE** | Mono/Stat `--ink` + Body/Small `--ink-3` |
| `weekly rhythm` | 494:7935 | V FILL(944)xHUG gap 12 | 3 children |
| eyebrow | 494:7936 | TEXT hug | Label/Section `--ink-2` |
| `rhythm cards` | 494:9170 | H FILL(944)xHUG gap **16** | three **FIXED 304** cards |
| streak note | 494:9189 | TEXT hug | Body/Meta `--ink-3` |

Season chips (component set 102:15, glyph = the season code the data uses, boxed):

| chip | icon variant | state | label |
|---|---|---|---|
| 102:6 | `s` | Filled (green wash) | `May/June 2027` |
| 102:10 | `w` | Default | `Oct/Nov 2026` |
| 102:14 | `m` | Default | `Feb/March 2027` |

Code and close affordances are hidden on all three.

Rhythm card — **304x96 FIXEDxFIXED**, AL-V, `padding 16`, `itemSpacing 6`, radius **RAW 13** (not
bound), order name → count row → estimate:

| card | name (Body/Strong `--ink`) | count (Mono/Stat `--ink`) | unit | estimate (Body/Meta `--ink-3`) | state |
|---|---|---|---|---|---|
| 494:9171 | `Casual` | `2` | `papers a week` | `about 20 minutes a day` | resting |
| 494:9177 | `Steady` | `4` | `papers a week` | `about 45 minutes a day` | **selected** |
| 494:9183 | `Intense` | `7` | `papers a week` | `about 80 minutes a day` | resting |

The in-card `count` row is AL-H gap 6, `counterAxisAlignItems BASELINE`, so the 19px Geist Mono
number sits on the same baseline as the 12px "papers a week".

- intro headline: `When are you sitting these?`
- intro sub: `Your target session drives the countdown on your dashboard and how your papers are paced.`
- eyebrows: `target session` · `weekly rhythm`
- countdown: `263 days` + `until your first paper — 9 May 2027` (em dash)
- streak note: `This is what counts as a day in your streak. Change it any time from Settings.`

Card content hugs to 98px against the pinned 96, so the effective bottom padding is 14 not 16.
`clipsContent` is false on the cards, so nothing is cut. Keep 96.

### 5.5 — 05 Building

`body` gap **24**, align **CENTER**, and it is **433 tall** here (see §3). Content 166 tall; heading
starts at y=134 inside `body`. This screen is a wait, not a question — Back is hidden.

```
+-- body 944x433 ------------------------------------------------------------+
|  heading  HUGxHUG V gap 10  (560 wide)                                    |
|    "Building your library"          Display/Setup Title --ink              |
|    "Downloading and indexing ..."   Body/Default --ink-2 W=560 FIXED       |
|                          gap 24                                           |
|  block progress  HUGxHUG H gap 4                                  780x10  |
|   ################----------- 17 lit / 11 unlit, 28 blocks total          |
|                          gap 24                                           |
|  status  FILLxHUG H align CENTER                                  944x14  |
|   "9706 Accounting — 412 of 1,284 papers"  <--strut-->        "61%"       |
|                          gap 24                                           |
|  note  "Papers are stored locally, ..."          Body/Meta --ink-3        |
+---------------------------------------------------------------------------+
```

`block progress` 494:9193 — AL-H, HUGxHUG, `itemSpacing 4`. **28** RECTs, each **24x10**, radius
**RAW 2**. Width closes exactly: `28x24 + 27x4 = 672 + 108 = 780`.

| blocks | node range | fill |
|---|---|---|
| 1–17 (lit) | 494:9194 … 494:9210 | `--accent` paint-op 1 |
| 18–28 (unlit) | 494:9211 … 494:9221 | `--hair` at 0.14 Night / 0.11 Day |

`status` 495:7867 — AL-H, FILLxHUG (944), align CENTER: Mono/Small `--ink-3` left, 1px `strut` with
`layoutGrow 1` and no fill, Mono/Small `--ink-2` right. The row runs the full 944 even though the bar
stops at 780, so `61%` lands on the same right-hand column as the `step` label and the button — read
it as an intentional gutter, not a stray number.

- headline: `Building your library`
- sub: `Downloading and indexing every past paper for your six subjects. This happens once.`
- status left: `9706 Accounting — 412 of 1,284 papers` (em dash)
- status right: `61%`
- note: `Papers are stored locally, so the library works offline once this finishes.`

Night ids: `heading` 494:9190, `status` 495:7867, `note` 495:7871. Day body 494:8192.

### 5.6 — 06 Ready

`body` gap **28**, align **CENTER**. Content 288 tall → 70.5px top slack.
This screen alone adds a third panel effect: `INNER_SHADOW` offset (0,1), radius 0, spread 0 —
Night `rgb(106,168,255) @ .08`, Day `rgb(20,54,200) @ .08`. Both **RAW**. It reads as a 1px top
light-line on the sheet.

```
+-- body 944x429 ------------------------------------------------------------+
|  headline  281x57  HUGxHUG V gap 10                                       |
|    "You're set, Zohaib."     Display/Setup Title --ink                     |
|    "Here is what I have. ..." Body/Default --ink-2                         |
|                          gap 28                                           |
|  summary  560x162  FIXEDxHUG  V  pad 20  gap 0                            |
|  +--------------------- 520 wide rows -----------------------+            |
|  | [16] 12 qualification    12 AS & A Level — 6 subjects     | pad-y 12   |
|  |------------------------ 1px --hair-2 ---------------------|            |
|  | [16] 12 target session   12 May/June 2027 — 263 days away | pad-y 12   |
|  |------------------------ 1px --hair-2 ---------------------|            |
|  | [16] 12 your rhythm      12 4 papers a week               | pad-y 12   |
|  +----------------------------------------------------------+            |
|                          gap 28                                           |
|  footnote  "13,447 papers indexed and ready."   Body/Meta --ink-3         |
+---------------------------------------------------------------------------+
```

`summary` 495:8157 — **560 FIXED x HUG (162)**, AL-V, `padding 20`, `itemSpacing 0`, fill `--ground`,
1px `--hair`, radius **RAW 13**. Height closes exactly: `20 + 40 + 1 + 40 + 1 + 40 + 20 = 162`.

Each row: AL-H, **FILL width (520) x HUG**, `padding-y 12` (no x padding), `itemSpacing 12`,
`counterAxisAlignItems CENTER` → 40 tall.

| row | node | icon 16x16 | label (Body/Meta `--ink-3`, **FIXED 120**) | value (Body/Strong `--ink`, hug) |
|---|---|---|---|---|
| 1 | 495:8167 | `book` | `qualification` | `AS & A Level — 6 subjects` |
| — | 495:8173 | separator RECT, FILL width x **1px**, fill `--hair-2` | | |
| 2 | 495:8174 | `clock` | `target session` | `May/June 2027 — 263 days away` |
| — | 495:8180 | separator RECT, FILL width x **1px**, fill `--hair-2` | | |
| 3 | 495:8181 | `focus` | `your rhythm` | `4 papers a week` |

The 120px fixed label column is what aligns the three values. Icons are Icon-set instances resized
24→16 with their vector **strokes** bound to `--accent`.

- headline: `You're set, Zohaib.` — **straight** apostrophe U+0027, not a typographic one
- sub: `Here is what I have. Any of it can change later.`
- footnote: `13,447 papers indexed and ready.`

Values use Body/Strong, not any Mono style, even though they contain numbers.
Night ids: `headline` 495:8154, `footnote` 495:8158. Day body 494:8839, summary 495:8484.

## 6. Arithmetic that must close

| sum | check |
|---|---|
| panel content height | `640 − 96 = 544`; `544 − 13 − 32 − 38 − 32 = 429` body |
| 05 body | Secondary button 34 → `544 − 13 − 32 − 34 − 32 = 433` |
| 02 boards | `3x296 + 2x28 = 944` |
| 03 grid | `4x224 + 3x16 = 944` per row; `3x66 + 2x16 = 230` tall |
| 04 rhythm | `3x304 + 2x16 = 944` |
| 05 bar | `28x24 + 27x4 = 780` |
| 06 summary | `560 − 40 = 520` rows; `20 + 3x40 + 2x1 + 20 = 162` |

## TRAPS

1. **Panel fill is `--card`, not `--glass`.** A 1040x640 sheet in chrome glass reads muddy. It still
   carries `BACKGROUND_BLUR 26`, so it *is* translucent — just over a card tone.
2. **Figma blur 26 → CSS `blur(13px)`.** Figma's background-blur radius is ~2x the CSS value. Do not
   write `backdrop-filter: blur(26px)`.
3. **The rail has 4 segments but the flow has 6 screens.** 01–04 are "Step N of 4"; 05 is
   "Setting up" and 06 "All set", both with all four segments lit. Never render 5 or 6 segments.
4. **`counterAxisAlignItems: CENTER` on `actions` is not cosmetic.** Primary is 38 and Secondary 34.
   Drop the centring and Back/Continue sit on different baselines.
5. **Mr. Bell is above the panel in z-order** and hangs 76px past its left edge and 16px below its
   bottom. If your panel is a stacking context with `overflow: hidden`, the mascot gets clipped.
6. **`page recess` here is full-frame (1320x860)**, not the Dashboard's `238,56 1082x804` — there is
   no sidebar or topbar to inset around.
7. **Day has no `veil` and no `page recess` layers at all.** `ground/veil` is `#FFFFFF @ alpha 0` in
   Day, so both were deleted. Do not emit zero-alpha overlays; emit nothing.
8. **`get_design_context` on a sub-node resolves variables in the file's *default* (Day) mode.**
   Reading the Night panel returns `--card` fallback `#f6f7fc` while its drop shadow correctly reads
   `rgba(5,6,12,0.34)`. Trust the token names and the per-mode table, never the inline hex fallbacks.
9. **Radius binding is inconsistent.** Bound to `radius/card`: 02 board cards, 03 subject tiles.
   Raw `13`: 04 rhythm cards, 06 summary. Raw values with no token at all: rail seg `3`, 05 block `2`,
   Kbd `6`, 01 caret `1`. Reproduce the numbers; don't invent tokens for them.
10. **The 02 check icon sits at (262,12), not (264,14).** 18x18, absolutely positioned inside the
    296x208 card — i.e. 16px from the card's right edge and 12 from the top, which is *not* the
    card's own 20px padding.
11. **Icons in this file are stroked, not filled.** `Icon` (17:119) and `Subject Icon` (47:81)
    vectors carry a 1.75 ROUND stroke and `fills: []`. Recolour the **stroke**. In CSS this means
    `stroke: currentColor; fill: none`.
12. **Icon sizes vary by context:** 22x22 in 03 subject tiles, 18x18 inside chips and on the 02
    check, 16x16 in 03 search / 03 tile checks / 06 summary rows / Primary buttons.
13. **The `ret` glyph (17:89) used by 06's Continue has two vectors** and the Button component only
    overrides the first to white — the second stays bound to `--ink-2`, so on Day the arrow shaft
    renders dark navy on blue and vanishes. Colour **both** vectors white.
14. **01's Continue has no leading icon** (94x38, label only, verified in both modes) while 02/03/04/06
    do. The shell template ships `Show Icon = true` with a `chev`, which renders a **downward**
    chevron on a "Continue" button — wrong, and already dropped on 01. Prefer no leading chevron
    anywhere; keep `check` on 04 and `ret` on 06.
15. **The only genuinely unbound paints** are the chip gradient styles (`Board/A Level/Wash|Edge`,
    `Season/May-June/Wash|Edge`), the Primary button's iris glow shadow, the `sky` gradient, the 06
    inner shadow, and Mr. Bell's two shadows. Everything else is a token.
16. **05's `status` row is 944 wide while the bar above it is 780.** Intentional: `61%` right-aligns
    with the `step` label and the button. Do not shrink the row to the bar.
17. **04's rhythm card content hugs to 98 inside a pinned 96**, giving an effective 14px bottom
    padding. `clipsContent` is false so nothing cuts. Keep the pinned 96.
18. **Selected surfaces jump 1px→2px border.** Every selectable is FIXED width so nothing reflows;
    in CSS use an inset box-shadow ring if you want to avoid the box-model shift.
19. **The clouds layer is animated** (five base/highlight pairs drift). Motion specs live on
    `Motion — Startup` (391:2) and `Motion — Mr. Bell` (331:289), not on this page. Not measured here.
20. **`Label/Section` and `Label/Stat` uppercase via the text style**, and the stored strings are
    lowercase (`target session`, `selected`). Use `text-transform: uppercase`, don't retype the copy.





