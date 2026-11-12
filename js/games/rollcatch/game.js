// game.js — ころころキャッチの純ロジック（DOM・物理非依存）
// v0.10.1で駄菓子屋の「シーソーゲーム」型に。v0.17.4で操作と難易度を作り直し:
//   操作: 盤を傾けるスライダーで操作（v0.17.6で「画面下の横スライダー1本を親指1本で左右に動かす」に変更。
//         両手で左右の縦スライダーを動かすのは子どもには難しかったため）
//   難易度: ふつう・むずかしいは左右の壁が無く、傾けすぎると盤の横からボールが落ちる（落ちたら上からやり直し）。
// v0.17.5: むずかしいは「段ごとに違うしかけ」のコースに（穴は「落ちるだけ」で面白くなかったので廃止）:
//   でこぼこ → やま → ゲート（上がり下がりする棒。下がった時だけ通れる）→ シーソー板（まんなかを越えると傾く）
//   → だんさ（一方通行の段差）→ くぼみ（止まってしまう。傾けて登る）
// v0.17.8: 「おとな」を追加。盤の高さ2倍（段12本）・切れ目と返しが小さい・11段にしかけ（新しく ベルト＝押し戻す床、
//   ゲート2つ＝互い違いに開く）。ゴールは床ではなく「左右に動くカゴ」に入れたときだけ。床に落ちたら最後の段からやり直し。
//   コースが長いので7段目に「はた」（なかま地点）。横から落ちたら はた から再開

export const DIFFICULTY = {
  // walls: 左右の壁 / wave: 波の振幅(px) / gapRatio: 切れ目の広さ / maxTiltDeg: 最大の傾き
  // stopper: 壁がないときの段の外側の端の小さな返し(px)。ゆっくりなら止まるが、勢いがつくと乗り越えて落ちる
  // features: 段ごとのしかけ（上から順）。無い段は平らな段（wave の波波だけ）
  // boardHeight: 盤の高さ / checkpoints: はた（なかま地点）の段 / basket: ゴールのカゴ（null=床に落ちたらゴール）
  easy: { shelfCount: 4, boardHeight: 400, wave: 0, gapRatio: 0.26, maxTiltDeg: 20, walls: true, stopper: 0, features: [], checkpoints: [], basket: null },
  normal: { shelfCount: 5, boardHeight: 400, wave: 1.5, gapRatio: 0.22, maxTiltDeg: 24, walls: false, stopper: 10, features: [], checkpoints: [], basket: null },
  hard: {
    shelfCount: 6, boardHeight: 400, wave: 0, gapRatio: 0.2, maxTiltDeg: 26, walls: false, stopper: 7,
    features: ['bumps', 'hill', 'gate', 'seesaw', 'step', 'valley'], checkpoints: [], basket: null,
  },
  adult: {
    shelfCount: 12, boardHeight: 800, wave: 1.5, gapRatio: 0.18, maxTiltDeg: 26, walls: false, stopper: 6,
    // 最後の段はしかけなし（カゴのタイミングに集中できるように）
    features: ['bumps', 'gate', 'hill', 'conveyor', 'seesaw', 'step', 'gate2', 'valley', 'conveyor', 'seesaw', 'gate2', null],
    checkpoints: [6],
    // innerWidth: カゴの内側の幅（ボールの直径は24）/ periodMs: 1往復の時間 / wallHeight: カゴのふちの高さ
    basket: { innerWidth: 50, periodMs: 3000, wallHeight: 34 },
  },
};

export const WAVE_LENGTH = 70; // 波波の波長(px)
export const SHELF_TOP = 80;   // いちばん上の段のy（盤座標）
export const SHELF_BOTTOM_MARGIN = 70; // いちばん下の段から盤の下までの高さ（うけ皿・カゴの場所）

// しかけの寸法（盤座標px）。ボールは半径12・最大の傾き26°なので、坂の最大角度はどれも26°より小さくしてある
export const FEATURE = {
  bumps: { amp: 2, length: 50 },          // でこぼこ: 短い波（最大の坂 約14°）
  hill: { height: 8, halfWidth: 50 },     // やま: まんなかの盛り上がり（最大の坂 約14°）
  valley: { depth: 6, halfWidth: 45 },    // くぼみ: まんなかのへこみ（最大の坂 約12°）
  step: { height: 14 },                   // だんさ: 入口側の半分が高い。降りたら戻れない
  gate: { width: 8, height: 30, periodMs: 3200, rampMs: 350 }, // ゲート: 棒が段から出たり引っこんだり
  gate2: { spacing: 76 },                 // ゲート2つ: 間をあけて2本。互い違い（半周期ずらし）に開くので間で待つ
  seesaw: { halfLength: 40, maxAngleDeg: 10, clearance: 3 },  // シーソー板: まんなかを支点に傾く
  // ベルト: 段のまんなかの床がボールを押し戻す（進む向きと逆）。pushDeg は「この角度の坂と同じ強さ」。
  // 最大の傾き(26°)より十分小さいので、しっかり傾ければ越えられる
  conveyor: { halfWidth: 48, pushDeg: 9 },
};

