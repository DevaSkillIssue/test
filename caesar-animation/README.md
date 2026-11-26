# caesar-animation — automated 2.5D stickman video pipeline

A story idea goes in and a finished vertical 2.5D stickman video comes out (MP4, 1080×1920, 30 fps, H.264/AAC, burned-in word-by-word captions). The workflow follows the "viral 2.5D stickman with Claude" method:

1. Claude writes a structured story.
2. AI narration is generated.
3. Whisper produces word timestamps.
4. The animation is synced to the words.
5. Sound effects and captions are added, then FFmpeg composes the video.

There's no Blender. Three.js/WebGL builds the scenes, runs the camera and renders frames, in a headless Chromium.

```
idea ──▶ story.json ──▶ voiceover.mp3 ──▶ transcription.json ──▶ captions.ass
          (Claude)       (ElevenLabs)      (faster-whisper)            │
              │               │                   │                    │
              └──────▶ timeline (scene timing + at_word anchors) ──▶ WebGL frames ──▶ final.mp4
                                         + SFX events ───────────────────────────────▲ (FFmpeg)
```

## Quick start

```bash
npm install                      # three.js (the only JS dependency)
pip install -r requirements.txt  # anthropic, jsonschema, requests, numpy, faster-whisper
cp .env.example .env             # add ELEVENLABS_API_KEY (and ANTHROPIC_API_KEY for --idea)

python pipeline.py --input input/story.json            # sample story -> output/final.mp4
python pipeline.py --idea "a stickman vs. his alarm clock"   # Claude writes the story first
python pipeline.py --input input/story.json --preview  # fast 540x960 test -> output/final_preview.mp4
```

