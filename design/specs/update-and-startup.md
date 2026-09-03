# Update & Startup (measured spec)

Two flows, four artefacts, from **`GnDdYtn8SaQjgmA4SQRCn7`** ("Foolscap — Design System"; app = **Bell**).

| flow | page | artefact | node | size |
|---|---|---|---|---|
| Update | `432:2` | Update Dialog | `437:7` | 420 x 280 |
| Update | `432:2` | Update Notice (3-variant set) | `440:115` | 214 x 30 per variant |
| Startup | `391:2` | `startup` (splash) | `391:3` | 480 x 320, **2000 ms** |
| Startup | `391:2` | `handoff` (splash → app) | `398:3` | 1320 x 860, **900 ms** |

All line heights are Figma **AUTO** = `line-height: normal`. Every colour below is a token from the
Bell vocabulary unless the row says **unbound**. Both motion frames are `loopMode: loop` in Figma;
in the product they are **one-shot** (see TRAPS).

Neither flow exists in `src/` yet — there is no update, splash or mascot component, and
`src/components/Sidebar.tsx` still renders a 26px doc-glyph `.logo` plus a text
`.wordmark` ("Foolscap" / "working name"). The handoff's landing slots must be built first.

---

# PART A — UPDATE (page `432:2`)

## A1. Update Dialog `437:7` — 420 x 280

Root: **FRAME**, VERTICAL auto-layout.

| property | value |
|---|---|
| size | 420 **FIXED** x 280 (280 is exactly the hug sum — see the stack check) |
| layout | VERTICAL, `itemSpacing` **18**, `counterAxisAlignItems: CENTER` |
| padding | top **20**, bottom **24**, left/right **24** |
| fill | `--glass-strong` |
| stroke | 1px `--glass-brd`, INSIDE |
| radius | `--r-panel` (16) |
| shadow | `0 16 40 0 rgba(13,15,38,0.28)` |
| clip | `overflow: clip` |

```
420 ──────────────────────────────────────────────
│ pt 20                                          │
│              ┌────────────┐                    │  Mr. Bell 96x96   y  20
│              │  Mr. Bell  │                    │
│              └────────────┘                    │
│ gap 18                                         │
│           Restart to install v0.5.0            │  Title/Toolbar    y 134
│ gap 18                                         │
│   Bell will close and reopen. Your session     │  Body/Small       y 172
│   and open papers come back exactly as …       │  (2 lines, 28 tall)
│ gap 18                                         │
│  ┌──────── Later ───────┐ ┌─ Restart now ──┐   │  actions          y 218
│  │       181 x 34       │ │    181 x 38    │   │  ← CENTER-aligned
│  └──────────────────────┘ └────────────────┘   │
│ pb 24                                          │
──────────────────────────────────────────── 280 ─
   px 24                                    px 24
```

Stack check (proves 280 is the hug height, so build it as `width:420px` + natural height):
`20 + 96 + 18 + 20 + 18 + 28 + 18 + 38 + 24 = 280`.

| # | node | what | x, y | w x h | sizing | style / tokens |
|---|---|---|---|---|---|---|
| 1 | `437:8` | **Mr. Bell** instance (master `374:77`, 256 rig) | 162, 20 | 96 x 96 | fixed | **0.375** of the 256 master — whole pixels. Art tokens `--bell-cap-mid` (shell/pincers/sockets), `--bell-cap-lo` (arms/legs/stalks), `--page-ink` (pupils), spectacles **unbound `#000000`** |
| 2 | `437:105` | title "Restart to install v0.5.0" | 115.5, 134 | 189 x 20 | hug | **Title/Toolbar** — SF Pro Semibold 17 / `letter-spacing:-0.204px` / `--ink` / `text-align:center` / nowrap |
| 3 | `437:106` | body copy | 24, 172 | 372 x 28 | **fill** (420−48) | **Body/Small** — SF Pro Regular 12 / ls 0 / `text-align:center`; wraps to 2 lines at 372. Node colour `--ink-2` but the runs override to **unbound `#070707`** (see TRAPS) |
| 4 | `437:107` | `actions` frame | 24, 218 | 372 x 38 | fill x hug | HORIZONTAL, `itemSpacing` **10**, `counterAxisAlignItems: CENTER`, padding 0, `overflow: clip` |
| 4a | `437:108` | **Button / Secondary** "Later" | 0, **2** | 181 x 34 | fill x fixed 34 | `--glass-strong` fill, 1px `--hair` stroke, radius `--r-btn` (10), padding-x **14**, gap 8, label **Body/Strong** (SF Pro Semibold 13, ls −0.052px) in `--ink` |
| 4b | `437:113` | **Button / Primary** "Restart now" | 191, **0** | 181 x 38 | fill x fixed 38 | `linear-gradient(168.14deg, --bell-cap-lo 0%, --bell-cap-mid 70.711%)`, **no stroke**, radius `--r-btn` (10), padding-x **18**, gap 8, shadow `0 10 24 -14 rgba(111,118,242,0.9)`, label Body/Strong in **`#fff`** |

