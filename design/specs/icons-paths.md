# Bell — icon geometry (raw paths)

Companion to `icons.md`. Extracted from Figma `GnDdYtn8SaQjgmA4SQRCn7` by exporting each
component-set frame as SVG and translating every coordinate into the glyph's local `0 0 24 24`
box (offsets are whole pixels, so the translation is lossless). Verified against per-node
exports of `17:89` (ret) and `47:72` (islamiyat) — identical to 3 dp. The 14 Notebooks glyphs were
exported per node and rounded to the same 3 dp; no coordinate leaves the 0..24 box (verified).

Every symbol below assumes it sits inside a wrapper that supplies the defaults:

```html
<g fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
```

Attributes printed ON an element are the measured deviations from those defaults — carry them
across verbatim. `fill="currentColor" stroke="none"` marks a solid shape; `stroke-linecap="butt"`
marks a glyph whose Figma cap is NOT round.

---

## Icon — set `17:119` (45 glyphs, paint `--ink-2`)

`17:6`
```html
<symbol id="i-lib" viewBox="0 0 24 24">
  <path d="M12 6.5C10 5 6.5 5 4.5 6.2V19C6.5 17.8 10 17.8 12 19.3"/>
  <path d="M12 6.5C14 5 17.5 5 19.5 6.2V19C17.5 17.8 14 17.8 12 19.3"/>
</symbol>
```

`17:12`
```html
<symbol id="i-dash" viewBox="0 0 24 24">
  <path d="M9.1 3.5H4.9C4.1268 3.5 3.5 4.1268 3.5 4.9V11.1C3.5 11.8732 4.1268 12.5 4.9 12.5H9.1C9.8732 12.5 10.5 11.8732 10.5 11.1V4.9C10.5 4.1268 9.8732 3.5 9.1 3.5Z"/>
  <path d="M19.1 3.5H14.9C14.1268 3.5 13.5 4.1268 13.5 4.9V7.6C13.5 8.3732 14.1268 9 14.9 9H19.1C19.8732 9 20.5 8.3732 20.5 7.6V4.9C20.5 4.1268 19.8732 3.5 19.1 3.5Z"/>
  <path d="M19.1 12H14.9C14.1268 12 13.5 12.6268 13.5 13.4V19.1C13.5 19.8732 14.1268 20.5 14.9 20.5H19.1C19.8732 20.5 20.5 19.8732 20.5 19.1V13.4C20.5 12.6268 19.8732 12 19.1 12Z"/>
  <path d="M9.1 15.5H4.9C4.1268 15.5 3.5 16.1268 3.5 16.9V19.1C3.5 19.8732 4.1268 20.5 4.9 20.5H9.1C9.8732 20.5 10.5 19.8732 10.5 19.1V16.9C10.5 16.1268 9.8732 15.5 9.1 15.5Z"/>
</symbol>
```

`17:15`
```html
<symbol id="i-bm" viewBox="0 0 24 24">
  <path d="M6.5 4.5H17.5C17.765 4.5 18.02 4.6054 18.207 4.7929C18.395 4.9804 18.5 5.2348 18.5 5.5V20L12 15.8L5.5 20V5.5C5.5 5.2348 5.605 4.9804 5.793 4.7929C5.98 4.6054 6.235 4.5 6.5 4.5Z"/>
</symbol>
```

`17:19`
```html
<symbol id="i-clock" viewBox="0 0 24 24">
  <path d="M12 20.2C16.529 20.2 20.2 16.5287 20.2 12C20.2 7.4713 16.529 3.8 12 3.8C7.471 3.8 3.8 7.4713 3.8 12C3.8 16.5287 7.471 20.2 12 20.2Z"/>
  <path d="M12 7.6V12L15 13.8"/>
</symbol>
```

`17:23`
```html
<symbol id="i-search" viewBox="0 0 24 24">
  <path d="M11 18C14.866 18 18 14.866 18 11C18 7.134 14.866 4 11 4C7.134 4 4 7.134 4 11C4 14.866 7.134 18 11 18Z"/>
  <path d="M20.5 20.5L16.4 16.4"/>
</symbol>
```

`17:28`
```html
<symbol id="i-sliders" viewBox="0 0 24 24">
  <path d="M4 8H20M4 16H20"/>
  <path d="M15 10.4C16.325 10.4 17.4 9.3255 17.4 8C17.4 6.6745 16.325 5.6 15 5.6C13.675 5.6 12.6 6.6745 12.6 8C12.6 9.3255 13.675 10.4 15 10.4Z" fill="currentColor" stroke="none"/>
  <path d="M9 18.4C10.325 18.4 11.4 17.3255 11.4 16C11.4 14.6745 10.325 13.6 9 13.6C7.675 13.6 6.6 14.6745 6.6 16C6.6 17.3255 7.675 18.4 9 18.4Z" fill="currentColor" stroke="none"/>
</symbol>
```

