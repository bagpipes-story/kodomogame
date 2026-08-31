// maze.test.js — ボールめいろの純ロジックと全15面の整合性テスト
// 実行方法: node tests/maze.test.js

import assert from 'node:assert';
import {
  MAZES_BY_DIFFICULTY,
  parseMaze,
  findPath,
  pickMazeIndex,
  starsFor,
  createGame,
  startRound,
  fellInHole,
  reachedGoal,
} from '../js/games/maze/game.js';

// ---------- 全15面の検証（手作り面の品質担保。別冊03§8） ----------

const EXPECTED = {
  easy: { count: 5, cols: 6, rows: 9, minHoles: 0, maxHoles: 0 },
  normal: { count: 5, cols: 8, rows: 12, minHoles: 2, maxHoles: 3 },
  hard: { count: 5, cols: 10, rows: 14, minHoles: 4, maxHoles: 5 },
};

for (const [difficulty, spec] of Object.entries(EXPECTED)) {
  const mazes = MAZES_BY_DIFFICULTY[difficulty];
  assert.strictEqual(mazes.length, spec.count, `${difficulty}: 5面ある`);
  mazes.forEach((grid, i) => {
    const label = `${difficulty}[${i}]`;
    const maze = parseMaze(grid);
    assert.strictEqual(maze.cols, spec.cols, `${label}: 列数${spec.cols}`);
    assert.strictEqual(maze.rows, spec.rows, `${label}: 行数${spec.rows}`);
    assert.ok(
      maze.holes.length >= spec.minHoles && maze.holes.length <= spec.maxHoles,
      `${label}: 穴の数${maze.holes.length}が範囲内`,
    );
    // SとGはちょうど1つずつ
    const flat = grid.join('');
    assert.strictEqual([...flat].filter((ch) => ch === 'S').length, 1, `${label}: Sは1つ`);
    assert.strictEqual([...flat].filter((ch) => ch === 'G').length, 1, `${label}: Gは1つ`);
    // 外周はすべて壁（ボールが盤の外に出ない）
    assert.ok(/^1+$/.test(grid[0]) && /^1+$/.test(grid[grid.length - 1]), `${label}: 上下の外周は壁`);
    for (const row of grid) {
      assert.ok(row[0] === '1' && row[row.length - 1] === '1', `${label}: 左右の外周は壁`);
    }
    // 穴を避けてスタート→ゴールに必ず到達できる
    const path = findPath(grid);
    assert.ok(path !== null, `${label}: 穴を避けてクリア可能`);
    assert.deepStrictEqual(path[0], maze.start, `${label}: ルートはSから`);
    assert.deepStrictEqual(path[path.length - 1], maze.goal, `${label}: ルートはGまで`);
    // ルートは隣接セルの連続
    for (let j = 1; j < path.length; j++) {
      const d = Math.abs(path[j].r - path[j - 1].r) + Math.abs(path[j].c - path[j - 1].c);
      assert.strictEqual(d, 1, `${label}: ルートが飛んでいない`);
    }
  });
}

// ---------- 壁の矩形マージ ----------

{
  const maze = parseMaze(['111', '1S1', '1G1', '111']);
  // 上下の全面壁は1本ずつ、縦壁は1セルずつ
  const fullRows = maze.wallRects.filter((w) => w.len === 3);
  assert.strictEqual(fullRows.length, 2, '横に連続する壁は1つの矩形にまとまる');
}

// ---------- 星評価 ----------

{
  assert.strictEqual(starsFor(0), 3, '0回=星3');
  assert.strictEqual(starsFor(1), 2);
  assert.strictEqual(starsFor(2), 2, '1〜2回=星2');
  assert.strictEqual(starsFor(3), 1, '3回以上=星1');
}

// ---------- ラウンド進行: 落下カウントとクリア ----------

{
  const state = createGame({ difficulty: 'normal', mazeIndex: 0 });
  startRound(state, 1000);
  assert.strictEqual(fellInHole(state).falls, 1, '穴に落ちても続行（残機なし）');
  fellInHole(state);
  const result = reachedGoal(state, 31000);
  assert.strictEqual(result.stars, 2, '2回落ちて星2');
  assert.strictEqual(result.elapsedMs, 30000, 'タイム30秒');
  assert.strictEqual(state.cleared, true);
  assert.strictEqual(fellInHole(state), null, 'クリア後は無視');
  assert.strictEqual(reachedGoal(state, 32000), null, '二重クリアなし');
}

// ---------- 面のローテーション ----------

{
  assert.strictEqual(pickMazeIndex('easy', 0), 0);
  assert.strictEqual(pickMazeIndex('easy', 7), 2, 'プレイ回数%5で回る');
  assert.strictEqual(pickMazeIndex('hard', 5), 0);
}

console.log('maze.test.js: すべてのテストに合格');
