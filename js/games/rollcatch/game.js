// game.js — ころころキャッチの純ロジック（DOM・物理非依存）
// v0.10.1で駄菓子屋の「シーソーゲーム」型に。v0.17.4で操作と難易度を作り直し:
//   操作: 画面の左右にある縦スライダーを両手の親指で上下して盤を傾ける（実物のシーソー盤を両手で持つ感覚）
//   難易度: ふつう・むずかしいは左右の壁が無く、傾けすぎると盤の横からボールが落ちる（落ちたら上からやり直し）。
// v0.17.5: むずかしいは「段ごとに違うしかけ」のコースに（穴は「落ちるだけ」で面白くなかったので廃止）:
//   でこぼこ → やま → ゲート（上がり下がりする棒。下がった時だけ通れる）→ シーソー板（まんなかを越えると傾く）
//   → だんさ（一方通行の段差）→ くぼみ（止まってしまう。傾けて登る）

export const DIFFICULTY = {
  // walls: 左右の壁 / wave: 波の振幅(px) / gapRatio: 切れ目の広さ / maxTiltDeg: 最大の傾き
  // stopper: 壁がないときの段の外側の端の小さな返し(px)。ゆっくりなら止まるが、勢いがつくと乗り越えて落ちる
  // features: 段ごとのしかけ（上から順）。無い段は平らな段（wave の波波だけ）
  easy: { shelfCount: 4, wave: 0, gapRatio: 0.26, maxTiltDeg: 20, walls: true, stopper: 0, features: [] },
  normal: { shelfCount: 5, wave: 1.5, gapRatio: 0.22, maxTiltDeg: 24, walls: false, stopper: 10, features: [] },
  hard: {
    shelfCount: 6, wave: 0, gapRatio: 0.2, maxTiltDeg: 26, walls: false, stopper: 7,
    features: ['bumps', 'hill', 'gate', 'seesaw', 'step', 'valley'],
  },
};

export const WAVE_LENGTH = 70; // 波波の波長(px)
export const SHELF_TOP = 80;   // いちばん上の段のy（盤座標）
export const SHELF_BOTTOM = 330;

// しかけの寸法（盤座標px）。ボールは半径12・最大の傾き26°なので、坂の最大角度はどれも26°より小さくしてある
export const FEATURE = {
  bumps: { amp: 2, length: 50 },          // でこぼこ: 短い波（最大の坂 約14°）
  hill: { height: 8, halfWidth: 50 },     // やま: まんなかの盛り上がり（最大の坂 約14°）
  valley: { depth: 6, halfWidth: 45 },    // くぼみ: まんなかのへこみ（最大の坂 約12°）
  step: { height: 14 },                   // だんさ: 入口側の半分が高い。降りたら戻れない
  gate: { width: 8, height: 30, periodMs: 3200, rampMs: 350 }, // ゲート: 棒が段から出たり引っこんだり
  seesaw: { halfLength: 40, maxAngleDeg: 10, clearance: 3 },  // シーソー板: まんなかを支点に傾く
};

// 段の形を作る: 偶数段は右に切れ目（左から右へ転がす）、奇数段は左に切れ目。
// 点列はui.jsがそのまま物理セグメントと描画に使う。しかけのある段は feature に種類と位置を入れる
export function buildShelves(settings, width) {
  const shelves = [];
  const step = 12; // 細かく区切るほど板のつなぎ目の段差が小さくなり、ボールが引っかからない
  const spacing = (SHELF_BOTTOM - SHELF_TOP) / (settings.shelfCount - 1);
  for (let i = 0; i < settings.shelfCount; i++) {
    const baseY = SHELF_TOP + spacing * i;
    const gapSide = i % 2 === 0 ? 'right' : 'left';
    const startX = gapSide === 'right' ? 4 : width * settings.gapRatio;
    const endX = gapSide === 'right' ? width * (1 - settings.gapRatio) : width - 4;
    const centerX = (startX + endX) / 2;
    const type = settings.features[i] ?? null;
    const dir = gapSide === 'right' ? 1 : -1; // ボールが進む向き（+1=右へ）
    const yAt = (px) => baseY + shelfProfile(type, settings, px, centerX, dir);

    // シーソー板の段はまんなかに板ぶんの切れ目（板は動く別の物体としてui.jsが置く）
    const holeHalf = type === 'seesaw' ? FEATURE.seesaw.halfLength + FEATURE.seesaw.clearance : 0;
    const segments = [];
    let points = [];
    for (let x = startX; x < endX + step; x += step) {
      const px = Math.min(x, endX);
      const inHole = holeHalf > 0 && Math.abs(px - centerX) < holeHalf;
      if (inHole) {
        if (points.length) {
          points.push({ x: centerX - holeHalf, y: yAt(centerX - holeHalf) });
          segments.push(points);
          points = [];
        }
      } else {
        if (!points.length && holeHalf > 0 && px > centerX) points.push({ x: centerX + holeHalf, y: yAt(centerX + holeHalf) });
        // だんさ: 境目に2点を足してほぼ垂直な面にする（12px刻みのままだと斜面になって逆走できてしまう）
        if (type === 'step' && px - step < centerX && px >= centerX && px !== centerX) {
          points.push({ x: centerX - 1, y: yAt(centerX - 1) }, { x: centerX + 1, y: yAt(centerX + 1) });
        }
        points.push({ x: px, y: yAt(px) });
      }
      if (px >= endX) break;
    }
    if (points.length) segments.push(points);

    // 壁がないときは外側の端（切れ目の反対側）に小さな丸い返し（盤の端ぎりぎりで止まれる余地。
    // 角のある板だとボールが引っかかるので丸にする）。ゆっくりなら止まり、勢いがつくと乗り越えて落ちる
    let stopper = null;
    if (settings.stopper > 0 && segments.length) {
      const endPoint = gapSide === 'right' ? segments[0][0] : segments[segments.length - 1].slice(-1)[0];
      stopper = { x: endPoint.x + (gapSide === 'right' ? -2 : 2), y: endPoint.y - settings.stopper + 4, r: settings.stopper };
    }

    let feature = null;
    if (type === 'gate') feature = { type, x: centerX, y: baseY, ...FEATURE.gate };
    else if (type === 'seesaw') feature = { type, x: centerX, y: baseY, dir, ...FEATURE.seesaw };
    else if (type) feature = { type, x: centerX, y: baseY };

    shelves.push({ points: segments.flat(), segments, gapSide, baseY, stopper, feature });
  }
  return shelves;
}

