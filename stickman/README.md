# Animasi Stickman 2.5D

Dari file cerita JSON jadi video pendek vertikal (720×1280): tokoh stickman 2D dengan wajah putih di dunia 3D yang selalu hidup (asap, burung, awan, air, kerumunan), kamera selalu bergerak, dan caption dua kata.

```sh
cd stickman
npm install
npm run sheet    # out/demo/contact.jpg: satu still per shot, cek dulu sebelum render
npm run render   # out/demo/demo.mp4
npm test
```
Cerita lain: `node render.mjs stories/<nama>.json [--sheet]`. Aturan menulis cerita ada di [RULES.md](RULES.md).

Butuh Node 18+, ffmpeg, dan Playwright dengan Chromium (`npm i -g playwright && npx playwright install chromium`). Tidak perlu GPU atau Blender: render jalan di Chromium headless.

## Suara (ElevenLabs)
```sh
ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... npm run render
```
Tiap shot dibuat satu mp3 di `out/<nama>/voice/01.mp3`, `02.mp3`, ... dan panjang shot mengikuti suaranya. File yang sudah ada dipakai ulang, jadi kamu bisa menaruh rekaman sendiri di situ. Tanpa kunci API, video dirender tanpa suara dengan tempo 3,7 kata per detik.

## File
| File | Isi |
| --- | --- |
| `render.mjs` | Suara, timeline, contact sheet, render frame ke ffmpeg |
| `scene.js` | Dunia 3D (three.js), gambar stickman, kamera, caption |
| `lib.mjs` | Validasi cerita dan timing kata |
| `stories/demo.json` | Contoh cerita |
