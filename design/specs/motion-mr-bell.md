# Motion — Mr. Bell, Update, Tone (measured timeline spec)

Three pages, seventeen timelines. Everything below is measured: the fourteen timelines on
`331:289` and `443:2` were read live with `get_motion_context`; the three on `166:2` come from the
authoring record (see §9 Provenance). Times are **seconds on the frame's own timeline**, exactly as
authored — no rounding.

| page | id | frames |
|---|---|---|
| Motion — Mr. Bell | `331:289` | 12 × 384 x 336 |
| Motion — Update | `443:2` | `443:64` notice 280 x 880 · `448:102` dialog 1320 x 860 |
| Motion — Tone | `166:2` | `166:3` Toggle D→N 420 x 150 · `170:5` Toggle N→D · `171:8` Transition 1320 x 860 |

The twelve mascot frames sit on a 424 x 400 grid (x = 0/424/848/1272, y = 72/472/872) and each holds
its **own detached clone** of the rig — art edits on `Brand — Mr. Bell` do not propagate. All are
`clipsContent: false`, radius 16, fill `--ground`, **Night mode pinned**, except `344:588 scuttle`
which is the only frame with `clipsContent: true`.

---

## 1. THE RIG — the only structural contract motion needs

`Mr. Bell` is a 256 x 256 FRAME at **(62, 40)** inside each 384 x 336 frame. Coordinates below are
in Mr. Bell space. (`get_metadata` reports group children in frame space, so these numbers are
directly comparable.) Full art inventory lives in the brand/mascot spec — this is the rig only.

```
Mr. Bell  256x256                                        z-order: bottom → top
├─ body            GROUP  (-29.569, 26)  324.347 x 210   ← one track moves the whole animal
│  ├─ claw L pivot FRAME  (-29.569, 36)  192 x 192       joint/centre (66.431, 132)
│  ├─ claw R pivot FRAME  ( 84.779, 26)  210 x 210       joint/centre (189.779, 131)
│  ├─ shell        FRAME  ( 64, 120)     128 x 80        draws OVER both claws
│  ├─ eye L        FRAME  ( 80,  80)      24 x 40        socket 24x24 + pupil 8x8 + stalk 8x16
│  ├─ eye R        FRAME  ( 152, 80)      24 x 40
│  └─ specs        FRAME  ( 39,  72)     173 x 41.085    26 raw #000 rects + lens L/R VECTORs
├─ legs R pivot    FRAME  (159.5, 152)    74 x 74        centre (196.5, 189)
├─ legs L pivot    FRAME  ( 21.5, 152)    74 x 74        centre ( 58.5, 189)
├─ lower legs L    FRAME  ( 58, 172)      56 x 56        centre ( 86, 200)
└─ lower legs R    FRAME  (144, 171)      56 x 56        centre (172, 199)
```

- The four leg pivots are **siblings of `body`, not children** — that is what lets the legs stay
  planted while the shell moves, and it is why a jump arc must go on `Mr. Bell` (§7.1).
- The six `* pivot` frames are empty, unclipped frames **centred on their joint**. In CSS they are
  wrappers with the default `transform-origin: 50% 50%`; the centre column above is the joint.
- Inside an eye: `socket` 24 x 24 at the top (the white), `pupil` 8 x 8 on top of it moving on a
  ±8px grid, `stalk` 8 x 16 bottom-centre at (8, 24) with its **top edge pinned**.
- Claw pivots overhang the 256 box (claw L spans −29.57 → 162.43). Nothing clips.

---

## 2. NOTATION, and how a Figma track becomes a CSS @keyframes

Every table row is one **track** = one node × one property. Keyframes read
`t easing value`, in order.

| token | meaning | CSS |
|---|---|---|
| `LIN` | linear (Figma default when no easing given) | `linear` |
| `OUT` | `EASE_OUT` | `ease-out` ≈ `cubic-bezier(0,0,.58,1)` |
| `IN` | `EASE_IN` | `ease-in` ≈ `cubic-bezier(.42,0,1,1)` |
| `EIO` | `EASE_IN_AND_OUT` | `ease-in-out` ≈ `cubic-bezier(.42,0,.58,1)` |
| `BACK` | `EASE_OUT_BACK` | `cubic-bezier(.34,1.56,.64,1)` |
| `HOLD` | step — **hold the previous value until this time, then jump** | duplicate the previous value at `t − 1 frame`, or `steps(1, jump-end)` on the preceding stop |
| `bez(a,b,c,d)` | `CUSTOM_CUBIC_BEZIER` | `cubic-bezier(a,b,c,d)` |

Rules that bite:

1. **Easing belongs to the segment that ENDS at the keyframe it is written on.** `0 → 0 · 0.55 EIO
   −8` means: ease-in-out from 0 to −8 over 0 → 0.55s.
2. **`ROTATION` is CCW-positive in Figma, CW-positive in CSS.** Every angle in this document is
   already **CSS-signed**; the file's authored value is its negation. (Verified: the push-up claw is
   authored `+62/+68` and reads back `rotate: -62/-68`.)
3. `TRANSLATE_X/Y/XY` are plain px, same sign as CSS `translate`. `TRANSLATION_XY` is **one** track
   carrying both axes — a second track on the same property replaces the first.
4. `SCALE_XY` / `SCALE_Y` scale about the node's **own centre**. Keep `transform-origin: 50% 50%`.
5. `HEIGHT` / `WIDTH` are absolute px on a rect that keeps its x/y, i.e. it grows **down / right**
   from its top-left. Animate the real `height`/`width`, not a `scale`.
6. `fills[n]` tracks interpolate a paint colour **including its alpha** — the keyframe's alpha
   overrides the paint's own opacity (§8.13).
7. A track that starts late gets a synthetic `t=0` keyframe in the read-back. It is a hold, not a
   beat; this spec lists the real first keyframe.
8. **Every timeline in the file is `loopMode: loop`,** one-shots included. The "loop" column below is
   design intent, taken from each frame's own caption, not from the file flag.

Rig-wide idioms reused verbatim across frames:

| idiom | tracks |
|---|---|
| **blink** (110ms, stepped) | `socket` SCALE_Y `t 1 · t+0.07 HOLD 0.333 · t+0.18 HOLD 1` + `pupil` OPACITY `t 1 · t+0.07 HOLD 0 · t+0.18 HOLD 1`. Right eye always **+40ms** after left. |
| **specs flick** (the push-up) | `claw R pivot` ROTATION `0 · OUT −62 · EIO −68 · EIO 0` + TRANSLATE_XY `(0,0) · OUT (−56,−2) · EIO (−60,−2) · EIO (0,0)`, then `specs` TRANSLATE_Y stepped `0 −8 −16 −8 0` and pupils `(0,−8)`. |
| **periscope** (24px telescope) | `eye` TRANSLATE_Y `0 −8 −16 −24` (all HOLD, 80ms apart) + `stalk` HEIGHT `16 24 32 40` on the *same* times + `specs` TRANSLATE_Y matching the eye. Right eye **+60ms**. |

