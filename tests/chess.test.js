// Jalankan dengan: npm test (atau node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, START_FEN } = require('../chess.js');

// Angka perft acuan dari https://www.chessprogramming.org/Perft_Results
const PERFT = [
  { name: 'posisi awal', fen: START_FEN, counts: [20, 400, 8902, 197281] },
  { name: 'kiwipete', fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', counts: [48, 2039, 97862] },
  { name: 'posisi 3', fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', counts: [14, 191, 2812, 43238] },
  { name: 'posisi 4', fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', counts: [6, 264, 9467] },
  { name: 'posisi 4 (cermin)', fen: 'r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1', counts: [6, 264, 9467] },
  { name: 'posisi 5', fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', counts: [44, 1486, 62379] },
  { name: 'posisi 6', fen: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', counts: [46, 2079, 89890] },
];

for (const { name, fen, counts } of PERFT) {
  test(`perft ${name}`, () => {
    const g = new Game(fen);
    counts.forEach((expected, i) => {
      assert.equal(g.perft(i + 1), expected, `kedalaman ${i + 1}`);
    });
    assert.equal(g.fen(), fen, 'posisi kembali utuh setelah perft');
  });
}

function play(moves, fen) {
  const g = new Game(fen);
  for (const san of moves) {
    assert.ok(g.move(san), `langkah ${san} harus legal di ${g.fen()}`);
  }
  return g;
}

test('skakmat cepat (Scholar\'s mate)', () => {
  const g = play(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']);
  const s = g.status();
  assert.equal(s.reason, 'checkmate');
  assert.equal(s.winner, 'w');
  assert.equal(s.result, '1-0');
  assert.equal(g.history().at(-1).san, 'Qxf7#');
});

test('pat', () => {
  const g = new Game('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  assert.equal(g.status().reason, 'stalemate');
  assert.equal(g.status().result, '1/2-1/2');
});

test('notasi SAN: disambiguasi, makan, skak, promosi, rokade', () => {
  const g = new Game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const sans = g.moves().map((m) => m.san);
  assert.ok(sans.includes('O-O'));
  assert.ok(sans.includes('O-O-O'));
  assert.ok(sans.includes('Rxa8+'));
  assert.ok(sans.includes('Rxh8+'));

  const knights = new Game('k7/8/8/8/8/8/8/1N1N2K1 w - - 0 1');
  assert.ok(knights.moves().some((m) => m.san === 'Nbc3'));
  assert.ok(knights.moves().some((m) => m.san === 'Ndc3'));

  const rooks = new Game('7k/8/R7/8/8/8/8/R5K1 w - - 0 1');
  assert.ok(rooks.moves().some((m) => m.san === 'R6a3'));
  assert.ok(rooks.moves().some((m) => m.san === 'R1a3'));

  const queens = new Game('8/7k/8/8/Q1Q5/8/Q7/6K1 w - - 0 1');
  assert.ok(queens.moves().some((m) => m.san === 'Qa4b3'), queens.moves().map((m) => m.san).join(' '));

  const promo = new Game('3r3k/2P5/8/8/8/8/8/6K1 w - - 0 1');
  const promoSans = promo.moves().filter((m) => m.piece === 'P').map((m) => m.san).sort();
  assert.deepEqual(promoSans, ['c8=B', 'c8=N', 'c8=Q', 'c8=R', 'cxd8=B', 'cxd8=N', 'cxd8=Q+', 'cxd8=R+']);
});

test('en passant: legal, menghapus pion, dan bisa dibatalkan', () => {
  const g = play(['e4', 'a6', 'e5', 'd5']);
  const ep = g.moves().find((m) => m.enPassant);
  assert.ok(ep, 'en passant tersedia');
  assert.equal(ep.san, 'exd6');
  g.move('exd6');
  assert.equal(g.get('d5'), null, 'pion d5 termakan');
  assert.equal(g.get('d6'), 'P');
  g.undo();
  assert.equal(g.get('d5'), 'p');
  assert.equal(g.get('e5'), 'P');
  // Hak en passant hilang bila tidak dipakai langsung.
  g.move('Nf3');
  g.move('Nf6');
  assert.equal(g.moves().some((m) => m.enPassant), false);
});

test('en passant terlarang bila membuka skak pada raja sendiri', () => {
  const g = new Game('8/8/8/K2Pp2r/8/8/8/7k w - e6 0 1');
  assert.equal(g.moves().some((m) => m.enPassant), false);
});

test('rokade: tidak boleh saat skak, melewati kotak diserang, atau setelah raja/benteng bergerak', () => {
  assert.equal(new Game('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1').moves().filter((m) => m.castle).length, 2);
  // Raja diskak.
  assert.equal(new Game('4k3/4r3/8/8/8/8/8/R3K2R w KQ - 0 1').moves().some((m) => m.castle), false);
  // f1 diserang: rokade pendek terlarang, panjang boleh.
  const f1 = new Game('4k3/5r2/8/8/8/8/8/R3K2R w KQ - 0 1').moves().filter((m) => m.castle).map((m) => m.castle);
  assert.deepEqual(f1, ['q']);
  // b1 diserang tidak menghalangi rokade panjang.
  const b1 = new Game('4k3/1r6/8/8/8/8/8/R3K2R w KQ - 0 1').moves().filter((m) => m.castle).map((m) => m.castle).sort();
  assert.deepEqual(b1, ['k', 'q']);
  // Benteng h1 bergerak lalu kembali: hak rokade pendek hilang.
  const g = play(['Rh2', 'Kd8', 'Rh1', 'Ke8'], '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1');
  assert.deepEqual(g.moves().filter((m) => m.castle).map((m) => m.castle), ['q']);
  // Benteng dimakan di sudutnya: hak rokade pihak itu hilang.
  const cap = play(['Rxh8+'], 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  assert.equal(cap.fen().split(' ')[2], 'Qq');
});

test('rokade memindahkan benteng dan bisa dibatalkan', () => {
  const g = new Game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  g.move('O-O');
  assert.equal(g.get('g1'), 'K');
  assert.equal(g.get('f1'), 'R');
  assert.equal(g.get('h1'), null);
  g.move('O-O-O');
  assert.equal(g.get('c8'), 'k');
  assert.equal(g.get('d8'), 'r');
  assert.equal(g.fen(), '2kr3r/8/8/8/8/8/8/R4RK1 w - - 2 2');
  g.undo();
  g.undo();
  assert.equal(g.fen(), 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
});

test('promosi lewat objek langkah; tanpa pilihan bidak ditolak', () => {
  const g = new Game('8/P6k/8/8/8/8/8/K7 w - - 0 1');
  assert.equal(g.move({ from: 'a7', to: 'a8' }), null);
  const m = g.move({ from: 'a7', to: 'a8', promotion: 'n' });
  assert.equal(m.san, 'a8=N');
  assert.equal(g.get('a8'), 'N');
  g.undo();
  assert.equal(g.get('a7'), 'P');
});

test('materi tidak cukup', () => {
  const dead = [
    '8/8/8/4k3/8/8/8/4K3 w - - 0 1',
    '8/8/8/4k3/8/8/8/4KB2 w - - 0 1',
    '8/8/8/4k3/8/8/8/4KN2 w - - 0 1',
    '8/8/8/3bk3/8/8/8/4KB2 w - - 0 1', // gajah d5 dan f1 sama-sama di kotak terang
  ];
  const alive = [
    '8/8/8/2b1k3/8/8/8/4KB2 w - - 0 1', // gajah c5 (gelap) dan f1 (terang)
    '8/8/8/3nk3/8/8/8/4KN2 w - - 0 1',
    '8/8/8/4k3/8/8/8/3NKN2 w - - 0 1',
    '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1',
  ];
  for (const fen of dead) assert.equal(new Game(fen).status().reason, 'insufficient', fen);
  for (const fen of alive) assert.equal(new Game(fen).status().over, false, fen);
});

test('pengulangan tiga kali', () => {
  const g = play(['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1']);
  assert.equal(g.status().over, false);
  g.move('Ng8');
  assert.equal(g.status().reason, 'threefold');
  g.undo();
  assert.equal(g.status().over, false);
});

test('pengulangan: kotak en passant yang tidak bisa dipakai tidak membedakan posisi', () => {
  // Setelah 1.e4 tidak ada pion hitam yang bisa makan en passant di e3,
  // jadi posisi itu sama dengan posisi yang sama tanpa kotak en passant.
  const g = play(['e4', 'Nf6', 'Nf3', 'Ng8', 'Ng1', 'Nf6', 'Nf3', 'Ng8', 'Ng1']);
  assert.equal(g.status().reason, 'threefold');
});

test('aturan 50 langkah, tetapi skakmat tetap didahulukan', () => {
  const g = new Game('8/8/8/4k3/8/8/8/R3K3 w - - 99 80');
  g.move('Ra2');
  assert.equal(g.status().reason, 'fifty');
  const mate = new Game('7k/8/6K1/8/8/8/8/R7 w - - 99 80');
  mate.move('Ra8#');
  assert.equal(mate.status().reason, 'checkmate');
});

test('langkah ilegal ditolak dan kondisi tidak berubah', () => {
  const g = new Game();
  assert.equal(g.move('e5'), null);
  assert.equal(g.move({ from: 'e1', to: 'e2' }), null);
  assert.equal(g.move('Ke2'), null);
  assert.equal(g.fen(), START_FEN);
  // Bidak yang terpaku tidak boleh meninggalkan garis raja.
  const pinned = new Game('4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1');
  assert.equal(pinned.moves({ square: 'e2' }).length, 0);
});

test('FEN tidak valid ditolak', () => {
  for (const fen of [
    '', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w KQkq - 0 1',
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1',
    '8/8/8/8/8/8/8/8 w - - 0 1',
    '4k3/8/8/8/8/8/8/4K2R w KQkq e3 0 1',
  ]) {
    assert.throws(() => new Game(fen), /FEN tidak valid/, fen);
  }
});

test('notasi koordinat dan riwayat', () => {
  const g = new Game();
  assert.ok(g.move('e2e4'));
  assert.ok(g.move('e7e5'));
  assert.deepEqual(g.history().map((m) => m.lan), ['e2e4', 'e7e5']);
  assert.deepEqual(g.history().map((m) => m.san), ['e4', 'e5']);
  assert.equal(g.fen(), 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2');
});
