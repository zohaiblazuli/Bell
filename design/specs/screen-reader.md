# Screen — Reader (measured spec)

Figma page **`194:35` "Screen — Reader"** (previously unknown — see the hunt log at the bottom).

| composition | node | x,y | size |
|---|---|---|---|
| Reader — Night | `194:36` | 0, 0 | 1320 x 860 |
| Reader — Day | `202:734` | 1400, 0 | 1320 x 860 |

Both are plain FRAMEs, `clipsContent: true`, radius `--r-win` (15), fill `--ground`.
Window shadow: Night = `Shadow/Window/Night` → `0 8 20 -12 #00000080`, `0 30 70 -30 #000000b2`.
Day = `Shadow/Window/Day` → `0 6 16 -10 rgba(18,20,50,.24)`, `0 24 60 -28 rgba(18,20,50,.42)`.

Geometry, structure, type and every token are **identical between Day and Night** except the
background stack and the tone pill (§9). Everything below is absolute-positioned inside the
1320x860 frame unless a layout mode is given.

---

## 1. THE ANNOTATION INK — the answer you were after

`annotations` (`200:89` Night / `202:1039` Day) is a 500 x 707 frame at 0,0 **inside `paper`**,
`fills: []`, `clipsContent: false`. Five children, all variable-bound, **no blend modes — every
one is `NORMAL`**, and all opacity is *node* opacity (not paint opacity).

| # | node (Night id) | kind | x, y | w x h | token | Night hex | Day hex | opacity | stroke |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `200:90` highlighter swipe | rect r2 | 60, 150 | 300 x 13 | `--iris-3` | `#1436C8` | `#1436C8` | **0.32** | — (fill) |
| 2 | `200:91` highlighter swipe | rect r2 | 60, 167 | 214 x 13 | `--d2` | `#FFAE33` | `#9E5200` | **0.30** | — (fill) |
| 3 | `200:92` pen ring | ellipse | 70, 248 | 122.639 x 29.185 | `--d5` | `#FF4D6A` | `#A5103A` | 1 | 1.75, no fill |
| 4 | `200:93` pen mark (tick) | vector | 408, 250 | 27 x 19 | `--d5` | `#FF4D6A` | `#A5103A` | 1 | **2**, ROUND cap+join |
| 5 | `200:94` pen mark (scribble) | vector | 296, 470 | 100 x 8.576 | `--iris-1` | `#6AA8FF` | `#6AA8FF` | 1 | 1.75, ROUND cap+join |

`pen ring` is an ellipse rotated **-1.5°** (that is why its bbox height is 29.185, not 26).
Path data, exported at Night: tick `M408 259 C411 263 414 267 417 269 C422 262 428 254 435 250`;
scribble `M296 476.868 C308 464.868 320 488.868 334 472.868 C344 462.868 352 482.868 366 474.868
C376 468.868 384 480.868 396 470.868`.

### Verdict against the app's hard-coded literals

| app constant | app value | Figma equivalent | match? |
|---|---|---|---|
| `PEN_COLOR` | `#2f4bbf` | pen = `--d5` (`#FF4D6A` / `#A5103A`); the only blue pen ink is the scribble at `--iris-1` `#6AA8FF` | **NO** |
| `HL_COLOR` | `#e8b248` | highlighter = `--iris-3` `#1436C8` @32% and `--d2` (`#FFAE33` / `#9E5200`) @30% | **NO** |

Figma moved both. Nothing on this page is `#2f4bbf` or `#e8b248`. The design now treats pen and
highlighter as *user-chosen ink from a 6-swatch palette* (§7), not as two constants — so the
literals on disk are a legacy of the pre-palette build, and every saved annotation carries them.

### The ink palette (`tools` card, `198:32`)

Six 22px swatches, HORIZONTAL, gap 11. Selected = `iris/3`, marked by a **1.5px ring in `--ink`**
(white in Night, `#1B1D27` in Day) drawn outside the disc (`inset -6.82%`).

