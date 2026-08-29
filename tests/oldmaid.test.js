// oldmaid.test.js — ばばぬきの純ロジック（game.js）のNodeテスト
// 実行方法: node tests/oldmaid.test.js

import assert from 'node:assert';
import {
  JOKER,
  rankOf,
  cardId,
  createGame,
  nextActive,
  sourceOf,
  drawAt,
  shuffleSourceHand,
} from '../js/games/oldmaid/game.js';

function makeRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

// ---------- 配札と初期ペア捨て ----------

{
  const state = createGame({ smallDeck: true, playerCount: 3, rng: makeRng([0.5, 0.2, 0.8]) });
  const total = state.hands.flat().length;
  const discarded = state.initialDiscards.flat().length * 2 / 2; // ペア数×2枚
  // 25枚 = 手札の残り + 捨てたペアの枚数
  const discardCount = state.initialDiscards.reduce((n, d) => n + d.length * 2, 0);
  assert.strictEqual(total + discardCount, 25, 'かんたんは25枚（1〜6×4＋ばば）');

  // 初期ペア捨て後、どの手札にも同じ数字は2枚ない
  for (const hand of state.hands) {
    const ranks = hand.filter((id) => id !== JOKER).map(rankOf);
    assert.strictEqual(new Set(ranks).size, ranks.length, '手札に同じ数字が残っていない');
  }
  // ばばは捨てられていない
  assert.ok(state.hands.flat().includes(JOKER), 'ばばはだれかの手札にある');
  for (const discards of state.initialDiscards) {
    for (const [a, b] of discards) {
      assert.notStrictEqual(a, JOKER);
      assert.notStrictEqual(b, JOKER);
      assert.strictEqual(rankOf(a), rankOf(b), '捨てたのは同じ数字のペア');
    }
  }
}

{
  const state = createGame({ smallDeck: false, playerCount: 2, rng: makeRng([0.3, 0.7]) });
  const discardCount = state.initialDiscards.reduce((n, d) => n + d.length * 2, 0);
  assert.strictEqual(state.hands.flat().length + discardCount, 53, 'ふつうは53枚');
}

// ---------- 引き: ペア成立と手札移動 ----------

{
  // 手作り盤面: あなた[♠1] ロボ1[♥1] ロボ2[ばば]
  const state = {
    playerCount: 3,
    hands: [[cardId(0, 1)], [cardId(1, 1)], [JOKER]],
    initialDiscards: [[], [], []],
    finishedOrder: [],
    current: 0,
    finished: false,
    loser: null,
  };
  assert.strictEqual(sourceOf(state), 1, 'となり（ロボ1）から引く');
  const result = drawAt(state, 0);
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.pair, [cardId(1, 1), cardId(0, 1)], '同じ数字でペア成立');
  assert.strictEqual(result.sourceFinished, true, '引かれたロボ1は手札0であがり');
  assert.strictEqual(result.selfFinished, true, 'あなたもペアで手札0になりあがり');
  assert.strictEqual(result.gameOver, true, 'のこりはロボ2だけ');
  assert.strictEqual(state.loser, 2, 'ばばを持っていたロボ2のまけ');
  assert.deepStrictEqual(state.finishedOrder, [1, 0], 'あがった順が記録される');
}

// ---------- 引き: ペアにならないカードは手札に入る ----------

{
  const state = {
    playerCount: 3,
    hands: [[cardId(0, 1)], [cardId(1, 2), JOKER], [cardId(2, 3)]],
    initialDiscards: [[], [], []],
    finishedOrder: [],
    current: 0,
    finished: false,
    loser: null,
  };
  const result = drawAt(state, 0); // ♥2を引く
  assert.strictEqual(result.pair, null, 'ペアにならない');
  assert.deepStrictEqual(state.hands[0], [cardId(0, 1), cardId(1, 2)], '手札に加わり数字順に並ぶ');
  assert.strictEqual(state.current, 1, '手番は引かれた人へ順送り');
  assert.strictEqual(state.finished, false);
}

// ---------- ばばを引いてもペアにならない ----------

{
  const state = {
    playerCount: 2,
    hands: [[cardId(0, 1)], [JOKER, cardId(1, 1)]],
    initialDiscards: [[], []],
    finishedOrder: [],
    current: 0,
    finished: false,
    loser: null,
  };
  const result = drawAt(state, 0); // ばばを引く
  assert.strictEqual(result.card, JOKER);
  assert.strictEqual(result.pair, null, 'ばばはペアにならない');
  assert.deepStrictEqual(state.hands[0], [cardId(0, 1), JOKER], 'ばばは並びの一番うしろ');
}

// ---------- あがった人は手番・引き先から飛ばされる ----------

{
  const state = {
    playerCount: 3,
    hands: [[cardId(0, 5)], [], [cardId(0, 6), JOKER]],
    initialDiscards: [[], [], []],
    finishedOrder: [1],
    current: 0,
    finished: false,
    loser: null,
  };
  assert.strictEqual(sourceOf(state), 2, 'あがったロボ1を飛ばしてロボ2から引く');
  assert.strictEqual(nextActive(state, 2), 0, '一周して戻る');
}

// ---------- まぜまぜ: 並びは変わるが中身は同じ ----------

{
  const state = {
    playerCount: 2,
    hands: [[cardId(0, 1)], [cardId(1, 2), cardId(2, 3), cardId(3, 4), JOKER, cardId(0, 5)]],
    initialDiscards: [[], []],
    finishedOrder: [],
    current: 0,
    finished: false,
    loser: null,
  };
  const before = [...state.hands[1]];
  shuffleSourceHand(state, makeRng([0.9, 0.1, 0.6, 0.3]));
  assert.deepStrictEqual([...state.hands[1]].sort(), [...before].sort(), '中身は同じ');
  assert.notDeepStrictEqual(state.hands[1], before, '並びは変わる');
}

// ---------- 通しプレイ: ランダムに引き続けて必ず決着する ----------

for (const [smallDeck, playerCount] of [[true, 3], [false, 3], [true, 2], [false, 4]]) {
  const rng = makeRng([0.13, 0.67, 0.42, 0.91, 0.28, 0.55]);
  const state = createGame({ smallDeck, playerCount, rng });
  let guard = 0;
  while (!state.finished && guard < 500) {
    guard++;
    const source = sourceOf(state);
    const pos = Math.floor(rng() * state.hands[source].length);
    const result = drawAt(state, pos);
    assert.strictEqual(result.ok, true, '引きは常に成功する');
  }
  assert.ok(state.finished, `${playerCount}人戦(${smallDeck ? '25' : '53'}枚): 決着する`);
  assert.notStrictEqual(state.loser, null, 'ばばもちが決まる');
  assert.deepStrictEqual(
    [...state.hands[state.loser]],
    [JOKER],
    '最後に残るのはばば1枚だけ',
  );
  assert.strictEqual(state.finishedOrder.length, playerCount - 1, '全員のあがり順が記録される');
}

console.log('oldmaid.test.js: すべてのテストに合格');
