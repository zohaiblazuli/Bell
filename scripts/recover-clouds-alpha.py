"""Recover the true RGBA of the Figma `clouds` field from a black-plate and a white-plate export.

    python scripts/recover-clouds-alpha.py

Figma's MCP exporter renders a node IN CONTEXT, so exporting `clouds` directly flattens it against
whatever sits behind it — which is how the shipped WebPs ended up as `clouds` composited over
`ground/base`, fully opaque, with both ambient blooms buried underneath where nothing could see
them. `clouds` is actually an empty frame (`fills: []`) holding a `sky` gradient at 16% (Day) / 34%
(Night) over the top 520px plus ten lobe frames at 0.26-0.52 — i.e. mostly transparent — and in the
file the blooms are the dominant colour source in the top-left, because they show THROUGH it.

Two exports over known plates recover it exactly. With straight alpha a and colour C:

    black plate:  B = C*a                 =>   a = 1 - (W - B)
    white plate:  W = C*a + (1 - a)            C = B / a

Both plates come from the same clone with `blendMode = 'NORMAL'`, which makes the frame its own
blend group so Night's `pattern 1` HARD_LIGHT composites against the cloud stack rather than
against the plate. Without that, a backdrop-dependent blend would break the subtraction for Night.

Night's clone carries the file's own node opacity 0.68, so the recovered alpha includes it. It is
divided back out here and re-applied in CSS, which keeps 0.68 visible and retunable in
`background.css` the way the file has it, rather than baked into an asset.

WHY THE COLOUR IS DIFFUSED. Unpremultiplying divides by alpha, so where the field is nearly
transparent — alpha 0.09 across the sidebar in Day — 8-bit quantisation noise is amplified ~11x
into wild saturated colour. It is invisible once composited, but it wrecks WebP's predictor and cost
892 KB on the first pass. Alpha-weighted diffusion replaces the colour where alpha is low with a
blur of the premultiplied colour divided by a blur of alpha — the standard texture-pipeline fix. The
composite is unchanged to within a quantisation step, which the round-trip check below verifies.
"""

import os

import numpy as np
from PIL import Image

SRC = ".shots/figma"
OUT = "src/assets/bg"

# tone -> node opacity carried by the exported clone, output basename, (quality, alpha_quality).
# The encode points are the knee of a sweep against the round-trip error printed below: WebP switches
# to LOSSY alpha somewhere under alpha_quality 76, which is worth 2-3x the file size for well under
# one 8-bit level of extra mean error on art this diffuse. Day needs a touch more than Night because
# its alpha spans 0 to 0.88, where Night's never leaves 0.51-0.63.
TONES = {
    "day": (1.0, "bg-clouds-day", (74, 74)),
    "night": (0.68, "bg-clouds-night", (72, 70)),
}
A_TRUST = 0.35   # alpha at which the divided colour is trusted outright
BLUR_PX = 24     # diffusion radius, in source pixels (the art is 2x, so 12 logical px)
PASSES = 3       # box blurs to approximate a Gaussian


def box_blur(a, r):
    """Separable moving average via cumulative sums — no scipy needed."""
    for axis in (0, 1):
        n = a.shape[axis]
        pad = [(0, 0)] * a.ndim
        pad[axis] = (r + 1, r)
        p = np.pad(a, pad, mode="edge")
        c = np.cumsum(p, axis=axis)
        lo = np.take(c, range(0, n), axis=axis)
        hi = np.take(c, range(2 * r + 1, 2 * r + 1 + n), axis=axis)
        a = (hi - lo) / (2 * r + 1)
    return a


def load(name):
    return np.asarray(Image.open(f"{SRC}/{name}.png").convert("RGB"), dtype=np.float64) / 255.0


for tone, (node_opacity, base, (q, aq)) in TONES.items():
    B, W = load(f"{tone}-black"), load(f"{tone}-white")

    a_ch = 1.0 - np.clip(W - B, 0.0, 1.0)
    a = a_ch.mean(axis=2)
    spread = a_ch.max(axis=2) - a_ch.min(axis=2)

    # Straight colour where alpha supports it, alpha-weighted diffusion where it does not.
    C_div = np.clip(B / np.maximum(a, 1e-4)[:, :, None], 0.0, 1.0)
    Pb, Ab = B.copy(), a.copy()
    for _ in range(PASSES):
        Pb, Ab = box_blur(Pb, BLUR_PX), box_blur(Ab, BLUR_PX)
    C_diff = np.clip(Pb / np.maximum(Ab, 1e-4)[:, :, None], 0.0, 1.0)
    w = np.clip(a / A_TRUST, 0.0, 1.0)[:, :, None]
    C = w * C_div + (1.0 - w) * C_diff

    a_group = np.clip(a / node_opacity, 0.0, 1.0)
    rgba = np.round(np.concatenate([C, a_group[:, :, None]], axis=2) * 255).astype(np.uint8)
    img = Image.fromarray(rgba, mode="RGBA")

    webp = f"{OUT}/{base}.webp"
    img.save(f"{SRC}/{base}-recovered.png")
    img.save(webp, "WEBP", quality=q, method=6, alpha_quality=aq)

    # ROUND TRIP: recomposite the saved WebP over both plates and diff against the exports Figma
    # gave us. This is the check that the asset is faithful, not just that the algebra was.
    back = np.asarray(Image.open(webp).convert("RGBA"), dtype=np.float64) / 255.0
    Cb, Ab2 = back[:, :, :3], back[:, :, 3:4] * node_opacity
    err_b = np.abs(Cb * Ab2 - B) * 255
    err_w = np.abs(Cb * Ab2 + (1 - Ab2) - W) * 255

    print(
        f"{tone:6} opacity {node_opacity}  alpha min {a.min():.3f} median {np.median(a):.3f} "
        f"max {a.max():.3f}  (group median {np.median(a_group):.3f})  "
        f"channel spread median {np.median(spread):.4f} p99 {np.percentile(spread, 99):.4f}"
    )
    print(
        f"       round trip vs the two plates: mean {err_b.mean():.2f}/{err_w.mean():.2f} "
        f"p99 {np.percentile(err_b, 99):.1f}/{np.percentile(err_w, 99):.1f} "
        f"max {err_b.max():.1f}/{err_w.max():.1f}  (8-bit levels)"
    )
    print(f"       wrote {os.path.getsize(webp) // 1024} KB webp at quality {q} / alpha {aq}")

    h, wd = a.shape
    for label, (fx, fy) in {
        "top-left": (0.02, 0.03),
        "sidebar mid": (0.04, 0.48),
        "centre": (0.5, 0.5),
        "bottom-right": (0.97, 0.97),
    }.items():
        y, x = int(fy * (h - 1)), int(fx * (wd - 1))
        c = (C[y, x] * 255).round().astype(int)
        print(f"       {label:14} #{c[0]:02x}{c[1]:02x}{c[2]:02x}  a {a[y, x]:.3f}  group {a_group[y, x]:.3f}")
