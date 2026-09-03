# Mr. Bell — measured rig spec (mascot + mark)

Figma `GnDdYtn8SaQjgmA4SQRCn7`, page **`363:2` "Brand — Mr. Bell"**. Two components:

| what | node | type | size | notes |
|---|---|---|---|---|
| **Mr. Bell** | `374:77` | COMPONENT | 256 x 256 | `clipsContent: false`, no fill. 65 RECTANGLEs + 2 VECTORs in 23 nested groups, plus 6 empty pivot frames |
| **Mr. Bell Mark** | `363:5` | COMPONENT | 64 x 64 | 15 RECTANGLEs, flat (no groups, no pivots), 4px grid |

Measured from an SVG export of `374:77` cross-checked against `get_design_context` percentages and
`get_metadata` boxes; every integer below is exactly integral in Figma, non-integers are exact to
±0.001 (the export rounds to 6 significant figures).

## 0. Conventions

- **x,y are component coordinates**: origin = the component frame's top-left, +y down. The SVG
  export's own viewBox is offset (`x_svg = x_component + 29.5686`); every number here is already
  converted, so ignore that.
- `x,y` for an unrotated rect is its top-left. For a **rotated** rect it is the rect's **origin
  corner**, and rotation is applied **about that corner** (`transform="rotate(r x y)"`), which is
  what Figma exports. A `centre` column is given so you can use the equivalent
  `rotate(r cx cy)`-about-centre form instead.
- **rotation is in SVG/CSS sense: positive = clockwise.** Figma's own `rotation` field is the
  negative of these numbers (see TRAPS 8).
- **Every rect in both components has `cornerRadius: 0`.** There is not one rounded corner in the
  rig. (`get_metadata` prints `<rounded-rectangle>` for every RECTANGLE; that is the node-type
  label, not a radius.)
- No strokes, no effects, no blend modes, opacity 1 everywhere — **except** the 2 lens VECTORs
  (42% fill + a 1px black stroke) and the shadows that *placements* add outside the component.
- `mir` = the node is stored with scaleX -1 (`matrix(-1 0 0 1 tx ty)`). For a solid axis-aligned
  rect that is visually a no-op, so the table gives the **effective** top-left; it matters only if
  you read x back out of Figma, where x is then the right edge.

Fill tokens (all mode-invariant, so the rig does not change between Day and Night):

| token | hex | count | where |
|---|---|---|---|
| `--bell-cap-mid` (`bell/cap-mid`) | `#2c7bff` | 17 | shell x3, sockets x2, pincers x12 |
| `--bell-cap-lo` (`bell/cap-lo`) | `#1436c8` | 20 | arms x8, stalks x2, legs x6, lower legs x4 |
| `--page-ink` (`paper/ink`) | `#1a1c24` | 2 | pupils |
| `--bell-cap-hi` (`bell/cap-hi`) | `#58c8ff` | 2 | Mark lenses only — unused in the 256px rig |
| raw `#000000` **unbound** | — | 26 | every `specs` bar. Deliberate; do not normalise |
| raw `#0079b5` @ **42%** paint opacity, 1px `#000000` stroke | — | 2 | the 2 lens VECTORs |

39 rects are token-bound (17 + 20 + 2); the 26 black `specs` bars are not.

## 1. Tree and z-order

Listed in **paint order — first line is furthest back.** Figma's layer panel shows this reversed.
`G` = GROUP (no box of its own — `display: contents` in codegen), `F` = FRAME.

```
Mr. Bell  374:77  COMPONENT 256x256  clipsContent:false
├─ body                343:296  G      ← the whole crab except the legs
│  ├─ claw L pivot     343:289  F 192x192 empty, unclipped
│  │  └─ claw L        302:310  G   10 rects   BEHIND the shell
│  ├─ claw R pivot     343:290  F 210x210 empty, unclipped
│  │  └─ claw R        302:299  G   10 rects   BEHIND the shell
│  ├─ shell            298:306  G    3 rects
│  ├─ eye L            299:292  G    3 rects  (stalk, socket, pupil)
│  ├─ eye R            299:296  G    3 rects
│  └─ specs            315:654  G   26 black rects + 2 lens vectors, ON TOP of the eyes
│     ├─ frame L       315:635  G → Group 3 315:633 → Group 4 315:634 → Group 1 315:618
│     ├─ lens R        315:656  VECTOR                    ← paints between the two frames
│     ├─ frame R       315:636  G → 315:637 → 315:638 → Group 1_2 315:640
│     └─ lens L        315:655  VECTOR                    ← paints last, over frame L
├─ legs R pivot        343:292  F 74x74  → legs R        298:295  G  3 rects
├─ legs L pivot        343:291  F 74x74  → legs L        303:5035 G  3 rects
├─ lower legs L pivot  343:293  F 56x56  → lower legs L  303:5048 G  seg 1 303:5040, seg 2 303:5045
└─ lower legs R pivot  343:294  F 56x56  → lower legs R  303:5049 G  seg 1 303:5050, seg 2 303:5052
```