`181 + 10 + 181 = 372` exactly, so both buttons are `flex:1 0 0; min-width:0`.
The CENTER cross-alignment is the whole point of the row: **38 − 34 = 4**, so Secondary sits at
`y = 2` and the two labels share one optical centre line. Do **not** stretch them to equal height.

## A2. Update Notice `440:115` — 214 x 30, three variants

Set frame `440:115` is a 750 x 54 board holding three COMPONENTs, laid out at x = 0 / 250 / 500.

| variant | node |
|---|---|
| `State=Available` | `440:112` |
| `State=Downloading` | `440:113` |
| `State=Ready` | `440:114` |

Root, identical in all three:

| property | value |
|---|---|
| size | **214 FIXED x 30** |
| layout | HORIZONTAL, `primaryAxisAlignItems: SPACE_BETWEEN`, `counterAxisAlignItems: CENTER` |
| padding | 8 top/bottom, 10 left/right |
| fill | `--glass-strong` |
| stroke | 1px `--glass-brd`, INSIDE |
| radius | `--r-chip` (9) |
| shadow | `0 3 10 0 rgba(18,20,51,0.14)` |
| clip | `overflow: clip` — **load-bearing for Downloading** |

### A2.1 State=Available `440:112`

```
┌─ 214 x 30, r9 ─────────────────────────────────────┐
│ 10 │ ● 6px  gap6  Update available │ … │ ▼ 14px │10│
└────────────────────────────────────────────────────┘
     └─ label group 438:109 ─┘   space-between  └icon┘
```

| node | what | size | style |
|---|---|---|---|
| `438:109` | `label` group | hug | HORIZONTAL, gap **6**, `counterAxisAlignItems: CENTER` |
| `438:110` | `dot` | **6 x 6** | flattened SVG export — paint not resolvable through the MCP; treat as `--accent` |
| `438:111` | text "Update available" | hug | **Body/Chip** — SF Pro Medium 12 / ls 0 / `--ink` / nowrap |
| `438:112` | `icon` | **14 x 14** | flattened SVG (download glyph). Icon set `17:119` is a 24-box / 1.75 stroke / `--ink-2` default, so 14 = 0.583 of it |

### A2.2 State=Ready `440:114`

Structurally identical to Available; only the string and the trailing glyph change.

| node | what | size | style |
|---|---|---|---|
| `438:122` | `label` group | hug | HORIZONTAL, gap 6, CENTER |
| `438:123` | `dot` | 6 x 6 | same asset as Available |
| `438:124` | text **"Restart to update"** | hug | Body/Chip / `--ink` |
| `438:125` | `icon` | 14 x 14 | **different** SVG from Available (restart glyph) |

### A2.3 State=Downloading `440:113` — the pill *is* the progress bar

```
┌─ 214 x 30, r9 ─────────────────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░│
│ 10 │ ● 6px gap6 Downloading │ … │           62% │10│
└────────────────────────────────────────────────────┘
 └──────── progress 438:120, 133 x 30 ────┘
```

