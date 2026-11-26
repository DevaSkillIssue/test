#!/usr/bin/env python3
"""One-command production pipeline: story idea or story.json -> output/final.mp4

Stages (in order):
  story       generate input/story.json with Claude (only when --idea is given)
  validate    strict schema + semantic validation of the story
  voiceover   ElevenLabs (or offline placeholder) narration per scene + scene timing
  transcribe  faster-whisper word timestamps
  captions    word-by-word ASS + SRT captions
  sfx         make sure every sound-effect file exists (synthesizes procedural cues)
  plan        compile the timeline + absolute SFX events (Node)
  render      deterministic WebGL frames via headless Chromium (Node)
  compose     FFmpeg: frames + voice + SFX + music + captions -> MP4
  verify      validate codecs, size, fps, frame count, A/V sync, black frames

Examples:
  python pipeline.py --input input/story.json
  python pipeline.py --idea "a stickman's war with his alarm clock"
  python pipeline.py --input input/story.json --preview          # fast 540x960 test render
  python pipeline.py --only render --preview                      # one stage
  python pipeline.py --from compose                               # resume from a stage
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time

from python.common import ROOT, StageError, get_logger, load_dotenv, load_json, load_settings, path, require_tool

STAGES = ["story", "validate", "voiceover", "transcribe", "captions", "sfx", "plan", "render", "compose", "verify"]
log = get_logger("pipeline")


def node(script: str, *args: str) -> None:
    require_tool("node")
    proc = subprocess.run(["node", script, *args], cwd=ROOT)
    if proc.returncode != 0:
        raise StageError(f"node {script} failed with exit code {proc.returncode}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", default="input/story.json", help="story JSON (written here when --idea is used)")
    ap.add_argument("--idea", help="generate the story from this idea with Claude first")
    ap.add_argument("--only", help="run only these stages (comma separated)")
    ap.add_argument("--from", dest="from_stage", choices=STAGES, help="start at this stage")
    ap.add_argument("--to", dest="to_stage", choices=STAGES, help="stop after this stage")
    ap.add_argument("--preview", action="store_true", help="render at the low preview resolution from config/settings.json")
    ap.add_argument("--tts", choices=["auto", "elevenlabs", "local", "none"], help="voice provider (none = silent, planned timing)")
    ap.add_argument("--force-voice", action="store_true", help="regenerate voice clips even if cached")
    ap.add_argument("--workers", help="parallel browser pages for rendering")
    ap.add_argument("--music", help="background music file (overrides story.music)")
    ap.add_argument("--caption-style", choices=["bold_pop", "boxed", "minimal"])
    ap.add_argument("--out", help="output MP4 (default output/final.mp4, or output/final_preview.mp4 with --preview)")
    a = ap.parse_args(argv)

    load_dotenv()
    os.chdir(ROOT)
    settings = load_settings()
    tts = a.tts or settings["audio"]["tts_provider"]
    out = a.out or ("output/final_preview.mp4" if a.preview else "output/final.mp4")
    video = settings["preview"] if a.preview else settings["video"]

    if a.only:
        selected = [s.strip() for s in a.only.split(",")]
        bad = [s for s in selected if s not in STAGES]
        if bad:
            ap.error(f"unknown stage(s): {', '.join(bad)}")
    else:
        lo = STAGES.index(a.from_stage) if a.from_stage else 0
        hi = STAGES.index(a.to_stage) if a.to_stage else len(STAGES) - 1
        selected = STAGES[lo:hi + 1]
    if "story" in selected and not a.idea:
        selected.remove("story")
    silent = tts == "none"
    timing_args = ["--no-audio-timing"] if silent else []

    from python import captions, compositor, sfx, story_validator, transcription, voiceover

    def stage_story():
        from python.story_generator import generate_story
        generate_story(a.idea, a.input)

    def stage_validate():
        story_validator.validate_file(a.input)

    def stage_voiceover():
        if silent:
            log.info("tts=none: skipping narration; scenes use planned durations")
            return
        voiceover.generate_voiceover(a.input, tts, a.force_voice)

    def stage_transcribe():
        if silent:
            return
        transcription.transcribe("output/audio/voiceover.mp3", "output/audio/transcription.json", a.input)

    def stage_captions():
        if silent:
            log.info("tts=none: no narration, no captions")
            return
        timing = load_json("output/audio/scene_timing.json")
        fps = video["fps"]
        frames = -(-round(timing["total_duration"] * fps * 1e6) // 1_000_000)  # ceil without float noise
        captions.generate_captions(style=a.caption_style, duration=frames / fps)

    def stage_sfx():
        sfx.ensure_library()

    def stage_plan():
        node("scripts/plan.mjs", "--story", a.input, "--fps", str(video["fps"]), *timing_args)

    def stage_render():
        args = ["--story", a.input, *timing_args]
        if a.preview:
            args.append("--preview")
        if a.workers:
            args += ["--workers", a.workers]
        node("scripts/render.mjs", *args)

    def stage_compose():
        story = load_json(a.input)
        music = a.music or story.get("music")
        if music and not path(music).exists():
            log.warning("music %s not found; continuing without music", music)
            music = None
        compositor.compose(out=out, voiceover=None if silent else "output/audio/voiceover.mp3",
                           captions=None if silent else "output/captions/captions.ass", music=music)

    def stage_verify():
        m = load_json("output/frames/manifest.json")
        if (m["width"], m["height"], m["fps"]) != (video["width"], video["height"], video["fps"]):
            raise StageError(f"frames are {m['width']}x{m['height']}@{m['fps']}, but this run expects {video['width']}x{video['height']}@{video['fps']}; re-run render")
        compositor.validate_video(out, m["width"], m["height"], m["fps"], m["frame_count"])

    runners = {"story": stage_story, "validate": stage_validate, "voiceover": stage_voiceover, "transcribe": stage_transcribe,
               "captions": stage_captions, "sfx": stage_sfx, "plan": stage_plan, "render": stage_render, "compose": stage_compose, "verify": stage_verify}

    log.info("stages: %s | input %s | %dx%d@%d | tts %s", ", ".join(selected), a.input, video["width"], video["height"], video["fps"], tts)
    timings = []
    t_all = time.time()
    for name in selected:
        t0 = time.time()
        log.info("=== %s ===", name)
        try:
            runners[name]()
        except StageError as e:
            log.error("stage '%s' failed: %s", name, e)
            return 1
        timings.append((name, time.time() - t0))
    log.info("=== summary ===")
    for name, sec in timings:
        log.info("  %-10s %7.1fs", name, sec)
    log.info("done in %.1fs%s", time.time() - t_all, f" -> {out}" if "compose" in selected else "")
    return 0


if __name__ == "__main__":
    sys.exit(main())
