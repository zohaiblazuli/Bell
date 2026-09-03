# Bell — Interactive Controls (measured spec)

Source: Figma `GnDdYtn8SaQjgmA4SQRCn7` "Foolscap — Design System". Read-only extraction.
Covers **Button** `22:47`, **Chip** `21:20`, **Segmented Control** `42:111`, **Switch** `532:7`,
**Icon Button** `20:12`, **Kbd** `13:4`. Everything below is measured, not inferred, except the four
lines explicitly marked *(inferred)*.

## 0. Global conventions

| Thing | Value |
|---|---|
| Line height | every text style is AUTO → `line-height: normal`. Never set a px line-height. |
| Stroke alignment | **INSIDE** on every control (verified: switch export insets its stroke rect by 0.5). Borders do **not** grow the intrinsic sizes below. |
| Stroke weight | 1 px on every control that has one. |
| `clipsContent` | true on Button, Chip, Switch, Icon Button, Kbd, the Segmented container **and** each segment. |
| Sizing shorthand | `HUG/FIXED` = width hugs, height pinned. Vertical padding is 0 wherever the height is pinned — the height, not the padding, sets the box. |
| Disabled | Figma applies **node opacity 0.55** to the whole variant. It is not a recolour; the border and shadow dim with it. |
| Icon stroke | the `Icon` set is authored 24×24 / 1.75 stroke. Scaled instances therefore export at 16 px → **1.16667**, 18 px → **1.3125**, 14 px → **1.02083**. Match those, don't re-stroke at 1.75. |
| Property keys | VARIANT keys are bare (`State`, `Style`, `Palette`, `Segments`, `Selected`). TEXT / BOOLEAN / INSTANCE_SWAP keys carry the `#id` suffix and are verbatim. |
| Tokens | `--white` = `Primitives/white` `#FFFFFF`, identical in both modes. It is outside the supplied vocabulary but is a real bound variable, not a literal. |

---

## 1. Button — set `22:47` (9 variants)

**Axes** — `Style` (default `Secondary`) = `Secondary | Toggle | Primary`; `State` (default `Default`) = `Default | Hover | Disabled`. Full 3×3 grid, no holes.

**Properties**

| Key | Type | Default |
|---|---|---|
| `Label#22:27` | TEXT | `"Start focus"` |
| `Show Icon#22:28` | BOOLEAN | `true` |
| `Icon#22:29` | INSTANCE_SWAP | `17:70` (`Icon / Icon=check`), preferred set `Icon` `17:119` |
| `Style` | VARIANT | `Secondary` |
| `State` | VARIANT | `Default` |

**Geometry**

| | Secondary / Toggle | Primary |
|---|---|---|
| Intrinsic size | **123 × 34** | **131 × 38** |
| Node ids | `22:6` / `22:11` / `22:16` (Sec), `22:21` / `22:26` / `22:31` (Tog) | `22:36` / `22:41` / `22:46` |
| Sizing | HUG / FIXED | HUG / FIXED |
| Direction | HORIZONTAL | HORIZONTAL |
| Padding (T/R/B/L) | 0 / 14 / 0 / 14 | 0 / 18 / 0 / 18 |
| itemSpacing | 8 | 8 |
| Align | primary MIN, counter CENTER | primary MIN, counter CENTER |
| Radius | `--r-btn` (10, bound) | `--r-btn` (10, bound) |
| Children | `icon` INSTANCE 16×16 → `label` TEXT | same |

Width is `padX*2 + 16 + 8 + labelWidth`. `"Start focus"` at Body/Strong measures **71 px**, which is where 123 and 131 come from. Height never changes.

**Paint per state** — label is Body/Strong (SF Pro Semibold 13, tracking −0.4 %) in every cell.

