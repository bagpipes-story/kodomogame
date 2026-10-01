// ui.js — ころころキャッチの描画・入力（v0.17.4: 両手スライダー操作に作り直し。v0.17.5: むずかしいのしかけ）
// 画面の左右にある縦スライダーを両手の親指で上下すると、その高さの差で盤ぜんたいが傾く
// （実物のシーソー盤を両手で持って傾ける感覚）。互い違いの段をボールがジグザグに転がり下りる。
// ふつう・むずかしいは左右の壁が無いので、傾けすぎると盤の横から落ちる→上からやり直し（タイムは続く）。
// 物理の工夫: 盤を回す代わりに重力の向きを傾ける（幾何は固定のまま）。見た目はCanvas全体を回転。
// 性能規定: 動的ボディはボール1個のみ。段は固定の静的セグメント（生成は開始時だけ）。
//   むずかしいのゲート（上下する棒）とシーソー板は静的ボディの位置・角度を毎フレーム書き換えるだけ（物理計算は増えない）。
//   スライダーのつまみは入力があったときだけ transform を書く。タイム表示は100msごとだけDOMを触る。

import {
  buildShelves,
  gateOpenRatio,
  seesawTargetAngle,
  tiltFromSliders,
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
const BOARD_H = 400;           // 盤の高さ（盤座標。下のうけ皿まで）
const VIEW_SCALE = 0.78;       // 回転しても四隅が収まる縮小率
const SLIDER_W = 52;           // 左右の親指ゾーンの幅
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
  let gate = null;       // むずかしいのゲート { feature, body, closedY }
  let seesaw = null;     // むずかしいのシーソー板 { feature, body, angle }
  let roundStartedAt = 0; // ゲートの周期の基準（ラウンド開始時刻）
  let ballBody = null;
  let collisionHandler = null;
  let tilt = 0;          // 現在の盤の傾き(rad)
  let targetTilt = 0;    // スライダーから決まる目標の傾き
  let maxTiltDeg = 20;
  let ballPhase = 'none'; // none | rolling | falling（落下演出中）
  let stuckFrames = 0;
  let roundsPlayed = 0;
  const slider = [0.5, 0.5]; // 左・右のつまみの高さ（0=下, 1=上）

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

  // ステージ: Canvas（盤）の上に左右のスライダーを重ねる
  const stage = document.createElement('div');
  stage.className = 'kgb-rc-stage';
  const canvas = document.createElement('canvas');
  canvas.className = 'kgb-rc-canvas';

  const sliderEls = [];
  const knobEls = [];
  for (const side of ['left', 'right']) {
    const track = document.createElement('div');
    track.className = `kgb-rc-slider is-${side}`;
    const rail = document.createElement('div');
    rail.className = 'kgb-rc-rail';
    const knob = document.createElement('div');
    knob.className = 'kgb-rc-knob';
    track.append(rail, knob);
    stage.append(track);
    sliderEls.push(track);
    knobEls.push(knob);
  }
  stage.prepend(canvas);

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

  container.append(banner, statusEl, stage);
  root.append(container, startOverlay, resultOverlay);

  const W = Math.min(root.clientWidth || 375, 400);
  const H = 440;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.height = `${H}px`;
  stage.style.height = `${H}px`;
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
  function renderKnob(i) {
    const trackH = sliderEls[i].clientHeight || H;
    const knobH = knobEls[i].offsetHeight || 64;
    const y = (1 - slider[i]) * (trackH - knobH);
    knobEls[i].style.transform = `translateY(${Math.round(y)}px)`;
  }

  function resetSliders() {
    slider[0] = 0.5;
    slider[1] = 0.5;
    renderKnob(0);
    renderKnob(1);
    targetTilt = 0;
    tilt = 0;
  }

  // ---------- Matterワールド構築（盤座標: 0..BOARD_W × 0..BOARD_H） ----------

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

    // むずかしいのしかけ: ゲート（段から出たり引っこんだりする棒）とシーソー板。どちらも静的ボディを動かす
    gate = null;
    seesaw = null;
    for (const shelf of shelves) {
      const f = shelf.feature;
      if (!f) continue;
      if (f.type === 'gate') {
        const closedY = f.y - 6 - f.height / 2; // 出ているときの中心（段の面の上に立つ）
        const body = M.Bodies.rectangle(f.x, closedY, f.width, f.height, { ...staticOpts, friction: 0, frictionStatic: 0 });
        bodies.push(body);
        gate = { feature: f, body, closedY };
      } else if (f.type === 'seesaw') {
        const body = M.Bodies.rectangle(f.x, f.y, f.halfLength * 2, 12, { ...staticOpts });
        const angle = seesawTargetAngle(f, null, null);
        M.Body.setAngle(body, angle);
        bodies.push(body);
        seesaw = { feature: f, body, angle };
      }
    }

    // 天井はつねに。左右の壁は かんたん だけ（ふつう・むずかしいは横から落ちる）
    bodies.push(M.Bodies.rectangle(BOARD_W / 2, -30, BOARD_W * 2, 20, staticOpts));
    if (state.settings.walls) {
      bodies.push(M.Bodies.rectangle(-8, BOARD_H / 2, 20, BOARD_H * 2, staticOpts));
      bodies.push(M.Bodies.rectangle(BOARD_W + 8, BOARD_H / 2, 20, BOARD_H * 2, staticOpts));
    }

    // 下のうけ皿（盤の幅だけ）。底に触れたらゴール
    const floor = M.Bodies.rectangle(BOARD_W / 2, BOARD_H - 6, BOARD_W, 14, staticOpts);
    const sensor = M.Bodies.rectangle(BOARD_W / 2, BOARD_H - 18, BOARD_W - 8, 14, { isStatic: true, isSensor: true });
    sensor.plugin.kgbGoal = true;
    bodies.push(floor, sensor);
    M.Composite.add(engine.world, bodies);

    collisionHandler = (event) => {
      for (const pair of event.pairs) {
        const hitGoal =
          (pair.bodyA.plugin.kgbGoal && pair.bodyB === ballBody) ||
          (pair.bodyB.plugin.kgbGoal && pair.bodyA === ballBody);
        if (hitGoal && ballPhase === 'rolling') {
          onGoal();
          return;
        }
      }
    };
    M.Events.on(engine, 'collisionStart', collisionHandler);
  }

  // ---------- ラウンド進行 ----------

  function placeBall() {
    // いちばん上の段の切れ目と反対側からスタート
    const startX = shelves[0].gapSide === 'right' ? 30 : BOARD_W - 30;
    ballBody = M.Bodies.circle(startX, 40, BALL_R, {
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

  // 盤から落ちた（横から／穴から）: ことばで知らせて上からやり直し。タイムは止めない
  function onFall() {
    if (ballPhase !== 'rolling') return;
    ballPhase = 'falling';
    recordFall(state);
    playFall();
    setStatus(text.rcFall);
    later(() => {
      if (ballBody) {
        M.Composite.remove(engine.world, ballBody);
        ballBody = null;
      }
      if (!state.running) return;
      placeBall();
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
        resetSliders();
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
    resetSliders();
    setStatus('');
    updateBanner(0);
    showStartOverlay();
  }

  // ---------- 描画（rAFループ。盤の傾きはCanvas全体の回転で見せる） ----------

  function drawBoard() {
    ctx.fillStyle = '#f0d9b0';
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    // ふち: 壁があるときは太く、ないときは細い線だけ（落ちることが分かる）
    ctx.fillStyle = '#c89058';
    const edge = state.settings.walls ? 10 : 3;
    ctx.fillRect(0, 0, edge, BOARD_H);
    ctx.fillRect(BOARD_W - edge, 0, edge, BOARD_H);
    ctx.fillRect(0, 0, BOARD_W, 8);
  }

  function drawShelves() {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
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

  // むずかしいのしかけ（ゲート・シーソー板）。位置・角度は物理ボディの値をそのまま使う
  function drawFeatures() {
    if (gate) {
      const f = gate.feature;
      const top = gate.body.position.y - f.height / 2;
      const visible = f.y - 6 - top; // 段の面より上に出ている高さだけ描く（引っこんだ部分は段に隠れている）
      // 土台（段の面の上の小さな枠）
      ctx.fillStyle = '#a8713f';
      ctx.fillRect(f.x - f.width / 2 - 4, f.y - 10, f.width + 8, 5);
      if (visible > 0) {
        ctx.fillStyle = '#e06a4f';
        ctx.fillRect(f.x - f.width / 2, top, f.width, visible);
        // しましま（ふみきりの棒のように「止まれ」が分かる）
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        for (let y = top + 4; y < top + visible - 2; y += 10) ctx.fillRect(f.x - f.width / 2, y, f.width, 4);
      }
    }
    if (seesaw) {
      const f = seesaw.feature;
      // 支点（三角）
      ctx.fillStyle = '#8a6a4e';
      ctx.beginPath();
      ctx.moveTo(f.x, f.y - 2);
      ctx.lineTo(f.x - 9, f.y + 12);
      ctx.lineTo(f.x + 9, f.y + 12);
      ctx.closePath();
      ctx.fill();
      // 板（傾く）
      ctx.save();
      ctx.translate(seesaw.body.position.x, seesaw.body.position.y);
      ctx.rotate(seesaw.body.angle);
      ctx.fillStyle = '#e3a955';
      ctx.fillRect(-f.halfLength, -6, f.halfLength * 2, 12);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillRect(-f.halfLength + 2, -6, f.halfLength * 2 - 4, 3);
      ctx.restore();
    }
  }

  function drawTray() {
    ctx.fillStyle = '#8a6a4e';
    ctx.fillRect(0, BOARD_H - 13, BOARD_W, 13);
    ctx.fillStyle = 'rgba(138, 106, 78, 0.3)';
    ctx.fillRect(0, BOARD_H - TRAY_H, BOARD_W, TRAY_H - 13);
  }

  function drawBall() {
    if (!ballBody) return;
    const { x, y } = ballBody.position;
    const grad = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, BALL_R);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#b7bfc9');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(74, 63, 53, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(74, 63, 53, 0.35)';
    ctx.beginPath();
    ctx.arc(x + Math.cos(ballBody.angle) * 6, y + Math.sin(ballBody.angle) * 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    // 盤の傾き = 見た目の回転（スライダーの差がそのまま角度になる）。
    // 回しても四隅が収まるよう少し縮小し、画面中央を軸に回す
    ctx.translate(W / 2, H / 2);
    ctx.rotate(tilt);
    ctx.scale(VIEW_SCALE, VIEW_SCALE);
    ctx.translate(-BOARD_W / 2, -BOARD_H / 2);
    drawBoard();
    drawShelves();
    drawFeatures();
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

    // むずかしいのしかけを動かす（静的ボディの位置・角度だけ書き換える）
    if (gate) {
      const open = state.running ? gateOpenRatio(now - roundStartedAt) : 0;
      M.Body.setPosition(gate.body, { x: gate.feature.x, y: gate.closedY + open * (gate.feature.height + 2) });
    }
    if (seesaw) {
      const ball = ballBody && ballPhase === 'rolling' ? ballBody.position : null;
      const target = seesawTargetAngle(seesaw.feature, ball ? ball.x : null, ball ? ball.y : null);
      if (Math.abs(target - seesaw.angle) > 1e-4) {
        seesaw.angle += (target - seesaw.angle) * SEESAW_LERP;
        M.Body.setAngle(seesaw.body, seesaw.angle);
      }
    }

    M.Engine.update(engine, 1000 / 60);

    // 盤の外に出た（横から落ちた）
    if (ballBody && ballPhase === 'rolling') {
      const { x, y } = ballBody.position;
      if (x < -BALL_R * 2 || x > BOARD_W + BALL_R * 2 || y > BOARD_H + 40) onFall();
      // 傾いているのに止まったまま（板のつなぎ目に引っかかった）なら、傾きの向きに軽く押す
      const speed = Math.hypot(ballBody.velocity.x, ballBody.velocity.y);
      if (Math.abs(tilt) > STUCK_TILT_RAD && speed < 0.15) stuckFrames++;
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

    draw();
  }

  // ---------- 入力: 左右の縦スライダー（両手の親指。マルチタッチ） ----------

  function setSliderFromPointer(i, clientY) {
    const rect = sliderEls[i].getBoundingClientRect();
    const knobH = knobEls[i].offsetHeight || 64;
    const usable = rect.height - knobH;
    // つまみの中心が指の位置に来るように
    const y = clientY - rect.top - knobH / 2;
    slider[i] = Math.max(0, Math.min(1, 1 - y / usable));
    renderKnob(i);
    targetTilt = tiltFromSliders(slider[0], slider[1], maxTiltDeg);
  }

  sliderEls.forEach((track, i) => {
    const activePointers = new Set();
    track.addEventListener('pointerdown', (event) => {
      activePointers.add(event.pointerId);
      try {
        track.setPointerCapture(event.pointerId);
      } catch {
        // 合成イベントなどで捕捉できなくても動かす
      }
      setSliderFromPointer(i, event.clientY);
    }, { signal: abort.signal });
    track.addEventListener('pointermove', (event) => {
      if (!activePointers.has(event.pointerId)) return;
      setSliderFromPointer(i, event.clientY);
    }, { signal: abort.signal });
    const release = (event) => activePointers.delete(event.pointerId);
    track.addEventListener('pointerup', release, { signal: abort.signal });
    track.addEventListener('pointercancel', release, { signal: abort.signal });
    // 指を離してもつまみはその位置に残る（実物のシーソー盤を持っている感覚）
  });

  if (debugMode) {
    window.__kgbRollcatch = {
      get tilt() { return tilt; },
      get slider() { return slider.slice(); },
      get ball() { return ballBody ? { ...ballBody.position } : null; },
      get falls() { return state?.falls; },
      get running() { return state?.running; },
      get phase() { return ballPhase; },
      get seesaw() { return seesaw ? { angle: seesaw.angle, bodyAngle: seesaw.body.angle, x: seesaw.body.position.x, y: seesaw.body.position.y } : null; },
      get gate() { return gate ? { y: gate.body.position.y } : null; },
      get velocity() { return ballBody ? { ...ballBody.velocity } : null; },
      setSlider(i, v) {
        slider[i] = v;
        renderKnob(i);
        targetTilt = tiltFromSliders(slider[0], slider[1], maxTiltDeg);
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
