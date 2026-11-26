"""Stage A: story generation with Claude.

Sends the story idea to the Claude API with structured outputs constrained to
config/story.schema.json, then runs the full validator (schema + semantic checks). If the
story has semantic problems, the errors are sent back and Claude returns a corrected story
(up to `repair_rounds` times). Only a story that validates is written to disk.

Requires ANTHROPIC_API_KEY (or another credential the Anthropic SDK resolves).
Usage: python python/story_generator.py "a stickman tries to be productive" [--out input/story.json]
"""
from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path

import anthropic

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from python.common import StageError, get_logger, load_dotenv, load_json, load_settings, save_json  # noqa: E402
from python.story_validator import validate_story  # noqa: E402

log = get_logger("story")

# Constraint keywords the structured-output endpoint does not accept; they stay enforced locally.
UNSUPPORTED = {"minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minLength", "maxLength", "minItems", "maxItems", "pattern", "$id", "$schema"}


def api_schema(schema: dict) -> dict:
    def strip(node):
        if isinstance(node, dict):
            return {k: strip(v) for k, v in node.items() if k not in UNSUPPORTED}
        if isinstance(node, list):
            return [strip(v) for v in node]
        return node
    return strip(copy.deepcopy(schema))


SYSTEM = """You are the head writer and director of a channel that makes viral vertical (9:16) 2.5D stickman animations: flat expressive stickmen acting inside simple 3D sets, narrated by one voice, 35-45 seconds long.

Write tight, funny, visual stories:
- Scene 1 opens with the hook as its first sentence. Every later line escalates; end on a punchline or twist plus a short call to action.
- 6-9 scenes, 3-7 seconds each. Narration ~2.5 words per second (count them). Spoken English, short sentences, no stage directions in narration.
- Every scene needs a visual joke or clear story beat that the actions SHOW (falls, double-takes, reactions, a prop doing something), not just characters standing.
- Actions follow narration timing: anchor key beats with at_word (a word that literally appears in that scene's narration) and keep `time` as the fallback.
- Use purposeful camera: wide to establish, medium for action, close/extreme_close for reactions; track moving characters; shake on impacts; at most 2 cuts per scene; vary angles (low for heroic/absurd moments, high for defeat).
- Stage layout (metres): characters act within x -3..3, z -1..1.5, y = 0 unless sitting/lying on furniture (bed top y=0.49, chair seat y=0.45). Default camera looks from +z toward -z. Indoor sets have a back wall at z = -3.3.
- Bedroom has no bed by default: add props you need (e.g. bed at [-1.5, 0, -1.4]).
- Moving actions (walk, run, jump, fall) take a `target` position; walk speed ~1.3 m/s, run ~3.5 m/s.
- Use `sleep` or `sit` in a scene's character `action` for the state they start in.
- Expressions persist once set on an action, so set them on reactions.
- Sound effects: use only cue names from the provided list; time them to impacts and reveals.
- transition: cut for fast comedy, whip/zoom for energy, fade for time skips, flash for reveals.
Return only the JSON object."""


def catalog() -> str:
    schema = load_json("config/story.schema.json")
    d = schema["$defs"]
    sfx = load_json("config/sfx.json")["cues"]
    templates = {k: v for k, v in load_json("config/characters.json").items() if not k.startswith("_")}
    return "\n".join([
        "Available building blocks:",
        f"- actions: {', '.join(d['action_name']['enum'])}",
        f"- expressions: {', '.join(d['expression']['enum'])}",
        f"- shots: {', '.join(d['shot']['enum'])}; angles: {', '.join(d['angle']['enum'])}",
        f"- camera moves: {', '.join(d['move']['enum'])}",
        f"- props: {', '.join(d['prop_type']['enum'])}",
        f"- environments: {', '.join(d['scene']['properties']['environment']['enum'])}; lighting: {', '.join(d['scene']['properties']['lighting']['enum'])}",
        f"- sound effect cues: {', '.join(sorted(sfx))}",
        "- character templates: " + "; ".join(f"{k} ({v['accessory']}, {v['color']})" for k, v in templates.items()),
    ])


def generate_story(idea: str, out_path: str = "input/story.json", repair_rounds: int = 2) -> dict:
    load_dotenv()
    cfg = load_settings()["story"]
    schema = api_schema(load_json("config/story.schema.json"))
    example = json.dumps(load_json("input/test_scene.json"), separators=(",", ":"))
    client = anthropic.Anthropic()
    messages = [{
        "role": "user",
        "content": f"{catalog()}\n\nFormat example (a tiny 2-scene test, NOT a style reference):\n{example}\n\n"
                   f"Story idea: {idea}\nTarget total duration: about {cfg['target_seconds']} seconds. Pick a seed integer.",
    }]
    for attempt in range(repair_rounds + 1):
        log.info("requesting story from %s (attempt %d)", cfg["model"], attempt + 1)
        try:
            with client.beta.messages.stream(
                model=cfg["model"],
                max_tokens=cfg["max_tokens"],
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",  # a refused request is retried on a fallback model server-side
                system=SYSTEM,
                output_config={"effort": cfg["effort"], "format": {"type": "json_schema", "schema": schema}},
                messages=messages,
            ) as stream:
                msg = stream.get_final_message()
        except anthropic.AuthenticationError as e:
            raise StageError("Claude API authentication failed: set ANTHROPIC_API_KEY in .env or the environment") from e
        except anthropic.RateLimitError as e:
            raise StageError(f"Claude API rate limit: {e}") from e
        except anthropic.APIStatusError as e:
            raise StageError(f"Claude API error {e.status_code}: {e.message}") from e
        except anthropic.APIConnectionError as e:
            raise StageError(f"cannot reach the Claude API: {e}") from e
        except TypeError as e:  # no credentials configured at all
            raise StageError(f"no Claude credentials: set ANTHROPIC_API_KEY ({e})") from e

        if msg.stop_reason == "refusal":
            raise StageError("Claude declined to write this story; try a different idea")
        if msg.stop_reason == "max_tokens":
            raise StageError("story output hit max_tokens; raise story.max_tokens in config/settings.json")
        text = next((b.text for b in msg.content if b.type == "text"), "")
        try:
            story = json.loads(text)
        except json.JSONDecodeError as e:
            raise StageError(f"Claude returned unparseable JSON: {e}") from e

        errors, warnings = validate_story(story)
        for w in warnings:
            log.warning("story: %s", w)
        if not errors:
            save_json(out_path, story)
            log.info("wrote %s: '%s', %d scenes", out_path, story["title"], len(story["scenes"]))
            return story
        log.warning("story failed validation (%d errors), asking for a repair", len(errors))
        messages += [
            {"role": "assistant", "content": msg.content},
            {"role": "user", "content": "The story failed validation. Fix every error and return the complete corrected story:\n- " + "\n- ".join(errors)},
        ]
    raise StageError("Claude could not produce a valid story:\n- " + "\n- ".join(errors))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("idea")
    ap.add_argument("--out", default="input/story.json")
    a = ap.parse_args()
    try:
        generate_story(a.idea, a.out)
    except StageError as e:
        log.error(str(e))
        sys.exit(1)