| Style / State | Fill | Stroke 1px | Label + icon | Effect | Opacity |
|---|---|---|---|---|---|
| Secondary Default | `--glass-strong` | `--hair` | `--ink` | — | 1 |
| Secondary Hover | `--glass-strong` | **`--accent`** | `--ink` | — | 1 |
| Secondary Disabled | `--glass-strong` | `--hair` | `--ink` | — | **0.55** |
| Toggle Default | `--accent-soft` | **none** | `--accent` | — | 1 |
| Toggle Hover | `--accent-soft` | **`--accent`** | `--accent` | — | 1 |
| Toggle Disabled | `--accent-soft` | none | `--accent` | — | **0.55** |
| Primary Default | `Blue/Primary Button 135` (§7) | none | `--white` | DS-A (§9) | 1 |
| Primary Hover | `Blue/Primary Button 135` | none | `--white` | DS-A | 1 |
| Primary Disabled | `Blue/Primary Button 135` | none | `--white` | DS-A | **0.55** |

Icon stroke colours, read out of the exported SVGs: Secondary `#1B1D27` = `--ink`, Toggle `#1436C8` = `--accent`, Primary `white` = `--white`; all at stroke-width 1.16667.

```
Secondary / Toggle  34h          Primary  38h
┌──────────────────────────┐   ┌────────────────────────────┐
│ 14 │16│ 8 │ label 71 │14 │   │ 18 │16│ 8 │ label 71 │ 18  │
└──────────────────────────┘   └────────────────────────────┘
   123 total, r10                  131 total, r10 + DS-A
```

---

## 2. Chip — set `21:20` (21 variants)

**Axes** — `State` (default `Default`) = `Default | Hover | Filled`; `Palette` (default `Neutral`) = `Neutral | A Level | IGCSE | O Level | Feb-March | May-June | Oct-Nov`. Full 3×7 grid.
Variant node ids, in file order: Neutral `21:7` / `21:13` / `21:19`; A Level `83:19` / `83:23` / `83:27`; IGCSE `83:31` / `83:35` / `83:39`; O Level `83:43` / `83:47` / `83:51`; Feb-March `110:51` / `110:56` / `110:61`; May-June `110:66` / `110:71` / `110:76`; Oct-Nov `110:81` / `110:86` / `110:91` (Default / Hover / Filled each).

**Properties**

| Key | Type | Default |
|---|---|---|
| `Label#21:12` | TEXT | `"A Level"` |
| `Code#21:13` | TEXT | `"9706"` |
| `Show Code#21:14` | BOOLEAN | `false` |
| `Show Close#21:15` | BOOLEAN | `false` |
| `Show Icon#109:0` | BOOLEAN | `false` |
| `Icon#109:13` | INSTANCE_SWAP | `102:6` (`Season Icon / Season=may-june`); preferred sets `Season Icon`, `Subject Icon`, `Icon` |
| `State`, `Palette` | VARIANT | `Default`, `Neutral` |

**Geometry — identical for all 21 variants**

| Field | Value |
|---|---|
| Intrinsic size | **66 × 32** at default content (label `"A Level"` = 42 px, all three booleans off) |
| Sizing | HUG / FIXED |
| Direction / align | HORIZONTAL, primary MIN, counter CENTER |
| Padding | 0 / 12 / 0 / 12 |
| itemSpacing | **7** |
| Radius | `--r-pill` (999, bound) |
| Child order | `icon` 18×18 → `label` TEXT → `code` TEXT → `close` 14×14 |

Width = `24 + Σ(visible children) + 7 × (n − 1)`. Icon 18, label 42, close 14, code = measured Mono/Small text. All four visible → `119 + codeWidth`.

**Paint per state × palette.** Fill/stroke change with both axes; **Default ignores `Palette` entirely** — all seven Default variants are pixel-identical.

| State | Fill | Stroke 1px | Label |
|---|---|---|---|
| Default (any palette) | `--glass-strong` | `--hair` | `--ink-2` |
| Hover | `--glass-strong` | palette **Edge** | `--ink` |
| Filled — Neutral only | `--accent-soft` | **none** | `--ink` |
| Filled — other 6 | palette **Wash** (`linear-gradient(90deg, …)`) | palette **Edge** | `--ink` |

`code` is Mono/Small `--ink-3` in all three states. `close` stroke: Default `--ink-2` `#4C5165`, Hover `--ink` `#1B1D27`, **Filled `--ink-3` `#62677C`** (yes, Filled steps back down — matches `.chip.filled .x` in the app).
Label is Body/Chip (SF Pro Medium 12, tracking 0).