`17:34`
```html
<symbol id="i-grid" viewBox="0 0 24 24">
  <path d="M9.4 4H5.6C4.716 4 4 4.7163 4 5.6V9.4C4 10.2837 4.716 11 5.6 11H9.4C10.284 11 11 10.2837 11 9.4V5.6C11 4.7163 10.284 4 9.4 4Z"/>
  <path d="M18.4 4H14.6C13.716 4 13 4.7163 13 5.6V9.4C13 10.2837 13.716 11 14.6 11H18.4C19.284 11 20 10.2837 20 9.4V5.6C20 4.7163 19.284 4 18.4 4Z"/>
  <path d="M9.4 13H5.6C4.716 13 4 13.7163 4 14.6V18.4C4 19.2837 4.716 20 5.6 20H9.4C10.284 20 11 19.2837 11 18.4V14.6C11 13.7163 10.284 13 9.4 13Z"/>
  <path d="M18.4 13H14.6C13.716 13 13 13.7163 13 14.6V18.4C13 19.2837 13.716 20 14.6 20H18.4C19.284 20 20 19.2837 20 18.4V14.6C20 13.7163 19.284 13 18.4 13Z"/>
</symbol>
```

`17:40`
```html
<symbol id="i-list" viewBox="0 0 24 24">
  <path d="M9 6H20M9 12H20M9 18H20"/>
  <path d="M4.5 7.1C5.108 7.1 5.6 6.6075 5.6 6C5.6 5.3925 5.108 4.9 4.5 4.9C3.892 4.9 3.4 5.3925 3.4 6C3.4 6.6075 3.892 7.1 4.5 7.1Z" fill="currentColor" stroke="none"/>
  <path d="M4.5 13.1C5.108 13.1 5.6 12.6075 5.6 12C5.6 11.3925 5.108 10.9 4.5 10.9C3.892 10.9 3.4 11.3925 3.4 12C3.4 12.6075 3.892 13.1 4.5 13.1Z" fill="currentColor" stroke="none"/>
  <path d="M4.5 19.1C5.108 19.1 5.6 18.6075 5.6 18C5.6 17.3925 5.108 16.9 4.5 16.9C3.892 16.9 3.4 17.3925 3.4 18C3.4 18.6075 3.892 19.1 4.5 19.1Z" fill="currentColor" stroke="none"/>
</symbol>
```

`17:43`
```html
<symbol id="i-left" viewBox="0 0 24 24">
  <path d="M19 12H5M12 5L5 12L12 19"/>
</symbol>
```

`17:46`
```html
<symbol id="i-chev" viewBox="0 0 24 24">
  <path d="M6 9.5L12 15.5L18 9.5"/>
</symbol>
```

`17:50`
```html
<symbol id="i-pen" viewBox="0 0 24 24">
  <path d="M12 20H21"/>
  <path d="M16.5 3.6C16.898 3.2022 17.437 2.9787 18 2.9787C18.563 2.9787 19.102 3.2022 19.5 3.6C19.898 3.9978 20.121 4.5374 20.121 5.1C20.121 5.6626 19.898 6.2022 19.5 6.6L7.2 18.9L3 20L4.1 15.8L16.5 3.6Z"/>
</symbol>
```

`17:54`
```html
<symbol id="i-hl" viewBox="0 0 24 24">
  <path d="M15 4.5L19.5 9L11 17.5H6.5V13L15 4.5Z"/>
  <path d="M5 21H12"/>
</symbol>
```

`17:59`
```html
<symbol id="i-eraser" viewBox="0 0 24 24">
  <path d="M4.5 15.2L12.8 6.9C13.174 6.5336 13.676 6.3283 14.2 6.3283C14.724 6.3283 15.226 6.5336 15.6 6.9L18.6 9.9C18.966 10.2739 19.172 10.7765 19.172 11.3C19.172 11.8235 18.966 12.3261 18.6 12.7L12.3 19H8L4.5 15.2Z"/>
  <path d="M8.5 11L13.5 16"/>
  <path d="M6 19.2H19"/>
</symbol>
```

`17:63`
```html
<symbol id="i-zin" viewBox="0 0 24 24">
  <path d="M11 18C14.866 18 18 14.866 18 11C18 7.134 14.866 4 11 4C7.134 4 4 7.134 4 11C4 14.866 7.134 18 11 18Z"/>
  <path d="M20.5 20.5L16.4 16.4M11 8.4V13.6M8.4 11H13.6"/>
</symbol>
```

`17:67`
```html
<symbol id="i-zout" viewBox="0 0 24 24">
  <path d="M11 18C14.866 18 18 14.866 18 11C18 7.134 14.866 4 11 4C7.134 4 4 7.134 4 11C4 14.866 7.134 18 11 18Z"/>
  <path d="M20.5 20.5L16.4 16.4M8.4 11H13.6"/>
</symbol>
```

`17:70`
```html
<symbol id="i-check" viewBox="0 0 24 24">
  <path d="M5 12.5L9.5 17L19 7.5"/>
</symbol>
```

