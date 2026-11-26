"""Python tests. Run: python -m unittest discover -s tests/python -v

Fast unit tests run always. Slower / external ones are gated:
  RUN_SLOW=1           end-to-end pipeline on the test scene (local TTS, whisper, render, compose)
  ELEVENLABS_API_KEY   live ElevenLabs TTS call (costs credits; also needs RUN_LIVE_API=1)
  ANTHROPIC_API_KEY    live Claude story generation (costs tokens; also needs RUN_LIVE_API=1)
"""
from __future__ import annotations

import copy
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
import wave
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from python import captions, sfx, story_validator, transcription, voiceover  # noqa: E402
from python.common import StageError, load_json  # noqa: E402
from python.story_generator import api_schema  # noqa: E402

HAVE_TOOLS = all(shutil.which(t) for t in ("ffmpeg", "ffprobe", "node", "espeak-ng"))
LIVE = os.environ.get("RUN_LIVE_API") == "1"


class StoryValidationTest(unittest.TestCase):
    def setUp(self):
        self.story = load_json("input/story.json")

    def test_sample_story_is_valid(self):
        errors, _ = story_validator.validate_story(self.story)
        self.assertEqual(errors, [])

    def test_schema_errors_are_reported(self):
        s = copy.deepcopy(self.story)
        del s["scenes"][0]["camera"]
        s["scenes"][1]["actions"][0]["action"] = "moonwalk"
        errors, _ = story_validator.validate_story(s)
        self.assertTrue(any("camera" in e for e in errors))
        self.assertTrue(any("moonwalk" in e for e in errors))

    def test_semantic_errors_are_reported(self):
        s = copy.deepcopy(self.story)
        s["scenes"][0]["sound_effects"].append({"cue": "explosion", "time": 1})
        s["scenes"][0]["actions"].append({"time": 1, "character": "ghost", "action": "wave", "duration": 1})
        s["scenes"][0]["actions"][2]["at_word"] = "banana"
        s["scenes"][0]["actions"][0]["time"] = 99
        s["scenes"][0]["camera"]["target"] = "nobody"
        errors, _ = story_validator.validate_story(s)
        joined = "\n".join(errors)
        for needle in ("explosion", "ghost", "banana", "after the scene ends", "camera target"):
            self.assertIn(needle, joined)


class VoiceoverTest(unittest.TestCase):
    def test_layout_stretches_scenes_to_fit_narration(self):
        scenes = [{"scene_id": "a", "duration": 3.0}, {"scene_id": "b", "duration": 4.0}]
        t = voiceover.layout_scenes(scenes, [3.2, 2.0], lead=0.25, tail=0.35)
        self.assertAlmostEqual(t[0]["duration"], 3.8)
        self.assertTrue(t[0]["stretched"])
        self.assertEqual(t[1]["start"], 3.8)
        self.assertEqual(t[1]["duration"], 4.0)
        self.assertAlmostEqual(t[1]["audio_start"], 4.05)

    def test_elevenlabs_retries_then_succeeds(self):
        cfg = {"model_id": "m", "stability": 0.5, "similarity_boost": 0.8, "style": 0.2, "output_format": "mp3_44100_128", "max_retries": 3}
        responses = [mock.Mock(status_code=429, text="slow down", content=b""), mock.Mock(status_code=200, text="", content=b"x" * 5000)]
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(voiceover.requests, "post", side_effect=responses) as post, mock.patch.object(voiceover.time, "sleep"):
            out = Path(tmp) / "a.mp3"
            voiceover.tts_elevenlabs("hello", out, cfg, "key", "voice123", "prev", "next")
            self.assertEqual(out.read_bytes(), b"x" * 5000)
            self.assertEqual(post.call_count, 2)
            body = post.call_args.kwargs["json"]
            self.assertEqual(body["previous_text"], "prev")
            self.assertEqual(post.call_args.kwargs["headers"]["xi-api-key"], "key")

    def test_elevenlabs_bad_key_fails_fast(self):
        cfg = {"model_id": "m", "stability": 0.5, "similarity_boost": 0.8, "style": 0.2, "output_format": "mp3_44100_128", "max_retries": 3}
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(voiceover.requests, "post", return_value=mock.Mock(status_code=401, text="bad", content=b"")) as post:
            with self.assertRaises(StageError):
                voiceover.tts_elevenlabs("hi", Path(tmp) / "a.mp3", cfg, "bad", "v")
            self.assertEqual(post.call_count, 1)

    @unittest.skipUnless(LIVE and os.environ.get("ELEVENLABS_API_KEY"), "live ElevenLabs test (RUN_LIVE_API=1 + ELEVENLABS_API_KEY)")
    def test_live_elevenlabs(self):
        from python.common import load_settings, media_duration
        cfg = load_settings()["audio"]["elevenlabs"]
        key = os.environ["ELEVENLABS_API_KEY"]
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "live.mp3"
            voiceover.tts_elevenlabs("Testing one two three.", out, cfg, key, voiceover.resolve_voice_id(cfg, key))
            self.assertGreater(media_duration(out), 0.5)


