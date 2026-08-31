// game.js — ころころキャッチの純ロジック（DOM・物理非依存。別冊03§4)
// 板の傾き状態・ボール3個のラウンド進行・スコア・こうたい対戦をここで管理し、
// Matter.jsの物理とCanvas描画はui.jsに任せる。

export const BALLS_PER_ROUND = 3;

// 板の段数・壁の有無・ボールの速さ（重力）・板の長さで難易度を表現（別冊03§4）
// 重力値は実測ベース: 1.0未満だと板1枚に4秒以上かかり子どもがだれるため下限1.0
export const DIFFICULTY = {
  easy: { plateCount: 4, walls: true, gravity: 1.0, plateLenRatio: 0.46 },
  normal: { plateCount: 4, walls: false, gravity: 1.25, plateLenRatio: 0.55 },
  hard: { plateCount: 5, walls: false, gravity: 1.55, plateLenRatio: 0.42 },
};

// 板の初期の傾き: 互い違い（1=右下がり, -1=左下がり）。
// そのままではゴールしないことも多く「先に板を直しておく」プランニングを誘う
function initialTilts(count) {
  const tilts = [];
  for (let i = 0; i < count; i++) tilts.push(i % 2 === 0 ? 1 : -1);
  return tilts;
}

export function createGame({ difficulty = 'easy', mode = 'solo' } = {}) {
  const settings = DIFFICULTY[difficulty];
  return {
    mode,
    settings,
    tilts: initialTilts(settings.plateCount),
    ballIndex: 0,      // 何個目のボールまで出したか
    ballActive: false, // ボールが転がっている最中か
    goals: 0,          // キャッチできた数（スコア)
    tapsThisBall: 0,   // smooth_run判定: ボールが出てからのタップ数
    smoothGoals: 0,    // タップなしでゴールできた数
    currentPlayer: 0,
    results: [null, null],
    finished: false,
  };
}

// 板をタップ: 傾きを反転。ボールが転がっている間のタップは数えておく
// （0タップでゴール=先に準備できていた、のほめ判定に使う）
export function togglePlate(state, index) {
  if (state.finished || index < 0 || index >= state.tilts.length) return null;
  state.tilts[index] = -state.tilts[index];
  if (state.ballActive) state.tapsThisBall++;
  return state.tilts[index];
}

// 次のボールを出す。出せないときはnull
export function launchBall(state) {
  if (state.finished || state.ballActive || state.ballIndex >= BALLS_PER_ROUND) return null;
  state.ballIndex++;
  state.ballActive = true;
  state.tapsThisBall = 0;
  return state.ballIndex;
}

// ラウンド終了（3個投げ切った）。こうたい対戦なら交代する
function endRound(state) {
  state.results[state.currentPlayer] = state.goals;
  if (state.mode === 'two' && state.currentPlayer === 0) {
    state.currentPlayer = 1;
    state.tilts = initialTilts(state.settings.plateCount); // 同じ条件でフェアに
    state.ballIndex = 0;
    state.goals = 0;
    state.smoothGoals = 0;
    return { nextPlayer: 1 };
  }
  state.finished = true;
  let winner = null;
  if (state.mode === 'two') {
    const [a, b] = state.results;
    winner = a === b ? null : a > b ? 0 : 1;
  }
  return { finished: true, winner };
}

// ボールがゴールに入った
export function ballGoal(state) {
  if (!state.ballActive) return null;
  state.ballActive = false;
  state.goals++;
  const smooth = state.tapsThisBall === 0;
  if (smooth) state.smoothGoals++;
  const roundOver = state.ballIndex >= BALLS_PER_ROUND ? endRound(state) : null;
  return { smooth, goals: state.goals, roundOver };
}

// ボールが画面の外へ飛び出した
export function ballOut(state) {
  if (!state.ballActive) return null;
  state.ballActive = false;
  const roundOver = state.ballIndex >= BALLS_PER_ROUND ? endRound(state) : null;
  return { goals: state.goals, roundOver };
}