`17:74`
```html
<symbol id="i-checkc" viewBox="0 0 24 24">
  <path d="M12 20.4C16.6392 20.4 20.4 16.639 20.4 12C20.4 7.361 16.6392 3.6 12 3.6C7.3608 3.6 3.6 7.361 3.6 12C3.6 16.639 7.3608 20.4 12 20.4Z"/>
  <path d="M8.4 12.2L10.8 14.6L15.4 9.8"/>
</symbol>
```

`17:77`
```html
<symbol id="i-x" viewBox="0 0 24 24">
  <path d="M6 6L18 18M18 6L6 18"/>
</symbol>
```

`17:81`
```html
<symbol id="i-focus" viewBox="0 0 24 24">
  <path d="M12 20.4C16.639 20.4 20.4 16.639 20.4 12C20.4 7.361 16.639 3.6 12 3.6C7.361 3.6 3.6 7.361 3.6 12C3.6 16.639 7.361 20.4 12 20.4Z"/>
  <path d="M12 15.4C13.878 15.4 15.4 13.878 15.4 12C15.4 10.122 13.878 8.6 12 8.6C10.122 8.6 8.6 10.122 8.6 12C8.6 13.878 10.122 15.4 12 15.4Z"/>
</symbol>
```

`17:85`
```html
<symbol id="i-book" viewBox="0 0 24 24">
  <path d="M5 4.5H16C16.53 4.5 17.039 4.711 17.414 5.086C17.789 5.461 18 5.97 18 6.5V20H7C6.47 20 5.961 19.789 5.586 19.414C5.211 19.039 5 18.53 5 18V4.5Z"/>
  <path d="M18 16H7C6.47 16 5.961 16.211 5.586 16.586C5.211 16.961 5 17.47 5 18"/>
</symbol>
```

`17:89`
```html
<symbol id="i-ret" viewBox="0 0 24 24">
  <path d="M9 10L5 14L9 18"/>
  <path d="M5 14H16C16.796 14 17.559 13.684 18.121 13.121C18.684 12.559 19 11.796 19 11V6"/>
</symbol>
```

`17:93`
```html
<symbol id="i-doc" viewBox="0 0 24 24">
  <path d="M6 3H14L18 7V20C18 20.265 17.895 20.52 17.707 20.707C17.52 20.895 17.265 21 17 21H6C5.735 21 5.48 20.895 5.293 20.707C5.105 20.52 5 20.265 5 20V4C5 3.735 5.105 3.48 5.293 3.293C5.48 3.105 5.735 3 6 3Z"/>
  <path d="M14 3V7H18"/>
</symbol>
```

`17:96`
```html
<symbol id="i-folder" viewBox="0 0 24 24">
  <path d="M3.5 7.5C3.5 7.235 3.605 6.98 3.793 6.793C3.98 6.605 4.235 6.5 4.5 6.5H8.5L10.5 9H18.5C18.765 9 19.02 9.105 19.207 9.293C19.395 9.48 19.5 9.735 19.5 10V18.5C19.5 18.765 19.395 19.02 19.207 19.207C19.02 19.395 18.765 19.5 18.5 19.5H4.5C4.235 19.5 3.98 19.395 3.793 19.207C3.605 19.02 3.5 18.765 3.5 18.5V7.5Z"/>
</symbol>
```

`17:100`
```html
<symbol id="i-sync" viewBox="0 0 24 24">
  <path d="M20 12C20.003 13.848 19.366 15.64 18.198 17.072C17.029 18.503 15.401 19.486 13.59 19.854C11.779 20.221 9.896 19.95 8.263 19.086C6.629 18.223 5.344 16.821 4.627 15.118C3.91 13.414 3.804 11.516 4.329 9.744C4.853 7.971 5.975 6.436 7.503 5.397C9.031 4.358 10.872 3.88 12.713 4.045C14.553 4.21 16.28 5.006 17.6 6.3"/>
  <path d="M20 4.5V10H14.5"/>
</symbol>
```

`17:105`
```html
<symbol id="i-warn" viewBox="0 0 24 24">
  <path d="M12 4.5L21 19.5H3L12 4.5Z"/>
  <path d="M12 10V14.2"/>
  <path d="M12 17.9C12.4971 17.9 12.9 17.497 12.9 17C12.9 16.503 12.4971 16.1 12 16.1C11.5029 16.1 11.1 16.503 11.1 17C11.1 17.497 11.5029 17.9 12 17.9Z" fill="currentColor" stroke="none"/>
</symbol>
```

`17:108`
```html
<symbol id="i-min" viewBox="0 0 24 24">
  <path d="M5 12H19" stroke-width="2.6"/>
</symbol>
```

`17:111`
```html
<symbol id="i-max" viewBox="0 0 24 24">
  <path d="M16.5 5.5H7.5C6.395 5.5 5.5 6.395 5.5 7.5V16.5C5.5 17.605 6.395 18.5 7.5 18.5H16.5C17.605 18.5 18.5 17.605 18.5 16.5V7.5C18.5 6.395 17.605 5.5 16.5 5.5Z" stroke-width="2.4"/>
</symbol>
```

`17:114`
```html
<symbol id="i-play" viewBox="0 0 24 24">
  <path d="M8 5.5V18.5L19 12L8 5.5Z" fill="currentColor"/>
</symbol>
```

