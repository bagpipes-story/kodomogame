// ui.js — ころころキャッチの描画・入力（v0.10.1: 駄菓子屋シーソー型に作り直し）
// 指を左右に動かすと盤ぜんたいが傾き、互い違いの段（坂・波波）をボールが
// ジグザグに転がり下りる。ゴールまでのタイムがスコア（失敗なし）。
// 物理の工夫: 盤を回す代わりに重力の向きを傾ける（幾何は固定のまま）。
//   見た目はCanvas全体を回転して「盤が傾いている」ように見せる。等価で軽い。
// 性能規定: 動的ボディはボール1個のみ。段は固定の静的セグメント（生成は開始時だけ）。

import {
  buildShelves,
  createGame,
  startRun,
  elapsedOf,
  finishRun,
} from './game.js';
import { text } from '../../i18n.js';
import { playTap, playGoal, playWin } from '../../sound.js';
import { resetPraise, emitPraise, pickPraise, recordPlay } from '../../praise.js';
import { loadStats, saveStats } from '../../storage.js';

const BALL_R = 12;
const GRAVITY = 1.6; // 段1本を2〜3秒で渡れるテンポ（実測調整）
const TILT_LERP = 0.16;        // 指の位置へ傾きが追いつく速さ
const TIMER_TICK_MS = 100;     // タイム表示の更新間隔（DOM更新はこの間隔のみ）
const NEXT_WAIT_MS = 1200;     // ゴール演出から次へ進むまで

