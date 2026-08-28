// game.js — オセロの純ロジック（DOM非依存・Nodeテスト可能）
// 盤面は長さ64の配列（index = 行*8+列）。状態変更はこのファイルの関数だけが行う。

export const SIZE = 8;
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

// 8方向を行・列の差分で表す（indexの足し算だけだと行端で反対側に回り込むバグが出るため）
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

export function createGame() {
  const board = new Array(SIZE * SIZE).fill(EMPTY);
  // 初期配置は中央4石。黒先手（仕様§4.1）
  board[27] = WHITE;
  board[28] = BLACK;
  board[35] = BLACK;
  board[36] = WHITE;
  return { board, current: BLACK, finished: false };
}

export function opponent(color) {
  return color === BLACK ? WHITE : BLACK;
}

// indexにcolorを置いたときに裏返る石のindex一覧。空でなければ合法手
export function getFlips(board, index, color) {
  if (board[index] !== EMPTY) return [];
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  const opp = opponent(color);
  const flips = [];
  for (const [dr, dc] of DIRECTIONS) {
    const line = [];
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
      const i = r * SIZE + c;
      if (board[i] === opp) {
        line.push(i);
      } else if (board[i] === color) {
        if (line.length) flips.push(...line);
        break;
      } else {
        break; // 空マスに当たったらこの方向は不成立
      }
      r += dr;
      c += dc;
    }
  }
  return flips;
}

// colorが置けるマス一覧。flipsも返す（CPUの評価とUIのヒント表示で使う）
export function getLegalMoves(board, color) {
  const moves = [];
  for (let i = 0; i < board.length; i++) {
    const flips = getFlips(board, i, color);
    if (flips.length) moves.push({ index: i, flips });
  }
  return moves;
}

// 現在の手番でindexに着手する。
// 戻り値: { ok, color, flipped, next }
//   next.type: 'turn'=相手の番 / 'pass'=相手は置けず手番継続（passedColorが誰か） / 'end'=終局
// パスの判定までここでやるのは、「両者置けない=終局」のルールをUIに散らばらせないため
export function applyMove(state, index) {
  const color = state.current;
  const flips = getFlips(state.board, index, color);
  if (state.finished || !flips.length) return { ok: false };

  state.board[index] = color;
  for (const i of flips) state.board[i] = color;

  const opp = opponent(color);
  if (getLegalMoves(state.board, opp).length > 0) {
    state.current = opp;
    return { ok: true, color, flipped: flips, next: { type: 'turn' } };
  }
  if (getLegalMoves(state.board, color).length > 0) {
    return { ok: true, color, flipped: flips, next: { type: 'pass', passedColor: opp } };
  }
  state.finished = true;
  return { ok: true, color, flipped: flips, next: { type: 'end' } };
}

export function countStones(board) {
  let black = 0;
  let white = 0;
  for (const cell of board) {
    if (cell === BLACK) black++;
    else if (cell === WHITE) white++;
  }
  return { black, white };
}
