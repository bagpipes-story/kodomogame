// ui.js — コリントゲームの描画・入力（v0.12 → v0.13.1でギミックとおとな盤を追加）
// 物理はphysics.js（Matter.js）、盤のデータはgame.jsのbuildLayout。
// 操作は下の大きなボタンを「押し続けてゲージ→離して発射」（ドラッグ不要）。
// おとな（盤2×2倍）はカメラで見せる: 打つ前は全体を俯瞰、球が動いている間は等倍で追いかける。
// 性能規定: ゲージはCSS transitionで動かし、rAF内ではCanvas描画だけ（DOMは触らない）。

import {
  BALLS_PER_ROUND,
  BALL_R,
  CANVAS_H,
  DIFFICULTY,
  buildLayout,
  createGame,
  setAim,
  launchBall,
  ballReturned,
  hitBell,
  ballScored,
  ballLost,
} from './game.js';
import { buildWorld } from './physics.js';
import { text } from '../../i18n.js';
import {
  playTap, playPop, playClick, playBell, playGoal, playFlutter, playWin, playBoing, playWarp,
} from '../../sound.js';
import { resetPraise, emitPraise, pickPraise, recordPlay } from '../../praise.js';
import { loadStats, saveStats } from '../../storage.js';

const CHARGE_MS = 1300;        // ゲージが満タンになるまで（上限で止まる単純型。別冊04§7）
const MIN_POWER = 0.12;        // これ未満は「ちょんと触った」扱いで発射しない
const CLICK_GAP_MS = 50;       // 釘の音の間引き
const STUCK_NUDGE_TICKS = 180; // 3秒止まったらそっと押す
const STUCK_LOST_TICKS = 720;  // 12秒止まったままなら0点で次へ
const MAX_FLIGHT_TICKS = 1500; // 25秒たっても入らない球（跳ね続け等）は0点で次へ
const COUNT_TICK_MS = 110;     // たしざんの数え上げ間隔
const CAMERA_LERP = 0.1;