| node | what | geometry | style |
|---|---|---|---|
| `438:120` | `progress` | **ABSOLUTE**, `x:-1, y:-1`, **133 x 30** | fill `--accent-soft`, **no radius of its own**, bottom-most child (paints behind the label) |
| `438:116` | `label` group | hug | HORIZONTAL, gap 6, CENTER |
| `438:117` | `dot` | 6 x 6 | same asset as the other two states |
| `438:118` | text "Downloading" | hug | Body/Chip / `--ink` |
| `438:119` | text **"62%"** | hug | **Mono/Small** — Geist Mono Regular 11 / ls 0 / **`--ink-2`** |

How the fill works, exactly:

* The rect is pinned to the pill's **outer** top-left. `-1, -1` is the 1px INSIDE stroke being
  cancelled out, and height **30** is the pill's full outer height — so the fill paints *over* the
  left, top and bottom border, edge to edge. Nothing is inset.
* `width = 214 * fraction`, rounded to whole px. `214 × 0.62 = 132.68 → 133`, which is the measured
  value and matches the `62%` readout. That is the formula to ship.
* The left corners come from the parent's `overflow: clip` + `--r-chip`; the right edge is a **hard
  vertical line** with no radius, cap or gradient.
* There is **no trailing 14px icon** in this state — the mono readout occupies that slot instead, so
  the right-hand inset is set by the text metrics, not by a 14px box.

## A3. The page's own spec texts, verbatim

`440:116` (heading, 400 x 24):

> Update

`440:117` (760 x 28):

> How a new build reaches the user. The indicator is a 30px glass pill in the sidebar; the dialog owns the restart moment. Motion lives on Motion — Update.

`440:118` (760 x 42):

> Update Notice · Available / Downloading / Ready. 214 wide, 30 tall. In Downloading the pill's own fill is the progress bar. Kept this short on purpose: a 112px card would have squeezed the mascot slot to 106px against a 176px need, and the crab only has ~45px of empty headroom before his art gets cut.

`440:119` (700 x 28):

> Update Dialog · 420 wide, glass/strong on glass/border. Mr. Bell at 96px (0.375 — still whole pixels). The action row is centre-aligned because Primary is 38px and Secondary 34px by design.

That is the reason the indicator is a **30px pill and not a card**: the sidebar mascot needs 176px and
only has ~45px of slack, so a 112px card would have cropped Mr. Bell's artwork.

---

# PART B — STARTUP (page `391:2`)

The page's own spec texts, verbatim:

`402:1110` (480 x 126):

> startup  ·  2.0s — he drops in and lands with a squash (0.01–0.35s), the 28 spectacle blocks assemble left to right (0.38–0.97) and stay black throughout, specs push-up as the ready beat (1.02–1.68), the wordmark dissolves in as 32 mask cells firing in eight scattered waves 30ms apart (1.40–1.61) then steps up two pixels to its line (1.62–1.74), one blink to close. No ground plate: the transparent frame means the artwork carries the whole splash, so the mascot has a blue halo plus a soft cast and the wordmark a tight one. The reveal is an 8x4 ALPHA mask group at index 0 of the `wordmark` frame — animating cell opacity works on transparency, where a cover-block dissolve could not.

`402:1111` (700 x 70):

> handoff  ·  0.9s — the transparent splash holds for 180ms, then the app fades up behind it while both elements travel to the slots they permanently occupy: the crab to the sidebar mascot slot (a pure translate — he is 160px in both places) and the wordmark to the brand row (0.6 → 0.35 scale). As the app rises, the wordmark and the spectacles resolve from white to ink, so the travelling elements simply become the app's own logo and mascot, which are hidden. The small logo mark has no splash counterpart and fades in mid-travel.

## B1. `startup` 391:3 — composition, 480 x 320

**The frame has `fills: []`.** No ground plate, no window chrome, no radius. It composites straight
onto transparency, which is why the artwork carries its own shadows — and why it is only legible
over a **dark** host surface (the wordmark renders white; see B4/`460:1118`).

