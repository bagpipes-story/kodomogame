// resultView.js — 結果ダイアログの共通生成（v0.15〜の新ゲームで共用）
// タイトル・ひとこと・「きょうのすごいところ」・もういちど／ホームへ。celebrateで紙吹雪＋ファンファーレ。
// 既存ゲームの同等コードは v0.16 の知育まとめ回でこちらに寄せる予定。

import { text } from './i18n.js';
import { playWin, playMatch } from './sound.js';
import { pickPraise } from './praise.js';

export function buildConfetti() {
  const wrap = document.createElement('div');
  wrap.className = 'kgb-confetti-wrap';
  wrap.setAttribute('aria-hidden', 'true');
  const colors = ['#f6a6b2', '#f9c784', '#7fc8a9', '#a5b8f3', '#c9a7eb'];
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 24; i++) {
    const piece = document.createElement('span');
    piece.className = 'kgb-confetti';
    piece.style.left = `${(i / 24) * 100 + Math.random() * 4}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.8}s`;
    piece.style.animationDuration = `${1.6 + Math.random()}s`;
    fragment.append(piece);
  }
  wrap.append(fragment);
  return wrap;
}

// overlay（.kgb-overlay）に結果を描いて表示する。praiseはpickPraise()で選ぶ（呼び出し側でemit済み）
export function showResult(overlay, { title, detail, celebrate = false, onReplay, onHome, signal }) {
  const dialog = document.createElement('div');
  dialog.className = 'kgb-dialog';
  const titleEl = document.createElement('p');
  titleEl.className = 'kgb-result-title';
  titleEl.textContent = title;
  const detailEl = document.createElement('p');
  detailEl.className = 'kgb-result-detail';
  detailEl.textContent = detail;

  const praiseBox = document.createElement('div');
  praiseBox.className = 'kgb-praise-box';
  const praiseLabel = document.createElement('p');
  praiseLabel.className = 'kgb-praise-label';
  praiseLabel.textContent = text.praiseTitle;
  const praiseText = document.createElement('p');
  praiseText.className = 'kgb-praise-text';
  praiseText.textContent = pickPraise();
  praiseBox.append(praiseLabel, praiseText);

  const buttons = document.createElement('div');
  buttons.className = 'kgb-dialog-buttons';
  const replayButton = document.createElement('button');
  replayButton.type = 'button';
  replayButton.className = 'kgb-dialog-button kgb-dialog-primary';
  replayButton.textContent = text.replay;
  const homeButton = document.createElement('button');
  homeButton.type = 'button';
  homeButton.className = 'kgb-dialog-button';
  homeButton.textContent = text.goHome;
  buttons.append(replayButton, homeButton);

  dialog.append(titleEl, detailEl, praiseBox, buttons);
  overlay.replaceChildren(dialog);
  if (celebrate) {
    overlay.prepend(buildConfetti());
    playWin();
  } else {
    playMatch();
  }
  overlay.hidden = false;

  replayButton.addEventListener('click', onReplay, { signal });
  homeButton.addEventListener('click', onHome, { signal });
}

export function hideResult(overlay) {
  overlay.hidden = true;
  overlay.replaceChildren();
}
