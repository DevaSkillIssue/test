"""Stage K: video compositing with FFmpeg, plus final MP4 validation.

compose():   frames + voiceover + timed SFX + optional (ducked) background music + burned-in
             ASS captions  ->  H.264 (yuv420p) / AAC MP4 of exactly frame_count / fps seconds.
validate_video(): ffprobe/ffmpeg checks: codecs, size, fps, exact frame count, audio/video
             duration match, decodes without errors, and no unintended black stretches.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from python.common import StageError, get_logger, load_json, load_settings, path, require_tool, run, save_json  # noqa: E402

log = get_logger("compose")


def _check_frames(frames_dir: Path, manifest: dict) -> None:
    missing = [i for i in range(manifest["frame_count"]) if not (frames_dir / f"frame_{i:05d}.{manifest['format']}").exists()]
    if missing:
        raise StageError(f"{len(missing)} frames missing in {frames_dir} (first: {missing[:5]}); re-run the render stage")


def compose(frames_dir: str = "output/frames", out: str = "output/final.mp4", voiceover: str | None = "output/audio/voiceover.mp3",
            sfx_events: str | None = "output/audio/sfx_events.json", captions: str | None = "output/captions/captions.ass",
            music: str | None = None, preset: str = "medium", crf: int = 18) -> dict:
    require_tool("ffmpeg")
    acfg = load_settings()["audio"]
    fdir = path(frames_dir)
    manifest = load_json(fdir / "manifest.json")
    if manifest["first"] != 0 or manifest["last"] != manifest["frame_count"] - 1:
        raise StageError(f"frames cover {manifest['first']}..{manifest['last']} but the video needs 0..{manifest['frame_count'] - 1}")
    _check_frames(fdir, manifest)
    fps, n = manifest["fps"], manifest["frame_count"]
    dur = n / fps

    cmd = ["ffmpeg", "-y", "-v", "error", "-framerate", str(fps), "-i", str(fdir / manifest["pattern"])]
    filters, mix = [], []
    idx = 1
    fmt = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo"

    voice_path = path(voiceover) if voiceover else None
    if voice_path and voice_path.exists():
        cmd += ["-i", str(voice_path)]
        filters.append(f"[{idx}:a]{fmt},volume={acfg['voice_volume']},asplit=2[vo][vosc]")
        mix.append("[vo]")
        idx += 1
    else:
        voice_path = None
        log.warning("no voiceover found; the video will have no narration")

    events = []
    if sfx_events and path(sfx_events).exists():
        events = load_json(sfx_events)["events"]
    for e in events:
        f = path(e["file"])
        if not f.exists():
            log.warning("sfx %s: %s missing, skipped", e["cue"], e["file"])
            continue
        ms = int(round(e["time"] * 1000))
        cmd += ["-i", str(f)]
        filters.append(f"[{idx}:a]{fmt},volume={e['volume'] * acfg['sfx_volume']:.3f},adelay={ms}:all=1[s{idx}]")
        mix.append(f"[s{idx}]")
        idx += 1

    if music:
        mpath = path(music)
        if not mpath.exists():
            raise StageError(f"music file {music} not found")
        cmd += ["-stream_loop", "-1", "-i", str(mpath)]
        filters.append(f"[{idx}:a]{fmt},volume={acfg['music_volume']},atrim=0:{dur:.3f}[mraw]")
        if voice_path:  # duck the music under the narration
            filters.append("[mraw][vosc]sidechaincompress=threshold=0.04:ratio=8:attack=15:release=350[mus]")
        else:
            filters.append("[mraw]anull[mus]")
        mix.append("[mus]")
        idx += 1
    elif voice_path:
        filters.append("[vosc]anullsink")

    if not mix:  # silent video still needs an audio stream of the right length
        cmd += ["-f", "lavfi", "-t", f"{dur:.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
        mix.append(f"[{idx}:a]")
        idx += 1
    filters.append(f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0:dropout_transition=0,alimiter=limit=0.95,apad=whole_dur={dur:.3f},atrim=0:{dur:.3f}[aout]")

    vf = "[0:v]"
    if captions and path(captions).exists():
        # Path is relative to the working directory (ROOT) to avoid filter-escaping problems.
        rel = str(path(captions).relative_to(path("."))).replace("\\", "/")
        vf += f"ass={rel},"
    elif captions:
        log.warning("captions file %s not found; no captions burned in", captions)
    filters.append(f"{vf}format=yuv420p[vout]")

    outp = path(out)
    outp.parent.mkdir(parents=True, exist_ok=True)
    cmd += ["-filter_complex", ";".join(filters), "-map", "[vout]", "-map", "[aout]",
            "-c:v", "libx264", "-preset", preset, "-crf", str(crf), "-pix_fmt", "yuv420p", "-r", str(fps), "-frames:v", str(n),
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-t", f"{dur:.3f}", str(outp)]
    log.info("composing %d frames (%.2fs @ %s fps), %d sfx, music=%s, captions=%s", n, dur, fps, len(events), bool(music), bool(captions and path(captions).exists()))
    run(cmd)
    log.info("wrote %s (%.1f MB)", out, outp.stat().st_size / 1e6)
    return {"out": str(outp), "frames": n, "fps": fps, "duration": dur, "width": manifest["width"], "height": manifest["height"]}


def validate_video(file: str, width: int, height: int, fps: int, frame_count: int, max_black: float = 0.5) -> dict:
    """Return a report dict; raise StageError listing every failed check."""
    require_tool("ffprobe")
    f = path(file)
    if not f.exists():
        raise StageError(f"{file} does not exist")
    probe = json.loads(run(["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", str(f)]).stdout)
    v = next((s for s in probe["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in probe["streams"] if s["codec_type"] == "audio"), None)
    problems = []
    if not v:
        raise StageError("no video stream")
    if not a:
        problems.append("no audio stream")
    num, den = map(int, v["avg_frame_rate"].split("/"))
    vdur = float(v.get("duration", probe["format"]["duration"]))
    report = {
        "file": file, "video_codec": v["codec_name"], "pix_fmt": v.get("pix_fmt"), "width": v["width"], "height": v["height"],
        "fps": num / den if den else 0, "frames": int(v.get("nb_read_frames", 0)), "video_duration": round(vdur, 3),
        "audio_codec": a["codec_name"] if a else None, "audio_duration": round(float(a["duration"]), 3) if a else None,
        "container_duration": round(float(probe["format"]["duration"]), 3), "size_mb": round(f.stat().st_size / 1e6, 2),
    }
    if report["video_codec"] != "h264":
        problems.append(f"video codec is {report['video_codec']}, expected h264")
    if report["pix_fmt"] != "yuv420p":
        problems.append(f"pixel format {report['pix_fmt']}, expected yuv420p")
    if (report["width"], report["height"]) != (width, height):
        problems.append(f"resolution {report['width']}x{report['height']}, expected {width}x{height}")
    if abs(report["fps"] - fps) > 1e-6:
        problems.append(f"frame rate {report['fps']}, expected {fps}")
    if report["frames"] != frame_count:
        problems.append(f"{report['frames']} frames, expected {frame_count}")
    if a and a["codec_name"] != "aac":
        problems.append(f"audio codec {a['codec_name']}, expected aac")
    if a and abs(report["audio_duration"] - report["video_duration"]) > 1.0 / fps + 0.03:
        problems.append(f"audio {report['audio_duration']}s vs video {report['video_duration']}s")

    dec = run(["ffmpeg", "-v", "error", "-i", str(f), "-f", "null", "-"])
    if dec.stderr.strip():
        problems.append(f"decode errors: {dec.stderr.strip()[:300]}")
    bd = run(["ffmpeg", "-v", "info", "-i", str(f), "-vf", f"blackdetect=d={max_black}:pix_th=0.06", "-an", "-f", "null", "-"])
    blacks = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", bd.stderr)
    report["black_segments"] = [[float(s), float(e)] for s, e in blacks]
    if blacks:
        problems.append(f"black frames for >= {max_black}s at {report['black_segments']}")
    report["ok"] = not problems
    report["problems"] = problems
    save_json(f.with_suffix(".validation.json"), report)
    if problems:
        raise StageError(f"{file} failed validation:\n- " + "\n- ".join(problems))
    log.info("validated %s: %dx%d h264/aac, %d frames @ %g fps, video %.3fs / audio %.3fs", file, report["width"], report["height"], report["frames"], report["fps"], report["video_duration"], report["audio_duration"] or 0)
    return report


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--frames", default="output/frames")
    ap.add_argument("--out", default="output/final.mp4")
    ap.add_argument("--music")
    ap.add_argument("--no-captions", action="store_true")
    a = ap.parse_args()
    try:
        info = compose(a.frames, a.out, captions=None if a.no_captions else "output/captions/captions.ass", music=a.music)
        validate_video(a.out, info["width"], info["height"], info["fps"], info["frames"])
    except StageError as e:
        log.error(str(e))
        sys.exit(1)
