// game.js — ばばぬきの純ロジック（DOM非依存・Nodeテスト可能）
// カードid = スート*13 + (ランク-1)。ジョーカー(ばば)は特別なid。
// ランクは数字1〜13で扱う（A/J/Q/K表記を使わない知育方針。仕様§11）。

export const JOKER = 999;

export const suitOf = (id) => (id === JOKER ? null : Math.floor(id / 13));
export const rankOf = (id) => (id === JOKER ? 0 : (id % 13) + 1);
export const cardId = (suit, rank) => suit * 13 + (rank - 1);

// ジョーカーは一番うしろ、それ以外は数字→マーク順（子どもがペアを見つけやすい並び）
function sortHand(hand) {
  hand.sort((a, b) => sortKey(a) - sortKey(b));
}

function sortKey(id) {
  return id === JOKER ? 9999 : rankOf(id) * 10 + suitOf(id);
}

// 手札から同じ数字のペアを取り除く（配札直後の自動捨て。仕様§4.4）
function removePairs(hand) {
  const seen = new Map(); // rank -> id
  const discards = [];
  for (const id of [...hand]) {
    if (id === JOKER) continue;
    const rank = rankOf(id);
    if (seen.has(rank)) {
      const other = seen.get(rank);
      seen.delete(rank);
      discards.push([other, id]);
      hand.splice(hand.indexOf(other), 1);
      hand.splice(hand.indexOf(id), 1);
    } else {
      seen.set(rank, id);
    }
  }
  return discards;
}

// smallDeck: 1〜6の24枚＋ばば=25枚の短時間版（4歳の集中時間対策。仕様§4.4）
export function createGame({ smallDeck = false, playerCount = 3, rng = Math.random } = {}) {
  const maxRank = smallDeck ? 6 : 13;
  const cards = [];
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 1; rank <= maxRank; rank++) cards.push(cardId(suit, rank));
  }
  cards.push(JOKER);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  const hands = Array.from({ length: playerCount }, () => []);
  cards.forEach((id, i) => hands[i % playerCount].push(id));

  const initialDiscards = hands.map((hand) => removePairs(hand));
  hands.forEach(sortHand);

  const state = {
    playerCount,
    hands,
    initialDiscards,
    finishedOrder: [], // あがった順（1ぬけ・2ぬけ…）
    current: 0,
    finished: false,
    loser: null, // 最後までばばを持っていた人
  };
  // 初期ペアで手札が空になった人は即あがり（まれだが起こりうる）
  hands.forEach((hand, player) => {
    if (!hand.length) state.finishedOrder.push(player);
  });
  if (!state.hands[state.current].length) {
    state.current = nextActive(state, state.current);
  }
  checkGameOver(state);
  return state;
}

// fromの次にまだ手札がある人（あがった人は飛ばす）
export function nextActive(state, from) {
  let p = from;
  do {
    p = (p + 1) % state.playerCount;
  } while (!state.hands[p].length && p !== from);
  return p;
}

// いま引く相手（となりの人）
export function sourceOf(state) {
  return nextActive(state, state.current);
}

function checkGameOver(state) {
  const active = [];
  for (let p = 0; p < state.playerCount; p++) {
    if (state.hands[p].length) active.push(p);
  }
  if (active.length <= 1) {
    state.finished = true;
    state.loser = active[0] ?? null;
  }
}

// 現在の手番が、となりの手札のpos番目を引く。
// ペアが成立したら自動で捨てる（ばばはペアにならない）。手番はとなりへ順送り
export function drawAt(state, pos) {
  if (state.finished) return { ok: false };
  const source = sourceOf(state);
  const sourceHand = state.hands[source];
  if (pos < 0 || pos >= sourceHand.length) return { ok: false };

  const card = sourceHand.splice(pos, 1)[0];
  const myHand = state.hands[state.current];
  const matchIndex =
    card === JOKER ? -1 : myHand.findIndex((id) => id !== JOKER && rankOf(id) === rankOf(card));

  let pair = null;
  if (matchIndex >= 0) {
    pair = [card, myHand.splice(matchIndex, 1)[0]];
  } else {
    myHand.push(card);
    sortHand(myHand);
  }

  const result = {
    ok: true,
    card,
    pair,
    player: state.current,
    source,
    sourceFinished: false,
    selfFinished: false,
  };
  if (!sourceHand.length) {
    state.finishedOrder.push(source);
    result.sourceFinished = true;
  }
  if (!myHand.length) {
    state.finishedOrder.push(state.current);
    result.selfFinished = true;
  }
  checkGameOver(state);
  if (!state.finished) {
    // 手番は「引かれた人」へ順送り。あがっていたらその次へ
    state.current = state.hands[source].length ? source : nextActive(state, source);
  }
  result.gameOver = state.finished;
  return result;
}

// つよいロボットの「まぜまぜ」: 引かれる前に手札の並びをシャッフルして
// 前回おぼえた位置を無効化する（仕様§4.4）
export function shuffleSourceHand(state, rng = Math.random) {
  const hand = state.hands[sourceOf(state)];
  for (let i = hand.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [hand[i], hand[j]] = [hand[j], hand[i]];
  }
}