| node | what | x, y | w x h | notes |
|---|---|---|---|---|
| `391:4639` | **Mr. Bell** | 159, 44 | **160 x 160** | 0.625 of the 256 rig. Effects: halo `#2c7bff` @ **24%**, offset (0,0), radius **36** + cast `#05060c` @ **40%**, offset **(0,10)**, radius **24** |
| `464:5989` | **wordmark** | 184, 224 | **117.6 x 52.8** | Effect: `#05060c` @ **45%**, offset **(0,3)**, radius **10** |
| `464:5989 › 482:1151` | `reveal` — 8x4 **ALPHA mask** group, child **index 0** | −0.5, −0.5 | 118.6 x 53.8 | 0.5px bleed on all four sides so the mask fully covers the art with no seam |
| `464:5989 › 391:4736` | `Bell / Wordmark` instance (masked) | 0, 0 | 117.6 x 52.8 | 117.6 x 52.8 = **0.6** of the 196 x 88 wordmark master |

Mr. Bell's rig, measured at the 160px scale (child coords are parent-relative):

| node | what | parent | x, y | w x h |
|---|---|---|---|---|
| `391:4640` | `body` | Mr. Bell | −18.48, 16.25 | 202.717 x 131.25 (**overflows the 160 box both sides**) |
| `391:4641` | `claw L pivot` | body | −18.48, 22.5 | 120 x 120 |
| `391:4653` | `claw R pivot` | body | 52.987, 16.25 | 131.25 x 131.25 |
| `391:4665` | `shell` | body | 40, 75 | 80 x 50 |
| `391:4669` | `eye L` | body | 50, 50 | 15 x 25 |
| `391:4673` | `eye R` | body | 95, 50 | 15 x 25 |
| `391:4677` | `specs` | body | 24.375, 45 | 108.125 x 25.678 |
| `391:4714` | `legs R pivot` | Mr. Bell | 99.6875, 95 | 46.25 x 46.25 |
| `391:4719` | `legs L pivot` | Mr. Bell | 13.4375, 95 | 46.25 x 46.25 |
| `391:4724` | `lower legs L pivot` | Mr. Bell | 36.25, 107.5 | 35 x 35 |
| `391:4730` | `lower legs R pivot` | Mr. Bell | 90, 106.875 | 35 x 35 |

## B2. `startup` timeline — 2000 ms, 68 animated nodes

Times below are **absolute ms**. For `@keyframes`, `percent = ms / 20`.
**HOLD** = Figma hold/step easing: the value does not interpolate, it snaps. In `@keyframes` write the
old value at `(ms−ε)/20 %` and the new value at `ms/20 %`; in WAAPI use `easing: "steps(1, end)"` on
that segment.

### Beat 1 — the drop and landing squash (0–350)

| node | property | keyframes (ms → value) | easing per segment |
|---|---|---|---|
| `391:4639` Mr. Bell | `opacity` | 0 → **0**, 40 → **1** | **HOLD** |
| `391:4639` Mr. Bell | `y` (px) | 0 → **−60**, 40 → **−60**, 230 → **0** | linear, then **easeOut** |
| `391:4640` body | `scaleY` | 0 → **1**, 260 → **0.9**, 350 → **1** | **HOLD** into 0.9, then **easeOut** back |

He is invisible for the first 40ms, falls 60px over 40→230 on an ease-out, then the body snaps to a
0.9 vertical squash at 260 and eases out of it by 350.

### Beat 2 — the spectacles assemble, left to right (380–974)

28 nodes, each with a **single HOLD `opacity` 0 → 1** track and nothing else. Perfectly uniform
**22 ms** stagger: `t = 380 + 22n`, n = 0…27. Everything stays **unbound `#000000`** the whole time —
there is no colour track anywhere in this beat.

| n | ms | node | group |
|---|---|---|---|
| 0 | 380 | `391:4681` | L frame |
| 1 | 402 | `391:4694` | L |
| 2 | 424 | `391:4693` | L |
| 3 | 446 | `391:4691` | L |
| 4 | 468 | `391:4686` | L |
| 5 | 490 | `391:4692` | L |
| 6 | 512 | `391:4690` | L |
| 7 | 534 | `391:4684` | L |
| 8 | 556 | `391:4683` | L |
| 9 | 578 | `391:4685` | L |
| 10 | 600 | `391:4687` | L |
| 11 | 622 | `391:4689` | L |
| 12 | 644 | `391:4688` | L |

