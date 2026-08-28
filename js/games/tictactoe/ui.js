// ui.js — ◯×ゲームの描画・入力（v0.5）
// 9マスはmount時に一度だけ生成し、以後はclass切り替えのみ（§9全再描画禁止）。
// 先手は1回ごとに交代（仕様§4.6）。「もういちど」は結果画面から1タップで再戦。

import { createGame, place, getReachCells } from './game.js';
import { chooseMove } from './cpu.js';
import { text } from '../../i18n.js';
import { playPlace, playTurn, playWin, playTap } from '../../sound.js';
import { resetPraise, emitPraise, pickPraise, recordPlay } from '../../praise.js';

const CPU_THINK_MS = [600, 1200];
const WIN_SHOW_MS = 900; // そろったラインを見せてから結果画面を出す

export function mount(root, config, { onExit }) {
  const abort = new AbortController();
  const timers = new Set();

  const isCpuMode = config.mode === 'cpu';
  // player0=◯（ロボット戦では人間）、player1=×。先手だけが交代する
  const names = isCpuMode ? [text.you, text.cpuName] : [text.tttCircle, text.tttCross];

  let state = null;
  let inputLocked = false;
  let firstPlayer = 0; // 次のラウンドの先手（ラウンドごとに交代）
  let reachCells = [];

  function later(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  }

  function randomBetween([min, max]) {
    return min + Math.random() * (max - min);
  }

  // ---------- DOM生成（mount時に一度だけ） ----------

  root.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'kgb-ttt';

  const banner = document.createElement('div');
  banner.className = 'kgb-turn-banner';

  const board = document.createElement('div');
  board.className = 'kgb-ttt-board';
  const cellEls = [];
  const markEls = [];
  {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'kgb-ttt-cell';
      cell.dataset.index = i;
      const mark = document.createElement('span');
      mark.className = 'kgb-ttt-mark';
      cell.append(mark);
      fragment.append(cell);
      cellEls.push(cell);
      markEls.push(mark);
    }
    board.append(fragment);
  }

  // リーチのお知らせ（あとひとつ！）。パターン認識の入門（仕様§4.6知育要素）
  const reachLabel = document.createElement('div');
  reachLabel.className = 'kgb-ttt-reach-label';
  reachLabel.hidden = true;
  reachLabel.textContent = text.reachLabel;

  const resultOverlay = document.createElement('div');
  resultOverlay.className = 'kgb-overlay';
  resultOverlay.hidden = true;

  container.append(banner, board, reachLabel);
  root.append(container, resultOverlay);

  // ---------- 表示の差分更新 ----------

  function renderMark(index) {
    const mark = markEls[index];
    const player = state.board[index];
    if (player === null) {
      mark.className = 'kgb-ttt-mark';
      return;
    }
    mark.className = `kgb-ttt-mark is-set ${player === 0 ? 'kgb-ttt-o' : 'kgb-ttt-x'}`;
  }

  function updateBanner() {
    banner.textContent = names[state.current] + text.turnSuffix;
    banner.className = `kgb-turn-banner is-blinking kgb-player-${state.current}`;
  }

  // どちらかが「あとひとつ」のマスを点滅させる。
  // 誰のリーチか分かるよう、◯側=あか・×側=あおで色分けする（両方のリーチなら二重ワク）
  function updateReach() {
    for (const index of reachCells) {
      cellEls[index].classList.remove('is-reach-0', 'is-reach-1');
    }
    reachCells = [];
    if (state.finished) {
      reachLabel.hidden = true;
      return;
    }
    for (const player of [0, 1]) {
      for (const index of getReachCells(state, player)) {
        cellEls[index].classList.add(`is-reach-${player}`);
        if (!reachCells.includes(index)) reachCells.push(index);
      }
    }
    reachLabel.hidden = reachCells.length === 0;
  }

  function isCpuTurn() {
    return isCpuMode && state.current === 1;
  }

  // ---------- 着手（人間・ロボット共通の入口） ----------

  function placeAt(index) {
    const mover = state.current;
    // 人間が相手のリーチを防いだかを、置く前に判定する（ほめイベント）
    if (!(isCpuMode && mover === 1)) {
      if (getReachCells(state, 1 - mover).includes(index)) emitPraise('blocked_reach');
    }
    const result = place(state, index);
    if (!result.ok) return;
    playPlace();
    renderMark(index);
    updateReach();

    if (result.type === 'win') {
      for (const i of result.line) cellEls[i].classList.add('is-win');
      later(() => finishGame(), WIN_SHOW_MS);
      return;
    }
    if (result.type === 'draw') {
      emitPraise('draw_positive');
      later(() => finishGame(), 400);
      return;
    }
    playTurn();
    updateBanner();
    if (isCpuTurn()) scheduleCpu();
  }

  function scheduleCpu() {
    inputLocked = true;
    later(() => {
      inputLocked = false;
      const move = chooseMove(state, config.level);
      if (move !== null) placeAt(move);
    }, randomBetween(CPU_THINK_MS));
  }

  // ---------- 終了処理 ----------

  function finishGame() {
    emitPraise('finished_game');
    banner.className = 'kgb-turn-banner';
    const humanWon = isCpuMode ? state.winner === 0 : state.winner !== null;
    recordPlay('tictactoe', { won: isCpuMode && state.winner === 0 });

    let title;
    if (state.winner === null) {
      title = text.drawStrong; // 引き分けをポジティブに扱う（仕様§4.6）
    } else if (isCpuMode) {
      title = state.winner === 0 ? text.winYou : text.winCpu;
    } else {
      title = names[state.winner] + text.winSuffix;
    }

    const dialog = document.createElement('div');
    dialog.className = 'kgb-dialog';
    const titleEl = document.createElement('p');
    titleEl.className = 'kgb-result-title';
    titleEl.textContent = title;
    dialog.append(titleEl);

    if (isCpuMode && state.winner === 1) {
      const detailEl = document.createElement('p');
      detailEl.className = 'kgb-result-detail';
      detailEl.textContent = text.playAgainTone; // ネガティブ演出禁止
      dialog.append(detailEl);
    }

    // きょうのすごいところ（勝敗に関係なく必ず1つほめる。仕様§3.4）
    const praiseBox = document.createElement('div');
    praiseBox.className = 'kgb-praise-box';
    const praiseLabel = document.createElement('p');
    praiseLabel.className = 'kgb-praise-label';
    praiseLabel.textContent = text.praiseTitle;
    const praiseText = document.createElement('p');
    praiseText.className = 'kgb-praise-text';
    praiseText.textContent = pickPraise();
    praiseBox.append(praiseLabel, praiseText);
    dialog.append(praiseBox);

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
    dialog.append(buttons);

    resultOverlay.replaceChildren(dialog);
    if (state.winner === null || humanWon) {
      resultOverlay.prepend(buildConfetti());
      playWin();
    }
    resultOverlay.hidden = false;

    replayButton.addEventListener('click', () => {
      playTap();
      startRound();
    }, { signal: abort.signal });
    homeButton.addEventListener('click', () => {
      playTap();
      onExit();
    }, { signal: abort.signal });
  }

  function buildConfetti() {
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

  // ---------- ラウンド開始（もういちど でも呼ぶ。先手交代） ----------

  function startRound() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
    inputLocked = false;
    resultOverlay.hidden = true;
    resultOverlay.replaceChildren();
    resetPraise();

    state = createGame({ firstPlayer });
    firstPlayer = 1 - firstPlayer; // 次のラウンドは先手交代（仕様§4.6）
    for (let i = 0; i < 9; i++) {
      renderMark(i);
      cellEls[i].classList.remove('is-win', 'is-reach-0', 'is-reach-1');
    }
    reachCells = [];
    reachLabel.hidden = true;
    updateBanner();
    if (isCpuTurn()) scheduleCpu();
  }

  // ---------- 入力（リスナーは盤に1つだけ。abortで一括解除） ----------

  board.addEventListener('click', (event) => {
    const cell = event.target.closest('.kgb-ttt-cell');
    if (!cell) return;
    if (inputLocked || isCpuTurn() || state.finished) return;
    const index = Number(cell.dataset.index);
    if (state.board[index] !== null) return; // 置き済みマスは無反応でよい（仕様§4.6）
    placeAt(index);
  }, { signal: abort.signal });

  startRound();

  return {
    destroy() {
      for (const id of timers) clearTimeout(id);
      timers.clear();
      abort.abort();
      root.replaceChildren();
    },
  };
}