---

## 3. THE TWELVE MASCOT TIMELINES

### 3.1 `332:469` idle · 2.5s · **seamless loop**

Crab `344:2`, body `344:3`.

| node | id | track | keyframes |
|---|---|---|---|
| body | `344:3` | TRANSLATE_Y | `0 0` · `0.55 HOLD -8` · `1.15 HOLD 0` · `1.80 HOLD -8` · `2.35 HOLD 0` |
| claw L pivot | `344:4` | ROTATION | `0 0` · `1.25 EIO -2` · `2.50 EIO 0` |
| claw R pivot | `344:16` | ROTATION | `0 0` · `1.25 EIO +2` · `2.50 EIO 0` |
| eye L pupil | `344:35` | TRANSLATE_XY | `0 (0,0)` · `0.40 HOLD (-8,0)` · `0.90 HOLD (8,0)` · `1.40 HOLD (8,8)` · `1.80 HOLD (0,0)` |
| eye R pupil | `344:39` | TRANSLATE_XY | identical, no offset |
| eye L socket | `344:34` | SCALE_Y | blink @ **1.98** → 2.05 → 2.16 |
| eye L pupil | `344:35` | OPACITY | blink @ **1.98** |
| eye R socket | `344:38` | SCALE_Y | blink @ **2.02** → 2.09 → 2.20 |
| eye R pupil | `344:39` | OPACITY | blink @ **2.02** |

Loop: every track is back at its `t=0` value by 2.35s, so the 150ms tail is the seam. Percentages
for a hand-written `@keyframes`: 22 / 46 / 72 / 94 % for the bob; blink 79.2 / 82 / 86.4 %.
One pixel of bob = **8 units** at rig scale (the whole rig is on an 8px grid; at the sidebar's 160px
instance that is 0.625 × 8 = 5px on screen).

### 3.2 `332:470` specs push-up · 1.2s · one-shot

Crab `344:99`. The claw swings from the shoulder; the inward slide is invisible because `shell`
draws over the claws.

| node | id | track | keyframes |
|---|---|---|---|
| claw R pivot | `344:113` | ROTATION | `0 0` · `0.24 OUT -62` · `0.34 EIO -68` · `0.75 EIO 0` |
| claw R pivot | `344:113` | TRANSLATE_XY | `0 (0,0)` · `0.24 OUT (-56,-2)` · `0.34 EIO (-60,-2)` · `0.75 EIO (0,0)` |
| specs | `344:137` | TRANSLATE_Y | `0.26 0` · `0.32 HOLD -8` · `0.40 HOLD -16` · `0.62 HOLD -8` · `0.78 HOLD 0` |
| eye L/R pupil | `344:132` `344:136` | TRANSLATE_XY | `0.28 (0,0)` · `0.36 HOLD (0,-8)` · `0.68 HOLD (0,0)` |
| eye L socket/pupil | `344:131` `344:132` | SCALE_Y / OPACITY | blink @ **0.95** → 1.02 → 1.13 |
| eye R socket/pupil | `344:135` `344:136` | SCALE_Y / OPACITY | blink @ **0.99** → 1.06 → 1.17 |

Beats: claw arrives 0.24 → specs jump **on the frame it lands** (0.32, two whole pixels by 0.40) →
settle 0.62–0.78 → blink closes the shot. There is no hover pause; an earlier cut had one and it
read as hesitation.

### 3.3 `344:196` periscope · 1.6s · loop

Crab `344:197`. `off` = **0** for L, **+0.06** for R. The stalk grows exactly as much as the eye
rises, so its foot never leaves the shell.

| node | id | track | keyframes |
|---|---|---|---|
| eye L | `344:227` | TRANSLATE_Y | `0.15 0` · `0.23 HOLD -8` · `0.31 HOLD -16` · `0.39 HOLD -24` · `1.15 HOLD -16` · `1.23 HOLD -8` · `1.31 HOLD 0` |
| eye L stalk | `344:228` | HEIGHT | same 7 times: `16 · 24 · 32 · 40 · 32 · 24 · 16` |
| eye R | `344:231` | TRANSLATE_Y | same, **+0.06** on every time (0.21 … 1.37) |
| eye R stalk | `344:232` | HEIGHT | same, +0.06 |
| specs | `344:235` | TRANSLATE_Y | **identical to eye L, no offset** |
| eye L/R pupil | `344:230` `344:234` | TRANSLATE_XY | `0.45 (0,0)` · `0.55 HOLD (-8,0)` · `0.80 HOLD (8,0)` · `1.05 HOLD (0,0)` |

The extended pose is held 0.39 → 1.15 (760ms) and the scan happens inside it. Retraction lands at
1.31, leaving 290ms of rest before the loop.

### 3.4 `344:294` lens draw-on · 1.8s · loop

Crab `344:295`. **28 OPACITY tracks**, one per spectacle part, staggered in **x order**:
`t(i) = 0.05 + 0.028 i`, `i = 0 … 27`. Every track is

```
(t(i) − 0.02) → 0   ·   t(i) HOLD 1   ·   1.68 HOLD 0
```

so each part snaps on, all of them hold, and all of them clear together at 1.68 — a single 120ms
blank beat before the loop restarts. (An earlier cut cleared at 1.55, and the 250ms gap read as a
glitch.)

The 26 rects are named out of order — **sort by absolute x, never by name.** Measured order:

| i | node | id | i | node | id | i | node | id |
|---|---|---|---|---|---|---|---|---|
| 0 | Rectangle 15 | `344:337` | 10 | Rectangle 7 | `344:343` | 20 | Rectangle 9 | `344:363` |
| 1 | Rectangle 14 | `344:350` | 11 | Rectangle 6 | `344:345` | 21 | Rectangle 10 | `344:364` |
| 2 | Rectangle 13 | `344:349` | 12 | Rectangle 3 | `344:344` | 22 | Rectangle 11 | `344:365` |
| 3 | Rectangle 10 | `344:347` | 13 | Rectangle 3 | `344:361` | 23 | Rectangle 13 | `344:366` |
| 4 | Rectangle 12 | `344:342` | 14 | Rectangle 7 | `344:360` | 24 | Rectangle 14 | `344:367` |
| 5 | Rectangle 11 | `344:348` | 15 | Rectangle 6 | `344:362` | 25 | Rectangle 15 | `344:354` |
| 6 | Rectangle 9 | `344:346` | 16 | Rectangle 2 | `344:358` | 26 | **lens R** | `344:368` |
| 7 | Rectangle 8 | `344:340` | 17 | Rectangle 1 | `344:356` | 27 | **lens L** | `344:369` |
| 8 | Rectangle 1 | `344:339` | 18 | Rectangle 8 | `344:357` | | | |
| 9 | Rectangle 2 | `344:341` | 19 | Rectangle 12 | `344:359` | | | |

