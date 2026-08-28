// ui.js — 神経衰弱の描画・入力（v0.2）
// 純ロジック(game.js)とCPU(cpu.js)をつなぎ、DOMの差分更新だけを行う。
// 盤面はゲーム開始時に一度だけ生成し、以後はカード単位のclass切り替えのみ（§9全再描画禁止）。

import {
  PAIR_COUNTS,
  createGame,
  flipCard,
  resolveMismatch,
  getWinners,
} from './game.js';
import { createCpu } from './cpu.js';
import { text } from '../../i18n.js';
import { playFlip, playMatch, playTurn, playWin, playTap } from '../../sound.js';
import { loadStats, saveStats } from '../../storage.js';

// カードの絵柄（仮: 絵文字。v0.7でSVGイラストに差し替え予定）。むずかしい=12ペアぶん必要
const FACES = ['🐶', '🐱', '🐰', '🦁', '🐼', '🐸', '🐥', '🍎', '🍌', '🍇', '🍓', '🚗'];

const MISMATCH_SHOW_MS = 1000; // 不一致カードを見せる時間（仕様§4.3）
const MATCH_PAUSE_MS = 500;    // 一致演出の間
const CPU_FIRST_MS = [700, 1100];  // CPUの思考演出（即打ちは子どもが混乱するため）
const CPU_SECOND_MS = [600, 900];