class TranscriptionTest(unittest.TestCase):
    def test_word_validation_catches_bad_timestamps(self):
        good = [{"word": "a", "start": 0.0, "end": 0.2}, {"word": "b", "start": 0.3, "end": 0.5}]
        self.assertEqual(transcription.validate_words(good, 1.0), [])
        bad = [{"word": "a", "start": 0.5, "end": 0.2}, {"word": "b", "start": 0.1, "end": 2.0}]
        errs = transcription.validate_words(bad, 1.0)
        self.assertEqual(len(errs), 3)
        self.assertTrue(transcription.validate_words([], 1.0))

    def test_script_alignment_fixes_mishearings_without_new_timestamps(self):
        words = [{"word": w, "start": i * 0.3, "end": i * 0.3 + 0.2} for i, w in enumerate("And the sidewalk had 11 plans extra".split())]
        before = [(w["start"], w["end"]) for w in words]
        n = transcription.align_script(words, "Then the sidewalk had eleven plans.")
        self.assertEqual(n, 6)
        self.assertEqual(words[0]["script"], "Then")
        self.assertEqual(words[4]["script"], "eleven")
        self.assertNotIn("script", words[6])
        self.assertEqual(before, [(w["start"], w["end"]) for w in words])
        cfg = load_json("config/settings.json")["captions"]
        self.assertIn("ELEVEN", captions.build_ass(words, 3.0, cfg, "bold_pop"))

    def test_script_match(self):
        words = [{"word": w} for w in "Then he trips over nothing.".split()]
        self.assertEqual(transcription.script_match(words, "Then he trips over nothing."), 1.0)
        self.assertLess(transcription.script_match(words, "Something else entirely here"), 0.5)


class CaptionsTest(unittest.TestCase):
    WORDS = [{"word": w, "start": i * 0.4, "end": i * 0.4 + 0.3} for i, w in enumerate("This is fine. Totally fine, right?".split())]

    def test_grouping_breaks_on_punctuation_and_size(self):
        chunks = captions.group_words(self.WORDS, max_words=3, max_gap=0.6)
        self.assertEqual([len(c) for c in chunks], [3, 2, 1])

    def test_ass_highlights_every_word_in_order(self):
        cfg = load_json("config/settings.json")["captions"]
        ass = captions.build_ass(self.WORDS, 3.0, cfg, "bold_pop")
        events = [l for l in ass.splitlines() if l.startswith("Dialogue:")]
        self.assertEqual(len(events), len(self.WORDS))
        self.assertTrue(all("\\c&H0000D7FF" in e for e in events))
        starts = [e.split(",")[1] for e in events]
        self.assertEqual(starts, sorted(starts))
        self.assertIn(f",{cfg['margin_v']},1", ass)  # safe bottom margin in the style
        self.assertIn("PlayResY: 1920", ass)
        for style in captions.STYLES:
            self.assertIn("Dialogue:", captions.build_ass(self.WORDS, 3.0, cfg, style))

    def test_events_never_overlap_and_stay_inside_audio(self):
        evs = captions.word_events(captions.group_words(self.WORDS, 3, 0.6), 2.5)
        for (s, e, *_), (s2, *_rest) in zip(evs, evs[1:]):
            self.assertLessEqual(e, s2 + 1e-9)
            self.assertLess(s, e)
        self.assertLessEqual(evs[-1][1], 2.5)

    def test_srt(self):
        cfg = load_json("config/settings.json")["captions"]
        srt = captions.build_srt(self.WORDS, 3.0, cfg)
        self.assertTrue(srt.startswith("1\n00:00:00,000 --> "))


