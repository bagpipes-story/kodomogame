// game.js — コリントゲームの純ロジック（DOM・物理非依存。別冊04§7）
// 盤のレイアウト（釘・ポケット・壁の位置）もここで決めて、physics.js（Matter）と
// ui.js（描画）が同じデータを使う。ラウンド進行・たしざん表示・こうたい対戦も担当。

export const BALLS_PER_ROUND = 5;
export const BALL_R = 9;   // 8px以上（小さいと釘をすり抜ける。別冊04§7）
export const PEG_R = 4;
export const LANE_W = 34;  // 右端の打ち出しレーンの幅
// 盤の高さ: ヘッダー・バナー・発射ボタンと合わせてiPhone SE(667px)に収まる値
export const CANVAS_H = 396;

// 釘の並び・ポケット得点・追加要素で難易度を表現
export const DIFFICULTY = {
  easy: {
    pegRows: 4, pegCols: 5, staggered: false,
    pockets: [1, 2, 5, 3, 1],           // 0点なし。1〜5の数の合成（4歳）
    pinwheels: 0, bell: false, exact: null, countStep: 1,
  },
  normal: {
    pegRows: 6, pegCols: 6, staggered: true,
    pockets: [0, 10, 20, 50, 20, 10, 0], // 10単位のたしざん（6〜8歳）
    pinwheels: 1, bell: false, exact: null, countStep: 10,
  },
  hard: {
    pegRows: 8, pegCols: 7, staggered: true,
    pockets: [0, 20, 50, 100, 50, 10, 0],
    pinwheels: 2, bell: true, exact: 100, countStep: 10, // 「ぴったり100てん」モード
  },
};

// 折れ線を短い長方形の列に変換（壁の物理ボディ用）
function segmentsOf(points, thickness) {
  const rects = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    rects.push({
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
      w: len + 2,
      h: thickness,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    });
  }
  return rects;
}

function arcPoints(cx, cy, r, fromDeg, toDeg, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const deg = fromDeg + ((toDeg - fromDeg) * i) / steps;
    const rad = (deg * Math.PI) / 180;
    pts.push({ x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) });
  }
  return pts;
}

// 盤のレイアウト。右端に打ち出しレーン、上は丸いレールで左へ、下に得点ポケット
export function buildLayout(settings, W, H) {
  const laneWallX = W - LANE_W - 2; // レーンと盤面を仕切る壁の中心x
  const fieldRight = laneWallX - 2; // 盤面の右端
  const fieldLeft = 4;
  const POCKET_H = 50;
  const LANE_TOP = 92;

  // 上のレール: レーン上端 → 右上の大きな丸み → 上辺 → 左上の丸み → 左壁
  const bigR = 74;
  const smallR = 40;
  const top = [
    ...arcPoints(W - 4 - bigR, 78, bigR, 0, -90, 10),
    ...arcPoints(fieldLeft + smallR, 4 + smallR, smallR, -90, -180, 6),
  ];
  // 壁は厚めにする: 速い球が1フレームで薄い壁の中心を越えると反対側へ押し出される
  // （自動テストで床すり抜けが再現した）ため、外周は盤の外側へ厚みをとる
  const walls = [
    ...segmentsOf(top, 14),
    { cx: fieldLeft - 8, cy: (H + 44) / 2, w: 20, h: H - 44, angle: 0 },  // 左壁
    { cx: W + 6, cy: (H + 78) / 2, w: 20, h: H - 78, angle: 0 },          // 右壁（レーンの外側）
    { cx: laneWallX, cy: (H + LANE_TOP) / 2, w: 10, h: H - LANE_TOP, angle: 0 }, // レーンの仕切り
    { cx: W / 2, cy: H + 14, w: W + 40, h: 36, angle: 0 },                 // 床（上面はH-4）
  ];

  // ポケット: 盤面の幅を等分し、仕切りとセンサーを置く
  const count = settings.pockets.length;
  const pocketW = (fieldRight - fieldLeft) / count;
  const pockets = [];
  const sensors = [];
  for (let i = 0; i < count; i++) {
    const x0 = fieldLeft + pocketW * i;
    const x1 = x0 + pocketW;
    pockets.push({ x0, x1, points: settings.pockets[i], index: i });
    sensors.push({ cx: (x0 + x1) / 2, cy: H - 16, w: pocketW - 10, h: 18, index: i });
    if (i > 0) walls.push({ cx: x0, cy: H - POCKET_H / 2, w: 6, h: POCKET_H, angle: 0 });
  }

  // 風車とベル（釘はこれらの近くには置かない）
  const cxField = (fieldLeft + fieldRight) / 2;
  const pinwheels = [];
  if (settings.pinwheels === 1) pinwheels.push({ x: cxField, y: 228, len: 52 });
  if (settings.pinwheels === 2) {
    pinwheels.push({ x: cxField - 70, y: 200, len: 48 });
    pinwheels.push({ x: cxField + 70, y: 272, len: 48 });
  }
  const bell = settings.bell ? { x: cxField, y: 140, r: 9 } : null;

  // 釘: 上下に等間隔。千鳥は1行おきに半分ずらして1本減らす
  const pegs = [];
  const pegTop = 122;
  const pegBottom = H - POCKET_H - 40;
  const rowGap = (pegBottom - pegTop) / (settings.pegRows - 1);
  // 端の釘は壁から球の直径以上はなす（壁と釘のすき間に球がはさまるのを防ぐ）
  const EDGE = 32;
  const colGap = (fieldRight - fieldLeft - EDGE * 2) / (settings.pegCols - 1);
  for (let r = 0; r < settings.pegRows; r++) {
    const y = pegTop + rowGap * r;
    const shifted = settings.staggered && r % 2 === 1;
    const cols = shifted ? settings.pegCols - 1 : settings.pegCols;
    for (let c = 0; c < cols; c++) {
      const x = fieldLeft + EDGE + colGap * c + (shifted ? colGap / 2 : 0);
      const nearPinwheel = pinwheels.some((p) => Math.hypot(p.x - x, p.y - y) < p.len / 2 + 22);
      const nearBell = bell && Math.hypot(bell.x - x, bell.y - y) < 30;
      if (!nearPinwheel && !nearBell) pegs.push({ x, y });
    }
  }

  return {
    W, H, laneWallX, fieldLeft, fieldRight, pocketH: POCKET_H,
    spawn: { x: W - 2 - LANE_W / 2, y: H - 30 },
    walls, pockets, sensors, pinwheels, bell, pegs,
    gravity: 0.9,
    pinwheelSpeed: 0.035, // rad/フレーム
  };
}