| 13 | 666 | `391:4707` | R frame |
| 14 | 688 | `391:4706` | R |
| 15 | 710 | `391:4708` | R |
| 16 | 732 | `391:4704` | R |
| 17 | 754 | `391:4702` | R |
| 18 | 776 | `391:4703` | R |
| 19 | 798 | `391:4705` | R |
| 20 | 820 | `391:4709` | R |
| 21 | 842 | `391:4710` | R |
| 22 | 864 | `391:4711` | R |
| 23 | 886 | `391:4712` | R |
| 24 | 908 | `391:4713` | R |
| 25 | 930 | `391:4700` | R |
| 26 | **952** | `391:4696` **lens L** | VECTOR (SVG) |
| 27 | **974** | `391:4695` **lens R** | VECTOR (SVG) |

The "28 blocks" = **26 ROUNDED_RECTANGLEs (13 per lens frame) + the 2 lens VECTORs**. The two lenses
are the last things to land, so the glass appears after its frame is fully drawn.

### Beat 3 — the specs push-up, the "ready" beat (1020–1680)

`391:4653` **claw R pivot** — one shared time grid, three properties:

| ms | `rotate` (deg) | `x` (px) | `y` (px) | easing out of this keyframe |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | linear (flat hold) |
| 1020 | 0 | 0 | 0 | **easeOut** (`y`: easeOut) |
| 1200 | **−62** | **−56** | **−2** | **easeInOut** (`y`: linear) |
| 1280 | **−68** | **−60** | −2 | **easeInOut** |
| 1550 | 0 | 0 | 0 | linear |
| 2000 | 0 | 0 | 0 | — |

`391:4677` **specs** — `y`, all **HOLD** (a hard pixel-step lift, not a slide):

| ms | `y` |
|---|---|
| 0 → 1280 | 0 |
| 1280 | **−8** |
| 1360 | **−16** |
| 1550 | **−8** |
| 1680 | **0** |

`391:4672` / `391:4676` **pupils (both eyes)** — `y`, **HOLD**: `0` until 1320, **−8** from 1320,
back to `0` at 1600. He looks up at the glasses while they are in the air.

### Beat 4 — the wordmark dissolve (1400–1740)

The reveal is an **ALPHA mask** (`482:1151`) at child index 0 of the `wordmark` frame. 32 cells,
**8 columns x 4 rows**, each **14.7 x 13.2** (8 × 14.7 = 117.6; 4 × 13.2 = 52.8), tiled from the
mask group's origin. Each cell has exactly **one HOLD `opacity` 0 → 1** track — nothing else.

Cell node id = **`482:1119 + (row × 8) + col`** — `cell 0-0` = `482:1119` … `cell 3-7` = `482:1150`.

Cell rect inside the 117.6 x 52.8 wordmark box: `x = col × 14.7`, `y = row × 13.2`.

Eight waves of four, **30 ms** apart:

| wave | ms | cells |
|---|---|---|
| A | **1400** | 0-3, 1-2, 2-2, 3-3 |
| B | **1430** | 0-6, 1-5, 2-5, 3-7 |
| C | **1460** | 0-0, 1-1, 2-0, 3-1 |
| D | **1490** | 0-4, 1-4, 2-3, 3-5 |
| E | **1520** | 0-1, 0-7, 1-7, 2-6 |
| F | **1550** | 0-5, 1-3, 3-2, 3-6 |
| G | **1580** | 0-2, 1-0, 2-1, 2-7 |
| H | **1610** | 1-6, 2-4, 3-0, 3-4 |

The grid, as waves (col 0 → 7 left to right, row 0 → 3 top to bottom):

```
        c0  c1  c2  c3  c4  c5  c6  c7
  r0     C   E   G   A   D   F   B   E
  r1     G   C   A   F   D   B   H   E
  r2     C   G   A   D   H   B   E   G
  r3     H   C   F   A   H   D   F   B
```

…and the same thing in ms, if you would rather paste numbers:

```
        c0    c1    c2    c3    c4    c5    c6    c7
  r0   1460  1520  1580  1400  1490  1550  1430  1520
  r1   1580  1460  1400  1550  1490  1430  1610  1520
  r2   1460  1580  1400  1490  1610  1430  1520  1580
  r3   1610  1460  1550  1400  1610  1490  1550  1430
```

