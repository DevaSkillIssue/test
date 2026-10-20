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
  // Klik yang datang sesaat setelah mouse/sentuhan sudah ditangani oleh event penunjuk.
  const POINTER_CLICK_WINDOW = 800;

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
  let confirmTrigger = null;
  let focusPos = 52; // posisi tampilan yang bisa di-Tab (e2 saat Putih di bawah)
  let refocusBoard = false;
  let drag = null;
  let lastPointerAt = -Infinity;
  let statusKey = '';

  // 64 tombol kotak dibuat sekali; isinya diperbarui setiap render.
  const squares = [];
  for (let pos = 0; pos < 64; pos++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sq';
    btn.dataset.pos = String(pos);
    btn.innerHTML = '<span class="piece" aria-hidden="true"></span>' +
      '<span class="coord rank" aria-hidden="true"></span><span class="coord file" aria-hidden="true"></span>' +
      '<span class="ring" aria-hidden="true"></span>';
    boardEl.appendChild(btn);
    squares.push(btn);
  }

  const sqAt = (pos) => (flipped ? 63 - pos : pos);
  const other = (c) => (c === 'w' ? 'b' : 'w');

  function pieceNode(p) {
    const span = document.createElement('span');
    span.className = 'piece ' + colorOf(p);
    span.textContent = GLYPH[typeOf(p)] + VS15;
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  function hiddenText(text) {
    const span = document.createElement('span');
    span.className = 'visually-hidden';
    span.textContent = text;
    return span;
  }

  function spokenMove(m) {
    let s;
    if (m.castle) {
      s = m.castle === 'k' ? 'rokade pendek' : 'rokade panjang';
    } else {
      s = PIECE_NAME[typeOf(m.piece)] + ' ' + squareName(m.from) + (m.captured ? ' makan ' : ' ke ') + squareName(m.to);
      if (m.promotion) s += ', promosi jadi ' + PIECE_NAME[m.promotion];
    }
    if (m.san.endsWith('#')) s += ', skakmat';
    else if (m.san.endsWith('+')) s += ', skak';
    return s;
  }

  // Langkah dalam notasi figurin (Nf3 -> ♘f3) untuk mata, plus kalimat lengkap untuk pembaca layar.
  function moveNode(m) {
    const frag = document.createDocumentFragment();
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    for (const part of m.san.split(/([KQRBN])/)) {
      if (!part) continue;
      if (FIGURINE[part]) {
        const fig = document.createElement('span');
        fig.className = 'fig';
        fig.textContent = FIGURINE[part] + VS15;
        visual.appendChild(fig);
      } else {
        visual.appendChild(document.createTextNode(part));
      }
    }
    frag.append(visual, hiddenText(SIDE[colorOf(m.piece)] + ': ' + spokenMove(m)));
    return frag;
  }

  function currentStatus() {
    if (manual) {
      return {
        over: true, check: false, reason: manual.reason, winner: manual.winner || null,
        result: manual.winner === 'w' ? '1-0' : manual.winner === 'b' ? '0-1' : '1/2-1/2',
      };
    }
    return game.status();
  }

  function isOver() {
    return currentStatus().over;
  }

  function describe(s) {
    const turn = SIDE[game.turn];
    switch (s.reason) {
      case 'checkmate': return ['Skakmat', SIDE[s.winner] + ' menang.'];
      case 'resign': return [SIDE[s.winner] + ' menang', SIDE[other(s.winner)] + ' menyerah.'];
      case 'agreement': return ['Remis', 'Kedua pemain sepakat remis.'];
      case 'stalemate': return ['Remis: pat', turn + ' tidak punya langkah legal, tetapi rajanya tidak sedang diskak.'];
      case 'insufficient': return ['Remis', 'Sisa bidak tidak cukup untuk skakmat.'];
      case 'fifty': return ['Remis', 'Aturan 50 langkah: 50 langkah beruntun tanpa ada yang dimakan dan tanpa gerakan pion.'];
      case 'threefold': return ['Remis', 'Posisi yang sama sudah terjadi tiga kali.'];
      default: break;
    }
    return [(s.check ? 'Skak! ' : '') + 'Giliran ' + turn, null];
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

    if (refocusBoard) {
      refocusBoard = false;
      squares[focusPos].focus({ preventScroll: true });
    }
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

      const pillText = s.over ? (s.winner === color ? 'Menang' : '') : game.turn === color ? (s.check ? 'Skak' : 'Giliran') : '';
      if (pillText) {
        const pill = document.createElement('span');
        pill.className = 'turn-pill' + (pillText === 'Skak' ? ' check' : '');
        pill.textContent = pillText;
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

  // Area status adalah live region: hanya diperbarui bila isinya berubah, supaya
  // pembaca layar tidak mengulang pengumuman setiap kali bidak dipilih.
  function renderStatus(s, last, plies) {
    const [title, reason] = describe(s);
    const key = [title, reason, plies, last ? last.lan : ''].join('|');
    statusEl.classList.toggle('over', s.over);
    statusEl.classList.toggle('check', !s.over && s.check);
    if (key === statusKey) return;
    statusKey = key;

    $('status-title').textContent = title;
    const detailEl = $('status-detail');
    detailEl.replaceChildren();
    if (reason) {
      const r = document.createElement('span');
      r.className = 'status-line';
      r.textContent = reason;
      detailEl.appendChild(r);
    }
    if (last) {
      const line = document.createElement('span');
      line.className = 'status-line';
      line.append('Langkah terakhir: ' + Math.ceil(plies / 2) + (plies % 2 ? '. ' : '… '), moveNode(last));
      detailEl.appendChild(line);
    } else if (!reason) {
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
        if (history[j]) td.appendChild(moveNode(history[j]));
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    if (s.over) {
      const tr = document.createElement('tr');
      tr.className = 'result';
      const td = document.createElement('td');
      td.colSpan = 3;
      td.textContent = s.result.replace(/1\/2/g, '½');
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    const scroll = $('scoresheet-scroll');
    scroll.scrollTop = scroll.scrollHeight;
  }

  // ---- Aksi permainan ----

  function setFlipped(value) {
    if (flipped === value) return;
    flipped = value;
    // Pertahankan fokus papan ketik pada kotak yang sama, bukan posisi tampilan yang sama.
    focusPos = 63 - focusPos;
    if (squares.includes(document.activeElement)) refocusBoard = true;
  }

  // Setiap perubahan posisi atau hasil menutup semua input yang sedang menunggu,
  // supaya pilihan promosi, seretan, atau konfirmasi lama tidak berlaku untuk posisi baru.
  function afterChange() {
    const focusWasInPromo = promoEl.contains(document.activeElement);
    selected = -1;
    pendingPromo = null;
    promoEl.hidden = true;
    endDrag();
    closeConfirm(false, false);
    if (autoFlip) setFlipped(game.turn === 'b');
    if (focusWasInPromo) refocusBoard = true;
    render();
    save();
  }

  function makeMove(from, to, promotion) {
    if (isOver() || !game.move({ from, to, promotion })) return false;
    afterChange();
    return true;
  }

  // Coba jalankan dari `from` ke `to`; buka pilihan promosi bila perlu.
  function attempt(from, to) {
    if (isOver()) return false;
    const cands = game.moves({ square: from }).filter((m) => m.to === to);
    if (!cands.length) return false;
    if (cands.some((m) => m.promotion)) openPromo(from, to);
    else makeMove(from, to);
    return true;
  }

  // Tekan sebuah kotak (klik, sentuh, atau Enter). Kembalikan info bila bidak di kotak itu bisa diseret.
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
    if (!p) return;
    refocusBoard = promoEl.contains(document.activeElement) || document.activeElement === document.body;
    pendingPromo = null;
    promoEl.hidden = true;
    if (!(choice && makeMove(p.from, p.to, choice))) render();
  }

  function askConfirm(text, okLabel, action, trigger) {
    $('confirm-text').textContent = text;
    $('confirm-ok').textContent = okLabel;
    confirmAction = action;
    confirmTrigger = trigger;
    confirmEl.hidden = false;
    $('confirm-ok').focus();
  }

  // `restoreFocus`: kembalikan fokus ke tombol pemicu (atau papan bila tombol itu kini nonaktif),
  // hanya bila fokus memang sedang berada di panel konfirmasi.
  function closeConfirm(run, restoreFocus) {
    if (confirmEl.hidden) return;
    const hadFocus = confirmEl.contains(document.activeElement);
    const action = confirmAction;
    const trigger = confirmTrigger;
    confirmAction = null;
    confirmTrigger = null;
    confirmEl.hidden = true;
    if (run && action) action();
    if (restoreFocus && hadFocus) {
      if (trigger && !trigger.disabled) trigger.focus();
      else squares[focusPos].focus();
    }
  }

  function newGame() {
    game = new Game();
    manual = null;
    afterChange();
  }

  buttons.undo.addEventListener('click', () => {
    if (manual || !game.undo()) return;
    afterChange();
  });

  buttons.flip.addEventListener('click', () => {
    setFlipped(!flipped);
    render();
    save();
  });

  buttons.draw.addEventListener('click', () => {
    if (isOver()) return;
    askConfirm('Kedua pemain sepakat mengakhiri permainan dengan remis?', 'Ya, remis', () => {
      if (isOver()) return;
      manual = { reason: 'agreement' };
      afterChange();
    }, buttons.draw);
  });

  buttons.resign.addEventListener('click', () => {
    if (isOver()) return;
    const loser = game.turn;
    askConfirm(SIDE[loser] + ' menyerah dan ' + SIDE[other(loser)] + ' dinyatakan menang?', 'Ya, menyerah', () => {
      if (isOver() || game.turn !== loser) return;
      manual = { reason: 'resign', winner: other(loser) };
      afterChange();
    }, buttons.resign);
  });

  buttons.newGame.addEventListener('click', () => {
    if (game.history().length && !isOver()) {
      askConfirm('Mulai permainan baru? Permainan yang sedang berjalan akan dihapus.', 'Mulai baru', newGame, buttons.newGame);
    } else {
      newGame();
    }
  });

  $('confirm-ok').addEventListener('click', () => closeConfirm(true, true));
  $('confirm-cancel').addEventListener('click', () => closeConfirm(false, true));

  autoFlipEl.addEventListener('change', () => {
    autoFlip = autoFlipEl.checked;
    if (autoFlip) setFlipped(game.turn === 'b');
    render();
    save();
  });

  promoOptions.addEventListener('click', (e) => {
    const btn = e.target.closest('.promo-option');
    if (btn) closePromo(btn.dataset.piece);
  });
  $('promo-cancel').addEventListener('click', () => closePromo(null));
  // Batal lewat latar gelap saat penekanan dimulai di sana. Memakai pointerdown, bukan click:
  // ketukan yang membuka dialog menghasilkan click yang jatuh di latar ini.
  promoEl.addEventListener('pointerdown', (e) => {
    if (e.target !== promoEl) return;
    e.preventDefault();
    closePromo(null);
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
    if (drag) {
      endDrag();
      selected = -1;
      render();
    } else if (pendingPromo) {
      closePromo(null);
    } else if (!confirmEl.hidden) {
      closeConfirm(false, true);
    } else if (selected >= 0) {
      selected = -1;
      render();
    }
  });

  // ---- Papan: penunjuk (mouse/sentuh) ----

  const notePointer = () => { lastPointerAt = performance.now(); };
  document.addEventListener('pointerdown', notePointer, true);
  document.addEventListener('pointerup', notePointer, true);

  function squareFromPoint(x, y) {
    const r = boardEl.getBoundingClientRect();
    const col = Math.floor(((x - r.left) / r.width) * 8);
    const row = Math.floor(((y - r.top) / r.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return -1;
    return sqAt(row * 8 + col);
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
    if (boardEl.hasPointerCapture(d.pointerId)) boardEl.releasePointerCapture(d.pointerId);
    return d;
  }

  boardEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const btn = e.target.closest('.sq');
    if (!btn || drag) return;
    e.preventDefault();
    focusPos = Number(btn.dataset.pos);
    closeConfirm(false, false);
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
      ghostEl.replaceChildren(pieceNode(game.get(drag.sq)));
      ghostEl.style.width = ghostEl.style.height = drag.size + 'px';
      ghostEl.style.fontSize = drag.size * 0.82 + 'px';
      ghostEl.hidden = false;
      render();
    }
    ghostEl.style.transform = 'translate(' + (e.clientX - drag.size / 2) + 'px,' + (e.clientY - drag.size / 2) + 'px)';
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

  // Klik tanpa event penunjuk sebelumnya: Enter/Spasi, atau aktivasi dari pembaca layar
  // dan kontrol suara. Klik mouse/sentuhan sudah ditangani lewat pointerdown di atas.
  boardEl.addEventListener('click', (e) => {
    if (performance.now() - lastPointerAt < POINTER_CLICK_WINDOW) return;
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
