// ui.js — すうじフラッシュの描画・入力（v0.9。別冊03§5）
// 性能規定: カードは最大9枚を事前生成し、class切替と配置スタイルの差分更新のみ
// （プレイ中のDOM生成・削除禁止）。おぼえる時間の残りはCSS transitionのリング表示
// （毎フレームのJS更新なし。焦らせる数字カウントダウンにしない）。

import {
  MAX_N,
  GRID_COLS,
  createGame,
  dealLevel,
  tapNumber,
} from './game.js';
import { text } from '../../i18n.js';
import { playTap, playPlace, playMatch, playFlutter, playWin } from '../../sound.js';
import { resetPraise, emitPraise, pickPraise, recordPlay } from '../../praise.js';
import { loadStats, saveStats } from '../../storage.js';

const RING_C = 94.2;          // リングの円周（r=15）
const LEVEL_UP_WAIT_MS = 1100; // 「＋1こ ふえるよ！」を見せる時間
const MISS_REVEAL_MS = 2000;   // ミス時に正解位置を見せる時間

export function mount(root, config, { onExit }) {
  const abort = new AbortController();
  const timers = new Set();

  const isTwoMode = config.mode === 'two';
  const names = [text.redName, text.blueName];

  let state = null;
  let phase = 'idle'; // idle | show | recall | wait（演出中のタップ無効）

  function later(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  }

  function clearAllTimers() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  }

  // ---------- DOM生成（mount時に一度だけ） ----------

  root.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'kgb-flash';

  const banner = document.createElement('div');
  banner.className = 'kgb-turn-banner';

  // 状態メッセージ＋おぼえる時間リング
  const statusRow = document.createElement('div');
  statusRow.className = 'kgb-flash-status-row';
  const statusEl = document.createElement('span');
  statusEl.className = 'kgb-flash-status';
  const ringSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ringSvg.setAttribute('class', 'kgb-flash-ring');
  ringSvg.setAttribute('viewBox', '0 0 36 36');
  const ringBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ringBg.setAttribute('class', 'kgb-flash-ring-bg');
  ringBg.setAttribute('cx', '18');
  ringBg.setAttribute('cy', '18');
  ringBg.setAttribute('r', '15');
  const ringFill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ringFill.setAttribute('class', 'kgb-flash-ring-fill');
  ringFill.setAttribute('cx', '18');
  ringFill.setAttribute('cy', '18');
  ringFill.setAttribute('r', '15');
  ringSvg.append(ringBg, ringFill);
  statusRow.append(statusEl, ringSvg);

  // カード盤（4列×6行グリッド）。カード9枚は先に作って使い回す
  const board = document.createElement('div');
  board.className = 'kgb-flash-board';
  const cardEls = [];
  {
    const fragment = document.createDocumentFragment();
    for (let n = 1; n <= MAX_N; n++) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'kgb-flash-card';
      card.dataset.num = n;
      card.hidden = true;
      const numSpan = document.createElement('span');
      numSpan.className = 'kgb-flash-card-num';
      numSpan.textContent = n;
      const maskSpan = document.createElement('span');
      maskSpan.className = 'kgb-flash-card-mask';
      maskSpan.textContent = '？';
      card.append(numSpan, maskSpan);
      fragment.append(card);
      cardEls.push(card);
    }
    board.append(fragment);
  }

  // 正解タップで中央に大きく出る数字＋よみがな（数唱とセット。別冊03§5）
  const bigWrap = document.createElement('div');
  bigWrap.className = 'kgb-flash-big';
  bigWrap.setAttribute('aria-hidden', 'true');
  const bigNum = document.createElement('span');
  bigNum.className = 'kgb-flash-big-num';
  const bigRead = document.createElement('span');
  bigRead.className = 'kgb-flash-big-read';
  bigWrap.append(bigNum, bigRead);

  const startOverlay = document.createElement('div');
  startOverlay.className = 'kgb-handover';
  startOverlay.hidden = true;
  const startTitle = document.createElement('p');
  startTitle.className = 'kgb-handover-title';
  const startSub = document.createElement('p');
  startSub.className = 'kgb-handover-sub';
  startSub.textContent = text.handoverTap;
  startOverlay.append(startTitle, startSub);

  const resultOverlay = document.createElement('div');
  resultOverlay.className = 'kgb-overlay';
  resultOverlay.hidden = true;

  container.append(banner, statusRow, board, bigWrap);
  root.append(container, startOverlay, resultOverlay);

  // ---------- 表示の差分更新 ----------

  function updateBanner() {
    if (isTwoMode) {
      banner.textContent = `${names[state.currentPlayer]}${text.turnSuffix}　${state.level}${text.flashCountSuffix}`;
      banner.className = `kgb-turn-banner is-blinking kgb-player-${state.currentPlayer}`;
    } else {
      banner.textContent = `${text.flashLevelLabel}: ${state.level}${text.flashCountSuffix}`;
      banner.className = 'kgb-turn-banner';
    }
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  // おぼえる時間リングをshowMsかけて空にする（CSS transition任せ）
  function startRing(ms) {
    ringSvg.classList.add('is-on');
    ringFill.style.transition = 'none';
    ringFill.style.strokeDashoffset = '0';
    void ringSvg.getBoundingClientRect(); // transitionのリセットを確定させる
    ringFill.style.transition = `stroke-dashoffset ${ms}ms linear`;
    ringFill.style.strokeDashoffset = String(RING_C);
  }

  function stopRing() {
    ringSvg.classList.remove('is-on');
  }

  // 配られたカードを盤面に反映。mode: 'show'（数字見せる）
  function renderCards() {
    for (const card of cardEls) card.hidden = true;
    for (const { num, cell } of state.cards) {
      const card = cardEls[num - 1];
      card.hidden = false;
      card.className = 'kgb-flash-card is-shown';
      card.style.gridColumn = (cell % GRID_COLS) + 1;
      card.style.gridRow = Math.floor(cell / GRID_COLS) + 1;
    }
  }

  function maskCards() {
    for (const { num } of state.cards) {
      cardEls[num - 1].className = 'kgb-flash-card is-masked';
    }
  }

  // ミス時: 全カードの数字を見せる（正解位置を一瞬見せる。別冊03§5）
  function revealCards(wrongNum) {
    for (const { num } of state.cards) {
      cardEls[num - 1].className =
        num === wrongNum ? 'kgb-flash-card is-reveal is-wrong' : 'kgb-flash-card is-reveal';
    }
  }

  function flashBigNumber(num) {
    bigNum.textContent = num;
    bigRead.textContent = `${text.flashNumbers[num - 1]}！`;
    bigWrap.classList.remove('is-pop');
    void bigWrap.offsetWidth; // アニメーションを再トリガー
    bigWrap.classList.add('is-pop');
  }

  // ---------- ラウンド進行 ----------

  function showStartOverlay() {
    startTitle.textContent = isTwoMode
      ? names[state.currentPlayer] + text.turnSuffix
      : text.readyTitle;
    startOverlay.hidden = false;
  }

  startOverlay.addEventListener('click', () => {
    playTap();
    startOverlay.hidden = true;
    startLevel();
  }, { signal: abort.signal });

  // レベル開始: 配る→おぼえる時間→裏返してタップ解禁
  function startLevel() {
    dealLevel(state);
    updateBanner();
    renderCards();
    setStatus(text.flashRemember);
    startRing(state.showMs);
    phase = 'show'; // おぼえる時間中の先行タップは無効（別冊03§8）
    later(() => {
      maskCards();
      stopRing();
      setStatus(text.flashTapOrder);
      phase = 'recall';
    }, state.showMs);
  }

  function handleRoundOver(over) {
    if (over.nextPlayer !== undefined) {
      // こうたい対戦: あおのラウンドへ
      later(() => {
        updateBanner();
        showStartOverlay();
      }, 600);
      return;
    }
    later(() => finishGame(over), 600);
  }

  // ---------- 終了処理（保存はここで1回だけ。§9） ----------

  function finishGame(over) {
    // ほめイベント（別冊03§5）
    emitPraise('finished_game');
    if (state.clearedAfterMiss) emitPraise('comeback');
    if (state.reached > 0 && !state.missedInRound) emitPraise('perfect_first_try');

    let isNewRecord = false;
    let best = over.reached;
    if (!isTwoMode) {
      const stats = loadStats();
      stats.flash ??= { best: 0, plays: 0 };
      best = Math.max(stats.flash.best ?? 0, over.reached);
      if (over.reached > (stats.flash.best ?? 0)) {
        stats.flash.best = over.reached;
        isNewRecord = true;
        emitPraise('new_record');
      }
      saveStats(stats);
    }
    recordPlay('flash', { won: false });

    let title;
    let detail;
    let celebrate;
    if (isTwoMode) {
      const [a, b] = state.results;
      title = over.winner === null ? text.draw : over.winner === 0 ? text.winRed : text.winBlue;
      detail = `${text.redName} ${a}${text.flashCountSuffix} ／ ${text.blueName} ${b}${text.flashCountSuffix}`;
      celebrate = true;
    } else {
      title = text.flashResultPrefix + over.reached + text.flashResultSuffix;
      detail = `${text.bestLabel}: ${best}${text.flashCountSuffix}`;
      if (isNewRecord) detail += `\n${text.newRecord}`;
      celebrate = isNewRecord || over.reached >= MAX_N;
    }

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
    resultOverlay.replaceChildren(dialog);
    if (celebrate) {
      resultOverlay.prepend(buildConfetti());
      playWin();
    } else {
      playMatch();
    }
    resultOverlay.hidden = false;

    replayButton.addEventListener('click', () => {
      playTap();
      restart();
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

  function restart() {
    clearAllTimers();
    resultOverlay.hidden = true;
    resultOverlay.replaceChildren();
    resetPraise();
    state = createGame({ difficulty: config.difficulty, mode: config.mode });
    phase = 'idle';
    setStatus('');
    stopRing();
    for (const card of cardEls) card.hidden = true;
    updateBanner();
    showStartOverlay();
  }

  // ---------- 入力（リスナーは盤に1つだけ） ----------

  board.addEventListener('click', (event) => {
    if (phase !== 'recall') return; // おぼえる時間・演出中は無効
    const card = event.target.closest('.kgb-flash-card');
    if (!card || card.hidden) return;
    const num = Number(card.dataset.num);
    if (card.classList.contains('is-done')) return; // タップ済み
    const result = tapNumber(state, num);
    if (!result.ok) return;

    if (result.correct) {
      card.className = 'kgb-flash-card is-done';
      playPlace();
      flashBigNumber(num);
      if (result.levelCleared) {
        phase = 'wait';
        playMatch();
        if (result.roundOver) {
          setStatus('');
          handleRoundOver(result.roundOver);
          return;
        }
        setStatus(text.flashLevelUp);
        later(() => startLevel(), LEVEL_UP_WAIT_MS);
      }
      return;
    }

    // ミス: 正解位置を見せてから、再挑戦 or ラウンド終了
    phase = 'wait';
    playFlutter();
    revealCards(num);
    setStatus(text.flashMiss);
    if (result.retry) {
      later(() => startLevel(), MISS_REVEAL_MS);
    } else {
      later(() => handleRoundOver(result.roundOver), MISS_REVEAL_MS);
    }
  }, { signal: abort.signal });

  restart();

  return {
    destroy() {
      clearAllTimers(); // §9: 画面遷移時にタイマーを必ず解除
      abort.abort();
      root.replaceChildren();
    },
  };
}