Then the whole `wordmark` frame `464:5989` steps up to its line — `y`, all **HOLD**:

| ms | `y` |
|---|---|
| 0 → 1680 | **16** (first keyframe authored at **1620**, indistinguishable from t=0) |
| 1680 | **8** |
| 1740 | **0** |

### Beat 5 — one blink to close (1870–1980)

All four tracks are **HOLD**. The eyes are **not** symmetrical:

| node | property | keyframes |
|---|---|---|
| `391:4671` eye **L** socket | `scaleY` | 1 until **1870** → **0.333** → back to **1** at **1980** |
| `391:4672` eye **L** pupil | `opacity` | 1 until **1870** → **0** → back to **1** at **1980** |
| `391:4675` eye **R** socket | `scaleY` | 1 until **1910** → **0.333** → **no reopen keyframe** |
| `391:4676` eye **R** pupil | `opacity` | 1 until **1910** → **0** → **no reopen keyframe** |

The right eye closes 40 ms after the left and **never reopens inside the 2000 ms** — see TRAPS.

## B3. `handoff` 398:3 — composition, 1320 x 860

| node | what | x, y | w x h | notes |
|---|---|---|---|---|
| `398:4` | `app` — **INSTANCE of `Library — Day` `40:1080`** | fills the frame | 1320 x 860 | its **own logo and Mr. Bell are set invisible** so the travelling elements become them |
| `399:1189` | `crab` | **38, 670** | **160 x 160** | byte-identical rig to `391:4639` — same child offsets and sizes, so the travel is a **pure translate** |
| `460:1117` | `wordmark` | **55, 40** | **68.6 x 30.8** | = **0.35** of the 196 x 88 master, i.e. exactly `0.6 / 1.714` |
| `460:1117 › 460:1118` | `Bell` **TEXT** | −1.75, −2.1 | 69 x 40 | the only child; carries the FILLS colour track |
| `399:1288` | `mark` — INSTANCE of `Brand Mark` `363:5` | **20, 43** | **28 x 28** | 16x16 pixel mark on a **1.75px** grid (28 / 16); no splash counterpart |

Brand row geometry: mark occupies x 20–48, wordmark box starts at 55 → **7px gap**; mark spans
y 43–71, wordmark box y 40–70.8.

### The splash pose registers across both frames

Referenced to each frame's centre, the t=0 handoff pose reproduces the end of `startup` to **half a
pixel** — treat "splash pose" as one shared, centre-anchored layout, not two separate compositions.

| element | `startup` centre offset from (240,160) | `handoff` t=0 centre offset from (660,430) |
|---|---|---|
| crab / Mr. Bell | (−1, −36) | (−1, −36) |
| wordmark | (+2.8, +90.4) | (+3.3, +90.4) |

## B4. `handoff` timeline — 900 ms

`percent = ms / 9`. Everything holds for the first **180 ms** — the transparent splash sits still
while nothing else exists.

### The choreography — four tracks that matter

| node | property | keyframes (ms → value) | easing |
|---|---|---|---|
| `398:4` `app` | `opacity` | 0 → **0**, **180** → **0**, **500** → **1**, 900 → 1 | flat, then **easeOut** |
| `399:1189` `crab` | `x` | 0 → **541**, **180** → **541**, **700** → **0**, 900 → 0 | flat, then **easeInOut** |
| `399:1189` `crab` | `y` | 0 → **−356**, **180** → **−356**, **700** → **0**, 900 → 0 | flat, then **easeInOut** |
| `460:1117` `wordmark` | `x` | 0 → **574**, **180** → **574**, **700** → **0**, 900 → 0 | flat, then **`cubic-bezier(0.32, 0, 0.16, 1)`** |
| `460:1117` `wordmark` | `y` | 0 → **465**, **180** → **465**, **700** → **0**, 900 → 0 | same custom cubic |
| `460:1117` `wordmark` | `scaleX` / `scaleY` | 0 → **1.714**, **180** → **1.714**, **700** → **1**, 900 → 1 | same custom cubic |
| `460:1118` `Bell` TEXT | **FILLS colour** | 0 → **`#FFFFFF`**, **180** → `#FFFFFF`, **340** → **`#1B1D27`** (= `--ink` Day) | flat, then **easeInOut**; holds ink to 900 |
| `399:1288` `mark` | `opacity` | 0 → **0**, **340** → **0**, **520** → **1**, 900 → 1 | flat, then **easeOut** |