`body` is a GROUP whose box is just the union of its children: **(-29.5686, 26) 324.3474 x 210**.
The four leg pivots are **siblings of `body`, not children** — that is what lets the legs stay
planted while the body bobs. It also means **the legs paint in front of the shell** (TRAPS 1).

Ink (drawn pixels, not frames): **x -6 … 265.879, y 72 … 222** → 271.879 x 150. So the art
overflows the 256 frame by **6px left and 9.879px right**, and leaves 72px empty at the top and
34px at the bottom. Placements rely on this: sidebar mascot slots run 153–191px tall.

## 2. Pivot frames = your transform-origins

Six empty, unclipped FRAMEs, each centred on a joint. They hold no art; their only job is to make
Figma's `ROTATION` swing from the joint. **In an SVG rebuild you do not recreate them** — you put
`transform-origin` (or `rotate(r cx cy)`) on the limb group and drop the frame.

| pivot | node | frame box x, y, w, h | **centre = transform-origin** | the joint it sits on |
|---|---|---|---|---|
| claw L pivot | `343:289` | -29.5686, 36, 192, 192 | **66.4314, 132** | inboard tip of `arm_4`; 2px inside the shell's left edge |
| claw R pivot | `343:290` | 84.7788, 26, 210, 210 | **189.7788, 131** | inboard tip of `arm_8`; 2px inside the shell's right edge |
| legs L pivot | `343:291` | 21.5, 152, 74, 74 | **58.5, 189** | top edge of `leg_6` (hip) |
| legs R pivot | `343:292` | 159.5, 152, 74, 74 | **196.5, 189** | top edge of `leg_3` (hip) |
| lower legs L pivot | `343:293` | 58, 172, 56, 56 | **86, 200** | top edge of `leg_7` (knee) |
| lower legs R pivot | `343:294` | 144, 171, 56, 56 | **172, 199** | top edge of `leg_9` (knee) |

The claw pivot centre is exactly the group's inboard ink edge, so rotating a claw inward slides its
shoulder under the shell instead of detaching it. For body moves there is no pivot: the shell's
centre is **(128, 160)**, its baseline **y 200** (squash anchor).

## 3. The 39 token-bound rects

### 3.1 shell — `298:306`, group box (64, 120) 128 x 80

| node | name | x | y | w | h | rot | fill |
|---|---|---|---|---|---|---|---|
| `298:303` | shell | 72 | 120 | 112 | 8 | 0 | `--bell-cap-mid` |
| `298:304` | shell | 64 | 128 | 128 | 64 | 0 | `--bell-cap-mid` |
| `298:305` | shell | 72 | 192 | 112 | 8 | 0 | `--bell-cap-mid` |

A 128x64 slab with an 8px band inset 8px on each side above and below — a three-step pixel dome.
Exact 8px grid, centred on x 128.

### 3.2 eye L `299:292` (80, 80) 24 x 40 · eye R `299:296` (152, 80) 24 x 40

| node | name | x | y | w | h | rot | fill |
|---|---|---|---|---|---|---|---|
| `299:289` | stalk (L) | 88 | 104 | 8 | 16 | 0 | `--bell-cap-lo` |
| `299:290` | socket (L) | 80 | 80 | 24 | 24 | 0 | `--bell-cap-mid` |
| `299:291` | pupil (L) | 88 | 88 | 8 | 8 | 0 | `--page-ink` |
| `299:293` | stalk (R) | 160 | 104 | 8 | 16 | 0 | `--bell-cap-lo` |
| `299:294` | socket (R) | 152 | 80 | 24 | 24 | 0 | `--bell-cap-mid` |
| `299:295` | pupil (R) | 160 | 88 | 8 | 8 | 0 | `--page-ink` |

Paint order inside each eye is **stalk, socket, pupil**. Perfect 8px grid and a perfect mirror about
x 128. The pupil is centred in the socket, so it can step **±8px in x and y** and stay inside — a
free 3x3 look-around grid (9 positions: x 80/88/96, y 80/88/96). The stalk runs from the socket's
bottom edge (104) to the shell's top band (120); move the pupil alone for a glance, the whole eye
group for a head-turn, and nothing else — a socket-only move tears the stalk.

### 3.3 legs L `303:5035` (45, 189) 27 x 32 · legs R `298:295` (184, 189) 25 x 32