`17:118`
```html
<symbol id="i-pause" viewBox="0 0 24 24">
  <path d="M9.4 5.5H8C7.448 5.5 7 5.948 7 6.5V17.5C7 18.052 7.448 18.5 8 18.5H9.4C9.952 18.5 10.4 18.052 10.4 17.5V6.5C10.4 5.948 9.952 5.5 9.4 5.5Z" fill="currentColor"/>
  <path d="M16 5.5H14.6C14.048 5.5 13.6 5.948 13.6 6.5V17.5C13.6 18.052 14.048 18.5 14.6 18.5H16C16.552 18.5 17 18.052 17 17.5V6.5C17 5.948 16.552 5.5 16 5.5Z" fill="currentColor"/>
</symbol>
```

`163:2`
```html
<symbol id="i-sun" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="3.125"/>
  <path d="M18.2 12H21.4M16.384 16.384L18.647 18.647M12 18.2V21.4M7.616 16.384L5.353 18.647M5.8 12H2.6M7.616 7.616L5.353 5.353M12 5.8V2.6M16.384 7.616L18.647 5.353" stroke-linecap="butt"/>
</symbol>
```

`163:5`
```html
<symbol id="i-moon" viewBox="0 0 24 24">
  <path d="M20.983 12.77C20.566 17.516 16.517 21.118 11.755 20.979C6.993 20.84 3.161 17.009 3.021 12.247C2.881 7.485 6.484 3.434 11.23 3.017C9.191 5.797 9.485 9.639 11.923 12.077C14.361 14.515 18.199 14.809 20.981 12.772L20.983 12.77Z"/>
</symbol>
```

### The 14 added for Notebooks

Same defaults wrapper as above. `dots` is the only solid glyph in the batch, so its three discs
carry `fill="currentColor" stroke="none"`. `plus`, `right`, `pan`, `ruler` and `trash` each pack
several subpaths into a single `d` — leave them packed.

`595:5`
```html
<symbol id="i-pencil" viewBox="0 0 24 24">
  <path d="M17.2 3.8L20.2 6.8L10 17L5.2 18.8L7 14L17.2 3.8Z"/>
  <path d="M7 14L10 17"/>
  <path d="M14.4 6.6L17.4 9.6"/>
</symbol>
```

`595:10`
```html
<symbol id="i-lasso" viewBox="0 0 24 24">
  <path d="M12 15.5C16.694 15.5 20.5 13.038 20.5 10C20.5 6.962 16.694 4.5 12 4.5C7.306 4.5 3.5 6.962 3.5 10C3.5 13.038 7.306 15.5 12 15.5Z"/>
  <path d="M7.8 14.9C7.6 17 8.4 18.6 9.8 19.4"/>
  <path d="M10.6 21.8C11.373 21.8 12 21.173 12 20.4C12 19.627 11.373 19 10.6 19C9.827 19 9.2 19.627 9.2 20.4C9.2 21.173 9.827 21.8 10.6 21.8Z"/>
</symbol>
```

`595:14`
```html
<symbol id="i-shapes" viewBox="0 0 24 24">
  <path d="M12.9 3.5H5.1C4.216 3.5 3.5 4.216 3.5 5.1V12.9C3.5 13.784 4.216 14.5 5.1 14.5H12.9C13.784 14.5 14.5 13.784 14.5 12.9V5.1C14.5 4.216 13.784 3.5 12.9 3.5Z"/>
  <path d="M15.4 20.5C18.217 20.5 20.5 18.217 20.5 15.4C20.5 12.583 18.217 10.3 15.4 10.3C12.583 10.3 10.3 12.583 10.3 15.4C10.3 18.217 12.583 20.5 15.4 20.5Z"/>
</symbol>
```

`595:19`
```html
<symbol id="i-text" viewBox="0 0 24 24">
  <path d="M5.5 5.5H18.5"/>
  <path d="M12 5.5V18.5"/>
  <path d="M9 18.5H15"/>
</symbol>
```

`596:6`
```html
<symbol id="i-image" viewBox="0 0 24 24">
  <path d="M18.6 4.6H5.4C4.185 4.6 3.2 5.585 3.2 6.8V17.2C3.2 18.415 4.185 19.4 5.4 19.4H18.6C19.815 19.4 20.8 18.415 20.8 17.2V6.8C20.8 5.585 19.815 4.6 18.6 4.6Z"/>
  <path d="M9 11.7C9.939 11.7 10.7 10.939 10.7 10C10.7 9.061 9.939 8.3 9 8.3C8.061 8.3 7.3 9.061 7.3 10C7.3 10.939 8.061 11.7 9 11.7Z"/>
  <path d="M4 17.6L9.6 12L14.6 16.4L17.2 14.2L20 16.8"/>
</symbol>
```

`596:10`
```html
<symbol id="i-clip" viewBox="0 0 24 24">
  <path d="M7.5 3V15.5C7.5 16.3 8.2 17 9 17H21"/>
  <path d="M3 7.5H15C15.8 7.5 16.5 8.2 16.5 9V21"/>
</symbol>
```