| slot | node | token | Night | Day |
|---|---|---|---|---|
| 1 (selected) | `198:33` | `--iris-3` | `#1436C8` | `#1436C8` |
| 2 | `198:34` | `--iris-1` | `#6AA8FF` | `#6AA8FF` |
| 3 | `198:35` | `--iris-2` | `#2C7BFF` | `#2C7BFF` |
| 4 | `198:36` | `--d2` | `#FFAE33` | `#9E5200` |
| 5 | `198:37` | `--d5` | `#FF4D6A` | `#A5103A` |
| 6 | `198:38` | `--page-ink` | `#1A1C24` | `#1A1C24` |

### The "done" marker

There are three distinct things called `done`; do not conflate them.

| where | node | form | token | Night | Day |
|---|---|---|---|---|---|
| Questions rows Q1-Q3 | `198:58` / `198:64` / `198:70` | 13px check glyph, stroke 1.75, no fill | `--iris-3` | `#1436C8` | `#1436C8` |
| Exam-timer meter, filled part | `197:29` | flex `31` of a 4px r999 bar | `--accent` | `#6AA8FF` | `#1436C8` |
| Tools opacity meter, filled part | `198:48` | flex `45` of a 4px r999 bar | `--iris-3` | `#1436C8` | `#1436C8` |

The row check is mode-invariant `#1436C8`, which on the Night card (`#24273ae5`) is a very dark
blue — see TRAPS.

---

## 2. Layout map

```
 0                    140                    346          846        1052        1320
 +----------------------------------------------------------------------------------+ 0
 | topbar  194:731   1320 x 52   glass + 1px hair all round, backdrop-blur 13, clip |
 +----------+--------------------------------------------------+--------------------+ 52
 |          |                                                  |                    |
 | page     |            (page recess 140,52 912x808)          |  tool panel        |
 | rail     |          +----------------------------+          |  194:733           |
 | 194:732  |          | paper 194:741  346,72      |          |  1052,52  268x808  |
 | 140x808  |          |        500 x 707  r3       |          |  VERTICAL gap 16   |
 | glass    |          |  doc 200:30 + annotations  |          |  pad 18            |
 | blur 13  |          |            200:89          |          |  [exam timer]      |
 |          |          +----------------------------+ 779      |  [tools]           |
 |          |                                                  |  [questions]       |
 |          |        +--------------------------+ 796          |                    |
 |          |        | tool bar 201:30  410,796 |              |                    |
 +----------+--------+--------------------------+--------------+--------------------+ 860
```

No sidebar, no `mascot`, no `Nav Item` anywhere on this screen. No mark-scheme side sheet either —
the mark scheme is present only as a `badge` in the topbar (§3).

## 3. Background stack

Identical recipe to every other screen composition. Night:

| z | node | kind | x, y | w x h | paint / notes |
|---|---|---|---|---|---|
| 0 | `194:37` ambient-a | ellipse | -686.4, -438.6 | 1584 x 946 | `--ambient-a` |
| 1 | `194:38` ambient-b | ellipse | 594, 387 | 1452 x 946 | `--ambient-b` |
| 2 | `194:39` clouds | frame, clip | 0, 0 | 1320 x 860 | **node opacity 0.68** |
| 2a | `194:40` | frame | -90, -135 | 1631.426 x 1145.153 | rotate **175.14°**, `mix-blend-mode: hard-light`; child `pattern 1` 1550.788 x 1017.396 @ opacity 0.76, raster PNG, `object-fit: cover` |
| 2b | `194:41` sky | rect | 0, 0 | 1320 x 520 | linear-gradient to bottom `rgba(77,84,140,.34)` → `rgba(77,84,140,0)` |
| 2c | `194:42` / `194:49` | base / highlight | -170,-40 / -219.8,-73 | 1660 x 330 | paint opacity 27% / 52% |
| 2d | `194:56` / `194:61` | base / highlight | -240,300 / -264.6,258 | 820 x 420 | 27% / 52% |
| 2e | `194:66` / `194:71` | base / highlight | 760,210 / 736,163 | 800 x 470 | 27% / 52% |
| 2f | `194:76` / `194:83` | base / highlight | -120,590 / -167.4,550 | 1580 x 400 | 27% / 52% |
| 2g | `194:90` / `194:94` | base / highlight | 330,120 / 311.4,90 | 620 x 300 | 27% / 52% |
| 3 | `194:98` veil | rect | 0, 0 | 1320 x 860 | `--ground-veil`, **paint opacity 18%** |
| 4 | `194:99` page recess | rect | 140, 52 | 912 x 808 | `--ground-veil`, **paint opacity 24%** |