| node | name | x | y | w | h | rot | mir | fill |
|---|---|---|---|---|---|---|---|---|
| `298:294` | leg (R) | 192.3333 | 200 | 8.3333 | 11 | 0 | Y | `--bell-cap-lo` |
| `303:5033` | leg (R) | 200.6667 | 200 | 8.3333 | 21 | 0 | Y | `--bell-cap-lo` |
| `303:5031` | leg (R) | 184 | 189 | 16.6667 | 11 | 0 | Y | `--bell-cap-lo` |
| `303:5036` | leg (L) | 54 | 200 | 9 | 11 | 0 | . | `--bell-cap-lo` |
| `303:5037` | leg (L) | 45 | 200 | 9 | 21 | 0 | . | `--bell-cap-lo` |
| `303:5038` | leg (L) | 54 | 189 | 18 | 11 | 0 | . | `--bell-cap-lo` |

Paint order is legs **R** first, then legs **L**. Each leg group is a 3-block staircase: an 11px
shoulder block under the shell, a step down-outward, then a 21px shin that ends at y 221.
**Not a clean mirror: legs R is legs L x 0.9259 in width (25/27), same heights.**

### 3.4 lower legs L `303:5048` (74, 200) 24 x 22 · lower legs R `303:5049` (160, 199) 24 x 22

| node | parent group | name | x | y | w | h | rot | mir | fill |
|---|---|---|---|---|---|---|---|---|---|
| `303:5043` | seg 1 `303:5040` | leg (L) | 80 | 200 | 18 | 11 | 0 | . | `--bell-cap-lo` |
| `303:5046` | seg 2 `303:5045` | leg (L) | 74 | 211 | 12 | 11 | 0 | . | `--bell-cap-lo` |
| `303:5051` | seg 1 `303:5050` | leg (R) | 160 | 199 | 18 | 11 | 0 | Y | `--bell-cap-lo` |
| `303:5053` | seg 2 `303:5052` | leg (R) | 172 | 210 | 12 | 11 | 0 | Y | `--bell-cap-lo` |

Two blocks each, in `seg 1` / `seg 2` subgroups so a knee can bend independently.
**lower legs R sits 1px higher than L** (y 199/210 vs 200/211) — that asymmetry is in the file.

### 3.5 claw L — `302:310`, ink box (-6, 127.361) 72.431 x 59.837

Every rect: **rot = -176.05°**, about its own origin corner (Figma shows `rotation: 176.05`). Only
3 widths (19.5209 / 29.2813 / 39.0417) and 3 heights (22.1430 / 8.8572 / 4.4286) exist.

| node | name | x | y | w | h | centre | AABB x, y, w, h | fill |
|---|---|---|---|---|---|---|---|---|
| `302:300` | pincer | 13.475 | 187.198 | 19.5209 | 22.1430 | 4.500, 175.480 | -6, 163.763, 21, 23.435 | `--bell-cap-mid` |
| `302:301` | pincer | 52.728 | 185.469 | 19.5209 | 8.8572 | 43.296, 180.379 | 33.254, 175.288, 20.085, 10.181 | `--bell-cap-mid` |
| `302:302` | pincer | 43.601 | 175.960 | 19.5209 | 4.4286 | 34.017, 173.079 | 24.127, 170.197, 19.780, 5.763 | `--bell-cap-mid` |
| `302:303` | pincer | 43.906 | 171.542 | 29.2813 | 4.4286 | 29.453, 168.324 | 14.695, 165.107, 29.517, 6.435 | `--bell-cap-mid` |
| `302:304` | pincer | 44.212 | 167.124 | 39.0417 | 4.4286 | 24.890, 163.570 | 5.263, 160.016, 39.254, 7.108 | `--bell-cap-mid` |
| `302:305` | pincer | 34.779 | 162.034 | 19.5209 | 4.4286 | 25.195, 159.153 | 15.305, 156.271, 19.780, 5.763 | `--bell-cap-mid` |
| `302:306` | arm | 35.084 | 157.616 | 19.5209 | 8.8572 | 25.652, 152.526 | 15.610, 147.435, 20.085, 10.181 | `--bell-cap-lo` |
| `302:307` | arm | 45.432 | 149.452 | 19.5209 | 8.8572 | 36.000, 144.362 | 25.957, 139.271, 20.085, 10.181 | `--bell-cap-lo` |
| `302:308` | arm | 55.779 | 141.288 | 19.5209 | 8.8572 | 46.347, 136.198 | 36.304, 131.107, 20.085, 10.181 | `--bell-cap-lo` |
| `302:309` | arm | 66.126 | 133.124 | 19.5209 | 4.4286 | 56.542, 130.243 | 46.652, 127.361, 19.780, 5.763 | `--bell-cap-lo` |

### 3.6 claw R — `302:299`, ink box (189.778, 126.656) 76.101 x 69.929

Every rect: **rot = +175.87°** (Figma `rotation: -175.87`). Widths 20.3077 / 30.4616 / 40.6154,
heights 25.8252 / 10.3301 / 5.1650.

