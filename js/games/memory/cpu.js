// cpu.js — 神経衰弱のCPU思考（記憶精度で難易度を表現。仕様§4.3）
//   よわい: 直近2枚だけ記憶
//   ふつう: めくられたカードを70%の確率で記憶
//   つよい: 全て記憶（既知ペアがあれば必ず取る）
// 誰かがカードをめくるたびにui.jsがremember()を呼ぶ。

export function createCpu(level, rng = Math.random) {
  // seen: index -> face。Mapは挿入順を保つので「直近2枚」の管理に使える
  const seen = new Map();

  function remember(index, face) {
    if (level === 'normal' && rng() >= 0.7) return; // 30%は覚えない
    seen.delete(index); // 同じカードを見直したら「最新の記憶」に更新する
    seen.set(index, face);
    if (level === 'weak') {
      while (seen.size > 2) {
        seen.delete(seen.keys().next().value); // 一番古い記憶を忘れる
      }
    }
  }

  // まだ取られておらず表にもなっていないカードのindex一覧
  function availableIndices(state) {
    return state.cards
      .map((card, index) => ({ card, index }))
      .filter(({ card, index }) => !card.matched && !state.faceUp.includes(index))
      .map(({ index }) => index);
  }

  function randomPick(list) {
    return list[Math.floor(rng() * list.length)];
  }

  // 記憶の中に場に残っているペアがあればその2枚を返す
  function findKnownPair(state) {
    const available = new Set(availableIndices(state));
    const byFace = new Map(); // face -> index
    for (const [index, face] of seen) {
      if (!available.has(index)) continue;
      if (byFace.has(face)) return [byFace.get(face), index];
      byFace.set(face, index);
    }
    return null;
  }

  function pickFirst(state) {
    const pair = findKnownPair(state);
    if (pair) return pair[0];
    return randomPick(availableIndices(state));
  }

  function pickSecond(state, firstIndex, firstFace) {
    const candidates = availableIndices(state).filter((i) => i !== firstIndex);
    // 1枚目の相方を覚えていればそれを取る
    for (const [index, face] of seen) {
      if (index !== firstIndex && face === firstFace && candidates.includes(index)) {
        return index;
      }
    }
    return randomPick(candidates);
  }

  // テスト用: 覚えている内容のコピーを返す
  function debugMemory() {
    return new Map(seen);
  }

  return { remember, pickFirst, pickSecond, debugMemory };
}
