# Bell — icon system (measured spec)

Source: Figma `GnDdYtn8SaQjgmA4SQRCn7` "Foolscap — Design System", read-only.
**All vector geometry lives in the companion `icons-paths.md`** — 66 paste-ready `<symbol>` blocks
in local `0 0 24 24` space. This file is the contract around them.

## The four sets

| Set | Node | Page | Variant prop | Glyphs | Sheet | Paint |
|---|---|---|---|---|---|---|
| Icon | `17:119` | `17:2` Icon | `Icon` | **45** | **430x302** | `--ink-2` |
| Subject Icon | `47:81` | — | `Subject` | 17 | 352x176 | `--ink-2` |
| Season Icon | `102:15` | — | `Season` | 3 | 176x76 | none (raw gradients) |
| Brand Mark / GitHub | `427:4` | `17:2` Icon | (single component) | 1 | 24x24 | `--ink-3` |

`get_variable_defs` on `17:119` and `47:81` returns exactly `{"var(--ink-2)":"#4c5165"}`; on `427:4`
`{"var(--ink-3)":"#62677c"}`; on `102:15` it returns `{}` — the Season badges are unbound hex and do
**not** retone between Day and Night.

Figma's own description on `17:119`: *"The app's own 29-icon sprite, ported from
src/components/Sprite.tsx. 24x24 box, 1.75 stroke, round caps. Colour defaults to ink/2 — override
per instance the way currentColor does in the app. Use this set as the INSTANCE_SWAP target wherever
a component takes an icon."*

That description is now stale on the count — the set holds **45** glyphs. The 14 added for Notebooks
(`screen-notebooks.md` section 10) are listed at the bottom of the Icon table.

## Geometry contract

| Property | Value |
|---|---|
| Box | 24 x 24, `viewBox="0 0 24 24"` |
| Bleed | none — **every** coordinate in all 66 glyphs lies inside 0..24 (verified numerically) |
| Stroke weight | 1.75 (exceptions: `min` 2.6, `max` 2.4, Season marks 1.6 / 1.5) |
| Caps / joins | `round` / `round` (one exception: `sun` rays, see TRAPS) |
| Fill | `none` (10 exceptions, all listed in the tables below) |
| Colour | single flat paint per set — no per-glyph colour anywhere in Icon / Subject |

## Rendering harness (as shipped)

`<use>` clones do **not** inherit paint from the `<g>` they were authored inside — they inherit from
the use site. So the presentation lives in a global rule (`src/styles/index.css`) and every glyph is
authored bare:

```css
svg { fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }
```

Consumers set colour with `color:` and size with `width`/`height` on the `<svg>`. Solid shapes inside
a glyph must carry `fill="currentColor" stroke="none"` on the element to survive that rule.

## Sheet layout (documentation frames — absolute, no auto-layout)

All three sheets are plain frames with variants placed absolutely. Nothing here is a layout to
rebuild; it is only the map for finding a glyph by eye.

```
Icon  17:119  430x302   cells 24px, pitch 46 x 46, origin (24,24)
        x=24    70     116   162     208      254     300    346
 y= 24  lib     dash   bm    clock   search   sliders grid   list
 y= 70  left    chev   pen   hl      eraser   zin     zout   check
 y=116  checkc  x      focus book    ret      doc     folder sync
 y=162  warn    min    max   play    pause    sun     moon   pencil
 y=208  lasso   shapes text  image   clip     sticky  ruler  pan
 y=254  plus    trash  dots  redo    right     -       -      -

Subject  47:81  352x176   cells 24px, pitch 50 x 50, origin (26,26)
        x=26        76            126        176      226        276
 y= 26  accounting  biology       business   chemistry computing economics
 y= 76  maths       further-maths add-maths  physics   psychology english
 y=126  ict         global        islamiyat  pakistan  urdu       -

Season  102:15  176x76   cells 24px, pitch 50, origin (26,26)
        x=26        76        126
 y= 26  may-june    oct-nov   feb-march
```

Icon rows 5 and 6 are the Notebooks additions. The frame grew 430x210 to **430x302** to hold them;
pitch, origin and cell size did not change, and `pencil` filled the one empty cell in row 4.

## Icon — 45 glyphs, set `17:119`