| node | name | x | y | w | h | centre | AABB x, y, w, h | fill |
|---|---|---|---|---|---|---|---|---|
| `302:289` | pincer | 265.879 | 195.123 | 20.3077 | 25.8252 | 254.822, 182.975 | 243.765, 169.365, 22.115, 27.221 | `--bell-cap-mid` |
| `302:290` | pincer | 224.997 | 192.896 | 20.3077 | 10.3301 | 214.498, 188.476 | 203.998, 182.593, 20.999, 11.766 | `--bell-cap-mid` |
| `302:291` | pincer | 234.380 | 181.862 | 20.3077 | 5.1650 | 224.067, 180.017 | 213.753, 176.710, 20.627, 6.614 | `--bell-cap-mid` |
| `302:292` | pincer | 244.136 | 175.979 | 30.4616 | 5.1650 | 228.759, 174.500 | 213.382, 170.827, 30.754, 7.345 | `--bell-cap-mid` |
| `302:293` | pincer | 253.891 | 170.096 | 40.6154 | 5.1650 | 233.450, 168.983 | 213.009, 164.944, 40.882, 8.077 | `--bell-cap-mid` |
| `302:294` | pincer | 243.392 | 165.676 | 20.3077 | 5.1650 | 233.079, 163.831 | 222.765, 160.524, 20.627, 6.614 | `--bell-cap-mid` |
| `302:295` | arm | 243.020 | 160.524 | 20.3077 | 10.3301 | 232.521, 156.104 | 222.021, 150.221, 20.999, 11.766 | `--bell-cap-lo` |
| `302:296` | arm | 232.148 | 150.952 | 20.3077 | 10.3301 | 221.649, 146.532 | 211.149, 140.649, 20.999, 11.766 | `--bell-cap-lo` |
| `302:297` | arm | 221.277 | 141.380 | 20.3077 | 10.3301 | 210.778, 136.960 | 200.278, 131.077, 20.999, 11.766 | `--bell-cap-lo` |
| `302:298` | arm | 210.405 | 131.808 | 20.3077 | 5.1650 | 200.092, 129.963 | 189.778, 126.656, 20.627, 6.614 | `--bell-cap-lo` |

**How a claw reads.** From the shoulder (`arm_4` / `arm_8`, top, touching the shell) four `cap-lo`
rungs step down-and-outward — L by (-10.347, +8.164) per rung, R by (+10.872, +9.572) — then six
`cap-mid` rungs of decreasing length (19.5 → 39 → 29 → 19.5) fan out into the jaw, closed by one
tall block (22.1 / 25.8) at the very tip. Because each rung is stored 180°-flipped, the *visible*
tilt of the long axis is only **3.95° on L and 4.13° on R**, outboard end up in both cases. If you
prefer the small-angle form: draw the rect at `centre` and use `rotate(3.95 cx cy)` for L,
`rotate(-4.13 cx cy)` for R — identical output.

## 4. `specs` — `315:654`, group box (39, 72) 173 x 41.0851

**Not token-bound and deliberately so: 26 rects at raw `#000000`, plus 2 lens VECTORs at raw
`#0079b5` with 42% *paint* opacity. Record it exactly; do not swap in `--ink`.** Nesting is
`specs > frame L > Group 3 > Group 4 > [Rectangle 15] + Group 1 > 12 rects` and the mirror image for
frame R. The intermediate groups carry nothing but grouping — flatten them if you like, but keep
the four-way paint order **frame L → lens R → frame R → lens L** (TRAPS 4).

Roles below are read off the geometry (Figma only auto-named them `Rectangle n`).

### 4.1 frame L — 13 rects, ink (39, 72) 95.177 x 41.085

| node | Figma name | role | x | y | w | h | rot | mir |
|---|---|---|---|---|---|---|---|---|
| `315:617` | Rectangle 15 | ear hook (vertical) | 39 | 93.5445 | 6.0471 | 13.2775 | 0 | . |
| `315:591` | Rectangle 1 | rim top bar | 74.7564 | 72 | 37.5973 | 4.7599 | 0 | . |
| `315:603` | Rectangle 8 | rim bottom bar | 73.7054 | 108.325 | 37.5973 | 4.7599 | 0 | . |
| `315:592` | Rectangle 2 | rim step, top inboard | 105.2554 | 76.7597 | 11.8313 | 4.7599 | 0 | . |
| `315:613` | Rectangle 12 | rim step, top outboard | 67.3951 | 76.7597 | 11.8313 | 4.7599 | 0 | . |
| `315:601` | Rectangle 7 | rim step, bottom inboard | 105.7814 | 103.565 | 11.8313 | 4.7599 | 0 | . |
| `315:609` | Rectangle 9 | rim step, bottom outboard | 67.921 | 103.565 | 11.3055 | 4.7599 | 0 | **Y** |
| `315:594` | Rectangle 3 | bridge bar (inboard) | 112.6174 | 81.5196 | 21.5593 | 4.7599 | 0 | . |
| `315:610` | Rectangle 10 | temple bar (outboard) | 51.883 | 81.5196 | 20.7705 | 4.7599 | 0 | **Y** |
| `315:599` | Rectangle 6 | rim side, inboard | 112.6894 | 103.5830 | 17.2849 | 4.9182 | **-90.239** | . |
| `315:611` | Rectangle 11 | rim side, outboard | 72.5744 | 103.5830 | 17.2849 | 4.7360 | **-89.770** | **Y** |
| `315:615` | Rectangle 13 | temple, step down | 45.31 | 86.2795 | 13.1459 | 3.7578 | 0 | . |
| `315:616` | Rectangle 14 | temple tip | 39 | 90.0372 | 12.883 | 3.5073 | 0 | . |

