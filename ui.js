/*
 * Antarmuka papan: menggambar posisi, klik atau seret bidak, pilihan promosi,
 * lembar langkah, dan penyimpanan otomatis permainan di browser.
 */
(function () {
  'use strict';

  const { Game, squareName, colorOf, typeOf } = window.Chess;

  const VS15 = '︎'; // paksa tampilan teks, bukan emoji
  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const FIGURINE = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' };
  const PIECE_NAME = { k: 'raja', q: 'menteri', r: 'benteng', b: 'gajah', n: 'kuda', p: 'pion' };
  const SIDE = { w: 'Putih', b: 'Hitam' };
  const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const STORE_KEY = 'catur-dua-pemain:v1';
  const DRAG_THRESHOLD = 5;

  const $ = (id) => document.getElementById(id);
  const boardEl = $('board');
  const ghostEl = $('ghost');
  const promoEl = $('promo');
  const promoOptions = $('promo-options');
  const statusEl = $('status');
  const confirmEl = $('confirm');
  const autoFlipEl = $('auto-flip');
  const buttons = {
    undo: $('btn-undo'), flip: $('btn-flip'), draw: $('btn-draw'),
    resign: $('btn-resign'), newGame: $('btn-new'),
  };

  let game = new Game();
  let flipped = false;
  let autoFlip = false;
  let manual = null; // hasil di luar papan: { reason: 'resign', winner } atau { reason: 'agreement' }
  let selected = -1;
  let pendingPromo = null; // { from, to }
  let confirmAction = null;
  let focusPos = 52; // posisi tampilan yang bisa di-Tab (e2 saat Putih di bawah)
  let drag = null;

  // 64 tombol kotak dibuat sekali; isinya diperbarui setiap render.
  const squares = [];
  for (let pos = 0; pos < 64; pos++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sq';
    btn.dataset.pos = String(pos);
    btn.innerHTML = '<span class="piece" aria-hidden="true"></span>' +
      '<span class="coord rank" aria-hidden="true"></span><span class="coord file" aria-hidden="true"></span>';
    boardEl.appendChild(btn);
    squares.push(btn);
  }

  const sqAt = (pos) => (flipped ? 63 - pos : pos);
  const other = (c) => (c === 'w' ? 'b' : 'w');

  function pieceNode(p, tag) {
    const span = document.createElement(tag || 'span');
    span.className = 'piece ' + colorOf(p);
    span.textContent = GLYPH[typeOf(p)] + VS15;
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  // SAN -> notasi figurin: huruf bidak diganti simbolnya, misalnya Nf3 -> ♘f3.
  function fanNode(san) {
    const frag = document.createDocumentFragment();
    for (const part of san.split(/([KQRBN])/)) {
      if (!part) continue;
      if (FIGURINE[part]) {
        const fig = document.createElement('span');
        fig.className = 'fig';
        fig.textContent = FIGURINE[part] + VS15;
        frag.appendChild(fig);
      } else {
        frag.appendChild(document.createTextNode(part));
      }
    }
    return frag;
  }

  function spokenMove(m) {
    if (m.castle) return m.castle === 'k' ? 'rokade pendek' : 'rokade panjang';
    let s = PIECE_NAME[typeOf(m.piece)] + ' ' + squareName(m.from) + (m.captured ? ' makan ' : ' ke ') + squareName(m.to);
    if (m.promotion) s += ', promosi jadi ' + PIECE_NAME[m.promotion];
    return s;
  }

  function currentStatus() {
    const s = game.status();
    if (manual) {
      return {
        over: true, check: false, reason: manual.reason, winner: manual.winner || null,
        result: manual.winner === 'w' ? '1-0' : manual.winner === 'b' ? '0-1' : '1/2-1/2',
      };
    }
    return s;
  }

  function describe(s) {
    const turn = SIDE[game.turn];
    switch (s.reason) {
      case 'checkmate': return ['Skakmat', SIDE[s.winner] + ' menang.'];
      case 'resign': return [SIDE[s.winner] + ' menang', SIDE[other(s.winner)] + ' menyerah.'];
      case 'agreement': return ['Remis', 'Kedua pemain sepakat remis.'];
      case 'stalemate': return ['Remis: pat', turn + ' tidak punya langkah legal, tetapi rajanya tidak sedang diskak.'];
      case 'insufficient': return ['Remis', 'Bidak yang tersisa tidak cukup untuk skakmat.'];
      case 'fifty': return ['Remis', 'Aturan 50 langkah: 50 langkah beruntun tanpa makan bidak atau menjalankan pion.'];
      case 'threefold': return ['Remis', 'Posisi yang sama sudah terjadi tiga kali.'];
      default: break;
    }
    if (s.check) return ['Skak! Giliran ' + turn, 'Raja ' + turn.toLowerCase() + ' harus diselamatkan.'];
    return ['Giliran ' + turn, null];
  }

  // ---- Render ----

  function render() {
    const s = currentStatus();
    const history = game.history();
    const last = history[history.length - 1];
    const fromSelected = selected >= 0 ? game.moves({ square: selected }) : [];
    const targets = new Map(fromSelected.map((m) => [m.to, m]));
    const movable = s.over ? new Set() : new Set(game.moves().map((m) => m.from));
    const checkSq = s.check ? game.kingSquare(game.turn) : -1;

    boardEl.classList.toggle('dragging', !!(drag && drag.active));
    squares.forEach((btn, pos) => {
      const sq = sqAt(pos);
      const p = game.get(sq);
      const light = ((sq >> 3) + (sq & 7)) % 2 === 0;
      const target = targets.get(sq);
      btn.dataset.sq = String(sq);
      btn.className = 'sq ' + (light ? 'light' : 'dark') +
        (sq === selected ? ' selected' : '') +
        (target ? ' target' + (target.captured ? ' capture' : '') : '') +
        (last && (sq === last.from || sq === last.to) ? ' last' : '') +
        (sq === checkSq ? ' check' : '') +
        (movable.has(sq) ? ' movable' : '') +
        (drag && drag.active && drag.sq === sq ? ' drag-origin' : '');
      btn.tabIndex = pos === focusPos ? 0 : -1;

      const pieceEl = btn.children[0];
      pieceEl.className = 'piece' + (p ? ' ' + colorOf(p) : '');
      pieceEl.textContent = p ? GLYPH[typeOf(p)] + VS15 : '';
      btn.children[1].textContent = (pos & 7) === 0 ? String(8 - (sq >> 3)) : '';
      btn.children[2].textContent = pos >> 3 === 7 ? 'abcdefgh'[sq & 7] : '';

      let label = squareName(sq) + ', ' + (p ? PIECE_NAME[typeOf(p)] + ' ' + SIDE[colorOf(p)].toLowerCase() : 'kosong');
      if (sq === selected) label += ', dipilih';
      if (target) label += target.captured ? ', bisa dimakan' : ', bisa dituju';
      if (sq === checkSq) label += ', sedang diskak';
      btn.setAttribute('aria-label', label);
    });

    renderPlayers(s, history);
    renderStatus(s, last, history.length);
    renderMoves(s, history);

    buttons.undo.disabled = history.length === 0 || !!manual;
    buttons.draw.disabled = s.over;
    buttons.resign.disabled = s.over;
    buttons.resign.textContent = SIDE[game.turn] + ' menyerah';
    autoFlipEl.checked = autoFlip;
  }

  function renderPlayers(s, history) {
    const taken = { w: [], b: [] }; // bidak lawan yang sudah dimakan masing-masing pihak
    for (const m of history) if (m.captured) taken[colorOf(m.piece)].push(m.captured);
    let material = 0;
    for (let sq = 0; sq < 64; sq++) {
      const p = game.get(sq);
      if (p) material += (colorOf(p) === 'w' ? 1 : -1) * VALUE[typeOf(p)];
    }

    const fill = (el, color) => {
      el.replaceChildren();
      el.classList.toggle('active', !s.over && game.turn === color);
      el.classList.toggle('winner', s.over && s.winner === color);
      const chip = document.createElement('span');
      chip.className = 'chip ' + color;
      chip.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'player-name';
      name.textContent = SIDE[color];
      el.append(chip, name);

      if (!s.over && game.turn === color) {
        const pill = document.createElement('span');
        pill.className = 'turn-pill' + (s.check ? ' check' : '');
        pill.textContent = s.check ? 'Skak' : 'Giliran';
        el.appendChild(pill);
      } else if (s.over && s.winner === color) {
        const pill = document.createElement('span');
        pill.className = 'turn-pill';
        pill.textContent = 'Menang';
        el.appendChild(pill);
      }

      const list = taken[color].slice().sort((a, b) => VALUE[typeOf(b)] - VALUE[typeOf(a)]);
      if (list.length) {
        const box = document.createElement('span');
        box.className = 'captured';
        box.setAttribute('role', 'img');
        box.setAttribute('aria-label', 'Sudah memakan: ' + list.map((p) => PIECE_NAME[typeOf(p)]).join(', '));
        for (const p of list) box.appendChild(pieceNode(p));
        el.appendChild(box);
      }
      const lead = color === 'w' ? material : -material;
      if (lead > 0) {
        const adv = document.createElement('span');
        adv.className = 'advantage';
        adv.textContent = '+' + lead;
        adv.title = 'Unggul materi ' + lead + ' poin';
        el.appendChild(adv);
      }
    };

    fill($('player-top'), flipped ? 'w' : 'b');
    fill($('player-bottom'), flipped ? 'b' : 'w');
  }

  function renderStatus(s, last, plies) {
    const [title, detail] = describe(s);
    statusEl.classList.toggle('over', s.over);
    statusEl.classList.toggle('check', !s.over && s.check);
    $('status-title').textContent = title;
    const detailEl = $('status-detail');
    detailEl.replaceChildren();
    if (detail) {
      detailEl.textContent = detail;
    } else if (last) {
      const no = Math.ceil(plies / 2);
      detailEl.append('Langkah terakhir: ' + no + (plies % 2 ? '. ' : '… '), fanNode(last.san));
      const sr = document.createElement('span');
      sr.className = 'visually-hidden';
      sr.textContent = ' (' + SIDE[colorOf(last.piece)] + ': ' + spokenMove(last) + ')';
      detailEl.appendChild(sr);
    } else {
      detailEl.textContent = 'Klik bidak lalu kotak tujuannya, atau seret bidaknya.';
    }
  }

  function renderMoves(s, history) {
    const tbody = $('moves');
    tbody.replaceChildren();
    $('moves-empty').hidden = history.length > 0;
    for (let i = 0; i < history.length; i += 2) {
      const tr = document.createElement('tr');
      const no = document.createElement('td');
      no.textContent = i / 2 + 1 + '.';
      tr.appendChild(no);
      for (const j of [i, i + 1]) {
        const td = document.createElement('td');
        td.className = 'ply' + (j === history.length - 1 ? ' current' : '');
        if (history[j]) td.appendChild(fanNode(history[j].san));
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    if (s.over) {
      const tr = document.createElement('tr');
      tr.className = 'result';
      const td = document.createElement('td');
      td.colSpan = 3;
      td.textContent = s.result.replace('1/2', '½').replace('1/2', '½');
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    const scroll = $('scoresheet-scroll');
    scroll.scrollTop = scroll.scrollHeight;
  }

  // ---- Aksi permainan ----

  function isOver() {
    return currentStatus().over;
  }

  function afterChange() {
    selected = -1;
    if (autoFlip) flipped = game.turn === 'b';
    render();
    save();
  }

  function makeMove(from, to, promotion) {
    if (!game.move({ from, to, promotion })) return false;
    afterChange();
    return true;
  }

  // Coba jalankan dari `from` ke `to`; buka pilihan promosi bila perlu.
  function attempt(from, to) {
    const cands = game.moves({ square: from }).filter((m) => m.to === to);
    if (!cands.length) return false;
    if (cands.some((m) => m.promotion)) openPromo(from, to);
    else makeMove(from, to);
    return true;
  }

  // Tekan sebuah kotak (klik, sentuh, atau Enter). Kembalikan apakah bidak di kotak itu bisa diseret.
  function press(sq) {
    if (isOver() || pendingPromo) return null;
    if (selected >= 0 && sq !== selected && attempt(selected, sq)) return null;
    const p = game.get(sq);
    if (p && colorOf(p) === game.turn) {
      const wasSelected = selected === sq;
      selected = sq;
      render();
      return { wasSelected };
    }
    if (selected >= 0) {
      selected = -1;
      render();
    }
    return null;
  }

  function openPromo(from, to) {
    pendingPromo = { from, to };
    promoOptions.replaceChildren();
    const color = game.turn;
    for (const t of ['q', 'r', 'b', 'n']) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'promo-option';
      btn.dataset.piece = t;
      btn.setAttribute('aria-label', PIECE_NAME[t]);
      const label = document.createElement('span');
      label.textContent = PIECE_NAME[t][0].toUpperCase() + PIECE_NAME[t].slice(1);
      btn.append(pieceNode(color === 'w' ? t.toUpperCase() : t), label);
      promoOptions.appendChild(btn);
    }
    promoEl.hidden = false;
    render();
    promoOptions.firstChild.focus();
  }

  function closePromo(choice) {
    const p = pendingPromo;
    pendingPromo = null;
    promoEl.hidden = true;
    if (p && choice) {
      makeMove(p.from, p.to, choice);
    } else {
      render();
    }
    squares[focusPos].focus({ preventScroll: true });
  }

  function askConfirm(text, okLabel, action) {
    $('confirm-text').textContent = text;
    $('confirm-ok').textContent = okLabel;
    confirmAction = action;
    confirmEl.hidden = false;
    $('confirm-ok').focus();
  }

  function closeConfirm(run) {
    const action = confirmAction;
    confirmAction = null;
    confirmEl.hidden = true;
    if (run && action) action();
  }

  function newGame() {
    game = new Game();
    manual = null;
    pendingPromo = null;
    promoEl.hidden = true;
    afterChange();
  }

  buttons.undo.addEventListener('click', () => {
    closeConfirm(false);
    if (manual || !game.undo()) return;
    afterChange();
  });

  buttons.flip.addEventListener('click', () => {
    flipped = !flipped;
    render();
    save();
  });

  buttons.draw.addEventListener('click', () => {
    if (isOver()) return;
    askConfirm('Kedua pemain sepakat mengakhiri permainan dengan remis?', 'Ya, remis', () => {
      manual = { reason: 'agreement' };
      afterChange();
    });
  });

  buttons.resign.addEventListener('click', () => {
    if (isOver()) return;
    const loser = game.turn;
    askConfirm(SIDE[loser] + ' menyerah dan ' + SIDE[other(loser)] + ' dinyatakan menang?', 'Ya, menyerah', () => {
      if (!isOver() && game.turn === loser) {
        manual = { reason: 'resign', winner: other(loser) };
        afterChange();
      }
    });
  });

  buttons.newGame.addEventListener('click', () => {
    if (game.history().length && !isOver()) {
      askConfirm('Mulai permainan baru? Permainan yang sedang berjalan akan dihapus.', 'Mulai baru', newGame);
    } else {
      closeConfirm(false);
      newGame();
    }
  });

  $('confirm-ok').addEventListener('click', () => closeConfirm(true));
  $('confirm-cancel').addEventListener('click', () => closeConfirm(false));

  autoFlipEl.addEventListener('change', () => {
    autoFlip = autoFlipEl.checked;
    if (autoFlip) flipped = game.turn === 'b';
    render();
    save();
  });

  promoOptions.addEventListener('click', (e) => {
    const btn = e.target.closest('.promo-option');
    if (btn) closePromo(btn.dataset.piece);
  });
  $('promo-cancel').addEventListener('click', () => closePromo(null));
  promoEl.addEventListener('click', (e) => {
    if (e.target === promoEl) closePromo(null);
  });
  promoEl.addEventListener('keydown', (e) => {
    const opts = Array.from(promoOptions.children);
    const i = opts.indexOf(document.activeElement);
    if (i >= 0 && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      opts[(i + (e.key === 'ArrowRight' ? 1 : opts.length - 1)) % opts.length].focus();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (pendingPromo) closePromo(null);
    else if (!confirmEl.hidden) closeConfirm(false);
    else if (selected >= 0) {
      selected = -1;
      render();
    }
  });

  // ---- Papan: penunjuk (mouse/sentuh) ----

  function squareFromPoint(x, y) {
    const r = boardEl.getBoundingClientRect();
    const col = Math.floor(((x - r.left) / r.width) * 8);
    const row = Math.floor(((y - r.top) / r.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return -1;
    return sqAt(row * 8 + col);
  }

  function placeGhost(x, y) {
    const size = drag.size;
    ghostEl.style.transform = 'translate(' + (x - size / 2) + 'px,' + (y - size / 2) + 'px)';
  }

  function setDropHover(sq) {
    squares.forEach((btn) => btn.classList.toggle('drop-hover', sq >= 0 && Number(btn.dataset.sq) === sq));
  }

  function endDrag() {
    if (!drag) return null;
    const d = drag;
    drag = null;
    ghostEl.hidden = true;
    ghostEl.replaceChildren();
    setDropHover(-1);
    if (boardEl.hasPointerCapture && boardEl.hasPointerCapture(d.pointerId)) {
      boardEl.releasePointerCapture(d.pointerId);
    }
    return d;
  }

  boardEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const btn = e.target.closest('.sq');
    if (!btn || drag) return;
    e.preventDefault();
    focusPos = Number(btn.dataset.pos);
    closeConfirm(false);
    const sq = Number(btn.dataset.sq);
    const res = press(sq);
    if (!res) return;
    const size = btn.getBoundingClientRect().width;
    drag = { sq, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, size, active: false, wasSelected: res.wasSelected };
    try {
      boardEl.setPointerCapture(e.pointerId);
    } catch (_) {
      // Penunjuk sudah hilang; seret tetap berjalan lewat event biasa.
    }
  });

  boardEl.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < DRAG_THRESHOLD) return;
      drag.active = true;
      const p = game.get(drag.sq);
      ghostEl.replaceChildren(pieceNode(p));
      ghostEl.style.width = ghostEl.style.height = drag.size + 'px';
      ghostEl.style.fontSize = drag.size * 0.82 + 'px';
      ghostEl.hidden = false;
      render();
    }
    placeGhost(e.clientX, e.clientY);
    const over = squareFromPoint(e.clientX, e.clientY);
    setDropHover(over !== drag.sq ? over : -1);
  });

  boardEl.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = endDrag();
    if (d.active) {
      const to = squareFromPoint(e.clientX, e.clientY);
      if (to >= 0 && to !== d.sq && attempt(d.sq, to)) return;
      render();
    } else if (d.wasSelected) {
      // Klik ulang pada bidak yang sudah dipilih membatalkan pilihan.
      selected = -1;
      render();
    }
  });

  boardEl.addEventListener('pointercancel', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    endDrag();
    render();
  });

  // Klik dari papan ketik (Enter/Spasi) punya detail 0; klik penunjuk sudah ditangani di atas.
  boardEl.addEventListener('click', (e) => {
    if (e.detail !== 0) return;
    const btn = e.target.closest('.sq');
    if (!btn) return;
    focusPos = Number(btn.dataset.pos);
    const res = press(Number(btn.dataset.sq));
    if (res && res.wasSelected) {
      selected = -1;
      render();
    }
  });

  boardEl.addEventListener('keydown', (e) => {
    const btn = e.target.closest('.sq');
    if (!btn) return;
    const pos = Number(btn.dataset.pos);
    let r = pos >> 3, c = pos & 7;
    if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
    else if (e.key === 'ArrowDown') r = Math.min(7, r + 1);
    else if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
    else if (e.key === 'ArrowRight') c = Math.min(7, c + 1);
    else if (e.key === 'Home') c = 0;
    else if (e.key === 'End') c = 7;
    else return;
    e.preventDefault();
    focusPos = r * 8 + c;
    squares.forEach((b, i) => { b.tabIndex = i === focusPos ? 0 : -1; });
    squares[focusPos].focus();
  });

  // ---- Simpan & pulihkan ----

  function serialize() {
    return { moves: game.history().map((m) => m.lan), flipped, autoFlip, manual };
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(serialize()));
    } catch (_) {
      // Penyimpanan diblokir (mode privat dll.); permainan tetap jalan tanpa disimpan.
    }
  }

  function restore(data) {
    if (!data || !Array.isArray(data.moves)) return false;
    const g = new Game();
    for (const lan of data.moves) {
      if (typeof lan !== 'string' || !g.move(lan)) return false;
    }
    game = g;
    flipped = !!data.flipped;
    autoFlip = !!data.autoFlip;
    const m = data.manual;
    manual = null;
    if (m && m.reason === 'agreement') manual = { reason: 'agreement' };
    if (m && m.reason === 'resign' && (m.winner === 'w' || m.winner === 'b')) manual = { reason: 'resign', winner: m.winner };
    if (manual && game.status().over) manual = null;
    return true;
  }

  function start(data) {
    let saved = data && data.state;
    if (!saved) {
      try {
        saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      } catch (_) {
        saved = null;
      }
    }
    restore(saved);
    if (flipped) focusPos = 63 - focusPos;
    render();
  }

  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') hot.snapshot(() => ({ state: serialize() }));
  if (hot && typeof hot.ready === 'function') hot.ready(start);
  else start((hot && hot.data) || {});
})();