// 段の形を作る: 偶数段は右に切れ目（左から右へ転がす）、奇数段は左に切れ目。
// 点列はui.jsがそのまま物理セグメントと描画に使う。しかけのある段は feature に種類と位置を入れる
export function buildShelves(settings, width) {
  const shelves = [];
  const step = 12; // 細かく区切るほど板のつなぎ目の段差が小さくなり、ボールが引っかからない
  const shelfBottom = settings.boardHeight - SHELF_BOTTOM_MARGIN;
  const spacing = (shelfBottom - SHELF_TOP) / (settings.shelfCount - 1);
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
    if (type === 'gate') feature = { type, x: centerX, y: baseY, ...FEATURE.gate, gates: [{ x: centerX, phaseMs: 0 }] };
    else if (type === 'gate2') {
      // 入口側のゲートが先に開き、出口側は半周期おくれて開く
      const half = FEATURE.gate2.spacing / 2;
      feature = {
        type, x: centerX, y: baseY, ...FEATURE.gate,
        gates: [
          { x: centerX - dir * half, phaseMs: 0 },
          { x: centerX + dir * half, phaseMs: FEATURE.gate.periodMs / 2 },
        ],
      };
    } else if (type === 'conveyor') feature = { type, x: centerX, y: baseY, dir, ...FEATURE.conveyor };
    else if (type === 'seesaw') {
      // 支点は段の面より少し高い: 倒れて下がった側の端が、となりの段の面とぴったり同じ高さになる
      // （支点が段と同じ高さだと、下がった端が段より低くなり、ゆっくり来たボールが段差を登れず止まるため。v0.17.8）
      const pivotY = baseY - FEATURE.seesaw.halfLength * Math.sin((FEATURE.seesaw.maxAngleDeg * Math.PI) / 180);
      feature = { type, x: centerX, y: baseY, pivotY, dir, ...FEATURE.seesaw };
    }
    else if (type) feature = { type, x: centerX, y: baseY };

    const checkpoint = (settings.checkpoints ?? []).includes(i);
    shelves.push({ points: segments.flat(), segments, gapSide, baseY, stopper, feature, checkpoint });
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
    case 'conveyor':
      // ベルトの段は平ら（波の上り坂と押し戻しが重なると、しっかり傾けても谷から出られなくなるため）
      return 0;
    case 'step':
      // 入口側（進む向きの手前）が高い
      return d * dir < 0 ? -FEATURE.step.height : 0;
    default:
      return settings.wave * Math.sin((px / WAVE_LENGTH) * Math.PI * 2);
  }
}

// ゲートの開き具合（0=棒が出ていて通れない, 1=引っこんでいて通れる）。周期の前半で開き、後半で閉じる
export function gateOpenRatio(tMs, phaseMs = 0) {
  const { periodMs, rampMs } = FEATURE.gate;
  const t = tMs - phaseMs;
  const p = ((t % periodMs) + periodMs) % periodMs;
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

// ベルトの上でボールを押し戻す加速度（重力と同じ単位）。ボールがベルトの上にいなければ0。
// 進む向きと逆に押す。ボールの位置だけで決まる純関数（ui.jsは毎フレームこれを力にして足す）
export function conveyorPush(feature, ballX, ballY, gravity, ballR) {
  if (!feature || feature.type !== 'conveyor') return 0;
  const onBelt = Math.abs(ballX - feature.x) <= feature.halfWidth && ballY > feature.y - 6 - ballR - 6 && ballY < feature.y;
  if (!onBelt) return 0;
  return -feature.dir * gravity * Math.sin((feature.pushDeg * Math.PI) / 180);
}

// カゴの中心のx（盤座標）。左右に sin で往復する（はしで少しゆっくりになるので、ねらう場所を選べる）
export function basketX(tMs, basket, boardWidth) {
  const margin = basket.innerWidth / 2 + 10;
  const center = boardWidth / 2;
  const amp = center - margin;
  return center + amp * Math.sin((tMs / basket.periodMs) * Math.PI * 2);
}

// ボールのyから、はた（なかま地点）を通ったかを更新する。通った はた の段の番号を返す
export function updateCheckpoint(state, shelves, ballY) {
  for (const idx of state.settings.checkpoints ?? []) {
    if (idx > state.checkpoint && shelves[idx] && ballY > shelves[idx].baseY - 40) state.checkpoint = idx;
  }
  return state.checkpoint;
}

// やり直す段: 横から落ちた → はた（なければ いちばん上）、カゴを外して床に落ちた → 最後の段
export function respawnShelf(state, reason) {
  if (reason === 'miss') return state.settings.shelfCount - 1;
  return state.checkpoint;
}

// 横スライダー（0=いちばん左, 0.5=まんなか, 1=いちばん右）から盤の傾き(rad)を決める。
// つまみを右へ→盤は右さがり（正の角度=時計回り）。まんなかなら水平。
// 指の動いた向きと、ボールの転がる向きが同じになる（4歳でも直感で分かる）
export function tiltFromSlider(value, maxTiltDeg) {
  const v = Math.max(0, Math.min(1, value));
  return ((v - 0.5) * 2 * maxTiltDeg * Math.PI) / 180;
}

export function createGame({ difficulty = 'easy', mode = 'solo' } = {}) {
  return {
    mode,
    settings: DIFFICULTY[difficulty],
    running: false,
    startedAt: null,
    elapsedMs: null,     // 今のラウンドの結果（ゴール時に確定）
    falls: 0,            // 今のラウンドで落ちた回数（おとなはカゴを外して床に落ちたのも数える）
    checkpoint: 0,       // 通った はた の段（おとな）。0=いちばん上
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
  state.checkpoint = 0;
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
