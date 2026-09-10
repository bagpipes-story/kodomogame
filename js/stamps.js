// stamps.js — スタンプちょう（v0.16。仕様§3.4-2）
// 1プレイ完了で1スタンプ（絵柄はそのゲームのアイコン）。ログインボーナス・期限・コンプ報酬は作らない。
// 10個ごとの小さなお祝いは app.js がプレイ完了時に出す（ここは表示だけ）。

import { text, games } from './i18n.js';
import { loadStats } from './storage.js';

const MILESTONE = 10;

export function isMilestone(stamps) {
  return stamps > 0 && stamps % MILESTONE === 0;
}

// root にスタンプちょうを描く（開くたびに作り直す。一覧は最大200個の静的表示）
export function renderStamps(root) {
  const stats = loadStats();
  const total = stats.stamps ?? 0;
  const list = stats.stampList ?? [];
  const iconOf = new Map(games.map((g) => [g.id, g.icon]));

  const wrap = document.createElement('div');
  wrap.className = 'kgb-stamps';

  const count = document.createElement('p');
  count.className = 'kgb-stamps-count';
  count.textContent = `${total}${text.stampsCountSuffix}`;
  wrap.append(count);

  if (total === 0) {
    const empty = document.createElement('p');
    empty.className = 'kgb-stamps-empty';
    empty.textContent = text.stampsEmpty;
    wrap.append(empty);
  } else {
    const grid = document.createElement('div');
    grid.className = 'kgb-stamps-grid';
    const fragment = document.createDocumentFragment();
    // 古いものが200個を超えて数だけ残っている分は「？」ではなく省略し、番号だけ合わせる
    const offset = total - list.length;
    list.forEach((gameId, i) => {
      const cell = document.createElement('span');
      const number = offset + i + 1;
      cell.className = number % MILESTONE === 0 ? 'kgb-stamp is-milestone' : 'kgb-stamp';
      cell.textContent = iconOf.get(gameId) ?? '⭐';
      cell.title = String(number);
      fragment.append(cell);
    });
    grid.append(fragment);
    wrap.append(grid);
  }

  root.replaceChildren(wrap);
}
