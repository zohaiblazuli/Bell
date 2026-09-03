"""Measure the Figma frame renders in the same regions as the app screenshots.

    python scripts/figma-probe.py

The renders may carry overflow padding (the shadow reaches past the frame box) composited over
Figma's own #f5f5f5 canvas, so the padding is OPAQUE and alpha cannot find the frame. The frame is
located as the first chromatic column/row instead, which also returns (0,0) for an already-cropped
render — that is what `.shots/figma/library-*.png` holds.
Regions are fractions of the 1320x860 frame, matching scripts/tone-probe.py so the two sets of
numbers are directly comparable.
"""

import statistics as st

from PIL import Image

FRAME_W, FRAME_H = 1320, 860

# Fractions of the frame box. Sidebar is 238 wide, topbar 56 tall, page recess starts at (238,56).
REGIONS = {
    "sidebar upper": (0.010, 0.070, 0.060, 0.150),
    "sidebar mid": (0.010, 0.070, 0.400, 0.560),
    "sidebar lower": (0.010, 0.070, 0.700, 0.800),
    "topbar": (0.400, 0.600, 0.010, 0.030),
    "ground right": (0.972, 0.998, 0.150, 0.850),
    "ground gutter L": (0.195, 0.215, 0.150, 0.850),
    "recess strip": (0.320, 0.340, 0.150, 0.850),
    "card fill": (0.290, 0.330, 0.128, 0.150),
}


def frame_origin(im):
    """Top-left of the 1320x860 frame inside a render that may carry overflow padding.

    Alpha is useless here: the export is composited over the canvas, so the padding is opaque, and
    the frame's 15px corner radius means no column is fully opaque either. The shadow padding is
    neutral (canvas grey under a desaturated shadow) while the frame's own edge — chrome glass in
    both tones — is not, so the first chromatic column and row locate the box. A render already
    cropped to the frame has no chromatic run before it and answers (0, 0).
    """
    rgb = im.convert("RGB")
    px = rgb.load()
    w, h = rgb.size
    if w < FRAME_W or h < FRAME_H:
        raise SystemExit(f"render is {w}x{h}, smaller than the {FRAME_W}x{FRAME_H} frame")
    chroma = lambda p: max(p[:3]) - min(p[:3])
    x0 = next((x for x in range(w - FRAME_W + 1) if chroma(px[x, h // 2]) >= 6), 0)
    y0 = next((y for y in range(h - FRAME_H + 1) if chroma(px[w // 2, y]) >= 6), 0)
    return x0, y0


def median(im, x0, x1, y0, y1, step=2):
    px = im.load()
    chans = ([], [], [])
    for x in range(int(x0), int(x1), step):
        for y in range(int(y0), int(y1), step):
            for i, v in enumerate(px[x, y][:3]):
                chans[i].append(v)
    return tuple(int(st.median(c)) for c in chans)


def lum(c):
    return round(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], 1)


def sat(c):
    mx, mn = max(c), min(c)
    return 0 if mx == 0 else round((mx - mn) / mx * 100)


for name in ("library-day", "library-night"):
    path = f".shots/figma/{name}.png"
    raw = Image.open(path)
    ox, oy = frame_origin(raw)
    im = raw.convert("RGB")
    print(f"\n== FIGMA {name}   render {raw.size[0]}x{raw.size[1]}   frame origin ({ox},{oy})")
    for label, (fx0, fx1, fy0, fy1) in REGIONS.items():
        c = median(
            im,
            ox + fx0 * FRAME_W,
            ox + fx1 * FRAME_W,
            oy + fy0 * FRAME_H,
            oy + fy1 * FRAME_H,
        )
        print(f"   {label:16} #{c[0]:02x}{c[1]:02x}{c[2]:02x}  {str(c):18} lum {lum(c):6}  sat {sat(c):3}%")