i 0–12 is the left half of the frame, 13–25 the mirrored right half, then the two lenses last
(**lens R before lens L** — they come from child order, not from x).

| node | id | track | keyframes |
|---|---|---|---|
| eye L/R pupil | `344:328` `344:332` | SCALE_XY | `0.10 1` · `0.35 OUT 0.75` · `1.35 OUT 1` |

### 3.5 `344:392` alarm · 0.9s · one-shot

Crab `344:393`. Both claws snap up, both stalks stretch **half** a periscope (16px, not 24), pupils
halve, and the shell judders on alternating frames. No L/R offset anywhere — everything is
simultaneous, which is what makes it read as a shock.

| node | id | track | keyframes |
|---|---|---|---|
| claw L pivot | `344:395` | ROTATION | `0 0` · `0.18 OUT +78` · `0.62 HOLD +78` · `0.85 EIO 0` |
| claw R pivot | `344:407` | ROTATION | `0 0` · `0.18 OUT -78` · `0.62 HOLD -78` · `0.85 EIO 0` |
| eye L / eye R | `344:423` `344:427` | TRANSLATE_Y | `0 0` · `0.14 OUT -16` · `0.70 HOLD -16` · `0.85 EIO 0` |
| stalk L / stalk R | `344:424` `344:428` | HEIGHT | `0 16` · `0.14 OUT 32` · `0.70 HOLD 32` · `0.85 EIO 16` |
| specs | `344:431` | TRANSLATE_Y | identical to eye (`-16`) |
| pupil L / pupil R | `344:426` `344:430` | SCALE_XY | `0 1` · `0.14 HOLD 0.5` · `0.72 HOLD 1` |
| body | `344:394` | TRANSLATE_X | `0.22 0` then 8 stepped 50ms beats, all HOLD: `0.26 -2` `0.31 +2` `0.36 -2` `0.41 +2` `0.46 -2` `0.51 +2` `0.56 -2` `0.61 +2`, then `0.68 HOLD 0` |

### 3.6 `344:490` double-take · 1.0s · one-shot

Crab `344:491`. Glance away, come back, snap away again — the body overshoots on the *second* snap,
not the first.

| node | id | track | keyframes |
|---|---|---|---|
| eye L/R pupil | `344:524` `344:528` | TRANSLATE_XY | `0 (0,0)` · `0.12 HOLD (8,0)` · `0.30 HOLD (0,0)` · `0.38 HOLD (8,0)` · `0.62 HOLD (0,0)` |
| body | `344:492` | TRANSLATE_X | `0.34 0` · `0.40 OUT +3` · `0.46 HOLD -4` · `0.54 HOLD +2` · `0.62 HOLD 0` |
| eye L socket/pupil | `344:523` `344:524` | SCALE_Y / OPACITY | blink @ **0.74** → 0.81 → 0.92 |
| eye R socket/pupil | `344:527` `344:528` | SCALE_Y / OPACITY | blink @ **0.78** → 0.85 → 0.96 |

The body track is the only place in the file where an overshoot is spelled out by hand: `+3` eased
out, then `−4`, `+2`, `0` as 80ms steps. Do not replace it with a spring — the steps are what keep
it pixel-honest.

### 3.7 `344:588` scuttle · 1.2s · loop · **the only frame with `clipsContent: true`**

