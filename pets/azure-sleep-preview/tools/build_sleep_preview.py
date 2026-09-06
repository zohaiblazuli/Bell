"""Build Azure's high-resolution 60 Hz sleep animation approval preview.

The visual content comes only from image-generation boards. This script owns deterministic
production work: green-screen extraction, stable-slot placement, contact-sheet assembly, timeline
timing, and the independent Z layer. It never invents or redraws character poses.
"""

from __future__ import annotations

import argparse
import math
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


BOARD_COLUMNS = 4
BOARD_ROWS = 2
FRAME_SIZE = (576, 624)
FPS = 60
BACKGROUND = (214, 239, 255)


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def remove_green(image: Image.Image) -> Image.Image:
    """Turn the generated flat green field into clean premultiplied-safe transparency."""

    rgb = np.asarray(image.convert("RGB"), dtype=np.int32)
    red, green, blue = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    dominance = green - np.maximum(red, blue)
    keyed = (green >= 92) & (dominance >= 34)
    alpha = np.full(red.shape, 255, dtype=np.int32)
    alpha[keyed] = np.clip((76 - dominance[keyed]) * 255 / 42, 0, 255)
    clean = rgb.copy()
    clean[..., 1] = np.where(keyed, np.minimum(green, np.maximum(red, blue) + 10), green)
    clean[alpha == 0] = 0
    return Image.fromarray(np.dstack((clean, alpha)).astype(np.uint8), "RGBA")


def extract_board_components(path: Path) -> list[Image.Image]:
    """Extract the eight complete silhouettes even when a pose crosses an invisible grid boundary."""

    keyed = remove_green(Image.open(path))
    alpha = np.asarray(keyed.getchannel("A"))
    count, labels, stats, centroids = cv2.connectedComponentsWithStats(
        (alpha > 32).astype(np.uint8), connectivity=8
    )
    candidates = [
        index
        for index in range(1, count)
        if stats[index, cv2.CC_STAT_AREA] >= 4_000
        and stats[index, cv2.CC_STAT_WIDTH] >= 55
        and stats[index, cv2.CC_STAT_HEIGHT] >= 130
    ]
    candidates = sorted(candidates, key=lambda index: stats[index, cv2.CC_STAT_AREA], reverse=True)[:8]
    if len(candidates) != 8:
        raise ValueError(f"{path} yielded {len(candidates)} complete character silhouettes, expected 8")

    # Sequence order is four across the upper band, then four across the lower band.
    top = sorted(candidates, key=lambda index: centroids[index][1])[:4]
    bottom = [index for index in candidates if index not in top]
    ordered = sorted(top, key=lambda index: centroids[index][0]) + sorted(
        bottom, key=lambda index: centroids[index][0]
    )

    rgba = np.asarray(keyed)
    pieces: list[Image.Image] = []
    for index in ordered:
        x, y, width, height, _ = stats[index]
        padding = 5
        left, top_y = max(0, x - padding), max(0, y - padding)
        right = min(keyed.width, x + width + padding)
        bottom_y = min(keyed.height, y + height + padding)
        crop = rgba[top_y:bottom_y, left:right].copy()
        component_mask = labels[top_y:bottom_y, left:right] == index
        crop[~component_mask] = 0
        pieces.append(Image.fromarray(crop, "RGBA"))
    return pieces


def place_components(phases: list[list[Image.Image]]) -> list[list[Image.Image]]:
    """Use one scale for every phase, preventing per-frame fit-to-box size popping."""

    pieces = [piece for phase in phases for piece in phase]
    max_width = max(piece.width for piece in pieces)
    max_height = max(piece.height for piece in pieces)
    scale = min((FRAME_SIZE[0] - 28) / max_width, (FRAME_SIZE[1] - 20) / max_height)
    placed_phases: list[list[Image.Image]] = []
    for phase in phases:
        placed: list[Image.Image] = []
        for piece in phase:
            width = max(1, round(piece.width * scale))
            height = max(1, round(piece.height * scale))
            resized = piece.resize((width, height), Image.Resampling.LANCZOS)
            canvas = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
            x = (FRAME_SIZE[0] - width) // 2
            y = FRAME_SIZE[1] - height - 10
            canvas.alpha_composite(resized, (x, y))
            placed.append(canvas)
        placed_phases.append(placed)
    return placed_phases


