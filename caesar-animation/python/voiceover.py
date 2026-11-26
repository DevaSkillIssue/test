"""Stage B: voiceover generation.

Generates one narration clip per scene (keeps scenes organized and cacheable), measures each
clip, stretches scenes whose narration is longer than planned, and lays the clips onto one
track that matches the video timeline exactly:

  output/audio/scenes/<scene_id>.mp3   per-scene clips
  output/audio/scene_timing.json       real scene start/duration used by the animation engine
  output/audio/voiceover.mp3           full-length narration track

Providers:
  elevenlabs  ElevenLabs text-to-speech API (ELEVENLABS_API_KEY; optional ELEVENLABS_VOICE_ID)
  local       espeak-ng, an offline robotic placeholder voice for testing without credentials
  auto        elevenlabs when ELEVENLABS_API_KEY is set, otherwise local (with a warning)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import tempfile
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from python.common import StageError, get_logger, load_dotenv, load_json, load_settings, media_duration, path, require_tool, run, save_json  # noqa: E402

log = get_logger("voiceover")
API = "https://api.elevenlabs.io/v1"
RETRYABLE = {408, 409, 425, 429, 500, 502, 503, 504}


def resolve_voice_id(cfg: dict, api_key: str) -> str:
    voice = os.environ.get("ELEVENLABS_VOICE_ID") or cfg.get("voice_id")
    if voice:
        return voice
    # No voice configured: use the first premade voice on the account.
    r = requests.get(f"{API}/voices", headers={"xi-api-key": api_key}, timeout=30)
    if r.status_code != 200:
        raise StageError(f"ElevenLabs voice list failed (HTTP {r.status_code}): {r.text[:300]}")
    voices = r.json().get("voices", [])
    if not voices:
        raise StageError("ElevenLabs account has no voices; set ELEVENLABS_VOICE_ID")
    voices.sort(key=lambda v: v.get("category") != "premade")
    log.info("using ElevenLabs voice %s (%s); set ELEVENLABS_VOICE_ID to choose another", voices[0]["voice_id"], voices[0].get("name"))
    return voices[0]["voice_id"]


def tts_elevenlabs(text: str, out: Path, cfg: dict, api_key: str, voice_id: str, previous_text: str = "", next_text: str = "") -> None:
    url = f"{API}/text-to-speech/{voice_id}"
    body = {
        "text": text,
        "model_id": cfg["model_id"],
        "voice_settings": {"stability": cfg["stability"], "similarity_boost": cfg["similarity_boost"], "style": cfg["style"], "use_speaker_boost": True},
    }
    # Neighbouring lines keep intonation continuous across separately generated scene clips.
    if previous_text:
        body["previous_text"] = previous_text
    if next_text:
        body["next_text"] = next_text
    attempts = int(cfg.get("max_retries", 4)) + 1
    for attempt in range(1, attempts + 1):
        try:
            r = requests.post(url, params={"output_format": cfg["output_format"]}, json=body, timeout=120,
                              headers={"xi-api-key": api_key, "Accept": "audio/mpeg"})
        except requests.RequestException as e:
            err, retry = f"connection error: {e}", True
        else:
            if r.status_code == 200 and len(r.content) > 1000:
                out.write_bytes(r.content)
                return
            err = f"HTTP {r.status_code}: {r.text[:300]}" if r.status_code != 200 else "empty audio response"
            retry = r.status_code in RETRYABLE or r.status_code == 200
            if r.status_code == 401:
                raise StageError("ElevenLabs rejected the API key (401). Check ELEVENLABS_API_KEY.")
        if not retry or attempt == attempts:
            raise StageError(f"ElevenLabs TTS failed after {attempt} attempt(s): {err}")
        wait = min(30, 2 ** attempt)
        log.warning("ElevenLabs %s; retrying in %ss (%d/%d)", err, wait, attempt, attempts - 1)
        time.sleep(wait)


def tts_local(text: str, out: Path, cfg: dict) -> None:
    require_tool("espeak-ng")
    require_tool("ffmpeg")
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "line.wav"
        txt = Path(tmp) / "line.txt"
        txt.write_text(text, encoding="utf-8")
        run(["espeak-ng", "-v", cfg["voice"], "-s", str(cfg["speed"]), "-p", str(cfg["pitch"]), "-f", str(txt), "-w", str(wav)])
        run(["ffmpeg", "-y", "-v", "error", "-i", str(wav), "-ar", "44100", "-ac", "1", "-b:a", "128k", str(out)])


def layout_scenes(scenes: list[dict], clip_durations: list[float], lead: float, tail: float) -> list[dict]:
    """Place clips on the timeline. A scene lasts max(planned, lead + clip + tail)."""
    out, cursor = [], 0.0
    for s, clip in zip(scenes, clip_durations, strict=True):
        dur = round(max(s["duration"], lead + clip + tail), 3)
        out.append({
            "scene_id": s["scene_id"], "start": round(cursor, 3), "duration": dur, "planned_duration": s["duration"],
            "audio_start": round(cursor + lead, 3), "audio_duration": round(clip, 3), "stretched": dur > s["duration"] + 1e-9,
        })
        cursor = round(cursor + dur, 3)
    return out


def build_track(timing: list[dict], clips: list[Path], total: float, out: Path) -> None:
    """Mix the per-scene clips at their start offsets into one track of exactly `total` seconds."""
    cmd = ["ffmpeg", "-y", "-v", "error"]
    for c in clips:
        cmd += ["-i", str(c)]
    parts, labels = [], []
    for i, t in enumerate(timing):
        ms = int(round(t["audio_start"] * 1000))
        parts.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=mono,adelay={ms}:all=1[a{i}]")
        labels.append(f"[a{i}]")
    parts.append(f"{''.join(labels)}amix=inputs={len(clips)}:normalize=0:dropout_transition=0,apad=whole_dur={total},atrim=0:{total}[out]")
    cmd += ["-filter_complex", ";".join(parts), "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "192k", str(out)]
    run(cmd)


def generate_voiceover(story_path: str = "input/story.json", provider: str = "auto", force: bool = False) -> dict:
    load_dotenv()
    settings = load_settings()
    acfg = settings["audio"]
    story = load_json(story_path)
    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if provider == "auto":
        provider = "elevenlabs" if api_key else "local"
        if provider == "local":
            log.warning("ELEVENLABS_API_KEY is not set: using the offline espeak-ng placeholder voice (robotic). Set the key for real narration.")
    if provider == "elevenlabs" and not api_key:
        raise StageError("tts provider 'elevenlabs' needs ELEVENLABS_API_KEY (see .env.example)")
    if provider not in ("elevenlabs", "local"):
        raise StageError(f"unknown tts provider {provider}")

    out_dir = path("output/audio/scenes")
    out_dir.mkdir(parents=True, exist_ok=True)
    cache_file = path("output/audio/voiceover_cache.json")
    cache = json.loads(cache_file.read_text()) if cache_file.exists() and not force else {}
    voice_id = resolve_voice_id(acfg["elevenlabs"], api_key) if provider == "elevenlabs" else acfg["local_tts"]["voice"]
    pcfg = acfg["elevenlabs"] if provider == "elevenlabs" else acfg["local_tts"]

    scenes = story["scenes"]
    clips, durations = [], []
    for i, s in enumerate(scenes):
        prev_t = scenes[i - 1]["narration"] if i > 0 else ""
        next_t = scenes[i + 1]["narration"] if i + 1 < len(scenes) else ""
        key = hashlib.sha256(json.dumps([provider, voice_id, pcfg, s["narration"], prev_t, next_t], sort_keys=True).encode()).hexdigest()
        clip = out_dir / f"{s['scene_id']}.mp3"
        if cache.get(s["scene_id"]) == key and clip.exists():
            log.info("scene %s: cached clip", s["scene_id"])
        else:
            log.info("scene %s: generating narration with %s (%d chars)", s["scene_id"], provider, len(s["narration"]))
            if provider == "elevenlabs":
                tts_elevenlabs(s["narration"], clip, pcfg, api_key, voice_id, prev_t, next_t)
            else:
                tts_local(s["narration"], clip, pcfg)
            cache[s["scene_id"]] = key
            save_json(cache_file, cache)
        clips.append(clip)
        durations.append(media_duration(clip))

    timing = layout_scenes(scenes, durations, acfg["scene_lead_in"], acfg["scene_tail"])
    total = round(sum(t["duration"] for t in timing), 3)
    track = path("output/audio/voiceover.mp3")
    build_track(timing, clips, total, track)
    for t, c in zip(timing, clips):
        t["file"] = str(c.relative_to(path(".")))
        if t["stretched"]:
            log.info("scene %s stretched %.2fs -> %.2fs to fit narration", t["scene_id"], t["planned_duration"], t["duration"])
    result = {
        "story": story_path, "provider": provider, "voice": voice_id, "total_duration": total,
        "track_duration": round(media_duration(track), 3), "lead_in": acfg["scene_lead_in"], "tail": acfg["scene_tail"], "scenes": timing,
    }
    save_json("output/audio/scene_timing.json", result)
    log.info("voiceover ready: %s (%.2fs, provider=%s)", "output/audio/voiceover.mp3", total, provider)
    return result


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", default="input/story.json")
    ap.add_argument("--tts", default=None, choices=["auto", "elevenlabs", "local"])
    ap.add_argument("--force", action="store_true", help="regenerate every clip (ignore cache)")
    a = ap.parse_args()
    try:
        generate_voiceover(a.input, a.tts or load_settings()["audio"]["tts_provider"], a.force)
    except StageError as e:
        log.error(str(e))
        sys.exit(1)
