// cpu.js — ◯×ゲームのCPU思考（仕様§4.6）
//   よわい: 合法手からランダム
//   ふつう: ①自分が勝てる手 → ②相手の勝ちを防ぐ手 → ③ランダム
//   つよい: ミニマックス完全読み。最善が複数あるときはランダムに選ぶ
//           （どの初手も引き分けになるゲームなので、これだけで毎回展開が変わり、かつ絶対に負けない）

import { LINES, getReachCells, getEmptyCells } from './game.js';

function randomPick(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

export function chooseMove(state, level, rng = Math.random) {
  const empty = getEmptyCells(state);
  if (!empty.length) return null;

  if (level === 'weak') return randomPick(empty, rng);

  if (level === 'normal') {
    const winCells = getReachCells(state, state.current);
    if (winCells.length) return randomPick(winCells, rng);
    const blockCells = getReachCells(state, 1 - state.current);
    if (blockCells.length) return randomPick(blockCells, rng);
    return randomPick(empty, rng);
  }

  // つよい: ミニマックス
  const me = state.current;
  let bestScore = -Infinity;
  let best = [];
  for (const index of empty) {
    state.board[index] = me;
    const score = minimax(state.board, 1 - me, me, 1);
    state.board[index] = null;
    if (score > bestScore) {
      bestScore = score;
      best = [index];
    } else if (score === bestScore) {
      best.push(index);
    }
  }
  return randomPick(best, rng);
}

// 盤面の決着: 勝者(0/1) | 'draw' | null(続行)
function outcomeOf(board) {
  for (const line of LINES) {
    const mark = board[line[0]];
    if (mark !== null && line.every((i) => board[i] === mark)) return mark;
  }
  return board.every((cell) => cell !== null) ? 'draw' : null;
}

// 早い勝ちほど高評価（depthを引く）にして、子どもに分かりやすい自然な手を選ばせる
function minimax(board, current, me, depth) {
  const outcome = outcomeOf(board);
  if (outcome === me) return 10 - depth;
  if (outcome === 'draw') return 0;
  if (outcome !== null) return depth - 10;

  let best = current === me ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (board[i] !== null) continue;
    board[i] = current;
    const score = minimax(board, 1 - current, me, depth + 1);
    board[i] = null;
    best = current === me ? Math.max(best, score) : Math.min(best, score);
  }
  return best;
}
