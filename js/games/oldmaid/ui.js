// ui.js — ばばぬきの描画・入力（v0.7）
// 手札はカード単位のノード追加・削除のみ（§9全再描画禁止）。
// ロボットの手番はタイマー連鎖で進み、全タイマーはtimersで管理してdestroyで解除する。
// ふたりモードは手札が見えるため交代オーバーレイ必須（仕様§3.3）。

import {
  JOKER,
  suitOf,
  rankOf,
  createGame,
  sourceOf,
  drawAt,
  shuffleSourceHand,
} from './game.js';
import { text } from '../../i18n.js';
import { playFlip, playMatch, playPlace, playTurn, playWin, playTap } from '../../sound.js';
import { resetPraise, emitPraise, pickPraise, recordPlay } from '../../praise.js';

const SUIT_CHARS = ['♠', '♥', '♦', '♣'];

const ROBOT_THINK_MS = [700, 1100]; // ロボットが引くまでの間
const TAKE_SHOW_MS = 450;           // 人間の手札から抜かれるカードのハイライト時間
const PAIR_SHOW_MS = 1000;          // ペア表示の時間
const FINISH_TOAST_MS = 900;        // 「◯◯は あがり！」の表示時間
const SHUFFLE_MS = 800;             // まぜまぜ演出の時間

