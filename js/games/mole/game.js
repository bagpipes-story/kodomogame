// game.js — もぐらたたきの純ロジック（DOM非依存・Nodeテスト可能）
// タイマーはui.js側の責務。ここは「出す・引っ込める・たたく」の状態遷移だけを持つ。
// ちょうちょは「たたかない対象」（がまんの練習。仕様§4.7）。

export const ROUND_SECONDS = 30;
export const HOLE_COUNT = 9;

// 出現間隔・同時最大数・ちょうちょ出現率・穴の数で難易度を表現（仕様§4.7）
// おとな: 穴2倍(18こ)＋高速＋ちょうちょ多め。保護者向けの本気モード
export const DIFFICULTY = {
  easy: { spawnMs: 1200, maxUp: 1, butterflyRate: 0, holeCount: 9 },
  normal: { spawnMs: 900, maxUp: 2, butterflyRate: 0.15, holeCount: 9 },
  hard: { spawnMs: 650, maxUp: 3, butterflyRate: 0.25, holeCount: 9 },
  adult: { spawnMs: 450, maxUp: 4, butterflyRate: 0.35, holeCount: 18 },
};

export function createGame({ difficulty = 'easy', rng = Math.random } = {}) {
  return {
    settings: DIFFICULTY[difficulty],
    hasButterflies: DIFFICULTY[difficulty].butterflyRate > 0,
    rng,
    holes: new Array(DIFFICULTY[difficulty].holeCount).fill(null), // null | 'mole' | 'butterfly'
    score: 0,
    combo: 0,
    maxCombo: 0,
    butterflyHits: 0,
    finished: false,
  };
}

// スケジューラの1tick: 空き穴からランダムに1匹出す。出せなければnull
export function spawn(state) {
  if (state.finished) return null;
  const upCount = state.holes.filter((kind) => kind !== null).length;
  if (upCount >= state.settings.maxUp) return null;
  const empty = [];
  state.holes.forEach((kind, index) => {
    if (kind === null) empty.push(index);
  });
  if (!empty.length) return null;
  const index = empty[Math.floor(state.rng() * empty.length)];
  const kind = state.rng() < state.settings.butterflyRate ? 'butterfly' : 'mole';
  state.holes[index] = kind;
  return { index, kind };
}

// 時間切れで引っ込む。引っ込めた種類を返す（いなければnull）
export function hide(state, index) {
  const kind = state.holes[index];
  state.holes[index] = null;
  return kind;
}

// 穴をたたく。もぐら=+1＋コンボ、ちょうちょ=ノーカウントでコンボが切れる（減点はしない）、
// 空振り=コンボが切れるだけ
export function hit(state, index) {
  if (state.finished) return { type: 'ignore' };
  const kind = state.holes[index];
  if (kind === 'mole') {
    state.holes[index] = null;
    state.score++;
    state.combo++;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    return { type: 'mole', score: state.score, combo: state.combo };
  }
  if (kind === 'butterfly') {
    state.holes[index] = null;
    state.butterflyHits++;
    state.combo = 0;
    return { type: 'butterfly' };
  }
  state.combo = 0;
  return { type: 'miss' };
}

export function finishRound(state) {
  state.finished = true;
  state.holes.fill(null);
}
