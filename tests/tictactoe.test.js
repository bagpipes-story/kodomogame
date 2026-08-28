// tictactoe.test.js — ◯×ゲームの純ロジック（game.js / cpu.js）のNodeテスト
// 実行方法: node tests/tictactoe.test.js

import assert from 'node:assert';
import {
  createGame,
  place,
  getReachCells,
  getEmptyCells,
} from '../js/games/tictactoe/game.js';
import { chooseMove } from '../js/games/tictactoe/cpu.js';

function makeRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

// 盤面を並べた状態を作るヘルパー（moves: [player0の手, player1の手, ...]の交互）
function play(moves, firstPlayer = 0) {
  const state = createGame({ firstPlayer });
  let last = null;
  for (const index of moves) last = place(state, index);
  return { state, last };
}

// ---------- 基本ルール ----------

{
  const state = createGame();
  assert.strictEqual(state.current, 0, '先手はplayer0');
  assert.strictEqual(getEmptyCells(state).length, 9);
  assert.strictEqual(place(state, 4).type, 'placed');
  assert.strictEqual(state.current, 1, '手番交代');
  assert.strictEqual(place(state, 4).ok, false, '置き済みマスは無効');
}

// ---------- 勝ち: よこ・たて・ななめ ----------

{
  const { last } = play([0, 3, 1, 4, 2]); // player0がよこ一列
  assert.strictEqual(last.type, 'win');
  assert.deepStrictEqual(last.line, [0, 1, 2]);
}
{
  const { state, last } = play([0, 1, 3, 4, 8, 7]); // player1がたて一列(1,4,7)
  assert.strictEqual(last.type, 'win');
  assert.strictEqual(state.winner, 1);
  assert.deepStrictEqual(state.winLine, [1, 4, 7]);
  assert.strictEqual(place(state, 5).ok, false, '決着後は置けない');
}
{
  const { last } = play([0, 1, 4, 2, 8]); // player0がななめ(0,4,8)
  assert.strictEqual(last.type, 'win');
}

// ---------- ひきわけ ----------

{
  // 最終盤面: ◯×◯ / ◯×× / ×◯◯ （どの列もそろわない）
  const { state, last } = play([0, 1, 2, 4, 3, 5, 7, 6, 8]);
  assert.strictEqual(last.type, 'draw');
  assert.strictEqual(state.finished, true);
  assert.strictEqual(state.winner, null);
}

// ---------- リーチ検出 ----------

{
  const { state } = play([0, 3, 1]); // player0: 0,1 / player1: 3
  assert.deepStrictEqual(getReachCells(state, 0), [2], 'player0は2でリーチ');
  assert.deepStrictEqual(getReachCells(state, 1), [], 'player1はまだリーチなし');
}

// ---------- CPU: ふつう（勝ち > ブロック > ランダム） ----------

{
  // player1(CPU)の手番。CPU自身が2,5でリーチ(8で勝ち)、相手も0,1でリーチ(2で勝てる)
  const { state } = play([0, 2, 1, 5, 4]); // p0:0,1,4 p1:2,5 → p1の番
  // p1の勝ちマス: 8 (2,5,8)。p0のリーチ: 2は埋まっている… p0:0,1→2埋まり済み, 0,4→8, 1,4→7
  const move = chooseMove(state, 'normal', makeRng([0.0]));
  assert.strictEqual(move, 8, '自分が勝てる手を最優先');
}
{
  // CPUに勝ち手がなく、相手(p0)が0,1でリーチ → 2を防ぐ
  const { state } = play([0, 4, 1]); // p0:0,1 p1:4 → p1の番
  const move = chooseMove(state, 'normal', makeRng([0.0]));
  assert.strictEqual(move, 2, '相手の勝ちを防ぐ');
}

// ---------- CPU: つよい（絶対に負けない） ----------

{
  const rng = makeRng([0.13, 0.57, 0.91, 0.33, 0.72, 0.48]);
  let strongLosses = 0;
  for (let game = 0; game < 60; game++) {
    const strongPlayer = game % 2; // 先手・後手の両方を試す
    const state = createGame({ firstPlayer: 0 });
    while (!state.finished) {
      const level = state.current === strongPlayer ? 'strong' : 'weak';
      const move = chooseMove(state, level, rng);
      place(state, move);
    }
    if (state.winner !== null && state.winner !== strongPlayer) strongLosses++;
  }
  assert.strictEqual(strongLosses, 0, 'つよいCPUはランダム相手に60戦して負けない');
}

// ---------- CPU: つよい（開幕の手にバリエーションがある） ----------

{
  const firstMoves = new Set();
  for (let i = 0; i < 40; i++) {
    const state = createGame();
    firstMoves.add(chooseMove(state, 'strong', Math.random));
  }
  assert.ok(firstMoves.size >= 3, `初手が毎回同じにならない（観測: ${firstMoves.size}種類）`);
}

console.log('tictactoe.test.js: すべてのテストに合格');