// 段の高さの形（baseYからのずれ。下が正）。dir はボールの進む向き
export function shelfProfile(type, settings, px, centerX, dir) {
  const d = px - centerX;
  switch (type) {
    case 'bumps':
      return FEATURE.bumps.amp * Math.sin((px / FEATURE.bumps.length) * Math.PI * 2);
    case 'hill': {
      const { height, halfWidth } = FEATURE.hill;
      if (Math.abs(d) >= halfWidth) return 0;
      return -(height / 2) * (1 + Math.cos((d / halfWidth) * Math.PI));
    }
    case 'valley': {
      const { depth, halfWidth } = FEATURE.valley;
      if (Math.abs(d) >= halfWidth) return 0;
      return (depth / 2) * (1 + Math.cos((d / halfWidth) * Math.PI));
    }
    case 'step':
      // 入口側（進む向きの手前）が高い
      return d * dir < 0 ? -FEATURE.step.height : 0;
    default:
      return settings.wave * Math.sin((px / WAVE_LENGTH) * Math.PI * 2);
  }
}

// ゲートの開き具合（0=棒が出ていて通れない, 1=引っこんでいて通れる）。周期の前半で開き、後半で閉じる
export function gateOpenRatio(tMs) {
  const { periodMs, rampMs } = FEATURE.gate;
  const p = ((tMs % periodMs) + periodMs) % periodMs;
  const half = periodMs / 2;
  if (p < rampMs) return p / rampMs;
  if (p < half) return 1;
  if (p < half + rampMs) return 1 - (p - half) / rampMs;
  return 0;
}

// シーソー板の目標の角度(rad)。ふだんは入口側が下がっていて、ボールが支点を越えると出口側へ倒れる。
// ballX が null（ボール無し）や、ボールがこの段の高さにいないときは入口側が下がった状態に戻す
export function seesawTargetAngle(feature, ballX, ballY) {
  const max = (feature.maxAngleDeg * Math.PI) / 180;
  const onLevel = ballX !== null && ballY !== null && ballY > feature.y - 60 && ballY < feature.y + 10;
  const past = onLevel && (ballX - feature.x) * feature.dir > 2;
  // 角度は時計回りが正（右端が下がる）。入口が左（dir=+1）なら左端を下げる＝負
  return (past ? 1 : -1) * feature.dir * max;
}

// 左右のスライダー（0=いちばん下, 1=いちばん上）から盤の傾き(rad)を決める。
// 左を上げる→盤は右さがり（正の角度=時計回り）。両方同じ高さなら水平
export function tiltFromSliders(left, right, maxTiltDeg) {
  const diff = Math.max(-1, Math.min(1, left - right));
  return (diff * maxTiltDeg * Math.PI) / 180;
}

export function createGame({ difficulty = 'easy', mode = 'solo' } = {}) {
  return {
    mode,
    settings: DIFFICULTY[difficulty],
    running: false,
    startedAt: null,
    elapsedMs: null,     // 今のラウンドの結果（ゴール時に確定）
    falls: 0,            // 今のラウンドで落ちた回数
    currentPlayer: 0,
    results: [null, null], // こうたい対戦の各プレイヤーのタイム(ms)
    fallsBy: [0, 0],
    finished: false,
  };
}

// ボールが出た（タイム計測開始）。nowは注入できる（テスト用）
export function startRun(state, now) {
  if (state.finished || state.running) return false;
  state.running = true;
  state.startedAt = now;
  state.elapsedMs = null;
  state.falls = 0;
  return true;
}

// 盤から落ちた（タイムは止めず、上からやり直す）
export function recordFall(state) {
  if (!state.running) return 0;
  state.falls += 1;
  return state.falls;
}

export function elapsedOf(state, now) {
  if (!state.running || state.startedAt === null) return 0;
  return now - state.startedAt;
}

// ゴールした。こうたい対戦なら交代、そうでなければ終了
export function finishRun(state, now) {
  if (!state.running) return null;
  state.running = false;
  state.elapsedMs = now - state.startedAt;
  state.results[state.currentPlayer] = state.elapsedMs;
  state.fallsBy[state.currentPlayer] = state.falls;
  if (state.mode === 'two' && state.currentPlayer === 0) {
    state.currentPlayer = 1;
    return { elapsedMs: state.elapsedMs, falls: state.falls, nextPlayer: 1 };
  }
  state.finished = true;
  let winner = null;
  if (state.mode === 'two') {
    const [a, b] = state.results;
    winner = a === b ? null : a < b ? 0 : 1; // タイムが短いほうの勝ち
  }
  return { elapsedMs: state.elapsedMs, falls: state.falls, finished: true, winner };
}