`596:16`
```html
<symbol id="i-sticky" viewBox="0 0 24 24">
  <path d="M4.5 4.5H19.5V14.5L14.5 19.5H4.5V4.5Z"/>
  <path d="M19.5 14.5H14.5V19.5"/>
  <path d="M8 9H16"/>
  <path d="M8 12.2H13"/>
</symbol>
```

`596:20`
```html
<symbol id="i-ruler" viewBox="0 0 24 24">
  <path d="M2.06 18.06L18.06 2.06L21.95 5.95L5.95 21.95L2.06 18.06Z"/>
  <path d="M5.24 14.88L6.65 16.29M8.42 11.7L9.83 13.11M11.61 8.51L13.02 9.92M14.79 5.33L16.2 6.74"/>
</symbol>
```

`597:5`
```html
<symbol id="i-pan" viewBox="0 0 24 24">
  <path d="M12 3.2V20.8M3.2 12H20.8"/>
  <path d="M9.6 5.8L12 3.2L14.4 5.8M9.6 18.2L12 20.8L14.4 18.2M5.8 9.6L3.2 12L5.8 14.4M18.2 9.6L20.8 12L18.2 14.4"/>
</symbol>
```

`597:8`
```html
<symbol id="i-plus" viewBox="0 0 24 24">
  <path d="M12 5V19M5 12H19"/>
</symbol>
```

`597:14`
```html
<symbol id="i-trash" viewBox="0 0 24 24">
  <path d="M4.5 7.5H19.5"/>
  <path d="M9.5 7.5V4.8C9.5 4.3 9.9 3.9 10.4 3.9H13.6C14.1 3.9 14.5 4.3 14.5 4.8V7.5"/>
  <path d="M6.6 7.5L7.5 19.6C7.6 20.3 8.2 20.9 8.9 20.9H15.1C15.8 20.9 16.4 20.3 16.5 19.6L17.4 7.5"/>
  <path d="M10.4 11.4V17M13.6 11.4V17"/>
</symbol>
```

`597:19`
```html
<symbol id="i-dots" viewBox="0 0 24 24">
  <path d="M5.6 13.5C6.428 13.5 7.1 12.828 7.1 12C7.1 11.172 6.428 10.5 5.6 10.5C4.772 10.5 4.1 11.172 4.1 12C4.1 12.828 4.772 13.5 5.6 13.5Z" fill="currentColor" stroke="none"/>
  <path d="M12 13.5C12.828 13.5 13.5 12.828 13.5 12C13.5 11.172 12.828 10.5 12 10.5C11.172 10.5 10.5 11.172 10.5 12C10.5 12.828 11.172 13.5 12 13.5Z" fill="currentColor" stroke="none"/>
  <path d="M18.4 13.5C19.228 13.5 19.9 12.828 19.9 12C19.9 11.172 19.228 10.5 18.4 10.5C17.572 10.5 16.9 11.172 16.9 12C16.9 12.828 17.572 13.5 18.4 13.5Z" fill="currentColor" stroke="none"/>
</symbol>
```

`598:2`
```html
<symbol id="i-redo" viewBox="0 0 24 24">
  <path d="M15 10L19 14L15 18"/>
  <path d="M19 14H8C7.204 14 6.441 13.684 5.879 13.121C5.316 12.559 5 11.796 5 11V6"/>
</symbol>
```

`598:5`
```html
<symbol id="i-right" viewBox="0 0 24 24">
  <path d="M5 12H19M12 5L19 12L12 19"/>
</symbol>
```

---

## Subject Icon — set `47:81` (17 glyphs, paint `--ink-2`)

`47:9`
```html
<symbol id="s-accounting" viewBox="0 0 24 24">
  <path d="M12 5.5V19"/>
  <path d="M4.5 8.5H19.5"/>
  <path d="M4.5 8.5L2.2 13.5H6.8L4.5 8.5Z"/>
  <path d="M19.5 8.5L17.2 13.5H21.8L19.5 8.5Z"/>
  <path d="M8.5 19H15.5"/>
</symbol>
```

`47:13`
```html
<symbol id="s-biology" viewBox="0 0 24 24">
  <path d="M5 19.5C5 11.5 9.5 5.8 19 5.2C19.6 13.8 14.4 19 5 19.5Z"/>
  <path d="M19 5.2L8.6 15.6"/>
</symbol>
```

`47:18`
```html
<symbol id="s-business" viewBox="0 0 24 24">
  <path d="M18.5 7.5H5.5C4.395 7.5 3.5 8.3954 3.5 9.5V17.5C3.5 18.6046 4.395 19.5 5.5 19.5H18.5C19.605 19.5 20.5 18.6046 20.5 17.5V9.5C20.5 8.3954 19.605 7.5 18.5 7.5Z"/>
  <path d="M9 7.5V6C9 5.6022 9.158 5.2206 9.439 4.9393C9.721 4.658 10.102 4.5 10.5 4.5H13.5C13.898 4.5 14.279 4.658 14.561 4.9393C14.842 5.2206 15 5.6022 15 6V7.5"/>
  <path d="M3.5 12.5H20.5"/>
</symbol>
```

