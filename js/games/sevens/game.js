// game.js — 7ならべの純ロジック（DOM非依存・Nodeテスト可能）
// カードid = スート*13 + (ランク-1)。ランクは1〜13の数字で扱う
// （A/J/Q/K表記は使わない。数の順番を学べるよう全て数字で見せる知育方針。仕様§11）
// v0.4.1: 2〜4人戦に対応。パス超過はその人だけリタイア（手札を場に開く）して続行する。

export const SUITS = 4;   // 0=スペード 1=ハート 2=ダイヤ 3=クラブ
export const RANKS = 13;
export const SEVEN = 7;
export const MAX_PASSES = 3; // パスは3回まで。4回目でリタイア（仕様§4.2）

export const suitOf = (id) => Math.floor(id / RANKS);
export const rankOf = (id) => (id % RANKS) + 1;
export const cardId = (suit, rank) => suit * RANKS + (rank - 1);

export function createGame({ playerCount = 2, rng = Math.random } = {}) {
  // 7は最初から場に置く
  const board = Array.from({ length: SUITS }, () => new Array(RANKS).fill(false));
  const deck = [];
  for (let id = 0; id < SUITS * RANKS; id++) {
    if (rankOf(id) === SEVEN) {
      board[suitOf(id)][SEVEN - 1] = true;
    } else {
      deck.push(id);
    }
  }
  // Fisher-Yatesシャッフルして順番に配る（48枚は2/3/4人で割り切れる）
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const hands = Array.from({ length: playerCount }, () => []);
  deck.forEach((id, i) => hands[i % playerCount].push(id));
  // スート→数字順に並べておく（子どもが並びを見つけやすいように）
  for (const hand of hands) hand.sort((a, b) => a - b);

  return {
    playerCount,
    board,
    hands,
    passesLeft: new Array(playerCount).fill(MAX_PASSES),
    retired: new Array(playerCount).fill(false), // パス超過で抜けた人
    current: 0,
    finished: false,
    winner: null,
    endReason: null, // 'empty'(手札を出し切った) | 'passOver'(ほかが全員リタイア)
  };
}

// 次の手番（リタイアした人は飛ばす）
function nextActive(state, from) {
  let p = from;
  do {
    p = (p + 1) % state.playerCount;
  } while (state.retired[p]);
  return p;
}

// スートごとの「次に出せる数字」。low/highがnullなら端(1/13)まで到達済み
export function getNeeds(state) {
  return state.board.map((row) => {
    let min = SEVEN;
    let max = SEVEN;
    while (min - 2 >= 0 && row[min - 2]) min--;
    while (max < RANKS && row[max]) max++;
    return {
      low: min > 1 ? min - 1 : null,
      high: max < RANKS ? max + 1 : null,
    };
  });
}

export function isPlayable(state, id) {
  const need = getNeeds(state)[suitOf(id)];
  const rank = rankOf(id);
  return rank === need.low || rank === need.high;
}

export function getPlayableIds(state, player) {
  return state.hands[player].filter((id) => isPlayable(state, id));
}

// 現在の手番がカードを出す。出せる位置は自動で決まる（タップのみ操作の仕様）
export function playCard(state, id) {
  if (state.finished) return { ok: false };
  const hand = state.hands[state.current];
  if (!hand.includes(id) || !isPlayable(state, id)) return { ok: false };

  state.board[suitOf(id)][rankOf(id) - 1] = true;
  hand.splice(hand.indexOf(id), 1);

  if (hand.length === 0) {
    state.finished = true;
    state.winner = state.current;
    state.endReason = 'empty';
    return { ok: true, type: 'win' };
  }
  state.current = nextActive(state, state.current);
  return { ok: true, type: 'played' };
}

// パスする。残りが無い状態でのパスはリタイア（手札を場に開いてゲームから抜ける）
export function passTurn(state) {
  if (state.finished) return { ok: false };
  const player = state.current;

  if (state.passesLeft[player] === 0) {
    state.retired[player] = true;
    const placedCards = [...state.hands[player]];
    for (const id of placedCards) {
      state.board[suitOf(id)][rankOf(id) - 1] = true;
    }
    state.hands[player] = [];
    const active = [];
    state.retired.forEach((r, p) => { if (!r) active.push(p); });
    if (active.length === 1) {
      // 最後まで残った人が勝ち
      state.finished = true;
      state.winner = active[0];
      state.endReason = 'passOver';
    } else {
      state.current = nextActive(state, player);
    }
    return { ok: true, type: 'retire', placedCards, retiredPlayer: player };
  }

  state.passesLeft[player]--;
  state.current = nextActive(state, player);
  return { ok: true, type: 'passed' };
}
