// ui.js — ばばぬきの描画・入力（v0.7.1）
// 「人と対戦している」見た目のためのテーブル型レイアウト:
//   上段にどうぶつのおともだち（アバター）が並び、手番の子が光って弾む。
//   カードは配るとき・引くときに実際に飛んでいく（transformのみのアニメ）。
// 手札はカード単位のノード追加・削除のみ（§9）。タイマーは全部timersで管理しdestroyで解除。

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
const FRIEND_FACES = ['🐻', '🐰', '🐱', '🐼', '🐥'];

const ROBOT_THINK_MS = [800, 1200]; // 「◯◯から ひくよ…」を見せる時間
const FLIGHT_MS = 450;              // カードが飛ぶ時間
const DEAL_STEP_MS = 150;           // 配り演出の1枚あたりの間隔
const TAKE_SHOW_MS = 450;
const PAIR_SHOW_MS = 1000;
const MINI_PAIR_MS = 900;
const FINISH_TOAST_MS = 900;
const SHUFFLE_MS = 800;

export function mount(root, config, { onExit }) {
  const abort = new AbortController();
  const timers = new Set();

  const isCpuMode = config.mode === 'cpu';
  const robotCount = isCpuMode ? Number(config.robots ?? 2) : 0;
  const playerCount = isCpuMode ? robotCount + 1 : 2;
  const smallDeck = config.size === 'easy';

  const names = isCpuMode
    ? [text.you, ...text.omFriends.slice(0, robotCount)]
    : [text.redName, text.blueName];
  const faces = isCpuMode
    ? ['😊', ...FRIEND_FACES.slice(0, robotCount)]
    : ['🔴', '🔵'];

  let state = null;
  let inputLocked = true;
  let shownPlayer = 0;

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

  // おともだち（対戦あいて）のアバター列
  const tableRow = document.createElement('div');
  tableRow.className = playerCount - 1 >= 4 ? 'kgb-om-table is-crowd' : 'kgb-om-table';
  const playerEls = []; // 全プレイヤーぶん（自分も含む。自分は下段に置く）
  for (let p = 0; p < playerCount; p++) {
    const seat = document.createElement('div');
    seat.className = 'kgb-om-seat';
    const face = document.createElement('div');
    face.className = 'kgb-om-face';
    face.textContent = faces[p];
    const nameEl = document.createElement('div');
    nameEl.className = 'kgb-om-name';
    nameEl.textContent = names[p];
    const countEl = document.createElement('div');
    countEl.className = 'kgb-om-count';
    const miniPair = document.createElement('div');
    miniPair.className = 'kgb-om-minipair';
    miniPair.hidden = true;
    seat.append(face, nameEl, countEl, miniPair);
    playerEls.push({ seat, face, countEl, miniPair });
  }

  // 中央: くばる山札（演出用）＋メッセージ
  const deckEl = document.createElement('div');
  deckEl.className = 'kgb-om-deck';
  deckEl.textContent = '★';
  deckEl.hidden = true;

  const messageEl = document.createElement('div');
  messageEl.className = 'kgb-om-message';

  // 「だれの てふだ」から選んでいるかのラベル（扇の持ち主）
  const fanOwner = document.createElement('div');
  fanOwner.className = 'kgb-om-fan-owner';
  fanOwner.hidden = true;

  const fan = document.createElement('div');
  fan.className = 'kgb-om-fan';

  // 自分の席（アバター＋名前）
  const meRow = document.createElement('div');
  meRow.className = 'kgb-om-me-row';

  const handEls = [document.createElement('div'), document.createElement('div')];
  for (const el of handEls) el.className = 'kgb-om-hand';

  // 飛ぶカード（使い回しの1枚。transformで移動）
  const flightEl = document.createElement('div');
  flightEl.className = 'kgb-om-flight';
  flightEl.textContent = '★';
  flightEl.hidden = true;

  const pairPopup = document.createElement('div');
  pairPopup.className = 'kgb-om-pair-popup';
  pairPopup.hidden = true;

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

  container.append(tableRow, deckEl, messageEl, fanOwner, fan, meRow, handEls[0], handEls[1]);
  root.append(container, flightEl, pairPopup, handover, toast, resultOverlay);

  // 席の配置: 表示中プレイヤーは下段(meRow)、それ以外は上段(tableRow)
  function arrangeSeats() {
    for (let p = 0; p < playerCount; p++) {
      if (p === shownPlayer) meRow.append(playerEls[p].seat);
      else tableRow.append(playerEls[p].seat);
    }
    playerEls[shownPlayer].seat.classList.add('is-me');
    for (let p = 0; p < playerCount; p++) {
      if (p !== shownPlayer) playerEls[p].seat.classList.remove('is-me');
    }
  }

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

  function insertCardNode(player, id) {
    const index = state.hands[player].indexOf(id);
    const el = handEls[player];
    el.insertBefore(cardNode(id, true), el.children[index] ?? null);
  }

  function removeCardNode(player, id) {
    handEls[player].querySelector(`[data-card-id="${id}"]`)?.remove();
  }

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
    for (let p = 0; p < playerCount; p++) {
      const entry = playerEls[p];
      const finished = !state.hands[p].length;
      entry.countEl.textContent = finished
        ? text.omFinishedLabel
        : state.hands[p].length + text.sheetsSuffix;
      entry.seat.classList.toggle('is-active', !state.finished && state.current === p);
      entry.seat.classList.toggle('is-finished', finished && !state.finished);
      entry.seat.classList.remove('is-source'); // 引き元の強調は毎回リセットして付け直す
    }
    fanOwner.hidden = true;
  }

  // 引き元の子を前にせり出させて「だれの てふだ か」を見せる
  function highlightSource(source) {
    playerEls[source].seat.classList.add('is-source');
    fanOwner.textContent = `${faces[source]} ${names[source]}${text.omFanOwnerSuffix}`;
    fanOwner.hidden = false;
  }

  function showToast(message, ms, next) {
    toast.textContent = message;
    toast.hidden = false;
    later(() => {
      toast.hidden = true;
      next?.();
    }, ms);
  }

  // ---------- カードが飛ぶ演出（fromEl→toElへtransformで移動） ----------

  function flyCard(fromEl, toEl, next) {
    const from = fromEl.getBoundingClientRect();
    const to = toEl.getBoundingClientRect();
    flightEl.hidden = false;
    flightEl.style.transition = 'none';
    flightEl.style.transform =
      `translate(${from.left + from.width / 2 - 18}px, ${from.top + from.height / 2 - 25}px)`;
    void flightEl.offsetWidth; // reflowを挟んでアニメを確実に開始する
    flightEl.style.transition = `transform ${FLIGHT_MS}ms ease`;
    flightEl.style.transform =
      `translate(${to.left + to.width / 2 - 18}px, ${to.top + to.height / 2 - 25}px)`;
    later(() => {
      flightEl.hidden = true;
      next?.();
    }, FLIGHT_MS + 30);
  }

  // 自分のペア: 中央に大きく／おともだちのペア: その子の上に小さく「ペア！」
  function showOwnPair(cards, next) {
    pairPopup.replaceChildren();
    const row = document.createElement('div');
    row.className = 'kgb-om-pair-cards';
    for (const id of cards) row.append(cardNode(id, true));
    const label = document.createElement('p');
    label.className = 'kgb-om-pair-label';
    label.textContent = text.omPairMade;
    pairPopup.append(row, label);
    pairPopup.hidden = false;
    later(() => {
      pairPopup.hidden = true;
      next?.();
    }, PAIR_SHOW_MS);
  }

  function showMiniPair(player, rank, next) {
    const mini = playerEls[player].miniPair;
    mini.textContent = `${rank} ${text.omPairMini}`;
    mini.hidden = false;
    later(() => {
      mini.hidden = true;
      next?.();
    }, MINI_PAIR_MS);
  }

  function showDrawnSingle(card, next) {
    pairPopup.replaceChildren();
    const row = document.createElement('div');
    row.className = 'kgb-om-pair-cards';
    row.append(cardNode(card, true));
    pairPopup.append(row);
    pairPopup.hidden = false;
    later(() => {
      pairPopup.hidden = true;
      next?.();
    }, PAIR_SHOW_MS * 0.8);
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
    arrangeSeats();
    updateHandVisibility();
    buildHand(shownPlayer);
    updateInfo();
    prepareHumanDraw();
  }, { signal: abort.signal });

  function prepareHumanDraw() {
    buildFan();
    const source = sourceOf(state);
    highlightSource(source);
    messageEl.textContent = names[source] + text.omDrawFromSuffix;
    if (isCpuMode && config.level === 'strong' && source !== 0) {
      inputLocked = true;
      fan.classList.add('is-shuffling');
      messageEl.textContent = names[source] + 'の ' + text.omShuffled;
      playTurn();
      later(() => {
        shuffleSourceHand(state);
        fan.classList.remove('is-shuffling');
        messageEl.textContent = names[source] + text.omDrawFromSuffix;
        inputLocked = false;
      }, SHUFFLE_MS);
      return;
    }
    inputLocked = false;
  }

  function scheduleRobotDraw() {
    inputLocked = true;
    fan.replaceChildren();
    const robot = state.current;
    const source = sourceOf(state);
    // だれがだれから引くのかを先に見せる（人と遊んでいる感）
    if (source !== shownPlayer) playerEls[source].seat.classList.add('is-source');
    messageEl.textContent = names[robot] + text.omRobotDrawMid + names[source] + text.omRobotDrawSuffix;
    later(() => {
      const pos = Math.floor(Math.random() * state.hands[source].length);
      const takenId = state.hands[source][pos];
      const fromEl = source === shownPlayer
        ? (handEls[shownPlayer].querySelector(`[data-card-id="${takenId}"]`) ?? playerEls[source].seat)
        : playerEls[source].seat;
      const toEl = playerEls[robot].seat;

      const doFly = () => {
        playFlip();
        flyCard(fromEl, toEl, () => {
          const result = drawAt(state, pos);
          messageEl.textContent = '';
          resolveDraw(result, false);
        });
      };
      if (source === shownPlayer) {
        fromEl.classList?.add('is-taken');
        later(() => {
          removeCardNode(shownPlayer, takenId);
          doFly();
        }, TAKE_SHOW_MS);
      } else {
        doFly();
      }
    }, randomBetween(ROBOT_THINK_MS));
  }

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
      if (byShownHuman) {
        // 自分のペア: そろった側のカードを手札の表示からも取り除く（消し忘れバグ修正）
        removeCardNode(shownPlayer, result.pair[1]);
        playMatch();
        emitPraise('found_pair');
        showOwnPair(result.pair, proceed);
      } else {
        // おともだちのペア: その子の上に小さく＋ひかえめな音
        playPlace();
        showMiniPair(result.player, rankOf(result.pair[0]), proceed);
      }
    } else if (byShownHuman) {
      playFlip();
      showDrawnSingle(result.card, () => {
        insertCardNode(shownPlayer, result.card);
        playPlace();
        proceed();
      });
    } else {
      proceed();
    }
  }

  fan.addEventListener('click', (event) => {
    const back = event.target.closest('.kgb-om-back');
    if (!back) return;
    if (inputLocked || state.finished || !isHumanTurn() || state.current !== shownPlayer) return;
    inputLocked = true;
    const pos = Number(back.dataset.pos);
    const source = sourceOf(state);
    // 引いたカードが自分の席へ飛んでくる
    playFlip();
    flyCard(back, playerEls[shownPlayer].seat, () => {
      const result = drawAt(state, pos);
      if (!result.ok) {
        inputLocked = false;
        return;
      }
      fan.replaceChildren();
      messageEl.textContent = '';
      resolveDraw(result, true);
    });
  }, { signal: abort.signal });

  // ---------- くばる演出（スタート時） ----------

  function playDealIntro() {
    inputLocked = true;
    deckEl.hidden = false;
    fan.replaceChildren();
    handEls[0].replaceChildren();
    handEls[1].replaceChildren();
    messageEl.textContent = text.omDealing;

    // 1人2枚ぶんだけ飛ばして「配った感」を出す（全部飛ばすと長すぎるため）
    const flights = [];
    for (let round = 0; round < 2; round++) {
      for (let p = 0; p < playerCount; p++) flights.push(p);
    }
    flights.forEach((p, i) => {
      later(() => {
        playFlip();
        flyCard(deckEl, playerEls[p].seat, null);
      }, i * DEAL_STEP_MS);
    });

    later(() => {
      deckEl.hidden = true;
      buildHand(shownPlayer);
      if (!isCpuMode) buildHand(1 - shownPlayer);
      playPlace();
      updateInfo();
      // 初期ペアの自動捨て
      messageEl.textContent = text.omDropPairs;
      const myDiscards = state.initialDiscards[shownPlayer];
      const step2 = () => {
        messageEl.textContent = '';
        advanceTurn();
      };
      later(() => {
        if (myDiscards.length) {
          playMatch();
          showOwnPair(myDiscards[0], step2); // 代表して1くみ見せる
        } else {
          step2();
        }
      }, 900);
    }, flights.length * DEAL_STEP_MS + FLIGHT_MS + 200);
  }

  // ---------- 終了処理（保存はここで1回だけ。§9） ----------

  function finishGame() {
    emitPraise('finished_game');
    fan.replaceChildren();
    messageEl.textContent = '';
    updateInfo();

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
    flightEl.hidden = true;
    handover.hidden = true;
    resultOverlay.hidden = true;
    resultOverlay.replaceChildren();
    resetPraise();

    state = createGame({ smallDeck, playerCount });
    shownPlayer = isCpuMode ? 0 : state.current;
    arrangeSeats();
    updateHandVisibility();
    updateInfo();
    playDealIntro();
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
