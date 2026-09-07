// game.js — コリントゲームの純ロジック（DOM・物理非依存。別冊04§7）
// 盤のレイアウト（釘・ポケット・壁・ギミックの位置）もここで決めて、physics.js（Matter）と
// ui.js（描画）が同じデータを使う。ラウンド進行・たしざん表示・こうたい対戦も担当。
// v0.13.1: 反発板（バンパー）・ワープ・ベル複数を追加し、「おとな」（盤2×2倍）を新設。
// v0.13.3: ワープは「入ると別のあなからランダムに真上方向へ飛び出す」方式。天井の丸みは盤のサイズに比例。

export const BALLS_PER_ROUND = 5;
export const BALL_R = 9;   // 8px以上（小さいと釘をすり抜ける。別冊04§7）
export const PEG_R = 4;
export const LANE_W = 34;  // 右端の打ち出しレーンの幅
// 盤の高さ: ヘッダー・バナー・発射ボタンと合わせてiPhone SE(667px)に収まる値
export const CANVAS_H = 396;

// 釘の並び・ポケット得点・ギミックの数で難易度を表現。
// boardScale=2は盤が縦横2倍（面積4倍）。ギミックの位置は盤面に対する割合(fx,fy)で指定
export const DIFFICULTY = {
  easy: {
    boardScale: 1, pegRows: 4, pegCols: 5, staggered: false, pegR: 4,
    pockets: [1, 2, 5, 3, 1],           // 0点なし。1〜5の数の合成（4歳）
    pinwheels: [], bumpers: [], warps: [], bells: [],
    exact: null, countStep: 1, gravity: 0.9, launch: { min: 14, range: 6 }, warpExitSpeed: 11,
  },
  normal: {
    boardScale: 1, pegRows: 6, pegCols: 6, staggered: true, pegR: 4,
    pockets: [0, 10, 20, 50, 20, 10, 0], // 10単位のたしざん（6〜8歳）
    pinwheels: [{ fx: 0.5, fy: 0.55 }],
    // ななめの反発板で中央へはじく（左の板は右端を下げる=正の角度。壁側へ流すと角にはさまる）
    bumpers: [{ fx: 0.17, fy: 0.3, deg: 28 }, { fx: 0.83, fy: 0.3, deg: -28 }],
    warps: [], bells: [],
    exact: null, countStep: 10, gravity: 0.9, launch: { min: 14, range: 6 }, warpExitSpeed: 11,
  },
  hard: {
    boardScale: 1, pegRows: 8, pegCols: 7, staggered: true, pegR: 4,
    pockets: [0, 20, 50, 100, 50, 10, 0],
    pinwheels: [{ fx: 0.33, fy: 0.47 }, { fx: 0.72, fy: 0.72 }],
    bumpers: [{ fx: 0.16, fy: 0.2, deg: 28 }, { fx: 0.84, fy: 0.2, deg: -28 }, { fx: 0.45, fy: 0.92, deg: 0 }],
    // ワープあな: どれかに入ると別のあなから真上±45°の範囲でランダムに飛び出す
    warps: [{ fx: 0.15, fy: 0.78 }, { fx: 0.62, fy: 0.36 }, { fx: 0.9, fy: 0.55 }],
    bells: [{ fx: 0.5, fy: 0.1 }],
    exact: 100, countStep: 10, gravity: 0.9, launch: { min: 14, range: 6 }, warpExitSpeed: 11, // 「ぴったり100てん」モード
  },
  adult: {
    boardScale: 2, pegRows: 14, pegCols: 12, staggered: true, pegR: 5,
    pockets: [0, 10, 50, 100, 200, 100, 50, 20, 0],
    pinwheels: [
      { fx: 0.25, fy: 0.22 }, { fx: 0.75, fy: 0.22 }, { fx: 0.5, fy: 0.47 },
      { fx: 0.25, fy: 0.72 }, { fx: 0.75, fy: 0.72 },
    ],
    bumpers: [
      { fx: 0.1, fy: 0.34, deg: 28 }, { fx: 0.9, fy: 0.34, deg: -28 }, { fx: 0.5, fy: 0.3, deg: 0 },
      { fx: 0.12, fy: 0.58, deg: 22 }, { fx: 0.88, fy: 0.58, deg: -22 }, { fx: 0.5, fy: 0.9, deg: 0 },
    ],
    // ワープあな6個（上の2つはレーンの口から離しておく: 真上へ飛び出した球がレーンに落ちないように）
    warps: [
      { fx: 0.5, fy: 0.62 }, { fx: 0.5, fy: 0.06 },
      { fx: 0.06, fy: 0.8 }, { fx: 0.86, fy: 0.14 },
      { fx: 0.94, fy: 0.8 }, { fx: 0.08, fy: 0.14 },
    ],
    bells: [
      { fx: 0.5, fy: 0.16 }, { fx: 0.3, fy: 0.92 }, { fx: 0.7, fy: 0.92 },
      { fx: 0.18, fy: 0.45 }, { fx: 0.82, fy: 0.45 }, { fx: 0.35, fy: 0.62 }, { fx: 0.65, fy: 0.62 },
    ],
    // レーンが2倍長く天井の丸みも大きいので、最強なら盤の左端まで届く速さ（最大25px/フレーム）
    exact: null, countStep: 10, gravity: 0.8, launch: { min: 18, range: 7 }, warpExitSpeed: 13,
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
      rail: true, // 上のレール: 球が跳ねずに沿って滑るよう、物理側で反発を殺す
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

// 盤のレイアウト（W,Hは盤のサイズ。おとなはキャンバスの2倍）。
// 右端に打ち出しレーン、上は丸いレールで左へ、下に得点ポケット
export function buildLayout(settings, W, H) {
  const laneWallX = W - LANE_W - 2; // レーンと盤面を仕切る壁の中心x
  const fieldRight = laneWallX - 2; // 盤面の右端
  const fieldLeft = 4;
  const POCKET_H = 50;
  // 上のレールの丸みは盤のサイズに比例させる（おとなは2倍。小さいままだと球が左端まで届かない）
  const scale = settings.boardScale;
  const bigR = 74 * scale;
  const smallR = 40 * scale;
  const arcCy = bigR + 4;          // 右上の丸みの中心y（丸みの上端が盤の上辺に接する）
  const LANE_TOP = arcCy + 14;     // レーンの仕切りの上端（丸みの下で口を開ける）

  // 上のレール: レーン上端 → 右上の大きな丸み → 上辺 → 左上の丸み → 左壁
  const top = [
    ...arcPoints(W - 4 - bigR, arcCy, bigR, 0, -90, 10 * scale),
    ...arcPoints(fieldLeft + smallR, 4 + smallR, smallR, -90, -180, 6 * scale),
  ];
  // 壁は厚めにする: 速い球が1フレームで薄い壁の中心を越えると反対側へ押し出される
  // （自動テストで床すり抜けが再現した）ため、外周は盤の外側へ厚みをとる
  const walls = [
    ...segmentsOf(top, 14),
    { cx: fieldLeft - 8, cy: (H + 4 + smallR) / 2, w: 20, h: H - 4 - smallR, angle: 0 }, // 左壁
    { cx: W + 6, cy: (H + arcCy) / 2, w: 20, h: H - arcCy, angle: 0 },     // 右壁（レーンの外側）
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

  // ギミックの位置: 盤面（釘の帯）に対する割合で指定 → 実座標へ
  const pegTop = arcCy + 44;
  const pegBottom = H - POCKET_H - 40;
  const fieldW = fieldRight - fieldLeft;
  const band = pegBottom - pegTop;
  const at = (p) => ({ x: fieldLeft + fieldW * p.fx, y: pegTop + band * p.fy });
  const big = settings.boardScale > 1;

  const pinwheels = settings.pinwheels.map((p) => ({ ...at(p), len: big ? 60 : 52 }));
  // 反発板（バンパー）: ななめの板で球を強くはじく
  const bumpers = settings.bumpers.map((p) => ({
    ...at(p), w: big ? 64 : 50, h: 12, angle: (p.deg * Math.PI) / 180,
  }));
  // ワープあな: どれかに入ると別のあなから飛び出す
  const warps = settings.warps.map((p, index) => ({ ...at(p), r: big ? 18 : 15, index }));
  const bells = settings.bells.map((p, index) => ({ ...at(p), r: 9, index }));

  // ギミックの近くに釘を置かない（半径＋余白）
  const blockers = [
    ...pinwheels.map((p) => ({ x: p.x, y: p.y, r: p.len / 2 + 22 })),
    ...bumpers.map((p) => ({ x: p.x, y: p.y, r: p.w / 2 + 18 })),
    ...warps.map((p) => ({ x: p.x, y: p.y, r: p.r + 26 })),
    ...bells.map((p) => ({ x: p.x, y: p.y, r: 30 })),
  ];

  // 釘: 上下に等間隔。千鳥は1行おきに半分ずらして1本減らす。
  // 端の釘は壁から球の直径以上はなす（壁と釘のすき間に球がはさまるのを防ぐ）
  const pegs = [];
  const EDGE = 32;
  const rowGap = band / (settings.pegRows - 1);
  const colGap = (fieldW - EDGE * 2) / (settings.pegCols - 1);
  for (let r = 0; r < settings.pegRows; r++) {
    const y = pegTop + rowGap * r;
    const shifted = settings.staggered && r % 2 === 1;
    const cols = shifted ? settings.pegCols - 1 : settings.pegCols;
    for (let c = 0; c < cols; c++) {
      const x = fieldLeft + EDGE + colGap * c + (shifted ? colGap / 2 : 0);
      const blocked = blockers.some((b) => Math.hypot(b.x - x, b.y - y) < b.r);
      if (!blocked) pegs.push({ x, y });
    }
  }

  return {
    W, H, laneWallX, fieldLeft, fieldRight, pocketH: POCKET_H, laneTop: LANE_TOP,
    spawn: { x: W - 2 - LANE_W / 2, y: H - 30 },
    walls, pockets, sensors, pinwheels, bumpers, warps, bells, pegs,
    pegR: settings.pegR,
    gravity: settings.gravity,
    launch: settings.launch,
    warpExitSpeed: settings.warpExitSpeed,
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
    bellsHit: new Set(), // この球で鳴らしたベル（1球につき各1回まで）
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
  state.bellsHit = new Set();
  return state.ballsShot;
}

// 弱くてレーンに戻ってきた: 球は消費しない（実物と同じ）
export function ballReturned(state) {
  if (!state.ballActive) return null;
  state.ballActive = false;
  state.ballsShot--;
  return { ballsLeft: BALLS_PER_ROUND - state.ballsShot };
}

export function hitBell(state, index = 0) {
  if (!state.ballActive || state.bellsHit.has(index)) return 0;
  state.bellsHit.add(index);
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
