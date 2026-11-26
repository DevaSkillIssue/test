# Aturan menulis cerita (untuk Claude)

Minta Claude: "Tulis cerita baru ke `stories/<nama>.json` mengikuti `RULES.md`", lalu jalankan `npm run sheet` dulu, baru `npm run render`.

## Naskah
- Hook di kalimat pertama: konflik atau keanehan langsung, tanpa basa-basi.
- Satu shot = satu klausa pendek (4–12 kata). Kecepatan narasi sekitar 3,7 kata per detik, jadi shot rata-rata ~2 detik.
- Tiap klausa harus bisa diperankan. Kalau tidak bisa diperankan, tulis ulang kalimatnya.
- Ucapan tokoh pakai tanda kutip dan isi `speaker`, supaya mulutnya bergerak.

## Gambar
- Tiap shot punya aksi (`action`) dan gerak kamera (`camera`). Jangan pakai kamera diam.
- Tokoh melakukan persis apa yang dikatakan narator di kata itu (menunjuk → `point`, lari → `run`, bingung → `shrug`).
- Ekspresi berubah: isi `face` dengan 2 ekspresi (misalnya `["shock","angry"]`), berganti tiap 0,3–0,8 detik.
- Setidaknya seperempat shot berisi 3 tokoh atau lebih (kerumunan latar di `village` ikut dihitung).
- Tiap kata benda penting muncul sebagai `props` (guci, koin, peti, batu, kotak; kata lain jadi papan nama).
- Ganti `set` saat cerita pindah tempat.

## Format
```json
{
  "cast": { "budi": { "color": "#3b6fb6", "hat": "cap" } },
  "shots": [{
    "text": "kalimat narasi",
    "set": "village | room | field",
    "camera": "push_in | pull_out | pan_left | pan_right | orbit | crane_up | low_angle | shake",
    "focus": "id tokoh yang diikuti kamera",
    "speaker": "id tokoh yang bicara",
    "actors": [{ "id": "budi", "x": 0, "to": 2, "z": 0, "facing": "left",
                 "action": "idle | walk | run | point | wave | shrug | cheer | jump | think",
                 "face": "neutral | happy | sad | angry | shock | scared | smirk" }],
    "props": [{ "name": "guci", "x": 1 }]
  }]
}
```
`hat`: `cap`, `crown`, `hair`, atau kosong. `x` antara -2 dan 2 supaya tetap di dalam frame vertikal.