Day replaces layers 3-4 with one raster and drops the recess entirely:

| z | node | x, y | w x h | notes |
|---|---|---|---|---|
| 2 | `207:1794` clouds | 0, 0 | 1320 x 860 | **node opacity 1.0** (Night is 0.68) |
| 2b | `207:1795` sky | 0, 0 | 1320 x 520 | `rgba(140,148,199,.16)` → `rgba(140,148,199,0)` |
| 3 | `213:1314` blue_orb 1 | -47, -24 | 1636 x 924 | raster PNG, `mix-blend-mode: darken`, **node opacity 0.46** |
| — | veil / page recess | | | **absent in Day** |

---

## 4. topbar `194:731` — 0,0 1320 x 52

Fill `--glass`, **1px `--hair` stroke on all four sides** (not `border-bottom` like the Library /
Bookmarks / Recent topbars), `backdrop-blur 13`, `clipsContent: true`. Children are absolute, not
auto-layout.

| node | name | x, y | size | spec |
|---|---|---|---|---|
| `194:734` | window lights | 15, 17 | 62 x 16 | `Window Lights` instance; H gap 9, pad 1; 14px discs r7, `--traffic-close/-minimize/-zoom`, glyphs hidden |
| `195:8` | back | 77, 8 | 34 x 34 | Icon Button, `Icon=left` @18, r `--r-btn` |
| `195:15` | title | 123, 16 | hug | H gap 9: `195:16` "Accounting" **Body/Strong** `--ink` · `195:17` "9706 /12" **Mono/Meta** `--ink-2` · `195:18` "·" SF Pro Reg 12 `--ink-3` · `195:19` "May/June 2015" SF Pro Reg 12 `--ink-3` |
| `195:20` | docs | 384, 15 | hug | H gap 6; two badges: fill `--hair-2`, 1px `--hair`, r `--r-chip` (9), pad 8/4, label SF Pro **Medium 10** `--ink-3` — "mark scheme", "report" |
| `235:95` | tone pill | **1090**, 8 | h 34 hug | `--glass-strong` + 1px `--hair`, r `--r-pill`, pl 12 pr 6, H gap 8; `tone icon` 16 (moon), "Night" SF Pro Reg 12 `--ink-2`, `sw` 44 x 24 |
| `195:31` | view settings | 1227, 8 | 34 x 34 | Icon Button, `Icon=sliders` @18 |
| `195:25` | focus mode | 1269, 8 | 34 x 34 | Icon Button, `Icon=focus` @18 |

Day: tone pill is `202:…` "tone Day" at **x 1099** (the shorter word hugs narrower, right edge
stays at 1224), sun icon, "Day".

## 5. page rail `194:732` — 0,52 140 x 808

Fill `--glass`, 1px `--hair` all round, `backdrop-blur 13`, clip. Absolute children.

- `195:38` "PAGES" at 21,17 — **Label/Section** (SF Pro Semibold 11, +6% tracking, uppercase), `--ink-2`.
- `195:39` `thumbs` at 21,45 — **VERTICAL, gap 14, align CENTER, HUG/HUG**. Five entries: pages 3-7.

Each `thumb N` = VERTICAL, gap 6, align CENTER:

| part | size | spec |
|---|---|---|
| `page` | 96 x 136 | fill `--paper`, radius **2**, clip. Inactive: **node opacity 0.72**, no stroke. Active (page 4, `195:44`): opacity 1 + **1.5px `--accent` stroke** |
| `mini` (inside page) | 96 x 136 | VERTICAL gap 4, pad 10 x / 12 y, clip: `title` 44 x 4 r2 `--page-ink-2` → `gap` 6 (full width) → ten `line` rects h **2.5** r1.5 `--page-line`, widths **76, 76, 52, 76, 68, 76, 40, 76, 76, 58** |
| number | hug | **Mono/Small** (Geist Mono Reg 10); `--ink-3`, or `--accent` on the active thumb |