`els` = number of drawn elements in the symbol. Everything not marked in **deviation** is a bare
stroked path inheriting 1.75 / round / round / `fill:none`.

| Glyph | Node | els | Shape | Deviation from the default |
|---|---|---|---|---|
| lib | `17:6` | 2 | open book, two mirrored leaves | — |
| dash | `17:12` | 4 | 4 rounded panels (r 1.4) | — |
| bm | `17:15` | 1 | bookmark pennant | filled by consumers for the "on" state |
| clock | `17:19` | 2 | circle r 8.2 + hands | — |
| search | `17:23` | 2 | circle r 7 @ (11,11) + tail | — |
| sliders | `17:28` | 3 | two rules + 2 knobs r 2.4 | knobs `fill` only, **no stroke** |
| grid | `17:34` | 4 | 4 squares 7x7 r 1.6 | — |
| list | `17:40` | 4 | 3 rules + 3 bullets r 1.1 | bullets `fill` only, **no stroke** |
| left | `17:43` | 1 | arrow-left, single path | — |
| chev | `17:46` | 1 | chevron down | — |
| pen | `17:50` | 2 | baseline + nib body | — |
| hl | `17:54` | 2 | highlighter head + baseline | — |
| eraser | `17:59` | 3 | body + seam + baseline | — |
| zin | `17:63` | 2 | circle r 7 + tail & plus | — |
| zout | `17:67` | 2 | circle r 7 + tail & minus | — |
| check | `17:70` | 1 | tick | — |
| checkc | `17:74` | 2 | circle r 8.4 + tick | — |
| x | `17:77` | 1 | cross, one path | — |
| focus | `17:81` | 2 | circle r 8.4 + circle r 3.4 | — |
| book | `17:85` | 2 | cover + inner fold | — |
| ret | `17:89` | 2 | arrow head + hooked shaft | **see TRAPS** |
| doc | `17:93` | 2 | page + dog-ear | — |
| folder | `17:96` | 1 | folder, one path | — |
| sync | `17:100` | 2 | 300-degree arc + arrow | — |
| warn | `17:105` | 3 | triangle + bar + dot r 0.9 | dot `fill` only, **no stroke** |
| min | `17:108` | 1 | single rule y=12, x 5..19 | `stroke-width` **2.6** |
| max | `17:111` | 1 | square 13x13 r 2 @ (5.5,5.5) | `stroke-width` **2.4** |
| play | `17:114` | 1 | triangle | `fill` **and** 1.75 stroke |
| pause | `17:118` | 2 | two bars 3.4x13 r 1 | `fill` **and** 1.75 stroke |
| sun | `163:2` | 2 | circle r 3.125 + 8 rays | rays cap is **butt**, not round |
| moon | `163:5` | 1 | crescent, one closed path | — |

### The 14 added for Notebooks

| Glyph | Node | els | Shape | Deviation from the default |
|---|---|---|---|---|
| pencil | `595:5` | 3 | body quad + tip seam + ferrule seam | — |
| lasso | `595:10` | 3 | flat ellipse + tail curve + bead r 1.4 | — |
| shapes | `595:14` | 2 | square 11x11 r 1.6 + circle r 5.1, overlapping | — |
| text | `595:19` | 3 | cap rule + stem + foot rule | — |
| image | `596:6` | 3 | frame 17.6x14.8 r 2.2 + sun r 1.7 + two-peak ridge | — |
| clip | `596:10` | 2 | two interlocking crop corners | — |
| sticky | `596:16` | 4 | square + folded corner + two text rules | — |
| ruler | `596:20` | 2 | rotated bar + 4 tick marks (one path) | — |
| pan | `597:5` | 2 | crosshair (one path) + 4 arrowheads (one path) | — |
| plus | `597:8` | 1 | plus — **one path, two subpaths** | — |
| trash | `597:14` | 4 | lid rule + handle + can + 2 slots (one path) | — |
| dots | `597:19` | 3 | three discs r 1.5 at x 5.6 / 12 / 18.4 | all three `fill` only, **no stroke** |
| redo | `598:2` | 2 | arrow head + hooked shaft, mirrored from `ret` | — |
| right | `598:5` | 1 | arrow-right — **one path, two subpaths** | — |

