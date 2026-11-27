# SFX cue sheet + mix for "Dokter yang Diejek karena Cuci Tangan".
# Each cue is anchored to a narration word (voice/words.json), so a new voice re-times the sound too.
# "peak" cues land the clip's transient (first sample above 50 % of its peak) ON the event; "start" cues begin there.
# Mix: voice unchanged, SFX at -6 dB (ambiences lower), summed, then a peak limiter so nothing clips.
# usage: python mix.py <film.mp4> <out.mp4>
import json, subprocess, sys, os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
words = json.load(open(os.path.join(HERE, "../voice/words.json")))
norm = lambda w: "".join(c for c in w.lower() if c.isalnum())
def at(beat, word):
    return next(w["s"] for w in words if w["beat"] == beat and norm(w["w"]) == norm(word))

# name, beat, word, offset (s), gain (dB), align
CUES = [
    ("splash", 1, "merendam", 0.14, -6, "peak"),    # hand enters the basin
    ("grumble", 1, "marah", -0.1, -8, "start"),     # colleagues furious
    ("street", 2, "Di", -0.07, -14, "start"),       # outside the hospital
    ("candle", 3, "meninggal", 0.15, -4, "peak"),   # one candle dies
    ("scalpel", 5, "tergores", 0.0, -6, "peak"),    # the knife slips
    ("boom", 5, "meninggal", 0.0, -9, "start"),     # his friend dies
    ("sting", 6, "sadar", -0.15, -9, "start"),      # he realises
    ("steps", 6, "membedah", 0.05, -10, "start"),   # doctor walks to the bed
    ("wash", 8, "Jadi", 0.1, -8, "start"),          # the washing rule
    ("whoosh", 8, "anjlok", -0.15, -8, "start"),    # the chart drops
    ("scoff", 9, "tersinggung", -0.1, -8, "start"), # offended doctors
    ("book", 10, "terhormat", 0.0, -5, "peak"),     # the book slams
    ("candle", 13, "infeksi", 0.25, -4, "peak"),    # his candle dies
    ("wash", 14, "cuci", -0.2, -8, "start"),        # today: every doctor washes
]

def load(path):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()

film, out = sys.argv[1], sys.argv[2]
voice = load(film)
bed = np.zeros_like(voice)
for name, beat, word, off, db, align in CUES:
    x = load(os.path.join(HERE, name + ".mp3"))
    x *= 10 ** (db / 20) / max(1e-6, np.abs(x).max())  # every clip normalised to peak, then its cue gain
    onset = int(np.argmax(np.abs(x) > 0.5 * np.abs(x).max())) if align == "peak" else 0
    s = int((at(beat, word) + off) * SR) - onset
    a, b = max(0, s), min(len(bed), s + len(x))
    if b > a: bed[a:b] += x[a - s:b - s]
    print(f"{name:8s} line {beat:2d} '{word}' @ {(s + onset) / SR:6.2f}s  {db} dB")
mix = voice + bed
mix /= max(1.0, np.abs(mix).max() / 0.98)  # limiter: only kicks in if the sum would clip
raw = mix.astype(np.float32).tobytes()
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", film, "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", out], input=raw, check=True)
print("->", out)
