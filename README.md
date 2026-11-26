# Catur Dua Pemain

Game catur sederhana di browser untuk dua orang yang bergantian main di perangkat yang sama.
Tanpa instalasi dan tanpa dependensi: cukup buka `index.html`.

## Cara main

1. Buka `index.html` di browser (klik dua kali file-nya, atau jalankan server lokal, lihat di bawah).
2. Putih jalan lebih dulu. Klik bidak, lalu klik kotak tujuan. Bisa juga dengan menyeret bidaknya.
3. Titik menandai kotak yang bisa dituju, lingkaran menandai bidak lawan yang bisa dimakan.
4. Saat pion sampai di baris terakhir, pilih bidak promosinya (menteri, benteng, gajah, atau kuda).

Papan juga bisa dimainkan dengan papan ketik: `Tab` untuk masuk ke papan, panah untuk pindah kotak,
`Enter` atau `Spasi` untuk memilih dan menjalankan bidak, `Esc` untuk membatalkan pilihan.

## Fitur

- Semua aturan resmi: rokade (pendek dan panjang), en passant, promosi, skak, skakmat, dan pat.
- Remis otomatis: pat, materi tidak cukup, aturan 50 langkah, dan pengulangan posisi tiga kali.
- Tombol **Batalkan langkah**, **Putar papan**, **Remis** (atas kesepakatan), **Menyerah**, dan **Permainan baru**.
- Opsi memutar papan otomatis setiap ganti giliran, supaya pemain yang sedang jalan selalu di bawah.
- Lembar langkah dengan notasi aljabar figurin (misalnya ♘f3), daftar bidak yang dimakan, dan selisih materi.
- Permainan tersimpan otomatis di browser; memuat ulang halaman tidak menghapus permainan.
- Tampilan terang dan gelap mengikuti pengaturan perangkat, dan menyesuaikan layar ponsel.

## Menjalankan server lokal (opsional)

```sh
npx serve .
# atau
python3 -m http.server
```

## Struktur

| File | Isi |
| --- | --- |
| `index.html` | Kerangka halaman |
| `style.css` | Tampilan (papan, panel, tema terang/gelap) |
| `chess.js` | Mesin aturan catur: langkah legal, skak, skakmat, remis, notasi SAN, FEN |
| `ui.js` | Interaksi: klik/seret bidak, promosi, lembar langkah, tombol, penyimpanan |
| `tests/chess.test.js` | Tes mesin aturan, termasuk perft pada posisi acuan |

## Tes

```sh
npm test
```

Tes memakai test runner bawaan Node (versi 18 ke atas) dan menghitung perft pada posisi-posisi acuan
dari [Chess Programming Wiki](https://www.chessprogramming.org/Perft_Results) untuk memastikan
pembangkitan langkah benar.

## Animasi stickman

Folder [`stickman/`](stickman/README.md) berisi pembuat video animasi stickman 2.5D dari file cerita JSON.
