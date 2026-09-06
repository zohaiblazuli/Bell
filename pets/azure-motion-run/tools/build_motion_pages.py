"""Extract Azure's generated 4x2 boards into consistent transparent 3x Bell motion pages."""

from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path
from statistics import median

import numpy as np
from PIL import Image


BOARD_IDS = (
    "idle-groom",
    "idle-phone",
    "teacher-enter",
    "teacher-loop",
    "wave-kiss",
    "tickle",
    "jump",
    "failed",
    "review-look",
    "sleep-loop",
)
JUMP_Y_OFFSETS = (0, -26, -70, -104, -70, -26, 0, 0)
DURATIONS_MS = {
    "idle-groom": 900,
    "idle-phone": 850,
    "teacher-enter": 500,
    "teacher-loop": 900,
    "wave-kiss": 500,
    "tickle": 300,
    "jump": 350,
    "failed": 550,
    "review-look": 450,
    "sleep-loop": 1000,
}


def load_sleep_tools(script: Path):
    spec = importlib.util.spec_from_file_location("azure_sleep_tools", script)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load deterministic sprite tools from {script}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def hair_metric(piece: Image.Image) -> float:
    """Use Azure's invariant blue hair area as an anatomy-scale marker across different poses."""

    rgba = np.asarray(piece.convert("RGBA"), dtype=np.int32)
    red, green, blue, alpha = (rgba[..., index] for index in range(4))
    hair = (alpha > 96) & (blue > 92) & (blue > red * 1.25) & (blue > green * 1.08)
    area = int(np.count_nonzero(hair))
    if area < 80:
        raise ValueError("could not find enough of Azure's blue hair to normalize sprite scale")
    return area**0.5


def board_metric(frames: list[Image.Image]) -> float:
    return median(hair_metric(frame) for frame in frames)


def place_all(raw: dict[str, list[Image.Image]], frame_size: tuple[int, int]) -> dict[str, list[Image.Image]]:
    """Normalize board-level drawing scale while preserving real pose-height changes within a board."""

    reference = raw["idle-groom"]
    reference_scale = min(
        (frame_size[0] - 28) / max(piece.width for piece in reference),
        (frame_size[1] - 20) / max(piece.height for piece in reference),
    )
    reference_metric = board_metric(reference)
    placed: dict[str, list[Image.Image]] = {}
    for board_id, frames in raw.items():
        scale = reference_scale * reference_metric / board_metric(frames)
        scale_x = scale
        scale_y = scale
        if board_id == "idle-phone":
            # The two idle boards meet directly in one playlist. Match their neutral standing cels
            # exactly on both axes so that seam cannot read as Azure changing size or proportions.
            neutral = (0, 7)
            scale_x = reference_scale * median(reference[i].width for i in neutral) / median(
                frames[i].width for i in neutral
            )
            scale_y = reference_scale * median(reference[i].height for i in neutral) / median(
                frames[i].height for i in neutral
            )
        # Extremely wide gestures may use more horizontal room, but must never be clipped to fake
        # scale consistency. The hair normalization remains authoritative whenever the cel fits.
        fit_ratio = min(
            1,
            (frame_size[0] - 28) / max(piece.width * scale_x for piece in frames),
            (frame_size[1] - 20) / max(piece.height * scale_y for piece in frames),
        )
        scale_x *= fit_ratio
        scale_y *= fit_ratio
        print(f"{board_id}: scale={scale_x:.4f}x{scale_y:.4f} hair={board_metric(frames):.2f}")
        page_frames: list[Image.Image] = []
        offsets = JUMP_Y_OFFSETS if board_id == "jump" else (0,) * len(frames)
        for piece, y_offset in zip(frames, offsets, strict=True):
            width = max(1, round(piece.width * scale_x))
            height = max(1, round(piece.height * scale_y))
            resized = piece.resize((width, height), Image.Resampling.LANCZOS)
            canvas = Image.new("RGBA", frame_size, (0, 0, 0, 0))
            x = (frame_size[0] - width) // 2
            y = frame_size[1] - height - 10 + y_offset
            canvas.alpha_composite(resized, (x, y))
            page_frames.append(canvas)
        placed[board_id] = page_frames
    return placed


def save_preview(frames: list[Image.Image], duration_ms: int | list[int], output: Path) -> None:
    """Write a no-blend QA loop; each preview frame is one exact production cel."""

    rendered: list[Image.Image] = []
    for frame in frames:
        backdrop = Image.new("RGB", frame.size, (214, 239, 255))
        backdrop.paste(frame.convert("RGB"), mask=frame.getchannel("A"))
        rendered.append(backdrop)
    output.parent.mkdir(parents=True, exist_ok=True)
    rendered[0].save(
        output,
        save_all=True,
        append_images=rendered[1:],
        duration=duration_ms,
        loop=0,
        disposal=2,
        optimize=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--decoded-dir", type=Path, required=True)
    parser.add_argument("--package-dir", type=Path, required=True)
    parser.add_argument("--qa-dir", type=Path, required=True)
    args = parser.parse_args()

    sleep_script = Path(__file__).resolve().parents[2] / "azure-sleep-preview" / "tools" / "build_sleep_preview.py"
    tools = load_sleep_tools(sleep_script)
    raw = {
        board_id: tools.extract_board_components(args.decoded_dir / f"{board_id}.png")
        for board_id in BOARD_IDS
    }
    placed = place_all(raw, tools.FRAME_SIZE)

    args.package_dir.mkdir(parents=True, exist_ok=True)
    args.qa_dir.mkdir(parents=True, exist_ok=True)
    for board_id, frames in placed.items():
        tools.save_motion_page(frames, args.package_dir / f"motion-{board_id}.webp")
        save_preview(frames, DURATIONS_MS[board_id], args.qa_dir / "previews" / f"{board_id}.gif")
    save_preview(
        placed["idle-groom"] + placed["idle-phone"],
        [DURATIONS_MS["idle-groom"]] * 8 + [DURATIONS_MS["idle-phone"]] * 8,
        args.qa_dir / "previews" / "idle-playlist.gif",
    )
    tools.save_keyframes_contact_sheet(
        [(board_id.upper(), placed[board_id]) for board_id in BOARD_IDS],
        args.qa_dir / "motion-contact-sheet.png",
    )
    print(args.qa_dir / "motion-contact-sheet.png")


if __name__ == "__main__":
    main()
