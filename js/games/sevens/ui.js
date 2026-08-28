// ui.js — 7ならべの描画・入力（v0.4.1）
// 場の52マスはmount時に一度だけ生成し、置く/ガイドはclass切り替えのみ（§9全再描画禁止）。
// 手札はカード単位でノードを削除する。ふたりモードは手札が見えるため交代オーバーレイ必須（仕様§3.3）。
// v0.4.1: ロボット1〜3たい（2〜4人戦）対応。置いたカードは白地＋色数字の「表向き」見た目に変更。

import {
  SUITS,
  RANKS,
  MAX_PASSES,
  suitOf,
  rankOf,
  createGame,
  getNeeds,
  getPlayableIds,
  playCard,
  passTurn,
} from './game.js';
import { chooseAction } from './cpu.js';
import { text } from '../../i18n.js';
import { playPlace, playTurn, playWin, playTap, playBuzzer } from '../../sound.js';
import { loadStats, saveStats } from '../../storage.js';

// マークは色＋形の両方で見分けられる（分類あそびの知育方針。仕様§11）
const SUIT_CHARS = ['♠', '♥', '♦', '♣'];

const CPU_THINK_MS = [600, 1200];
const CPU_FAST_MS = [250, 450]; // 人間がリタイアした後はロボット同士を早回しする
const PASS_TOAST_MS = 1100;
const LOSE_PLACE_STEP_MS = 60; // リタイア時に手札が場に開いていく間隔

