// ui.js — ころころキャッチの描画・入力（v0.17.4: スライダー操作に作り直し。v0.17.5: むずかしいのしかけ。
//   v0.17.6: 両手の縦スライダー2本 → 画面下の横スライダー1本に。子どもには両手の操作が難しかったため。
//   v0.17.8: おとな＝盤の高さ2倍・しかけ多め・ゴールは左右に動くカゴ。画面は全体が写る固定の画角）
// 盤の下にある横スライダーを親指1本で左右に動かすと、その位置で盤ぜんたいが傾く（右へ→右さがり）。
// 互い違いの段をボールがジグザグに転がり下りる。
// ふつう・むずかしいは左右の壁が無いので、傾けすぎると盤の横から落ちる→上からやり直し（タイムは続く）。
// 物理の工夫: 盤を回す代わりに重力の向きを傾ける（幾何は固定のまま）。見た目はCanvas全体を回転。
// 性能規定: 動的ボディはボール1個のみ。段は固定の静的セグメント（生成は開始時だけ）。
//   ゲート（上下する棒）・シーソー板・カゴは静的ボディの位置・角度を毎フレーム書き換えるだけ（物理計算は増えない）。
//   ベルトはボールに力を足すだけ（ボディは増えない）。
//   スライダーのつまみは入力があったときだけ transform を書く。タイム表示は100msごとだけDOMを触る。

import {
  buildShelves,
  gateOpenRatio,
  seesawTargetAngle,
  conveyorPush,
  basketX,
  updateCheckpoint,
  respawnShelf,
  tiltFromSlider,
  createGame,
  startRun,
  recordFall,
  elapsedOf,
  finishRun,
} from './game.js';
import { text } from '../../i18n.js';
import { getNames, turnOf, winOf } from '../../players.js';
import { playTap, playGoal, playWin, playFall } from '../../sound.js';
import { resetPraise, emitPraise, recordPlay } from '../../praise.js';
import { loadStats, saveStats } from '../../storage.js';
import { showResult, hideResult } from '../../resultView.js';

const BALL_R = 12;
const GRAVITY = 1.7;           // 段1本を2秒前後で渡れるテンポ
const TILT_LERP = 0.22;        // スライダーの位置へ傾きが追いつく速さ（実物の重さ感）
const TIMER_TICK_MS = 100;     // タイム表示の更新間隔（DOM更新はこの間隔のみ）
const NEXT_WAIT_MS = 1200;     // ゴール演出から次へ進むまで
const FALL_WAIT_MS = 900;      // 落ちてから上に戻すまで
const BOARD_W = 300;           // 盤の幅（盤座標）
// 盤の高さ（盤座標。下のうけ皿まで）は難易度ごと（settings.boardHeight。おとなは2倍の800）
const VIEW_SCALE_MAX = 0.78;   // 盤の縮小率の上限（実際は最大に傾けても四隅が収まる値に自動で下げる）
const CANVAS_H = 380;          // 盤の表示の高さ。下に横スライダーを置いてもiPhone SEの画面に収まる高さ
const CANVAS_H_MAX_ADULT = 640; // おとな（縦に長い盤）は画面の高さが許すぶんだけ大きく表示する
const MIN_BALL_PX = 7;         // 縮小表示（おとな）でもボールが見えるよう、画面上で最低この半径で描く（当たり判定は変えない）
const STUCK_FRAMES = 30;       // 傾いているのに止まったままなら少し押す（板のつなぎ目に引っかかったとき）
const STUCK_TILT_RAD = (6 * Math.PI) / 180;
const SEESAW_LERP = 0.12;      // シーソー板が目標の角度へ倒れる速さ

