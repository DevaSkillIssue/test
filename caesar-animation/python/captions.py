"""Stage I: word-by-word captions from transcription.json.

Outputs:
  output/captions/captions.ass  styled karaoke captions (current word highlighted + popped),
                                burned into the video by the compositor (libass)
  output/captions/captions.srt  plain subtitle file for platforms that accept sidecar subtitles

Words are grouped into short chunks (max_words, broken at sentence ends and pauses). Each
word gets its own event from its start to the next word's start, so the highlight follows
the voice exactly. The design space is 1080x1920; libass scales it to the output size.
Captions sit inside safe margins (bottom ~26% is left clear of platform UI).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from python.common import StageError, get_logger, load_json, load_settings, path  # noqa: E402

log = get_logger("captions")
PLAY_W, PLAY_H = 1080, 1920

# Colours are ASS &HAABBGGRR.
STYLES = {
    "bold_pop": {"size": 1.0, "primary": "&H00FFFFFF", "highlight": "&H0000D7FF", "outline_col": "&H00000000", "back": "&H80000000", "border": 1, "outline": 7, "shadow": 3, "pop": 1.14},
    "boxed": {"size": 0.85, "primary": "&H00FFFFFF", "highlight": "&H0055FF7A", "outline_col": "&H00000000", "back": "&H99000000", "border": 3, "outline": 14, "shadow": 0, "pop": 1.06},
    "minimal": {"size": 0.78, "primary": "&H00C8C8C8", "highlight": "&H00FFFFFF", "outline_col": "&H00202020", "back": "&H00000000", "border": 1, "outline": 3, "shadow": 1, "pop": 1.0},
}


def display(w: dict) -> str:
    """Show the script's spelling when the transcript was aligned to it (fixes mishearings)."""
    return w.get("script") or w["word"]


def group_words(words: list[dict], max_words: int, max_gap: float) -> list[list[dict]]:
    chunks, cur = [], []
    for w in words:
        if cur and (len(cur) >= max_words or w["start"] - cur[-1]["end"] > max_gap or display(cur[-1])[-1] in ".!?,;:"):
            chunks.append(cur)
            cur = []
        cur.append(w)
    if cur:
        chunks.append(cur)
    return chunks


def ass_time(t: float) -> str:
    cs = int(round(max(t, 0) * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def srt_time(t: float) -> str:
    ms = int(round(max(t, 0) * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _clean(text: str) -> str:
    return text.replace("\\", "").replace("{", "(").replace("}", ")")


def word_events(chunks: list[list[dict]], duration: float, hold: float = 0.35) -> list[tuple[float, float, list[dict], int]]:
    """(start, end, chunk, active_index) for each word; end = next word start (or a short hold)."""
    events = []
    for ci, chunk in enumerate(chunks):
        next_start = chunks[ci + 1][0]["start"] if ci + 1 < len(chunks) else duration
        for wi, w in enumerate(chunk):
            start = w["start"]
            end = chunk[wi + 1]["start"] if wi + 1 < len(chunk) else min(w["end"] + hold, next_start, duration)
            if end <= start:
                end = min(max(w["end"], start + 0.04), duration)
            if end > start:
                events.append((start, end, chunk, wi))
    return events


def build_ass(words: list[dict], duration: float, cfg: dict, style_name: str) -> str:
    st = STYLES.get(style_name)
    if not st:
        raise StageError(f"unknown caption style {style_name}; choose from {', '.join(STYLES)}")
    size = int(cfg["font_size"] * st["size"])
    up = cfg.get("uppercase", True) and style_name != "minimal"
    header = "\n".join([
        "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {PLAY_W}", f"PlayResY: {PLAY_H}", "WrapStyle: 0", "ScaledBorderAndShadow: yes", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: Caption,{cfg['font']},{size},{st['primary']},{st['highlight']},{st['outline_col']},{st['back']},-1,0,0,0,100,100,1,0,{st['border']},{st['outline']},{st['shadow']},2,{cfg['margin_h']},{cfg['margin_h']},{cfg['margin_v']},1",
        "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ])
    pop = int(st["pop"] * 100)
    lines = []
    for start, end, chunk, active in word_events(group_words(words, cfg["max_words"], cfg["max_gap"]), duration):
        parts = []
        for i, w in enumerate(chunk):
            text = _clean(display(w).upper() if up else display(w))
            if i == active:
                # Highlight colour + quick scale pop on the spoken word.
                parts.append(f"{{\\c{st['highlight']}\\fscx{pop - 10}\\fscy{pop - 10}\\t(0,80,\\fscx{pop}\\fscy{pop})}}{text}{{\\r}}")
            else:
                parts.append(text)
        lines.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Caption,,0,0,0,,{' '.join(parts)}")
    return header + "\n" + "\n".join(lines) + "\n"


def build_srt(words: list[dict], duration: float, cfg: dict) -> str:
    out = []
    chunks = group_words(words, cfg["max_words"] * 2, cfg["max_gap"])
    for i, chunk in enumerate(chunks, 1):
        nxt = chunks[i][0]["start"] if i < len(chunks) else duration
        end = min(chunk[-1]["end"] + 0.3, nxt, duration)
        out.append(f"{i}\n{srt_time(chunk[0]['start'])} --> {srt_time(end)}\n{' '.join(display(w) for w in chunk)}\n")
    return "\n".join(out)


def generate_captions(transcription: str = "output/audio/transcription.json", out_dir: str = "output/captions", style: str | None = None, duration: float | None = None) -> dict:
    cfg = load_settings()["captions"]
    data = load_json(transcription)
    words = data["words"]
    if not words:
        raise StageError("transcription has no words; cannot build captions")
    dur = duration or data["duration"]
    od = path(out_dir)
    od.mkdir(parents=True, exist_ok=True)
    (od / "captions.ass").write_text(build_ass(words, dur, cfg, style or cfg["style"]), encoding="utf-8")
    (od / "captions.srt").write_text(build_srt(words, dur, cfg), encoding="utf-8")
    log.info("captions: %d words -> %s/captions.ass (+ .srt), style %s", len(words), out_dir, style or cfg["style"])
    return {"ass": str(od / "captions.ass"), "srt": str(od / "captions.srt")}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--transcription", default="output/audio/transcription.json")
    ap.add_argument("--style", choices=list(STYLES))
    a = ap.parse_args()
    try:
        generate_captions(a.transcription, style=a.style)
    except StageError as e:
        log.error(str(e))
        sys.exit(1)