Pages 6 and 7 carry only `title` + `gap` in their mini (no lines).

## 6. paper `194:741` — 346,72 500 x 707

Fill `--paper`, radius **3**, `clipsContent: true`, shadow `0 2 6 0 rgba(0,0,0,.30)` +
`0 8 28 -4 rgba(0,0,0,.45)` (raw effects, identical in both modes — not a shadow *style*).

`doc` `200:30` fills it: VERTICAL, gap 0, pad **34 x / 30 y**, clip, FIXED 500 x 707.

```
head 200:31   V gap 3
  200:32  "Cambridge International AS & A Level"   SF Pro Regular 7.5   --page-ink-2
  200:33  "ACCOUNTING"                            SF Pro Semibold 13   --page-ink
  200:34  "9706/12    Paper 1  Multiple Choice    May/June 2015"
                                                  Geist Mono Reg 8     --page-ink-2
rule 200:35   h1 full width   --page-line
gap  200:36   h20
Q4   200:37 ─┐  H gap 12, full width
Q5   200:57  │  number  Geist Mono SemiBold 10  --page-ink  w14
Q6   200:76 ─┘  body    V gap 10, FILL
gap  h22 between questions
```

Question body internals — the mock paper is abstracted, **no lorem text**: every text line is a
rounded rect. `stem` lines are direct children of `body`, h **6**, r **3**, `--page-line`.
`options` is a nested VERTICAL frame, gap 9, `pl 16 pt 6`; each `option` is H gap 9 with a 5px
`bullet` then one line rect h6 r3 `--page-line`.

| question | stem line widths | option line widths |
|---|---|---|
| Q4 `200:37` | 396, 396, 262 | 168, 196, 152, 180 |
| Q5 `200:57` | 396, 330 | 186, 158, 204, 142 |
| Q6 `200:76` | 396, 396, 210 | 172, 150 |

`bullet` = 5px ring, stroke `--page-line` (`#1A1C24` @ 0.14, mode-invariant).

`annotations` `200:89` is the last child of `paper` — it paints **over** `doc`. See §1.

## 7. tool panel `194:733` — 1052,52 268 x 808

Fill `--glass`, 1px `--hair` all round, `backdrop-blur 13`, clip.
**VERTICAL, gap 16, pad 18, align START.** Three cards, each `w: FILL`, `h: HUG`, fill `--card`,
1px `--card-brd`, radius `--r-card` (13), clip. No card shadow on these three.

### 7a. `exam timer` `197:19` — pad 16, V gap 13

| row | node | layout | content |
|---|---|---|---|
| head | `197:20` | H gap 7, FILL | "EXAM TIMER" **Label/Section** `--ink-2` · spacer (FILL, h1) · `running` 6px dot `--accent` · "running" SF Pro **Medium 10** `--accent` |
| readout | `197:25` | V gap 4, FILL | `197:26` "01:12:38" **Geist Mono SemiBold 32, letterSpacing -1px** `--ink`; `197:27` "of 1h 45m  ·  32m 22s elapsed" SF Pro Reg 11 `--ink-3` |
| meter | `197:28` | H, FILL, h **4**, r 999, fill `--hair`, clip | `197:29` done `layoutGrow 31` `--accent` · `197:30` rest `layoutGrow 69` (no fill) |
| controls | `197:31` | H gap 8, FILL | Pause button + reset |
| pace | `197:45` | H gap 7, FILL | 5px dot **`--d1`** (`#FFD24A` Night / `#8F6300` Day) · "On pace  ·  question 4 of 7" SF Pro Reg 11 `--ink-2` |

`Pause` `197:32` = `Button` **Variant=Primary**: FILL width, h 38, r `--r-btn`, px 18, H gap 8,
`linear-gradient(166.476839349584deg, var(--bell-cap-lo) 0%, var(--bell-cap-mid) 70.711%)`,
shadow `0 10 24 -14 rgba(111,118,242,.9)`, icon 16, label **Body/Strong** in `#ffffff`.
This is the one sanctioned iris fill on the screen. `197:39` reset = Icon Button 34 x 34.

### 7b. `tools` `198:27` — pad 16, V gap 13

