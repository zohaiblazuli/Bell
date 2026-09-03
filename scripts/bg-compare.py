"""Compare the app's Night background against the Figma render, by measurement rather than by eye.

    python scripts/bg-compare.py <app.png> <figma.png>

Finds each image's sidebar edge from the vertical border, then reports the MEDIAN colour of the
sidebar glass and of the right-hand background margin. Medians rather than point samples because both
regions carry text and card edges, and the two images are different sizes with different filter state
— a normalised point sample lands on a card in one and on the ground in the other.

The number that matters: `design/specs/foundations.md` measures the Night sidebar composite at ~#4E5876
and warns that a rebuild reading near-black means a paint-level opacity was flattened somewhere.
"""

import os
import statistics as st
import sys

from PIL import Image


def sidebar_edge(im):
    """The x of the sidebar's right border: the column with the largest horizontal step."""
    w, h = im.size
    px = im.load()
    best = (0, 0)
    for x in range(int(0.04 * w), int(0.32 * w)):
        s = 0
        for y in range(int(0.30 * h), int(0.90 * h), 7):
            a, b = px[x, y], px[x + 1, y]
            s += abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])
        if s > best[1]:
            best = (x, s)
    return best[0]


def median(im, x0, x1, y0, y1, step=3):
    px = im.load()
    chans = ([], [], [])
    for x in range(x0, x1, step):
        for y in range(y0, y1, step):
            for i, v in enumerate(px[x, y]):
                chans[i].append(v)
    return tuple(int(st.median(c)) for c in chans)


def lum(c):
    return round(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], 1)


def hexs(c):
    return "#%02x%02x%02x" % c


for label, path in zip(("app", "figma"), sys.argv[1:3]):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    e = sidebar_edge(im)
    sb = median(im, 8, max(e - 6, 10), int(0.35 * h), int(0.80 * h))
    margin = median(im, int(0.965 * w), w - 4, int(0.15 * h), int(0.95 * h))
    print(
        f"{label:6} {w}x{h}  sidebar edge x={e} ({e / w:.3f})"
        f"  sidebar={hexs(sb)} {sb} lum {lum(sb)}"
        f"  right margin={hexs(margin)} {margin} lum {lum(margin)}"
    )

print("\nspec: the Night sidebar composite measures ~#4e5876 (78, 88, 118), lum 90.3")