Crab `344:589`. Nine 16px steps of 120ms each (`STEP = 0.12`, `N = 9`), starting **off-frame left**
at `-144` (the crab's left edge lands at 62 − 144 = −82 in frame space). All values HOLD.

| node | id | track | keyframes |
|---|---|---|---|
| **Mr. Bell** | `344:589` | TRANSLATE_X | `0 -144` · `0.12 -128` · `0.24 -112` · `0.36 -96` · `0.48 -80` · `0.60 -64` · `0.72 -48` · `0.84 -32` · `0.96 -16` · `1.08 0` (holds to 1.2) |
| body | `344:590` | TRANSLATE_Y | `0 0` · `0.12 -8` · `0.24 0` · `0.36 -8` · `0.48 0` · `0.60 -8` · `0.72 0` · `0.84 -8` · `0.96 0` · `1.08 -8` · `1.20 0` |
| legs L pivot · legs R pivot | `344:669` `344:664` | ROTATION | `0 -10` · then flip every 120ms: `0.12 -10` `0.24 +10` `0.36 +10` `0.48 -10` `0.60 -10` `0.72 +10` `0.84 +10` `0.96 -10` `1.08 -10`, then `1.20 0` |
| lower legs L · lower legs R | `344:674` `344:680` | ROTATION | `0 +10` · exact inverse of the row above · `1.20 0` |

Read the leg rows as: **both upper legs together, both lower legs in opposition**, flipping on
alternating steps. (The two sides are mirrored art, so identical CSS angles read as a left/right
alternation.) The bob runs at half the leg cadence — down on even steps, up on odd — and every
track snaps to neutral on the final `1.20` keyframe.

### 3.8 `344:4672` hop · 1.0s · one-shot

Crab `344:4673`. **The arc is on the crab; the squash is on body.** Dust lives on the frame.

| node | id | track | keyframes |
|---|---|---|---|
| **Mr. Bell** | `344:4673` | TRANSLATE_Y | `0 0` · `0.12 OUT +4` · `0.42 OUT -32` · `0.66 IN 0` |
| body | `344:4674` | SCALE_Y | `0 1` · `0.12 OUT 0.90` · `0.30 OUT 1.06` · `0.50 OUT 1` · `0.68 HOLD 0.92` · `0.80 OUT 1` |
| legs L pivot | `344:4753` | ROTATION | `0.12 0` · `0.42 OUT -14` · `0.66 IN 0` |
| legs R pivot | `344:4748` | ROTATION | `0.12 0` · `0.42 OUT +14` · `0.66 IN 0` |
| lower legs L | `344:4758` | ROTATION | `0.12 0` · `0.42 OUT -12` · `0.66 IN 0` |
| lower legs R | `344:4764` | ROTATION | `0.12 0` · `0.42 OUT +12` · `0.66 IN 0` |
| dust 1 | `348:101` | OPACITY | `0.62 0` · `0.68 HOLD 0.9` · `0.92 OUT 0` |
| dust 1 | `348:101` | TRANSLATE_X | `0.68 0` · `0.92 OUT -14` |
| dust 2 | `348:109` | OPACITY | identical to dust 1 |
| dust 2 | `348:109` | TRANSLATE_X | `0.68 0` · `0.92 OUT +14` |

Dust puffs: 16 x 8 rects, fill `--bell-cap-hi`, **children of the frame** at frame coords
**(92, 254)** and **(222, 254)**, `constraints SCALE`. Anticipation crouch 0 → 0.12 (+4px, squash
0.90) · rise to −32 by 0.42 with the legs tucking · land 0.66 · one-frame 0.92 landing squash at
0.68 · recover 0.80.

### 3.9 `344:4770` slump · 1.4s · one-shot, ends on the pose

Crab `344:4771`. Everything is `EASE_IN_AND_OUT` — no steps anywhere, because a stepped sag reads as
a twitch. The end pose is held from 0.90 to 1.40.

| node | id | track | keyframes |
|---|---|---|---|
| body | `344:4772` | TRANSLATE_Y | `0 0` · `0.65 EIO +4` |
| claw L pivot | `344:4773` | ROTATION | `0 0` · `0.70 EIO -10` |
| claw R pivot | `344:4785` | ROTATION | `0 0` · `0.70 EIO +10` |
| eye L / eye R | `344:4801` `344:4805` | TRANSLATE_Y | `0 0` · `0.55 EIO +8` |
| stalk L / stalk R | `344:4802` `344:4806` | HEIGHT | `0 16` · `0.55 EIO 8` |
| pupil L / pupil R | `344:4804` `344:4808` | TRANSLATE_XY | `0 (0,0)` · `0.60 EIO (0,+8)` |
| specs | `344:4809` | TRANSLATE_Y | `0.35 0` · `0.90 EIO +16` |

The specs sag **twice as far as the eyes** (16 vs 8) and start 350ms late: the 8px difference *is*
the glasses slipping down his face. Note the claw signs are the exact inverse of the alarm's raise.

### 3.10 `344:4868` sleep · 3.0s · loop

Crab `344:4869`. Eyes held shut for the whole timeline by single-keyframe tracks (a lone keyframe
holds in both directions).

| node | id | track | keyframes |
|---|---|---|---|
| body | `344:4870` | TRANSLATE_Y | `0 0` · `1.15 EIO -4` · `1.45 EIO -4` · `3.00 EIO 0` |
| socket L / socket R | `344:4901` `344:4905` | SCALE_Y | `0 0.333` · `1.15 EIO 0.27` · `3.00 EIO 0.333` |
| pupil L / pupil R | `344:4902` `344:4906` | OPACITY | `0 0` — single keyframe, hidden throughout |
| claw L pivot | `344:4871` | ROTATION | `0 -14` — single keyframe, a static tuck |
| Z 1 (16px) | `349:16` | OPACITY | `0.20 0` · `0.45 OUT 0.85` · `1.40 OUT 0` |
| Z 1 | `349:16` | TRANSLATE_Y | `0.20 0` · `1.40 OUT -40` |
| Z 2 (12px) | `349:24` | OPACITY | `1.40 0` · `1.65 OUT 0.85` · `2.60 OUT 0` |
| Z 2 | `349:24` | TRANSLATE_Y | `1.40 0` · `2.60 OUT -40` |

Breath is deliberately **asymmetric**: 1.15s in, 300ms hold at −4, 1.55s out. The lids breathe with
it (0.333 → 0.27 → 0.333) so the pose is never completely still. Z glyphs are SF Pro Semibold,
16px and 12px, fill `--bell-cap-hi`, children of the crab at Mr. Bell **(208, 104)** and
**(236, 80)** → frame **(270, 144)** / **(298, 120)**.

### 3.11 `344:4966` glint · 0.8s · one-shot

Crab `344:4967`. A `glint clip` FRAME (`clipsContent: true`, no fill) is laid over the spectacle row
at the specs' own box — **173 x 41 at (39, 72)** in Mr. Bell space — and a `streak` rect **8 x 45**
sits inside it at **(−16, −2)**.

| node | id | track | keyframes |
|---|---|---|---|
| streak | `349:53` | TRANSLATE_X | `0.10 0` then 12 HOLD steps of 16px every 40ms: `0.14 16` `0.18 32` `0.22 48` `0.26 64` `0.30 80` `0.34 96` `0.38 112` `0.42 128` `0.46 144` `0.50 160` `0.54 176` `0.58 192` |
| streak | `349:53` | OPACITY | `0.08 0` · `0.10 HOLD 1` · `0.58 HOLD 0` |
| lens L / lens R | `344:5041` `344:5040` | `fills[0]` COLOR | `0.10 rgba(0,121,181,.42)` · `0.30 OUT rgba(108,200,240,.42)` · `0.60 OUT rgba(0,121,181,.42)` |

Streak fill is raw `#ffffff` at **0.6 paint opacity**. The bar leaves the clip on the last step
(−16 + 192 = 176 > 173), which is why there is no exit fade.

### 3.12 `344:5064` tone handoff · 1.0s · one-shot

Only the ground and the glass move; the crab's own tokens are mode-invariant, so **the crab does not
change at all**.

| node | id | track | keyframes |
|---|---|---|---|
| tone bg | `350:4101` | `fills[0]` COLOR | `0.20 #E7E9F2` · `0.70 EIO #111219` |
| lens L / lens R | `344:5139` `344:5138` | `fills[0]` COLOR | `0.20 rgba(127,196,224,.42)` · `0.70 EIO rgba(0,121,181,.42)` |

`tone bg` is an extra 384 x 336 rect, radius 16, inserted at **index 0 of the frame** — a frame's own
fill cannot be keyframed. Its two colours are exactly `--ground` Day (`#e7e9f2`) and Night
(`#111219`). Nothing happens in the first 200ms or the last 300ms.

---

## 4. MOTION — UPDATE · `443:64` notice · 4.6s

280 x 880 FRAME at (0, 120), radius 12, `clipsContent: true`, fill `--ground`, **Night mode pinned**.
`sidebar` `443:3` is a clone of the Library-Night sidebar (`46:420`) at (21, 10); `Mr. Bell` `443:193`
is detached inside its `mascot` slot.

```
280 x 880 notice
└─ sidebar 443:3  @ (21,10)     vertical auto-layout, cloned from Library Night
   ├─ … brand / nav / subj …
   ├─ pill Available    444:109  ABSOLUTE, pinned to Downloading's x,y   ┐ three detached copies
   ├─ pill Downloading  443:296  in flow, 30px tall  → progress 443:297  │ stacked and crossfaded
   ├─ pill Ready        443:311  ABSOLUTE, pinned to Downloading's x,y   ┘ (variants aren't keyframeable)
   ├─ mascot  →  Mr. Bell 443:193
   └─ dev
```

Only `pill Downloading` is in the auto-layout flow, so the stack costs **30px** of column height;
floating the other two is what stops the mascot slot from being starved and the crab from clipping.

| node | id | track | keyframes |
|---|---|---|---|
| pill Available | `444:109` | TRANSLATE_Y | `0 8` · `0.30 OUT 0` |
| pill Available | `444:109` | OPACITY | `0 0` · `0.08 HOLD 1` · `1.50 HOLD 0` |
| pill Downloading | `443:296` | OPACITY | `0 0` · `1.50 HOLD 1` · `3.50 HOLD 0` |
| progress | `443:297` | **WIDTH** | `1.50 1` · `3.35 EIO 214` |
| pill Ready | `443:311` | OPACITY | `0 0` · `3.50 HOLD 1` |
| eye L | `443:223` | TRANSLATE_Y | `0.40 0` · `0.48 HOLD -8` · `0.56 HOLD -16` · `0.64 HOLD -24` · `3.30 HOLD -16` · `3.38 HOLD -8` · `3.46 HOLD 0` |
| eye L stalk | `443:224` | HEIGHT | same times: `16 · 24 · 32 · 40 · 32 · 24 · 16` |
| eye R | `443:227` | TRANSLATE_Y | same, **+0.04** on every time |
| eye R stalk | `443:228` | HEIGHT | same, +0.04 |
| specs | `443:231` | TRANSLATE_Y | `0.40 0` · `0.48 -8` · `0.56 -16` · `0.64 -24` · `3.30 -16` · `3.38 -8` · `3.46 0` · `3.72 -8` · `3.80 -16` · `4.00 -8` · `4.14 0` — all HOLD |
| pupil L / pupil R | `443:226` `443:230` | TRANSLATE_XY | `0.80 (0,0)` · `0.90 HOLD (-8,0)` · `1.70 HOLD (0,0)` · `2.50 HOLD (8,0)` · `3.15 HOLD (0,0)` · `3.76 HOLD (0,-8)` · `4.06 HOLD (0,0)` |
| claw R pivot | `443:207` | ROTATION | `3.50 0` · `3.66 OUT -62` · `3.74 EIO -68` · `4.02 EIO 0` |
| claw R pivot | `443:207` | TRANSLATE_XY | `3.50 (0,0)` · `3.66 OUT (-56,-2)` · `3.74 EIO (-60,-2)` · `4.02 EIO (0,0)` |

Beat map: `0–0.30` pill slides up 8px · `0.40–0.64` periscope up 24 · `0.80–3.15` pupils track the
bar left→centre→right→centre · `1.50` state becomes Downloading · `1.50–3.35` bar sweeps 1 → 214 ·
`3.30–3.46` retract · `3.50` state becomes Ready · `3.50–4.14` specs flick · `4.14–4.60` rest.

**The pupils' one track does two jobs.** `TRANSLATION_XY` cannot be split, so the bar-tracking dwell
positions and the push-up's `(0,−8)` pop live in the same 7-keyframe track. Note the specs track
likewise concatenates the periscope ride *and* the flick — 11 keyframes, one track.

## 5. MOTION — UPDATE · `448:102` dialog · 2.2s

1320 x 860 FRAME at (360, 120), **radius 12** (not `--r-win`), `clipsContent: true`, `fills: []`,
**Day mode pinned**.

```
1320 x 860 dialog
├─ app            448:103   INSTANCE of 40:1080 (Screen — Library, Day)   ← carries junk tracks, §8.9
├─ scrim          448:1295  1320x860 rect, raw #0A0D1C @ 0.42 paint opacity
├─ Update Dialog  448:1296  clone of 437:7, 420 x 280 @ (450, 290), radius --r-panel
│  └─ Mr. Bell    448:1399  detached, 96px (0.375 scale — still whole pixels)
└─ quit           448:1496  1320x860 rect, raw #050508, node opacity 0
```

| node | id | track | keyframes |
|---|---|---|---|
| scrim | `448:1295` | OPACITY | `0.08 0` · `0.30 OUT 1` |
| Update Dialog | `448:1296` | OPACITY | `0.10 0` · `0.30 OUT 1` · `1.58 HOLD 1` · `1.84 IN 0` |
| Update Dialog | `448:1296` | SCALE_XY | `0.10 0.94` · `0.32 OUT 1` · `1.58 HOLD 1` · `1.84 IN 0.97` |
| claw R pivot | `448:1413` | ROTATION | `0.55 0` · `0.72 OUT -62` · `0.80 EIO -68` · `1.08 EIO 0` |
| claw R pivot | `448:1413` | TRANSLATE_XY | `0.55 (0,0)` · `0.72 OUT (-56,-2)` · `0.80 EIO (-60,-2)` · `1.08 EIO (0,0)` |
| specs | `448:1437` | TRANSLATE_Y | `0.74 0` · `0.80 HOLD -8` · `0.88 HOLD -16` · `1.08 HOLD -8` · `1.22 HOLD 0` |
| pupil L / pupil R | `448:1432` `448:1436` | TRANSLATE_XY | `0.76 (0,0)` · `0.84 HOLD (0,-8)` · `1.14 HOLD (0,0)` |
| quit | `448:1496` | OPACITY | `1.62 0` · `2.02 OUT 1` |

Beat map: `0.08–0.32` scrim + dialog scale in from 0.94 · `0.55–1.22` specs flick · `1.58–1.84`
dialog shrinks to 0.97 and fades · `1.62–2.02` the window goes dark. It **ends on the splash ground
on purpose** so `Motion — Startup` picks the sequence straight back up.

**The flick here is ~30% quicker than the standalone push-up.** Relative to its own start the claw
peaks at +0.17 / +0.25 and returns at +0.53 (dialog) and +0.16 / +0.24 / +0.52 (notice), against
+0.24 / +0.34 / +0.75 on `332:470`. Three different tempos for the same gesture — do not share one
CSS animation across the three pages.

---

## 6. MOTION — TONE · page `166:2`

Three frames. **Not read live** — see §9.

| frame | id | box | timeline | motion ends |
|---|---|---|---|---|
| Toggle — Day → Night | `166:3` | 420 x 150 @ (0, 0), r16, fill `--ground`, Night mode | 0.75s | **0.34s** |
| Toggle — Night → Day | `170:5` | same, @ (460, 0) — a clone with every track reversed | 0.75s | **0.34s** |
| Transition — Day → Night | `171:8` | 1320 x 860 @ (0, 220), `clipsContent: true`, fill raw `#111219` | 1.1s | **0.75s** |

Captions (SF Pro Regular 12, raw `#737887`) at (0, 162), (460, 162), (0, 1092).

### 6.1 The toggle rig (`166:3`)

```
420 x 150 frame
└─ tone pill 166:4      125 x 34 @ (147,58), r999 (--r-pill), fill --glass-strong, 1px --hair, clip off
   ├─ icon slot          16 x 16 @ (12,9), no fill, clip off
   │  ├─ sun  166:6      16 x 16 @ (0,0)   instance of 163:2   resting opacity 0
   │  └─ moon 166:9      16 x 16 @ (0,0)   instance of 163:5   resting opacity 1
   ├─ label Day   166:11 SF Pro Regular 12 @ (36,10), raw #565B6F, resting opacity 0
   ├─ label Night 166:12 SF Pro Regular 12 @ (36,10), --ink-2,     resting opacity 1
   └─ sw  (clone of the real Switch 46:501) 44 x 24 @ (75,5), fill --hair
      ├─ track on 166:15  44 x 24, r12, index 0, the real switch's ON gradient, resting opacity 0
      └─ knob     166:14  travels 22px
```

Resting state = the **end** state (Night). The tracks start from the Day pose.

| node | id | track | keyframes |
|---|---|---|---|
| knob | `166:14` | TRANSLATE_X | `0 -22` · `0.34 bez(.34,1.25,.64,1) 0` |
| knob | `166:14` | SCALE_XY | `0 1` · `0.09 OUT 0.94` · `0.34 OUT 1` |
| track on | `166:15` | OPACITY | `0 0` · `0.22 OUT 1` |
| sun | `166:6` | OPACITY | `0 1` · `0.14 IN 0` |
| sun | `166:6` | SCALE_XY | `0 1` · `0.14 IN 0.6` |
| sun | `166:6` | ROTATION | `0 0` · `0.14 IN +60` (clockwise out) |
| moon | `166:9` | OPACITY | `0.10 0` · `0.32 OUT 1` |
| moon | `166:9` | SCALE_XY | `0.10 0.6` · `0.32 BACK 1` |
| moon | `166:9` | ROTATION | `0.10 -55` · `0.32 OUT 0` |
| label Day | `166:11` | OPACITY | `0 1` · `0.14 IN 0` |
| label Day | `166:11` | TRANSLATE_Y | `0 0` · `0.14 IN -4` |
| label Night | `166:12` | OPACITY | `0.12 0` · `0.30 OUT 1` |
| label Night | `166:12` | TRANSLATE_Y | `0.12 +4` · `0.30 OUT 0` |
| tone pill | `166:4` | `fills[0]` | `0 rgba(255,255,255,.741)` · `0.30 EIO rgba(38,40,58,.698)` |
| tone pill | `166:4` | `strokes[0]` | `0 rgba(24,26,52,.110)` · `0.30 EIO rgba(255,255,255,.141)` |

The pill's two colour tracks are `--glass-strong` and `--hair` **written out as literals** for Day →
Night (`#ffffffbd` → `#26283ab2`, `#181a341c` → `#ffffff24`) because a variable-bound paint cannot be
tweened. The surface crossfade is deliberately shorter than the gesture (0.30 vs 0.34) to spend less
time in the muddy mid-grey. **Colour leads the object:** the track lights at 0.22, the knob lands at
0.34. Icon slots never hold two glyphs at full strength — the moon starts 100ms after the sun begins
to leave.

### 6.2 The reverse toggle (`170:5`)

A `clone()` of `166:3` with **every track time-reversed about T = 0.34**: `t′ = 0.34 − t`, keyframe
order flipped, and the easing that governed a segment moved to the keyframe that now closes it and
mirrored — `EASE_IN ↔ EASE_OUT`, `EASE_IN_BACK ↔ EASE_OUT_BACK`, and
`bez(x1,y1,x2,y2) → bez(1−x2, 1−y2, 1−x1, 1−y1)`. Resting state re-asserted to Day: sun 1, moon 0,
label Day 1, label Night 0, track on 0.

One track is **not** a mechanical reversal, and this is the point:

| node | track | keyframes |
|---|---|---|
| track on (in `170:5`) | OPACITY | `0 1` · `0.16 IN 0` |

Reversed mechanically it would have de-lit *after* the knob left. Colour must lead in both
directions, so it de-lights early instead. Anything you generate by reversing a timeline needs this
pass by hand.

### 6.3 Screen-level tone transition (`171:8`)

Two whole detached screens stacked: `day layer` (a detached instance of `40:1080`, pinned to Day) with
`lib` `171:1135`, under `night layer` `171:1272` (a clone of `46:417`, pinned to Night, `effects`
cleared, opacity 1).

| node | id | track | keyframes |
|---|---|---|---|
| night layer | `171:1272` | OPACITY | `0 0` · `0.28 EIO 1` |
| ambient-a | `171:1273` | SCALE_XY | `0 1.12` · `0.75 OUT 1` |
| ambient-a | `171:1273` | OPACITY | `0.05 0` · `0.50 OUT 1` |
| ambient-b | `171:1274` | SCALE_XY | `0 1.15` · `0.75 OUT 1` |
| ambient-b | `171:1274` | OPACITY | `0.10 0` · `0.55 OUT 1` |
| clouds | `171:1275` | OPACITY | `0.06 0` · `0.48 OUT **0.45**` |
| veil | `171:1334` | OPACITY | `0 0` · `0.26 OUT 1` |
| page recess | `171:1335` | OPACITY | `0.04 0` · `0.32 OUT 1` |
| sidebar · topbar | `171:1336` `171:1400` | OPACITY | `0.05 0` · `0.30 OUT 1` |
| lib (night) | `171:1417` | OPACITY | `0.08 0` · `0.22 OUT 1` |
| row 1 | `171:1433` | OPACITY / TRANSLATE_Y | `0.10 0 / +6` · `0.26 OUT 1 / 0` |
| row 2 | `171:1437` | OPACITY / TRANSLATE_Y | `0.15 0 / +6` · `0.31 OUT 1 / 0` |
| row 3 | `171:1446` | OPACITY / TRANSLATE_Y | `0.20 0 / +6` · `0.36 OUT 1 / 0` |
| lib (day) | `171:1135` | SCALE_XY | `0 1` · `0.38 EIO 0.992` |
| lib (day) | `171:1135` | OPACITY | `0 1` · `0.30 IN **0.8**` |

Ordering that carries the illusion: **ground and chrome first** (night layer 0.28, scrims 0.26/0.32,
chrome 0.30), **content gated behind them** (lib 0.08→0.22 so the grid never floats without a page
plane), **rows in reading order** with a 6px settle. `clouds` ends at **0.45, its resting value** —
`OPACITY` replaces, it does not multiply.

Superseded first pass, for reference — **do not build this**: night layer 0.30, lib gate
0.14 → 0.30, rows at 0.16 / 0.22 / 0.28 (+0.20 each), day lib dimming to **0.35** by 0.26. That
combination dipped to a near-empty shell around t ≈ 0.2 because the day content had gone before the
night grid arrived. The fix was to overlap them: day only dims to 0.8, and the rows come 60ms earlier
with a 160ms (not 200ms) sweep.

---

## 7. THE CRAFT RULES, and where they are written in the file

**7.1 A jump arc belongs on the whole crab, not on `body`.** `body` is a group of
claws + shell + eyes + specs; the four leg pivots are its *siblings*. Hop was first authored with
`TRANSLATION_Y` on `body` (`0 · 0.12 +4 · 0.42 −32 · 0.66 0`) and the shell rose while the legs stayed
planted. The fix removed that track and applied **the identical four keyframes to `Mr. Bell`
(`344:4673`)**, leaving `body` with `SCALE_Y` only — which is exactly what the live file now reports.
Corollary: scuttle's travel is also on `Mr. Bell` while the bob stays on `body`, so the legs carry the
walk and the shell only bobs.

**7.2 HOLD stepping suits pixel art, but it reads as a hop in a slow state.** Idle bobs a stepped 8px
(`HOLD`, ±8) and that is right for a 2.5s idle with pupils darting. Sleep was first given *the same*
stepped 8px breath (`0 · 1.5 HOLD −8 · 2.9 HOLD 0`) and it read as a hop, because nothing else was
moving to absorb the step. Replaced with a **smooth, half-amplitude, asymmetric** curve —
`0 · 1.15 EIO −4 · 1.45 EIO −4 · 3.00 EIO 0` — plus a matching lid track (socket `SCALE_Y`
0.333 → 0.27 → 0.333) so the pose has texture. Slump follows the same rule: every track `EIO`, body
only +4. **Fast/awake poses step; slow poses ease at ~4px.**

**7.3 Anything perched on the eye stalks needs its own matching translation.** Periscope shipped
without a `specs` track and the eyes climbed out of their glasses. The fix gave `specs` **the exact
same seven keyframes as `eye L`** (no L/R offset — the frame is one object). The same pairing appears
in alarm (`specs` mirrors the −16 lift) and in the notice's periscope. Slump uses the rule
deliberately in reverse: eyes +8, specs **+16**, and the 8px difference is the slip down his face.

**7.4 Claw motion is rotational from the pivot.** The claws are **20 x 4 rungs rotated ~4° off-axis**,
so they cannot carry whole-pixel steps — a translate would break the rung grid. Every claw beat is
`ROTATION` on `claw L/R pivot`, empty unclipped frames whose centres sit on the shoulders
**(66.43, 132)** and **(189.78, 131)**. Moving to shoulder pivots also shrank the angles: idle's sway
went from 3° on the old rig to **2°** for the same tip travel. Where the push-up needs the pincer to
reach *inward*, the rotation is paired with `TRANSLATE_XY (−56,−2) → (−60,−2)`, which is invisible
because `shell` draws over the claws.

**7.5 `HEIGHT` on the 8 x 16 stalk grows downward from the top edge.** That is what lets it telescope:
periscope keys `stalk` `HEIGHT 16 → 24 → 32 → 40` on the *same* timestamps as `eye` `TRANSLATE_Y
0 → −8 → −16 → −24`, so the head climbs 24px while the stalk's foot stays welded to the shell. Alarm
does the half version (16 → 32 with the eye at −16). Slump inverts it (16 → 8, eye +8). In CSS this
must be a real `height` animation on a top-anchored rect — a `scaleY` would move the foot.

**7.6 One track per property, so beats concatenate.** `TRANSLATION_XY` is a single track; a second
application replaces the first. In the notice this forces the periscope pupil-tracking and the
push-up's `(0,−8)` pop into one 7-keyframe track, and the `specs` ride + flick into one 11-keyframe
track. Plan the whole property timeline before writing it.

**7.7 The right eye is never synchronous with the left.** Blinks +40ms, periscope +60ms, the notice
+40ms. Alarm is the deliberate exception: perfectly simultaneous, which is what makes it read as a
shock rather than a look.

**7.8 Colour leads the object, and crossfades overlap rather than dip.** The toggle's track lights at
0.22 while the knob lands at 0.34, and de-lights at 0.16 on the way back (§6.2). The screen transition
was rebuilt because the two grids handed over through an empty middle (§6.3).

---

## 8. TRAPS

1. **`ROTATION` sign.** Figma is CCW-positive, CSS is CW-positive. Every angle in this document is
   CSS-signed; the file's authored number is the negation. Get this wrong and both claws wave the
   wrong way, which still looks plausible in a still.
2. **`HOLD` is on the closing keyframe.** It holds the *previous* value until its own time and then
   jumps. Emitting it as a normal stop tweens the step and the whole pixel-art read collapses.
3. **Every timeline is `loopMode: loop`,** including the eight one-shots. `repeat: Infinity` in the
   read-back is not design intent; use the "loop" column in §3.
4. **Read-backs invent a `t=0` keyframe** for any track that starts later (the notice's claw at 3.50
   shows a value at 0). It is a hold, not a beat.
5. **`SCALE_*` scales about the node's centre.** Hop's 0.92 landing squash on `body` is a centre
   squash. Reaching for `transform-origin: bottom` because "squash comes from the ground" will not
   match the file.
6. **A frame's own fill cannot be keyframed.** Tone handoff carries an extra `tone bg` rect at index 0
   for that reason; the tone transition stacks two whole detached screens. If you need an animated
   background, animate a child.
7. **Instance sublayers cannot carry keyframes, and a variant swap is not keyframeable.** Every rig on
   these pages is a **detached** clone, and the notice stacks three detached pills and crossfades them
   instead of switching `State=`. Do not "tidy this up" back into instances.
8. **Rig geometry is not integer-aligned.** `body` starts at x = **−29.568573**, `claw R pivot` at
   **84.778824**, `legs L pivot` at 21.5, `specs` is 41.0850830078125 tall. Round for painting if you
   must; never round a pivot centre.
9. **The dialog's backdrop drags in junk tracks.** `app` `448:103` is an *instance* of the Library Day
   component, which already carries keyframes on five `base`/`highlight` pairs (`56:3688`, `56:3702`,
   `56:3712`, `56:3722`, `56:3736` + their `highlight` siblings). Resampled into the dialog's 2.2s
   window they emerge as five slow drifts (x to +58, −42, −50, +46, −34; y ∓16–26; scale to ~1.03) that
   then snap back to 0 across **~60 micro-keyframes inside the last 13ms**. That tail is an artifact.
   Implement the dialog's own eight tracks and nothing else.
10. **`specs` is unbound black.** 26 raw `#000000` rects plus two lens VECTORs at raw `#0079b5` with
    **42% paint opacity**. It is deliberately black — do not normalise it onto `--ink`.
11. **A `fills[n]` COLOR keyframe's alpha overrides the paint's opacity.** Glint and tone handoff both
    had to bake `a: 0.42` into every colour value, or the lenses went opaque for the duration. Also:
    the track key is `{ collection: 'fills', index: 0 }` with **no field key** — adding `field:'COLOR'`
    silently produces nothing.
12. **The glint/handoff lens colours are not tokens.** Bright is `#6CC8F0`, not `--bell-cap-hi`
    (`#58C8FF`); the handoff starts at `#7FC4E0` and rests at `#0079B5`. All raw.
13. **A blink is two tracks.** `socket SCALE_Y → 1/3` *and* `pupil OPACITY → 0`. Squash the socket
    alone and the pupil floats in the middle of a closed eye.
14. **Extra nodes exist only in their own frame.** The two dust puffs (16 x 8, `--bell-cap-hi`) are
    children of the **hop frame**, not the crab — they were reparented so they stay on the ground while
    he rises. The two `Z` texts are children of the crab in sleep. Neither exists in the master rig.
15. **Three tempos for one gesture.** Standalone push-up +0.24/+0.34/+0.75; notice
    +0.16/+0.24/+0.52; dialog +0.17/+0.25/+0.53 (relative to each start). Don't share the CSS.
16. **Timeline length ≠ motion length.** Toggles: 0.75s timeline, 0.34s of motion. Transition: 1.1s
    timeline, 0.75s of motion. Lens draw-on: 1.8s with everything cleared at 1.68. Use the motion end
    for `animation-duration` and add the tail as a delay only where the loop needs the beat.
17. **A spring collapsed the toggle's knob.** `CUSTOM_SPRING { bounce: 0.2 }` compressed 22px of travel
    into under 100ms; it is now an explicit `bez(.34, 1.25, .64, 1)` over 0.34s. If you port any spring
    from this file, measure the duration you actually get.
18. **`label Day` carries a raw `#565B6F`,** not `--ink-2` Day (`#4C5165`) — it only ever sits on the
    light surface, so it was hand-set rather than bound. Same treatment for the outgoing sun's strokes.
19. **`get_metadata` returns zero children** for the 384 x 336 frames and even for `eye L` / `specs`.
    Everything in this spec came from `get_motion_context` (recursive) plus the authoring record; use
    those, or `get_design_context`, to go deeper.
20. **`clipsContent` is false almost everywhere,** which the art relies on: claw pivots and the growing
    stalk both overflow their parents. Only `344:588 scuttle` clips (it must — he starts at −144), plus
    the purpose-built `glint clip`. Do not add `overflow: hidden` to a limb wrapper.

---

## 9. Building it — the shape of the CSS, and provenance

One wrapper per animated rig node, each with its own `@keyframes`; nothing shares an element. Percent
= `t ÷ duration`. Worked example, idle's body bob and the left claw (note the doubled stops that
carry `HOLD`, and that the claw is a nested wrapper so its rotation composes with the bob):

