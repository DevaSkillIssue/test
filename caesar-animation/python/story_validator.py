"""Stage A/L support: strict validation of story.json.

Two layers:
1. JSON Schema (config/story.schema.json) - structure, types, enums.
2. Semantic checks - cross references the schema cannot express (cast ids, cue names,
   at_word present in the narration, event times inside their scene, pacing).

Usage: python python/story_validator.py input/story.json
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import jsonschema

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from python.common import StageError, get_logger, load_json, path  # noqa: E402

log = get_logger("validate")
MOVING = {"walk", "run"}


def _norm(word: str) -> str:
    return re.sub(r"[^a-z0-9]", "", word.lower())


def validate_story(story: dict) -> tuple[list[str], list[str]]:
    """Return (errors, warnings). An empty error list means the engine can render the story."""
    schema = load_json("config/story.schema.json")
    templates = load_json("config/characters.json")
    sfx = load_json("config/sfx.json")["cues"]

    errors: list[str] = []
    warnings: list[str] = []
    validator = jsonschema.Draft202012Validator(schema)
    for err in sorted(validator.iter_errors(story), key=lambda e: list(e.absolute_path)):
        loc = "/".join(str(p) for p in err.absolute_path) or "(root)"
        errors.append(f"schema: {loc}: {err.message}")
    if errors:
        return errors, warnings  # semantic checks assume a structurally valid document

    cast_ids = [c["id"] for c in story["cast"]]
    if len(set(cast_ids)) != len(cast_ids):
        errors.append("cast: duplicate character ids")
    for c in story["cast"]:
        if c["template"] not in templates:
            errors.append(f"cast {c['id']}: unknown template {c['template']}")

    scene_ids = [s["scene_id"] for s in story["scenes"]]
    if len(set(scene_ids)) != len(scene_ids):
        errors.append("scenes: duplicate scene_id")

    total = sum(s["duration"] for s in story["scenes"])
    if total > 180:
        errors.append(f"total planned duration {total:.1f}s exceeds 180s")
    elif not 33 <= total <= 47:
        warnings.append(f"total planned duration {total:.1f}s (target is 35-45s)")

    first = _norm(story["scenes"][0]["narration"])
    if _norm(story["hook"])[:40] not in first:
        warnings.append("hook is not spoken in the first scene's narration")

    if story.get("music") and not path(story["music"]).exists():
        warnings.append(f"music file {story['music']} not found; video will have no music")

    for s in story["scenes"]:
        sid, dur = s["scene_id"], s["duration"]
        where = f"scene {sid}"
        words = {_norm(w) for w in s["narration"].split()}
        n_words = len(s["narration"].split())
        if n_words / dur > 3.6:
            warnings.append(f"{where}: {n_words} words in {dur}s is fast narration; the scene will be stretched to fit the voice")

        chars = [c["id"] for c in s["characters"]]
        if len(set(chars)) != len(chars):
            errors.append(f"{where}: a character appears twice")
        for c in s["characters"]:
            if c["id"] not in cast_ids:
                errors.append(f"{where}: character {c['id']} is not in the cast")
            x, _, z = c["position"]
            if abs(x) > 8 or not -4 <= z <= 4:
                warnings.append(f"{where}: {c['id']} starts far off-stage at {c['position']}")

        def check_time(t, at_word, what):
            if t > dur:
                errors.append(f"{where}: {what} at {t}s is after the scene ends ({dur}s)")
            if at_word is not None and _norm(at_word.split()[0]) not in words:
                errors.append(f"{where}: {what} at_word '{at_word}' does not appear in the narration")

        for a in s["actions"]:
            what = f"action {a['action']} ({a['character']})"
            if a["character"] not in chars:
                errors.append(f"{where}: {what} uses a character not placed in the scene")
            check_time(a["time"], a.get("at_word"), what)
            if a["action"] in MOVING and "target" not in a:
                warnings.append(f"{where}: {what} has no target; the character will move in place")

        cam = s["camera"]
        targets = set(chars) | {"group"}
        if cam["target"] not in targets:
            errors.append(f"{where}: camera target {cam['target']} is not a character in the scene (or 'group')")
        for c in cam.get("cuts", []):
            check_time(c["time"], c.get("at_word"), f"camera cut to {c['shot']}")
            if c.get("target") and c["target"] not in targets:
                errors.append(f"{where}: camera cut target {c['target']} is not in the scene")
        for sh in cam.get("shake", []):
            check_time(sh["time"], sh.get("at_word"), "camera shake")

        for fx in s["sound_effects"]:
            if fx["cue"] not in sfx:
                errors.append(f"{where}: sound effect cue '{fx['cue']}' is not in config/sfx.json")
            check_time(fx["time"], fx.get("at_word"), f"sfx {fx['cue']}")
        for p in s["props"]:
            if "motion" in p:
                check_time(p["motion"]["time"], p["motion"].get("at_word"), f"prop {p['type']} motion")
    return errors, warnings


def validate_file(story_path: str) -> dict:
    story = load_json(story_path)
    errors, warnings = validate_story(story)
    for w in warnings:
        log.warning(w)
    if errors:
        raise StageError(f"{story_path} is invalid:\n  - " + "\n  - ".join(errors))
    log.info("%s is valid: %d scenes, %.1fs planned", story_path, len(story["scenes"]), sum(s["duration"] for s in story["scenes"]))
    return story


if __name__ == "__main__":
    try:
        validate_file(sys.argv[1] if len(sys.argv) > 1 else "input/story.json")
    except StageError as e:
        log.error(str(e))
        sys.exit(1)