`undo` reuses the existing `ret` `17:89`. `redo` is a **mirrored** `ret`, not a 180-degree rotation —
rotating it would put the hook above the shaft instead of below it. Paper styles need no glyphs at
all: they are drawn as 32 x 40 mini pages.

## Subject Icon — 17 glyphs, set `47:81`

Same contract as Icon: bare stroked paths, 1.75 / round / round, paint `--ink-2`. Only one deviation
in the whole set. These are the CAIE subject glyphs; the variant name is the subject slug.

| Glyph | Node | els | Shape | Deviation |
|---|---|---|---|---|
| accounting | `47:9` | 5 | balance scales: post, beam, 2 pan triangles, base | — |
| biology | `47:13` | 2 | leaf + midrib | — |
| business | `47:18` | 3 | briefcase body + handle + belt rule | — |
| chemistry | `47:23` | 3 | flask neck rule + body + liquid line | — |
| computing | `47:27` | 2 | chip square + 8 legs (one path) | — |
| economics | `47:32` | 3 | axes + rising line + arrow corner | — |
| maths | `47:38` | 4 | compass head r 1.6 + 2 legs + crossbar | — |
| further-maths | `47:41` | 1 | sigma, one path | — |
| add-maths | `47:44` | 1 | radical, one path | — |
| physics | `47:49` | 3 | nucleus r 1.7 + flat ellipse + tilted ellipse | nucleus `fill` only, **no stroke** |
| psychology | `47:54` | 3 | psi stem + bowl + base | — |
| english | `47:57` | 1 | 4 text rules, one path | — |
| ict | `47:62` | 3 | monitor + neck + foot | — |
| global | `47:67` | 3 | circle r 8.2 + equator + meridian | — |
| islamiyat | `47:72` | 1 | crescent, one closed path | — |
| pakistan | `47:76` | 2 | folded map outline + 2 creases | — |
| urdu | `47:80` | 2 | speech bubble + 2 rules | — |

## Season Icon — 3 glyphs, set `102:15`

Structurally unlike the other sets: a **badge** plus a **mark**, both gradient-painted, and the mark
is thinner than 1.75. Geometry is identical across all three; only the gradient stops and the mark
change.

| Part | Geometry | Paint |
|---|---|---|
| badge | `rect` x 2.875 y 2.875, 18.25 x 18.25, `rx 5.125`, `stroke-width 1.75` | gradient fill + gradient stroke |
| mark | see `icons-paths.md` | gradient stroke, `stroke-width` 1.6 (may-june) / 1.5 (others) |

| Glyph | Node | Mark | Badge fill | Edge + mark stops (0 / 0.55 / 1) |
|---|---|---|---|---|
| may-june | `102:6` | disc r 3.1 (`fill`, no stroke) + 8 rays @ 1.6 | `#FFF6E0` → `#FFE2A8` | `#FFC107` `#FB8C00` `#F4511E` |
| oct-nov | `102:10` | snowflake, one path @ 1.5 | `#EAF6FE` → `#CDE8FB` | `#4FC3F7` `#2E86DE` `#5C6BC0` |
| feb-march | `102:14` | sprout, one path @ 1.5 | `#F0F8E6` → `#D8EFC6` | `#9CCC65` `#4CAF50` `#26A69A` |

All gradients are `userSpaceOnUse` in the local 24-box. Badge fill and badge edge both run
`2,2 → 22,22`. The mark gradients have their own extents: may-june disc `8.9,8.9 → 15.1,15.1`,
may-june rays `4.9,4.9 → 19.1,19.1`, oct-nov `5.598,5.909 → 17.7649,18.6971`, feb-march
`7.596,7.3 → 16.976,16.0889`.

## Brand Mark / GitHub — `427:4`

One closed path, `fill: var(--ink-3)`, **no stroke** — the only fill-only whole glyph in the file.
Ink box is 24 wide but 23.4057 tall, sitting at y 0.297..23.7027. Do not re-centre it vertically;
the 0.297 top gap is the real GitHub mark's own metric.

## Parity with the shipped sprite

`src/components/Sprite.tsx` defines **29** symbols (`i-lib` … `i-max` in a stroked `<g>`, then
`i-play` / `i-pause` in a bare `<g>`). `src/components/Icon.tsx` types the same 29 names.
Figma is now 16 ahead.