| row | node | layout | content |
|---|---|---|---|
| head | `198:28` | H gap 7, FILL | "TOOLS" **Label/Section** `--ink-2` · spacer · "Highlighter" SF Pro Medium 11 `--ink-2` |
| colours | `198:32` | H gap 11, FILL | the six 22px ink swatches of §1 |
| stroke width | `198:39` | H gap 13, FILL | 5px dot `--ink-3` · 8px dot **`--accent`** (selected) · 12px dot `--ink-3` · spacer · "8 px" Geist Mono Reg 10 `--ink-3` |
| opacity | `198:45` | H gap 10, FILL | "Opacity" SF Pro Reg 11 `--ink-3` **w 50** · meter FILL h4 r999 `--hair` with done `layoutGrow 45` **`--iris-3`** + rest 55 · "45%" Geist Mono Reg 10 `--ink-3` **w 32** |

### 7c. `questions` `198:51` — pad 14, V gap 0

`head` `198:52`: H gap 7, `pb 8` — "QUESTIONS" **Label/Section** `--ink-2` · spacer ·
"4 / 7" Geist Mono Reg 10 `--ink-3`.
Seven rows `198:56 … 198:89`, each H gap 9, `py 6`, FILL:

| row | label token (Geist Mono Reg 11, w 24) | marker | time (Geist Mono Reg 10) |
|---|---|---|---|
| Q1 / Q2 / Q3 | `--ink-2` | 13px check, stroke `--iris-3` 1.75 | `--ink-2` — 4:12 / 6:40 / 5:08 |
| Q4 (current) | `--accent` | 7px filled dot `--accent` | `--ink-2` — 3:22 |
| Q5 / Q6 / Q7 | `--ink-3` | 7px ring, stroke `--hair` 1.5 | `--ink-3` — "—" |

Row order: label · marker · spacer (FILL, h1) · time.

## 8. floating `tool bar` `201:30` — 410,796, HUG

`--glass-strong` + 1px `--hair`, radius `--r-pill`, **backdrop-blur 12** (not 13),
pad 8, H gap 14, align CENTER, clip, shadow `0 8 24 -4 rgba(0,0,0,.42)`.

```
[ pen | highlighter | eraser ] │ [ undo | redo ] │ [ ‹ | 4 / 16 | › ]
   group 201:31  H gap 4         group 201:52      group 201:66  H gap 4
```

- Buttons are 34 x 34, r `--r-btn`, icon 18. **Only `highlighter` `201:38` is active**: fill `--accent-soft`. `pen` and `eraser` have no fill.
- `sep` `201:51` / `201:65`: 1 x 20, fill `--hair`.
- `201:72` "4 / 16" **Mono/Small** `--ink-2`. `next page` `201:73` is the `left` icon **rotated 180°**.

## 9. Day ↔ Night delta, complete

| thing | Night | Day |
|---|---|---|
| frame fill `--ground` | `#111219` | `#e7e9f2` |
| window shadow | `0 8 20 -12 #00000080`, `0 30 70 -30 #000000b2` | `0 6 16 -10 rgba(18,20,50,.24)`, `0 24 60 -28 rgba(18,20,50,.42)` |
| background | `clouds` @ 0.68 + `veil` 18% + `page recess` 24%; sky `rgba(77,84,140,.34)` | `clouds` @ 1.0 + `blue_orb 1` darken 46%; sky `rgba(140,148,199,.16)`; **no veil, no recess** |
| `--glass` | `rgba(32,34,48,.52)` | `rgba(255,255,255,.58)` |
| `--glass-strong` | `rgba(38,40,58,.70)` | `rgba(255,255,255,.74)` |
| `--hair` / `--hair-2` | `#ffffff24` / `#ffffff17` | `#181a341c` / `#181a3412` |
| `--card` / `--card-brd` | `#24273ae5` / `#ffffff29` | `#f6f7fc` / `#181a3417` |
| `--accent` / `--accent-soft` | `#6aa8ff` / `rgba(106,168,255,.16)` | `#1436c8` / `rgba(20,54,200,.12)` |
| tone pill | x **1090**, moon, "Night" | x **1099**, sun, "Day" |
| annotation ink | see §1 | see §1 |