def blend_keyframes(
    keyframes: list[Image.Image], elapsed: float, duration: float, *, seamless: bool = False
) -> Image.Image:
    """Sample authored cels at 60 Hz with restrained in-between opacity easing."""

    if seamless:
        position = (elapsed % duration) / duration * len(keyframes)
        left = int(math.floor(position)) % len(keyframes)
        right = (left + 1) % len(keyframes)
        mix = smoothstep(position - math.floor(position))
    else:
        position = max(0.0, min(1.0, elapsed / duration)) * (len(keyframes) - 1)
        left = min(len(keyframes) - 1, int(math.floor(position)))
        right = min(len(keyframes) - 1, left + 1)
        local = position - math.floor(position)
        # Hold each authored cel, then use a short eased dissolve rather than ghosting the full beat.
        mix = smoothstep((local - 0.68) / 0.32)
    if left == right or mix <= 0.001:
        return keyframes[left].copy()
    if mix >= 0.999:
        return keyframes[right].copy()
    return Image.blend(keyframes[left], keyframes[right], mix)


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/segoeuib.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def add_z_layer(frame: Image.Image, loop_time: float, sleep_frames: list[Image.Image]) -> None:
    """Draw independent, irregular-feeling Zs whose lifetime crosses the breathing loop seam."""

    reference_box = sleep_frames[0].getbbox() or (180, 120, 396, 570)
    origin_x = min(FRAME_SIZE[0] - 70, reference_box[2] - 4)
    origin_y = max(24, reference_box[1] + 4)
    draw = ImageDraw.Draw(frame)
    emissions = ((0.75, -1), (2.55, 1), (4.55, -1), (6.25, 1), (8.35, -1), (10.15, 1))
    lifetime = 2.95
    for emitted_at, direction in emissions:
        age = loop_time - emitted_at
        if age < 0 or age > lifetime:
            continue
        progress = age / lifetime
        alpha = round(255 * smoothstep(min(1.0, progress / 0.18)) * (1.0 - smoothstep((progress - 0.68) / 0.32)))
        if alpha <= 0:
            continue
        font_size = round(28 + 18 * progress)
        x = round(origin_x + direction * (5 + 10 * progress))
        y = round(origin_y - 18 - 78 * progress)
        color = (54, 139, 235, alpha)
        outline = (241, 249, 255, alpha)
        draw.text((x, y), "Z", font=load_font(font_size), fill=color, stroke_width=2, stroke_fill=outline)


def composite_for_video(frame: Image.Image) -> Image.Image:
    backdrop = Image.new("RGB", FRAME_SIZE, BACKGROUND)
    # A restrained grounding wash makes transparent edges inspectable without adding a floor shadow.
    wash = Image.new("RGBA", FRAME_SIZE, (255, 255, 255, 0))
    ImageDraw.Draw(wash).ellipse((68, 34, 508, 604), fill=(255, 255, 255, 70))
    backdrop.paste(wash.convert("RGB"), mask=wash.getchannel("A"))
    backdrop.paste(frame.convert("RGB"), mask=frame.getchannel("A"))
    return backdrop


def save_keyframes_contact_sheet(
    phases: list[tuple[str, list[Image.Image]]], output: Path
) -> None:
    thumb = (288, 312)
    label_height = 34
    sheet = Image.new("RGB", (thumb[0] * 8, (thumb[1] + label_height) * len(phases)), (24, 34, 48))
    draw = ImageDraw.Draw(sheet)
    font = load_font(18)
    for row, (label, frames) in enumerate(phases):
        top = row * (thumb[1] + label_height)
        draw.text((12, top + 7), label, font=font, fill=(235, 244, 255))
        for column, frame in enumerate(frames):
            tile = Image.new("RGB", thumb, BACKGROUND)
            scaled = frame.resize(thumb, Image.Resampling.LANCZOS)
            tile.paste(scaled.convert("RGB"), mask=scaled.getchannel("A"))
            sheet.paste(tile, (column * thumb[0], top + label_height))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, quality=95)