```
┌───────────────────────────────────────┐ 32h
│ 12 │ [18] 7 │ label │ 7 [code] │ 7 [14] │ 12 │   r999
└───────────────────────────────────────┘
  66 wide at default (label only)
```

---

## 3. Segmented Control — set `42:111` (5 variants, sparse grid)

**Axes** — `Segments` (default `2`) = `2 | 3`; `Selected` (default `1`) = `1 | 2 | 3`.
**`Segments=2, Selected=3` does not exist.** Existing variants: `42:29` (2,1) · `42:44` (2,2) · `42:66` (3,1) · `42:88` (3,2) · `42:110` (3,3). Set both keys in one call when going 3 → 2 so you never transit the missing cell.

**No TEXT, BOOLEAN or INSTANCE_SWAP properties exist.** The three glyphs are baked into the variants: Segment 1 = `Icon=grid`, Segment 2 = `Icon=list`, Segment 3 = `Icon=dash`. They are unreachable through `setProperties`; changing them means reaching `instance.children[i].children[0]` and swapping the main component — an override outside the component API. If a screen needs different glyphs, do not use this component (Onboarding step 04 uses Chips for exactly this reason).

**Container**

| Field | Value |
|---|---|
| Intrinsic size | `Segments=2` **71 × 36**, `Segments=3` **104 × 36** |
| Sizing | HUG / HUG — but de-facto fixed, every child is FIXED |
| Direction / align | HORIZONTAL, primary MIN, counter CENTER |
| Padding | 4 on all four sides |
| itemSpacing | **0** |
| Fill / stroke | `--hair-2` / 1 px `--hair` |
| Radius | `--r-pill` (999, bound) |

**Children**, in order: `Segment 1` → `separator` → `Segment 2` → [`separator` → `Segment 3`].
Width check: `4 + 30 + 3 + 30 + 4 = 71`; `4 + 30 + 3 + 30 + 3 + 30 + 4 = 104`. Height `4 + 28 + 4 = 36`.

| Child | Size | Radius | Paint |
|---|---|---|---|
| Segment (frame) | **30 × 28** FIXED/FIXED, flex centre/centre, clip | **999 literal** (not a token) | unselected: no fill, no effect · selected: `--glass-strong` + effect style **`Shadow/Card/Day`** (§9 DS-B) |
| icon inside segment | 16 × 16 | — | selected `--ink` `#1B1D27`, unselected `--ink-3` `#62677C`, stroke-width 1.16667 |
| `separator` (rect) | **3 × 20** | 0 | `--hair` |

**Separator visibility** — a separator touching the selected segment hides. It hides via **`opacity: 0`, not `visible: false`**, so it still occupies its 3 px of layout in every variant.

| Variant | sep 1 (1↔2) | sep 2 (2↔3) |
|---|---|---|
| 2, 1 | hidden | — |
| 2, 2 | hidden | — |
| 3, 1 | hidden | **visible** |
| 3, 2 | hidden | hidden |
| 3, 3 | **visible** | hidden |

```
Segments=3, Selected=1                       36h
┌────────────────────────────────────────┐
│4│ ▣ grid  │ ¦ │  list  │ | │  dash  │4│    ¦ = sep opacity 0
│ │ 30×28   │3│  30×28   │3│  30×28   │ │    | = sep visible (--hair)
└────────────────────────────────────────┘
  104 wide, r999, fill --hair-2 + 1px --hair
  ▣ = selected: --glass-strong + Shadow/Card/Day, r999
```

---

## 4. Switch — page `532:2`, set `532:7` (2 variants)

**Axis** — `State` (default `Off`) = `Off | On`. `532:3` Off, `532:5` On. **No other properties of any kind.**

