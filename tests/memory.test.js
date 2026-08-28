// memory.test.js — 神経衰弱の純ロジック（game.js / cpu.js）のNodeテスト
// 実行方法: node tests/memory.test.js

import assert from 'node:assert';
import {
  PAIR_COUNTS,
  createGame,
  canFlip,
  flipCard,
  resolveMismatch,
  getWinners,
} from '../js/games/memory/game.js';
import { createCpu } from '../js/games/memory/cpu.js';

// 並び順を固定するためのシャッフルしないrng（Fisher-Yatesでj=0になり逆順になる）
const fixedRng = () => 0;

// faceで2枚のindexを探すヘルパー
function findPair(state, face) {
  const indices = [];
  state.cards.forEach((card, i) => {
    if (card.face === face) indices.push(i);
  });
  return indices;
}

// ---------- createGame ----------

{
  const state = createGame({ pairCount: 4, playerCount: 2 });
  assert.strictEqual(state.cards.length, 8, 'ペア数4なら8枚');
  // 各faceがちょうど2枚ずつある
  for (let face = 0; face < 4; face++) {
    assert.strictEqual(findPair(state, face).length, 2, `face${face}は2枚`);
  }
  assert.deepStrictEqual(state.scores, [0, 0], 'スコア初期値');
  assert.strictEqual(state.finished, false);
  assert.strictEqual(PAIR_COUNTS.hard, 12, 'むずかしいは12ペア(24枚)');
}

// ---------- めくりの制約 ----------

{
  const state = createGame({ pairCount: 4, playerCount: 1, rng: fixedRng });
  const [a] = findPair(state, 0);
  assert.strictEqual(flipCard(state, a).type, 'first', '1枚目はfirst');
  assert.strictEqual(canFlip(state, a), false, '同じカードは2回めくれない');
  assert.strictEqual(flipCard(state, a).ok, false);
  assert.strictEqual(canFlip(state, 999), false, '存在しないindexは不可');
}

// ---------- 一致: スコア加算＋手番継続＋終了判定 ----------

{
  const state = createGame({ pairCount: 2, playerCount: 2, rng: fixedRng });
  const [a, b] = findPair(state, 0);
  flipCard(state, a);
  const result = flipCard(state, b);
  assert.strictEqual(result.type, 'match', '同じ絵柄はmatch');
  assert.strictEqual(state.scores[0], 1, 'プレイヤー0に1ペア');
  assert.strictEqual(state.currentPlayer, 0, '一致したら手番はそのまま');
  assert.strictEqual(state.faceUp.length, 0, '一致後faceUpは空');
  assert.strictEqual(state.finished, false, 'まだ1ペア残っている');

  const [c, d] = findPair(state, 1);
  flipCard(state, c);
  const last = flipCard(state, d);
  assert.strictEqual(last.finished, true, '全部そろったら終了');
  assert.strictEqual(state.finished, true);
  assert.strictEqual(canFlip(state, 0), false, '終了後はめくれない');
}

// ---------- 不一致: 1秒表示のあとresolveで手番交代 ----------

{
  const state = createGame({ pairCount: 3, playerCount: 2, rng: fixedRng });
  const [a] = findPair(state, 0);
  const [b] = findPair(state, 1);
  flipCard(state, a);
  const result = flipCard(state, b);
  assert.strictEqual(result.type, 'mismatch', '違う絵柄はmismatch');
  assert.strictEqual(state.faceUp.length, 2, '不一致直後は2枚表のまま（見せる時間のため）');
  assert.strictEqual(canFlip(state, findPair(state, 2)[0]), false, '3枚目はめくれない');
  assert.strictEqual(state.currentPlayer, 0, 'resolve前は手番そのまま');

  const returned = resolveMismatch(state);
  assert.deepStrictEqual(returned.sort(), [a, b].sort(), '裏に戻すindexが返る');
  assert.strictEqual(state.faceUp.length, 0);
  assert.strictEqual(state.currentPlayer, 1, 'resolveで手番交代');
  resolveMismatchTurnWrap: {
    // 2人目が不一致→1人目に戻る（手番が一周する）
    flipCard(state, a);
    flipCard(state, b);
    resolveMismatch(state);
    assert.strictEqual(state.currentPlayer, 0, '手番は一周して戻る');
  }
}

