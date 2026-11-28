# SFX cue sheet + mix for "Banjir Bir London 1814" (ElevenLabs SFX).
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
    word, k = (word.split("#") + ["1"])[:2]
    hits = [w["s"] for w in words if w["beat"] == beat and norm(w["w"]) == norm(word)]
    return hits[int(k) - 1]

# name, beat, word (k-th occurrence), offset (s), gain (dB), align
CUES = [
    ("torrent", 1, "Tahun", 0.0, -14, "start"),      # hook: the lane already under beer
    ("boom", 1, "tewas", -0.1, -10, "start"),       # eight dead
    ("brewery", 2, "Pabrik", -0.1, -14, "start"),   # inside the brewery
    ("creak", 4, "merosot", -0.4, -9, "start"),     # the hoop slips, the vat groans
    ("burst", 5, "meledak", -0.05, -3, "peak"),     # the vat bursts
    ("torrent", 6, "memecahkan", -0.1, -6, "start"),# the wave hits the next vats
    ("collapse", 7, "menjebol", -0.1, -6, "start"), # wall and houses go down
    ("cellar", 8, "membanjiri", -0.2, -8, "start"), # beer fills the cellar
    ("boom", 9, "Sayangnya", -0.1, -10, "start"),   # eight neighbours did not
    ("button", 11, "lepas", 0.0, -6, "peak"),       # first button
    ("button", 11, "lepas#2", 0.0, -6, "peak"),     # second button
    ("gavel", 12, "tidak", 0.0, -6, "peak"),        # nobody to blame
    ("concrete", 13, "beton", -0.1, -6, "peak"),    # concrete tank set down
    ("coins", 14, "uang", 0.0, -6, "peak"),         # the brewery gets paid
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
