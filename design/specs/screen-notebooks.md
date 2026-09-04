# Screen — Notebooks / Notebook (measured spec)

Two new Figma pages, one new motion page, ten new frames.

| page | node | composition | node | x, y | size |
|---|---|---|---|---|---|
| `Screen — Notebooks` | `620:2` | Notebooks — Night | `620:507` | 0, 0 | 1320 x 860 |
| | | Notebooks — Day | `620:1377` | 1400, 0 | 1320 x 860 |
| | | Notebooks — Empty | `629:859` | 2800, 0 | 1320 x 860 (Night only) |
| `Screen — Notebook` | `631:2` | Notebook — Night · Tool tab | `631:1045` | 0, 0 | 1320 x 860 |
| | | Notebook — Day · Pages tab | `631:1144` | 1400, 0 | 1320 x 860 |
| | | New Notebook — Night | `653:1263` | 2800, 0 | 1320 x 860 |
| | | New Notebook — Day | `653:1362` | 4200, 0 | 1320 x 860 |
| | | inspector — notebook tab | `649:172` | 5600, 0 | 268 x 808 (Night only) |
| `Motion — Notebook` | `662:1217` | cover open | `662:1218` | 0, 100 | 1320 x 860 |
| | | page turn | `666:1217` | 1400, 100 | 988 x 808 |

