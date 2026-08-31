// ui.js — ころころキャッチの描画・入力（v0.10。別冊03§4）
// 物理はMatter.js（バランスゲームと同じローカル同梱）、描画はCanvas。
// 性能規定: 動的ボディはボール1個のみ（同時1個しか出さない）。板は静的ボディで、
// 回転はタップ後200msのトゥイーン中だけBody.setAngleで更新する。rAF内でDOMは触らない。

import {
  BALLS_PER_ROUND,
  createGame,
  togglePlate,
  launchBall,
  ballGoal,
  ballOut,
} from './game.js';
import { text } from '../../i18n.js';
import { playTap, playFlip, playGoal, playFlutter, playWin } from '../../sound.js';
import { resetPraise, emitPraise, pickPraise, recordPlay } from '../../praise.js';
import { loadStats, saveStats } from '../../storage.js';

// 板の傾きは±16°の2状態。別冊03§4は±12°だが、Matter.jsの実測で12°は
// 転がりが遅すぎた（板1枚3.8秒）ため、テンポの出る16°に調整
const TILT_RAD = (16 * Math.PI) / 180;
const TILT_ANIM_MS = 200;              // 傾け替えアニメ
const BALL_R = 12;
const NEXT_BALL_WAIT_MS = 1000;        // ゴール/アウト表示から次のボールまで
const NUDGE_AFTER_MS = 2600;           // 止まったままのボールをそっと押すまでの時間

