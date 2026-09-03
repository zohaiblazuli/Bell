"""Compare the app's sidebar/topbar glass composite against the Figma frame renders.

    python scripts/tone-verify.py <app.png> day|night

The sidebar is the region that matters: it is chrome glass over the background stack, so it is where
a wrong backdrop shows up first, and it is measurable in every view because `.bg` lives on `.app`.
Targets are measured off the Figma renders in .shots/figma, not from prose.

Figma cannot express the app's `backdrop-filter: saturate(165%)` (foundations.md T5), so production
is expected to read slightly MORE saturated than the file at the same luminance. Luminance and hue
angle are the things that should match; a few points of extra saturation is the sanctioned difference.
"""

import statistics as st
import sys

from PIL import Image

TARGETS = {  # measured off .shots/figma/library-*.png by scripts/figma-probe.py
    # Re-measured after the file replaced `clouds` + `blue_orb 1` + `page recess` with one raster per
    # tone. Day's chrome is a lilac near-white now, not the old #c5dafb blue, because `ambient-a` is
    # an orchid at DARKEN over art that is mostly light; Night's top bar dropped ~19 luminance.
    "day": {"sidebar upper": (239, 234, 250), "sidebar mid": (205, 230, 247), "topbar": (252, 250, 254)},
    "night": {"sidebar upper": (70, 82, 109), "sidebar mid": (69, 81, 108), "topbar": (43, 50, 74)},
}
REGIONS = {
    "sidebar upper": (0.010, 0.070, 0.060, 0.150),
    "sidebar mid": (0.010, 0.070, 0.400, 0.560),
    "topbar": (0.400, 0.600, 0.010, 0.030),
}


def window_box(im, thresh=26):
    g = im.convert("L")
    w, h = g.size
    px = g.load()
    xs, ys = [], []
    for x in range(0, w, 4):
        for y in range(0, h, 4):
            if px[x, y] > thresh:
                xs.append(x)
                ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)


def median(im, x0, x1, y0, y1, step=2):
    px = im.load()
    ch = ([], [], [])
    for x in range(int(x0), int(x1), step):
        for y in range(int(y0), int(y1), step):
            for i, v in enumerate(px[x, y][:3]):
                ch[i].append(v)
    return tuple(int(st.median(c)) for c in ch)


def lum(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def sat(c):
    mx, mn = max(c), min(c)
    return 0 if mx == 0 else (mx - mn) / mx * 100


path, tone = sys.argv[1], sys.argv[2]
raw = Image.open(path)
x0, y0, x1, y1 = window_box(raw)
im = raw.convert("RGB")
bw, bh = x1 - x0, y1 - y0
print(f"== {path}  tone={tone}  window {bw}x{bh}   target = the Figma {tone} render")
worst = 0.0
for name, (fx0, fx1, fy0, fy1) in REGIONS.items():
    got = median(im, x0 + fx0 * bw, x0 + fx1 * bw, y0 + fy0 * bh, y0 + fy1 * bh)
    want = TARGETS[tone][name]
    d = tuple(g - w for g, w in zip(got, want))
    dl = lum(got) - lum(want)
    ds = sat(got) - sat(want)
    worst = max(worst, abs(dl))
    print(
        f"   {name:14} app #{got[0]:02x}{got[1]:02x}{got[2]:02x} {str(got):16}"
        f"  figma #{want[0]:02x}{want[1]:02x}{want[2]:02x} {str(want):16}"
        f"  ΔRGB {d[0]:+4d}{d[1]:+4d}{d[2]:+4d}   Δlum {dl:+6.1f}   Δsat {ds:+5.1f}pp"
    )
print(f"   worst luminance error: {worst:.1f} of 255")
