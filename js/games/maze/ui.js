// ui.js — ボールめいろの描画・入力（v0.11。別冊03§3）
// 操作はiPhone本体の傾き（motion.js）。許可されない・データが来ない環境は
// 「ゆびモード」（ドラッグした方向に盤が傾く）へ自動で切り替える。
// 物理はMatter.js（動的ボディはボール1個・壁は面ロード時に一括生成、以後生成しない）。

import {
  createGame,
  pickMazeIndex,
  startRound,
  fellInHole,
  reachedGoal,
  starsFor,
} from './game.js';
import {
  requestMotionPermission,
  startMotion,
  stopMotion,
  hasMotionData,
  calibrateMotion,
  readTilt,
} from '../../motion.js';
import { text } from '../../i18n.js';
import { playTap, playSuck, playGoal, playWin } from '../../sound.js';
import { resetPraise, emitPraise, pickPraise, recordPlay } from '../../praise.js';
import { loadStats, saveStats } from '../../storage.js';

const GRAVITY = 2.2;          // 傾き→加速の強さ（実測調整）
const MAX_TILT_DEG = 20;      // motion.jsのクランプと同じ
const HINT_MS = 2000;         // ルートヒントの表示時間（別冊03§3: 2秒）
const SUCK_MS = 650;          // 吸い込まれアニメの時間
const SENSOR_WAIT_MS = 700;   // センサーのデータ待ち（来なければゆびモード）
const FINGER_SENSITIVITY = 4; // ゆびモード: 何pxのドラッグで1°傾くか

