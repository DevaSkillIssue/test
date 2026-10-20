/*
 * Mesin aturan catur tanpa dependensi.
 *
 * Papan disimpan sebagai array 64 kotak: indeks 0 = a8, 7 = h8, 56 = a1, 63 = h1.
 * Bidak putih ditulis huruf besar (PNBRQK), bidak hitam huruf kecil (pnbrqk),
 * sama seperti notasi FEN.
 *
 * Dipakai di browser lewat global `Chess`, dan di Node lewat `require('./chess.js')`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Chess = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const FILES = 'abcdefgh';

  const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const ALL = DIAG.concat(ORTHO);

  // Hak rokade disimpan sebagai bitmask.
  const WK = 1, WQ = 2, BK = 4, BQ = 8;
  // Kotak awal benteng -> hak rokade yang hilang bila kotak itu ditinggalkan atau dimakan.
  const ROOK_CORNER = { 63: WK, 56: WQ, 7: BK, 0: BQ };

  function squareName(i) {
    return FILES[i & 7] + (8 - (i >> 3));
  }

  function parseSquare(s) {
    if (typeof s === 'number') return Number.isInteger(s) && s >= 0 && s < 64 ? s : -1;
    if (typeof s !== 'string' || !/^[a-h][1-8]$/.test(s)) return -1;
    return (8 - Number(s[1])) * 8 + FILES.indexOf(s[0]);
  }

  function colorOf(p) {
    return p === p.toUpperCase() ? 'w' : 'b';
  }

  function typeOf(p) {
    return p.toLowerCase();
  }

  function other(c) {
    return c === 'w' ? 'b' : 'w';
  }

  function onBoard(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  function mv(from, to, piece, captured, extra) {
    const m = {
      from, to, piece, captured: captured || null,
      promotion: null, castle: null, enPassant: false, double: false,
    };
    return extra ? Object.assign(m, extra) : m;
  }

  // Apakah kotak `sq` diserang oleh warna `by`?
  function isAttacked(board, sq, by) {
    const r = sq >> 3, c = sq & 7;
    const white = by === 'w';

    // Pion putih menyerang ke atas (baris lebih kecil), jadi penyerangnya ada satu baris di bawah.
    const pr = white ? r + 1 : r - 1;
    const pawn = white ? 'P' : 'p';
    if (pr >= 0 && pr < 8) {
      if (c > 0 && board[pr * 8 + c - 1] === pawn) return true;
      if (c < 7 && board[pr * 8 + c + 1] === pawn) return true;
    }

    const knight = white ? 'N' : 'n';
    for (const [dr, dc] of KNIGHT) {
      const rr = r + dr, cc = c + dc;
      if (onBoard(rr, cc) && board[rr * 8 + cc] === knight) return true;
    }

    const king = white ? 'K' : 'k';
    for (const [dr, dc] of ALL) {
      const rr = r + dr, cc = c + dc;
      if (onBoard(rr, cc) && board[rr * 8 + cc] === king) return true;
    }

    const queen = white ? 'Q' : 'q';
    return rayHits(board, r, c, DIAG, white ? 'B' : 'b', queen) ||
      rayHits(board, r, c, ORTHO, white ? 'R' : 'r', queen);
  }

  function rayHits(board, r, c, dirs, a, b) {
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (onBoard(rr, cc)) {
        const p = board[rr * 8 + cc];
        if (p) {
          if (p === a || p === b) return true;
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
    return false;
  }

  function parseFen(fen) {
    const fail = (why) => { throw new Error('FEN tidak valid (' + why + '): ' + fen); };
    const parts = String(fen).trim().split(/\s+/);
    if (parts.length < 4 || parts.length > 6) fail('jumlah bagian');

    const rows = parts[0].split('/');
    if (rows.length !== 8) fail('harus 8 baris');
    const board = new Array(64).fill(null);
    rows.forEach((row, r) => {
      let c = 0;
      for (const ch of row) {
        if (/[1-8]/.test(ch)) {
          c += Number(ch);
        } else if (/[pnbrqkPNBRQK]/.test(ch)) {
          if (c > 7) fail('baris terlalu panjang');
          if ((ch === 'p' || ch === 'P') && (r === 0 || r === 7)) fail('pion di baris pertama/terakhir');
          board[r * 8 + c] = ch;
          c++;
        } else {
          fail('karakter "' + ch + '"');
        }
      }
      if (c !== 8) fail('baris harus 8 kotak');
    });
    if (board.filter((p) => p === 'K').length !== 1 || board.filter((p) => p === 'k').length !== 1) {
      fail('harus ada tepat satu raja per warna');
    }

    const turn = parts[1];
    if (turn !== 'w' && turn !== 'b') fail('giliran');

    let castling = 0;
    if (parts[2] !== '-') {
      for (const ch of parts[2]) {
        const bit = { K: WK, Q: WQ, k: BK, q: BQ }[ch];
        if (!bit || castling & bit) fail('hak rokade');
        castling |= bit;
      }
    }
    // Buang hak rokade yang tidak mungkin dipakai karena raja/benteng tidak di tempatnya.
    if (board[60] !== 'K') castling &= ~(WK | WQ);
    if (board[4] !== 'k') castling &= ~(BK | BQ);
    if (board[63] !== 'R') castling &= ~WK;
    if (board[56] !== 'R') castling &= ~WQ;
    if (board[7] !== 'r') castling &= ~BK;
    if (board[0] !== 'r') castling &= ~BQ;

    let ep = -1;
    if (parts[3] !== '-') {
      ep = parseSquare(parts[3]);
      if (ep < 0) fail('kotak en passant');
      if ((ep >> 3) !== (turn === 'w' ? 2 : 5)) fail('baris en passant');
    }

    const num = (s, min, dflt) => {
      if (s === undefined) return dflt;
      if (!/^\d+$/.test(s) || Number(s) < min) fail('angka langkah');
      return Number(s);
    };
    const halfmove = num(parts[4], 0, 0);
    const fullmove = num(parts[5], 1, 1);

    if (isAttacked(board, board.indexOf(turn === 'w' ? 'k' : 'K'), turn)) {
      fail('raja yang tidak sedang giliran berada dalam skak');
    }

    return { board, turn, castling, ep, halfmove, fullmove };
  }

  class Game {
    constructor(fen) {
      this.load(fen === undefined ? START_FEN : fen);
    }

    load(fen) {
      const s = parseFen(fen);
      this.board = s.board;
      this.turn = s.turn;
      this.castling = s.castling;
      this.ep = s.ep;
      this.halfmove = s.halfmove;
      this.fullmove = s.fullmove;
      this._history = [];
      this._cache = null;
      this._keys = [this._key()];
    }

    // ---- Pembangkitan langkah ----

    _pseudo() {
      const b = this.board, color = this.turn, moves = [];
      for (let sq = 0; sq < 64; sq++) {
        const p = b[sq];
        if (!p || colorOf(p) !== color) continue;
        const r = sq >> 3, c = sq & 7, t = typeOf(p);
        if (t === 'p') this._pawnMoves(sq, r, c, p, moves);
        else if (t === 'n') this._steps(sq, r, c, p, KNIGHT, moves);
        else if (t === 'k') {
          this._steps(sq, r, c, p, ALL, moves);
          this._castles(sq, p, moves);
        } else this._slides(sq, r, c, p, t === 'b' ? DIAG : t === 'r' ? ORTHO : ALL, moves);
      }
      return moves;
    }

    _pawnMoves(sq, r, c, p, moves) {
      const b = this.board, white = p === 'P';
      const dir = white ? -1 : 1;
      const r1 = r + dir;
      if (r1 < 0 || r1 > 7) return;
      const promotes = r1 === (white ? 0 : 7);
      const add = (to, captured) => {
        if (promotes) {
          for (const promotion of 'qrbn') moves.push(mv(sq, to, p, captured, { promotion }));
        } else {
          moves.push(mv(sq, to, p, captured));
        }
      };

      const one = r1 * 8 + c;
      if (!b[one]) {
        add(one, null);
        const two = one + dir * 8;
        if (r === (white ? 6 : 1) && !b[two]) moves.push(mv(sq, two, p, null, { double: true }));
      }

      for (const dc of [-1, 1]) {
        const cc = c + dc;
        if (cc < 0 || cc > 7) continue;
        const to = r1 * 8 + cc, target = b[to];
        if (target) {
          if (colorOf(target) !== colorOf(p)) add(to, target);
        } else if (to === this.ep) {
          const victim = b[r * 8 + cc];
          if (victim === (white ? 'p' : 'P')) moves.push(mv(sq, to, p, victim, { enPassant: true }));
        }
      }
    }

    _steps(sq, r, c, p, dirs, moves) {
      const color = colorOf(p);
      for (const [dr, dc] of dirs) {
        const rr = r + dr, cc = c + dc;
        if (!onBoard(rr, cc)) continue;
        const to = rr * 8 + cc, target = this.board[to];
        if (!target) moves.push(mv(sq, to, p, null));
        else if (colorOf(target) !== color) moves.push(mv(sq, to, p, target));
      }
    }

    _slides(sq, r, c, p, dirs, moves) {
      const color = colorOf(p);
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (onBoard(rr, cc)) {
          const to = rr * 8 + cc, target = this.board[to];
          if (!target) {
            moves.push(mv(sq, to, p, null));
          } else {
            if (colorOf(target) !== color) moves.push(mv(sq, to, p, target));
            break;
          }
          rr += dr;
          cc += dc;
        }
      }
    }

    _castles(sq, p, moves) {
      const b = this.board, white = p === 'K';
      const home = white ? 60 : 4;
      if (sq !== home) return;
      const kRight = white ? WK : BK, qRight = white ? WQ : BQ;
      if (!(this.castling & (kRight | qRight))) return;
      const enemy = white ? 'b' : 'w', rook = white ? 'R' : 'r';
      // Tidak boleh rokade saat diskak, atau melewati/berhenti di kotak yang diserang.
      if (isAttacked(b, home, enemy)) return;
      if ((this.castling & kRight) && b[home + 3] === rook && !b[home + 1] && !b[home + 2] &&
          !isAttacked(b, home + 1, enemy) && !isAttacked(b, home + 2, enemy)) {
        moves.push(mv(home, home + 2, p, null, { castle: 'k' }));
      }
      // Kotak b1/b8 harus kosong, tetapi boleh diserang.
      if ((this.castling & qRight) && b[home - 4] === rook && !b[home - 1] && !b[home - 2] && !b[home - 3] &&
          !isAttacked(b, home - 1, enemy) && !isAttacked(b, home - 2, enemy)) {
        moves.push(mv(home, home - 2, p, null, { castle: 'q' }));
      }
    }

    // Jalankan langkah pada papan; kembalikan data untuk membatalkannya.
    _apply(m) {
      const b = this.board, white = this.turn === 'w';
      const u = {
        m, castling: this.castling, ep: this.ep, halfmove: this.halfmove, fullmove: this.fullmove,
        capSq: m.enPassant ? m.to + (white ? 8 : -8) : m.to,
      };
      u.captured = b[u.capSq];

      b[u.capSq] = null;
      b[m.to] = m.promotion ? (white ? m.promotion.toUpperCase() : m.promotion) : m.piece;
      b[m.from] = null;
      if (m.castle === 'k') {
        b[m.from + 1] = b[m.from + 3];
        b[m.from + 3] = null;
      } else if (m.castle === 'q') {
        b[m.from - 1] = b[m.from - 4];
        b[m.from - 4] = null;
      }

      if (typeOf(m.piece) === 'k') this.castling &= white ? ~(WK | WQ) : ~(BK | BQ);
      if (ROOK_CORNER[m.from]) this.castling &= ~ROOK_CORNER[m.from];
      if (ROOK_CORNER[m.to]) this.castling &= ~ROOK_CORNER[m.to];

      this.ep = m.double ? (m.from + m.to) >> 1 : -1;
      this.halfmove = typeOf(m.piece) === 'p' || u.captured ? 0 : this.halfmove + 1;
      if (!white) this.fullmove++;
      this.turn = white ? 'b' : 'w';
      return u;
    }

    _revert(u) {
      const b = this.board, m = u.m;
      b[m.from] = m.piece;
      b[m.to] = null;
      if (u.captured) b[u.capSq] = u.captured;
      if (m.castle === 'k') {
        b[m.from + 3] = b[m.from + 1];
        b[m.from + 1] = null;
      } else if (m.castle === 'q') {
        b[m.from - 4] = b[m.from - 1];
        b[m.from - 1] = null;
      }
      this.castling = u.castling;
      this.ep = u.ep;
      this.halfmove = u.halfmove;
      this.fullmove = u.fullmove;
      this.turn = colorOf(m.piece);
    }

    _kingSafeAfter(m) {
      const mover = this.turn;
      const u = this._apply(m);
      const safe = !isAttacked(this.board, this.board.indexOf(mover === 'w' ? 'K' : 'k'), this.turn);
      this._revert(u);
      return safe;
    }

    _legal() {
      return this._pseudo().filter((m) => this._kingSafeAfter(m));
    }

    _hasLegal() {
      return this._pseudo().some((m) => this._kingSafeAfter(m));
    }

    _san(m, legal) {
      let s;
      if (m.castle) {
        s = m.castle === 'k' ? 'O-O' : 'O-O-O';
      } else if (typeOf(m.piece) === 'p') {
        s = (m.captured ? FILES[m.from & 7] + 'x' : '') + squareName(m.to);
        if (m.promotion) s += '=' + m.promotion.toUpperCase();
      } else {
        s = typeOf(m.piece).toUpperCase();
        const rivals = legal.filter((o) => o.piece === m.piece && o.to === m.to && o.from !== m.from);
        if (rivals.length) {
          const sameFile = rivals.some((o) => (o.from & 7) === (m.from & 7));
          const sameRank = rivals.some((o) => (o.from >> 3) === (m.from >> 3));
          if (!sameFile) s += FILES[m.from & 7];
          else if (!sameRank) s += 8 - (m.from >> 3);
          else s += squareName(m.from);
        }
        if (m.captured) s += 'x';
        s += squareName(m.to);
      }
      const u = this._apply(m);
      if (this.inCheck()) s += this._hasLegal() ? '+' : '#';
      this._revert(u);
      return s;
    }

    // ---- API publik ----

    // Daftar langkah legal. `opts.square` membatasi ke bidak di kotak tersebut.
    moves(opts) {
      if (!this._cache) {
        const legal = this._legal();
        for (const m of legal) {
          m.san = this._san(m, legal);
          m.lan = squareName(m.from) + squareName(m.to) + (m.promotion || '');
        }
        this._cache = legal;
      }
      let list = this._cache;
      if (opts && opts.square !== undefined) {
        const sq = parseSquare(opts.square);
        list = list.filter((m) => m.from === sq);
      }
      return list.map((m) => Object.assign({}, m));
    }

    // Terima SAN ("Nf3", "exd8=Q+", "O-O"), notasi koordinat ("e2e4", "e7e8q"),
    // atau objek { from, to, promotion }. Kembalikan langkah yang dijalankan, atau null bila tidak legal.
    move(input) {
      const legal = this.moves();
      let found = null;
      if (typeof input === 'string') {
        const clean = (x) => x.trim().replace(/[+#?!]+$/, '').replace(/0/g, 'O');
        const want = clean(input);
        found = legal.find((m) => clean(m.san) === want) ||
          legal.find((m) => m.lan === input.trim().toLowerCase()) || null;
      } else if (input && typeof input === 'object') {
        const from = parseSquare(input.from), to = parseSquare(input.to);
        const promo = input.promotion ? String(input.promotion).toLowerCase() : null;
        const cands = legal.filter((m) => m.from === from && m.to === to);
        found = cands.find((m) => m.promotion === promo) ||
          (cands.length === 1 && !cands[0].promotion ? cands[0] : null);
      }
      if (!found) return null;

      const internal = this._cache.find((m) => m.lan === found.lan);
      const u = this._apply(internal);
      this._history.push({ move: internal, undo: u });
      this._cache = null;
      this._keys.push(this._key());
      return Object.assign({}, internal);
    }

    undo() {
      const h = this._history.pop();
      if (!h) return null;
      this._revert(h.undo);
      this._keys.pop();
      this._cache = null;
      return Object.assign({}, h.move);
    }

    history() {
      return this._history.map((h) => Object.assign({}, h.move));
    }

    get(square) {
      const sq = parseSquare(square);
      return sq < 0 ? null : this.board[sq];
    }

    kingSquare(color) {
      return this.board.indexOf(color === 'w' ? 'K' : 'k');
    }

    inCheck() {
      return isAttacked(this.board, this.kingSquare(this.turn), other(this.turn));
    }

    isCheckmate() {
      return this.inCheck() && this.moves().length === 0;
    }

    isStalemate() {
      return !this.inCheck() && this.moves().length === 0;
    }

    // Posisi mati: tidak ada rangkaian langkah yang bisa menghasilkan skakmat.
    isInsufficientMaterial() {
      let knights = 0;
      const bishopShades = [];
      for (let sq = 0; sq < 64; sq++) {
        const p = this.board[sq];
        if (!p) continue;
        const t = typeOf(p);
        if (t === 'p' || t === 'r' || t === 'q') return false;
        if (t === 'n') knights++;
        if (t === 'b') bishopShades.push(((sq >> 3) + (sq & 7)) % 2);
      }
      const minors = knights + bishopShades.length;
      if (minors <= 1) return true;
      return knights === 0 && bishopShades.every((s) => s === bishopShades[0]);
    }

    isThreefoldRepetition() {
      const key = this._keys[this._keys.length - 1];
      return this._keys.filter((k) => k === key).length >= 3;
    }

    isFiftyMoves() {
      return this.halfmove >= 100;
    }

    // Ringkasan keadaan permainan. Skakmat dan pat didahulukan dari aturan remis lain.
    status() {
      const check = this.inCheck();
      const stuck = this.moves().length === 0;
      const end = (reason, winner) => ({
        over: true, reason, winner, check,
        result: winner === 'w' ? '1-0' : winner === 'b' ? '0-1' : '1/2-1/2',
      });
      if (stuck && check) return end('checkmate', other(this.turn));
      if (stuck) return end('stalemate', null);
      if (this.isInsufficientMaterial()) return end('insufficient', null);
      if (this.isFiftyMoves()) return end('fifty', null);
      if (this.isThreefoldRepetition()) return end('threefold', null);
      return { over: false, reason: null, winner: null, result: null, check };
    }

    fen() {
      return [
        this._placement(), this.turn, this._castleString(),
        this.ep >= 0 ? squareName(this.ep) : '-', this.halfmove, this.fullmove,
      ].join(' ');
    }

    // Jumlah simpul pohon langkah sampai kedalaman tertentu; untuk menguji kebenaran mesin.
    perft(depth) {
      if (depth === 0) return 1;
      const moves = this._legal();
      if (depth === 1) return moves.length;
      let n = 0;
      for (const m of moves) {
        const u = this._apply(m);
        n += this.perft(depth - 1);
        this._revert(u);
      }
      return n;
    }

    _placement() {
      const rows = [];
      for (let r = 0; r < 8; r++) {
        let row = '', empty = 0;
        for (let c = 0; c < 8; c++) {
          const p = this.board[r * 8 + c];
          if (!p) {
            empty++;
            continue;
          }
          if (empty) row += empty;
          empty = 0;
          row += p;
        }
        rows.push(row + (empty || ''));
      }
      return rows.join('/');
    }

    _castleString() {
      const s = (this.castling & WK ? 'K' : '') + (this.castling & WQ ? 'Q' : '') +
        (this.castling & BK ? 'k' : '') + (this.castling & BQ ? 'q' : '');
      return s || '-';
    }

    // Kunci posisi untuk pengulangan: kotak en passant hanya dihitung bila benar-benar bisa dimakan.
    _key() {
      const epLive = this.ep >= 0 && this._legal().some((m) => m.enPassant);
      return [this._placement(), this.turn, this._castleString(), epLive ? squareName(this.ep) : '-'].join(' ');
    }
  }

  return { Game, START_FEN, squareName, parseSquare, colorOf, typeOf };
});