export function mount(root, config, { onExit }) {
  const M = window.Matter;
  const abort = new AbortController();
  const timers = new Set();
  const intervals = new Set();

  const isTwoMode = config.mode === 'two';
  const names = getNames(config.mode, [text.redName, text.blueName]);
  const debugMode = new URLSearchParams(window.location.search).has('debug');

  let state = null;
  let engine = null;
  let rafId = null;
  let shelves = [];
  let gates = [];        // ゲート { feature, body, closedY, phaseMs }（むずかしい1本・おとなは複数）
  let seesaws = [];      // シーソー板 { feature, body, angle }
  let conveyors = [];    // ベルトの feature（おとな）
  let basket = null;     // おとなのゴールのカゴ { bodies:[左ふち,右ふち,そこ,センサー], x }
  let boardH = 400;      // 今の難易度の盤の高さ
  let lastShelfY = 0;    // ボールが最後の段に来たかの判定用
  let onLastShelf = false;
  let roundStartedAt = 0; // ゲートの周期の基準（ラウンド開始時刻）
  let ballBody = null;
  let collisionHandler = null;
  let tilt = 0;          // 現在の盤の傾き(rad)
  let targetTilt = 0;    // スライダーから決まる目標の傾き
  let maxTiltDeg = 20;
  let ballPhase = 'none'; // none | rolling | falling（落下演出中）
  let stuckFrames = 0;
  let roundsPlayed = 0;
  let slider = 0.5;      // 横スライダーのつまみの位置（0=いちばん左, 0.5=まんなか, 1=いちばん右）
  let viewScale = VIEW_SCALE_MAX;

  let frameCount = 0;
  let fpsValue = 0;
  let fpsLastTime = 0;

  function later(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  }

  function every(fn, ms) {
    const id = setInterval(fn, ms);
    intervals.add(id);
    return id;
  }

  function clearAllTimers() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const id of intervals) clearInterval(id);
    intervals.clear();
  }

  // ---------- DOM生成（mount時に一度だけ） ----------

  root.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'kgb-rollcatch';

  const banner = document.createElement('div');
  banner.className = 'kgb-turn-banner';

  const statusEl = document.createElement('div');
  statusEl.className = 'kgb-rc-status';

  // ステージ: Canvas（盤）。その下に横スライダー1本（親指1本で左右に動かす）
  const stage = document.createElement('div');
  stage.className = 'kgb-rc-stage';
  const canvas = document.createElement('canvas');
  canvas.className = 'kgb-rc-canvas';
  stage.append(canvas);

  const track = document.createElement('div');
  track.className = 'kgb-rc-slider';
  const rail = document.createElement('div');
  rail.className = 'kgb-rc-rail';
  // まんなかの目印（ここに戻すと水平）
  const centerMark = document.createElement('div');
  centerMark.className = 'kgb-rc-center';
  const knob = document.createElement('div');
  knob.className = 'kgb-rc-knob';
  track.append(rail, centerMark, knob);

  const startOverlay = document.createElement('div');
  startOverlay.className = 'kgb-handover';
  startOverlay.hidden = true;
  const startTitle = document.createElement('p');
  startTitle.className = 'kgb-handover-title';
  const startSub = document.createElement('p');
  startSub.className = 'kgb-handover-sub';
  startSub.textContent = text.handoverTap;
  startOverlay.append(startTitle, startSub);

  const resultOverlay = document.createElement('div');
  resultOverlay.className = 'kgb-overlay';
  resultOverlay.hidden = true;

  container.append(banner, statusEl, stage, track);
  root.append(container, startOverlay, resultOverlay);

  const W = Math.min(root.clientWidth || 375, 400);
  // おとなは縦に長い盤なので、画面の下（スライダーの下）まで使えるだけ高くする。それ以外は今までどおり
  let H = CANVAS_H;
  if (config.difficulty === 'adult') {
    const stageTop = stage.getBoundingClientRect().top;
    const free = window.innerHeight - stageTop - 64 /* スライダー */ - 40 /* すき間とホームバーのぶん */;
    H = Math.round(Math.max(CANVAS_H, Math.min(CANVAS_H_MAX_ADULT, free)));
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const TRAY_H = 28; // 下のうけ皿

  // ---------- 表示の差分更新 ----------

  function formatSec(ms) {
    return (ms / 1000).toFixed(1);
  }

  function updateBanner(ms) {
    const timePart = `${text.rcTimeLabel}: ${formatSec(ms)}${text.rcSecSuffix}`;
    const fallPart = state.falls > 0 ? `　${text.rcFallPrefix}${state.falls}` : '';
    if (isTwoMode) {
      banner.textContent = `${names[state.currentPlayer]}${text.turnSuffix}　${timePart}${fallPart}`;
      banner.className = `kgb-turn-banner is-blinking kgb-player-${state.currentPlayer}`;
    } else {
      banner.textContent = timePart + fallPart;
      banner.className = 'kgb-turn-banner';
    }
  }

  function setStatus(message, happy) {
    statusEl.textContent = message;
    statusEl.classList.toggle('is-happy', Boolean(happy));
  }

  // つまみの位置（入力があったときだけ書く）
  function renderKnob() {
    const trackW = track.clientWidth || W;
    const knobW = knob.offsetWidth || 72;
    const x = slider * (trackW - knobW);
    knob.style.transform = `translateX(${Math.round(x)}px)`;
  }

  function setSlider(value) {
    slider = Math.max(0, Math.min(1, value));
    renderKnob();
    targetTilt = tiltFromSlider(slider, maxTiltDeg);
  }

  function resetSlider() {
    setSlider(0.5);
    targetTilt = 0;
    tilt = 0;
  }

  // 最大に傾けても盤の四隅が画面に収まる縮小率（盤を回したときの外枠の大きさから計算）
  function fitViewScale(maxDeg) {
    const a = (maxDeg * Math.PI) / 180;
    const boxW = BOARD_W * Math.cos(a) + boardH * Math.sin(a);
    const boxH = BOARD_W * Math.sin(a) + boardH * Math.cos(a);
    return Math.min(VIEW_SCALE_MAX, (W - 4) / boxW, (H - 4) / boxH);
  }

  // ---------- Matterワールド構築（盤座標: 0..BOARD_W × 0..boardH） ----------

  function setupEngine() {
    if (engine) {
      if (collisionHandler) M.Events.off(engine, 'collisionStart', collisionHandler);
      M.Composite.clear(engine.world, false);
      M.Engine.clear(engine);
    }
    engine = M.Engine.create({ enableSleeping: false });
    engine.gravity.y = GRAVITY;
    ballBody = null;
    ballPhase = 'none';
    maxTiltDeg = state.settings.maxTiltDeg;
    boardH = state.settings.boardHeight;
    viewScale = fitViewScale(maxTiltDeg);
    onLastShelf = false;

    const staticOpts = { isStatic: true, friction: 0.05, restitution: 0.1 };

    // 段: 点列を短い長方形セグメントでつなぐ（波波・穴もこの連結で表現）
    shelves = buildShelves(state.settings, BOARD_W);
    const bodies = [];
    for (const shelf of shelves) {
      for (const pts of shelf.segments) {
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          const len = Math.hypot(b.x - a.x, b.y - a.y) + 6;
          const seg = M.Bodies.rectangle((a.x + b.x) / 2, (a.y + b.y) / 2, len, 12, staticOpts);
          M.Body.setAngle(seg, Math.atan2(b.y - a.y, b.x - a.x));
          bodies.push(seg);
        }
      }
    }

    // 段の外側の端の丸い返し（壁がないとき）
    for (const shelf of shelves) {
      if (shelf.stopper) bodies.push(M.Bodies.circle(shelf.stopper.x, shelf.stopper.y, shelf.stopper.r, { ...staticOpts, friction: 0, frictionStatic: 0 }));
    }

    // しかけ: ゲート（段から出たり引っこんだりする棒）・シーソー板は静的ボディを動かす。ベルトは力を足すだけ
    gates = [];
    seesaws = [];
    conveyors = [];
    for (const shelf of shelves) {
      const f = shelf.feature;
      if (!f) continue;
      if (f.gates) {
        const closedY = f.y - 6 - f.height / 2; // 出ているときの中心（段の面の上に立つ）
        for (const g of f.gates) {
          const body = M.Bodies.rectangle(g.x, closedY, f.width, f.height, { ...staticOpts, friction: 0, frictionStatic: 0 });
          bodies.push(body);
          gates.push({ feature: f, x: g.x, phaseMs: g.phaseMs, body, closedY });
        }
      } else if (f.type === 'seesaw') {
        const body = M.Bodies.rectangle(f.x, f.pivotY, f.halfLength * 2, 12, { ...staticOpts });
        const angle = seesawTargetAngle(f, null, null);
        M.Body.setAngle(body, angle);
        bodies.push(body);
        seesaws.push({ feature: f, body, angle });
      } else if (f.type === 'conveyor') {
        conveyors.push(f);
      }
    }
    lastShelfY = shelves[shelves.length - 1].baseY;

    // 天井はつねに。左右の壁は かんたん だけ（ふつう・むずかしいは横から落ちる）
    bodies.push(M.Bodies.rectangle(BOARD_W / 2, -30, BOARD_W * 2, 20, staticOpts));
    if (state.settings.walls) {
      bodies.push(M.Bodies.rectangle(-8, boardH / 2, 20, boardH * 2, staticOpts));
      bodies.push(M.Bodies.rectangle(BOARD_W + 8, boardH / 2, 20, boardH * 2, staticOpts));
    }

    basket = null;
    const floor = M.Bodies.rectangle(BOARD_W / 2, boardH - 6, BOARD_W, 14, staticOpts);
    bodies.push(floor);
    const spec = state.settings.basket;
    if (!spec) {
      // 下のうけ皿（盤の幅だけ）。底に触れたらゴール
      const sensor = M.Bodies.rectangle(BOARD_W / 2, boardH - 18, BOARD_W - 8, 14, { isStatic: true, isSensor: true });
      sensor.plugin.kgbGoal = true;
      bodies.push(sensor);
    } else {
      // おとな: 床に落ちたら「おしい」。左右に動くカゴの中に入ったらゴール
      floor.plugin.kgbMiss = true;
      // 最後の段より下だけは左右にかべ（カゴをねらって外したのに「横から落ちた」にならないように）
      const zoneTop = lastShelfY + 14;
      const zoneH = boardH - zoneTop;
      bodies.push(M.Bodies.rectangle(-8, zoneTop + zoneH / 2, 20, zoneH, staticOpts));
      bodies.push(M.Bodies.rectangle(BOARD_W + 8, zoneTop + zoneH / 2, 20, zoneH, staticOpts));
      const floorTop = boardH - 13;
      const wallT = 6;
      const bottom = M.Bodies.rectangle(0, floorTop - 4, spec.innerWidth + wallT * 2, 8, staticOpts);
      const left = M.Bodies.rectangle(0, floorTop - spec.wallHeight / 2, wallT, spec.wallHeight, { ...staticOpts, friction: 0 });
      const right = M.Bodies.rectangle(0, floorTop - spec.wallHeight / 2, wallT, spec.wallHeight, { ...staticOpts, friction: 0 });
      const sensor = M.Bodies.rectangle(0, floorTop - 8 - 8, spec.innerWidth - 4, 14, { isStatic: true, isSensor: true });
      sensor.plugin.kgbGoal = true;
      basket = {
        spec,
        x: BOARD_W / 2,
        floorTop,
        parts: [
          { body: bottom, dx: 0 },
          { body: left, dx: -(spec.innerWidth / 2 + wallT / 2) },
          { body: right, dx: spec.innerWidth / 2 + wallT / 2 },
          { body: sensor, dx: 0 },
        ],
      };
      moveBasket(BOARD_W / 2);
      bodies.push(bottom, left, right, sensor);
    }
    M.Composite.add(engine.world, bodies);

    collisionHandler = (event) => {
      for (const pair of event.pairs) {
        const other = pair.bodyA === ballBody ? pair.bodyB : pair.bodyB === ballBody ? pair.bodyA : null;
        if (!other || ballPhase !== 'rolling') continue;
        if (other.plugin.kgbGoal) {
          onGoal();
          return;
        }
        if (other.plugin.kgbMiss) {
          onFall('miss');
          return;
        }
      }
    };
    M.Events.on(engine, 'collisionStart', collisionHandler);
  }

  // カゴを動かす（静的ボディの位置を書き換えるだけ）
  function moveBasket(x) {
    basket.x = x;
    for (const part of basket.parts) {
      M.Body.setPosition(part.body, { x: x + part.dx, y: part.body.position.y });
    }
  }

  // ---------- ラウンド進行 ----------

  function placeBall(shelfIdx = 0) {
    // その段の切れ目と反対側の端の上からスタート（いちばん上の段なら y=40）
    const shelf = shelves[shelfIdx];
    const startX = shelf.gapSide === 'right' ? 30 : BOARD_W - 30;
    onLastShelf = false;
    ballBody = M.Bodies.circle(startX, shelf.baseY - 40, BALL_R, {
      friction: 0.02,
      frictionStatic: 0, // 返しと段の角に挟まったとき静止摩擦で止まったままにならないように
      frictionAir: 0.001,
      restitution: 0.12,
      density: 0.003,
    });
    M.Composite.add(engine.world, ballBody);
    ballPhase = 'rolling';
  }

  function spawnBall() {
    placeBall();
    roundStartedAt = performance.now();
    startRun(state, roundStartedAt);
    setStatus(text.rcHint);
    updateBanner(0);
    // タイム表示はこの間隔でだけDOMを触る（§9: rAF内でのDOM更新禁止）
    every(() => {
      if (state.running) updateBanner(elapsedOf(state, performance.now()));
    }, TIMER_TICK_MS);
  }

  // 盤から落ちた: ことばで知らせてやり直し。タイムは止めない。
  // reason: 'side'=横から落ちた（はた か いちばん上から）／'miss'=おとなでカゴを外して床に落ちた（最後の段から）
  function onFall(reason = 'side') {
    if (ballPhase !== 'rolling') return;
    ballPhase = 'falling';
    recordFall(state);
    playFall();
    const shelfIdx = respawnShelf(state, reason);
    if (reason === 'miss') setStatus(text.rcMiss);
    else setStatus(shelfIdx > 0 ? text.rcFallFlag : text.rcFall);
    later(() => {
      if (ballBody) {
        M.Composite.remove(engine.world, ballBody);
        ballBody = null;
      }
      if (!state.running) return;
      placeBall(shelfIdx);
      setStatus(text.rcHint);
    }, FALL_WAIT_MS);
  }

  function onGoal() {
    const result = finishRun(state, performance.now());
    if (!result) return;
    clearAllTimers(); // タイム表示インターバルを止める
    ballPhase = 'none';
    if (ballBody) {
      M.Composite.remove(engine.world, ballBody);
      ballBody = null;
    }
    playGoal();
    setStatus(text.rcGoal, true);
    updateBanner(result.elapsedMs);

    if (result.nextPlayer !== undefined) {
      later(() => {
        setupEngine();
        resetSlider();
        setStatus('');
        updateBanner(0);
        showStartOverlay();
      }, NEXT_WAIT_MS);
      return;
    }
    later(() => finishGame(result), NEXT_WAIT_MS);
  }

  function showStartOverlay() {
    startTitle.textContent = isTwoMode
      ? names[state.currentPlayer] + text.turnSuffix
      : text.readyTitle;
    startOverlay.hidden = false;
  }

  startOverlay.addEventListener('click', () => {
    playTap();
    startOverlay.hidden = true;
    later(() => spawnBall(), 300);
  }, { signal: abort.signal });

  // ---------- 終了処理（保存はここで1回だけ。§9） ----------

  function finishGame(result) {
    roundsPlayed++;
    emitPraise('finished_game');
    if (roundsPlayed >= 3) emitPraise('retried');
    if (!state.settings.walls && state.fallsBy.every((f, i) => f === 0 && (i === 0 || isTwoMode))) emitPraise('no_fall_clear');

    let isNewRecord = false;
    let bestMs = result.elapsedMs;
    if (!isTwoMode) {
      // さいこうきろくは むずかしさ別のベストタイム（短いほどすごい）
      const stats = loadStats();
      stats.rollcatch ??= { plays: 0 };
      stats.rollcatch.bestBy ??= {};
      const prev = stats.rollcatch.bestBy[config.difficulty];
      if (prev === undefined || result.elapsedMs < prev) {
        stats.rollcatch.bestBy[config.difficulty] = result.elapsedMs;
        isNewRecord = true;
        emitPraise('new_record');
      }
      bestMs = Math.min(prev ?? Infinity, result.elapsedMs);
      saveStats(stats);
    }
    recordPlay('rollcatch', { won: false });

    let title;
    let detail;
    let celebrate;
    if (isTwoMode) {
      title = result.winner === null ? text.draw : winOf(names[result.winner]);
      detail = `${names[0]} ${formatSec(state.results[0])}${text.rcSecSuffix} ／ ${names[1]} ${formatSec(state.results[1])}${text.rcSecSuffix}`;
      celebrate = true;
    } else {
      title = `${formatSec(result.elapsedMs)}${text.rcGoalSuffix}`;
      detail = `${text.bestLabel}: ${formatSec(bestMs)}${text.rcSecSuffix}`;
      if (!state.settings.walls) detail += `　${text.rcFallPrefix}${result.falls}`;
      if (isNewRecord) detail += `\n${text.newRecord}`;
      celebrate = isNewRecord;
    }
    showResult(resultOverlay, {
      title,
      detail,
      celebrate,
      signal: abort.signal,
      onReplay: () => {
        playTap();
        restart();
      },
      onHome: () => {
        playTap();
        onExit();
      },
    });
  }

  function restart() {
    clearAllTimers();
    hideResult(resultOverlay);
    resetPraise();
    state = createGame({ difficulty: config.difficulty, mode: config.mode });
    setupEngine();
    resetSlider();
    setStatus('');
    updateBanner(0);
    showStartOverlay();
  }

  // ---------- 描画（rAFループ。盤の傾きはCanvas全体の回転で見せる） ----------

  function drawBoard() {
    ctx.fillStyle = '#f0d9b0';
    ctx.fillRect(0, 0, BOARD_W, boardH);
    // ふち: 壁があるときは太く、ないときは細い線だけ（落ちることが分かる）
    ctx.fillStyle = '#c89058';
    const edge = state.settings.walls ? 10 : 3;
    ctx.fillRect(0, 0, edge, boardH);
    ctx.fillRect(BOARD_W - edge, 0, edge, boardH);
    // おとな: カゴのまわりだけの左右のかべ
    if (basket) {
      const zoneTop = lastShelfY + 14;
      ctx.fillRect(0, zoneTop, 8, boardH - zoneTop);
      ctx.fillRect(BOARD_W - 8, zoneTop, 8, boardH - zoneTop);
    }
    ctx.fillRect(0, 0, BOARD_W, 8);
  }

  function drawShelves() {
    ctx.lineCap = 'round';
    // 角はとがらせる（丸いと だんさ の崖がなだらかな坂に見えてしまう。v0.17.9）
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 4;
    for (const shelf of shelves) {
      for (const pts of shelf.segments) {
        ctx.strokeStyle = '#c89058';
        ctx.lineWidth = 13;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        // 上面のハイライト（段の形を読み取りやすく）
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y - 5);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y - 5);
        ctx.stroke();
      }
      // 外側の端の丸い返し
      if (shelf.stopper) {
        ctx.fillStyle = '#a8713f';
        ctx.beginPath();
        ctx.arc(shelf.stopper.x, shelf.stopper.y, shelf.stopper.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // しかけ（ゲート・シーソー板・ベルト・はた）。位置・角度は物理ボディの値をそのまま使う
  function drawFeatures(now) {
    for (const g of gates) {
      const f = g.feature;
      const top = g.body.position.y - f.height / 2;
      const visible = f.y - 6 - top; // 段の面より上に出ている高さだけ描く（引っこんだ部分は段に隠れている）
      // 土台（段の面の上の小さな枠）
      ctx.fillStyle = '#a8713f';
      ctx.fillRect(g.x - f.width / 2 - 4, f.y - 10, f.width + 8, 5);
      if (visible > 0) {
        ctx.fillStyle = '#e06a4f';
        ctx.fillRect(g.x - f.width / 2, top, f.width, visible);
        // しましま（ふみきりの棒のように「止まれ」が分かる）
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        for (let y = top + 4; y < top + visible - 2; y += 10) ctx.fillRect(g.x - f.width / 2, y, f.width, 4);
      }
    }
    for (const sw of seesaws) {
      const f = sw.feature;
      // 支点（三角）
      ctx.fillStyle = '#8a6a4e';
      ctx.beginPath();
      ctx.moveTo(f.x, f.pivotY - 2);
      ctx.lineTo(f.x - 9, f.y + 12);
      ctx.lineTo(f.x + 9, f.y + 12);
      ctx.closePath();
      ctx.fill();
      // 板（傾く）
      ctx.save();
      ctx.translate(sw.body.position.x, sw.body.position.y);
      ctx.rotate(sw.body.angle);
      ctx.fillStyle = '#e3a955';
      ctx.fillRect(-f.halfLength, -6, f.halfLength * 2, 12);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillRect(-f.halfLength + 2, -6, f.halfLength * 2 - 4, 3);
      ctx.restore();
    }
    // ベルト: 段の上に灰色の帯と、押す向きに流れる矢じるし（押し戻されると分かるように）
    for (const f of conveyors) {
      const left = f.x - f.halfWidth;
      const width = f.halfWidth * 2;
      ctx.fillStyle = '#6f7d8c';
      ctx.fillRect(left, f.y - 8, width, 10);
      ctx.save();
      ctx.beginPath();
      ctx.rect(left, f.y - 8, width, 10);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2;
      const pushDir = -f.dir;
      // 押す強さが伝わるよう、矢じるしは速めに流す
      const offset = ((now / 12) % 16) * pushDir;
      for (let x = left - 16; x < left + width + 16; x += 16) {
        const cx = x + offset;
        ctx.beginPath();
        ctx.moveTo(cx - 3 * pushDir, f.y - 6);
        ctx.lineTo(cx + 3 * pushDir, f.y - 3);
        ctx.lineTo(cx - 3 * pushDir, f.y);
        ctx.stroke();
      }
      ctx.restore();
    }
    // はた（なかま地点）: 段の入口側の端に立てる。通ったら緑になる
    for (let i = 0; i < shelves.length; i++) {
      const shelf = shelves[i];
      if (!shelf.checkpoint) continue;
      const x = shelf.gapSide === 'right' ? 18 : BOARD_W - 18;
      const y = shelf.baseY - 6;
      const passed = state.checkpoint >= i;
      ctx.fillStyle = '#6b5442';
      ctx.fillRect(x - 1.5, y - 34, 3, 34);
      ctx.fillStyle = passed ? '#5cb85c' : '#e0a63a';
      ctx.beginPath();
      const dir = shelf.gapSide === 'right' ? 1 : -1;
      ctx.moveTo(x, y - 34);
      ctx.lineTo(x + 18 * dir, y - 28);
      ctx.lineTo(x, y - 22);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawTray() {
    if (basket) {
      // おとな: 床（ここに落ちたら おしい）と、左右に動くカゴ
      ctx.fillStyle = '#6b5442';
      ctx.fillRect(0, boardH - 13, BOARD_W, 13);
      const { spec, x, floorTop } = basket;
      const half = spec.innerWidth / 2;
      ctx.fillStyle = 'rgba(92, 184, 92, 0.25)';
      ctx.fillRect(x - half, floorTop - spec.wallHeight, spec.innerWidth, spec.wallHeight - 8);
      ctx.fillStyle = '#5cb85c';
      ctx.fillRect(x - half - 6, floorTop - 8, spec.innerWidth + 12, 8);
      ctx.fillRect(x - half - 6, floorTop - spec.wallHeight, 6, spec.wallHeight);
      ctx.fillRect(x + half, floorTop - spec.wallHeight, 6, spec.wallHeight);
      // あみめ（カゴらしく）
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      for (let y = floorTop - spec.wallHeight + 8; y < floorTop - 8; y += 8) {
        ctx.beginPath();
        ctx.moveTo(x - half, y);
        ctx.lineTo(x + half, y);
        ctx.stroke();
      }
      return;
    }
    ctx.fillStyle = '#8a6a4e';
    ctx.fillRect(0, boardH - 13, BOARD_W, 13);
    ctx.fillStyle = 'rgba(138, 106, 78, 0.3)';
    ctx.fillRect(0, boardH - TRAY_H, BOARD_W, TRAY_H - 13);
  }

  function drawBall() {
    if (!ballBody) return;
    const { x, y } = ballBody.position;
    const r = Math.max(BALL_R, MIN_BALL_PX / viewScale);
    const grad = ctx.createRadialGradient(x - r / 3, y - r / 3, 2, x, y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#b7bfc9');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(74, 63, 53, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(74, 63, 53, 0.35)';
    ctx.beginPath();
    ctx.arc(x + Math.cos(ballBody.angle) * r * 0.5, y + Math.sin(ballBody.angle) * r * 0.5, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    // 盤の傾き = 見た目の回転（スライダーの位置がそのまま角度になる）。
    // 回しても四隅が収まるよう少し縮小し、画面中央を軸に回す
    ctx.translate(W / 2, H / 2);
    ctx.rotate(tilt);
    ctx.scale(viewScale, viewScale);
    ctx.translate(-BOARD_W / 2, -boardH / 2);
    drawBoard();
    drawShelves();
    drawFeatures(now);
    drawTray();
    drawBall();
    ctx.restore();

    if (debugMode) {
      ctx.fillStyle = '#4a3f35';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${fpsValue}fps tilt=${((tilt * 180) / Math.PI).toFixed(1)}`, 8, 18);
    }
  }

  function loop(now) {
    rafId = requestAnimationFrame(loop);

    // 傾きをスライダーの位置へなめらかに追従させ、重力の向きに反映する
    tilt += (targetTilt - tilt) * TILT_LERP;
    engine.gravity.x = GRAVITY * Math.sin(tilt);
    engine.gravity.y = GRAVITY * Math.cos(tilt);

    // しかけを動かす（静的ボディの位置・角度だけ書き換える）
    const runMs = state.running ? now - roundStartedAt : 0;
    for (const g of gates) {
      const open = state.running ? gateOpenRatio(runMs, g.phaseMs) : 0;
      M.Body.setPosition(g.body, { x: g.x, y: g.closedY + open * (g.feature.height + 2) });
    }
    const ballPos = ballBody && ballPhase === 'rolling' ? ballBody.position : null;
    for (const sw of seesaws) {
      const target = seesawTargetAngle(sw.feature, ballPos ? ballPos.x : null, ballPos ? ballPos.y : null);
      if (Math.abs(target - sw.angle) > 1e-4) {
        sw.angle += (target - sw.angle) * SEESAW_LERP;
        M.Body.setAngle(sw.body, sw.angle);
      }
    }
    if (basket) moveBasket(basketX(runMs, basket.spec, BOARD_W));
    // ベルト: ボールが乗っていたら進む向きと逆に押す（重力と同じ単位の加速度 → 力）
    let onBelt = false;
    if (ballPos) {
      for (const f of conveyors) {
        const push = conveyorPush(f, ballPos.x, ballPos.y, GRAVITY, BALL_R);
        if (push !== 0) {
          onBelt = true;
          M.Body.applyForce(ballBody, ballPos, { x: ballBody.mass * push * engine.gravity.scale, y: 0 });
        }
      }
    }

    M.Engine.update(engine, 1000 / 60);

    // 盤の外に出た（横から落ちた）
    if (ballBody && ballPhase === 'rolling') {
      const { x, y } = ballBody.position;
      if (x < -BALL_R * 2 || x > BOARD_W + BALL_R * 2 || y > boardH + 40) onFall('side');
      // はた（なかま地点）を通った／最後の段に来た（おとな）: 変わったときだけことばを出す
      if (ballPhase === 'rolling' && state.settings.checkpoints.length) {
        const before = state.checkpoint;
        if (updateCheckpoint(state, shelves, y) !== before) setStatus(text.rcFlag, true);
      }
      if (ballPhase === 'rolling' && basket && !onLastShelf && y > lastShelfY - 40) {
        onLastShelf = true;
        setStatus(text.rcBasketHint);
      }
      // 傾いているのに止まったまま（板のつなぎ目に引っかかった）なら、傾きの向きに軽く押す。
      // ベルトの上では押さない（ベルトに負けて止まっているのは、傾けが足りないだけなので）
      const speed = Math.hypot(ballBody.velocity.x, ballBody.velocity.y);
      if (Math.abs(tilt) > STUCK_TILT_RAD && speed < 0.15 && !onBelt) stuckFrames++;
      else stuckFrames = 0;
      if (stuckFrames >= STUCK_FRAMES) {
        M.Body.setVelocity(ballBody, { x: Math.sign(tilt) * 1.2, y: ballBody.velocity.y });
        stuckFrames = 0;
      }
    }

    frameCount++;
    if (now - fpsLastTime >= 1000) {
      fpsValue = frameCount;
      frameCount = 0;
      fpsLastTime = now;
    }

    draw(now);
  }

  // ---------- 入力: 画面下の横スライダー（親指1本） ----------
  // つまみをつかまなくても、レールのどこを触ってもそこへ動く（4歳でも操作できるように）。
  // 指を離してもつまみはその位置に残る（離してもボールが転がり続け、落ち着いて見られる）

  function setSliderFromPointer(clientX) {
    const rect = track.getBoundingClientRect();
    const knobW = knob.offsetWidth || 72;
    const usable = rect.width - knobW;
    // つまみの中心が指の位置に来るように
    setSlider((clientX - rect.left - knobW / 2) / usable);
  }

  let activePointer = null; // 2本目の指は無視する（1本の指だけで動かす）
  track.addEventListener('pointerdown', (event) => {
    if (activePointer !== null) return;
    activePointer = event.pointerId;
    try {
      track.setPointerCapture(event.pointerId);
    } catch {
      // 合成イベントなどで捕捉できなくても動かす
    }
    setSliderFromPointer(event.clientX);
  }, { signal: abort.signal });
  track.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activePointer) return;
    setSliderFromPointer(event.clientX);
  }, { signal: abort.signal });
  const release = (event) => {
    if (event.pointerId === activePointer) activePointer = null;
  };
  track.addEventListener('pointerup', release, { signal: abort.signal });
  track.addEventListener('pointercancel', release, { signal: abort.signal });

  if (debugMode) {
    window.__kgbRollcatch = {
      get tilt() { return tilt; },
      get slider() { return slider; },
      get ball() { return ballBody ? { ...ballBody.position } : null; },
      get falls() { return state?.falls; },
      get running() { return state?.running; },
      get phase() { return ballPhase; },
      get seesaw() { return seesaws[0] ? { angle: seesaws[0].angle, bodyAngle: seesaws[0].body.angle } : null; },
      get basketX() { return basket ? basket.x : null; },
      get checkpoint() { return state?.checkpoint; },
      get shelves() { return shelves.map((sh) => ({ baseY: sh.baseY, gapSide: sh.gapSide, type: sh.feature?.type ?? null })); },
      get boardH() { return boardH; },
      get status() { return statusEl.textContent; },
      // テスト用: ボールを指定の段の入口に置き直す（しかけを1つずつ確かめるため）
      placeAt(shelfIdx) {
        if (ballBody) M.Composite.remove(engine.world, ballBody);
        placeBall(shelfIdx);
      },
      get velocity() { return ballBody ? { ...ballBody.velocity } : null; },
      setSlider(v) {
        setSlider(v);
      },
    };
  }

  restart();
  rafId = requestAnimationFrame(loop);

  return {
    destroy() {
      cancelAnimationFrame(rafId); // §9: 画面遷移時にrAFを必ず解除
      clearAllTimers();
      abort.abort();
      if (engine) {
        if (collisionHandler) M.Events.off(engine, 'collisionStart', collisionHandler);
        M.Composite.clear(engine.world, false);
        M.Engine.clear(engine);
      }
      if (debugMode) delete window.__kgbRollcatch;
      root.replaceChildren();
    },
  };
}
