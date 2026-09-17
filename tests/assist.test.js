// assist.test.js — 難易度アシスト（assist.js・recordPlayの連敗カウント・各CPUの'assist'レベル）のNodeテスト
// 実行方法: node tests/assist.test.js

import assert from 'node:assert';

function createMockStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}
globalThis.localStorage = createMockStorage();

const { loadStats } = await import('../js/storage.js');
const { ASSIST_AFTER, lossStreakOf, effectiveLevel } = await import('../js/assist.js');
const { recordPlay } = await import('../js/praise.js');
const ttt = await import('../js/games/tictactoe/game.js');
const tttCpu = await import('../js/games/tictactoe/cpu.js');
const memCpu = await import('../js/games/memory/cpu.js');
const oth = await import('../js/games/othello/game.js');
const othCpu = await import('../js/games/othello/cpu.js');
const sev = await import('../js/games/sevens/game.js');
const sevCpu = await import('../js/games/sevens/cpu.js');

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------- 連敗カウント → effectiveLevel ----------
{
  assert.strictEqual(ASSIST_AFTER, 2);
  assert.strictEqual(effectiveLevel('othello', 'weak'), 'weak');
  recordPlay('othello', { lost: true });
  assert.strictEqual(lossStreakOf('othello'), 1);
  assert.strictEqual(effectiveLevel('othello', 'weak'), 'weak', '1連敗ではまだ');
  recordPlay('othello', { lost: true });
  assert.strictEqual(lossStreakOf('othello'), 2);
  assert.strictEqual(effectiveLevel('othello', 'weak'), 'assist', '2連敗でアシスト');
  assert.strictEqual(effectiveLevel('othello', 'normal'), 'normal', 'ふつう以上は変えない');
  assert.strictEqual(effectiveLevel('tictactoe', 'weak'), 'weak', 'ゲームごとに独立');
  recordPlay('othello', {}); // ひきわけ・ひとりプレイは据え置き
  assert.strictEqual(lossStreakOf('othello'), 2);
  recordPlay('othello', { won: true });
  assert.strictEqual(lossStreakOf('othello'), 0, '勝てば0に戻る');
  assert.strictEqual(loadStats().othello.plays, 4);
  assert.strictEqual(loadStats().othello.wins, 1);
}

// ---------- ◯×: assistは相手のリーチを止めない ----------
{
  // 人間(0)が 0,1 に置きリーチ（空きは2）。CPU(1)は 3,4 …ではなく別の場所を持つ
  const state = ttt.createGame({ firstPlayer: 0 });
  state.board = [0, 0, null, 1, null, null, null, 1, null];
  state.current = 1;
  const rng = seeded(1);
  let blocked = 0;
  for (let i = 0; i < 100; i++) {
    const move = tttCpu.chooseMove(state, 'assist', rng);
    assert.notStrictEqual(move, null);
    if (move === 2) blocked++;
  }
  assert.strictEqual(blocked, 0, 'アシストは相手のリーチ(2)を止めない');
  // 空きが相手のリーチしかないときはそこに置く（合法手を返す）
  const only = ttt.createGame({ firstPlayer: 0 });
  only.board = [0, 0, null, 1, 1, 0, 0, 1, 1];
  only.current = 1;
  assert.strictEqual(tttCpu.chooseMove(only, 'assist', rng), 2);
}

// ---------- 神経衰弱: assistは直近1枚しか覚えない ----------
{
  const cpu = memCpu.createCpu('assist', () => 0.5); // rng 0.5 → 「30%は覚えない」に当たらない
  cpu.remember(0, 'a');
  cpu.remember(1, 'b');
  cpu.remember(2, 'c');
  assert.strictEqual(cpu.debugMemory().size, 1);
  assert.deepStrictEqual([...cpu.debugMemory().keys()], [2]);
  const weak = memCpu.createCpu('weak', () => 0.5);
  weak.remember(0, 'a');
  weak.remember(1, 'b');
  weak.remember(2, 'c');
  assert.strictEqual(weak.debugMemory().size, 2, 'よわいは2枚');
  const forget = memCpu.createCpu('assist', () => 0.9); // 0.9 ≥ 0.7 → 覚えない
  forget.remember(0, 'a');
  assert.strictEqual(forget.debugMemory().size, 0);
}

// ---------- オセロ: assistは角を必ず見逃す ----------
{
  const rng = seeded(3);
  let cornerTaken = 0;
  let trials = 0;
  for (let t = 0; t < 300 && trials < 40; t++) {
    // ランダムに数手進めて、黒に角の合法手がある局面を探す
    const state = oth.createGame();
    for (let k = 0; k < 20; k++) {
      const moves = oth.getLegalMoves(state.board, state.current);
      if (!moves.length) break;
      const m = moves[Math.floor(rng() * moves.length)];
      oth.applyMove(state, m.index);
    }
    const moves = oth.getLegalMoves(state.board, state.current);
    const corners = [0, 7, 56, 63];
    if (!moves.some((m) => corners.includes(m.index)) || moves.length < 2) continue;
    trials++;
    const pick = othCpu.chooseMove(state, 'assist', rng);
    assert.ok(moves.some((m) => m.index === pick), '合法手を返す');
    if (corners.includes(pick)) cornerTaken++;
  }
  assert.ok(trials >= 10, `角が取れる局面が見つかる (${trials})`);
  assert.strictEqual(cornerTaken, 0, 'アシストは角を取らない');
}

// ---------- 7ならべ: assistは出せてもときどきパスする ----------
{
  const rng = seeded(5);
  let passes = 0;
  let plays = 0;
  for (let i = 0; i < 200; i++) {
    const state = sev.createGame({ playerCount: 2 });
    state.current = 1;
    const action = sevCpu.chooseAction(state, 'assist', rng);
    if (action.type === 'pass') passes++;
    else plays++;
  }
  assert.ok(passes > 30 && passes < 90, `パスは3割前後 (${passes}/200)`);
  assert.ok(plays > 0);
  // パスを使い切っていたら出す
  const state = sev.createGame({ playerCount: 2 });
  state.current = 1;
  state.passesLeft[1] = 0;
  for (let i = 0; i < 20; i++) assert.strictEqual(sevCpu.chooseAction(state, 'assist', rng).type, 'play');
}

console.log('assist.test.js: all passed');
