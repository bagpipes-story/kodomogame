// ui.js — オセロの描画・入力（v0.3）
// 盤面64マスはmount時に一度だけ生成し、以後は石・ヒントのclass切り替えだけ（§9全再描画禁止）。
// フリップは80ms間隔のタイマー連鎖。タイマーは全てtimersで管理し、destroyで解除する。

import {
  BLACK,
  WHITE,
  EMPTY,
  createGame,
  getLegalMoves,
  applyMove,
  countStones,
} from './game.js';
import { chooseMove } from './cpu.js';
import { effectiveLevel } from '../../assist.js';
import { resetPraise, emitPraise, pickPraise, recordPlay } from '../../praise.js';
import { text } from '../../i18n.js';
import { getNames, turnOf, winOf } from '../../players.js';
import { playPlace, playFlip, playTurn, playWin, playTap, playBuzzer } from '../../sound.js';

const FLIP_STEP_MS = 80;        // 1枚ずつ順に返す間隔（仕様§4.1）
const PASS_SHOW_MS = 1500;      // 「パス！」表示時間
const CPU_THINK_MS = [600, 1200]; // 思考時間演出（即打ちは子どもが混乱するため）
const COUNT_STEP_MS = 320;      // 終局の数え上げ（1こずつ「1、2、3…」と数唱できる速さ。タップでスキップ可）
const TIP_COUNT = 6;            // ワンポイントカードの種類