```css
@keyframes bell-idle-bob {                 /* body 344:3, 2.5s linear, HOLD steps */
  0%,21.9%   { transform: translateY(0) }
  22%,45.9%  { transform: translateY(-8px) }
  46%,71.9%  { transform: translateY(0) }
  72%,93.9%  { transform: translateY(-8px) }
  94%,100%   { transform: translateY(0) }
}
@keyframes bell-idle-claw-l {              /* claw L pivot 344:4, eased */
  0%   { transform: rotate(0deg) }
  50%  { transform: rotate(-2deg) }        /* file says +2 (CCW) */
  100% { transform: rotate(0deg) }
}
.bell .body      { animation: bell-idle-bob 2.5s linear infinite }
.bell .claw-l    { transform-origin: 50% 50%;                     /* frame centre = the shoulder */
                   animation: bell-idle-claw-l 2.5s ease-in-out infinite }
```

`HEIGHT` tracks animate `height` on a top-anchored rect (`position:absolute; top:24px` inside the eye
for the 8 x 16 stalk) — never `scaleY`. `WIDTH` on the notice's progress bar is the same idea, left-
anchored, 1 → 214px. `fills[0]` tracks animate `background-color` (rects) or `fill` (the lens
vectors), alpha included.

**Reduced motion.** `TASKS.md` §5.8 requires that both the OS setting and the Settings switch collapse
everything here to the **idle pose** — i.e. every track's `t=0` value, animations off, and no
`animation-fill-mode` leftovers. Slump and sleep are poses, not idles: under reduced motion they
should render their *end* state (slumped / asleep) statically rather than their start state.

**Provenance.** The fourteen timelines in §3–§5 were each read live from the file with
`get_motion_context` (recursive) on 2026-09-03, and every one of them matched the authoring record
keyframe-for-keyframe — which is where the exact easing enum names, the millisecond `timelinePosition`
values and the superseded revisions come from. §6 (`Motion — Tone`) is **from the authoring record
only**: the page id `166:2` was recovered from a sibling spec's hunt log and the three frames were not
re-read live, so treat §6 as high-confidence-but-unverified and re-read `166:3` / `170:5` / `171:8`
before shipping the toggle. Values not to re-derive: §1 rig geometry and the six pivot centres are
measured (`get_metadata` on `344:2` / `344:3` plus the pivot construction report).