The two rotated bars are near-vertical: as drawn they occupy AABB **(112.617, 86.280) 4.990 x
17.303** (`315:599`) and **(67.838, 86.280) 4.805 x 17.303** (`315:611`). Exact source transforms,
already shifted into component coordinates:
`315:599 = matrix(-0.00416511 -0.999991 0.999993 -0.00378152 112.6894 103.5830)`,
`315:611 = matrix(0.00401085 -0.999992 -0.999992 -0.00392697 72.5744 103.5830)`.

### 4.2 frame R — 13 rects, ink (124.186, 72) 87.815 x 41.085

| node | Figma name | role | x | y | w | h | rot | mir |
|---|---|---|---|---|---|---|---|---|
| `315:639` | Rectangle 15_2 | ear hook (vertical) | 206.421 | 93.5446 | 5.5794 | 13.2775 | 0 | **Y** |
| `315:641` | Rectangle 1_2 | rim top bar | 144.319 | 72 | 34.6892 | 4.7599 | 0 | **Y** |
| `315:642` | Rectangle 8_2 | rim bottom bar | 145.290 | 108.325 | 34.6892 | 4.7599 | 0 | **Y** |
| `315:643` | Rectangle 2_2 | rim step, top inboard | 139.953 | 76.7597 | 10.9162 | 4.7599 | 0 | **Y** |
| `315:644` | Rectangle 12_2 | rim step, top outboard | 174.885 | 76.7597 | 10.9162 | 4.7599 | 0 | **Y** |
| `315:645` | Rectangle 7_2 | rim step, bottom inboard | 139.468 | 103.565 | 10.9162 | 4.7599 | 0 | **Y** |
| `315:648` | Rectangle 9_2 | rim step, bottom outboard | 174.885 | 103.565 | 10.4310 | 4.7599 | 0 | . |
| `315:646` | Rectangle 3_2 | bridge bar (inboard) | 124.186 | 81.5197 | 19.8917 | 4.7599 | 0 | **Y** |
| `315:649` | Rectangle 10_2 | temple bar (outboard) | 180.9494 | 81.5197 | 19.1640 | 4.7599 | 0 | . |
| `315:647` | Rectangle 6_2 | rim side, inboard | 144.010 | 103.5830 | 17.2849 | 4.5378 | **-89.780** | **Y** |
| `315:650` | Rectangle 11_2 | rim side, outboard | 181.0224 | 103.5830 | 17.2849 | 4.3697 | **-90.212** | . |
| `315:651` | Rectangle 13_2 | temple, step down | 194.049 | 86.2795 | 12.1291 | 3.7578 | 0 | **Y** |
| `315:652` | Rectangle 14_2 | temple tip | 200.114 | 90.0372 | 11.8865 | 3.5073 | 0 | **Y** |

Rotated-bar AABBs: `315:647` **(139.473, 86.280) 4.604 x 17.303**, `315:650` **(180.958, 86.280)
4.434 x 17.303**. Source transforms:
`315:647 = matrix(0.00384295 -0.999993 -0.999992 -0.00409853 144.010 103.5830)`,
`315:650 = matrix(-0.00370062 -0.999993 0.999991 -0.00425617 181.0224 103.5830)`.

Paint order inside each frame is exactly the table order above (top bar first, temple tip last).

### 4.3 the 2 lens VECTORs

| node | name | bbox (path centreline) | fill | stroke |
|---|---|---|---|---|
| `315:655` | lens L | (72.592, 76.7772) 40.1103 x 31.5304 | `#0079B5` @ **42%** | `#000000`, 1px, CENTER |
| `315:656` | lens R | (141.281, 73.9108) 42.1158 x 36.3077 | `#0079B5` @ **42%** | `#000000`, 1px, CENTER |

Both are 12-vertex stepped octagons — a tall centre rect with a wing bulging out each side. Path
data in **component coordinates** (the scaleX -1 that `315:656` carries in Figma is already baked
in here, so use these verbatim):

```
lens L  M79.11 108.308H105.683V103.53H112.702V81.5545H105.181V76.7772H79.11V81.5545H72.592V103.53H79.11V108.308Z
lens R  M176.553 110.219H148.651V104.717H141.281V79.412H149.177V73.9108H176.553V79.412H183.397V104.717H176.553V110.219Z
```