class SfxTest(unittest.TestCase):
    def test_every_cue_synthesizes_audible_audio(self):
        cues = load_json("config/sfx.json")["cues"]
        for i, cue in enumerate(sorted(cues)):
            x = sfx.synth(cue, i)
            self.assertGreater(len(x), 1000, cue)
            self.assertTrue(math.isfinite(float(abs(x).max())) and abs(x).max() > 0, cue)

    def test_library_files_exist_and_are_wav(self):
        lib = sfx.ensure_library()
        self.assertEqual(len(lib), len(load_json("config/sfx.json")["cues"]))
        with wave.open(str(lib["thud"])) as w:
            self.assertEqual(w.getframerate(), sfx.SR)


class StoryGeneratorTest(unittest.TestCase):
    def test_api_schema_strips_unsupported_constraints(self):
        s = api_schema(load_json("config/story.schema.json"))
        text = json.dumps(s)
        for key in ('"minimum"', '"maxItems"', '"pattern"', '"minLength"', '"$schema"'):
            self.assertNotIn(key, text)
        self.assertIn('"additionalProperties": false', text)
        self.assertIn("$defs", s)

    @unittest.skipUnless(LIVE and os.environ.get("ANTHROPIC_API_KEY"), "live Claude test (RUN_LIVE_API=1 + ANTHROPIC_API_KEY)")
    def test_live_generation(self):
        from python.story_generator import generate_story
        with tempfile.TemporaryDirectory() as tmp:
            story = generate_story("a stickman fights a vending machine", str(Path(tmp) / "s.json"))
            self.assertEqual(story_validator.validate_story(story)[0], [])


@unittest.skipUnless(os.environ.get("RUN_SLOW") == "1" and HAVE_TOOLS, "end-to-end test (RUN_SLOW=1, needs ffmpeg/node/espeak-ng)")
class EndToEndTest(unittest.TestCase):
    def test_pipeline_on_test_scene(self):
        proc = subprocess.run([sys.executable, "pipeline.py", "--input", "input/test_scene.json", "--preview", "--tts", "local", "--out", "output/test_e2e.mp4"],
                              cwd=ROOT, capture_output=True, text=True, timeout=900)
        self.assertEqual(proc.returncode, 0, proc.stdout[-3000:] + proc.stderr[-3000:])
        report = load_json("output/test_e2e.validation.json")
        self.assertTrue(report["ok"], report["problems"])
        timing = load_json("output/audio/scene_timing.json")
        self.assertAlmostEqual(report["video_duration"], math.ceil(timing["total_duration"] * 30 - 1e-9) / 30, places=2)
        self.assertLessEqual(abs(report["audio_duration"] - report["video_duration"]), 1 / 30 + 0.03)
        words = load_json("output/audio/transcription.json")["words"]
        self.assertGreater(len(words), 5)
        self.assertLessEqual(words[-1]["end"], report["audio_duration"] + 0.05)

        # Same frames again with background music to exercise ducking + mixing.
        from python import compositor
        music = ROOT / "output" / "test_music.wav"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=220:duration=3", str(music)], check=True)
        info = compositor.compose(out="output/test_music.mp4", music=str(music))
        compositor.validate_video("output/test_music.mp4", info["width"], info["height"], info["fps"], info["frames"])


if __name__ == "__main__":
    unittest.main()
