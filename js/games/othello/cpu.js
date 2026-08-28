// cpu.js — オセロのCPU思考（仕様§4.1）
//   よわい: 合法手からランダム。角が取れるときも50%で見逃す
//   ふつう: 角があれば必ず取る。なければ返せる枚数最大（貪欲法）
//   つよい: 位置重み評価（角100・角隣接-20・辺10）＋2手先読みミニマックス

import { SIZE, EMPTY, opponent, getFlips, getLegalMoves } from './game.js';

const CORNERS = [0, SIZE - 1, SIZE * (SIZE - 1), SIZE * SIZE - 1];

// 位置の重みテーブルを組み立てる（手書き64要素はミスの元なので生成する）
const WEIGHTS = (() => {
  const w = new Array(SIZE * SIZE).fill(3);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (r === 0 || r === SIZE - 1 || c === 0 || c === SIZE - 1) w[r * SIZE + c] = 10;
    }
  }
  // 角のとなり（縦横斜め）は相手に角を取られやすい危険マス
  for (const corner of CORNERS) {
    const r = Math.floor(corner / SIZE);
    const c = corner % SIZE;
    for (const dr of [-1, 0, 1]) {
      for (const dc of [-1, 0, 1]) {
        const nr = r + dr;
        const nc = c + dc;
        if ((dr || dc) && nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
          w[nr * SIZE + nc] = -20;
        }
      }
    }
  }
  for (const corner of CORNERS) w[corner] = 100;
  return w;
})();

function randomPick(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

// 着手indexを返す（合法手がなければnull。エンジン側でパス処理済みのため通常は起きない）
export function chooseMove(state, level, rng = Math.random) {
  const moves = getLegalMoves(state.board, state.current);
  if (!moves.length) return null;
  if (level === 'weak') return chooseWeak(moves, rng);
  if (level === 'normal') return chooseNormal(moves, rng);
  return chooseStrong(state, moves, rng);
}

function chooseWeak(moves, rng) {
  const nonCorner = moves.filter((m) => !CORNERS.includes(m.index));
  // 角が取れるときも50%で見逃す（4歳が勝てる調整）
  if (nonCorner.length < moves.length && nonCorner.length > 0 && rng() < 0.5) {
    return randomPick(nonCorner, rng).index;
  }
  return randomPick(moves, rng).index;
}

function chooseNormal(moves, rng) {
  const cornerMoves = moves.filter((m) => CORNERS.includes(m.index));
  if (cornerMoves.length) return randomPick(cornerMoves, rng).index;
  const maxFlips = Math.max(...moves.map((m) => m.flips.length));
  const best = moves.filter((m) => m.flips.length === maxFlips);
  return randomPick(best, rng).index;
}

// ---------- つよい: 2手先読みミニマックス ----------

function simulate(board, index, color, flips) {
  const next = board.slice();
  next[index] = color;
  for (const i of flips) next[i] = color;
  return next;
}

// meから見た盤面の重み合計（自分の石はプラス、相手の石はマイナス）
function evaluate(board, me) {
  const opp = opponent(me);
  let score = 0;
  for (let i = 0; i < board.length; i++) {
    if (board[i] === me) score += WEIGHTS[i];
    else if (board[i] === opp) score -= WEIGHTS[i];
  }
  return score;
}

function chooseStrong(state, moves, rng) {
  const me = state.current;
  const opp = opponent(me);
  let bestScore = -Infinity;
  let best = [];
  for (const move of moves) {
    const afterMine = simulate(state.board, move.index, me, move.flips);
    const replies = getLegalMoves(afterMine, opp);
    let score;
    if (!replies.length) {
      // 相手を置けなくする手はそれ自体が有利
      score = evaluate(afterMine, me) + 20;
    } else {
      // 相手は自分にとって一番いやな返しを選ぶと仮定する（ミニマックス）
      score = Infinity;
      for (const reply of replies) {
        const afterReply = simulate(afterMine, reply.index, opp, reply.flips);
        score = Math.min(score, evaluate(afterReply, me));
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = [move];
    } else if (score === bestScore) {
      best.push(move);
    }
  }
  return randomPick(best, rng).index;
}