export function mount(root, config, { onExit }) {
  const abort = new AbortController();
  const timers = new Set();

  const isCpuMode = config.mode === 'cpu';
  // ロボット対戦では人間が黒（先手）。ふたりモードはくろ／しろ表記
  const names = getNames(config.mode, isCpuMode ? [text.you, text.cpuName] : [text.blackName, text.whiteName]);
  const nameOf = (color) => names[color === BLACK ? 0 : 1];
  const turnTextOf = (color) => turnOf(nameOf(color));

  let state = null;
  let inputLocked = false;
  let cpuLevel = config.level; // 難易度アシスト適用後のレベル（ラウンド開始時に決める）
  let hintedCells = [];
  const showCount = config.count !== 'off'; // かずのせんせい
  let tipIndex = Math.floor(Math.random() * TIP_COUNT); // ワンポイントは6種ローテーション
  const wasBehind = { [BLACK]: false, [WHITE]: false }; // 逆転ほめ用: 一度でも石数で負けていたか // 前回ヒントを付けたマス（差分更新のため覚えておく）

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
  container.className = 'kgb-othello';

  const banner = document.createElement('div');
  banner.className = 'kgb-turn-banner';

  const scoreRow = document.createElement('div');
  scoreRow.className = 'kgb-score-row';
  const scoreValueEls = {};
  for (const color of [BLACK, WHITE]) {
    const badge = document.createElement('div');
    badge.className = 'kgb-score-badge';
    const nameEl = document.createElement('span');
    nameEl.className = 'kgb-othello-score-name';
    const chip = document.createElement('span');
    chip.className = `kgb-stone-chip ${color === BLACK ? 'kgb-chip-black' : 'kgb-chip-white'}`;
    chip.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = nameOf(color);
    nameEl.append(chip, label);
    const valueEl = document.createElement('span');
    valueEl.className = 'kgb-score-value';
    badge.append(nameEl, valueEl);
    scoreRow.append(badge);
    scoreValueEls[color] = valueEl;
  }

  const board = document.createElement('div');
  board.className = 'kgb-board';
  const cellEls = [];
  const stoneEls = [];
  {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 64; i++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'kgb-cell';
      cell.dataset.index = i;
      const stone = document.createElement('span');
      stone.className = 'kgb-stone';
      cell.append(stone);
      fragment.append(cell);
      cellEls.push(cell);
      stoneEls.push(stone);
    }
    board.append(fragment);
  }

  // パス表示用トースト
  if (showCount) board.classList.add('is-count');

  // ワンポイントカード（ゲーム開始前に1枚。作戦という概念の導入。仕様§4.1）
  const tipOverlay = document.createElement('div');
  tipOverlay.className = 'kgb-handover kgb-othello-tip';
  tipOverlay.hidden = true;
  const tipTitle = document.createElement('p');
  tipTitle.className = 'kgb-othello-tip-title';
  tipTitle.textContent = text.othelloTipTitle;
  const tipText = document.createElement('p');
  tipText.className = 'kgb-handover-title';
  const tipSub = document.createElement('p');
  tipSub.className = 'kgb-handover-sub';
  tipSub.textContent = text.handoverTap;
  tipOverlay.append(tipTitle, tipText, tipSub);

  const toast = document.createElement('div');
  toast.className = 'kgb-toast';
  toast.hidden = true;

  const resultOverlay = document.createElement('div');
  resultOverlay.className = 'kgb-overlay';
  resultOverlay.hidden = true;

  container.append(banner, scoreRow, board);
  root.append(container, tipOverlay, toast, resultOverlay);

  // ---------- 表示の差分更新 ----------

  function renderStone(index, withFlipAnim = false) {
    const stone = stoneEls[index];
    const color = state.board[index];
    stone.classList.remove('is-flip');
    if (color === EMPTY) {
      stone.className = 'kgb-stone';
      return;
    }
    stone.className = `kgb-stone is-set ${color === BLACK ? 'kgb-stone-black' : 'kgb-stone-white'}`;
    if (withFlipAnim) {
      // reflowを1回挟んでアニメを再スタートさせる定石
      void stone.offsetWidth;
      stone.classList.add('is-flip');
    }
  }

  function updateBanner() {
    const color = state.current;
    banner.textContent = turnTextOf(color);
    banner.className = `kgb-turn-banner is-blinking ${color === BLACK ? 'kgb-turn-black' : 'kgb-turn-white'}`;
  }

  function updateScores() {
    const counts = countStones(state.board);
    scoreValueEls[BLACK].textContent = String(counts.black);
    scoreValueEls[WHITE].textContent = String(counts.white);
  }

  function isCpuTurn() {
    return isCpuMode && state.current === WHITE;
  }

  // 置けるマスのハイライト（ルール補助）。前回分を外して今回分だけ付ける
  function updateHints() {
    for (const i of hintedCells) cellEls[i].classList.remove('is-hint');
    hintedCells = [];
    if (state.finished || inputLocked || isCpuTurn()) return;
    for (const move of getLegalMoves(state.board, state.current)) {
      cellEls[move.index].classList.add('is-hint');
      if (showCount) cellEls[move.index].dataset.flips = String(move.flips.length); // 返せる枚数（数量比較）
      hintedCells.push(move.index);
    }
  }

  // ---------- 着手（人間・ロボット共通の入口） ----------

  const CORNERS = [0, 7, 56, 63];

  function playAt(index) {
    const mover = state.current;
    const result = applyMove(state, index);
    if (!result.ok) return;
    // ほめイベント: 角を取った（ロボット戦は人間=くろのみ。ふたりはどちらも子ども）
    if (CORNERS.includes(index) && (!isCpuMode || mover === BLACK)) emitPraise('took_corner');
    const c = countStones(state.board);
    if (c.black < c.white) wasBehind[BLACK] = true;
    if (c.white < c.black) wasBehind[WHITE] = true;
    inputLocked = true;
    updateHints(); // ロック中はヒントを消す
    playPlace();
    renderStone(index);

    // 1枚ずつ順にフリップ（アニメ中は入力ロック）
    result.flipped.forEach((flipIndex, step) => {
      later(() => {
        renderStone(flipIndex, true);
        playFlip();
      }, (step + 1) * FLIP_STEP_MS);
    });
    later(() => {
      updateScores();
      afterMove(result);
    }, (result.flipped.length + 1) * FLIP_STEP_MS + 150);
  }

  function afterMove(result) {
    if (result.next.type === 'end') {
      finishGame();
      return;
    }
    if (result.next.type === 'pass') {
      // 自動パス: 「○○は パス！」を1.5秒表示して同じ手番が続く
      toast.textContent = nameOf(result.next.passedColor) + text.passSuffix;
      toast.hidden = false;
      playTurn();
      later(() => {
        toast.hidden = true;
        continueTurn();
      }, PASS_SHOW_MS);
      return;
    }
    playTurn();
    continueTurn();
  }

  function continueTurn() {
    inputLocked = false;
    updateBanner();
    updateHints();
    if (isCpuTurn()) scheduleCpu();
  }

  function scheduleCpu() {
    later(() => {
      const move = chooseMove(state, cpuLevel);
      if (move !== null) playAt(move);
    }, randomBetween(CPU_THINK_MS));
  }

  // ---------- 終局（数え上げ→勝敗表示） ----------

  // 戦績の保存はゲーム終了時のこの1回だけ（§9 localStorage規定）

  // 「きょうのすごいところ」（具体ほめ。仕様§3.4-1）
  function buildPraiseBox() {
    const praiseBox = document.createElement('div');
    praiseBox.className = 'kgb-praise-box';
    const praiseLabel = document.createElement('p');
    praiseLabel.className = 'kgb-praise-label';
    praiseLabel.textContent = text.praiseTitle;
    const praiseText = document.createElement('p');
    praiseText.className = 'kgb-praise-text';
    praiseText.textContent = pickPraise();
    praiseBox.append(praiseLabel, praiseText);
    return praiseBox;
  }

  function updateStatsAtFinish(winnerColor) {
    // plays・勝ち数・6つの力・スタンプ・連敗（アシスト用）を praise.js にまとめて記録（v0.16.1で統一）
    emitPraise('finished_game');
    recordPlay('othello', { won: isCpuMode && winnerColor === BLACK, lost: isCpuMode && winnerColor === WHITE });
  }

  function finishGame() {
    banner.className = 'kgb-turn-banner';
    const counts = countStones(state.board);
    const winnerColor =
      counts.black > counts.white ? BLACK : counts.white > counts.black ? WHITE : null;
    if (winnerColor !== null && wasBehind[winnerColor] && (!isCpuMode || winnerColor === BLACK)) emitPraise('comeback');
    updateStatsAtFinish(winnerColor);

    const dialog = document.createElement('div');
    dialog.className = 'kgb-dialog';

    // 数唱: いま数えている数を大きく出す（1、2、3…）。タップでスキップ
    const bigCount = document.createElement('p');
    bigCount.className = 'kgb-othello-big-count';
    bigCount.textContent = '';
    const skipHint = document.createElement('p');
    skipHint.className = 'kgb-othello-skip-hint';
    skipHint.textContent = text.othelloCountHint;

    // 数え上げ表示（くろ・しろの石数が増えていく）
    const countRow = document.createElement('div');
    countRow.className = 'kgb-othello-count-row';
    const countEls = {};
    for (const color of [BLACK, WHITE]) {
      const item = document.createElement('div');
      item.className = 'kgb-othello-count';
      const chip = document.createElement('span');
      chip.className = `kgb-stone-chip ${color === BLACK ? 'kgb-chip-black' : 'kgb-chip-white'}`;
      const num = document.createElement('span');
      num.className = 'kgb-othello-count-number';
      num.textContent = '0';
      item.append(chip, num);
      countRow.append(item);
      countEls[color] = num;
    }

    const titleEl = document.createElement('p');
    titleEl.className = 'kgb-result-title';
    titleEl.textContent = '';

    const detailEl = document.createElement('p');
    detailEl.className = 'kgb-result-detail';
    detailEl.hidden = true;

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

    dialog.append(bigCount, countRow, skipHint, titleEl, detailEl, buildPraiseBox(), buttons);
    resultOverlay.replaceChildren(dialog);
    resultOverlay.hidden = false;

    replayButton.addEventListener('click', () => {
      playTap();
      startRound();
    }, { signal: abort.signal });
    homeButton.addEventListener('click', () => {
      playTap();
      onExit();
    }, { signal: abort.signal });

    // 数え上げアニメ: 大きい方の石数まで1ずつ増やす（数唱）。オーバーレイをタップすると最後まで飛ばす
    const maxCount = Math.max(counts.black, counts.white);
    const countTimers = [];
    let revealed = false;
    for (let step = 1; step <= maxCount; step++) {
      const id = setTimeout(() => {
        timers.delete(id);
        bigCount.textContent = String(step);
        bigCount.classList.remove('is-pop');
        void bigCount.offsetWidth;
        bigCount.classList.add('is-pop');
        if (step <= counts.black) countEls[BLACK].textContent = String(step);
        if (step <= counts.white) countEls[WHITE].textContent = String(step);
        if (step === maxCount) revealWinner();
      }, step * COUNT_STEP_MS);
      timers.add(id);
      countTimers.push(id);
    }
    resultOverlay.addEventListener('click', () => {
      if (revealed) return;
      for (const id of countTimers) {
        clearTimeout(id);
        timers.delete(id);
      }
      countEls[BLACK].textContent = String(counts.black);
      countEls[WHITE].textContent = String(counts.white);
      bigCount.textContent = String(maxCount);
      revealWinner();
    }, { signal: abort.signal });

    function revealWinner() {
      if (revealed) return;
      revealed = true;
      skipHint.hidden = true;
      later(() => {
        let title;
        let celebrate;
        if (winnerColor === null) {
          title = text.draw;
          celebrate = true;
        } else if (isCpuMode) {
          const humanWon = winnerColor === BLACK;
          title = winOf(nameOf(winnerColor));
          celebrate = humanWon;
          if (!humanWon) {
            detailEl.textContent = text.playAgainTone; // ネガティブ演出禁止
            detailEl.hidden = false;
          }
        } else {
          title = winOf(nameOf(winnerColor));
          celebrate = true;
        }
        titleEl.textContent = title;
        if (celebrate) {
          resultOverlay.prepend(buildConfetti());
          playWin();
        }
      }, 300);
    }
  }

  // 紙吹雪（memoryと同じ作り。結果表示のときだけ生成）
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
    toast.hidden = true;
    resultOverlay.hidden = true;
    resultOverlay.replaceChildren();
    state = createGame();
    cpuLevel = isCpuMode ? effectiveLevel('othello', config.level) : config.level;
    resetPraise();
    wasBehind[BLACK] = false;
    wasBehind[WHITE] = false;
    for (let i = 0; i < 64; i++) renderStone(i);
    updateScores();
    updateBanner();
    // ワンポイントカードを見せてからスタート（くろ=人間が先手なので、閉じるまでロボットは動かない）
    inputLocked = true;
    updateHints();
    tipText.textContent = text.othelloTips[tipIndex % TIP_COUNT];
    tipIndex += 1;
    tipOverlay.hidden = false;
  }

  tipOverlay.addEventListener('click', () => {
    if (tipOverlay.hidden) return;
    playTap();
    tipOverlay.hidden = true;
    inputLocked = false;
    updateHints();
  }, { signal: abort.signal });

  // ---------- 入力（リスナーは盤に1つだけ。abortで一括解除） ----------

  board.addEventListener('click', (event) => {
    const cell = event.target.closest('.kgb-cell');
    if (!cell) return;
    if (inputLocked || isCpuTurn() || state.finished) return;
    const index = Number(cell.dataset.index);
    if (hintedCells.includes(index)) {
      playAt(index);
    } else {
      // 置けない場所: 「ぶぶー」＋盤が小さく揺れる（ルール補助）
      playBuzzer();
      board.classList.remove('is-shake');
      void board.offsetWidth;
      board.classList.add('is-shake');
    }
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