| Field | Value |
|---|---|
| Intrinsic size | **44 × 24**, both variants, FIXED / FIXED |
| Layout | none — no auto-layout. Single child, absolutely placed. |
| `clipsContent` | **true**, so the knob's cast is clipped at the track edge |
| Radius | **12 literal** (not `--r-pill`; 12 = h/2 so it reads as a pill anyway) |
| Track fill — Off | `--hair` (export: `#181A34` @ 11 %) |
| Track fill — On | paint style **`Blue/Primary Button 135`** (§7) |
| Track stroke — both | 1 px INSIDE `--hair` |
| `knob` ELLIPSE `532:4` | **18 × 18**, fill `--white`, at **x = 2, y = 2** (Off) and **x = 24, y = 2** (On) |
| Knob effect | DROP_SHADOW `#000000` @ 30 %, offset (0, 1), blur **3**, spread 0 |

Knob travel is **22 px** (2 → 24), leaving a symmetric 2 px gutter on both ends.

```
Off                              On
┌────────────────────┐          ┌────────────────────┐
│ ( ● )              │ 24h      │              ( ● ) │
└────────────────────┘          └────────────────────┘
 2  18            2                2            18  2
 track --hair, 1px --hair          track = Blue/Primary Button 135
 44 × 24, r12, knob 18 white + #000 30% (0,1) r3
```

---

## 5. Icon Button — set `20:12` (2 variants)

**Axis** — `State` (default `Default`) = `Default | Hover`. `20:6` Default, `20:11` Hover.
**Property** — `Icon#20:2` INSTANCE_SWAP, default `17:23` (`Icon / Icon=search`), preferred set `Icon`. No TEXT or BOOLEAN props. Swap the glyph; never add a variant per glyph.

| Field | Value |
|---|---|
| Intrinsic size | **34 × 34**, both variants, **FIXED / FIXED** (square — do not expect hug) |
| Direction / align | HORIZONTAL, primary **CENTER**, counter **CENTER** |
| Padding / itemSpacing | 0 / 0 |
| Radius | `--r-btn` (10) |
| Fill — Default | **none** |
| Fill — Hover | `--hair-2` |
| Stroke | none in both states |
| Effect | none in both states |
| `icon` INSTANCE | **18 × 18**, stroke-width 1.3125; Default `--ink-2` `#4C5165`, Hover `--ink` `#1B1D27` |

---

## 6. Kbd — COMPONENT `13:4` (no variants, no set)

**Property** — `Key#13:0` TEXT, default `"K"`. That is the entire API.

| Field | Value |
|---|---|
| Intrinsic size | **19 × 18** for `"K"` |
| Sizing | **HUG / HUG** — both axes hug |
| Direction / align | HORIZONTAL, primary MIN, counter CENTER |
| Padding | **2 / 6 / 2 / 6** |
| itemSpacing | 0 (single child) |
| Radius | **6 literal** (not a token) |
| Fill | `--glass-strong` |
| Stroke | 1 px `--hair` |
| Effect | none |
| Text | **Mono/Small** (Geist Mono Regular 11, tracking 0), `--ink-3` |

Width = `12 + textWidth` (`"K"` = 7 px). Height = `4 + 14` and grows with the text box, not with the key count — multi-key caps ("Ctrl") widen only.

---

## 7. Paint style `Blue/Primary Button 135`

Used by **Button / Style=Primary** (all three states) and **Switch / State=On** track. Nothing else in these six components uses it.

| Field | Value |
|---|---|
| Type | `GRADIENT_LINEAR`, blend NORMAL, paint opacity 1 |
| Handles (normalized object space) | **P0 (0, 0) → P1 (0.70710678, 0.70710678)** — a true 135° axis whose end handle stops at 70.711 % (= 1/√2) of the box diagonal |
| `gradientTransform` row 0 | `[0.70710678, 0.70710678, 0]` (i.e. `t = √2/2 · (u + v)`) |
| Stop 0 | position **0.0**, `#1436C8`, α **1.00**, bound variable **`bell/cap-lo`** → `--bell-cap-lo` |
| Stop 1 | position **1.0**, `#2C7BFF`, α **1.00**, bound variable **`bell/cap-mid`** → `--bell-cap-mid` |
| Modes | both stops are bound and `bell/cap-*` is mode-invariant → **identical in Day and Night** |

**Ship it as** `linear-gradient(135deg, var(--bell-cap-lo), var(--bell-cap-mid))`. That is what the app's `--grad-btn` already is, and it is the intended reading of the style name.