export function mount(root, config, { onExit }) {
  const M = window.Matter;
  const abort = new AbortController();
  const timers = new Set();
  const intervals = new Set();

  const isTwoMode = config.mode === 'two';
  const names = [text.redName, text.blueName];
  const debugMode = new URLSearchParams(window.location.search).has('debug');

  let state = null;
  let engine = null;
  let rafId = null;
  let shelves = [];
  let ballBody = null;
  let collisionHandler = null;
  let tilt = 0;          // 現在の盤の傾き(rad)
  let targetTilt = 0;    // 指の位置から決まる目標の傾き
  let roundsPlayed = 0;  // 「なんかいもチャレンジ」ほめ用
  let maxTiltRad = 0;

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

  const W = Math.min(root.clientWidth || 375, 400);
  const H = 430;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const TRAY_H = 30; // 下のうけ皿（全幅=かならずキャッチできる）

  // ---------- 表示の差分更新 ----------

  function formatSec(ms) {
    return (ms / 1000).toFixed(1);
  }

  function updateBanner(ms) {
    const timePart = `${text.rcTimeLabel}: ${formatSec(ms)}${text.rcSecSuffix}`;
    if (isTwoMode) {
      banner.textContent = `${names[state.currentPlayer]}${text.turnSuffix}　${timePart}`;
      banner.className = `kgb-turn-banner is-blinking kgb-player-${state.currentPlayer}`;
    } else {
      banner.textContent = timePart;
      banner.className = 'kgb-turn-banner';
    }
  }

  function setStatus(message, happy) {
    statusEl.textContent = message;
    statusEl.classList.toggle('is-happy', Boolean(happy));
  }

  // ---------- Matterワールド構築 ----------

  function setupEngine() {
    if (engine) {
      if (collisionHandler) M.Events.off(engine, 'collisionStart', collisionHandler);
      M.Composite.clear(engine.world, false);
      M.Engine.clear(engine);
    }
    engine = M.Engine.create({ enableSleeping: false });
    engine.gravity.y = GRAVITY;
    ballBody = null;
    tilt = 0;
    targetTilt = 0;
    maxTiltRad = (state.settings.maxTiltDeg * Math.PI) / 180;

    const staticOpts = { isStatic: true, friction: 0.05, restitution: 0.1 };

    // 段: 点列を短い長方形セグメントでつなぐ（波波もこの連結で表現）
    shelves = buildShelves(state.settings, W);
    const bodies = [];
    for (const shelf of shelves) {
      const pts = shelf.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y) + 6;
        const seg = M.Bodies.rectangle((a.x + b.x) / 2, (a.y + b.y) / 2, len, 12, staticOpts);
        M.Body.setAngle(seg, Math.atan2(b.y - a.y, b.x - a.x));
        bodies.push(seg);
      }
    }

    // 左右の壁と天井（盤の外にボールは出ない=失敗なし）
    bodies.push(M.Bodies.rectangle(-8, H / 2, 20, H * 2, staticOpts));
    bodies.push(M.Bodies.rectangle(W + 8, H / 2, 20, H * 2, staticOpts));
    bodies.push(M.Bodies.rectangle(W / 2, -30, W * 2, 20, staticOpts));

    // 下のうけ皿（全幅）。底に触れたらゴール
    const floor = M.Bodies.rectangle(W / 2, H - 6, W * 2, 14, staticOpts);
    const sensor = M.Bodies.rectangle(W / 2, H - 18, W, 14, { isStatic: true, isSensor: true });
    sensor.plugin.kgbGoal = true;
    bodies.push(floor, sensor);
    M.Composite.add(engine.world, bodies);

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

  // ---------- ラウンド進行 ----------

  function spawnBall() {
    // いちばん上の段の切れ目と反対側からスタート
    const startX = shelves[0].gapSide === 'right' ? 28 : W - 28;
    ballBody = M.Bodies.circle(startX, 40, BALL_R, {
      friction: 0.02,
      frictionAir: 0.001,
      restitution: 0.12,
      density: 0.003,
    });
    M.Composite.add(engine.world, ballBody);
    startRun(state, performance.now());
    setStatus(text.rcHint);
    updateBanner(0);
    // タイム表示はこの間隔でだけDOMを触る（§9: rAF内でのDOM更新禁止）
    every(() => {
      if (state.running) updateBanner(elapsedOf(state, performance.now()));
    }, TIMER_TICK_MS);
  }

  function onGoal() {
    const result = finishRun(state, performance.now());
    if (!result) return;
    clearAllTimers(); // タイム表示インターバルを止める
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
      title = result.winner === null ? text.draw : result.winner === 0 ? text.winRed : text.winBlue;
      detail = `${text.redName} ${formatSec(state.results[0])}${text.rcSecSuffix} ／ ${text.blueName} ${formatSec(state.results[1])}${text.rcSecSuffix}`;
      celebrate = true;
    } else {
      title = `${formatSec(result.elapsedMs)}${text.rcGoalSuffix}`;
      detail = `${text.bestLabel}: ${formatSec(bestMs)}${text.rcSecSuffix}`;
      if (isNewRecord) detail += `\n${text.newRecord}`;
      celebrate = isNewRecord;
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
    updateBanner(0);
    showStartOverlay();
  }

  // ---------- 描画（rAFループ。盤の傾きはCanvas全体の回転で見せる） ----------

  function drawBoard() {
    // 盤の下地（回転してもすき間が見えないよう大きめに描く）
    ctx.fillStyle = '#f0d9b0';
    ctx.fillRect(-90, -70, W + 180, H + 140);
    // 左右のふち
    ctx.fillStyle = '#c89058';
    ctx.fillRect(-2, -60, 8, H + 120);
    ctx.fillRect(W - 6, -60, 8, H + 120);
  }

  function drawShelves() {
    ctx.strokeStyle = '#c89058';
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const shelf of shelves) {
      ctx.beginPath();
      const pts = shelf.points;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    // 上面のハイライト（段の形を読み取りやすく）
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 3;
    for (const shelf of shelves) {
      ctx.beginPath();
      const pts = shelf.points;
      ctx.moveTo(pts[0].x, pts[0].y - 5);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y - 5);
      ctx.stroke();
    }
  }

  function drawTray() {
    ctx.fillStyle = '#8a6a4e';
    ctx.fillRect(-40, H - 13, W + 80, 13);
    ctx.fillStyle = 'rgba(138, 106, 78, 0.3)';
    ctx.fillRect(-40, H - TRAY_H, W + 80, TRAY_H - 13);
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
    // 盤の傾き = 見た目の回転。物理では重力の向きを傾けている。
    // フルに回すと四隅（ボールがいる場所）が画面外に切れるため、
    // 見た目は6割の回転＋少し縮小して、盤全体がつねに見えるようにする
    ctx.translate(W / 2, H / 2);
    ctx.rotate(tilt * 0.6);
    ctx.scale(0.86, 0.86);
    ctx.translate(-W / 2, -H / 2);
    drawBoard();
    drawShelves();
    drawTray();
    drawBall();
    ctx.restore();

    if (debugMode) {
      ctx.fillStyle = '#4a3f35';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${fpsValue}fps`, 8, 18);
    }
  }

  function loop(now) {
    rafId = requestAnimationFrame(loop);

    // 傾きを指の位置へなめらかに追従させ、重力の向きに反映する
    tilt += (targetTilt - tilt) * TILT_LERP;
    engine.gravity.x = GRAVITY * Math.sin(tilt);
    engine.gravity.y = GRAVITY * Math.cos(tilt);

    M.Engine.update(engine, 1000 / 60);

    frameCount++;
    if (now - fpsLastTime >= 1000) {
      fpsValue = frameCount;
      frameCount = 0;
      fpsLastTime = now;
    }

    draw();
  }

  // ---------- 入力: 指の横位置 → 盤の傾き ----------

  function pointerToTilt(event) {
    const rect = canvas.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width - 0.5; // -0.5〜+0.5
    targetTilt = Math.max(-1, Math.min(1, ratio * 2.4)) * maxTiltRad;
  }

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture?.(event.pointerId);
    pointerToTilt(event);
  }, { signal: abort.signal });
  canvas.addEventListener('pointermove', (event) => {
    if (event.buttons === 0 && event.pointerType === 'mouse') return; // マウスは押しながらだけ
    pointerToTilt(event);
  }, { signal: abort.signal });
  // 指を離したら盤の傾きはそのまま（実物を手で持っている感覚に合わせる）

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
