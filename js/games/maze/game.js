// game.js — ボールめいろの純ロジック（DOM・物理非依存。別冊03§3）
// 迷路グリッドの解析・壁の矩形化・ルート探索・落下/クリアの記録を担当し、
// Matter.jsとセンサーはui.js/motion.jsに任せる。

import { MAZES_BY_DIFFICULTY } from './mazes.js';

export { MAZES_BY_DIFFICULTY };

// 星評価: 穴に落ちた回数で決める（別冊03§3）
export function starsFor(falls) {
  if (falls === 0) return 3;
  if (falls <= 2) return 2;
  return 1;
}

// グリッド文字列を解析して、スタート・ゴール・穴・壁矩形を取り出す。
// 壁は横方向の連続をまとめて1つの矩形にする（Matterの静的ボディ数を減らす）
export function parseMaze(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  let start = null;
  let goal = null;
  const holes = [];

  for (let r = 0; r < rows; r++) {
    if (grid[r].length !== cols) throw new Error(`行${r}の長さが違う`);
    for (let c = 0; c < cols; c++) {
      const ch = grid[r][c];
      if (ch === 'S') start = { r, c };
      else if (ch === 'G') goal = { r, c };
      else if (ch === 'H') holes.push({ r, c });
    }
  }
  if (!start || !goal) throw new Error('SまたはGがない');

  const wallRects = [];
  for (let r = 0; r < rows; r++) {
    let runStart = -1;
    for (let c = 0; c <= cols; c++) {
      const isWall = c < cols && grid[r][c] === '1';
      if (isWall && runStart < 0) runStart = c;
      if (!isWall && runStart >= 0) {
        wallRects.push({ r, c: runStart, len: c - runStart });
        runStart = -1;
      }
    }
  }

  return { rows, cols, start, goal, holes, wallRects };
}

// スタート→ゴールの最短ルート（BFS。穴は避ける）。
// ルートヒントの光る道と、面データの検証（必ずクリア可能）に使う
export function findPath(grid) {
  const { rows, cols, start, goal } = parseMaze(grid);
  const key = (r, c) => r * cols + c;
  const prev = new Map();
  const queue = [start];
  const seen = new Set([key(start.r, start.c)]);
  while (queue.length) {
    const cur = queue.shift();
    if (cur.r === goal.r && cur.c === goal.c) {
      const path = [];
      let node = cur;
      while (node) {
        path.unshift({ r: node.r, c: node.c });
        node = prev.get(key(node.r, node.c));
      }
      return path;
    }
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const r = cur.r + dr;
      const c = cur.c + dc;
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
      const ch = grid[r][c];
      if (ch === '1' || ch === 'H') continue; // 壁と穴は通らない
      const k = key(r, c);
      if (seen.has(k)) continue;
      seen.add(k);
      prev.set(k, cur);
      queue.push({ r, c });
    }
  }
  return null; // ゴールできない面（面データの不備）
}

// 遊ぶ面を選ぶ: プレイ回数で5面をローテーション
export function pickMazeIndex(difficulty, plays) {
  return (plays ?? 0) % MAZES_BY_DIFFICULTY[difficulty].length;
}

export function createGame({ difficulty = 'easy', mazeIndex = 0 } = {}) {
  const grid = MAZES_BY_DIFFICULTY[difficulty][mazeIndex];
  return {
    difficulty,
    grid,
    maze: parseMaze(grid),
    path: findPath(grid),
    falls: 0,        // 穴に落ちた回数（星評価の元。残機・ゲームオーバーなし）
    cleared: false,
    startedAt: null, // タイム計測（むずかしいで表示）
    elapsedMs: null,
  };
}

export function startRound(state, now) {
  state.startedAt = now;
}

export function fellInHole(state) {
  if (state.cleared) return null;
  state.falls++;
  return { falls: state.falls };
}

export function reachedGoal(state, now) {
  if (state.cleared) return null;
  state.cleared = true;
  state.elapsedMs = state.startedAt !== null ? now - state.startedAt : 0;
  return { falls: state.falls, stars: starsFor(state.falls), elapsedMs: state.elapsedMs };
}
