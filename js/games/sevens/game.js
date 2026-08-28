// game.js — 7ならべの純ロジック（DOM非依存・Nodeテスト可能）
// カードid = スート*13 + (ランク-1)。ランクは1〜13の数字で扱う
// （A/J/Q/K表記は使わない。数の順番を学べるよう全て数字で見せる知育方針。仕様§12）

export const SUITS = 4;   // 0=スペード 1=ハート 2=ダイヤ 3=クラブ
export const RANKS = 13;
export const SEVEN = 7;
export const MAX_PASSES = 3; // パスは3回まで。4回目で敗北（仕様§4.2）

export const suitOf = (id) => Math.floor(id / RANKS);
export const rankOf = (id) => (id % RANKS) + 1;
export const cardId = (suit, rank) => suit * RANKS + (rank - 1);

export function createGame({ rng = Math.random } = {}) {
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
  // Fisher-Yatesシャッフルして交互に配る
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const hands = [[], []];
  deck.forEach((id, i) => hands[i % 2].push(id));
  // スート→数字順に並べておく（子どもが並びを見つけやすいように）
  for (const hand of hands) hand.sort((a, b) => a - b);

  return {
    board,
    hands,
    passesLeft: [MAX_PASSES, MAX_PASSES],
    current: 0,
    finished: false,
    winner: null,
    loser: null,
    endReason: null, // 'empty'(手札を出し切った) | 'passOver'(パス超過)
  };
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
  state.current = 1 - state.current;
  return { ok: true, type: 'played' };
}

// パスする。残りが無い状態でのパスは敗北（残りの手札は場に自動で開く）
export function passTurn(state) {
  if (state.finished) return { ok: false };
  const player = state.current;
  if (state.passesLeft[player] === 0) {
    state.finished = true;
    state.loser = player;
    state.winner = 1 - player;
    state.endReason = 'passOver';
    const placedCards = [...state.hands[player]];
    for (const id of placedCards) {
      state.board[suitOf(id)][rankOf(id) - 1] = true;
    }
    state.hands[player] = [];
    return { ok: true, type: 'lose', placedCards };
  }
  state.passesLeft[player]--;
  state.current = 1 - player;
  return { ok: true, type: 'passed' };
}