All eight screen frames are plain FRAMEs, `clipsContent: true`, radius `--r-win` (15), fill
`--ground`. Night frames carry `Shadow/Window/Night`; Day frames carry no window shadow (matching
`Notebooks — Day`'s Dashboard ancestor). **Every one has the Colour collection mode pinned
explicitly** — `3:2` Night, `3:1` Day; verified on all ten.

Zero unbound SOLID paints and zero raw text-segment fills across all ten frames, ambient blooms and
background rasters excepted (those are raw by design on every screen in the file).

---

## 1. What these two screens are

The Reader lets a student annotate **a paper somebody else wrote**. Notebooks is the other half:
a place to write your own working. A notebook is a named object with a coloured cover; opening one
shows two facing pages that turn forever; everything is on disk the moment you stop writing; and
clipped screenshots of the paper you were just reading land on the page.

The tool surface is deliberately not the Reader's. The Reader ships three tools
(`type Tool = 'pen'|'hl'|'er'`, `src/lib/annotations.ts:27`), a raw `moveTo`/`lineTo` polyline with
no pressure and no object model, and no way to select, move, recolour or delete a committed stroke.
The notebook gets twelve tools, four nibs, pressure, smoothing, and a **live lasso selection over a
stroke group** — that last detail is the whole argument, drawn.

## 2. Layout maps

### Notebooks — the shelf (standard app shell)

```
 0                    238   269                                        1289   1320
 +-----------+------------------------------------------------------------------+ 0
 | sidebar   | topbar 1082 x 56  @(238,0)   glass + 1px hair, blur 26, clip     |
 | 238 x 860 +------------------------------------------------------------------+ 56
 | @(0,0)    |                                                                  |
 | glass     |   content 1020 x 730 @(269,82)   VERTICAL gap 20   fills: []      |
 | blur 26   |   +--------------------------------------------------------+ 82  |
 |           |   | header 1020 x 44   greeting | spacer | segmented | New  |     |
 | 5 nav     |   +--------------------------------------------------------+ 126 |
 | rows      |   | shelf 1020 x 666  V gap 24                             |     |
 | 10 subj   |   |  row 1  1020 x 321   4 x Notebook Cover 237, gap 24    |     |
 | Mr. Bell  |   |  row 2  1020 x 321   @ y 345                           |     |
 | dev block |   +--------------------------------------------------------+ 812 |
 +-----------+------------------------------------------------------------------+ 860
                                                              48px bottom inset
```

### Notebook — the open spread (no sidebar, no Mr. Bell)

```
 0        64                                              1052            1320
 +-----------------------------------------------------------------------------+ 0
 | topbar 1320 x 52   glass + 1px hair ALL FOUR SIDES                          |
 +----+---------------------------------------------------+--------------------+ 52
 |tool|                                                   | inspector          |
 |dock|     +-----------+ ((( +-----------+               | @(1052,52)         |
 | 64 |     |  page 12  | ((( |  page 13  |               | 268 x 808          |
 |x808|     |  455x644  | ((( |  455x644  |               | V gap 16, pad 18   |
 |    |     +-----------+ ((( +-----------+               | [Panel Tabs]       |
 |    |     90        545  571          1026              | [cards]            |
 |    |                                                   |                    |
 |    |          ( <-  pages 12-13  ->  |  - 100% + )      |                    |
 +----+---------------------------------------------------+--------------------+ 860
            spread 936 x 644 @(90,134)        spread nav 325 x 50 @(396,796)
```

Stage = x 64..1052 (988) by y 52..860 (808). The spread is inset **26 left and right** and
**vertically centred** — (808 − 644) / 2 = 82 — so y 134..778. Pages are **455 x 644**, ratio
0.7065: A-series, the same proportion as the Reader's 500 x 707 paper, on purpose.

## 3. Background stack

Cloned wholesale from the Dashboard pair, so the stack hashes identically to Library's.

Night (`620:507`, `629:859`, `631:1045`, `653:1263`):

| z | node | kind | x, y | w x h | paint |
|---|---|---|---|---|---|
| 0 | ambient-a | ellipse | -686.4, -438.6 | 1584 x 946 | raw `#0836CE`, node opacity **0.40** |
| 1 | ambient-b | ellipse | 551, 527 | 1495 x 806 | raw `#67C5FF`, node opacity **0.60** |
| 2 | bkg_image_night | rect | 1541.43, 878.74 | 1550.79 x 1017.4 | raster PNG, rotate **-175.14°**, node opacity **0.76** |
| 3 | veil | rect | 0, 0 | 1320 x 860 | `--ground-veil`, **paint opacity 18%** |

Day (`620:1377`, `631:1144`, `653:1362`):

| z | node | kind | x, y | w x h | paint |
|---|---|---|---|---|---|
| 0 | ambient-a | ellipse | -686.4, -438.6 | 1621 x 930 | raw `#D595FA`, node opacity **0.34** |
| 1 | ambient-b | ellipse | 594, 387 | 1452 x 946 | `--ambient-b`, node opacity **0.34** |
| 2 | bkg_image_day | rect | -47, -24 | 1636 x 924 | raster PNG, node opacity 1 |
| — | veil | | | | **absent in Day** |

**There is no `page recess` on either screen, in either tone.** The Dashboard and Reader both put a
`--ground-veil` @24% rect behind the content region; Notebooks does not. On the shelf the covers are
saturated enough to sit on the ambient without one, and on the spread the two sheets of `--paper`
are the brightest thing on the screen by a wide margin. If a later pass adds one, it belongs at
`(238,56) 1082 x 804` on the shelf and full-bleed `1320 x 860` on the spread — **not** at the stage
rect, because stripping the chrome takes the ambient darkening with it.

---

## 4. Notebooks — the shelf

### 4a. sidebar `238 x 860 @(0,0)` — **now five nav rows**

`--glass` fill, 1px `--hair` all round, `Glass/Chrome Blur 26`, VERTICAL gap 4, pad 14 / 12.
Identical to the Dashboard sidebar except that **Notebooks is inserted as the second nav row**, and
everything below it shifts down by the 38px Nav Item pitch:

| node | y (Dashboard) | y (Notebooks) | note |
|---|---|---|---|
| window lights | 14 | 14 | 62 x 16 @(12,14) |
| brand | 34 | 34 | 111.6 x 50.8, `Bell / Lockup — Horizontal` |
| nav-label Study | 88.8 | 88.8 | `Label/Section` `--ink-3` |
| Nav Item Library | 122.8 | 122.8 | `Icon=lib`, count "13,447" |
| **Nav Item Notebooks** | — | **160.8** | `Icon=book`, count "12", `State=Active` |
| Nav Item Dashboard | 160.8 | 198.8 | |
| Nav Item Bookmarks | 198.8 | 236.8 | `--ink-3` label |
| Nav Item Recent | 236.8 | 274.8 | `--ink-3` label |
| nav-label Subjects | 274.8 | **312.8** | |
| subj (10 rows, pitch 31) | 308.8 | **346.8** | 214 x 311 |
| mascot | 623.8, h 191.2 | **661.8, h 153.2** | FILL/FILL; `Mr. Bell` 160 @(26,-23) |
| dev | 819 | 819 | unchanged, bottom-pinned |

`Mr. Bell` is pinned CENTER/MAX inside `mascot` at bottom 16.2 and the rig's top ~45px is empty
above his spectacles, so losing 38px of slot height cuts nothing visible. Confirmed by render.
A *third* nav group would not survive — a label + item pair takes the slot to ~115 and does cut art.

The active row is `State=Active`: fill `--accent-soft`, `Icon=book` and both labels in `--accent`,
plus the 3 x 17 gradient `active indicator` at x **-12** (it overhangs the sidebar's 12px pad).

### 4b. topbar `1082 x 56 @(238,0)`

`--glass`, 1px `--hair`, blur 26, clip. HORIZONTAL gap 12, pad 0 / 16, align CENTER.

| node | x, y | size | spec |
|---|---|---|---|
| title | 16, 18 | 89 x 20 | "Notebooks" `Title/Toolbar` `--ink` |
| search | 117, 11 | 420 x 34 | r `--r-pill`, `--glass-strong` + 1px `--hair`, `Icon=search` 16 `--ink-3`, placeholder `Body/Default` `--ink-3`, `Kbd` "Ctrl K" |
| spacer | 549, 27.5 | FILL h1 | 334 wide in Night, 343 in Day |
| tone pill | **895** (Night) / **904** (Day) | 125 / 116 x 34 | right edge **1020** both |
| Icon Button | 1032, 11 | 34 x 34 | `Icon=sync` |

### 4c. content `1020 x 730 @(269,82)` — VERTICAL gap 20, `fills: []`

**header `1020 x 44`** — HORIZONTAL gap 12, align CENTER, `w: FILL`:

- `greeting` V gap 6, HUG: "Your notebooks" **SF Pro Semibold 20 / tracking 0%** `--ink` (150 x 24 —
  the documented `.t-greeting` off-ramp, not a named text style) + `subline` SF Pro Regular 12
  `--ink-3`, 332 wide: `12 notebooks  ·  486 pages written  ·  stored on this device`
- `spacer` FILL h1
- `view` — `Segmented Control` `Segments=2, Selected=1` 71 x 36 @(785,4), grid / list
- `new notebook` — `Button` `Style=Primary` 152 x 38 @(868,3), `Icon=plus`, "New notebook"

**shelf `1020 x 666 @(0,64)`** — VERTICAL gap 24 of two `row` frames. Each row is HORIZONTAL gap 24
with four FILL children → **237 each** (237 x 4 + 24 x 3 = 1020, and 237 is exactly a 3-column span
on the file's 12 x 63 / 24 grid). Row height 321.

> **`clipsContent = false` on `content`, `shelf` and both rows** — verified. The cover carries
> `Shadow/Card/*`, which reaches 12px below and 8px to the sides; a hugging container that clips
> slices it. This is the "grid drop shadow bugs out" bug that needed `clipsContent = false` on
> 8 grid frames, 18 rows and 10 content regions on Library alone.

### 4d. the eight notebooks, in built order

Real content, no lorem. Row 1 then row 2, left to right:

| slot | Cover | Name# | Meta# | Edited# | Sticker# |
|---|---|---|---|---|---|
| 1 | 1 indigo | Mechanics | Physics 9702 | 48 pages · edited 2h ago | `Subject=physics` |
| 2 | 3 forest | Genetics | Biology 9700 | 51 pages · edited yesterday | `Subject=biology` |
| 3 | 5 crimson | Pure 3 | Mathematics 9709 | 62 pages · edited yesterday | `Subject=maths` |
| 4 | 2 teal | Organic | Chemistry 9701 | 37 pages · edited 3 days ago | `Subject=chemistry` |
| 5 | 4 ochre | Ratios | Accounting 9706 | 24 pages · edited 4 days ago | `Subject=accounting` |
| 6 | 7 graphite | Paper 2 | Computer Science 9618 | 28 pages · edited last week | `Subject=computing` |
| 7 | 6 slate | Micro | Economics 9708 | 19 pages · edited last week | `Subject=economics` |
| 8 | 8 rust | Complex numbers | Further Maths 9231 | 33 pages · edited 2 weeks ago | `Subject=further-maths` |

Covers are ordered so no two adjacent tiles — across *or* down — share a hue family.
`Show Photo# = false` on all eight; the photo variant is exercised only in the component sheet.

### 4e. `Notebook Cover` anatomy — 237 x 321

INSTANCE, VERTICAL gap 8, `w: FILL`, `h: HUG`.

```
book 237 x 300      r --r-card (13), fill --cover-N, clip, Shadow/Card/Night
  spine       14 x 300 @(0,0)     left corners 13 only     --cover-shade
  rings       14 x 212 @(0,44)    7 coils 8x8 @ x3, pitch 34, stroke 1.5 --cover-wire
  page edges   6 x 268 @(231,16)  3 rects 2x268 @ x 0/2/4, --paper, node op 1 / 0.70 / 0.45
  front      185 x 108 @(26,34)   V gap 16
    sticker   56 x 56             r 14, fill --paper, Shadow/Card/Day, Sticker# INSTANCE_SWAP
    label    185 x 36  @(0,72)    V gap 4: Name# Title/Card --cover-label
                                          Meta# Mono/Small  --cover-label-2
gap 8
edited     136 x 13  @(0,308)     Body/Meta --ink-3
```

Coils: first centre y **48**, last y **252** inside a 300-tall book — symmetric 48px margins.
`page edges` sit flush to the book's right edge (231 + 6 = 237) with 16px top and bottom.

**The three cover text/wire tokens are new semantics, not primitives.** `--cover-label`,
`--cover-label-2` and `--cover-wire` were added specifically because the first build bound
`Primitives/white`, `alpha/white-74` and `alpha/white-58` directly — a DS violation — and because
white at **74% fails 4.5:1** on `cover/2`, `cover/3` and `cover/4` (measured 4.26 / 4.40 / 4.05).
`--cover-label-2` resolves to `alpha/white-84`, whose worst case is 5.93 on `cover/4`.

### 4f. Notebooks — Empty `629:859`

Same shell. `content` becomes VERTICAL gap 0, align CENTER / CENTER, holding one block
`empty state` **430 x 384 @(295,173)**, V gap 22, counter CENTER:

| child | size | spec |
|---|---|---|
| ghost cover | 178 x 226 | r `--r-card`, **1.5px `--hair`**, no fill; `Icon=plus` 30 centred |
| words | 430 x 76 | V gap 10, centred: "No notebooks yet" `Display/Setup Title` `--ink` · copy `Body/Default` `--ink-2`, two lines: *"Make one for a topic you keep coming back to. It opens on two blank pages, and there are as many more as you need."* |
| new notebook | 152 x 38 | `Button` `Style=Primary`, `Icon=plus` |

**No Mr. Bell in the empty content** — a deliberate departure from the original plan. He is already
on screen 100px lower in the sidebar `mascot` slot, and two crabs on one 1320px frame reads as a
mistake. The ghost cover earns the space instead: it teaches the affordance the button names.

---

## 5. Notebook — the open spread

No sidebar, no `mascot`, no `Nav Item` — the Reader's shape. Chrome numbers are lifted from
`screen-reader.md` on purpose so the two screens read as siblings.

### 5a. topbar `1320 x 52 @(0,0)`

`--glass`, **1px `--hair` on all four sides** (not `border-bottom` — the Reader's topbar is the
precedent, and reusing the app's `.topbar` CSS drops three edges), blur 26, clip. Absolute children.

| node | x, y | size | spec |
|---|---|---|---|
| window lights | 16, 18 | 62 x 16 | `Window Lights` instance |
| back | 78, 9 | 34 x 34 | `Icon Button` `Icon=left` @18 |
| title | 124, 17 | 241 x 16 | H gap 9: "Mechanics" `Body/Strong` `--ink` · "Physics 9702" Geist Mono Reg 12 `--ink-2` · "·" SF Pro Reg 12 `--ink-3` · "48 pages" SF Pro Reg 12 `--ink-3` |
| **save** | 385, 18 | 113 x 12 | H gap 7: 6px dot `--accent` + "Saved on this device" **SF Pro Medium 10** `--ink-3` |
| tone pill | **1091** (Night) / **1100** (Day) | 125 / 116 x 34 | right edge **1216** both |
| search | 1228, 9 | 34 x 34 | `Icon=search` — search inside this notebook |
| focus mode | 1270, 9 | 34 x 34 | `Icon=focus` — collapses dock + inspector; the spread takes all 1320 |

`save` is lifted verbatim from the Reader's exam-timer `running` indicator (6px dot + 10px Medium
label). It is the **"always saved locally" requirement made visible**, and the only place in the
product that admits it is writing to disk. At rest the label is `--ink-3` and the dot `--accent`;
while a stroke is in flight the label goes `--accent` too.

### 5b. tool dock `64 x 808 @(0,52)`

`--glass`, 1px `--hair` all round, blur 26, clip. VERTICAL gap 6, pad 15, counter CENTER.
Every button is a 34 x 34 `Icon Button` (r `--r-btn`, icon 18); `sep` is 24 x 1 `--hair`.
Pitch is therefore **40** within a group.

| y | node | glyph | group |
|---|---|---|---|
| 15 | pen | `Icon=pen` | **ink** |
| 55 | pencil | `Icon=pencil` | |
| 95 | highlighter | `Icon=hl` | |
| 135 | eraser | `Icon=eraser` | |
| 175 | sep | — | |
| 182 | select | `Icon=lasso` | **objects** |
| 222 | shapes | `Icon=shapes` | |
| 262 | text | `Icon=text` | |
| 302 | image | `Icon=image` | |
| 342 | sep | — | |
| 349 | ruler | `Icon=ruler` | **aids** |
| 389 | sticky | `Icon=sticky` | |
| 429 | spacer | FILL, absorbs **277** | |
| 712 | sep | — | |
| 719 | undo | `Icon=ret` | **history** |
| 759 | redo | `Icon=redo` | |

**Active tool = `Icon Button` `State=Active`**: fill `--accent-soft` **plus a 1px inside `--accent`
stroke**. `pen` is the one shown active. The Reader marks its active tool with `--accent-soft`
alone, which is faint at 34px; the added line is the design system own rule — accent as a line on
live elements — doing the work. `State=Active` is a **new third variant** on `Icon Button`, see §9.

Undo reuses the existing `ret` glyph; `redo` is new (`ret` mirrored, not rotated 180°).

### 5c. the spread `936 x 644 @(90,134)`

Plain frame, `fills: []`, `clipsContent: false`. Three children, in paint order:

| child | x local / absolute | size | spec |
|---|---|---|---|
| page L | 0 / 90 | 455 x 644 | fill `--paper`, radius **3**, clip, `Shadow/Paper/Night` |
| page R | 481 / 571 | 455 x 644 | same |
| rings | 455 / 545 | 26 x 644 | fill `--page-ink` **paint opacity 0.16**; the **last** child, so it paints over both pages |

Binding is 26 wide, absolute 545..571. Inside each page:

| part | geometry | spec |
|---|---|---|
| `ruling` | 387 x 584 @(34,30) | 22 rects h1, **pitch 26** from y 0, `--page-line`; `clipsContent: false` |
| `margin` | 1 x 584 @(58,30) | vertical `--page-line` rule, 24px inside the ruling left edge |
| `fold` | 22 x 644 | page L @(433,0), page R @(0,0), flush to the binding. LINEAR gradient `--page-ink` @0.07 to transparent, pointing away from the spine. **Both stops are variable-bound per `ColorStop`** — `setBoundVariableForPaint` only accepts SolidPaint, so a gradient has to be bound stop by stop. |
| `ink` | 387 x 584 @(34,30) | the written content; `clipsContent: false` |

Page padding is **34 x / 30 y** — the Reader `doc` padding, deliberately.

`rings` = 13 coils, ellipse **22 x 13 @ x 2**, stroke 2 `--page-ink-2`, **node opacity 0.75**, first
centre y **34**, **pitch 48**, last centre y 610 — symmetric 27.5px margins in the 644 band. There is
**no rotation on the coils**: an earlier draft called for -6 degrees, the file ships them level, and
level is what the motion frames were built against. `--page-ink-2` is mode-invariant, so the wire
reads as steel in both tones.

Ruling is monochrome on purpose. A red margin rule would need a red token that retones, and there
is no such token; `--page-line` is mode-invariant 14%, so the ruling is identical in Day and Night.

### 5d. what is written on the pages

A blank spread demonstrates nothing, so both pages carry real 9702 working. Handwriting is **Caveat
Regular** at four sizes. The six body lines at **18** are bound to the **`Ink/Annotation`** text
style; the headings (23), the margin notes and diagram labels (16) and the dimension label (15) are
**ad-hoc, no named style** — the same allowance `components-data.md` grants the Doc Badge's 10px.

`Ink/Annotation` is the style whose survival was in question: `foundations.md` section 6.1 recorded
it as deleted, on the evidence that no node in the file applied it. It was never deleted — a sweep of
*applied* styles cannot see an unapplied one. It exists at Caveat Regular 18 / 0%, and the notebook is
the first place in the product that actually uses it. Deleting it now would strip the spread's
handwriting, and with it the 104 KB of Caveat that `TASKS.md` proposed dropping from the font payload.

**page 12 (left)** — `ink` children in paint order:

| node | kind | token | content |
|---|---|---|---|
| heading | Caveat 23 | `--iris-3` | Moments — 9702 P4 |
| highlighter swipe | rect 196 x 14 r2, **node opacity 0.34** | `--iris-1` | sits behind line 1 |
| line 1 / 2 | Caveat 18 | `--page-ink` | sum of moments about P = 0 · F × 0.35 = 12 × 0.80 |
| line 3 | Caveat 18 | `--iris-3` | F = 27.4 N |
| correction | Caveat 16 | `--cover-5` | pivot is NOT at the centre — a margin note in crimson |
| clipping 9702 s25 P4 Q3 | frame 300 x 90, r6, 1px `--hair-2`, fill `--paper` | | the clipped exam question, abstracted to grey bars (`q` 272 x 66) exactly as `screen-reader.md` abstracts its mock paper |
| caption | `Mono/Small` | `--page-ink-2` | clipped from 9702 s25 P4 |
| beam · pivot · load arrow · reaction arrow | rect + 3 vectors, stroke 1.75 | `--iris-3`, load in `--cover-5` | a free-body diagram built with the shape tool |
| load / reaction / distance labels | Caveat 16 / 16 / 15 | `--cover-5` / `--iris-3` / `--page-ink-2` | 12 N · F · 0.35 m |

**page 13 (right)**:

| node | kind | token | content |
|---|---|---|---|
| heading | Caveat 23 | `--iris-3` | Torque worked example |
| line 1-3 | Caveat 18 | `--page-ink` | tau = r F sin theta · theta = 90 so sin theta = 1 · tau = 0.35 × 27.4 = 9.6 N m |
| sticky note | frame 116 x 104 @(244,196), r3, **rotate -3 degrees**, fill + stroke `--bell-gold` | `--page-ink` text, Caveat 16 | this one is in every P4 — learn it |
| selection | rect 232 x 88 @(16,48), r3, 1px **dashed [5,4]** | `--accent` | the lasso, live over the three working lines |
| handle x4 | 7 x 7, r1.5, 1.5px stroke, fill `--paper` | `--accent` | at the selection four corners, offset -3 |

`--bell-gold` and `--page-ink` are both mode-invariant, so the sticky is the same yellow paper with
the same dark ink in Day and Night — correct, because it is an object on the page, not chrome.

> The selection is the single clearest answer to "the tools are poor". There is no hit-testing
> anywhere in `src/` today, so a committed mark can only be undone or painted over. A selected,
> movable stroke group says the notebook has an object model.

### 5e. spread nav `325 x 50 @(396,796)`

Floating bar, HUG, centred in the stage (centre 558.5 against the stage centre 558), 14px above the
frame bottom edge. `--glass-strong` + 1px `--hair`, radius `--r-pill`, pad 8, H gap 12, align
CENTER, `Shadow/Popover/Night`. The Reader hand-rolls `0 8 24 -4 rgba(0,0,0,.42)` in this slot;
**this bar uses the named style instead** — note the divergence when porting.

Contents, left to right: prev `Icon=left` 34 · "pages 12-13" `Mono/Small` `--ink-2` ·
next `Icon=right` 34 · `sep` 1 x 20 `--hair` · zoom out `Icon=zout` 34 · "100%" `Mono/Small`
`--ink-3` · zoom in `Icon=zin` 34.

`next` uses the new `Icon=right` glyph, not a rotated `left`. **The indicator never shows a total.**
It reads `pages 12-13`, never `12 of 40`, and `next` is always enabled — that is the whole of the
"infinite pages, never ask the student" requirement expressed in the UI. Turning past the last
written spread materialises a new one.

---

## 6. inspector `268 x 808 @(1052,52)` — three tabs

The Reader tool-panel box exactly: `--glass`, 1px `--hair` all round, blur 26, clip, VERTICAL gap 16,
pad 18. First child is always `Panel Tabs` 232 x 30 @(18,18). The rest are cards — `--card` fill,
1px `--card-brd`, radius `--r-card`, `w: FILL`, `h: HUG`, pad 16, V gap 13, **no shadow** (content
cards carry none here, same as the Reader).

Each card opens with a `sec-label` row: `Label/Section` label, an optional `Mono/Small` meta on the
right of it, then a 1px `--hair` rule filling the remaining width.

### 6a. Tool tab — shown on `Notebook — Night`, contextual to the selected tool (Pen)

| y | card | h | contents |
|---|---|---|---|
| 64 | `nib` | 179 | sec-label NIB + meta "Pen". `nibs` 200 x 120: two rows of two **96 x 56** tiles, gap 8 / 8 — Fountain, Ballpoint, Pencil, Marker. Each draws a real stroke sample at that nib taper above a `Body/Small` name. Selected (Fountain) = `--accent-soft` + 1px `--accent`; the rest 1px `--hair`, no fill. |
| 259 | `ink` | 160 | sec-label INK. Two `swatches` rows 200 x 26, **SPACE_BETWEEN**, discs 22 in a 26 box: row 1 `--page-ink`, `--iris-3`, `--iris-2`, `--iris-1`, `--bell-cap-hi`; row 2 `--cover-2`, `--cover-3`, `--cover-4`, `--cover-5`, `--cover-8`. Selected = `--iris-3`, marked by a **1.5px `--ink` ring** on the 26 box (the Reader own swatch treatment). Then `recent` 200 x 24: label + four 16px discs at pitch 24 + spacer + a 24 x 24 `Icon Button` `Icon=plus` for a custom colour. |
| 435 | `stroke` | 135 | sec-label STROKE. `presets` row: 5 / 8 / 12 px dots (the 8 is `--accent`, the others `--ink-3`) + spacer + "8 px" `Mono/Small`. Then two `Slider` rows — Opacity "100%", Smoothing "40%" — each label 58 fixed, slider FILL 94 x 20, value 32 fixed. |
| 586 | `behaviour` | 153 | sec-label BEHAVIOUR + three `Switch` rows at pitch 36: **Pressure on**, Straight-line lock off, Snap to ruler off. Label `Body/Small` `--ink-2`, spacer FILL, `Switch` 44 x 24 right-aligned. |

Stack height 18 + 30 + 16 + 179 + 16 + 160 + 16 + 135 + 16 + 153 = 739, leaving 51px of slack above
the 18px bottom pad. Cards are top-aligned; there is no spacer on this tab.

### 6b. Pages tab — shown on `Notebook — Day`

| y | node | h | contents |
|---|---|---|---|
| 64 | `jump to page` | 34 | `Text Field` `State=Default`, placeholder "Jump to page…" `--ink-3` |
| 114 | `sec-label Spreads` | 14 | label "Spreads" + meta "48 pages" + rule |
| 144 | `spreads` | 536 | V gap 14 of five rows; each row H gap 14 of two **109 x 96** tiles |

Each tile is V gap 6, counter CENTER: a `sheet` **109 x 76** (two page minis side by side, H gap 2,
centred) above a `Mono/Small` label. Spreads 2-3 … 18-19, then a trailing ghost.

- current spread (12-13): `sheet` r3 + **1.5px `--accent`**, label `--accent`
- every other spread: no stroke, label `--ink-3`
- trailing `new spread`: ghost 106 x 74, r3, 1.5px `--hair`, label "new"

Page minis are drawn as real miniature pages, which is why the four paper styles need no new glyphs.

### 6c. Notebook tab — its own artboard `inspector — notebook tab` `649:172` at x 5600

268 x 808, wrapped in a `--ground` frame so it reads on the canvas. Pinned Night.

| y | card | h | contents |
|---|---|---|---|
| 64 | `identity` | 270 | sec-label NOTEBOOK. `cover mini` **95 x 120** centred — a `Notebook Cover` instance at **`rescale(0.4)`**. `name` `Text Field` 200 x 34 @(16,175). `linked subject` `Chip` `State=Filled, Palette=A Level` 128 x 32, centred: physics glyph + "Physics" + "9702". |
| 350 | `paper` | 154 | sec-label PAPER. `styles` 200 x 59, H gap 16, four FILL columns (38 wide): each a **32 x 40 mini page** above a `Body/Small` label — Blank, Ruled, Grid, Dotted. Then a `Switch` row "Margin rule", **on**. |
| 520 | `details` | 120 | sec-label DETAILS. Three label/value rows at pitch 24: Pages 48 · On this device 2.4 MB · Created 12 Aug. |
| 656 | `spacer` | FILL 40 | pushes the actions to the bottom |
| 712 | `actions` | 78 | `Export PDF` — `Button` `Style=Secondary`, FILL 232 x 34, `Icon=doc`. Then `Delete notebook` — 232 x 34, r `--r-btn`, fill **`--danger-soft`**, `Icon=trash` + `Body/Small` label in **`--danger`**, both centred. |

The delete row is the only use of `--danger` / `--danger-soft` in the file, and the reason both
tokens exist: without them, destructive styling has to borrow the difficulty heat ramp (`--d5`),
which rule 3 forbids outright.

---

## 7. New Notebook dialog

`New Notebook — Night` `653:1263` / `— Day` `653:1362`. The full shelf sits underneath, unchanged,
so the dialog is measured over live content rather than over a flat plate.

| layer | node | geometry | spec |
|---|---|---|---|
| scrim | `scrim` | 1320 x 860 @(0,0) | `--scrim` — **Night paint opacity 0.55, Day 0.28** |
| sheet | `dialog` | **520 x 422 @(400,219)** | exactly centred; height is HUG (24 + 374 + 24) |

`dialog` is **`--card` fill, not glass**, 1px `--card-brd`, radius `--r-panel` (16), blur 26,
`Shadow/Popover/Night|Day`. HORIZONTAL gap 24, pad 24. A sheet this size in chrome glass reads muddy
and gives text no stable ground — the same refinement onboarding landed on.

**Left — `preview` 160 x 202 @(24,24)**: a `Notebook Cover` instance at **`rescale(0.675)`**
(measured 159.98 x 202.5, book radius 8.775, inner gap 5.4). Use `rescale()`, never `resize()`:
`resize` scales geometry but leaves `fontSize` alone, so the cover title wraps and clips.

**Right — `form` 288 x 374 @(208,24)**, VERTICAL gap 16:

| y | row | h | spec |
|---|---|---|---|
| 0 | `name` | 34 | `Text Field` **`State=Focus`** — 1px `--accent` hairline, value "Mechanics" `--ink`, 1.5 x 16 `--accent` caret |
| 50 | `cover` | 51 | sec-label COVER + eight **28 x 28** swatches at pitch **37** (8 x 28 + 7 x 9 = 287 in 288). `cover/1` selected. |
| 117 | `sticker` | 57 | sec-label STICKER + seven **34 x 34** tiles at pitch **42**: five `Subject Icon` glyphs, one `Mr. Bell Mark`, then `browse`. |
| 190 | `paper` | 82 | sec-label PAPER + four FILL columns (**60** wide) at pitch 76, each a 32 x 40 mini page above its label — Blank, **Ruled** (selected), Grid, Dotted |
| 288 | `link a subject` | 32 | `Chip` `State=Default, Palette=Neutral` 130 x 32, `Icon=plus` + "Link a subject" |
| 336 | `actions` | 38 | H gap 10, align **MAX / CENTER** — Primary is 38 tall and Secondary 34, so the row must centre or they sit on different baselines. `Cancel` Secondary 72 x 34 · `Create notebook` Primary 166 x 38 |

> Sticker tiles are laid out by the auto-layout cell, not by absolute x. An earlier build set
> `glyph.x = cell.x + 8` — a canvas coordinate — inside cells at increasing x, and glyphs 2-6
> clipped out of frame. `layoutPositioning = 'AUTO'` on the glyph, with the cell aligned
> CENTER / CENTER, is the fix.

---

## 8. New tokens — 12 Colour variables, 12 Primitives

Every one is registered in the `GROUPS` table in `scripts/tokens.mjs` with its Code Syntax, then
`npm run tokens`.

| Colour token | Day | Night | alias | scopes | CSS |
|---|---|---|---|---|---|
| `cover/1` | `#1436C8` | `#1436C8` | `Primitives/cover/1` both | FRAME_FILL, SHAPE_FILL | `var(--cover-1)` |
| `cover/2` | `#0F6B6B` | `#0F6B6B` | ″ | ″ | `var(--cover-2)` |
| `cover/3` | `#1F6B3A` | `#1F6B3A` | ″ | ″ | `var(--cover-3)` |
| `cover/4` | `#8A5A00` | `#8A5A00` | ″ | ″ | `var(--cover-4)` |
| `cover/5` | `#9E1239` | `#9E1239` | ″ | ″ | `var(--cover-5)` |
| `cover/6` | `#3D4457` | `#3D4457` | ″ | ″ | `var(--cover-6)` |
| `cover/7` | `#1A1C24` | `#1A1C24` | ″ | ″ | `var(--cover-7)` |
| `cover/8` | `#8F3312` | `#8F3312` | ″ | ″ | `var(--cover-8)` |
| `cover/shade` | `#000000` @16% | same | `Primitives/cover/shade` | FRAME_FILL, SHAPE_FILL | `var(--cover-shade)` |
| `cover/label` | `#FFFFFF` | same | `Primitives/white` | **TEXT_FILL** | `var(--cover-label)` |
| `cover/label-2` | `#FFFFFF` @84% | same | `Primitives/alpha/white-84` | **TEXT_FILL** | `var(--cover-label-2)` |
| `cover/wire` | `#FFFFFF` @58% | same | `Primitives/alpha/white-58` | **STROKE_COLOR** | `var(--cover-wire)` |
| `ground/scrim` | `#181A34` @28% | `#05060C` @55% | `alpha/scrim-day` / `alpha/scrim-night` | FRAME_FILL, SHAPE_FILL | `var(--scrim)` |
| `state/danger` | `#B3261E` | `#FF6B6B` | `danger/day` / `danger/night` | SHAPE_FILL, TEXT_FILL, STROKE_COLOR | `var(--danger)` |
| `state/danger-soft` | `#B3261E` @12% | `#FF6B6B` @16% | `alpha/danger-day-12` / `alpha/danger-night-16` | FRAME_FILL, SHAPE_FILL | `var(--danger-soft)` |

New Primitives (mode `Value` only, scopes `[]` where hidden): `cover/1..8`, `cover/shade`,
`alpha/white-84`, `alpha/scrim-day`, `alpha/scrim-night`, `danger/day`, `danger/night`,
`alpha/danger-day-12`, `alpha/danger-night-16`.

### Why the cover family is mode-invariant

A cover is an **object**, like `--paper` and `--page-ink`. It must not invert with the tone, any more
than a physical notebook changes colour when you turn the lights on. All eight are chosen so
`--cover-label` (white) clears 4.5:1: measured **8.9 / 6.4 / 6.6 / 5.93 / 8.2 / 9.6 / 17.0 / 8.0**.
No purple anywhere — the file is audited purple-free.

`--cover-label-2` is **84%, not 74%**. At 74% the ratio falls to 4.26 / 4.40 / 4.05 on covers 2, 3
and 4 — below AA. The cover meta line is the only place in the file that needed a new alpha step.

`--danger*` is separable from the rest of this work: drop it and the Delete row falls back to
`--ink-2` text with no tint.

---

## 9. New components

| component | node | shape | why it had to be new |
|---|---|---|---|
| `Notebook Cover` | `606:50` | COMPONENT_SET, **16 variants** — `Cover 1..8` x `State Default \| Hover` | The shelf tile. Props `Name#608:0`, `Meta#608:17`, `Edited#608:34` TEXT, `Show Sticker#608:51`, `Show Photo#608:68` BOOLEAN, `Sticker#608:85` INSTANCE_SWAP (default `Subject=physics` `47:49`). Same API shape as `Chip` — palette-as-variant plus content props — so it is not a new idiom. |
| `Panel Tabs` | `618:24` | COMPONENT_SET 232 x 30, `Selected = 1 \| 2 \| 3` | `Segmented Control` bakes its grid/list/dash glyphs into its variants and exposes **no** text property, so it cannot carry "Tool / Pages / Notebook". Onboarding step 04 hit the same wall and fell back to Chips. Track `--glass-strong` + 1px `--hair`, r `--r-pill`, pad 3; selected segment `--card` + `Shadow/Card/Day` + `Body/Nav` `--ink`; idle transparent + `--ink-3`. Props `Tab 1#618:0`, `Tab 2#618:4`, `Tab 3#618:8`. |
| `Slider` | — | COMPONENT 232 x 20 | **The design system had no slider.** The Reader fakes one with `Meter`, which is a display bar built from `layoutGrow` ratios and cannot be dragged. Track 4px r999 `--hair`, filled part `--accent`, 14px `--white` knob carrying the Switch knob shadow (`#000000` @30%, (0,1), r3). |
| `Text Field` | `619:11` | COMPONENT_SET 232 x 34, `State = Default \| Focus` | **No input component existed.** Recipe cloned from the topbar `search` pill: r `--r-pill`, `--glass-strong`, 1px `--hair`, pad 0 / 12, `Body/Default`. Placeholder `--ink-3`, value `--ink`. Focus swaps the hairline to `--accent` and shows a 1.5 x 16 caret. Code already ships `@ui/Field`, so this closes a Figma-side gap. Prop `Text#619:0`. |
| `Icon Button` | `20:12` | **+1 variant** `State=Active` | Shipped `Default \| Hover` only, which is why the Reader hand-fills its active tool button. One new variant serves the dock, the nib tiles and the Reader retrofit. |

## 10. New icons — 14 glyphs

Into the `Icon` set `17:119`. Contract from `icons.md`: **24 x 24 box, every coordinate inside 0..24,
stroke 1.75, round cap and join, `fill: none`, paint `--ink-2`**; solid sub-shapes carry
`fill="currentColor" stroke="none"` to survive the global `svg{}` rule.

```
pencil   lasso   shapes   text   image   clip   sticky
ruler    pan     redo     right  plus    trash  dots
```

`undo` reuses the existing `ret`. Paper styles need no glyphs — they are drawn as 32 x 40 mini pages.
`right` is the arrow the set has never had; onboarding was bitten by its absence and shipped
`Continue` with no icon at all.

Sheet grows **31 → 45 glyphs**, layout unchanged at 8 per row / 46px pitch / origin (24,24), so the
set frame goes **430 x 210 → 430 x 302** (6 rows). Verified: 45 variants, frame 430 x 302.

Downstream in the same pass: 14 `<symbol>` blocks into `icons-paths.md`, then into
`src/components/Sprite.tsx` and the `IconName` union in `src/components/Icon.tsx`.

---

## 11. Motion — Notebook `662:1217`

Two frames, two timelines. **A timeline belongs to its top-level frame and its id is that frame node
id**, so two animations means two frames, not two timelines on one. Both frames hold **detached
clones**: `applyManualKeyframeTrack` on any descendant of an INSTANCE throws *"Cannot write
animations to instance sublayers via the plugin API"*.

**No page curl.** The app animates only `transform` and `opacity`, and Figma manual keyframes offer
TRANSLATION_X/Y, SCALE_X, SCALE_XY, ROTATION, WIDTH, HEIGHT, OPACITY, fills and effects — there is no
3D rotation. Every track below is transform or opacity, so both port 1:1 to CSS and collapse to a cut
under `prefers-reduced-motion`.

### `cover open` `662:1218` — 1320 x 860, **1.1s**, 21 tracks

| layer | property | keyframes |
|---|---|---|
| sidebar / topbar / content | OPACITY | 0.05 → 1 · 0.35 → 0 `ease-out` |
| hero cover | TRANSLATION_X | 0 → 0 · 0.55 → **+170.5** `ease-in-out` |
| hero cover | TRANSLATION_Y | 0 → 0 · 0.55 → **+149.5** `ease-in-out` |
| hero cover | SCALE_XY | 0 → (1,1) · 0.55 → **(1.9, 1.9)** `ease-in-out` |
| hero cover | OPACITY | 0.45 → 1 · 0.62 → 0 `ease-in-out` |
| spread | OPACITY | 0.45 → 0 · 0.70 → 1 `ease-out` |
| spread / page L | TRANSLATION_X | 0.45 → **+12** · 0.72 → 0 `ease-out` |
| spread / page R | TRANSLATION_X | 0.45 → **-12** · 0.72 → 0 `ease-out` |
| spread / rings | OPACITY | 0.55 → 0 · 0.80 → 1 `ease-out` |
| notebook topbar | OPACITY / TRANSLATION_Y | 0.62 → 0 / **-52** · 0.90 → 1 / 0 `ease-out` |
| tool dock | OPACITY / TRANSLATION_X | 0.62 → 0 / **-64** · 0.90 → 1 / 0 `ease-out` |
| inspector | OPACITY / TRANSLATION_X | 0.62 → 0 / **+268** · 0.90 → 1 / 0 `ease-out` |
| spread nav | OPACITY / TRANSLATION_Y | 0.70 → 0 / **+24** · 0.95 → 1 / 0 `ease-out` |
| topbar / save / dot | OPACITY | 0.98 → 0 · 1.06 → 1 `ease-out` |
| topbar / save / dot | SCALE_XY | 0.98 → (0,0) · **1.10 → (1,1) `ease-out-back`** |

Each surface leaves by exactly its own dimension — the dock by -64, the inspector by +268, the topbar
by -52 — so nothing crosses the stage. The save dot pops **last**, on a back-out curve: the only
moment the app admits it is writing to disk.

### `page turn` `666:1217` — 988 x 808, **0.45s**, 8 tracks

| layer | property | keyframes |
|---|---|---|
| page R | TRANSLATION_X | 0 → 0 · 0.24 → **-222.95** `ease-in` |
| page R | SCALE_X | 0 → 1 · 0.24 → **0.02** `ease-in` |
| page R | OPACITY | 0.20 → 1 · 0.26 → 0 `linear` |
| page next | TRANSLATION_X | 0.20 → **-222.95** · 0.45 → 0 `ease-out` |
| page next | SCALE_X | 0.20 → 0.02 · 0.45 → 1 `ease-out` |
| page next | OPACITY | 0.20 → 0 · 0.24 → 1 `linear` |
| page L / ink | OPACITY | 0.10 → 1 · 0.26 → 0 `ease-out` |
| page L / ink next | OPACITY | 0.26 → 0 · 0.42 → 1 `ease-out` |

**-222.95 is not a magic number**: SCALE_X compresses about the node centre, so squeezing a 455-wide
page to 0.02 moves its left edge inward by (455 − 9.1) / 2 = 222.95. Pairing the scale with that
translate pins the **left edge to the binding**, which is what makes it read as a page hinged on the
spiral rather than a page shrinking in place. **The coils never move** — they are the pivot, and that
is the mechanical argument for spiral binding over stitched.

The CSS port must gate both behind a reduced-motion query: `npm run audit`'s motion pass **fails the
build** if a `@keyframes` is not reachable behind a reduced-motion gate.

---

## 12. Day ↔ Night delta, complete

Geometry, structure, type and every token name are **identical** between the tones. Only the
background stack, the chrome alphas and the tone pill move.

| thing | Night | Day |
|---|---|---|
| frame fill `--ground` | `#111219` | `#e7e9f2` |
| window shadow | `Shadow/Window/Night` | **none** |
| background | ambient-a `#0836CE` @40% · ambient-b `#67C5FF` @60% · `bkg_image_night` rot -175.14° @76% · **veil `--ground-veil` 18%** | ambient-a `#D595FA` @34% · ambient-b `--ambient-b` @34% · `bkg_image_day` @100% · **no veil** |
| page recess | **absent** | **absent** |
| `--glass` | `rgba(32,34,48,.52)` | `rgba(255,255,255,.58)` |
| `--glass-strong` | `rgba(38,40,58,.70)` | `rgba(255,255,255,.74)` |
| `--hair` / `--hair-2` | `#ffffff24` / `#ffffff17` | `#181a341c` / `#181a3412` |
| `--card` / `--card-brd` | `#24273a` @90% / `#ffffff29` | `#f6f7fc` (opaque) / `#181a3417` |
| `--accent` / `--accent-soft` | `#6aa8ff` / 16% | `#1436c8` / 12% |
| `--scrim` | `#05060C` @**55%** | `#181A34` @**28%** |
| `--danger` / `--danger-soft` | `#ff6b6b` / 16% | `#b3261e` / 12% |
| paper shadow | `Shadow/Paper/Night` | `Shadow/Paper/Day` |
| cover shadow | `Shadow/Card/Night` (instance override) | `Shadow/Card/Day` (component default) |
| tone pill — shelf | x **895**, 125 wide, moon, "Night" | x **904**, 116 wide, sun, "Day" — right edge 1020 both |
| tone pill — spread | x **1091**, 125 wide | x **1100**, 116 wide — right edge 1216 both |
| inspector tab shown | Tool | Pages |
| `--cover-*`, `--page-*`, `--bell-gold`, `--iris-*` | **do not retone** | ″ |

Nothing else differs. Every x, y, size, gap, pad, radius, font and letter-spacing is identical.

## 13. TRAPS

1. **`get_design_context` on any sub-node of a Night frame resolves the fallback hexes in DAY.** The
   mode override lives on the top-level frame and a sub-node request loses it. Trust token *names*
   only; `get_variable_defs` on the same node **does** resolve correctly. (Reader TRAP 7, unchanged.)
2. **New frames default to the Colour collection first mode, which is Day.** Every one of the ten
   frames needed an explicit `setExplicitVariableModeForCollection(Color, '3:2' | '3:1')`. Verified.
3. **`clone()` and `detachInstance()` flatten paint-level opacity to 1 and can drop instance
   overrides.** The rings fill (`--page-ink` @16%), the gutter gradient and the sticky at its own
   alpha all needed re-applying after the motion clones. A structural source-vs-clone walk comparing
   paint opacity, node opacity and instance property overrides is the only reliable check.
4. **Do not "repair" a cross-mode clone against its source.** An earlier pass compared the Night
   dialog against the Day clone and overwrote 22 paint alphas that were legitimate mode differences
   (the scrim at 0.28 Day vs 0.55 Night among them). For a cross-mode clone, re-derive each bound
   paint alpha from its **variable resolved in the target mode**, never from the source node.
5. **Variable-derivation cannot recover an alpha that was layered on top of a bound variable.** The
   ring seat is `--page-ink` bound *and* painted at 16%; re-deriving from the variable returns 100%.
   Those have to be restored from a structural diff, not from the token.
6. **`SCALE_XY` rejects FLOAT** — pass `{type:'VECTOR', value:{x,y}}`. `SCALE_X` takes a float.
   The easing enum is `EASE_IN_AND_OUT`, not `EASE_IN_OUT`.
7. **`rescale()`, never `resize()`**, for the dialog cover preview and the notebook-tab mini.
   `resize` scales geometry but leaves `fontSize` alone, so the cover title wraps and clips.
8. **A `setProperties` INSTANCE_SWAP that already holds the desired value is a no-op even when the
   nested instance renders something else.** The dock `pen` button had `Icon#20:2 = 17:50` (pen) while
   its child instance still pointed at `Icon=search` — a direct child-level swap had diverged from the
   property. The fix is `inner.swapComponent(glyph)` on the child, not `setProperties` on the parent.
9. **`Notebook Cover` ships the Day shadow styles on the component.** Every instance placed on a Night
   frame must override `book` to `Shadow/Card/Night` (and `Shadow/Card Hover/Night` on `State=Hover`).
   The component description says so; the audit will not catch it because a shadow style is not a paint.
10. **`Panel Tabs` bakes `Shadow/Card/Day` into its selected segment** in both tones. It is a 1px lift
    on a 24px pill and reads correctly in Night, but it is a mode-invariant shadow — do not treat it as
    a bug when the audit flags the style name.
11. **The audit skips INSTANCE internals, so Mr. Bell hides raw paints until you detach him.** The
    `cover open` motion frame holds a detached sidebar, which exposes ~30 raw fills inside the crab
    spectacle rig (`specs/frame L`, `specs/frame R`, the `#0079b5` @42% lenses). Those are the mascot
    own artwork and a documented raw-colour exception — not a new violation.
12. **`clipsContent = false` is load-bearing on `content`, `shelf` and both rows.** The cover shadow
    reaches 12px below and 8px sideways; a hugging container that clips slices it. Same on `spread`,
    `ruling`, `ink`, `rings` and the Pages-tab `spreads`.
13. **Sub-layout positioning inside auto-layout cells must use `layoutPositioning = 'AUTO'`.** Setting
    an absolute `x` derived from the cell canvas position clips every cell after the first.
14. **`Ink/Annotation` (Caveat) is now load-bearing, and was never actually deleted.** `foundations.md`
    section 6.1 declared it gone based on a sweep of *applied* text styles, which by construction cannot
    see a style nothing applies. `getLocalTextStylesAsync()` returns 19 styles, including this one,
    `Title/Wordmark` and `Mono/Paper Code`. Delete Caveat and the whole spread loses its handwriting.
15. **The page indicator has no total, by design.** Any implementation that renders "12 of 40" breaks
    the "never ask the student how many pages" requirement. `next` is always enabled.
16. **The code sidebar will have six rows, not five.** The app already carries Settings as a fifth row,
    so Notebooks makes six. The code sidebar is flexbox with the mascot as the flex spacer, so it
    compresses rather than breaking — but check Mr. Bell is not visibly cut and say so.

## 14. What the implementation must honour

The measured spec above is the contract; `~/.claude/plans/claude-need-you-to-eventual-pebble.md`
Part 2 carries the build plan. The four requirements that came from Zohaib directly, and which the
design encodes rather than merely allows:

1. **A notebook is a named object with a cover you chose** — hence 8 mode-invariant cover tokens, a
   sticker slot and a photo slot, and a cover that is the same colour in both tones.
2. **Infinite pages, never asked for** — hence `pages 12-13` with no total, an always-enabled `next`,
   and a Pages tab whose last tile is a ghost rather than a count.
3. **Always saved locally** — hence the `save` dot in the topbar, the only place the app says so, and
   "2.4 MB on this device" in the Notebook tab.
4. **Tools that are not the Reader's** — hence twelve dock tools in four groups, four nibs, pressure /
   smoothing / straight-line-lock, a two-mode eraser, and a live lasso selection with corner handles
   drawn on page 13.

Geometry in the saved format is **fractions of the page box, never pixels**, quantised to 4 dp, so a
page renders identically at any zoom or window size.