Verification, so nobody re-derives this: the 44 × 24 switch SVG export carries `x1=0 y1=0 x2=14.2684 y2=26.1587`. A Figma linear gradient's colour-change direction in pixel space is `(a/w, b/h)`, not the handle vector, so with `a = b = √2/2` the predicted vector is `(14.2698, 26.1598)` and length `29.7967` — matching the export to four significant figures. Same `a = b` reproduces the Button's reported angle exactly (below).

---

## 8. Palette paint styles (Chip only)

Six Edge/Wash pairs. Wash is always a **90° two-stop** gradient (`to right`).

| Palette | Edge (stroke) | Wash stop 0 → stop 1 | Bound? |
|---|---|---|---|
| A Level | `#4FC3F7` @ **0.9** | `#4FC3F7` @ 0.4 → `#6AA8FF` @ 0.4 | raw, unbound |
| IGCSE | `--bell-cap-mid` `#2C7BFF` @ 1.0 | `--bell-cap-mid` `#2C7BFF` → `--bell-cap-hi` `#58C8FF`, **both α 1.0** | variable-bound |
| O Level | `--bell-cap-lo` `#1436C8` @ 1.0 | `--bell-cap-lo` `#1436C8` → `--bell-cap-mid` `#2C7BFF`, **both α 1.0** | variable-bound |
| Feb-March | `#8FCFE6` @ **0.7** | `#8FCFE6` @ 0.28 → `#B8E3F2` @ 0.28 | raw, unbound |
| May-June | `#3FB84F` @ **0.7** | `#3FB84F` @ 0.28 → `#7ED48C` @ 0.28 | raw, unbound |
| Oct-Nov | `#1A8B93` @ **0.7** | `#1A8B93` @ 0.28 → `#46B0AE` @ 0.28 | raw, unbound |

Style names as they appear in the file: `Board/A Level/Edge`, `Board/A Level/Wash`, `Board/IGCSE/*`, `Board/O Level/*`, `Season/Feb-March/*`, `Season/May-June/*`, `Season/Oct-Nov/*`.

## 9. Effects

| Ref | Where | Definition | Style? |
|---|---|---|---|
| **DS-A** | Button `Style=Primary`, all 3 states | DROP_SHADOW `#6F76F2` @ **0.90**, offset (0, 10), blur **24**, spread **−14** | **no** — inline, unbound |
| **DS-B** | Segmented Control, selected segment | effect style **`Shadow/Card/Day`**: DROP_SHADOW `#121432` @ 0.06, (0, 1), blur 2, spread 0 **+** DROP_SHADOW `#121432` @ 0.10, (0, 4), blur 10, spread −2 | yes |
| **DS-C** | Switch knob | DROP_SHADOW `#000000` @ 0.30, offset (0, 1), blur 3, spread 0 | no |

CSS order (outermost first) for DS-B: `0 4px 10px -2px rgba(18,20,50,.10), 0 1px 2px 0 rgba(18,20,50,.06)`.
Chip, Icon Button and Kbd carry **no effects in any state**.

## 10. TRAPS