export function mount(root, config, { onExit }) {
  const abort = new AbortController();
  const timers = new Set();

  const isCpuMode = config.mode === 'cpu';
  const robotCount = isCpuMode ? Number(config.robots ?? 1) : 0;
  const playerCount = isCpuMode ? robotCount + 1 : 2;

  const names = isCpuMode
    ? [text.you, ...Array.from({ length: robotCount }, (_, i) =>
        robotCount === 1 ? text.cpuName : `${text.cpuName}${i + 1}`)]
    : [text.redName, text.blueName];

  let state = null;
  let inputLocked = false;
  let shownPlayer = 0;   // 手札を表示しているプレイヤー（ふたりモードで交代する）
  let needCells = [];    // ガイド表示中のマス（差分更新のため覚えておく）

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
  container.className = 'kgb-sevens';

  const banner = document.createElement('div');
  banner.className = 'kgb-turn-banner';

  // 相手情報（人数ぶんのバッジ: 名前・のこり枚数・パスのハート）
  const oppArea = document.createElement('div');
  oppArea.className = 'kgb-sevens-opp-area';
  const oppBadges = [];
  const badgeCount = isCpuMode ? robotCount : 1;
  for (let i = 0; i < badgeCount; i++) {
    const badge = document.createElement('div');
    badge.className = 'kgb-sevens-opp';
    const nameEl = document.createElement('span');
    const countEl = document.createElement('span');
    countEl.className = 'kgb-sevens-opp-count';
    const heartsEl = document.createElement('span');
    heartsEl.className = 'kgb-sevens-hearts';
    badge.append(nameEl, countEl, heartsEl);
    oppArea.append(badge);
    oppBadges.push({ badge, nameEl, countEl, heartsEl });
  }

  // 場: 左端にマーク列＋13マス×4段
  const board = document.createElement('div');
  board.className = 'kgb-sevens-board';
  const cellEls = [];
  {
    const fragment = document.createDocumentFragment();
    for (let suit = 0; suit < SUITS; suit++) {
      const label = document.createElement('span');
      label.className = `kgb-sevens-row-label kgb-suit-${suit}`;
      label.textContent = SUIT_CHARS[suit];
      fragment.append(label);
      for (let rank = 1; rank <= RANKS; rank++) {
        const cell = document.createElement('span');
        cell.className = 'kgb-sevens-cell';
        fragment.append(cell);
        cellEls.push(cell); // index = suit*13 + rank-1 = カードid
      }
    }
    board.append(fragment);
  }

  // パスボタン（のこり回数をハートで表示。仕様§4.2）
  const controls = document.createElement('div');
  controls.className = 'kgb-sevens-controls';
  const passButton = document.createElement('button');
  passButton.type = 'button';
  passButton.className = 'kgb-sevens-pass-button';
  const passLabel = document.createElement('span');
  passLabel.textContent = text.passButton;
  const myHearts = document.createElement('span');
  myHearts.className = 'kgb-sevens-hearts';
  passButton.append(passLabel, myHearts);
  controls.append(passButton);

  // 手札（ふたりモードは2人ぶん作って表示を切り替える）
  const handEls = [document.createElement('div'), document.createElement('div')];
  for (const el of handEls) el.className = 'kgb-sevens-hand';

  // 手番交代オーバーレイ（手札が見えるゲームなので不透明で覆う）
  const handover = document.createElement('div');
  handover.className = 'kgb-handover';
  handover.hidden = true;
  const handoverTitle = document.createElement('p');
  handoverTitle.className = 'kgb-handover-title';
  const handoverSub = document.createElement('p');
  handoverSub.className = 'kgb-handover-sub';
  handoverSub.textContent = text.handoverTap;
  handover.append(handoverTitle, handoverSub);

  const toast = document.createElement('div');
  toast.className = 'kgb-toast';
  toast.hidden = true;

  const resultOverlay = document.createElement('div');
  resultOverlay.className = 'kgb-overlay';
  resultOverlay.hidden = true;

  container.append(banner, oppArea, board, controls, handEls[0], handEls[1]);
  root.append(container, handover, toast, resultOverlay);

  // ---------- 表示の差分更新 ----------

  function cardButton(id) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `kgb-hand-card kgb-suit-${suitOf(id)}`;
    button.dataset.cardId = id;
    const num = document.createElement('span');
    num.className = 'kgb-hand-num';
    num.textContent = String(rankOf(id));
    const suit = document.createElement('span');
    suit.className = 'kgb-hand-suit';
    suit.textContent = SUIT_CHARS[suitOf(id)];
    button.append(num, suit);
    return button;
  }

  function buildHands() {
    // ふたりモードは両者ぶん、ロボットモードは人間(0)のぶんだけ表示に使う
    for (const player of [0, 1]) {
      const fragment = document.createDocumentFragment();
      if (player === 0 || !isCpuMode) {
        for (const id of state.hands[player]) fragment.append(cardButton(id));
      }
      handEls[player].replaceChildren(fragment);
    }
  }

  function updateHandVisibility() {
    handEls[0].hidden = shownPlayer !== 0;
    handEls[1].hidden = shownPlayer !== 1;
  }

  // 置いたカードは「表向き」＝白地に色つき数字（手札と同じ見た目）
  function placeChip(id) {
    const cell = cellEls[id];
    cell.textContent = String(rankOf(id));
    cell.className = `kgb-sevens-cell is-placed kgb-suit-text-${suitOf(id)}`;
  }

  // 「次に出せる数字」のガイド（数の順番を学べる知育要素。仕様§11）
  function updateNeeds() {
    for (const cell of needCells) {
      // ガイドだったマスにカードが置かれた場合は消さない（置いたカードを白紙に戻さない）
      if (cell.classList.contains('is-placed')) continue;
      cell.textContent = '';
      cell.className = 'kgb-sevens-cell';
    }
    needCells = [];
    if (state.finished) return;
    getNeeds(state).forEach((need, suit) => {
      for (const rank of [need.low, need.high]) {
        if (rank === null) continue;
        const cell = cellEls[suit * RANKS + rank - 1];
        cell.textContent = String(rank);
        cell.className = 'kgb-sevens-cell is-need';
        needCells.push(cell);
      }
    });
  }

  function updateGlow() {
    const handEl = handEls[shownPlayer];
    const playable = new Set(
      !inputLocked && state.current === shownPlayer ? getPlayableIds(state, shownPlayer) : [],
    );
    for (const button of handEl.children) {
      button.classList.toggle('is-playable', playable.has(Number(button.dataset.cardId)));
    }
  }

  function heartsText(left) {
    return '♥'.repeat(left) + '♡'.repeat(MAX_PASSES - left);
  }

  function updateInfo() {
    const oppPlayers = isCpuMode
      ? Array.from({ length: robotCount }, (_, i) => i + 1)
      : [1 - shownPlayer];
    oppBadges.forEach((entry, i) => {
      const p = oppPlayers[i];
      entry.nameEl.textContent = names[p];
      entry.countEl.textContent = text.remainPrefix + state.hands[p].length + text.sheetsSuffix;
      entry.heartsEl.textContent = heartsText(state.passesLeft[p]);
      entry.badge.classList.toggle('is-active', !state.finished && state.current === p);
      entry.badge.classList.toggle('is-retired', state.retired[p]);
    });
    myHearts.textContent = heartsText(state.passesLeft[shownPlayer]);
    banner.textContent = names[state.current] + text.turnSuffix;
    banner.className = `kgb-turn-banner is-blinking kgb-player-${state.current % 2}`;
  }

  function refreshAll() {
    updateNeeds();
    updateGlow();
    updateInfo();
  }

  function isCpuTurn() {
    return isCpuMode && state.current !== 0;
  }

  // ---------- 行動（人間・ロボット共通の入口） ----------

  function doPlay(id) {
    const player = state.current;
    const result = playCard(state, id);
    if (!result.ok) return;
    playPlace();
    placeChip(id);
    // 手札からカードのノードを取り除く（差分更新。ロボットの手札はDOMを持たない）
    handEls[player]?.querySelector?.(`[data-card-id="${id}"]`)?.remove();
    if (result.type === 'win') {
      finishGame();
      return;
    }
    nextTurn();
  }

  function doPass() {
    const player = state.current;
    const result = passTurn(state);
    if (!result.ok) return;
    playTurn();
    toast.textContent = result.type === 'retire'
      ? names[player] + text.retireSuffix
      : names[player] + text.passSuffix;
    toast.hidden = false;
    inputLocked = true;
    updateGlow();
    later(() => {
      toast.hidden = true;
      if (result.type === 'retire') {
        // 残り手札が1枚ずつ場に開いていく（仕様§4.2）
        result.placedCards.forEach((id, step) => {
          later(() => {
            placeChip(id);
            handEls[player]?.querySelector?.(`[data-card-id="${id}"]`)?.remove();
          }, step * LOSE_PLACE_STEP_MS);
        });
        later(() => {
          if (state.finished) finishGame();
          else {
            inputLocked = false;
            nextTurn();
          }
        }, result.placedCards.length * LOSE_PLACE_STEP_MS + 400);
        return;
      }
      inputLocked = false;
      nextTurn();
    }, PASS_TOAST_MS);
  }

  function nextTurn() {
    if (!isCpuMode && state.current !== shownPlayer) {
      showHandover();
      return;
    }
    inputLocked = false;
    refreshAll();
    if (isCpuTurn()) scheduleCpu();
  }

  function showHandover() {
    inputLocked = true;
    refreshAll();
    handoverTitle.textContent = names[state.current] + text.turnSuffix;
    handover.hidden = false;
  }

  handover.addEventListener('click', () => {
    playTap();
    handover.hidden = true;
    shownPlayer = state.current;
    updateHandVisibility();
    inputLocked = false;
    refreshAll();
  }, { signal: abort.signal });

  function scheduleCpu() {
    inputLocked = true;
    updateGlow();
    // 人間がリタイアした後の「ロボットだけの続き」は早回しで見せる
    const delay = isCpuMode && state.retired[0] ? CPU_FAST_MS : CPU_THINK_MS;
    later(() => {
      const action = chooseAction(state, config.level);
      inputLocked = false;
      if (action.type === 'play') doPlay(action.cardId);
      else doPass();
    }, randomBetween(delay));
  }

  // ---------- 終了処理 ----------

  // 戦績の保存はゲーム終了時のこの1回だけ（§9 localStorage規定）
  function updateStatsAtFinish() {
    if (!isCpuMode || state.winner !== 0) return;
    const stats = loadStats();
    stats.sevens ??= { wins: 0 };
    stats.sevens.wins++;
    saveStats(stats);
  }

  function finishGame() {
    updateStatsAtFinish();
    updateNeeds(); // 終了後はガイドを消す
    banner.className = 'kgb-turn-banner';

    const humanWon = !isCpuMode || state.winner === 0;
    let title;
    if (isCpuMode) {
      title = state.winner === 0 ? text.winYou : names[state.winner] + text.winSuffix;
    } else {
      title = state.winner === 0 ? text.winRed : text.winBlue;
    }
    let detail = state.endReason === 'empty' ? text.reasonEmpty : text.reasonPassOver;
    if (!humanWon) detail += `\n${text.playAgainTone}`; // ネガティブ演出禁止

    const dialog = document.createElement('div');
    dialog.className = 'kgb-dialog';
    const titleEl = document.createElement('p');
    titleEl.className = 'kgb-result-title';
    titleEl.textContent = title;
    const detailEl = document.createElement('p');
    detailEl.className = 'kgb-result-detail';
    detailEl.textContent = detail;
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
    dialog.append(titleEl, detailEl, buttons);

    resultOverlay.replaceChildren(dialog);
    if (humanWon) {
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

  // ---------- ラウンド開始（もういちど でも呼ぶ） ----------

  function startRound() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
    inputLocked = false;
    toast.hidden = true;
    handover.hidden = true;
    resultOverlay.hidden = true;
    resultOverlay.replaceChildren();
    needCells = [];

    state = createGame({ playerCount });
    // 場のマスを初期状態に戻し、7だけ置く
    cellEls.forEach((cell, id) => {
      cell.textContent = '';
      cell.className = 'kgb-sevens-cell';
      if (rankOf(id) === 7) placeChip(id);
    });
    buildHands();
    shownPlayer = 0;
    updateHandVisibility();
    refreshAll();
  }

  // ---------- 入力（リスナーは親に1つずつ。abortで一括解除） ----------

  for (const player of [0, 1]) {
    handEls[player].addEventListener('click', (event) => {
      const button = event.target.closest('.kgb-hand-card');
      if (!button) return;
      if (inputLocked || state.finished || state.current !== shownPlayer) return;
      const id = Number(button.dataset.cardId);
      const playable = new Set(getPlayableIds(state, shownPlayer));
      if (playable.has(id)) {
        doPlay(id);
      } else {
        // 出せないカード: 「ぶぶー」＋カードが小さく揺れる（ルール補助）
        playBuzzer();
        button.classList.remove('is-shake');
        void button.offsetWidth;
        button.classList.add('is-shake');
      }
    }, { signal: abort.signal });
  }

  passButton.addEventListener('click', () => {
    if (inputLocked || state.finished || state.current !== shownPlayer || isCpuTurn()) return;
    // 出せるカードがあるのにパスが残っていない場合は誤タップで負けないようにブロック
    if (state.passesLeft[shownPlayer] === 0 && getPlayableIds(state, shownPlayer).length > 0) {
      playBuzzer();
      return;
    }
    playTap();
    doPass();
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
