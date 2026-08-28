// cpu.js — 7ならべのCPU思考（仕様§4.2）
//   よわい: 出せるカードからランダム。自分からはパスしない
//   ふつう: 端(1/13)に近いカードを優先して出す
//   つよい: 相手を止められるカード（止め札）を温存し、パスを戦略的に使う

import { rankOf, suitOf, cardId, RANKS, getPlayableIds } from './game.js';

function randomPick(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

// 戻り値: { type: 'play', cardId } または { type: 'pass' }
export function chooseAction(state, level, rng = Math.random) {
  const playable = getPlayableIds(state, state.current);
  if (!playable.length) return { type: 'pass' };

  if (level === 'weak') {
    return { type: 'play', cardId: randomPick(playable, rng) };
  }

  if (level === 'normal') {
    // 端に近いほど「その列を早く終わらせられる」ので優先
    const distToEnd = (id) => Math.min(rankOf(id) - 1, RANKS - rankOf(id));
    const minDist = Math.min(...playable.map(distToEnd));
    return { type: 'play', cardId: randomPick(playable.filter((id) => distToEnd(id) === minDist), rng) };
  }

  // つよい: カードを出した先（端方向）の残りが自分の手札にどれだけあるかで採点。
  // 自分の続きが多い=出すと自分が有利、相手の札が多い=止め札なので出すと相手を助ける
  const hand = new Set(state.hands[state.current]);
  const score = (id) => {
    const suit = suitOf(id);
    const rank = rankOf(id);
    const dir = rank < 7 ? -1 : 1;
    let mine = 0;
    let others = 0;
    for (let r = rank + dir; r >= 1 && r <= RANKS; r += dir) {
      if (hand.has(cardId(suit, r))) mine++;
      else others++;
    }
    return mine - others;
  };
  let best = [];
  let bestScore = -Infinity;
  for (const id of playable) {
    const s = score(id);
    if (s > bestScore) {
      bestScore = s;
      best = [id];
    } else if (s === bestScore) {
      best.push(id);
    }
  }
  // 出せるのが強い止め札だけならパスを使って温存する（パスが残っている場合のみ）
  if (bestScore <= -3 && state.passesLeft[state.current] > 0) {
    return { type: 'pass' };
  }
  return { type: 'play', cardId: randomPick(best, rng) };
}
