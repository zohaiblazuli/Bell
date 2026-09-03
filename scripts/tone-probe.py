"""Measure named regions of an app screenshot so tone work is arithmetic, not eyeballing.

    python scripts/tone-probe.py <shot.png> [<shot.png> ...]

Finds the app window inside the screenshot's black surround, then reports the median colour of
each region of interest in window-relative fractions. Median, not mean: every region carries text,
card edges or hairlines, and a mean smears those into the ground reading.
"""

import statistics as st
import sys

from PIL import Image

# name -> (x0, x1, y0, y1) as fractions of the detected window box
REGIONS = {
    "sidebar upper": (0.010, 0.070, 0.060, 0.150),
    "sidebar mid": (0.010, 0.070, 0.400, 0.560),
    "sidebar lower": (0.010, 0.070, 0.700, 0.800),
    "topbar": (0.400, 0.600, 0.010, 0.030),
    "ground right": (0.972, 0.998, 0.150, 0.850),
    "ground gutter L": (0.100, 0.130, 0.150, 0.850),
    "recess strip": (0.320, 0.340, 0.150, 0.850),
    "card fill": (0.290, 0.330, 0.128, 0.150),
    "card fill 2": (0.510, 0.550, 0.128, 0.150),
    "chip row bg": (0.470, 0.490, 0.050, 0.062),
}


def window_box(im, thresh=26):
    """Bounding box of non-black content — the app window inside the capture's surround."""
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
    chans = ([], [], [])
    for x in range(int(x0), int(x1), step):
        for y in range(int(y0), int(y1), step):
            for i, v in enumerate(px[x, y][:3]):
                chans[i].append(v)
    return tuple(int(st.median(c)) for c in chans)


def lum(c):
    return round(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], 1)


def hexs(c):
    return "#%02x%02x%02x" % c


def sat(c):
    mx, mn = max(c), min(c)
    return 0 if mx == 0 else round((mx - mn) / mx * 100)


for path in sys.argv[1:]:
    im = Image.open(path).convert("RGB")
    x0, y0, x1, y1 = window_box(im)
    bw, bh = x1 - x0, y1 - y0
    print(f"\n== {path}   capture {im.size[0]}x{im.size[1]}   window ({x0},{y0})-({x1},{y1}) {bw}x{bh}")
    for name, (fx0, fx1, fy0, fy1) in REGIONS.items():
        c = median(im, x0 + fx0 * bw, x0 + fx1 * bw, y0 + fy0 * bh, y0 + fy1 * bh)
        print(f"   {name:16} {hexs(c)}  {str(c):18} lum {lum(c):6}  sat {sat(c):3}%")