export function createGame({ difficulty = 'easy', mode = 'solo' } = {}) {
  const settings = DIFFICULTY[difficulty];
  return {
    mode,
    settings,
    ballsShot: 0,      // 打った数（レーンに戻ってきた球は数えない）
    ballActive: false,
    total: 0,
    lastExpression: '',
    aimIndex: null,    // 「よそう」で宣言したポケット
    bellHit: false,    // この球でベルを鳴らしたか（1球1回まで）
    currentPlayer: 0,
    results: [null, null],
    finished: false,
  };
}

export function setAim(state, index) {
  if (state.ballActive || state.finished) return false;
  state.aimIndex = index;
  return true;
}

export function launchBall(state) {
  if (state.finished || state.ballActive || state.ballsShot >= BALLS_PER_ROUND) return null;
  state.ballsShot++;
  state.ballActive = true;
  state.bellHit = false;
  return state.ballsShot;
}

// 弱くてレーンに戻ってきた: 球は消費しない（実物と同じ）
export function ballReturned(state) {
  if (!state.ballActive) return null;
  state.ballActive = false;
  state.ballsShot--;
  return { ballsLeft: BALLS_PER_ROUND - state.ballsShot };
}

export function hitBell(state) {
  if (!state.ballActive || state.bellHit) return 0;
  state.bellHit = true;
  return 5;
}

function endRound(state) {
  state.results[state.currentPlayer] = state.total;
  if (state.mode === 'two' && state.currentPlayer === 0) {
    state.currentPlayer = 1;
    state.ballsShot = 0;
    state.total = 0;
    state.aimIndex = null;
    return { nextPlayer: 1 };
  }
  state.finished = true;
  let winner = null;
  if (state.mode === 'two') {
    const [a, b] = state.results;
    winner = a === b ? null : a > b ? 0 : 1;
  }
  const exact = state.settings.exact !== null ? state.total === state.settings.exact : null;
  return { finished: true, winner, exact };
}

// ポケットに入った。bonusはベルの加点
export function ballScored(state, pocketIndex, bonus = 0) {
  if (!state.ballActive) return null;
  state.ballActive = false;
  const points = state.settings.pockets[pocketIndex] + bonus;
  const prev = state.total;
  state.total += points;
  state.lastExpression = `${prev} + ${points} = ${state.total}`; // たしざんの体感（別冊04§7）
  const aimed = state.aimIndex === pocketIndex;
  state.aimIndex = null;
  const roundOver = state.ballsShot >= BALLS_PER_ROUND ? endRound(state) : null;
  return { points, prev, total: state.total, expression: state.lastExpression, aimed, roundOver };
}

// どこにも入らず止まってしまった（0点扱いで次へ）
export function ballLost(state) {
  if (!state.ballActive) return null;
  state.ballActive = false;
  state.aimIndex = null;
  const roundOver = state.ballsShot >= BALLS_PER_ROUND ? endRound(state) : null;
  return { total: state.total, roundOver };
}