export function mount(root, config, { onExit }) {
  const abort = new AbortController();
  const timers = new Set();

  const playerCount = config.mode === 'solo' ? 1 : 2;
  const isCpuMode = config.mode === 'cpu';
  const playerNames = isCpuMode ? [text.you, text.cpuName] : [text.redName, text.blueName];
  const turnTexts = isCpuMode ? [text.turnYou, text.turnCpu] : [text.turnRed, text.turnBlue];

  let state = null;
  let cpu = null;
  let inputLocked = false;

  // ---------- タイマー管理（destroyで全解除するため必ずlater経由） ----------

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
  container.className = 'kgb-memory';

  const banner = document.createElement('div');
  banner.className = 'kgb-turn-banner';

  const scoreRow = document.createElement('div');
  scoreRow.className = 'kgb-score-row';
  const scoreValueEls = [];
  if (playerCount === 2) {
    playerNames.forEach((name, player) => {
      const badge = document.createElement('div');
      badge.className = `kgb-score-badge kgb-player-${player}`;
      const nameEl = document.createElement('span');
      nameEl.textContent = name;
      const valueEl = document.createElement('span');
      valueEl.className = 'kgb-score-value';
      valueEl.textContent = '0';
      badge.append(nameEl, valueEl);
      scoreRow.append(badge);
      scoreValueEls.push(valueEl);
    });
  }

  const grid = document.createElement('div');
  grid.className = `kgb-card-grid kgb-grid-${config.size}`;

  container.append(banner);
  if (playerCount === 2) container.append(scoreRow);
  container.append(grid);

  // 結果オーバーレイ（中身は終了時に組み立てる）
  const resultOverlay = document.createElement('div');
  resultOverlay.className = 'kgb-overlay';
  resultOverlay.hidden = true;

  root.append(container, resultOverlay);

  let cardEls = [];

  function buildGrid() {
    const fragment = document.createDocumentFragment();
    cardEls = [];
    state.cards.forEach((card, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'kgb-card';
      button.dataset.index = index;

      const inner = document.createElement('span');
      inner.className = 'kgb-card-inner';

      const back = document.createElement('span');
      back.className = 'kgb-card-face kgb-card-back';
      back.textContent = '⭐';

      const front = document.createElement('span');
      front.className = 'kgb-card-face kgb-card-front';
      front.textContent = FACES[card.face];

      inner.append(back, front);
      button.append(inner);
      fragment.append(button);
      cardEls.push(button);
    });
    grid.replaceChildren(fragment);
  }

  // ---------- 表示の差分更新 ----------

  function updateBanner() {
    if (state.finished) return;
    if (config.mode === 'solo') {
      banner.textContent = `${text.movesLabel}: ${state.moves}`;
      banner.className = 'kgb-turn-banner kgb-banner-solo';
      return;
    }
    banner.textContent = turnTexts[state.currentPlayer];
    banner.className = `kgb-turn-banner kgb-player-${state.currentPlayer} is-blinking`;
  }

  function updateScores() {
    if (playerCount !== 2) return;
    state.scores.forEach((score, player) => {
      scoreValueEls[player].textContent = String(score);
    });
  }

  function isCpuTurn() {
    return isCpuMode && state.currentPlayer === 1;
  }

  // ---------- めくり処理（人間・CPU共通の入口はflipAt） ----------

  function flipAt(index) {
    const result = flipCard(state, index);
    if (!result.ok) return;
    cardEls[index].classList.add('is-open');
    playFlip();
    // CPUは誰がめくったカードでも見て覚える（記憶精度は難易度で変わる）
    cpu?.remember(index, state.cards[index].face);
    handleResult(result);
  }

  function handleResult(result) {
    if (result.type === 'first') {
      if (isCpuTurn()) scheduleCpuSecond();
      return;
    }
    if (config.mode === 'solo') updateBanner(); // めくったかいすうを更新

    if (result.type === 'match') {
      inputLocked = true;
      playMatch();
      for (const index of result.indices) {
        const el = cardEls[index];
        el.classList.remove('is-open');
        el.classList.add('is-matched'); // ジャンプ演出＋表のまま固定
      }
      updateScores();
      later(() => {
        inputLocked = false;
        if (state.finished) {
          finishGame();
        } else if (isCpuTurn()) {
          scheduleCpuFirst(); // 一致したらもう1回（CPUの手番継続）
        }
      }, MATCH_PAUSE_MS);
      return;
    }

    // mismatch: 1秒見せてから裏に戻して手番交代
    inputLocked = true;
    later(() => {
      const indices = resolveMismatch(state);
      for (const index of indices) {
        cardEls[index].classList.remove('is-open');
      }
      inputLocked = false;
      if (config.mode !== 'solo') playTurn();
      updateBanner();
      if (isCpuTurn()) scheduleCpuFirst();
    }, MISMATCH_SHOW_MS);
  }

  // ---------- CPUの手番 ----------

  function scheduleCpuFirst() {
    later(() => {
      flipAt(cpu.pickFirst(state));
    }, randomBetween(CPU_FIRST_MS));
  }

  function scheduleCpuSecond() {
    const firstIndex = state.faceUp[0];
    const firstFace = state.cards[firstIndex].face;
    later(() => {
      flipAt(cpu.pickSecond(state, firstIndex, firstFace));
    }, randomBetween(CPU_SECOND_MS));
  }

  // ---------- 終了処理 ----------

  // 戦績の保存はゲーム終了時のこの1回だけ（§9 localStorage規定）
  function updateStatsAtFinish() {
    const stats = loadStats();
    // 古い保存データにキーが無くても落ちないように補う
    stats.memory ??= { wins: 0, bestMoves: {} };
    stats.memory.bestMoves ??= {};
    let isNewRecord = false;
    const winners = getWinners(state);
    if (config.mode === 'solo') {
      const best = stats.memory.bestMoves[config.size];
      if (best === undefined || state.moves < best) {
        stats.memory.bestMoves[config.size] = state.moves;
        isNewRecord = true;
      }
    } else if (isCpuMode && winners.length === 1 && winners[0] === 0) {
      stats.memory.wins++;
    }
    saveStats(stats);
    return { isNewRecord, best: stats.memory.bestMoves[config.size] };
  }

  function buildResult() {
    const { isNewRecord, best } = updateStatsAtFinish();
    const winners = getWinners(state);
    const isDraw = playerCount === 2 && winners.length !== 1;

    let title;
    let detail = '';
    let celebrate; // 紙吹雪＋ファンファーレを出すか

    if (config.mode === 'solo') {
      title = text.winSolo;
      detail = `${text.movesLabel}: ${state.moves}\n${text.bestLabel}: ${best}`;
      if (isNewRecord) detail += `\n${text.newRecord}`;
      celebrate = true;
    } else if (isDraw) {
      title = text.draw;
      celebrate = true;
    } else if (isCpuMode) {
      const humanWon = winners[0] === 0;
      title = humanWon ? text.winYou : text.winCpu;
      if (!humanWon) detail = text.playAgainTone; // ネガティブ演出禁止
      celebrate = humanWon;
    } else {
      title = winners[0] === 0 ? text.winRed : text.winBlue;
      celebrate = true;
    }
    return { title, detail, celebrate };
  }

  function finishGame() {
    banner.className = 'kgb-turn-banner kgb-banner-solo';
    const { title, detail, celebrate } = buildResult();

    const dialog = document.createElement('div');
    dialog.className = 'kgb-dialog';

    const titleEl = document.createElement('p');
    titleEl.className = 'kgb-result-title';
    titleEl.textContent = title;
    dialog.append(titleEl);

    if (detail) {
      const detailEl = document.createElement('p');
      detailEl.className = 'kgb-result-detail';
      detailEl.textContent = detail;
      dialog.append(detailEl);
    }

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
    if (celebrate) {
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

  // 紙吹雪: 結果表示のときだけ生成し、オーバーレイごと消える（transformのみのCSSアニメ）
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

  // ---------- ラウンド開始（もういちど でも呼ぶ） ----------

  function startRound() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
    inputLocked = false;
    resultOverlay.hidden = true;
    resultOverlay.replaceChildren();
    state = createGame({ pairCount: PAIR_COUNTS[config.size], playerCount });
    cpu = isCpuMode ? createCpu(config.level) : null;
    buildGrid();
    updateBanner();
    updateScores();
  }

  // ---------- 入力（リスナーはgridに1つだけ。abortで一括解除） ----------

  grid.addEventListener('click', (event) => {
    const button = event.target.closest('.kgb-card');
    if (!button) return;
    if (inputLocked || isCpuTurn() || state.finished) return;
    flipAt(Number(button.dataset.index));
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