The 1px centre stroke makes each *render* box 1px larger than the node box (that is why codegen
insets the image by -0.5px on each edge). The nose bridge is where the two `bridge bar` rects
overlap: **x 124.186 … 134.177, y 81.520 … 86.280**, centre **(129.18, 83.90)** — the natural
origin for a specs push-up, though Figma stores no pivot for `specs`.

## 5. Layout map

One character = **4 x 4 px**, sampled at cell centres from the measured geometry above, painted in
z-order — so it is schematic at the edges of the tilted claws and the lens octagons. Row labels are
component y; the ruler marks component x. `X` specs bar · `~` lens glass · `o` socket · `@` pupil ·
`|` stalk · `#` shell · `a` claw arm · `C` claw pincer · `L` leg.

```
   68 |                                               XXXXXXXX               |
   72 |                     XXXXXXXXX         ~XX~~~~  XXX                   |
   76 |                   XXXXXX~~~XXX       XXXXX~~~                        |
   80 |                    ~~oooooo~~XXXXXX ~~~oooooo~XXXXX   X              |
   84 |                    ~~oooooo~~XXXXXX ~~~oooooo~XXXXX  XXX             |
   88 |             XXXX   ~~oo@@oo~~X      ~~~oo@@oo~X       XXX            |
   92 |            X       ~~oo@@oo~~X      ~~~oo@@oo~X                      |
   96 |            X       ~~oooooo~~X      ~~~oooooo~X                      |
  100 |            X       ~~XXXooo~~X      ~~~XXoooo~X                      |
  104 |            X       X ~~||~~XXX       X~~~||~~XXXXXXXXXX              |
  108 |                    XXXXXXXXXX        X~~~||~~                        |
  112 |                    X   ||            X   ||                          |
  116 |                    X   ||            X   ||                          |
  120 |                    ############################                      |
  124 |                    ############################                      |
  128 |              aaaa################################aaaaa               |
  132 |           aaaaa  ################################  aaaaa             |
  136 |           aaaaa  ################################  aaaaa             |
  140 |         aaaa     ################################  aaaaaaaa          |
  144 |         aaaa     ################################     aaaaa          |
  148 |      aaaaa       ################################     aaaaa          |
  152 |      aaaaa       ################################        aaaaa       |
  156 |      CCCCC       ################################        aaaaa       |
  160 |   CCCCCCCC       ################################        CCCCC       |
  164 | CCCCCCCCCCCC     ################################        CCCCCCC     |
  168 | CCCCC CCCCCC     ################################     CCCCCCCCCC CC  |
  172 | CCCCC  CCCCC     ################################     CCCCCCCCCCCCC  |
  176 | CCCCC    CCCCC   ################################  LLLLCCCCC  CCCCC  |
  180 | CCCC     CCCCC   ################################  LLLLCCCC   CCCCC  |
  184 | CCCC             ################################  LLLLCC     CCCCC  |
  188 |               LLLLL###########################LLLL LLLLCC     CCCCC  |
  192 |               LLLLL###########################LLLL LLLL       CCCCC  |
  196 |               LLLLL###########################LLLL LLLL              |
  200 |             LLLLL    LLLLL                     LLL                   |
  204 |             LLLLL    LLLLL                     LLL                   |
  208 |             LLLLL    LLLLL                                           |
  212 |             LLL     LLL                                              |
  216 |             LLL     LLL                                              |
  220 |                     LLL                                              |
      +----------------------------------------------------------------------+
        ^               ^               ^               ^               ^
        x=0             64              128             192             256
```

Reading it: the specs sit on top of both eyes and reach out to ear hooks at x 39 and x 212; the
sockets peek out around the lens glass; the stalks drop into the shell's top band; the claws come
off the shell's upper corners and swing down-outward past the frame edges; the legs hang below,
outer pair at x 45–72 / 184–209 and inner pair at 74–98 / 160–184.

## 6. Mr. Bell Mark — `363:5`, 64 x 64

15 RECTANGLEs, **direct children of the component** (no groups, no pivots, no rotation, no mirror,
radius 0), all on a **4px grid**. Deliberately coarser than the rig's 8px so it survives 26px. Ink
occupies (4, 8) 56 x 48, centred both ways. Listed in **paint order**.