Everything else — every x/y/size/gap/pad/radius/font/letter-spacing — is byte-identical.

## 10. TRAPS

1. **The app's `PEN_COLOR` / `HL_COLOR` literals are both wrong against this file.** Figma has no `#2f4bbf` and no `#e8b248` anywhere on the Reader. Migrating saved annotations means remapping the two literals onto the 6-swatch palette; there is no 1:1 successor for either.
2. **Highlighter opacity lives on the node, not the paint.** 0.32 and 0.30 are node opacity with `blendMode: NORMAL`. Do **not** reach for `multiply` — the design deliberately does not use it, so a CSS `mix-blend-mode: multiply` highlighter will read darker than the mock.
3. **Two highlighter swipes use different tokens** (`--iris-3` blue and `--d2` amber). It is not one ink drawn twice; it is a demonstration that ink is user-chosen.
4. **`pen ring` is a rotated ellipse (-1.5°)**, so its measured bbox (122.639 x 29.185) is not its unrotated size (122.63 x 26 at 70,248). Build it as `width:122.63; height:26; transform: rotate(-1.5deg)`.
5. **`--iris-1..4` and `--bell-cap-*` do not retone.** The blue scribble is `#6AA8FF` in Day *and* Night, so it is bright ink on white paper in both — intended, but it looks like a mode bug.
6. **The Q1-Q3 `done` check is mode-invariant `#1436C8`** on a `#24273ae5` Night card. Contrast is poor and it will look near-black in Night. If that is a bug, it is a bug in the design, not in your port — flag it rather than silently switching to `--accent`.
7. **`get_design_context` on any sub-node of a Night frame resolves the fallback hexes in DAY.** The explicit Night mode override lives on the top-level frame, and a sub-node request loses it. Trust the token *names* only. `get_variable_defs` on the same sub-node **does** resolve Night correctly — use it to check.
8. **The Reader's `topbar` and `page rail` have a stroke on all four sides**, unlike the Library / Bookmarks / Recent topbar (`border-bottom` only) and sidebar (`border-right` only). Reusing the app's `.topbar` CSS will drop three edges.
9. **`tool bar` blurs at 12px, every other glass surface at 13px.** Probably drift, but it is what is in the file.
10. **There is no mark-scheme sheet on this page.** The brief called for one; the file ships a `badge mark scheme` chip in the topbar and a `questions` card instead. Do not invent the sheet.
11. **No sidebar and no Mr. Bell.** The crab is bottom-pinned in the sidebar `mascot` slot on the other screens; the Reader has neither, so nothing to port.
12. **`paper` has `clipsContent: true` but `annotations` has `clipsContent: false`.** The scribble at x 296 + 100 = 396 stays inside 500, so nothing overflows today — but a longer annotation would be clipped by `paper`, not by `annotations`.
13. `clouds` contains a real raster (`pattern 1`, PNG, `hard-light`, opacity 0.76 inside a 0.68 parent, rotated 175.14°) in **both** modes. Day adds a second raster (`blue_orb 1`). Two images, not one.

## 11. Hunt log — how this page was found

`get_metadata` with no `nodeId` lists only the loaded page, and the `<n>:2` page-id convention does
not hold here. Probed and rejected at `<n>:2`: 120, 130, 140, 150, 156, 160, 170, 190, 207,
533-546 (all "node ID was not found"); 155, 219, 250 and `0:2`, `181:560` returned **"invalid node
selection"**, which means *the node exists but is not on a visible page* — these are orphaned main
components left behind when the jester pages were deleted, **not** missing pages. `0:0` is refused
as the document root. `9:1`, `11:1`, `12:1` do not exist (`9:2`, `11:2`, `12:2` are frames, not
canvases). New pages found en route: **`166:2` "Motion — Tone"**; page ids for the Foundations /
Getting Started frames are `7:3`, `7:5`, `7:2`.
The three screens were resolved by grepping this machine's Claude Code transcripts
(`C:\Users\Evo\.claude\projects\C--Users-Evo\*.jsonl`) for the canvas names, which yields
`194:35` Reader, `181:367` Bookmarks, `181:723` Recent — all three then confirmed live.




