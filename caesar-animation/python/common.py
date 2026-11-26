"""Shared helpers for the Python pipeline stages: paths, settings, logging, subprocess, ffprobe."""
from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class StageError(RuntimeError):
    """A pipeline stage failed in a way the user must fix (bad input, missing tool, API error)."""


def path(p: str | os.PathLike) -> Path:
    p = Path(p)
    return p if p.is_absolute() else ROOT / p


def load_json(p: str | os.PathLike):
    try:
        return json.loads(path(p).read_text(encoding="utf-8"))
    except FileNotFoundError as e:
        raise StageError(f"file not found: {p}") from e
    except json.JSONDecodeError as e:
        raise StageError(f"invalid JSON in {p}: {e}") from e


def save_json(p: str | os.PathLike, data) -> Path:
    target = path(p)
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(target.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(target)  # atomic: never leave a half-written JSON behind
    return target


def load_settings() -> dict:
    return load_json("config/settings.json")


def load_dotenv(p: str | os.PathLike = ".env") -> None:
    """Load KEY=VALUE lines from .env into os.environ (existing variables win). No dependency."""
    f = path(p)
    if not f.exists():
        return
    for line in f.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def get_logger(name: str) -> logging.Logger:
    if not logging.getLogger().handlers:
        logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"), format="[%(asctime)s] %(name)s: %(message)s", datefmt="%H:%M:%S")
    return logging.getLogger(name)


def require_tool(name: str) -> str:
    exe = shutil.which(name)
    if not exe:
        raise StageError(f"required tool '{name}' is not installed or not on PATH")
    return exe


def run(cmd: list[str], *, cwd: Path | None = None, capture: bool = True) -> subprocess.CompletedProcess:
    """Run a command; raise StageError with the tail of stderr on failure."""
    proc = subprocess.run(cmd, cwd=cwd or ROOT, capture_output=capture, text=True)
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "")[-2000:]
        raise StageError(f"command failed ({proc.returncode}): {' '.join(map(str, cmd[:6]))} ...\n{tail}")
    return proc


def media_duration(p: str | os.PathLike) -> float:
    """Container duration in seconds via ffprobe."""
    require_tool("ffprobe")
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path(p))]).stdout
    try:
        return float(json.loads(out)["format"]["duration"])
    except (KeyError, ValueError) as e:
        raise StageError(f"cannot read duration of {p}") from e
