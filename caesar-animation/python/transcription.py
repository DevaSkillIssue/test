"""Stage C: transcription with word-level timestamps (faster-whisper).

Transcribes output/audio/voiceover.mp3 and writes output/audio/transcription.json:
  {"words": [{"word": "Imagine", "start": 0.0, "end": 0.4, "probability": 0.98}, ...],
   "duration": 41.2, "model": "base.en", "text": "...", "script_match": 0.97}

Timestamps come only from Whisper's word alignment; they are validated (ordered, inside the
audio, end >= start) and never invented. `script_match` compares the transcript with the
story narration so a bad TTS take or a wrong file is caught early.
"""
from __future__ import annotations

import argparse
import difflib
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from python.common import StageError, get_logger, load_json, load_settings, media_duration, path, require_tool, save_json  # noqa: E402

log = get_logger("transcribe")


def decode_audio(file: Path, sr: int = 16000) -> np.ndarray:
    """Decode with the ffmpeg CLI to mono float32 (avoids PyAV version incompatibilities)."""
    require_tool("ffmpeg")
    proc = subprocess.run(["ffmpeg", "-v", "error", "-i", str(file), "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"], capture_output=True)
    if proc.returncode != 0:
        raise StageError(f"ffmpeg could not decode {file}: {proc.stderr.decode()[-500:]}")
    return np.frombuffer(proc.stdout, dtype=np.float32).copy()


def validate_words(words: list[dict], duration: float) -> list[str]:
    errors = []
    if not words:
        errors.append("no words were transcribed")
    prev = -1.0
    for i, w in enumerate(words):
        if not w["word"]:
            errors.append(f"word {i} is empty")
        if w["start"] < 0 or w["end"] < w["start"]:
            errors.append(f"word {i} '{w['word']}' has invalid times {w['start']}-{w['end']}")
        if w["start"] < prev - 1e-6:
            errors.append(f"word {i} '{w['word']}' starts before the previous word")
        if w["end"] > duration + 0.1:
            errors.append(f"word {i} '{w['word']}' ends at {w['end']}s after the audio ({duration:.2f}s)")
        prev = w["start"]
    return errors


def _tokens(text: str) -> list[str]:
    return [t for t in (re.sub(r"[^a-z0-9]", "", w.lower()) for w in text.split()) if t]


def align_script(words: list[dict], narration: str) -> int:
    """Attach the intended script word to each transcribed word (`script` field) when the
    transcript and the narration line up one-to-one (equal or same-length substitution, e.g.
    "11" heard for "eleven"). Timestamps stay Whisper's; unmatched words get no script field."""
    script = [w for w in narration.split() if _tokens(w)]
    a = [_tokens(w["word"])[0] if _tokens(w["word"]) else "" for w in words]
    b = [_tokens(w)[0] for w in script]
    aligned = 0
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op == "equal" or (op == "replace" and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                words[i1 + k]["script"] = script[j1 + k]
                aligned += 1
    return aligned


def script_match(words: list[dict], narration: str) -> float:
    return difflib.SequenceMatcher(None, _tokens(" ".join(w["word"] for w in words)), _tokens(narration)).ratio()


def transcribe(audio: str = "output/audio/voiceover.mp3", out: str = "output/audio/transcription.json", story_path: str | None = "input/story.json") -> dict:
    from faster_whisper import WhisperModel  # heavy import; only when the stage runs

    cfg = load_settings()["whisper"]
    src = path(audio)
    if not src.exists():
        raise StageError(f"{audio} not found; run the voiceover stage first")
    duration = media_duration(src)
    log.info("loading whisper model %s (%s/%s)", cfg["model"], cfg["device"], cfg["compute_type"])
    try:
        model = WhisperModel(cfg["model"], device=cfg["device"], compute_type=cfg["compute_type"])
    except Exception as e:  # download / load failures come in many types
        raise StageError(f"could not load whisper model '{cfg['model']}': {e}. The first run downloads it from huggingface.co.") from e

    samples = decode_audio(src)
    segments, info = model.transcribe(samples, language=cfg.get("language"), word_timestamps=True, beam_size=5, condition_on_previous_text=False)
    words = []
    for seg in segments:
        for w in seg.words or []:
            text = w.word.strip()
            if text:
                words.append({"word": text, "start": round(float(w.start), 3), "end": round(min(float(w.end), duration), 3), "probability": round(float(w.probability), 3)})

    errors = validate_words(words, duration)
    if errors:
        raise StageError("transcription timestamps are invalid:\n- " + "\n- ".join(errors[:10]))

    result = {"words": words, "duration": round(duration, 3), "model": cfg["model"], "language": info.language, "text": " ".join(w["word"] for w in words)}
    if story_path and path(story_path).exists():
        narration = " ".join(s["narration"] for s in load_json(story_path)["scenes"])
        result["script_match"] = round(script_match(words, narration), 3)
        result["script_aligned"] = align_script(words, narration)
        if result["script_match"] < 0.8:
            log.warning("transcript matches the script only %.0f%%; check the voiceover", result["script_match"] * 100)
    save_json(out, result)
    log.info("transcribed %d words over %.2fs (script match %s)", len(words), duration, result.get("script_match"))
    return result


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--audio", default="output/audio/voiceover.mp3")
    ap.add_argument("--out", default="output/audio/transcription.json")
    ap.add_argument("--input", default="input/story.json")
    a = ap.parse_args()
    try:
        transcribe(a.audio, a.out, a.input)
    except StageError as e:
        log.error(str(e))
        sys.exit(1)