1. **Chip `Default` ignores `Palette`.** All seven Default variants are pixel-identical (`--glass-strong` + `--hair` + `--ink-2`). Build 1 default + 6 hover + 7 filled, not 21 cases.
2. **IGCSE and O Level Filled are fully opaque, not washes.** Their Wash stops are bound to `bell/cap-mid|hi|lo` at **α 1.0**, so those two chips are saturated blue gradients carrying an `--ink` `#1B1D27` label. Confirmed on the rendered set — O Level Filled is near-illegible (dark navy text on `#1436C8`). The other four washes sit at 0.28–0.40 alpha and read fine. This is a real defect in the source, not a conversion artifact: decide explicitly whether to ship it, switch those two to `--white` labels, or add alpha.
3. **A Level and all three season Edge/Wash paints are raw and unbound.** They do not retone between Day and Night and are not in the token vocabulary. Treat them as chip constants. Only IGCSE and O Level are variable-bound.
4. **Segmented separators hide with `opacity: 0`, not `visible: false`** — the 3 px stays in the layout in every variant, which is why the widths are 71 / 104 regardless of selection.
5. **Segmented glyphs are baked into the variants** (grid / list / dash) with no INSTANCE_SWAP property. They cannot be changed through the component API. If a screen needs other glyphs, use Chips instead.
6. **The Segmented grid is sparse**: `Segments=2, Selected=3` does not exist. Set `Segments` and `Selected` in the same call when stepping 3 → 2.
7. **The selected segment's shadow is the `Shadow/Card/Day` effect style** — Day-named, with no Night counterpart applied. It does not retone; the same `#121432` shadow renders over the Night ground.
8. **Primary Button `Hover` is visually identical to `Default`.** There is no hover treatment in Figma at all. The app supplies `filter: brightness(1.06)`. Choose one and write it down — do not assume the design "lost" a state.
9. **The Primary shadow colour `#6F76F2` is stale.** It survives from the pre-Sep-2026 iris/indigo palette that was reblued, and it is an inline unbound effect, so it neither follows `--bell-cap-*` nor retones. The app uses `--bell-cap-mid` @ 90 % instead — the two visibly differ (periwinkle vs blue). Pick deliberately.
10. **Disabled is node `opacity: 0.55`**, not a recolour. The border and the Primary shadow dim with it. Do not build a disabled palette.
11. **Not every radius is a token.** Bound: Button and Icon Button `--r-btn`, Chip and the Segmented container `--r-pill`. **Literal:** Switch `12`, Kbd `6`, inner segment `999`, separator `0`. Don't tokenise them silently — that changes the file's structure, not just its pixels.
12. **Do not paste the MCP's gradient CSS.** It emits `linear-gradient(163.8238066383916deg, … 0%, … 70.711%)` for the 131 × 38 Primary button and `151.3895deg` for the 44 × 24 switch: the angle is `180° − atan(h/w)`, i.e. the box's aspect baked into the value, and the last stop is always 70.711 % (= 1/√2). The style is one gradient. Use `135deg` with stops at 0 % / 100 %.
13. **The Switch is built inside-out relative to the current app CSS.** Figma: gradient on the **track**, knob stays `--white`. App `.tone .sw`: `--accent-soft` on the track and `--grad-btn` on the **knob**. Figma also travels the knob 2 → 24 (22 px, symmetric 2 px gutters) where the app uses `translateX(20px)` (4 px right gutter).
14. **The Chip icon slot does not inherit the chip's text colour.** Its default swap target is `Season Icon / may-june`, which carries its own gradient paints. Only a plain `Icon` swap picks up a single stroke colour.
15. **Chip `close` is non-monotonic**: `--ink-2` (Default) → `--ink` (Hover) → **`--ink-3`** (Filled). Filled deliberately steps the affordance back down.
16. Reading `componentPropertyDefinitions` on a variant COMPONENT throws — read it from the SET. `Kbd 13:4` is a plain component and can be read directly.

### Figma vs the current `src/styles/app.css` (Figma is authoritative for the rebuild)

| Control | Figma | `app.css` today |
|---|---|---|
| `.seg` container | padding 4, gap **0**, radius `--r-pill` | padding 3, gap 2, radius `--r-btn` |
| `.seg` segment | **30 × 28**, radius 999 | 30 × 26, radius 7 |
| `.seg` icon | 16, `--ink-3` → `--ink` | 16, `--ink-3` → `--ink` (matches) |
| `.chip` label | 12 px | 12.5 px |
| `.chip` icon | **18** | 14 at `opacity .7` |
| `.btn.on` (Toggle) | Default has **no** border; Hover adds 1 px `--accent` | `border-color: transparent`, no hover rule |
| `.btn.primary` shadow | `#6F76F2` @ .9 | `color-mix(--bell-cap-mid 90%)` |
| `.sw` | gradient on track, radius 12 | gradient on knob, radius 999 |
| `.kbd` | radius 6, pad 2/6, `--glass-strong`, `--hair` | identical |
| `.icobtn` | 34 × 34, r `--r-btn`, hover `--hair-2`, icon 18 `--ink-2` → `--ink` | identical (plus a transparent 1 px border) |