export function mount(root, config, { onExit }) {
  const M = window.Matter;
  const abort = new AbortController();
  const timers = new Set();
  const intervals = new Set();

  const isHard = config.difficulty === 'hard';
  const hintOn = config.hint !== 'off';
  const debugMode = new URLSearchParams(window.location.search).has('debug');

  let state = null;
  let engine = null;
  let rafId = null;
  let ballBody = null;
  let phase = 'idle'; // idle | hint | play | suck | clear
  let controlMode = null; // 'tilt' | 'finger'
  let tiltX = 0;
  let tiltY = 0;
  let fingerTarget = { x: 0, y: 0 };
  let fingerOrigin = null;
  let suckInfo = null; // {fromX, fromY, toX, toY, startedAt}
  let hintStartedAt = 0;
  let roundsPlayed = 0;

  // レイアウト（面ロード時に確定）
  let cell = 0;
  let offsetX = 0;
  let offsetY = 0;
  let ballR = 10;

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
  container.className = 'kgb-maze';

  const banner = document.createElement('div');
  banner.className = 'kgb-turn-banner';

  const statusEl = document.createElement('div');
  statusEl.className = 'kgb-maze-status';

  const canvas = document.createElement('canvas');
  canvas.className = 'kgb-maze-canvas';

  const startOverlay = document.createElement('div');
  startOverlay.className = 'kgb-handover';
  startOverlay.hidden = true;
  const startTitle = document.createElement('p');
  startTitle.className = 'kgb-handover-title';
  const startSub = document.createElement('p');
  startSub.className = 'kgb-handover-sub';
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

  // ---------- 座標ヘルパー ----------

  function cellCenter(rc) {
    return {
      x: offsetX + (rc.c + 0.5) * cell,
      y: offsetY + (rc.r + 0.5) * cell,
    };
  }

  // ---------- 表示の差分更新 ----------

  function updateBanner() {
    let label = `${text.mazeFallsLabel}: ${state.falls}`;
    if (isHard && state.startedAt !== null && phase === 'play') {
      label += `　${((performance.now() - state.startedAt) / 1000).toFixed(1)}${text.rcSecSuffix}`;
    }
    banner.textContent = label;
    banner.className = 'kgb-turn-banner';
  }

  function setStatus(message, happy) {
    statusEl.textContent = message;
    statusEl.classList.toggle('is-happy', Boolean(happy));
  }

  // ---------- Matterワールド構築（面ロード時に一括生成。以後生成しない） ----------

  function setupEngine() {
    if (engine) {
      M.Composite.clear(engine.world, false);
      M.Engine.clear(engine);
    }
    engine = M.Engine.create({ enableSleeping: false });
    engine.gravity.x = 0;
    engine.gravity.y = 0; // 真上から見た盤なので基本重力はゼロ。傾きだけで転がす
    ballBody = null;

    const maze = state.maze;
    cell = Math.floor(Math.min((W - 8) / maze.cols, (H - 8) / maze.rows));
    offsetX = Math.round((W - maze.cols * cell) / 2);
    offsetY = Math.round((H - maze.rows * cell) / 2);
    ballR = Math.round(cell * 0.32);

    const bodies = [];
    for (const wall of maze.wallRects) {
      bodies.push(M.Bodies.rectangle(
        offsetX + (wall.c + wall.len / 2) * cell,
        offsetY + (wall.r + 0.5) * cell,
        wall.len * cell,
        cell,
        { isStatic: true, friction: 0.05, restitution: 0.2 },
      ));
    }
    M.Composite.add(engine.world, bodies);
  }

  function spawnBall() {
    const pos = cellCenter(state.maze.start);
    ballBody = M.Bodies.circle(pos.x, pos.y, ballR, {
      friction: 0.05,
      frictionAir: 0.008, // 転がりすぎ防止（そーっと動かす感触）
      restitution: 0.2,
      density: 0.003,
    });
    M.Composite.add(engine.world, ballBody);
    phase = 'play';
    setStatus(controlMode === 'tilt' ? text.mazeTiltHint : text.mazeFingerHint);
    updateBanner();
  }

  // ---------- センサー許可フロー（タップ起点。別冊03§2） ----------

  async function beginWithSensor() {
    const permission = await requestMotionPermission();
    if (permission === 'granted') {
      startMotion();
      // データが実際に届くか少し待つ（デスクトップ等は届かない→ゆびモード）
      later(() => {
        if (hasMotionData()) {
          controlMode = 'tilt';
          calibrateMotion(); // 今の持ち方をゼロ点に（別冊03§2）
        } else {
          stopMotion();
          controlMode = 'finger';
        }
        beginRound();
      }, SENSOR_WAIT_MS);
      return;
    }
    // 拒否・非対応でも遊べなくしない（別冊03§2）
    controlMode = 'finger';
    beginRound();
  }

  function beginRound() {
    startRound(state, performance.now() + (hintOn ? HINT_MS : 0));
    if (isHard) every(() => updateBanner(), 200); // タイム表示（むずかしいのみ）
    if (hintOn && state.path) {
      phase = 'hint';
      hintStartedAt = performance.now();
      setStatus(text.mazeRouteHint);
      later(() => spawnBall(), HINT_MS);
    } else {
      spawnBall();
    }
  }

  // ---------- 落下・クリア ----------

  function startSuck(hole) {
    const result = fellInHole(state);
    if (!result) return;
    phase = 'suck';
    const to = cellCenter(hole);
    suckInfo = {
      fromX: ballBody.position.x,
      fromY: ballBody.position.y,
      toX: to.x,
      toY: to.y,
      startedAt: performance.now(),
    };
    M.Composite.remove(engine.world, ballBody);
    ballBody = null;
    playSuck();
    setStatus(text.mazeFall); // 「あれれ〜！」。ゲームオーバーなし、スタートに戻るだけ
    updateBanner();
    later(() => {
      suckInfo = null;
      spawnBall();
    }, SUCK_MS + 350);
  }

  function onClear() {
    const result = reachedGoal(state, performance.now());
    if (!result) return;
    phase = 'clear';
    M.Composite.remove(engine.world, ballBody);
    ballBody = null;
    playGoal();
    setStatus(text.mazeClear, true);
    later(() => finishGame(result), 900);
  }

  function finishGame(result) {
    roundsPlayed++;
    emitPraise('finished_game');
    if (result.falls === 0) emitPraise('no_fall_clear'); // そーっと動かせた（別冊03§3）
    if (result.falls >= 3) emitPraise('retried');        // 落ちても再挑戦できた

    const stats = loadStats();
    stats.maze ??= { clears: 0, plays: 0, noFallClears: 0 };
    stats.maze.clears = (stats.maze.clears ?? 0) + 1;
    if (result.falls === 0) stats.maze.noFallClears = (stats.maze.noFallClears ?? 0) + 1;
    saveStats(stats);
    recordPlay('maze', { won: false });

    const title = `${text.mazeClear} ${'⭐'.repeat(result.stars)}`;
    let detail = `${text.mazeFallsLabel}: ${result.falls}${text.mazeFallCountSuffix}`;
    if (isHard) {
      detail += `\n${text.rcTimeLabel}: ${(result.elapsedMs / 1000).toFixed(1)}${text.rcSecSuffix}`;
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
    resultOverlay.prepend(buildConfetti()); // クリア=毎回お祝い
    playWin();
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
    // 面はプレイ回数でローテーション（5面。別冊03§3）
    const plays = loadStats().maze?.plays ?? 0;
    state = createGame({
      difficulty: config.difficulty,
      mazeIndex: pickMazeIndex(config.difficulty, plays),
    });
    setupEngine();
    phase = 'idle';
    suckInfo = null;
    tiltX = 0;
    tiltY = 0;
    fingerTarget = { x: 0, y: 0 };
    setStatus('');
    updateBanner();
    startTitle.textContent = text.readyTitle;
    startSub.textContent = text.mazeCalib; // 「たいらに もって タップしてね」
    startOverlay.hidden = false;
  }

  startOverlay.addEventListener('click', () => {
    playTap();
    startOverlay.hidden = true;
    if (controlMode === null) {
      beginWithSensor(); // 初回のみ許可フロー（タップ起点が必須）
    } else {
      if (controlMode === 'tilt') calibrateMotion();
      beginRound();
    }
  }, { signal: abort.signal });

  // ---------- 描画（rAFループ） ----------

  function drawBoard() {
    // 木箱風の盤面
    ctx.fillStyle = '#f0d9b0';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e5c894';
    ctx.fillRect(offsetX, offsetY, state.maze.cols * cell, state.maze.rows * cell);
  }

  function drawWalls() {
    ctx.fillStyle = '#a5723f';
    for (const wall of state.maze.wallRects) {
      ctx.fillRect(offsetX + wall.c * cell, offsetY + wall.r * cell, wall.len * cell, cell);
    }
    // 壁の上面ハイライト（立体感）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    for (const wall of state.maze.wallRects) {
      ctx.fillRect(offsetX + wall.c * cell, offsetY + wall.r * cell, wall.len * cell, 3);
    }
  }

  function drawMarks(now) {
    // スタート: みどりのマット
    const start = cellCenter(state.maze.start);
    ctx.fillStyle = '#9fd98a';
    ctx.fillRect(start.x - cell * 0.38, start.y - cell * 0.38, cell * 0.76, cell * 0.76);

    // 穴: 暗い円
    ctx.fillStyle = '#3a2f26';
    for (const hole of state.maze.holes) {
      const p = cellCenter(hole);
      ctx.beginPath();
      ctx.arc(p.x, p.y, cell * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }

    // ゴール: 旗つきの穴
    const goal = cellCenter(state.maze.goal);
    ctx.fillStyle = '#6b4d31';
    ctx.beginPath();
    ctx.arc(goal.x, goal.y, cell * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${Math.round(cell * 0.7)}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚩', goal.x, goal.y - cell * 0.45);

    // ルートヒント: おすすめルートがうっすら光る（2秒。別冊03§3）
    if (phase === 'hint' && state.path) {
      const pulse = 0.35 + 0.25 * Math.sin((now - hintStartedAt) / 180);
      ctx.fillStyle = `rgba(255, 214, 90, ${pulse})`;
      for (const rc of state.path) {
        const p = cellCenter(rc);
        ctx.beginPath();
        ctx.arc(p.x, p.y, cell * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawBall(now) {
    let x;
    let y;
    let r = ballR;
    if (phase === 'suck' && suckInfo) {
      // 吸い込まれアニメ: 穴の中心へ縮みながら移動
      const t = Math.min((now - suckInfo.startedAt) / SUCK_MS, 1);
      x = suckInfo.fromX + (suckInfo.toX - suckInfo.fromX) * t;
      y = suckInfo.fromY + (suckInfo.toY - suckInfo.fromY) * t;
      r = ballR * (1 - t * 0.85);
    } else if (ballBody) {
      x = ballBody.position.x;
      y = ballBody.position.y;
    } else {
      return;
    }
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.15, x, y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#b7bfc9');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(74, 63, 53, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function draw(now) {
    drawBoard();
    drawWalls();
    drawMarks(now);
    drawBall(now);
    if (debugMode) {
      ctx.fillStyle = '#4a3f35';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${fpsValue}fps ${controlMode ?? ''}`, 8, 18);
      ctx.textAlign = 'center';
    }
  }

  function loop(now) {
    rafId = requestAnimationFrame(loop);

    // 傾きの取得: センサー or ゆびモード
    if (controlMode === 'tilt') {
      const tilt = readTilt();
      tiltX = tilt.x;
      tiltY = tilt.y;
    } else if (controlMode === 'finger') {
      tiltX += (fingerTarget.x - tiltX) * 0.2;
      tiltY += (fingerTarget.y - tiltY) * 0.2;
    }

    if (phase === 'play' && ballBody) {
      engine.gravity.x = GRAVITY * Math.sin((tiltX * Math.PI) / 180);
      engine.gravity.y = GRAVITY * Math.sin((tiltY * Math.PI) / 180);
      M.Engine.update(engine, 1000 / 60);

      // 穴・ゴール判定（中心が円に入ったら）
      const bx = ballBody.position.x;
      const by = ballBody.position.y;
      const goal = cellCenter(state.maze.goal);
      if (Math.hypot(bx - goal.x, by - goal.y) < cell * 0.36) {
        onClear();
      } else {
        for (const hole of state.maze.holes) {
          const p = cellCenter(hole);
          if (Math.hypot(bx - p.x, by - p.y) < cell * 0.3) {
            startSuck(hole);
            break;
          }
        }
      }
    }

    frameCount++;
    if (now - fpsLastTime >= 1000) {
      fpsValue = frameCount;
      frameCount = 0;
      fpsLastTime = now;
    }

    // デバッグ用フック（?debugのときだけ。自動テストがボール位置を読む）
    if (debugMode) {
      window.__kgbMaze = {
        phase,
        controlMode,
        falls: state?.falls,
        cell,
        offsetX,
        offsetY,
        ball: ballBody ? { x: ballBody.position.x, y: ballBody.position.y } : null,
        path: state?.path,
        goal: state?.maze.goal,
        holes: state?.maze.holes,
      };
    }

    draw(now);
  }

  // ---------- ゆびモード入力: ドラッグした方向に盤が傾く ----------

  canvas.addEventListener('pointerdown', (event) => {
    if (controlMode !== 'finger') return;
    fingerOrigin = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture?.(event.pointerId);
  }, { signal: abort.signal });

  canvas.addEventListener('pointermove', (event) => {
    if (controlMode !== 'finger' || !fingerOrigin) return;
    const clamp = (v) => Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, v));
    fingerTarget = {
      x: clamp((event.clientX - fingerOrigin.x) / FINGER_SENSITIVITY),
      y: clamp((event.clientY - fingerOrigin.y) / FINGER_SENSITIVITY),
    };
  }, { signal: abort.signal });

  canvas.addEventListener('pointerup', () => {
    if (controlMode !== 'finger') return;
    fingerOrigin = null;
    fingerTarget = { x: 0, y: 0 }; // 離したら水平に戻る（そーっと止められる）
  }, { signal: abort.signal });

  restart();
  rafId = requestAnimationFrame(loop);

  return {
    destroy() {
      cancelAnimationFrame(rafId); // §9: 画面遷移時にrAF・センサー購読を必ず解除
      clearAllTimers();
      stopMotion();
      abort.abort();
      if (debugMode) delete window.__kgbMaze;
      if (engine) {
        M.Composite.clear(engine.world, false);
        M.Engine.clear(engine);
      }
      root.replaceChildren();
    },
  };
}
