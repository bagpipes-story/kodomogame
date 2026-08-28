// othello.test.js — オセロの純ロジック（game.js / cpu.js）のNodeテスト
// 実行方法: node tests/othello.test.js

import assert from 'node:assert';
import {
  SIZE,
  EMPTY,
  BLACK,
  WHITE,
  createGame,
  opponent,
  getFlips,
  getLegalMoves,
  applyMove,
  countStones,
} from '../js/games/othello/game.js';
import { chooseMove } from '../js/games/othello/cpu.js';

// 決まった値を順番に返すrng（テストでCPUの分岐を固定するため）
function makeRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

function emptyBoard(stones = {}) {
  const board = new Array(SIZE * SIZE).fill(EMPTY);
  for (const [index, color] of Object.entries(stones)) board[Number(index)] = color;
  return board;
}

// ---------- 初期盤面 ----------

{
  const state = createGame();
  assert.deepStrictEqual(countStones(state.board), { black: 2, white: 2 }, '初期は2対2');
  assert.strictEqual(state.current, BLACK, '黒先手');
  const moves = getLegalMoves(state.board, BLACK).map((m) => m.index).sort((a, b) => a - b);
  assert.deepStrictEqual(moves, [19, 26, 37, 44], '初期の黒の合法手は4か所');
  assert.strictEqual(opponent(BLACK), WHITE);
}

// ---------- getFlips ----------

{
  const state = createGame();
  assert.deepStrictEqual(getFlips(state.board, 19, BLACK), [27], '19に置くと27(白)が返る');
  assert.deepStrictEqual(getFlips(state.board, 27, BLACK), [], '石があるマスには置けない');
  assert.deepStrictEqual(getFlips(state.board, 0, BLACK), [], '返せない場所は非合法');
}

// ---------- 行端の回り込みバグがないこと ----------

{
  // 7(0行目の右端)が白、8(1行目の左端)が黒。6に黒を置いても
  // 「7の次は盤外」であり、8に回り込んで挟んだ扱いになってはいけない
  const board = emptyBoard({ 7: WHITE, 8: BLACK });
  assert.deepStrictEqual(getFlips(board, 6, BLACK), [], '行末で回り込まない');
}

// ---------- applyMove: 着手と手番交代 ----------

{
  const state = createGame();
  const result = applyMove(state, 19);
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.flipped, [27]);
  assert.strictEqual(state.board[19], BLACK, '置いた石');
  assert.strictEqual(state.board[27], BLACK, '返った石');
  assert.strictEqual(result.next.type, 'turn');
  assert.strictEqual(state.current, WHITE, '手番交代');
  assert.strictEqual(applyMove(state, 0).ok, false, '非合法手は拒否');
}

// ---------- パスと終局 ----------

{
  // 盤面の意図:
  //   0の白は周囲が空マスのため両者とも手を出せない「孤立石」
  //   48の白は黒が40で返せる ／ 55の白は黒が47で返せる
  //   （挟む黒56・63がどちらも角のため、白はこれらの列を逆利用できない）
  //   黒が40に置いた時点で白の合法手はゼロだが黒は47に置ける → 白パスで黒継続
  const state = {
    board: emptyBoard({ 0: WHITE, 48: WHITE, 56: BLACK, 55: WHITE, 63: BLACK }),
    current: BLACK,
    finished: false,
  };
  assert.deepStrictEqual(getLegalMoves(state.board, WHITE), [], 'テスト前提: 白は最初から置けない');
  const result = applyMove(state, 40);
  assert.deepStrictEqual(result.flipped, [48]);
  assert.strictEqual(result.next.type, 'pass', '相手が置けなければパス');
  assert.strictEqual(result.next.passedColor, WHITE, 'パスしたのは白');
  assert.strictEqual(state.current, BLACK, '手番は黒のまま');

  // 続けて黒が47に置くと残る白は孤立石のみ → 両者置けず終局
  const result2 = applyMove(state, 47);
  assert.deepStrictEqual(result2.flipped, [55]);
  assert.strictEqual(result2.next.type, 'end', '両者置けなければ終局');
  assert.strictEqual(state.finished, true);
  assert.deepStrictEqual(countStones(state.board), { black: 6, white: 1 });
  assert.strictEqual(applyMove(state, 10).ok, false, '終局後は着手できない');
}

// ---------- CPU: よわい（角を50%で見逃す） ----------

{
  // 黒の合法手は 0(角) と 4 の2つだけ
  const board = emptyBoard({ 1: WHITE, 2: BLACK, 5: WHITE, 6: BLACK });
  const state = { board, current: BLACK, finished: false };
  const moves = getLegalMoves(board, BLACK).map((m) => m.index).sort((a, b) => a - b);
  assert.deepStrictEqual(moves, [0, 4], 'テスト前提の確認');

  // 1回目のrng<0.5 → 角を見逃して4を選ぶ
  assert.strictEqual(chooseMove(state, 'weak', makeRng([0.3, 0.0])), 4, '角を見逃す');
  // 1回目のrng>=0.5 → 全合法手からランダム（0.0で先頭=角）
  assert.strictEqual(chooseMove(state, 'weak', makeRng([0.6, 0.0])), 0, '見逃さないときは角も選べる');
}

// ---------- CPU: ふつう（角優先＋貪欲法） ----------

{
  const cornerBoard = emptyBoard({ 1: WHITE, 2: BLACK, 5: WHITE, 6: BLACK });
  const state = { board: cornerBoard, current: BLACK, finished: false };
  assert.strictEqual(chooseMove(state, 'normal', makeRng([0.9])), 0, '角があれば必ず取る');

  // 角なし: 9に置くと2枚、25に置くと1枚 → 2枚の9を選ぶ
  const greedyBoard = emptyBoard({ 10: WHITE, 11: WHITE, 12: BLACK, 26: WHITE, 27: BLACK });
  const greedyState = { board: greedyBoard, current: BLACK, finished: false };
  const greedyMoves = getLegalMoves(greedyBoard, BLACK).map((m) => m.index).sort((a, b) => a - b);
  assert.deepStrictEqual(greedyMoves, [9, 25], 'テスト前提の確認');
  assert.strictEqual(chooseMove(greedyState, 'normal', makeRng([0.9])), 9, '返せる枚数最大を選ぶ');
}

// ---------- CPU: つよい（合法手を返す・角を高評価） ----------

{
  const state = createGame();
  const move = chooseMove(state, 'strong', Math.random);
  const legal = getLegalMoves(state.board, BLACK).map((m) => m.index);
  assert.ok(legal.includes(move), 'つよいCPUも合法手を返す');
}

// ---------- 通しプレイ: つよいvsふつうで終局まで壊れないこと ----------

{
  const state = createGame();
  const rng = makeRng([0.11, 0.42, 0.73, 0.29, 0.85, 0.57]);
  let guard = 0;
  while (!state.finished && guard < 200) {
    guard++;
    const level = state.current === BLACK ? 'strong' : 'normal';
    const move = chooseMove(state, level, rng);
    assert.ok(move !== null, '手番側には必ず合法手があるはず');
    const result = applyMove(state, move);
    assert.strictEqual(result.ok, true, 'CPUの手は常に合法');
  }
  assert.ok(state.finished, '終局に到達する');
  const { black, white } = countStones(state.board);
  assert.ok(black + white <= SIZE * SIZE, '石数が盤面を超えない');
  assert.ok(black + white >= 4, '石は増えている');
}

console.log('othello.test.js: すべてのテストに合格');