System tools: **Node 20+**, **FFmpeg** (with libass, which standard builds include), **Python 3.10+**, and a Chromium for Playwright (`npm i -g playwright && npx playwright install chromium` if you don't have one). You only need `espeak-ng` for the offline placeholder voice.

## Pipeline stages

`pipeline.py` runs the stages in order. Use `--only a,b`, `--from X` or `--to X` to run part of it. Every stage also has its own CLI.

| Stage | What it does | Code | Output |
|---|---|---|---|
| story | Claude writes the story via structured outputs constrained to the story schema, then the full validator runs. Validation errors go back to Claude for a repair (max 2 rounds). | `python/story_generator.py` | `input/story.json` |
| validate | JSON Schema check plus semantic checks: cast ids, cue names, that each `at_word` appears in the narration, that times fall inside their scene, pacing | `python/story_validator.py` | — |
| voiceover | One ElevenLabs clip per scene, sending previous/next text for continuity. Retries 429/5xx, fails fast on 401, caches by text hash. Scenes stretch to fit their narration. | `python/voiceover.py` | `output/audio/voiceover.mp3`, `scene_timing.json`, `scenes/*.mp3` |
| transcribe | faster-whisper word timestamps. Words are validated (ordered, inside the audio) and never invented. Also reports `script_match` against the story text. | `python/transcription.py` | `output/audio/transcription.json` |
| captions | Groups words into chunks of up to 3 and highlights + pops the current word. Styles: `bold_pop`, `boxed`, `minimal`. | `python/captions.py` | `output/captions/captions.ass`, `.srt` |
| sfx | Makes sure every cue file exists; synthesizes any procedural cues that are missing | `python/sfx.py` | `input/assets/sfx/<category>/*.wav` |
| plan | Compiles the absolute timeline and the SFX events (story cues + automatic action/transition cues) | `scripts/plan.mjs` | `output/timeline.json`, `output/audio/sfx_events.json` |
| render | Deterministic WebGL frames from a queue of browser pages. Each frame is written as soon as it's rendered (tmp file + rename). Failed frames are retried and crashed pages recreated. `--resume` continues an interrupted render. | `scripts/render.mjs` | `output/frames/frame_%05d.jpg`, `manifest.json` |
| compose | FFmpeg: frames + voice + timed SFX + optional music (ducked under the voice) + burned captions → H.264 yuv420p / AAC, exact length | `python/compositor.py` | `output/final.mp4` |
| verify | Checks codec, size, fps, exact frame count, audio/video duration (≤ 1 frame apart), clean decode, and no black stretch ≥ 0.5 s | `python/compositor.py` | `output/final.validation.json` |

Useful flags:
- `--tts auto|elevenlabs|local|none`: `auto` uses ElevenLabs when a key is set and the local voice otherwise.
- `--music path.mp3`
- `--caption-style boxed`
- `--workers 4`
- `--force-voice`

## How sync works

- **Scene timing comes from the real audio.** `voiceover.py` measures each narration clip. A scene lasts `max(planned duration, lead-in + clip + tail)`, and the clips are laid on one track at those offsets, so audio and video share one clock.
- **Events anchor to spoken words.** Any action, camera cut, shake, SFX or prop motion can set `at_word`. It then starts exactly when Whisper heard that word inside that scene. Otherwise its `time` (seconds from scene start) is scaled by how much the scene was stretched.
- **Every frame is a pure function of `t`.** `FrameRenderer.renderAt(t)` never reads a clock. Randomness is seeded and camera shake is deterministic noise. `tests/render_test.mjs` checks that the same `t` gives identical pixels in any render order and in a fresh page.

## The engine (`src/`)

| Module | Role |
|---|---|
| `animation/Timeline.js` | Compiles story + timing + words into absolute scenes, actions, camera segments, shakes, SFX and transitions |
| `animation/Animator.js` | 24 actions: `idle, talk, walk, run, jump, fall, get_up, sleep, sit, stand_up, look_around, look_down, point, wave, celebrate, shock, sad, angry, arms_crossed, facepalm, shrug, think, laugh, use_phone`. Uses keyframed poses with 0.2 s blends. The walk/run gait is driven by distance travelled, so feet don't slide. A new action stops an ongoing move where it is. |
| `animation/Keyframes.js` | Easing functions + a keyframe track |
| `characters/Character.js` | Templates and a grounded 2D skeleton solver |
| `characters/CharacterRenderer.js` | Draws the stickman procedurally on a Canvas every frame: outline halo, darker back limbs, accessories (nightcap, cap, tophat, tie, bow, glasses, spiky hair), props in hand. Shown as a camera-facing billboard with a real shadow and a contact shadow. |
| `characters/Expressions.js` | 10 faces: neutral, happy, sad, surprised, angry, scared, thinking, smug, dizzy, sleepy |
| `scene/Environment.js` | `city, street, bedroom, office, outdoor` × lighting `day, sunset, night, indoor_warm, indoor_cool, dramatic` (sky, fog, sun with shadows, practical lights) |
| `scene/Props.js` | 34 procedural low-poly props: bed, desk, bus, car, streetlight, tree, building… |
| `scene/SceneBuilder.js` | Builds a THREE.Scene for each story scene, including prop motion (e.g. the bus driving off) |
| `camera/CameraController.js` | Shots `extreme_wide…extreme_close`; angles `front, low, high, left, right, dutch`; 18 moves including dolly, push, zoom, pan, truck, tilt, crane, orbit, track (lagged follow) and handheld; cut blending; shake; ceiling clamp indoors |
| `rendering/FrameRenderer.js` | Renders at explicit timestamps. Handles fade/flash/whip/zoom transitions and the vignette overlay. |
| `audio/AudioTimeline.js` | Resolves SFX events, and plays them in sync in the browser preview |
| `main.js` | Entry point for `render.html` (headless) and `index.html` (preview) |

Coordinate system: metres, y up, ground at y = 0, and the default camera looks from +z toward −z. Characters act within x −3..3, z −1..1.5. Indoor sets have a back wall at z = −3.3. Furniture heights: bed top y = 0.49, seats ≈ 0.45.

## Story format

`config/story.schema.json` is the contract between Claude, the validator and the engine. Each scene has:
- `scene_id`, `duration`, `narration`, `visual_description`
- `characters`: position, facing, expression, and an initial `action` such as `sleep` or `sit`
- `environment`, `props` (with optional `motion`)
- `actions`: `time` or `at_word`, `duration`, `target`, `expression`, `facing`
- `camera`: `shot`, `target`, `move`, `angle`, `cuts[]`, `shake[]`
- `lighting`, `sound_effects`, `transition` (`cut|fade|flash|whip|zoom`)

See `input/story.json` (a 43.5 s, 8-scene sample) and `input/test_scene.json` (a 6.5 s test).

```json
{ "time": 1.7, "at_word": "Then", "character": "max", "action": "fall", "duration": 1.2, "target": [1.9, 0, 0.4] }
```

## Sound effects and music

`config/sfx.json` maps cue names to files under `input/assets/sfx/<category>/`. The 19 bundled cues (whoosh, thud, pop, ding, boing, record_scratch, alarm_clock, bus_engine, …) are **synthesized by `python/sfx.py`**, so there are no third-party rights involved.

To use Mixkit or Pixabay sounds:
1. Download them yourself, after checking that site's licence terms.
2. Put the file next to the procedural one.
3. Point `file` at it and set `source` and `license`.

The pipeline never downloads assets and never overwrites a non-procedural file. Background music is optional: pass `--music` or set `story.music`. It's looped, trimmed and side-chain ducked under the narration.

## Mobile preview (Android)

```bash
npm run serve        # http://<host>:5173/  (?story=input/story.json&width=540&height=960)
```

`index.html` is a responsive 9:16 player with Play/Pause, scrubbing, scene chips, the voiceover (when generated) and the SFX. It uses the same deterministic renderer, so what you see is what gets rendered. Phones default to 360×640 for speed.

## Where things can run

| Task | Mobile browser / StackBlitz | Cloud terminal (Linux) |
|---|---|---|
| Preview Three.js scenes (`index.html`) | ✅ | ✅ |
| JS unit tests (`npm test`) | ✅ (WebContainer runs Node) | ✅ |
| Offline frame render (`scripts/render.mjs`) | ❌ needs Playwright + Chromium | ✅ |
| Voiceover / Whisper / captions / FFmpeg (Python + native tools) | ❌ | ✅ |

StackBlitz can't run Python, FFmpeg, espeak-ng or a headless Chromium. Use any Linux cloud shell or VM for the full pipeline.

Rendering uses SwiftShader (CPU WebGL) by default. On a GPU machine, set `CHROMIUM_ARGS` (e.g. `--use-angle=vulkan`). Measured on a 4-vCPU cloud container with no GPU: ~10 fps at 540×960, and see `output/frames/manifest.json` → `render_seconds` for 1080×1920.

## Tests

```bash
npm test                                          # 12 unit tests: timeline, animator, camera, schema<->engine enums
npm run test:render                               # 8 WebGL checks: scene loads, character drawn, animation, camera, determinism, frame export
python -m unittest discover -s tests/python -v    # validator, voiceover layout + ElevenLabs retry (mocked), timestamps, captions, SFX
RUN_SLOW=1 python -m unittest discover -s tests/python   # + end-to-end pipeline on the test scene (local voice) incl. music ducking
RUN_LIVE_API=1 python -m unittest ...             # + live ElevenLabs / Claude calls (need keys, cost credits)
```

## Configuration

- `config/settings.json`: resolution, fps, preview size, frame format, workers, shadows, TTS provider and voice settings, Whisper model, caption style and margins, story model/effort
- `config/characters.json`: character templates
- `config/sfx.json`: SFX library + automatic action/transition cues
- `.env`: `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` (never committed)

## Known limits

- Without `ELEVENLABS_API_KEY`, narration uses espeak-ng, which is robotic and only meant for testing timing. Use ElevenLabs for real videos.
- Characters are 2D billboards. They always face the camera, so very side-on or overhead angles look flat by design.
- No lip-sync beyond the `talk` action's mouth flap. Narration is a single voice.
