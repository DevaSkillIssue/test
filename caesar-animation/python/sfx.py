"""Stage H support: sound-effect library.

config/sfx.json maps cue names to files under input/assets/sfx/<category>/. Cues marked
"source": "procedural" are synthesized here with numpy (no third-party rights involved), so
the pipeline works out of the box. To use Mixkit / Pixabay sounds instead, download them
yourself after checking their licence, put the file in the same folder, point "file" at it
and change "source"/"license" - this script never downloads anything and never overwrites
a non-procedural file.

Usage: python python/sfx.py [--force]
"""
from __future__ import annotations

import sys
import wave
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from python.common import get_logger, load_json, path  # noqa: E402

log = get_logger("sfx")
SR = 44100


def _t(dur: float) -> np.ndarray:
    return np.arange(int(SR * dur)) / SR


def _env(n: int, attack: float, decay: float) -> np.ndarray:
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-np.maximum(t - attack, 0) / max(decay, 1e-4))


def _noise(n: int, rng: np.random.Generator) -> np.ndarray:
    return rng.uniform(-1, 1, n)


def _lowpass(x: np.ndarray, cutoff_hz) -> np.ndarray:
    """One-pole low-pass; cutoff may be a scalar or a per-sample array (for sweeps)."""
    cutoff = np.broadcast_to(np.asarray(cutoff_hz, dtype=float), x.shape)
    alpha = 1 - np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += alpha[i] * (x[i] - acc)
        y[i] = acc
    return y


def _sweep(f0: float, f1: float, dur: float, curve: float = 1.0) -> np.ndarray:
    t = _t(dur)
    f = f0 + (f1 - f0) * (t / dur) ** curve
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def synth(cue: str, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    if cue in ("whoosh", "swoosh"):
        dur = 0.55 if cue == "whoosh" else 0.32
        n = int(SR * dur)
        shape = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
        cutoff = 300 + 3500 * shape if cue == "whoosh" else 800 + 6000 * shape
        return _lowpass(_noise(n, rng), cutoff) * shape * 2.5
    if cue == "zip":
        x = np.sign(_sweep(300, 2400, 0.22, 1.5)) * 0.5
        return x * _env(len(x), 0.005, 0.15)
    if cue == "thud":
        t = _t(0.45)
        body = np.sin(2 * np.pi * np.cumsum(90 * np.exp(-t * 6) + 38) / SR) * np.exp(-t * 9)
        click = _lowpass(_noise(len(t), rng), 1500) * np.exp(-t * 60)
        return body + click * 1.5
    if cue == "punch":
        t = _t(0.28)
        return np.sin(2 * np.pi * np.cumsum(160 * np.exp(-t * 15) + 60) / SR) * np.exp(-t * 14) + _noise(len(t), rng) * np.exp(-t * 45) * 0.8
    if cue == "crash":
        t = _t(1.1)
        metal = sum(np.sin(2 * np.pi * f * t) for f in (523, 787, 1231, 1873)) / 4
        return _noise(len(t), rng) * np.exp(-t * 4) * 0.9 + metal * np.exp(-t * 3) * 0.4
    if cue == "pop":
        x = _sweep(380, 950, 0.09)
        return x * _env(len(x), 0.002, 0.03)
    if cue in ("ding", "notification"):
        t = _t(1.2)
        tones = (1320,) if cue == "ding" else (880, 1320)
        out = np.zeros_like(t)
        for k, f in enumerate(tones):
            tt = np.clip(t - k * 0.14, 0, None)
            out += (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt)) * np.exp(-tt * 4) * (t >= k * 0.14)
        return out
    if cue == "click":
        t = _t(0.03)
        return _noise(len(t), rng) * np.exp(-t * 300)
    if cue == "boing":
        t = _t(0.7)
        f = 170 + 120 * t / 0.7 + 60 * np.sin(2 * np.pi * 9 * t) * np.exp(-t * 4)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(len(t), 0.005, 0.35)
    if cue in ("slide_whistle_down", "slide_whistle_up"):
        t = _t(0.75)
        f0, f1 = (1500, 380) if cue.endswith("down") else (380, 1500)
        f = f0 + (f1 - f0) * (t / 0.75) + 25 * np.sin(2 * np.pi * 6 * t)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.75) ** 0.5
    if cue == "record_scratch":
        t = _t(0.55)
        mod = np.abs(np.sin(2 * np.pi * 7 * t))
        return _lowpass(_noise(len(t), rng), 600 + 4000 * mod) * (0.4 + mod) * np.exp(-t * 2)
    if cue == "alarm_clock":
        t = _t(1.4)
        gate = (np.sin(2 * np.pi * 14 * t) > 0) * (np.sin(2 * np.pi * 1.6 * t) > -0.3)
        return np.sign(np.sin(2 * np.pi * 2100 * t)) * gate * 0.35
    if cue == "phone_buzz":
        t = _t(0.9)
        gate = ((t < 0.35) | ((t > 0.5) & (t < 0.85))).astype(float)
        saw = 2 * ((150 * t) % 1) - 1
        return _lowpass(saw, 900) * gate
    if cue == "car_horn":
        t = _t(0.6)
        x = np.sign(np.sin(2 * np.pi * 405 * t)) + np.sign(np.sin(2 * np.pi * 510 * t))
        return _lowpass(x * 0.4, 2500) * _env(len(t), 0.01, 2.0) * (t < 0.55)
    if cue == "city_ambience":
        t = _t(6.0)
        brown = np.cumsum(_noise(len(t), rng))
        brown = brown - _lowpass(brown, 20)  # remove DC drift
        return _lowpass(brown / (np.abs(brown).max() + 1e-9), 900) * np.minimum(1, np.minimum(t, 6 - t) / 0.5)
    if cue == "bus_engine":
        t = _t(3.0)
        saw = 2 * ((48 * t) % 1) - 1
        rumble = _lowpass(saw + 0.4 * _noise(len(t), rng), 400)
        return rumble * np.minimum(1, t / 0.3) * np.minimum(1, (3 - t) / 0.8)
    raise ValueError(f"no synthesizer for cue '{cue}'")


def write_wav(file: Path, samples: np.ndarray, peak_db: float = -1.0) -> None:
    peak = np.abs(samples).max()
    if not np.isfinite(peak) or peak == 0:
        raise ValueError(f"synthesized silence or NaN for {file}")
    samples = samples / peak * (10 ** (peak_db / 20))
    fade = min(len(samples), int(SR * 0.004))  # avoid clicks at the edges
    samples[:fade] *= np.linspace(0, 1, fade)
    samples[-fade:] *= np.linspace(1, 0, fade)
    file.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(file), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((samples * 32767).astype("<i2").tobytes())


def ensure_library(force: bool = False) -> dict:
    """Synthesize missing procedural cues. Returns {cue: absolute path} for files that exist."""
    lib = load_json("config/sfx.json")["cues"]
    available = {}
    for i, (cue, spec) in enumerate(sorted(lib.items())):
        f = path(spec["file"])
        if spec.get("source") == "procedural" and (force or not f.exists()):
            write_wav(f, synth(cue, seed=i))
            log.info("synthesized %s -> %s", cue, spec["file"])
        if f.exists():
            available[cue] = f
        else:
            log.warning("cue %s: file %s is missing (source=%s); it will be skipped", cue, spec["file"], spec.get("source"))
    log.info("sfx library ready: %d/%d cues available", len(available), len(lib))
    return available


if __name__ == "__main__":
    ensure_library(force="--force" in sys.argv)