export function mount(root, config, { onExit }) {
  const M = window.Matter;
  const abort = new AbortController();
  const timers = new Set();

  const isTwoMode = config.mode === 'two';
  const names = [text.redName, text.blueName];
  const debugMode = new URLSearchParams(window.location.search).has('debug');

  let state = null;
  let engine = null;
  let rafId = null;
  let plates = [];        // {body, cx, cy, animStart, fromAngle, toAngle}
  let ballBody = null;
  let ballStillSince = 0; // ボールが止まりはじめた時刻（つっかえ防止のそっと押し用）
  let collisionHandler = null;
  let funnels = [];       // かんたんのすり鉢の床（描画と物理で同じ値を使う）

  // fps計測（?debug）
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

  function clearAllTimers() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  }

  // ---------- DOM生成（mount時に一度だけ） ----------

  root.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'kgb-rollcatch';

  const banner = document.createElement('div');
  banner.className = 'kgb-turn-banner';

  const statusEl = document.createElement('div');
  statusEl.className = 'kgb-rc-status';

  const canvas = document.createElement('canvas');
  canvas.className = 'kgb-rc-canvas';

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

  container.append(banner, statusEl, canvas);
  root.append(container, startOverlay, resultOverlay);

  // キャンバス実サイズ（Retina対応）
  const W = Math.min(root.clientWidth || 375, 400);
  const H = 430;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // レイアウト: 板は上下に等間隔、左右互い違い。ゴールカップは下段中央
  const CUP_X = W / 2;
  const CUP_HALF = 44;      // カップの内のり半分
  const LIP_H = 36;
  // 最下段はすり鉢・カップとの間にボール直径ぶん以上の隙間を残す高さにする（はさまり防止）
  const PLATE_TOP = 100;
  const PLATE_BOTTOM = 305;

  function plateCenter(index, count) {
    const cy = PLATE_TOP + ((PLATE_BOTTOM - PLATE_TOP) * index) / (count - 1);
    const cx = index % 2 === 0 ? W * 0.32 : W * 0.68;
    return { cx, cy };
  }

  // ---------- 表示の差分更新（DOMはイベント時のみ） ----------

  function updateBanner() {
    const ballsLeft = BALLS_PER_ROUND - state.ballIndex + (state.ballActive ? 1 : 0);
    const dots = `${'●'.repeat(ballsLeft)}${'○'.repeat(BALLS_PER_ROUND - ballsLeft)}`;
    if (isTwoMode) {
      // 1行に収めるため短い表記（あかの ばん　0こ ●●●）
      banner.textContent = `${names[state.currentPlayer]}${text.turnSuffix}　${state.goals}${text.flashCountSuffix} ${dots}`;
      banner.className = `kgb-turn-banner is-blinking kgb-player-${state.currentPlayer}`;
    } else {
      banner.textContent = `${text.rcCatchLabel}: ${state.goals}${text.flashCountSuffix}　${text.rcBallLabel} ${dots}`;
      banner.className = 'kgb-turn-banner';
    }
  }

  function setStatus(message, happy) {
    statusEl.textContent = message;
    statusEl.classList.toggle('is-happy', Boolean(happy));
  }

  // ---------- Matterワールド構築（ラウンド開始・交代のたびに作り直す） ----------

  function setupEngine() {
    if (engine) {
      if (collisionHandler) M.Events.off(engine, 'collisionStart', collisionHandler);
      M.Composite.clear(engine.world, false);
      M.Engine.clear(engine);
    }
    engine = M.Engine.create({ enableSleeping: false }); // ボール1個だけなのでsleep管理は不要
    engine.gravity.y = state.settings.gravity;
    ballBody = null;
    plates = [];

    const staticOpts = { isStatic: true, friction: 0.05, restitution: 0.1 };
    const count = state.settings.plateCount;
    const plateLen = W * state.settings.plateLenRatio;
    for (let i = 0; i < count; i++) {
      const { cx, cy } = plateCenter(i, count);
      const body = M.Bodies.rectangle(cx, cy, plateLen, 12, {
        ...staticOpts,
        chamfer: { radius: 6 },
      });
      M.Body.setAngle(body, state.tilts[i] * TILT_RAD);
      plates.push({ body, cx, cy, len: plateLen, animStart: null, fromAngle: 0, toAngle: 0 });
      M.Composite.add(engine.world, body);
    }

    // ゴールカップ: 左右のふち＋底＋センサー
    const lipL = M.Bodies.rectangle(CUP_X - CUP_HALF - 4, H - 22, 8, LIP_H, staticOpts);
    const lipR = M.Bodies.rectangle(CUP_X + CUP_HALF + 4, H - 22, 8, LIP_H, staticOpts);
    const cupFloor = M.Bodies.rectangle(CUP_X, H - 4, CUP_HALF * 2 + 16, 10, staticOpts);
    const sensor = M.Bodies.rectangle(CUP_X, H - 14, CUP_HALF * 2 - 8, 12, {
      isStatic: true,
      isSensor: true,
    });
    sensor.plugin.kgbGoal = true;
    M.Composite.add(engine.world, [lipL, lipR, cupFloor, sensor]);

    // かんたん: 左右の壁＋カップへ向かうすり鉢の床（飛び出し・取りこぼしなし）。
    // すり鉢の先端はカップのふちを越えて開口部の内側で終わらせる
    // （ふちの外側で終わるとボールがふちを乗り越えられずはまる）
    funnels = [];
    if (state.settings.walls) {
      const wallL = M.Bodies.rectangle(-8, H / 2, 20, H * 2, staticOpts);
      const wallR = M.Bodies.rectangle(W + 8, H / 2, 20, H * 2, staticOpts);
      const rad = (14 * Math.PI) / 180;
      const endX = CUP_X - CUP_HALF + 10; // カップ開口部の内側
      const endY = H - 54;               // ふち上端(H-40)より上
      const funnelLen = (endX + 12) / Math.cos(rad);
      funnels = [
        {
          cx: endX - (funnelLen / 2) * Math.cos(rad),
          cy: endY - (funnelLen / 2) * Math.sin(rad),
          len: funnelLen,
          angle: rad,
        },
        {
          cx: W - endX + (funnelLen / 2) * Math.cos(rad),
          cy: endY - (funnelLen / 2) * Math.sin(rad),
          len: funnelLen,
          angle: -rad,
        },
      ];
      const funnelBodies = funnels.map((f) => {
        const body = M.Bodies.rectangle(f.cx, f.cy, f.len, 10, staticOpts);
        M.Body.setAngle(body, f.angle);
        return body;
      });
      M.Composite.add(engine.world, [wallL, wallR, ...funnelBodies]);
    }

    // ゴール判定はセンサーとの接触で（別冊03§4: ゴール穴=センサー）
    collisionHandler = (event) => {
      for (const pair of event.pairs) {
        const hitGoal =
          (pair.bodyA.plugin.kgbGoal && pair.bodyB === ballBody) ||
          (pair.bodyB.plugin.kgbGoal && pair.bodyA === ballBody);
        if (hitGoal) {
          onGoal();
          return;
        }
      }
    };
    M.Events.on(engine, 'collisionStart', collisionHandler);
  }

  // ---------- ボールの進行 ----------

  function spawnBall() {
    const launched = launchBall(state);
    if (!launched) return;
    const { cx } = plateCenter(0, state.settings.plateCount);
    ballBody = M.Bodies.circle(cx, 18, BALL_R, {
      friction: 0.02,
      frictionAir: 0.001,
      restitution: 0.15,
      density: 0.003,
    });
    M.Composite.add(engine.world, ballBody);
    ballStillSince = 0;
    setStatus('');
    updateBanner();
  }

  function removeBall() {
    if (ballBody) {
      M.Composite.remove(engine.world, ballBody);
      ballBody = null;
    }
  }

  function onGoal() {
    const result = ballGoal(state);
    if (!result) return;
    removeBall();
    playGoal();
    setStatus(text.rcGoal, true);
    if (result.smooth) emitPraise('smooth_run'); // 先に板を準備できていた（別冊03§4）
    updateBanner();
    proceed(result.roundOver);
  }

  function onOut() {
    const result = ballOut(state);
    if (!result) return;
    removeBall();
    playFlutter();
    setStatus(text.rcOut, false); // ネガ禁止: 「つぎいこう！」トーン
    updateBanner();
    proceed(result.roundOver);
  }

  function proceed(roundOver) {
    if (!roundOver) {
      later(() => spawnBall(), NEXT_BALL_WAIT_MS);
      return;
    }
    if (roundOver.nextPlayer !== undefined) {
      later(() => {
        setupEngine(); // 板を初期配置に戻した状態で作り直す
        setStatus('');
        updateBanner();
        showStartOverlay();
      }, NEXT_BALL_WAIT_MS);
      return;
    }
    later(() => finishGame(roundOver), NEXT_BALL_WAIT_MS);
  }

  // ---------- 描画（rAFループ） ----------

  // 角丸長方形（ctx.roundRectは古いiOS Safari非対応のため自前で描く）
  function traceRoundRect(x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function drawPlate(plate) {
    const body = plate.body;
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);
    ctx.fillStyle = '#d9a066';
    ctx.strokeStyle = 'rgba(74, 63, 53, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    traceRoundRect(-plate.len / 2, -6, plate.len, 12, 6);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // 支点マーク（タップで回ることの手がかり）
    ctx.fillStyle = '#8a6a4e';
    ctx.beginPath();
    ctx.arc(body.position.x, body.position.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCup() {
    ctx.fillStyle = '#8a6a4e';
    ctx.beginPath();
    traceRoundRect(CUP_X - CUP_HALF - 8, H - 40, 8, 36, 3);
    traceRoundRect(CUP_X + CUP_HALF, H - 40, 8, 36, 3);
    traceRoundRect(CUP_X - CUP_HALF - 8, H - 9, CUP_HALF * 2 + 16, 8, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(138, 106, 78, 0.25)';
    ctx.fillRect(CUP_X - CUP_HALF, H - 32, CUP_HALF * 2, 28);
  }

  function drawWalls() {
    if (!state.settings.walls) return;
    ctx.fillStyle = 'rgba(138, 106, 78, 0.5)';
    ctx.fillRect(0, 0, 4, H);
    ctx.fillRect(W - 4, 0, 4, H);
    // すり鉢の床（物理と同じ配置を描く）
    for (const f of funnels) {
      ctx.save();
      ctx.translate(f.cx, f.cy);
      ctx.rotate(f.angle);
      ctx.fillRect(-f.len / 2, -5, f.len, 10);
      ctx.restore();
    }
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
    // ころがりが見えるよう回転マーカーを1点
    ctx.fillStyle = 'rgba(74, 63, 53, 0.35)';
    ctx.beginPath();
    ctx.arc(x + Math.cos(ballBody.angle) * 6, y + Math.sin(ballBody.angle) * 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawWalls();
    for (const plate of plates) drawPlate(plate);
    drawCup();
    drawBall();
    if (debugMode) {
      ctx.fillStyle = '#4a3f35';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${fpsValue}fps`, 8, 18);
      ctx.textAlign = 'center';
    }
  }

  function loop(now) {
    rafId = requestAnimationFrame(loop);

    // 板の回転トゥイーン（アニメ中の板だけ更新。性能規定）
    for (let i = 0; i < plates.length; i++) {
      const plate = plates[i];
      if (plate.animStart === null) continue;
      const t = Math.min((now - plate.animStart) / TILT_ANIM_MS, 1);
      const eased = 1 - (1 - t) * (1 - t); // ease-out
      M.Body.setAngle(plate.body, plate.fromAngle + (plate.toAngle - plate.fromAngle) * eased);
      if (t >= 1) plate.animStart = null;
    }

    M.Engine.update(engine, 1000 / 60);

    frameCount++;
    if (now - fpsLastTime >= 1000) {
      fpsValue = frameCount;
      frameCount = 0;
      fpsLastTime = now;
    }

    if (ballBody && state.ballActive) {
      const { x, y } = ballBody.position;
      // 飛び出し判定（ふつう・むずかしい: カップを外すと下へ抜ける）
      if (x < -40 || x > W + 40 || y > H + 50) {
        onOut();
      } else if (ballBody.speed < 0.06) {
        // すみっこで止まったボールはしばらくしたらそっと押す（つっかえ対策）
        if (!ballStillSince) ballStillSince = now;
        if (now - ballStillSince > NUDGE_AFTER_MS) {
          M.Body.applyForce(ballBody, ballBody.position, {
            x: (ballBody.position.x < W / 2 ? 1 : -1) * 0.005,
            y: -0.002,
          });
          ballStillSince = 0;
        }
      } else {
        ballStillSince = 0;
      }
    }

    draw();
  }

  // ---------- ラウンド開始・終了 ----------

  function showStartOverlay() {
    startTitle.textContent = isTwoMode
      ? names[state.currentPlayer] + text.turnSuffix
      : text.readyTitle;
    startOverlay.hidden = false;
  }

  startOverlay.addEventListener('click', () => {
    playTap();
    startOverlay.hidden = true;
    later(() => spawnBall(), 400);
  }, { signal: abort.signal });

  function finishGame(over) {
    emitPraise('finished_game');
    if (state.goals >= BALLS_PER_ROUND) emitPraise('all_goal');

    let isNewRecord = false;
    let best = state.goals;
    if (!isTwoMode) {
      const stats = loadStats();
      stats.rollcatch ??= { best: 0, plays: 0 };
      best = Math.max(stats.rollcatch.best ?? 0, state.goals);
      if (state.goals > (stats.rollcatch.best ?? 0)) {
        stats.rollcatch.best = state.goals;
        isNewRecord = true;
        emitPraise('new_record');
      }
      saveStats(stats);
    }
    recordPlay('rollcatch', { won: false });

    let title;
    let detail;
    let celebrate;
    if (isTwoMode) {
      title = over.winner === null ? text.draw : over.winner === 0 ? text.winRed : text.winBlue;
      detail = `${text.redName} ${state.results[0]}${text.flashCountSuffix} ／ ${text.blueName} ${state.results[1]}${text.flashCountSuffix}`;
      celebrate = true;
    } else {
      title = `${state.goals}${text.rcResultSuffix}`;
      detail = `${text.bestLabel}: ${best}${text.flashCountSuffix}`;
      if (isNewRecord) detail += `\n${text.newRecord}`;
      celebrate = isNewRecord || state.goals >= BALLS_PER_ROUND;
    }

    const dialog = document.createElement('div');
    dialog.className = 'kgb-dialog';
    const titleEl = document.createElement('p');
    titleEl.className = 'kgb-result-title';
    titleEl.textContent = title;
    const detailEl = document.createElement('p');
    detailEl.className = 'kgb-result-detail';
    detailEl.textContent = detail;

    const praiseBox = document.createElement('div');
    praiseBox.className = 'kgb-praise-box';
    const praiseLabel = document.createElement('p');
    praiseLabel.className = 'kgb-praise-label';
    praiseLabel.textContent = text.praiseTitle;
    const praiseText = document.createElement('p');
    praiseText.className = 'kgb-praise-text';
    praiseText.textContent = pickPraise();
    praiseBox.append(praiseLabel, praiseText);

    const buttons = document.createElement('div');
    buttons.className = 'kgb-dialog-buttons';
    const replayButton = document.createElement('button');
    replayButton.type = 'button';
    replayButton.className = 'kgb-dialog-button kgb-dialog-primary';
    replayButton.textContent = text.replay;
    const homeButton = document.createElement('button');
    homeButton.type = 'button';
    homeButton.className = 'kgb-dialog-button';
    homeButton.textContent = text.goHome;
    buttons.append(replayButton, homeButton);

    dialog.append(titleEl, detailEl, praiseBox, buttons);
    resultOverlay.replaceChildren(dialog);
    if (celebrate) {
      resultOverlay.prepend(buildConfetti());
      playWin();
    } else {
      playGoal();
    }
    resultOverlay.hidden = false;

    replayButton.addEventListener('click', () => {
      playTap();
      restart();
    }, { signal: abort.signal });
    homeButton.addEventListener('click', () => {
      playTap();
      onExit();
    }, { signal: abort.signal });
  }

  function buildConfetti() {
    const wrap = document.createElement('div');
    wrap.className = 'kgb-confetti-wrap';
    wrap.setAttribute('aria-hidden', 'true');
    const colors = ['#f6a6b2', '#f9c784', '#7fc8a9', '#a5b8f3', '#c9a7eb'];
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 24; i++) {
      const piece = document.createElement('span');
      piece.className = 'kgb-confetti';
      piece.style.left = `${(i / 24) * 100 + Math.random() * 4}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 0.8}s`;
      piece.style.animationDuration = `${1.6 + Math.random()}s`;
      fragment.append(piece);
    }
    wrap.append(fragment);
    return wrap;
  }

  function restart() {
    clearAllTimers();
    resultOverlay.hidden = true;
    resultOverlay.replaceChildren();
    resetPraise();
    state = createGame({ difficulty: config.difficulty, mode: config.mode });
    setupEngine();
    setStatus('');
    updateBanner();
    showStartOverlay();
  }

  // ---------- 入力: 板のタップ（近い段の板を反転） ----------

  canvas.addEventListener('pointerdown', (event) => {
    if (state.finished) return;
    const rect = canvas.getBoundingClientRect();
    const y = ((event.clientY - rect.top) / rect.height) * H;
    // タップ位置に一番近い段の板を選ぶ（横位置は問わない=タップ領域を大きく）
    let nearest = -1;
    let nearestDist = 48; // これより遠いタップは無視
    for (let i = 0; i < plates.length; i++) {
      const dist = Math.abs(plates[i].cy - y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    }
    if (nearest < 0) return;
    const tilt = togglePlate(state, nearest);
    if (tilt === null) return;
    playFlip();
    const plate = plates[nearest];
    plate.fromAngle = plate.body.angle;
    plate.toAngle = tilt * TILT_RAD;
    plate.animStart = performance.now();
  }, { signal: abort.signal });

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
      root.replaceChildren();
    },
  };
}