Read as a story:

```
   0        180              340       500  520        700          900
   │─ hold ─│                 │         │    │          │            │
   │        ├── app 0→1 ──────────────── 500                         
   │        ├── crab (+541,−356) → (0,0) ───────────── 700           
   │        ├── wordmark (+574,+465)·1.714 → (0,0)·1 ── 700           
   │        ├── Bell fill #FFF → --ink ─ 340                         
   │                          ├── mark 0→1 ──── 520                  
```

* `1.714 = 0.6 / 0.35`. The wordmark starts at exactly the splash's 117.6 x 52.8 and lands at the
  brand row's 68.6 x 30.8. **No re-layout, one transform.**
* The crab has **no scale track at all** — 160px at both ends.
* The white → ink fill finishes at **340**, a clear **160 ms before** the app reaches full opacity at
  **500**, so the wordmark is already dark by the time the light Library surface is readable behind it.
* The crab and the wordmark travel over the same 180→700 window but on **different easings**
  (`ease-in-out` vs `cubic-bezier(0.32,0,0.16,1)`), so they deliberately do not move in lockstep.

### The ten tracks you should ignore

The `Library — Day` instance drags its own ambient-blob drift into the cohort: five `base` +
`highlight` pairs, each pair sharing one track set. All hold at 0 until **500 ms** and then drift to
the deltas below.

| base / highlight | `x` | `y` | `scale` |
|---|---|---|---|
| `I398:4;56:3688` / `;56:3695` | +58 | −16 | 1 → 1.035 |
| `I398:4;56:3702` / `;56:3707` | −42 | +26 | — |
| `I398:4;56:3712` / `;56:3717` | −50 | −20 | 1 → 1.028 |
| `I398:4;56:3722` / `;56:3729` | +46 | +18 | — |
| `I398:4;56:3736` / `;56:3740` | −34 | −24 | 1 → 1.040 |

This is the Library screen's own background life, not handoff choreography — it belongs to
`AppBackground`, not to a splash component. **Do not implement it here.** (Their exported time arrays
are mangled anyway; see TRAPS.)

---

# TRAPS

1. **`startup` has no fills.** `background: transparent`, and the wordmark art is **white**, so the
   splash is invisible over a light surface. The Tauri splash window must be transparent *and* the
   thing behind it dark, or you must supply your own dark plate — which the design deliberately does
   not have ("No ground plate").

2. **The right eye never reopens.** `391:4675` / `391:4676` close at **1910 ms** with no return
   keyframe, so a one-shot 2.0s splash ends on a half-closed crab and hands off winking. Figma hides
   it because the frame is set to loop. Fix: mirror the left eye (`0.333 → 1` and `0 → 1` at 1980).

3. **The body squash is centre-anchored in Figma.** `scaleY 0.9` on a 131.25-tall body lifts its
   bottom edge **6.56px**, so a literal port floats him off the landing. Use
   `transform-origin: 50% 100%` on `body` if you want it to read as weight. Same question for
   `eye socket scaleY 0.333` and the handoff wordmark's `1.714 → 1` — pick origins deliberately.

4. **Dialog body copy is broken in the file.** `437:106` is bound to `--ink-2`, but both text runs
   override to **unbound `#070707`**; only the single space between "Bell" and "will" keeps the token.
   Ship `--ink-2` for the whole paragraph and treat `#070707` as the bug.

5. **Do not equalise the dialog's two buttons.** Primary is 38, Secondary 34, and the row's
   `CENTER` cross-alignment is the intended look. `align-items: stretch` destroys it.

6. **Update Notice `progress` is not inset.** It is `-1, -1` and **30** tall — it deliberately paints
   over the pill's 1px border on three sides. If you build it inside the padding box you get a 1px
   light seam on the left and a 2px-short bar. Width is `214 × fraction`, off the **outer** width.