`47:23`
```html
<symbol id="s-chemistry" viewBox="0 0 24 24">
  <path d="M9 3.5H15"/>
  <path d="M10 3.5V8.5L5.2 18.6C5.073 18.8193 5.007 19.0691 5.011 19.3227C5.015 19.5763 5.087 19.8241 5.22 20.0397C5.354 20.2554 5.543 20.4307 5.769 20.547C5.994 20.6633 6.247 20.7162 6.5 20.7H17.5C17.753 20.7162 18.006 20.6633 18.231 20.547C18.457 20.4307 18.646 20.2554 18.78 20.0397C18.913 19.8241 18.985 19.5763 18.989 19.3227C18.993 19.0691 18.927 18.8193 18.8 18.6L14 8.5V3.5"/>
  <path d="M7.4 14.5H16.6"/>
</symbol>
```

`47:27`
```html
<symbol id="s-computing" viewBox="0 0 24 24">
  <path d="M15 7.5H9C8.172 7.5 7.5 8.1716 7.5 9V15C7.5 15.8284 8.172 16.5 9 16.5H15C15.828 16.5 16.5 15.8284 16.5 15V9C16.5 8.1716 15.828 7.5 15 7.5Z"/>
  <path d="M10.5 4V7.5M13.5 4V7.5M10.5 16.5V20M13.5 16.5V20M4 10.5H7.5M4 13.5H7.5M16.5 10.5H20M16.5 13.5H20"/>
</symbol>
```

`47:32`
```html
<symbol id="s-economics" viewBox="0 0 24 24">
  <path d="M4 4V20H20"/>
  <path d="M7.5 15.5L11 11L14 13.6L18.5 7.5"/>
  <path d="M15.4 7.5H19V11.1"/>
</symbol>
```

`47:38`
```html
<symbol id="s-maths" viewBox="0 0 24 24">
  <path d="M12 7.7C12.8837 7.7 13.6 6.9837 13.6 6.1C13.6 5.2163 12.8837 4.5 12 4.5C11.1163 4.5 10.4 5.2163 10.4 6.1C10.4 6.9837 11.1163 7.7 12 7.7Z"/>
  <path d="M11.1 7.6L6.4 19.6"/>
  <path d="M12.9 7.6L17.6 19.6"/>
  <path d="M8.7 14.2H15.3"/>
</symbol>
```

`47:41`
```html
<symbol id="s-further-maths" viewBox="0 0 24 24">
  <path d="M17 5.5H7L13 12L7 18.5H17"/>
</symbol>
```

`47:44`
```html
<symbol id="s-add-maths" viewBox="0 0 24 24">
  <path d="M3.5 12.6H6.5L9.5 19.2L14.5 5H20.5"/>
</symbol>
```

`47:49`
```html
<symbol id="s-physics" viewBox="0 0 24 24">
  <path d="M12 13.7C12.939 13.7 13.7 12.9389 13.7 12C13.7 11.0611 12.939 10.3 12 10.3C11.061 10.3 10.3 11.0611 10.3 12C10.3 12.9389 11.061 13.7 12 13.7Z" fill="currentColor" stroke="none"/>
  <path d="M12 15.9C16.86 15.9 20.8 14.1539 20.8 12C20.8 9.8461 16.86 8.1 12 8.1C7.14 8.1 3.2 9.8461 3.2 12C3.2 14.1539 7.14 15.9 12 15.9Z"/>
  <path d="M8.622 13.95C11.053 18.159 14.535 20.698 16.4 19.621C18.265 18.5441 17.808 14.259 15.377 10.05C12.947 5.841 9.465 3.302 7.6 4.379C5.735 5.4559 6.192 9.741 8.622 13.95Z"/>
</symbol>
```

`47:54`
```html
<symbol id="s-psychology" viewBox="0 0 24 24">
  <path d="M12 4.5V19.5"/>
  <path d="M7 8V11.6C7 12.9261 7.527 14.1979 8.464 15.1355C9.402 16.0732 10.674 16.6 12 16.6C13.326 16.6 14.598 16.0732 15.536 15.1355C16.473 14.1979 17 12.9261 17 11.6V8"/>
  <path d="M9 19.5H15"/>
</symbol>
```

`47:57`
```html
<symbol id="s-english" viewBox="0 0 24 24">
  <path d="M4.5 6.5H19.5M4.5 10.5H19.5M4.5 14.5H15.5M4.5 18.5H11.5"/>
</symbol>
```

`47:62`
```html
<symbol id="s-ict" viewBox="0 0 24 24">
  <path d="M18.7 4.5H5.3C4.3059 4.5 3.5 5.306 3.5 6.3V13.7C3.5 14.694 4.3059 15.5 5.3 15.5H18.7C19.6941 15.5 20.5 14.694 20.5 13.7V6.3C20.5 5.306 19.6941 4.5 18.7 4.5Z"/>
  <path d="M12 15.5V19.5"/>
  <path d="M9 19.5H15"/>
</symbol>
```