// ---------- moves: めくったペア数を数える（ひとりプレイの記録用） ----------

{
  const state = createGame({ pairCount: 2, playerCount: 1, rng: fixedRng });
  const [a, b] = findPair(state, 0);
  const [c] = findPair(state, 1);
  flipCard(state, a);
  flipCard(state, c); // 不一致でも1回
  resolveMismatch(state);
  flipCard(state, a);
  flipCard(state, b); // 一致でも1回
  assert.strictEqual(state.moves, 2, '2ペアめくったのでmoves=2');
}

// ---------- getWinners ----------

{
  const state = { scores: [3, 1] };
  assert.deepStrictEqual(getWinners(state), [0], '多い方が勝ち');
  assert.deepStrictEqual(getWinners({ scores: [2, 2] }), [0, 1], '同点はふたりとも(ひきわけ)');
}

// ---------- CPU: つよい（全記憶・既知ペアは必ず取る） ----------

{
  const cpu = createCpu('strong', fixedRng);
  const state = {
    cards: [
      { face: 0, matched: false }, // 0
      { face: 1, matched: false }, // 1
      { face: 2, matched: false }, // 2
      { face: 0, matched: false }, // 3
      { face: 1, matched: false }, // 4
      { face: 2, matched: false }, // 5
    ],
    faceUp: [],
  };
  cpu.remember(0, 0);
  cpu.remember(1, 1);
  cpu.remember(3, 0); // face0のペア(0,3)を知った
  const first = cpu.pickFirst(state);
  assert.ok(first === 0 || first === 3, '既知ペアの1枚目を選ぶ');
  state.faceUp = [first];
  const second = cpu.pickSecond(state, first, 0);
  assert.strictEqual(second, first === 0 ? 3 : 0, '相方を必ず取る');

  // 取られたペアは選ばない
  state.cards[0].matched = true;
  state.cards[3].matched = true;
  state.faceUp = [];
  const next = cpu.pickFirst(state);
  assert.ok(![0, 3].includes(next), 'matchedのカードは選ばない');
}

// ---------- CPU: よわい（直近2枚だけ記憶） ----------

{
  const cpu = createCpu('weak', fixedRng);
  cpu.remember(0, 0);
  cpu.remember(1, 1);
  cpu.remember(2, 2); // これでindex0の記憶は消えるはず
  const memory = cpu.debugMemory();
  assert.strictEqual(memory.size, 2, '記憶は2枚まで');
  assert.ok(!memory.has(0), '一番古い記憶を忘れる');
  assert.ok(memory.has(1) && memory.has(2), '直近2枚は覚えている');
}

// ---------- CPU: ふつう（70%で記憶） ----------

{
  const remembers = createCpu('normal', () => 0.5); // 0.5 < 0.7 → 覚える
  remembers.remember(0, 0);
  assert.strictEqual(remembers.debugMemory().size, 1, '70%側は覚える');

  const forgets = createCpu('normal', () => 0.9); // 0.9 >= 0.7 → 覚えない
  forgets.remember(0, 0);
  assert.strictEqual(forgets.debugMemory().size, 0, '30%側は覚えない');
}

// ---------- CPU: 2枚目に1枚目と同じindexを選ばない ----------

{
  const cpu = createCpu('weak', fixedRng);
  const state = {
    cards: [
      { face: 0, matched: false },
      { face: 1, matched: false },
      { face: 0, matched: false },
    ],
    faceUp: [1],
  };
  for (let i = 0; i < 20; i++) {
    const second = cpu.pickSecond(state, 1, 1);
    assert.ok(second !== 1, '1枚目と同じindexは選ばない');
    assert.ok(!state.faceUp.includes(second), '表のカードは選ばない');
  }
}

console.log('memory.test.js: すべてのテストに合格');