export function mount(root, config, { onExit }) {
  const abort = new AbortController();
  const timers = new Set();

  const isCpuMode = config.mode === 'cpu';
  const robotCount = isCpuMode ? Number(config.robots ?? 2) : 0;
  const playerCount = isCpuMode ? robotCount + 1 : 2;
  const smallDeck = config.size === 'easy';

  const names = isCpuMode
    ? [text.you, ...Array.from({ length: robotCount }, (_, i) =>
        robotCount === 1 ? text.cpuName : `${text.cpuName}${i + 1}`)]
    : [text.redName, text.blueName];

  let state = null;
  let inputLocked = true;
  let shownPlayer = 0; // 手札を表示しているプレイヤー（ふたりモードで交代）

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
  container.className = 'kgb-oldmaid';

  const banner = document.createElement('div');
  banner.className = 'kgb-turn-banner';

  // 相手バッジ（表示中プレイヤー以外の人数ぶん）
  const oppArea = document.createElement('div');
  oppArea.className = 'kgb-om-opp-area';
  const oppBadges = [];
  for (let i = 0; i < playerCount - 1; i++) {
    const badge = document.createElement('div');
    badge.className = 'kgb-om-opp';
    const nameEl = document.createElement('span');
    const countEl = document.createElement('span');
    countEl.className = 'kgb-om-opp-count';
    badge.append(nameEl, countEl);
    oppArea.append(badge);
    oppBadges.push({ badge, nameEl, countEl });
  }

  // メッセージ行（えらんでね／◯◯が ひいた！ など）
  const messageEl = document.createElement('div');
  messageEl.className = 'kgb-om-message';

  // 引き札の扇（となりの手札のうら面）
  const fan = document.createElement('div');
  fan.className = 'kgb-om-fan';

  // ペア成立の表示（2枚を大きく見せる）
  const pairPopup = document.createElement('div');
  pairPopup.className = 'kgb-om-pair-popup';
  pairPopup.hidden = true;

  // 手札（ふたりモードは2人ぶん作って切り替え）
  const handEls = [document.createElement('div'), document.createElement('div')];
  for (const el of handEls) el.className = 'kgb-om-hand';

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

  container.append(banner, oppArea, messageEl, fan, handEls[0], handEls[1]);
  root.append(container, pairPopup, handover, toast, resultOverlay);

  // ---------- カードのDOM ----------

  function cardNode(id, faceUp) {
    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.cardId = id;
    if (!faceUp) {
      el.className = 'kgb-om-back';
      el.textContent = '★';
      return el;
    }
    if (id === JOKER) {
      el.className = 'kgb-om-card kgb-om-joker';
      el.textContent = '🃏';
      return el;
    }
    el.className = `kgb-om-card kgb-suit-${suitOf(id)}`;
    const num = document.createElement('span');
    num.className = 'kgb-hand-num';
    num.textContent = String(rankOf(id));
    const suit = document.createElement('span');
    suit.className = 'kgb-hand-suit';
    suit.textContent = SUIT_CHARS[suitOf(id)];
    el.append(num, suit);
    return el;
  }

  function buildHand(player) {
    const fragment = document.createDocumentFragment();
    for (const id of state.hands[player]) fragment.append(cardNode(id, true));
    handEls[player].replaceChildren(fragment);
  }

  function updateHandVisibility() {
    handEls[0].hidden = shownPlayer !== 0;
    handEls[1].hidden = shownPlayer !== 1;
  }

  // 引いたカードを手札の正しい位置に挿し込む（差分更新）
  function insertCardNode(player, id) {
    const index = state.hands[player].indexOf(id);
    const el = handEls[player];
    el.insertBefore(cardNode(id, true), el.children[index] ?? null);
  }

  function removeCardNode(player, id) {
    handEls[player].querySelector(`[data-card-id="${id}"]`)?.remove();
  }

  // 扇（うら面）を引き先の枚数ぶん並べる
  function buildFan() {
    const source = sourceOf(state);
    const fragment = document.createDocumentFragment();
    state.hands[source].forEach((_, pos) => {
      const back = cardNode(0, false);
      back.dataset.pos = pos;
      fragment.append(back);
    });
    fan.replaceChildren(fragment);
  }

  function updateInfo() {
    const oppPlayers = [];
    for (let p = 0; p < playerCount; p++) {
      if (p !== shownPlayer) oppPlayers.push(p);
    }
    oppBadges.forEach((entry, i) => {
      const p = oppPlayers[i];
      entry.nameEl.textContent = names[p];
      entry.countEl.textContent = text.remainPrefix + state.hands[p].length + text.sheetsSuffix;
      entry.badge.classList.toggle('is-active', !state.finished && state.current === p);
      entry.badge.classList.toggle('is-retired', !state.hands[p].length);
    });
    banner.textContent = names[state.current] + text.turnSuffix;
    banner.className = `kgb-turn-banner is-blinking kgb-player-${state.current % 2}`;
  }

  function showToast(message, ms, next) {
    toast.textContent = message;
    toast.hidden = false;
    later(() => {
      toast.hidden = true;
      next?.();
    }, ms);
  }

  // ペアの2枚（またはひいた1枚）を中央に見せる
  function showDrawn(cards, isPair, next) {
    pairPopup.replaceChildren();
    const label = document.createElement('p');
    label.className = 'kgb-om-pair-label';
    label.textContent = isPair ? text.omPairMade : '';
    const row = document.createElement('div');
    row.className = 'kgb-om-pair-cards';
    for (const id of cards) row.append(cardNode(id, true));
    pairPopup.append(row, label);
    pairPopup.hidden = false;
    later(() => {
      pairPopup.hidden = true;
      next?.();
    }, PAIR_SHOW_MS);
  }

  // ---------- ターン進行 ----------

  function isHumanTurn() {
    return isCpuMode ? state.current === 0 : true;
  }

  function advanceTurn() {
    if (state.finished) {
      finishGame();
      return;
    }
    updateInfo();
    if (!isCpuMode && state.current !== shownPlayer) {
      // ふたりモード: 手番の人に持ち替えてもらう
      inputLocked = true;
      handoverTitle.textContent = names[state.current] + text.turnSuffix;
      handover.hidden = false;
      return;
    }
    if (isHumanTurn()) {
      prepareHumanDraw();
    } else {
      scheduleRobotDraw();
    }
  }

  handover.addEventListener('click', () => {
    playTap();
    handover.hidden = true;
    shownPlayer = state.current;
    updateHandVisibility();
    buildHand(shownPlayer);
    updateInfo();
    prepareHumanDraw();
  }, { signal: abort.signal });

  function prepareHumanDraw() {
    buildFan();
    messageEl.textContent = text.omDrawPrompt;
    // つよいロボットは引かれる前に手札をまぜる（仕様§4.4）
    if (isCpuMode && config.level === 'strong' && sourceOf(state) !== 0) {
      inputLocked = true;
      fan.classList.add('is-shuffling');
      messageEl.textContent = text.omShuffled;
      playTurn();
      later(() => {
        shuffleSourceHand(state);
        fan.classList.remove('is-shuffling');
        messageEl.textContent = text.omDrawPrompt;
        inputLocked = false;
      }, SHUFFLE_MS);
      return;
    }
    inputLocked = false;
  }

  function scheduleRobotDraw() {
    inputLocked = true;
    fan.replaceChildren(); // ロボットの手番中は扇をしまう
    messageEl.textContent = '';
    later(() => {
      const robot = state.current;
      const source = sourceOf(state);
      const pos = Math.floor(Math.random() * state.hands[source].length);
      const takenId = state.hands[source][pos];

      const apply = () => {
        const result = drawAt(state, pos);
        messageEl.textContent = names[robot] + text.omDrewSuffix;
        resolveDraw(result, false);
      };
      if (source === shownPlayer) {
        // 自分の手札から抜かれるカードを一瞬ハイライトしてから消す
        const node = handEls[shownPlayer].querySelector(`[data-card-id="${takenId}"]`);
        node?.classList.add('is-taken');
        later(() => {
          removeCardNode(shownPlayer, takenId);
          apply();
        }, TAKE_SHOW_MS);
      } else {
        apply();
      }
    }, randomBetween(ROBOT_THINK_MS));
  }

  // 引いた結果の共通処理（人間・ロボット両方）
  function resolveDraw(result, byShownHuman) {
    updateInfo();
    const finishToasts = [];
    if (result.sourceFinished) finishToasts.push(names[result.source] + text.omFinishedSuffix);
    if (result.selfFinished) finishToasts.push(names[result.player] + text.omFinishedSuffix);

    const proceed = () => {
      if (finishToasts.length) {
        playWin();
        showToast(finishToasts.join('　'), FINISH_TOAST_MS, advanceTurn);
      } else {
        advanceTurn();
      }
    };

    if (result.pair) {
      playMatch();
      if (byShownHuman) emitPraise('found_pair');
      // 「おなじさがし」: そろった2枚を見せる（仕様§4.4の補助）
      showDrawn(result.pair, true, proceed);
    } else if (byShownHuman) {
      playFlip();
      showDrawn([result.card], false, () => {
        insertCardNode(shownPlayer, result.card);
        playPlace();
        proceed();
      });
    } else {
      playFlip();
      proceed();
    }
  }

  // 人間が扇からカードを選ぶ
  fan.addEventListener('click', (event) => {
    const back = event.target.closest('.kgb-om-back');
    if (!back) return;
    if (inputLocked || state.finished || !isHumanTurn() || state.current !== shownPlayer) return;
    inputLocked = true;
    const pos = Number(back.dataset.pos);
    const result = drawAt(state, pos);
    if (!result.ok) {
      inputLocked = false;
      return;
    }
    fan.replaceChildren();
    messageEl.textContent = '';
    resolveDraw(result, true);
  }, { signal: abort.signal });

  // ---------- 終了処理（保存はここで1回だけ。§9） ----------

  function finishGame() {
    emitPraise('finished_game');
    banner.className = 'kgb-turn-banner';
    fan.replaceChildren();
    messageEl.textContent = '';
    updateInfo();

    const humanIndex = isCpuMode ? 0 : null;
    const humanLost = isCpuMode ? state.loser === 0 : false;
    recordPlay('oldmaid', { won: isCpuMode && state.loser !== 0 });

    let title;
    if (isCpuMode) {
      if (state.loser === 0) {
        title = text.omLoserPrefix + text.you + text.omLoserBang;
      } else {
        title = state.finishedOrder[0] === 0 ? text.winYou : text.omEscaped;
      }
    } else {
      title = text.omLoserPrefix + names[state.loser] + text.omLoserBang;
    }

    // あがった順とばばもちを一覧で見せる
    const lines = state.finishedOrder.map(
      (player, i) => `${i + 1}${text.omRankSuffix}: ${names[player]}`,
    );
    lines.push(`🃏: ${names[state.loser]}`);
    let detail = lines.join('\n');
    if (humanLost) detail += `\n${text.playAgainTone}`; // ネガティブ演出禁止

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
    if (!humanLost) {
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
    inputLocked = true;
    toast.hidden = true;
    pairPopup.hidden = true;
    handover.hidden = true;
    resultOverlay.hidden = true;
    resultOverlay.replaceChildren();
    resetPraise();

    state = createGame({ smallDeck, playerCount });
    shownPlayer = isCpuMode ? 0 : state.current;
    updateHandVisibility();
    buildHand(0);
    if (!isCpuMode) buildHand(1);
    fan.replaceChildren();
    updateInfo();

    // 初期ペアの自動捨てを一言見せてから開始（仕様§4.4のアニメは簡易版）
    const discarded = state.initialDiscards.reduce((n, d) => n + d.length, 0);
    if (discarded > 0) {
      playMatch();
      showToast(text.omPairMade, 900, advanceTurn);
    } else {
      advanceTurn();
    }
  }

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
