// zukanView.js — なまえあての ずかん画面（v0.19.3。別冊05 §5.2）
// 一覧（なかまタブ＋小さい 絵）と 詳細ページ（大きな 絵に 見分けポイントの 番号・大きさ・すんでいる ところ・にている なかま）。
// ui.js から 切りはなしたのは、ずかんが ふえても ゲームの 進行の コードを 大きく しない ため。
// 性能（§9）:
// - 小さい 絵は えらんだ タブの ぶんだけ 描き、一度 描いた ものは ずかんを とじる まで 使いまわす（タブを もどしても 描きなおさない）
// - 詳細ページの 大きい 絵は ひらいた ときに 1回だけ 描く。アニメーションは なし（CSS の :active だけ）
// - リスナーは overlay に 1つ（クリックを data-action で 見わける）。とじる ときに AbortController で はずす

import { text } from '../../i18n.js';

const MARK_R = 11; // 番号の まるの 半径（CSS px）

// opts = {
//   title, bookLabel, note, ids, found: Set, nameOf(id), thumb(id, found) → canvas,
//   tabs: null | [{ key, label, ids }],
//   detail: null | (id) → { name, groupLabel, size, where, marks: [文字], points: [[x, y]], similar: [id], art },
//   onTap(), onClose(), signal
// }
export function openZukanView(overlay, opts) {
  const ctrl = new AbortController();
  const signal = ctrl.signal;
  opts.signal?.addEventListener('abort', () => ctrl.abort(), { once: true });
  const thumbs = new Map(); // id → canvas（一覧の 小さい 絵。ずかんを とじる まで 使いまわす）
  let tab = 'all';
  let view = 'list';
  let listScroll = 0; // 一覧に もどった とき 同じ ところを 見せる

  function thumbOf(id) {
    if (!thumbs.has(id)) thumbs.set(id, opts.thumb(id, opts.found.has(id)));
    return thumbs.get(id);
  }

  function el(tag, className, textContent) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (textContent !== undefined) e.textContent = textContent;
    return e;
  }

  function countOf(ids) {
    return ids.filter((id) => opts.found.has(id)).length;
  }

  // 1まい（見つけた 子は いろ＋名前、まだの 子は 黒い かげ＋「？？？」）。詳細ページが ある ときは 見つけた 子を おせる
  function cell(id, canvas) {
    const has = opts.found.has(id);
    const canOpen = has && !!opts.detail;
    const c = el(canOpen ? 'button' : 'div', `kgb-guess-zukan-cell${has ? ' is-found' : ''}`);
    if (canOpen) {
      c.type = 'button';
      c.dataset.action = 'detail';
      c.dataset.id = id;
    }
    c.append(canvas, el('span', 'kgb-guess-zukan-name', has ? opts.nameOf(id) : text.guessZukanUnknown));
    return c;
  }

  function closeButton(label, action) {
    const b = el('button', 'kgb-guess-zukan-close', label);
    b.type = 'button';
    b.dataset.action = action;
    return b;
  }

  // ---------- 一覧 ----------

  function renderList() {
    view = 'list';
    const head = el('div', 'kgb-guess-zukan-head');
    const count = countOf(opts.ids);
    const total = opts.ids.length;
    head.append(
      el('p', 'kgb-guess-zukan-title', opts.title),
      el('p', 'kgb-guess-zukan-book', opts.bookLabel),
      el('p', 'kgb-guess-zukan-count', count === total ? `${count} / ${total}　${text.guessZukanComplete}` : `${count} / ${total}`),
      el('p', 'kgb-guess-zukan-note', opts.note),
    );
    const parts = [head];
    let ids = opts.ids;
    if (opts.tabs) {
      const bar = el('div', 'kgb-guess-zukan-tabs');
      for (const t of [{ key: 'all', label: text.guessZukanAll, ids: opts.ids }, ...opts.tabs]) {
        const b = el('button', `kgb-guess-zukan-tab${t.key === tab ? ' is-on' : ''}`, `${t.label} ${countOf(t.ids)}/${t.ids.length}`);
        b.type = 'button';
        b.dataset.action = 'tab';
        b.dataset.tab = t.key;
        bar.append(b);
        if (t.key === tab) ids = t.ids;
      }
      parts.push(bar);
    }
    const grid = el('div', 'kgb-guess-zukan-grid');
    const fragment = document.createDocumentFragment();
    for (const id of ids) fragment.append(cell(id, thumbOf(id)));
    grid.append(fragment);
    if (opts.detail && count > 0) parts.push(el('p', 'kgb-guess-zukan-hint', text.guessZukanTapHint));
    parts.push(grid, closeButton(text.guessZukanClose, 'close'));
    overlay.replaceChildren(...parts);
  }

  // ---------- 詳細ページ ----------

  // 大きな 絵＋見分けポイントの 番号。図鑑の ように 番号は 絵の 左右の よはくに たてに ならべ、点から 線で むすぶ
  // （絵の 上に 番号を おくと からだの もようが かくれる ため）
  function bigPicture(d) {
    const canvas = el('canvas', 'kgb-guess-zukan-big');
    const art = d.art;
    const fullW = art.w + art.pad * 2;
    const fullH = art.h + art.pad * 2;
    const side = MARK_R * 2 + 16; // 左右の 番号の はば
    const cw = Math.max(240, Math.min(overlay.clientWidth - 32, 560));
    // たてながの 絵（クワガタなど）は キャンバスも たかく して 絵を 大きく
    const ch = Math.round(Math.min(cw * 1.15, Math.max(cw * 0.6, ((cw - side * 2) * fullH) / fullW + MARK_R * 2)));
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    const g = canvas.getContext('2d');
    const s = Math.min((cw - side * 2) / fullW, (ch - MARK_R * 2) / fullH) * dpr;
    const cx = art.minX + art.w / 2;
    const cy = art.minY + art.h / 2;
    const tx = canvas.width / 2 - cx * s;
    const ty = canvas.height / 2 - cy * s;
    g.setTransform(s, 0, 0, s, tx, ty);
    art.draw(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const r = MARK_R * dpr;
    const gap = r * 2 + 4 * dpr;
    // 番号の 位置: 点が 絵の まんなかより 右なら 右の よはく、左なら 左（3つめの 数 1／-1 で 右／左に きめられる）。
    // 同じ がわは 上から じゅんに かさならない ように
    const marks = d.points.map(([x, y, side], i) => ({ i, px: x * s + tx, py: y * s + ty, right: side ? side > 0 : x >= cx }));
    for (const right of [true, false]) {
      const list = marks.filter((m) => m.right === right).sort((m1, m2) => m1.py - m2.py);
      let last = -Infinity;
      for (const m of list) {
        m.lx = right ? canvas.width - side * dpr * 0.5 : side * dpr * 0.5;
        m.ly = Math.max(m.py, last + gap, r + 2);
        last = m.ly;
      }
      // 下に はみ出したら 下から つめなおす
      let next = canvas.height - r - 2;
      for (const m of list.slice().reverse()) {
        m.ly = Math.min(m.ly, next);
        next = m.ly - gap;
      }
    }
    for (const m of marks) {
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 3.5 * dpr;
      g.beginPath();
      g.moveTo(m.px, m.py);
      g.lineTo(m.lx, m.ly);
      g.stroke();
      g.strokeStyle = '#4a3f35';
      g.lineWidth = 1.4 * dpr;
      g.stroke();
      g.fillStyle = '#4a3f35';
      g.beginPath();
      g.arc(m.px, m.py, 2.6 * dpr, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#f28b3b';
      g.strokeStyle = '#fff';
      g.lineWidth = 2.5 * dpr;
      g.beginPath();
      g.arc(m.lx, m.ly, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#fff';
      g.font = `bold ${Math.round(14 * dpr)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(m.i + 1), m.lx, m.ly + 0.5 * dpr);
    }
    return canvas;
  }

  function renderDetail(id) {
    const d = opts.detail(id);
    if (!d) return;
    if (view === 'list') listScroll = overlay.scrollTop; // にている なかまから とんだ ときは 一覧の 位置を のこす
    view = 'detail';
    const head = el('div', 'kgb-guess-zukan-head');
    head.append(el('p', 'kgb-guess-zukan-title', d.name), el('p', 'kgb-guess-zukan-book', d.groupLabel));
    const pic = el('div', 'kgb-guess-zukan-bigwrap');
    pic.append(bigPicture(d));
    const facts = el('dl', 'kgb-guess-zukan-facts');
    for (const [label, value] of [[text.guessZukanSize, d.size], [text.guessZukanWhere, d.where]]) facts.append(el('dt', '', label), el('dd', '', value));
    const marksHead = el('p', 'kgb-guess-zukan-sub', text.guessZukanMarks);
    const ol = el('ol', 'kgb-guess-zukan-marks');
    d.marks.forEach((m, i) => {
      const li = el('li');
      li.append(el('span', 'kgb-guess-zukan-num', String(i + 1)), el('span', '', m));
      ol.append(li);
    });
    const parts = [head, pic, facts, marksHead, ol];
    if (d.similar.length) {
      parts.push(el('p', 'kgb-guess-zukan-sub', text.guessZukanSimilar));
      const row = el('div', 'kgb-guess-zukan-grid is-similar');
      for (const other of d.similar) row.append(cell(other, opts.thumb(other, opts.found.has(other))));
      parts.push(row);
    }
    parts.push(closeButton(text.guessZukanBack, 'back'));
    overlay.replaceChildren(...parts);
    overlay.scrollTop = 0;
  }

  // ---------- 入力（overlay に 1つ） ----------

  overlay.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target || !overlay.contains(target)) return;
    const action = target.dataset.action;
    opts.onTap?.();
    if (action === 'tab') {
      tab = target.dataset.tab;
      renderList();
    } else if (action === 'detail') {
      renderDetail(target.dataset.id);
    } else if (action === 'back') {
      renderList();
      overlay.scrollTop = listScroll;
    } else if (action === 'close') {
      close();
    }
  }, { signal });

  function close() {
    ctrl.abort();
    overlay.hidden = true;
    overlay.replaceChildren();
    thumbs.clear();
    opts.onClose?.();
  }

  renderList();
  overlay.scrollTop = 0;
  overlay.hidden = false;
  return close;
}