`47:67`
```html
<symbol id="s-global" viewBox="0 0 24 24">
  <path d="M12 20.2C16.5287 20.2 20.2 16.529 20.2 12C20.2 7.471 16.5287 3.8 12 3.8C7.4713 3.8 3.8 7.471 3.8 12C3.8 16.529 7.4713 20.2 12 20.2Z"/>
  <path d="M3.8 12H20.2"/>
  <path d="M12 3.8C14.4 6.1 15.6 8.9 15.6 12C15.6 15.1 14.4 17.9 12 20.2C9.6 17.9 8.4 15.1 8.4 12C8.4 8.9 9.6 6.1 12 3.8Z"/>
</symbol>
```

`47:72`
```html
<symbol id="s-islamiyat" viewBox="0 0 24 24">
  <path d="M15.6 3.9C14.203 3.321 12.673 3.141 11.179 3.377C9.685 3.614 8.286 4.26 7.137 5.242C5.987 6.224 5.131 7.506 4.664 8.944C4.197 10.382 4.137 11.922 4.49 13.392C4.844 14.863 5.597 16.207 6.666 17.276C7.736 18.345 9.08 19.098 10.551 19.45C12.022 19.803 13.561 19.742 14.999 19.274C16.437 18.807 17.718 17.95 18.7 16.8C17.156 16.822 15.651 16.318 14.432 15.371C13.213 14.424 12.353 13.091 11.992 11.59C11.631 10.089 11.792 8.51 12.448 7.112C13.103 5.715 14.215 4.582 15.6 3.9Z"/>
</symbol>
```

`47:76`
```html
<symbol id="s-pakistan" viewBox="0 0 24 24">
  <path d="M9 4.5L3.5 7V19.5L9 17L15 19.5L20.5 17V4.5L15 7L9 4.5Z"/>
  <path d="M9 4.5V17M15 7V19.5"/>
</symbol>
```

`47:80`
```html
<symbol id="s-urdu" viewBox="0 0 24 24">
  <path d="M20 12.4C20 16.3 16.4 19.4 12 19.4C10.8 19.4 9.7 19.2 8.7 18.8L4 20.5L5.3 17.1C4.273 15.761 3.807 14.076 4 12.4C4 8.5 7.6 5.4 12 5.4C16.4 5.4 20 8.5 20 12.4Z"/>
  <path d="M8.5 10.8H15.5M8.5 14H13"/>
</symbol>
```
---

## Season Icon - set `102:15` (3 glyphs, NO variables - raw gradients, mode-invariant)

Not a stroke-only glyph like the other two sets: each is a 18.25x18.25 rounded-square badge
(gradient fill + gradient 1.75 stroke) with a gradient-stroked mark inside it at a THINNER
weight. All four gradients per glyph are `userSpaceOnUse` in the local 24-box, running on the
same 2,2 -> 22,22 diagonal for the badge.