| Gap | Detail |
|---|---|
| `sun` `163:2`, `moon` `163:5` | in Figma, **not** in the sprite — added to the design system after the port |
| the 14 Notebooks glyphs | in Figma, **not** in the sprite — port them together with the two above and the whole gap closes in one pass |
| `src/ui/icons/Sprite.tsx` | a second, unreferenced sprite holding 31 glyphs **including `sun` and `moon`**. Nothing imports it, which is why `TonePill.tsx:33` and `SettingsView.tsx:52` each inline their own copy of the sun/moon paths. Wiring it up retires that duplication |
| Subject Icon (17) | no code counterpart at all; nothing in `src/` references a subject slug |
| Season Icon (3) | no code counterpart at all |
| Brand Mark / GitHub | no code counterpart at all |

Three measured divergences where Figma and the code disagree. Per the file's own Getting Started
note the code wins, so treat these as Figma bugs unless told otherwise:

1. **`play` / `pause`** — Figma paints them `fill` **and** a 1.75 round stroke; the sprite paints
   `fill` only with no stroke. Figma's version therefore reads ~0.875px fatter on every edge with
   rounded corners.
2. **`sun` rays** — the Figma node has no cap set (butt). Every other glyph in the file is round, and
   the global CSS rule would give it round anyway.
3. **Primitives vs flattened paths** — the sprite uses `<rect>` / `<circle>` for dash, grid, max,
   clock, search, zin, zout, checkc, focus, the sliders knobs, the list bullets, the warn dot and the
   pause bars. Figma's export is a bezier approximation of those same shapes. Prefer the primitives
   when rebuilding: shorter, and exactly circular.

## TRAPS

- **`ret` `17:89` — two independently painted vectors.** `Vector` is the arrow head, `Vector_2` the
  hooked shaft, and each carries its own `--ink-2` stroke. Figma has no `currentColor`, so a consumer
  instance recolours per layer and the file's consumers override only the first child — the shaft
  stays ink/2 while the head takes the new colour. In code the global `svg{}` rule covers both, so the
  app is unaffected. Any port must colour the whole `<symbol>` / `<svg>`, never "the path".
- **12 elements are fill-only and will render as stroked blobs** unless they carry
  `fill="currentColor" stroke="none"`: sliders knobs (2), list bullets (3), warn dot (1), physics
  nucleus (1), may-june disc (1), the GitHub mark (1), **`dots` discs (3)**. `play` / `pause` are
  different — they keep an inherited stroke in Figma on purpose.
- **`plus`, `right`, `pan`, `ruler` and `trash` each pack several subpaths into one `<path d>`.** The
  `els` count in the tables is the number of `<path>` elements, not the number of strokes you see. Do
  not split them for clarity — the multi-subpath form is what Figma exported and what the 3 dp numbers
  in `icons-paths.md` were verified against.
- **`min` is 2.6 and `max` is 2.4.** The window-control glyphs are deliberately heavier than the
  1.75 body weight. Do not normalise them.
- **Season Icon binds no variables.** `get_variable_defs` on `102:15` is empty — the badges are raw
  hex and identical in Day and Night. A light amber/blue/green badge on `--ground` Night is the
  design as drawn, not a mistake to "fix" silently.
- **Nothing renders at 24.** Real sizes in `app.css` are 14, 15, 16 and 18 px (`.chip svg` 14,
  `.timer .pp svg` 15, `.search`/`.btn`/`.seg button`/`.card .bm` 16, `.nav`/`.icobtn` 18). `<use>`
  scales the stroke with the box, so the effective weight is 1.02–1.31px. 1.75 is a nominal
  authoring weight only.
- **`get_design_context` on a glyph gives you an `<img>`, not geometry.** Exporting the set frame as
  SVG (`download_assets`, `defaultFormat: "svg"`) and translating out the cell offset is the only way
  to get real paths; per-glyph `download_assets` also works but is 52 round-trips.
- **Frame-level export rounds to 3 dp; per-node export gives 5 dp.** Max divergence ~0.0005px at 24.
  The paths in `icons-paths.md` are the 3 dp form, spot-verified identical against per-node exports of
  `17:89` and `47:72`.
- **The sprite also defines `<linearGradient id="iris">`** (the bell-cap stops, used by every live
  stroke). Its id is a collision hazard if the icon sprite is ever merged into another SVG.