7. **214 x 30 with `padding: 8px 10px` does not add up.** 12px SF Pro at `line-height: normal` is
   ~14.3px, so 8 + 14.3 + 8 + 2 borders = 32.3, not 30. Pin the height and let the vertical padding
   go: `height:30px; box-sizing:border-box; padding-inline:10px; display:flex; align-items:center`.

8. **The two wordmarks are different objects.** `startup` reveals the pixel `Bell / Wordmark`
   instance (`391:4736`, 117.6 x 52.8) through a mask; `handoff` travels a plain **TEXT** node
   (`460:1118` "Bell", 69 x 40 inside a 68.6 x 30.8 frame). Only the *boxes* match — 0.6 and 0.35 of
   the same 196 x 88 master. In code, use **one** wordmark element for both and animate only its
   transform and colour; do not swap representations mid-flight.

9. **The spectacles are unbound `#000000`,** in both the dialog's Mr. Bell and the splash rig, and
   they have no colour track — "stay black throughout". They are not `--ink` and must not follow the
   theme, or the crab loses his glasses in Night.

10. **The `mask` is ALPHA, at child index 0.** Order matters: `reveal` must be the *first* child of
    `wordmark`, and it is 118.6 x 53.8 at `(−0.5, −0.5)` — a **0.5px bleed on all four sides** so the
    32 cells cover the art without a hairline seam. Do not snap it to 117.6 x 52.8.

11. **`get_metadata` returns zero children for both motion frames** (`391:3`, `398:3`) and for the
    `Update` canvas' large frames. Go in by child id (`391:4639`, `464:5989`, `399:1189`, `460:1117`,
    `399:1288`) or via `get_design_context`.

12. **The exported ambient-blob time arrays are junk.** `I398:4;56:*` come back with ~60 samples
    crammed between `t = 0.994` and `t = 1.0` and a snap-to-zero at `t = 1`. That is an exporter
    artefact of a long ease being flattened into the 900 ms cohort, not a design intent. Another
    reason to leave those ten tracks out.

13. **"steps up two pixels" is 8px steps.** `402:1110` says two pixels; the measured `y` track on
    `464:5989` is `16 → 8 → 0` at 1620 / 1680 / 1740 — i.e. **two steps of 8px**. The copy means two
    *steps*, not two px. Build 16/8/0.

14. **Both frames loop in Figma; neither loops in the product.** `startup` runs once then yields to
    `handoff`, which runs once and is discarded. Use `animation-fill-mode: forwards` /
    `fill: "forwards"` everywhere, and drop every `repeat: Infinity` the MCP snippets carry.

---

# Implementation notes

* **Frame → keyframe percentages:** `startup` `% = ms / 20`; `handoff` `% = ms / 9`.
* **HOLD keyframes** are most of this spec. Either duplicate the previous value 0.05% earlier, or
  give the segment `steps(1, end)`. Never let a HOLD track interpolate — the pixel art depends on it.
* **Easing map:** Figma `easeOut` → `cubic-bezier(0, 0, 0.58, 1)`; `easeInOut` →
  `cubic-bezier(0.42, 0, 0.58, 1)`; the wordmark's custom curve is literally
  `cubic-bezier(0.32, 0, 0.16, 1)`.
* **The splash shadows must be `filter`, not `box-shadow`** — the crab is a stack of ~40 rectangles
  with a non-rectangular silhouette, so only `drop-shadow()` hugs it:
  `filter: drop-shadow(0 0 36px rgba(44,123,255,.24)) drop-shadow(0 10px 24px rgba(5,6,12,.4));`
  and on the wordmark `filter: drop-shadow(0 3px 10px rgba(5,6,12,.45));`
* **The 32-cell dissolve without CSS masks:** stack 32 divs at the cell rects, each
  `background-image:url(wordmark.svg); background-size:117.6px 52.8px; background-position:-{col×14.7}px -{row×13.2}px;`
  and step each one's opacity at its wave time. Same result as the ALPHA mask, no mask support needed.
* The 28-block assemble and the 32-cell dissolve are 60 single-property opacity steps. Generate them
  from the tables — do not hand-write 60 rules.