| # | node | name | x | y | w | h | fill |
|---|---|---|---|---|---|---|---|
| 1 | `366:70` | claw L | 4 | 36 | 8 | 8 | `--bell-cap-lo` |
| 2 | `366:71` | claw L tip | 4 | 44 | 4 | 4 | `--bell-cap-lo` |
| 3 | `366:72` | claw R | 52 | 36 | 8 | 8 | `--bell-cap-lo` |
| 4 | `366:73` | claw R tip | 56 | 44 | 4 | 4 | `--bell-cap-lo` |
| 5 | `366:74` | leg 1 | 14 | 52 | 12 | 4 | `--bell-cap-lo` |
| 6 | `366:75` | leg 2 | 26 | 52 | 12 | 4 | `--bell-cap-lo` |
| 7 | `366:76` | leg 3 | 38 | 52 | 12 | 4 | `--bell-cap-lo` |
| 8 | `366:77` | stalk L | 16 | 28 | 4 | 4 | `--bell-cap-mid` |
| 9 | `366:78` | stalk R | 44 | 28 | 4 | 4 | `--bell-cap-mid` |
| 10 | `366:79` | shell | 12 | 32 | 40 | 20 | `--bell-cap-mid` |
| 11 | `366:80` | bridge | 28 | 14 | 8 | 8 | `--bell-cap-lo` |
| 12 | `366:81` | lens L | 8 | 8 | 20 | 20 | `--bell-cap-hi` |
| 13 | `366:82` | lens R | 36 | 8 | 20 | 20 | `--bell-cap-hi` |
| 14 | `366:83` | pupil L | 14 | 14 | 8 | 8 | `--page-ink` |
| 15 | `366:84` | pupil R | 42 | 14 | 8 | 8 | `--page-ink`

```
 y= 8  +--------+  lens L 8..28        lens R 36..56      (20x20 cap-hi)
 y=14  |  ####  |  pupil 14..22 inside each lens; bridge 28..36 joins them
 y=28  stalk L 16..20        stalk R 44..48                (4x4 cap-mid)
 y=32  +----------------------------+  shell 12..52 x 32..52 (40x20 cap-mid)
 y=36  claw L 4..12   |  shell  |   claw R 52..60           (8x8 cap-lo)
 y=44  claw tips 4..8 and 56..60                           (4x4 cap-lo)
 y=52  legs 14..26 | 26..38 | 38..50, each 12x4            (cap-lo)
 y=56  bottom of ink
```

Note the mark has **no black spectacle frame**: the specs are solid `cap-hi` lens blocks joined by a
fat `cap-lo` bridge, with `page-ink` pupils sitting directly inside the lenses. A 4px ink ring
measures 1.6px at 26px and disappeared, hence the solid-block treatment. There are also no eye
sockets — the pupils are in the lenses. Mirror symmetry about x 32 is exact except `claw L tip`
(x 4) vs `claw R tip` (x 56): both are 4 wide, so the L tip sits flush with the claw's outer edge
and the R tip flush with its inner edge. That is in the file; keep it or fix it deliberately.

## 7. Rebuilding it as an animatable SVG

```html
<svg viewBox="0 0 256 256" width="256" height="256"
     style="overflow:visible" shape-rendering="crispEdges">
  <g id="body">                                          <!-- translate/scale to bob -->
    <g id="claw-L" style="transform-origin:66.4314px 132px">…10 rects…</g>
    <g id="claw-R" style="transform-origin:189.7788px 131px">…10 rects…</g>
    <g id="shell">…3 rects…</g>
    <g id="eye-L">…stalk, socket, pupil…</g>
    <g id="eye-R">…stalk, socket, pupil…</g>
    <g id="specs">frame-L(13) · lens-R · frame-R(13) · lens-L</g>
  </g>
  <g id="legs-R"       style="transform-origin:196.5px 189px">…3 rects…</g>
  <g id="legs-L"       style="transform-origin:58.5px 189px">…3 rects…</g>
  <g id="lower-legs-L" style="transform-origin:86px 200px">…seg1, seg2…</g>
  <g id="lower-legs-R" style="transform-origin:172px 199px">…seg1, seg2…</g>
</svg>
```

- Add `transform-box: view-box` alongside every px `transform-origin`, or skip CSS entirely and use
  the SVG attribute form `transform="rotate(deg cx cy)"` with the centres from §2.
- `overflow: visible` must be set in CSS — the UA sheet clips the outermost `<svg>` regardless of
  the attribute, and 6px of claw L / 9.879px of claw R live outside the viewBox.
- Sizes in use: **160px (x0.625)** in every sidebar mascot slot, **96px (x0.375)** in the update
  dialog. Both keep the 8px cells on whole pixels (5px and 3px); the claws and legs do not, so they
  anti-alias at every size — keep claw motion **rotational**, never whole-pixel stepped.
- Give the rects a class per token, not per node, so a tone or brand change is one declaration:
  17 x `--bell-cap-mid`, 20 x `--bell-cap-lo`, 2 x `--page-ink`, 26 x `#000`, 2 x the lens fill.

## 8. TRAPS

1. **The legs paint in front of the shell, the claws behind it.** The four leg pivots are siblings
   of `body` and come *after* it, so anything you lift a leg over will cross the shell; the claws are
   the first two children of `body`, so sliding a claw inward tucks its shoulder under the shell.
   Both behaviours are load-bearing — do not "fix" the order.