export function mount(root, config, { onExit }) {
  const M = window.Matter;
  const abort = new AbortController();
  const timers = new Set();
  const intervals = new Set();

  const isTwoMode = config.mode === 'two';
  const names = [text.redName, text.blueName];
  const settings = DIFFICULTY[config.difficulty];
  const debugMode = new URLSearchParams(window.location.search).has('debug');

  let state = null;
  let world = null;
  let rafId = null;
  let phase = 'idle'; // idle | play | counting | over
  let chargeStart = null;
  let ticksSinceLaunch = 0;
  let stillTicks = 0;
  let lastClickAt = 0;
  const flashUntil = new Map(); // body → 光らせ終わる時刻（釘・反発板）
  const bellFlashUntil = new Map();
  let warpFlashUntil = 0;
  let displayedTotal = 0;
  let pendingBonus = 0;

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
  container.className = 'kgb-korinto';

  const banner = document.createElement('div');
  banner.className = 'kgb-turn-banner';

  const statusEl = document.createElement('div');
  statusEl.className = 'kgb-ko-status';

  const canvas = document.createElement('canvas');
  canvas.className = 'kgb-ko-canvas';

  // 発射ボタン（押し続けるとゲージが伸びる）
  const launchButton = document.createElement('button');
  launchButton.type = 'button';
  launchButton.className = 'kgb-ko-launch';
  const gauge = document.createElement('span');
  gauge.className = 'kgb-ko-gauge';
  const launchLabel = document.createElement('span');
  launchLabel.className = 'kgb-ko-launch-label';
  launchLabel.textContent = text.koHold;
  launchButton.append(gauge, launchLabel);

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

  container.append(banner, statusEl, canvas, launchButton);
  root.append(container, startOverlay, resultOverlay);

  const W = Math.min(root.clientWidth || 375, 400);
  const H = CANVAS_H;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // 盤はキャンバスのboardScale倍（おとな=2）。カメラで切り取って描く
  const boardW = W * settings.boardScale;
  const boardH = H * settings.boardScale;
  const layout = buildLayout(settings, boardW, boardH);
  const overviewZoom = 1 / settings.boardScale;
  const cam = { x: boardW / 2, y: boardH / 2, zoom: overviewZoom };

  // ---------- 表示の差分更新 ----------

  function ballsLeft() {
    return BALLS_PER_ROUND - state.ballsShot + (state.ballActive ? 1 : 0);
  }

  function updateBanner() {
    const dots = '●'.repeat(ballsLeft()) + '○'.repeat(BALLS_PER_ROUND - ballsLeft());
    const totalPart = `${text.koTotalLabel}: ${displayedTotal}${text.koPointsSuffix}`;
    if (isTwoMode) {
      banner.textContent = `${names[state.currentPlayer]}${text.turnSuffix}　${displayedTotal}${text.koPointsSuffix} ${dots}`;
      banner.className = `kgb-turn-banner is-blinking kgb-player-${state.currentPlayer}`;
    } else {
      banner.textContent = `${totalPart}　${dots}`;
      banner.className = 'kgb-turn-banner';
    }
  }

  function setStatus(message, happy) {
    statusEl.textContent = message;
    statusEl.classList.toggle('is-happy', Boolean(happy));
  }

  function setLaunchEnabled(enabled) {
    launchButton.disabled = !enabled;
    launchLabel.textContent = enabled ? text.koHold : text.koWait;
  }

  // ---------- 物理ワールド ----------

  function setupWorld() {
    if (world) world.destroy();
    world = buildWorld(M, layout, {
      onPeg: (pegBody) => {
        const now = performance.now();
        flashUntil.set(pegBody, now + 220);
        if (now - lastClickAt >= CLICK_GAP_MS) {
          playClick();
          lastClickAt = now;
        }
      },
      onBumper: (body) => {
        flashUntil.set(body, performance.now() + 260);
        playBoing();
      },
      onBell: (index) => {
        const bonus = hitBell(state, index);
        if (!bonus) return;
        pendingBonus += bonus;
        bellFlashUntil.set(index, performance.now() + 500);
        playBell();
        setStatus(text.koBell, true);
      },
      onWarp: () => {
        warpFlashUntil = performance.now() + 500;
        playWarp();
        setStatus(text.koWarp, true);
      },
      onPocket: (index) => onPocket(index),
    });
  }

  // ---------- 球の進行 ----------

  function tryLaunch(power) {
    if (phase !== 'play' || state.ballActive) return;
    if (!launchBall(state)) return;
    pendingBonus = 0;
    world.launch(power);
    ticksSinceLaunch = 0;
    stillTicks = 0;
    playPop();
    setStatus('');
    setLaunchEnabled(false);
    updateBanner();
  }

  function onPocket(index) {
    const result = ballScored(state, index, pendingBonus);
    if (!result) return;
    world.removeBall();
    playGoal();
    // たしざんの式を見せる（「10 + 20 = 30」。別冊04§7）
    setStatus(result.expression, result.points > 0);
    if (result.points === 0) setStatus(text.koZero, false);
    if (result.aimed) {
      emitPraise('aimed_hit');
      setStatus(`${text.koAimedHit}　${result.expression}`, true);
    }
    countUpTo(result.total, () => proceed(result.roundOver));
  }

  function onReturned() {
    ballReturned(state);
    world.removeBall();
    playFlutter();
    setStatus(text.koReturned);
    setLaunchEnabled(true);
    updateBanner();
  }

  function onStuck() {
    const result = ballLost(state);
    if (!result) return;
    world.removeBall();
    setStatus(text.koStuck);
    proceed(result.roundOver);
  }

  // 合計を1ずつ（ふつう以上は10ずつ）数え上げて見せる（数唱・たしざんの体感）
  function countUpTo(target, done) {
    phase = 'counting';
    const step = settings.countStep;
    if (displayedTotal >= target) {
      phase = 'play';
      done();
      return;
    }
    every(function tick() {
      displayedTotal = Math.min(displayedTotal + step, target);
      updateBanner();
      if (displayedTotal >= target) {
        for (const id of intervals) clearInterval(id);
        intervals.clear();
        phase = 'play';
        done();
      }
    }, COUNT_TICK_MS);
  }

  function proceed(roundOver) {
    if (!roundOver) {
      setLaunchEnabled(true);
      updateBanner();
      return;
    }
    phase = 'over';
    if (roundOver.nextPlayer !== undefined) {
      later(() => {
        displayedTotal = 0;
        setupWorld();
        setStatus('');
        updateBanner();
        showStartOverlay();
      }, 900);
      return;
    }
    later(() => finishGame(roundOver), 900);
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
    phase = 'play';
    setStatus(settings.exact !== null ? text.koExactGoal : text.koPushHint);
    setLaunchEnabled(true);
  }, { signal: abort.signal });

  // ---------- 終了処理（保存はここで1回だけ。§9） ----------

  function finishGame(over) {
    emitPraise('finished_game');
    if (over.exact) emitPraise('exact_hit');

    let isNewRecord = false;
    let best = state.total;
    const stats = loadStats();
    stats.korinto ??= { bestBy: {}, plays: 0, exactHits: 0 };
    stats.korinto.bestBy ??= {};
    if (!isTwoMode) {
      const prev = stats.korinto.bestBy[config.difficulty] ?? 0;
      best = Math.max(prev, state.total);
      if (state.total > prev) {
        stats.korinto.bestBy[config.difficulty] = state.total;
        isNewRecord = true;
        emitPraise('new_record');
      }
    }
    if (over.exact) stats.korinto.exactHits = (stats.korinto.exactHits ?? 0) + 1;
    saveStats(stats);
    recordPlay('korinto', { won: false });

    let title;
    let detail;
    let celebrate;
    if (isTwoMode) {
      title = over.winner === null ? text.draw : over.winner === 0 ? text.winRed : text.winBlue;
      detail = `${text.redName} ${state.results[0]}${text.koPointsSuffix} ／ ${text.blueName} ${state.results[1]}${text.koPointsSuffix}`;
      celebrate = true;
    } else {
      title = over.exact ? text.koExactTitle : `${state.total}${text.koResultSuffix}`;
      detail = `${text.bestLabel}: ${best}${text.koPointsSuffix}`;
      if (isNewRecord) detail += `\n${text.newRecord}`;
      if (settings.exact !== null && !over.exact) {
        detail += `\n${state.total > settings.exact ? text.koOverMessage : text.koUnderMessage}`;
      }
      celebrate = isNewRecord || Boolean(over.exact);
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
    displayedTotal = 0;
    pendingBonus = 0;
    phase = 'idle';
    setupWorld();
    setStatus('');
    setLaunchEnabled(false);
    updateBanner();
    showStartOverlay();
  }

  // ---------- 描画（rAFループ。盤座標で描き、カメラで切り取る） ----------

  function roundRectPath(x, y, w, h, r) {
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

  function drawBoard() {
    ctx.fillStyle = '#f0d9b0';
    ctx.fillRect(0, 0, boardW, boardH);
    // レーンの床色
    ctx.fillStyle = 'rgba(138, 106, 78, 0.12)';
    ctx.fillRect(layout.laneWallX, 92, boardW - layout.laneWallX, boardH - 92);
    // 壁（レール・仕切り）
    ctx.fillStyle = '#a5723f';
    for (const wall of layout.walls) {
      ctx.save();
      ctx.translate(wall.cx, wall.cy);
      ctx.rotate(wall.angle);
      ctx.fillRect(-wall.w / 2, -wall.h / 2, wall.w, wall.h);
      ctx.restore();
    }
  }

  function drawPockets(now) {
    const big = settings.boardScale > 1;
    ctx.font = `bold ${big ? 22 : 15}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const pocket of layout.pockets) {
      const cx = (pocket.x0 + pocket.x1) / 2;
      if (state.aimIndex === pocket.index) {
        const pulse = 0.25 + 0.15 * Math.sin(now / 150);
        ctx.fillStyle = `rgba(255, 214, 90, ${pulse})`;
        ctx.fillRect(pocket.x0 + 3, boardH - layout.pocketH, pocket.x1 - pocket.x0 - 6, layout.pocketH - 4);
      }
      ctx.fillStyle = pocket.points === 0 ? 'rgba(74, 63, 53, 0.45)' : '#4a3f35';
      ctx.fillText(`${pocket.points}`, cx, boardH - 26);
    }
  }

  function drawGimmicks(now) {
    const bodies = M.Composite.allBodies(world.engine.world);
    for (const body of bodies) {
      const info = body.plugin.kgb;
      if (!info) continue;
      if (info.kind === 'peg') {
        const flashing = (flashUntil.get(body) ?? 0) > now;
        ctx.fillStyle = flashing ? '#ffd65a' : '#8a6a4e';
        ctx.beginPath();
        ctx.arc(body.position.x, body.position.y, layout.pegR + (flashing ? 1.5 : 0), 0, Math.PI * 2);
        ctx.fill();
      } else if (info.kind === 'pinwheel') {
        const len = layout.pinwheels[0].len;
        ctx.save();
        ctx.translate(body.position.x, body.position.y);
        ctx.rotate(body.angle);
        ctx.fillStyle = '#e07a5f';
        ctx.fillRect(-len / 2, -3, len, 6);
        ctx.fillRect(-3, -len / 2, 6, len);
        ctx.restore();
        ctx.fillStyle = '#4a3f35';
        ctx.beginPath();
        ctx.arc(body.position.x, body.position.y, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (info.kind === 'bumper') {
        // 反発板: ピンクの板。当たった直後は白く光る
        const flashing = (flashUntil.get(body) ?? 0) > now;
        const b = layout.bumpers.find((p) => Math.abs(p.x - body.position.x) < 1 && Math.abs(p.y - body.position.y) < 1);
        const w = b ? b.w : 50;
        ctx.save();
        ctx.translate(body.position.x, body.position.y);
        ctx.rotate(body.angle);
        ctx.fillStyle = flashing ? '#fff1f4' : '#ff8fab';
        ctx.beginPath();
        roundRectPath(-w / 2, -6, w, 12, 6);
        ctx.fill();
        ctx.strokeStyle = '#c0554a';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-w / 2 + 8, -1.5, w - 16, 3);
        ctx.restore();
      } else if (info.kind === 'bell') {
        const flashing = (bellFlashUntil.get(info.index) ?? 0) > now;
        ctx.fillStyle = flashing ? '#fff1a8' : '#f0c94a';
        ctx.beginPath();
        ctx.arc(body.position.x, body.position.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '14px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔔', body.position.x, body.position.y);
      }
    }
    // ワープ: 入口=あおの回るわ、出口=だいだいのわ。同じ番号がつながっている
    for (const warp of layout.warps) {
      const flashing = warpFlashUntil > now;
      for (const [pt, color, isEntry] of [[warp.a, '#3a86ff', true], [warp.b, '#f28b3b', false]]) {
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate((now / 400) * (isEntry ? 1 : -1));
        ctx.strokeStyle = flashing ? '#ffffff' : color;
        ctx.lineWidth = 4;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, warp.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, warp.r - 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.font = 'bold 13px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.fillText(`${warp.index + 1}`, pt.x, pt.y);
      }
    }
  }

  function drawLauncher(now) {
    // バネ: 押している間は縮んで見せる
    const charge = chargeStart === null ? 0 : Math.min((now - chargeStart) / CHARGE_MS, 1);
    const x = layout.spawn.x;
    const top = boardH - 18 - 14 * (1 - charge);
    ctx.strokeStyle = '#6b4d31';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const y = top + ((boardH - 6 - top) * i) / 4;
      ctx.moveTo(x - 9, y);
      ctx.lineTo(x + 9, y + 2);
    }
    ctx.stroke();
  }

  function drawBall() {
    const ball = world.getBall();
    if (!ball) return;
    const { x, y } = ball.position;
    const grad = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, BALL_R);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#b7bfc9');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(74, 63, 53, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // カメラ: 球が動いている間は等倍で追いかけ、それ以外は盤全体を俯瞰（おとなで意味を持つ）
  function updateCamera() {
    const ball = world.getBall();
    let targetZoom = overviewZoom;
    let targetX = boardW / 2;
    let targetY = boardH / 2;
    if (ball && state.ballActive && settings.boardScale > 1) {
      targetZoom = 1;
      targetX = Math.max(W / 2, Math.min(boardW - W / 2, ball.position.x));
      targetY = Math.max(H / 2, Math.min(boardH - H / 2, ball.position.y));
    }
    cam.zoom += (targetZoom - cam.zoom) * CAMERA_LERP;
    cam.x += (targetX - cam.x) * CAMERA_LERP;
    cam.y += (targetY - cam.y) * CAMERA_LERP;
  }

  function canvasToBoard(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const py = ((clientY - rect.top) / rect.height) * H;
    return { x: (px - W / 2) / cam.zoom + cam.x, y: (py - H / 2) / cam.zoom + cam.y };
  }

  function draw(now) {
    ctx.fillStyle = '#e9d3a8';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    drawBoard();
    drawPockets(now);
    drawGimmicks(now);
    drawLauncher(now);
    drawBall();
    ctx.restore();
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
    world.step(1000 / 60);

    const ball = world.getBall();
    if (ball && state.ballActive) {
      ticksSinceLaunch++;
      const { x, y } = ball.position;
      // レーンに戻ってきた（弱すぎた）
      if (ticksSinceLaunch > 60 && x > layout.laneWallX && y > boardH - 40 && ball.speed < 0.3) {
        onReturned();
      } else if (y > boardH + 60 || x < -60 || x > boardW + 60 || ticksSinceLaunch > MAX_FLIGHT_TICKS) {
        onStuck(); // 万一盤の外へ出た・跳ね続けて入らない球は0点で次へ
      } else {
        if (ball.speed < 0.05) stillTicks++;
        else stillTicks = 0;
        if (stillTicks === STUCK_NUDGE_TICKS) {
          M.Body.applyForce(ball, ball.position, { x: (Math.random() - 0.5) * 0.01, y: -0.004 });
        } else if (stillTicks >= STUCK_LOST_TICKS) {
          stillTicks = 0;
          onStuck();
        }
      }
    }

    updateCamera();

    frameCount++;
    if (now - fpsLastTime >= 1000) {
      fpsValue = frameCount;
      frameCount = 0;
      fpsLastTime = now;
    }

    if (debugMode) {
      window.__kgbKorinto = {
        phase,
        ballActive: state?.ballActive,
        total: state?.total,
        ballsShot: state?.ballsShot,
        ball: ball ? { x: ball.position.x, y: ball.position.y } : null,
        zoom: cam.zoom,
      };
    }

    draw(now);
  }

  // ---------- 入力: 発射ボタン（押し続け→離す）とポケットの「よそう」タップ ----------

  launchButton.addEventListener('pointerdown', (event) => {
    if (launchButton.disabled || phase !== 'play' || state.ballActive) return;
    launchButton.setPointerCapture?.(event.pointerId);
    chargeStart = performance.now();
    launchLabel.textContent = text.koRelease;
    // ゲージはCSS transitionで伸ばす（毎フレームのDOM更新をしない）
    gauge.style.transition = `transform ${CHARGE_MS}ms linear`;
    gauge.style.transform = 'scaleX(1)';
  }, { signal: abort.signal });

  function releaseCharge() {
    if (chargeStart === null) return;
    const power = Math.min((performance.now() - chargeStart) / CHARGE_MS, 1);
    chargeStart = null;
    gauge.style.transition = 'none';
    gauge.style.transform = 'scaleX(0)';
    launchLabel.textContent = text.koHold;
    if (power >= MIN_POWER) tryLaunch(power);
  }
  launchButton.addEventListener('pointerup', releaseCharge, { signal: abort.signal });
  launchButton.addEventListener('pointercancel', releaseCharge, { signal: abort.signal });

  canvas.addEventListener('pointerdown', (event) => {
    if (phase !== 'play' || state.ballActive) return;
    const { x, y } = canvasToBoard(event.clientX, event.clientY);
    if (y < boardH - layout.pocketH - 10) return;
    const pocket = layout.pockets.find((p) => x >= p.x0 && x < p.x1);
    if (!pocket) return;
    // 打つ前にねらうポケットを宣言（よそうモード。ねらいを言葉にする知育）
    if (setAim(state, pocket.index)) {
      playTap();
      setStatus(`${pocket.points}${text.koAimSuffix}`);
    }
  }, { signal: abort.signal });

  restart();
  rafId = requestAnimationFrame(loop);

  return {
    destroy() {
      cancelAnimationFrame(rafId); // §9: 画面遷移時にrAF・タイマーを必ず解除
      clearAllTimers();
      abort.abort();
      if (debugMode) delete window.__kgbKorinto;
      if (world) world.destroy();
      root.replaceChildren();
    },
  };
}