```html
<defs>
  <!-- may-june : amber -->
  <linearGradient id="season-mj-badge" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
    <stop stop-color="#FFF6E0"/><stop offset="1" stop-color="#FFE2A8"/></linearGradient>
  <linearGradient id="season-mj-edge" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
    <stop stop-color="#FFC107"/><stop offset="0.55" stop-color="#FB8C00"/><stop offset="1" stop-color="#F4511E"/></linearGradient>
  <linearGradient id="season-mj-disc" x1="8.9" y1="8.9" x2="15.1" y2="15.1" gradientUnits="userSpaceOnUse">
    <stop stop-color="#FFC107"/><stop offset="0.55" stop-color="#FB8C00"/><stop offset="1" stop-color="#F4511E"/></linearGradient>
  <linearGradient id="season-mj-rays" x1="4.9" y1="4.9" x2="19.1" y2="19.1" gradientUnits="userSpaceOnUse">
    <stop stop-color="#FFC107"/><stop offset="0.55" stop-color="#FB8C00"/><stop offset="1" stop-color="#F4511E"/></linearGradient>
  <!-- oct-nov : blue -->
  <linearGradient id="season-on-badge" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
    <stop stop-color="#EAF6FE"/><stop offset="1" stop-color="#CDE8FB"/></linearGradient>
  <linearGradient id="season-on-edge" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
    <stop stop-color="#4FC3F7"/><stop offset="0.55" stop-color="#2E86DE"/><stop offset="1" stop-color="#5C6BC0"/></linearGradient>
  <linearGradient id="season-on-icon" x1="5.598" y1="5.909" x2="17.7649" y2="18.6971" gradientUnits="userSpaceOnUse">
    <stop stop-color="#4FC3F7"/><stop offset="0.55" stop-color="#2E86DE"/><stop offset="1" stop-color="#5C6BC0"/></linearGradient>
  <!-- feb-march : green -->
  <linearGradient id="season-fm-badge" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
    <stop stop-color="#F0F8E6"/><stop offset="1" stop-color="#D8EFC6"/></linearGradient>
  <linearGradient id="season-fm-edge" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
    <stop stop-color="#9CCC65"/><stop offset="0.55" stop-color="#4CAF50"/><stop offset="1" stop-color="#26A69A"/></linearGradient>
  <linearGradient id="season-fm-icon" x1="7.596" y1="7.3" x2="16.976" y2="16.0889" gradientUnits="userSpaceOnUse">
    <stop stop-color="#9CCC65"/><stop offset="0.55" stop-color="#4CAF50"/><stop offset="1" stop-color="#26A69A"/></linearGradient>
</defs>

<!-- 102:6 -->
<symbol id="se-may-june" viewBox="0 0 24 24">
  <rect x="2.875" y="2.875" width="18.25" height="18.25" rx="5.125" fill="url(#season-mj-badge)" stroke="url(#season-mj-edge)" stroke-width="1.75"/>
  <circle cx="12" cy="12" r="3.1" fill="url(#season-mj-disc)" stroke="none"/>
  <path d="M16.5 12H19.1M7.5 12H4.9M12 16.5V19.1M12 7.5V4.9M15.182 8.818L17.02 6.98M8.818 8.818L6.98 6.98M15.182 15.182L17.02 17.02M8.818 15.182L6.98 17.02" fill="none" stroke="url(#season-mj-rays)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
</symbol>

<!-- 102:10 -->
<symbol id="se-oct-nov" viewBox="0 0 24 24">
  <rect x="2.875" y="2.875" width="18.25" height="18.25" rx="5.125" fill="url(#season-on-badge)" stroke="url(#season-on-edge)" stroke-width="1.75"/>
  <path d="M12 12H18.3M12 12L15.15 17.456M12 12L8.85 17.456M12 12H5.7M12 12L8.85 6.544M12 12L15.15 6.544M16.802 13.093L15.5 12L16.802 10.907M18.402 13.093L17.1 12L18.402 10.907M13.455 16.705L13.75 15.031L15.347 15.613M14.255 18.091L14.55 16.417L16.147 16.998M8.653 15.613L10.25 15.031L10.545 16.705M7.853 16.998L9.45 16.417L9.745 18.091M7.198 10.907L8.5 12L7.198 13.093M5.598 10.907L6.9 12L5.598 13.093M10.545 7.295L10.25 8.969L8.653 8.387M9.745 5.909L9.45 7.583L7.853 7.002M15.347 8.387L13.75 8.969L13.455 7.295M16.147 7.002L14.55 7.583L14.255 5.909" fill="none" stroke="url(#season-on-icon)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</symbol>

<!-- 102:14 -->
<symbol id="se-feb-march" viewBox="0 0 24 24">
  <rect x="2.875" y="2.875" width="18.25" height="18.25" rx="5.125" fill="url(#season-fm-badge)" stroke="url(#season-fm-edge)" stroke-width="1.75"/>
  <path d="M12 16.7V10.7M12 11.7C9.4 11.9 7.5 10 7.6 7.3C10.2 7.5 12 9.2 12 11.7ZM12 11.7C14.6 11.9 16.5 10 16.4 7.3C13.8 7.5 12 9.2 12 11.7Z" fill="none" stroke="url(#season-fm-icon)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</symbol>
```

---

## Brand Mark / GitHub - `427:4` (fill-only, paint `--ink-3`)

One closed path, `fill` only, NO stroke. Ink height is 23.4057 (y 0.297 -> 23.7027), so it sits
0.297 below the top of the 24-box - do not re-centre it.

```html
<symbol id="brand-github" viewBox="0 0 24 24">
  <path d="M12 0.297C5.37 0.297 0 5.67 0 12.297C0 17.6 3.438 22.097 8.205 23.682C8.805 23.795 9.025 23.424 9.025 23.105C9.025 22.82 9.015 22.065 9.01 21.065C5.672 21.789 4.968 19.455 4.968 19.455C4.422 18.07 3.633 17.7 3.633 17.7C2.546 16.956 3.717 16.971 3.717 16.971C4.922 17.055 5.555 18.207 5.555 18.207C6.625 20.042 8.364 19.512 9.05 19.205C9.158 18.429 9.467 17.9 9.81 17.6C7.145 17.3 4.344 16.268 4.344 11.67C4.344 10.36 4.809 9.29 5.579 8.45C5.444 8.147 5.039 6.927 5.684 5.274C5.684 5.274 6.689 4.952 8.984 6.504C9.944 6.237 10.964 6.105 11.984 6.099C13.004 6.105 14.024 6.237 14.99 6.504C17.27 4.952 18.275 5.274 18.275 5.274C18.92 6.927 18.515 8.147 18.395 8.45C19.16 9.29 19.625 10.36 19.625 11.67C19.625 16.28 16.82 17.295 14.15 17.59C14.57 17.95 14.96 18.686 14.96 19.81C14.96 21.416 14.945 22.706 14.945 23.096C14.945 23.411 15.155 23.786 15.77 23.666C20.565 22.092 24 17.592 24 12.297C24 5.67 18.627 0.297 12 0.297Z" fill="currentColor" stroke="none"/>
</symbol>
```