2. **claw R is not a mirror of claw L.** Same 10-rect construction, but every claw R rect is claw L
   x **1.0403 in width** and x **1.16628 in height** (19.5209→20.3077, 4.4286→5.1650,
   8.8572→10.3301, 22.1430→25.8252, 29.2813→30.4616, 39.0417→40.6154), and the tilt differs
   (3.95° vs 4.13°). Build both from the tables; mirroring one produces a visibly lighter claw.
3. **Nor are the legs mirrored.** legs R rects are 8.3333/16.6667 wide against legs L's 9/18
   (x 25/27), and `lower legs R` sits **1px higher** than `lower legs L` (y 199/210 vs 200/211).
4. **`specs` paint order interleaves:** frame L, **lens R**, frame R, **lens L**. Because the lens
   fill is only 42% opaque, lens L darkens frame L's bars where they overlap while lens R sits under
   frame R's. Reorder it and the spectacles change tone.
5. **The specs are 2.5px left of centre.** Their bbox is x 39…212 → centre 125.5, against the body's
   128. frame L is also wider than frame R (95.177 vs 87.815) and neither lens centres on its eye
   (lens L centre 92.647 vs socket 92; lens R 162.339 vs 164). Hand-drawn, and it reads fine —
   just do not "correct" it to symmetry unless you are redrawing both frames.
6. **The lens vectors carry a raw 1px `#000000` CENTER stroke** on top of the 42% `#0079b5` fill.
   Drop the stroke and the glass loses its outline; drop the 42% and it goes solid teal. (In Figma
   this is *paint* opacity, which `clone()` flattens — a known hazard on that file.)
7. **26 specs rects are raw `#000000` with no variable binding.** Deliberate: the spectacles are
   meant to be ink-black in both tones. `--ink` is `#ffffff` in Night and would erase them.
8. **Rotation sign:** Figma's `rotation` field is the negative of the SVG/CSS angle used here, and
   each claw rung is stored **180°-flipped**, so Figma shows `176.05` / `-175.87` where the visible
   tilt is only 3.95° / 4.13°. Reading Figma's number straight into `rotate()` flips the rung.
9. **Figma's claw GROUP boxes are looser than the ink.** `claw L` reports (-5.991, 123.994)
   72.422 x 66.566 and `claw R` (189.7788, 122.999) 76.104 x 77.238 — roughly 3.4px (L) and 3.7px
   (R) of phantom height above *and* below the union of the rect AABBs given in §3.5/§3.6. Trust the
   rects; do not lay out against the group box.
10. **`bell/*` has no Code Syntax mapping in Figma**, so `get_design_context` emits
    `var(--bell/cap-mid, #2c7bff)` — a slash makes that an invalid custom-property name. Write
    `--bell-cap-mid` / `--bell-cap-lo` / `--bell-cap-hi`. `paper/ink` *is* mapped and arrives
    correctly as `var(--page-ink)`.
11. **`get_metadata` is useless below the top level here** — it returns zero children for `body`,
    the pivots and every leaf group. It also prints `<rounded-rectangle>` for every RECTANGLE; that
    is the node type, not a radius. **Nothing in either component has a corner radius.**
12. **Never put a Figma stroke on the crab.** 65 separate rects means a stroke draws borders
    *between* adjacent blocks, gridding the shell; a stroke on the component frame just outlines the
    bounding box. Use a shadow or glow. (Placements already do: the sidebar mascot carries its own
    drop shadow outside the component.)
13. **The pivot frames are empty and mostly air** — `legs L pivot` starts at y 152 but its ink
    starts at 189. Do not treat a pivot box as a limb bounding box.
14. **`specs` must stay the last child of `body`.** It was a page-level sibling once and desynced
    from every body bob.
15. **19 nodes are stored mirrored** (`matrix(-1 0 0 1 tx ty)`, plus `lens R`): 16 plain rects, 2 of
    the near-vertical specs bars, and the lens. Visually a no-op for solid rects, but Figma's `x`
    for those is the **right** edge — the tables above already give the effective left edge.
16. If you re-export the SVG yourself: the export bbox is **325 x 256** because the empty claw
    pivot frames extend past the component, so **`x_svg = x_component + 29.5686`**. Every number in
    this spec is component-space already.

---

Measured 2026-09-03 from `get_design_context` on `374:77` and `363:5`, `get_metadata` boxes, and a
read-only SVG export of `374:77`. The export and the two lens vectors are on disk at
`C:\Users\Evo\.bell-ref\tmp\mrbell.svg`, `lens1.svg` (lens R), `lens2.svg` (lens L) — the Figma
asset URLs they came from expire after 7 days. Motion timings for the twelve poses live on
`Motion — Mr. Bell` (`331:289`) and are not in scope here.
