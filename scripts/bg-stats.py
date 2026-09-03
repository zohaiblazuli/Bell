"""Stats on the exported background art, to see what the app is actually compositing.

    python scripts/bg-stats.py

Reports mode, whether alpha is present, and the median / mean / min / max luminance of each
exported layer. The question this answers: in Figma `clouds` is a translucent node over a
near-black Night ground, so the ground knocks it back. If the export is fully opaque, nothing
underneath it can knock anything back and every darkening layer has to sit ON TOP.
"""

import statistics as st

from PIL import Image

FILES = [
    "src/assets/bg/bg-image-day.webp",
    "src/assets/bg/bg-image-night.webp",
]


def lum(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


for path in FILES:
    im = Image.open(path)
    mode, size = im.mode, im.size
    has_alpha = mode in ("RGBA", "LA") or "transparency" in im.info
    rgb = im.convert("RGB")
    px = rgb.load()
    w, h = size
    L, A = [], []
    ap = im.convert("RGBA").load()
    for x in range(0, w, max(1, w // 160)):
        for y in range(0, h, max(1, h // 160)):
            L.append(lum(px[x, y]))
            A.append(ap[x, y][3])
    print(
        f"{path.split('/')[-1]:22} {mode:5} {w}x{h}  alpha={has_alpha}"
        f"  lum med {st.median(L):6.1f} mean {st.mean(L):6.1f} min {min(L):6.1f} max {max(L):6.1f}"
        f"  |  alpha med {st.median(A):3.0f} min {min(A):3.0f}"
    )

    # corner + centre probes, so a per-region reading is available too
    for name, (fx, fy) in {
        "top-left": (0.02, 0.03),
        "top-right": (0.97, 0.03),
        "centre": (0.5, 0.5),
        "bottom-left": (0.02, 0.97),
        "bottom-right": (0.97, 0.97),
    }.items():
        c = px[int(fx * (w - 1)), int(fy * (h - 1))]
        print(f"    {name:14} #{c[0]:02x}{c[1]:02x}{c[2]:02x} {c} lum {lum(c):6.1f}")