def save_motion_page(frames: list[Image.Image], output: Path) -> None:
    """Pack eight transparent 3× cels into one controllable 4×2 WebP page."""

    page = Image.new(
        "RGBA",
        (FRAME_SIZE[0] * BOARD_COLUMNS, FRAME_SIZE[1] * BOARD_ROWS),
        (0, 0, 0, 0),
    )
    for index, frame in enumerate(frames):
        x = (index % BOARD_COLUMNS) * FRAME_SIZE[0]
        y = (index // BOARD_COLUMNS) * FRAME_SIZE[1]
        page.alpha_composite(frame, (x, y))
    output.parent.mkdir(parents=True, exist_ok=True)
    page.save(output, format="WEBP", lossless=True, method=6, exact=True)


def render_video(
    enter: list[Image.Image], loop: list[Image.Image], wake: list[Image.Image], output: Path
) -> None:
    enter_duration = 2.4
    loop_duration = 5.6
    loop_repeats = 2
    wake_duration = 1.8
    total = enter_duration + loop_duration * loop_repeats + wake_duration
    frame_count = round(total * FPS)

    output.parent.mkdir(parents=True, exist_ok=True)
    command = [
        "ffmpeg",
        "-y",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        f"{FRAME_SIZE[0]}x{FRAME_SIZE[1]}",
        "-r",
        str(FPS),
        "-i",
        "-",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-crf",
        "16",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(output),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert process.stdin is not None
    try:
        for index in range(frame_count):
            now = index / FPS
            if now < enter_duration:
                rendered = blend_keyframes(enter, now, enter_duration)
            elif now < enter_duration + loop_duration * loop_repeats:
                loop_time = now - enter_duration
                rendered = blend_keyframes(loop, loop_time, loop_duration, seamless=True)
                add_z_layer(rendered, loop_time, loop)
            else:
                wake_time = now - enter_duration - loop_duration * loop_repeats
                rendered = blend_keyframes(wake, wake_time, wake_duration)
            process.stdin.write(composite_for_video(rendered).tobytes())
    finally:
        process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError("ffmpeg failed while encoding the sleep preview")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--enter", type=Path, required=True)
    parser.add_argument("--loop", type=Path, required=True)
    parser.add_argument("--wake", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--package-dir", type=Path)
    args = parser.parse_args()

    raw_phases = [
        extract_board_components(args.enter),
        extract_board_components(args.loop),
        extract_board_components(args.wake),
    ]
    enter, loop, wake = place_components(raw_phases)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    save_keyframes_contact_sheet(
        [("SLEEP ENTER · once", enter), ("SLEEP LOOP · seamless", loop), ("WAKE · once", wake)],
        args.output_dir / "sleep-keyframes.png",
    )
    render_video(enter, loop, wake, args.output_dir / "azure-sleep-preview-60fps.mp4")
    if args.package_dir:
        save_motion_page(enter, args.package_dir / "motion-sleep-enter.webp")
        save_motion_page(loop, args.package_dir / "motion-sleep-loop.webp")
        save_motion_page(wake, args.package_dir / "motion-sleep-wake.webp")
    print(args.output_dir / "sleep-keyframes.png")
    print(args.output_dir / "azure-sleep-preview-60fps.mp4")
    if args.package_dir:
        print(args.package_dir / "motion-sleep-enter.webp")
        print(args.package_dir / "motion-sleep-loop.webp")
        print(args.package_dir / "motion-sleep-wake.webp")


if __name__ == "__main__":
    main()
