// ui.js — バランスゲームの描画・入力（v0.8）
// 物理はMatter.js（lib/matter.min.jsをローカル同梱・グローバルMatter）、描画はCanvas。
// 性能規定（仕様§4.5）: ブロック上限30・sleeping有効・描画はrAFループのみ
// （ループ内でDOMは触らない。スコア等のDOM更新はイベント時だけ）。?debugでfps表示。

import {
  BLOCK_LIMIT,
  createGame,
  nextShape,
  dropStarted,
  confirmPlaced,
  collapse,
} from './game.js';
import { text } from '../../i18n.js';
import { playTap, playPlace, playFall, playCrash, playWin } from '../../sound.js';
import { resetPraise, emitPraise, pickPraise, recordPlay } from '../../praise.js';
import { loadStats, saveStats } from '../../storage.js';

// かたちごとの色（パステル）。ラベルはi18nのかたち名
const SHAPE_COLORS = {
  square: '#f9c784',
  rect: '#7fc8a9',
  circle: '#f6a6b2',
  triangle: '#c9a7eb',
  lshape: '#a5b8f3',
};

const SETTLE_FRAMES = 25;    // 静止とみなす連続フレーム数
const SETTLE_TIMEOUT_MS = 5000;
const CRASH_SHOW_MS = 1200;  // 崩れてから結果画面までの時間（⭐マーカー表示）

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
  let aiming = false;        // 落下前の照準中か
  let previewShape = null;
  let previewX = 0;
  let previewAngle = 0;      // 落下前の向き（90°単位で回せる）
  let dropping = null;       // 落下中のMatterボディ
  let previewBody = null;    // 照準表示用のゴースト（worldには入れない）
  let stableFrames = 0;
  let dropTimeoutId = null;
  let cameraY = 0;
  let starPos = null;        // 崩れたときの重心マーカー
  let roundsPlayed = 0;      // 「なんかいもチャレンジ」のほめ用
  let crashing = false;

  // fps計測（?debugのとき描画）
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

  // ---------- DOM生成（mount時に一度だけ） ----------

  root.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'kgb-balance';

  const banner = document.createElement('div');
  banner.className = 'kgb-turn-banner';

  const canvas = document.createElement('canvas');
  canvas.className = 'kgb-balance-canvas';

  const controls = document.createElement('div');
  controls.className = 'kgb-balance-controls';
  const rotateButton = document.createElement('button');
  rotateButton.type = 'button';
  rotateButton.className = 'kgb-balance-button';
  rotateButton.textContent = `⟳ ${text.balanceRotate}`;
  const dropButton = document.createElement('button');
  dropButton.type = 'button';
  dropButton.className = 'kgb-balance-button kgb-balance-drop';
  dropButton.textContent = text.balanceDrop;
  controls.append(rotateButton, dropButton);

  const resultOverlay = document.createElement('div');
  resultOverlay.className = 'kgb-overlay';
  resultOverlay.hidden = true;

  container.append(banner, canvas, controls);
  root.append(container, resultOverlay);

  // キャンバスの実サイズ（Retina対応）
  const W = Math.min(root.clientWidth || 375, 400);
  const H = 430;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const GROUND_Y = H - 26;
  const PLATFORM_W = Math.round(W * 0.54);
  const KILL_Y = H + 80; // ここより下に落ちたら「崩れた」

  // ---------- 表示の差分更新（DOMはイベント時のみ） ----------

  function updateBanner() {
    if (isTwoMode) {
      banner.textContent = `${names[state.currentPlayer]}${text.turnSuffix}　${state.placed}こ`;
      banner.className = `kgb-turn-banner is-blinking kgb-player-${state.currentPlayer}`;
    } else {
      banner.textContent = `${text.balanceCount}: ${state.placed}`;
      banner.className = 'kgb-turn-banner';
    }
  }

  // ---------- Matterボディの生成 ----------

  function makeBody(shape, x, y) {
    const options = { friction: 0.9, frictionStatic: 1.2, restitution: 0, density: 0.002 };
    let body;
    if (shape === 'circle') {
      body = M.Bodies.circle(x, y, 23, { ...options, friction: 0.7 });
    } else if (shape === 'rect') {
      body = M.Bodies.rectangle(x, y, 72, 30, options);
    } else if (shape === 'triangle') {
      body = M.Bodies.polygon(x, y, 3, 32, options);
    } else if (shape === 'lshape') {
      const partA = M.Bodies.rectangle(x, y + 16, 64, 24, options);
      const partB = M.Bodies.rectangle(x - 20, y - 12, 24, 32, options);
      body = M.Body.create({ parts: [partA, partB], ...options });
      M.Body.setPosition(body, { x, y });
    } else {
      body = M.Bodies.rectangle(x, y, 46, 46, options);
    }
    body.plugin.kgb = { shape, color: SHAPE_COLORS[shape], label: text.shapes[shape] };
    return body;
  }

  // ---------- 描画（rAFループ。DOMには触らない） ----------

  function drawBody(body) {
    const info = body.plugin.kgb;
    ctx.fillStyle = info ? info.color : '#b98d6e';
    const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;
    for (const part of parts) {
      ctx.beginPath();
      if (part.circleRadius) {
        ctx.arc(part.position.x, part.position.y, part.circleRadius, 0, Math.PI * 2);
      } else {
        const v = part.vertices;
        ctx.moveTo(v[0].x, v[0].y);
        for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
        ctx.closePath();
      }
      ctx.fill();
      ctx.strokeStyle = 'rgba(74, 63, 53, 0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // かたちの名前（図形語彙の知育。仕様§4.5）
    if (info) {
      ctx.save();
      ctx.translate(body.position.x, body.position.y);
      ctx.rotate(body.angle);
      ctx.fillStyle = 'rgba(74, 63, 53, 0.75)';
      ctx.font = 'bold 12px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(info.label, 0, info.shape === 'lshape' ? 16 : 0);
      ctx.restore();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(0, -cameraY);

    for (const body of M.Composite.allBodies(engine.world)) drawBody(body);

    // 照準中のブロック（半透明）＋落下ガイド線
    if (aiming && previewShape) {
      const py = cameraY + 52;
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#4a3f35';
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(previewX, py + 30);
      ctx.lineTo(previewX, cameraY + H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.85;
      // ゴーストは使い回し（毎フレーム生成しない）。位置と向きだけ動かす
      M.Body.setPosition(previewBody, { x: previewX, y: py });
      M.Body.setAngle(previewBody, (previewAngle * Math.PI) / 180);
      drawBody(previewBody);
      ctx.globalAlpha = 1;
    }

    // 崩れたときの重心マーカー⭐
    if (starPos) {
      ctx.font = '34px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⭐', starPos.x, starPos.y);
    }
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
    M.Engine.update(engine, 1000 / 60);

    // fps計測
    frameCount++;
    if (now - fpsLastTime >= 1000) {
      fpsValue = frameCount;
      frameCount = 0;
      fpsLastTime = now;
    }

    if (!state.finished) {
      // 崩れ判定: どれかのブロックが下に落ちたら終了
      for (const body of M.Composite.allBodies(engine.world)) {
        if (!body.isStatic && body.position.y > KILL_Y) {
          onCollapse();
          break;
        }
      }
    }

    // 落下中ブロックの静止判定
    if (dropping && !state.finished) {
      if (dropping.speed < 0.2 && dropping.angularSpeed < 0.05) {
        stableFrames++;
        if (stableFrames >= SETTLE_FRAMES) onSettled();
      } else {
        stableFrames = 0;
      }
    }

    // カメラ: タワーが高くなったら上へパン（なめらかに追従）
    let towerTop = GROUND_Y;
    for (const body of M.Composite.allBodies(engine.world)) {
      if (!body.isStatic && body !== dropping) towerTop = Math.min(towerTop, body.position.y);
    }
    const target = Math.min(0, towerTop - 170);
    cameraY += (target - cameraY) * 0.08;

    draw();
  }

  // ---------- ゲーム進行 ----------

  function spawnPreview() {
    previewShape = nextShape(state);
    previewX = W / 2;
    previewAngle = 0;
    previewBody = makeBody(previewShape, previewX, 52); // 表示専用（worldに追加しない）
    aiming = true;
    updateBanner();
  }

  function doDrop() {
    if (!aiming || state.finished || crashing) return;
    aiming = false;
    dropStarted(state);
    const body = makeBody(previewShape, previewX, cameraY + 52);
    M.Body.setAngle(body, (previewAngle * Math.PI) / 180);
    M.Composite.add(engine.world, body);
    dropping = body;
    stableFrames = 0;
    playFall();
    // 保険: 一定時間たっても静止しなければ積めた扱いにする
    dropTimeoutId = setTimeout(() => {
      if (dropping && !state.finished) onSettled();
    }, SETTLE_TIMEOUT_MS);
    timers.add(dropTimeoutId);
  }

  function onSettled() {
    clearTimeout(dropTimeoutId);
    timers.delete(dropTimeoutId);
    dropping = null;
    const result = confirmPlaced(state);
    if (!result.ok) return;
    playPlace();
    updateBanner();
    if (result.cleared) {
      // 30こ到達クリア（仕様§4.5）
      later(() => finishGame(), 400);
      return;
    }
    spawnPreview();
  }

  function onCollapse() {
    if (crashing) return;
    crashing = true;
    aiming = false;
    clearTimeout(dropTimeoutId);
    dropping = null;
    collapse(state);
    playCrash();
    // 重心マーカー: 残っているブロックの平均位置に⭐（バランスの直感を言語化。仕様§4.5）
    const bodies = M.Composite.allBodies(engine.world).filter((b) => !b.isStatic && b.position.y < KILL_Y);
    if (bodies.length) {
      const avgX = bodies.reduce((sum, b) => sum + b.position.x, 0) / bodies.length;
      const topY = Math.min(...bodies.map((b) => b.position.y));
      starPos = { x: avgX, y: topY - 30 };
    }
    later(() => finishGame(), CRASH_SHOW_MS);
  }

  // ---------- 終了処理（保存はここで1回だけ。§9） ----------

  function finishGame() {
    roundsPlayed++;
    emitPraise('finished_game');
    if (roundsPlayed >= 3) emitPraise('retried');

    let isNewRecord = false;
    let best = state.placed;
    if (!isTwoMode) {
      const stats = loadStats();
      stats.balance ??= { best: 0, plays: 0 };
      best = Math.max(stats.balance.best ?? 0, state.placed);
      if (state.placed > (stats.balance.best ?? 0)) {
        stats.balance.best = state.placed;
        isNewRecord = true;
        emitPraise('new_record');
      }
      saveStats(stats);
    }
    recordPlay('balance', { won: false });

    let title;
    let detail;
    let celebrate;
    if (state.cleared) {
      title = text.balanceClear;
      detail = isTwoMode ? '' : `${text.bestLabel}: ${best}`;
      celebrate = true;
    } else if (isTwoMode) {
      const winner = 1 - state.loser;
      title = names[winner] + text.winSuffix;
      detail = `${names[state.loser]}${text.balanceCrashSuffix}\n${text.playAgainTone}\n${text.balanceTip}`;
      celebrate = true;
    } else {
      title = `${state.placed} ${text.balanceResultSuffix}`;
      detail = `${text.bestLabel}: ${best}`;
      if (isNewRecord) detail += `\n${text.newRecord}`;
      detail += `\n${text.balanceTip}`;
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
    }
    resultOverlay.hidden = false;

    // リトライ導線は最短（仕様§4.5: 崩れる→ワンタップで再開始）
    replayButton.addEventListener('click', () => {
      playTap();
      startRound();
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

  // ---------- ラウンド開始（もういちど でも呼ぶ） ----------

  function startRound() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
    resultOverlay.hidden = true;
    resultOverlay.replaceChildren();
    resetPraise();

    if (engine) {
      M.Composite.clear(engine.world, false);
      M.Engine.clear(engine);
    }
    engine = M.Engine.create({ enableSleeping: true }); // 静止ブロックはスリープ（性能規定）
    engine.gravity.y = 0.75;          // 落下をゆるめてバウンドを控えめに
    engine.positionIterations = 12;   // 着地の食い込み跳ね返りを抑える
    engine.velocityIterations = 8;
    const platform = M.Bodies.rectangle(W / 2, GROUND_Y, PLATFORM_W, 18, {
      isStatic: true,
      friction: 1,
    });
    platform.plugin.kgb = { shape: 'platform', color: '#8a6a4e', label: '' };
    M.Composite.add(engine.world, platform);

    state = createGame({ difficulty: config.difficulty, mode: config.mode });
    cameraY = 0;
    starPos = null;
    dropping = null;
    crashing = false;
    spawnPreview();
  }

  // ---------- 入力（ボタン＋キャンバスのゾーンタップ・下スワイプ） ----------

  rotateButton.addEventListener('click', () => {
    if (!aiming || state.finished) return;
    playTap();
    previewAngle = (previewAngle + 90) % 360; // 90°単位で回す
  }, { signal: abort.signal });
  dropButton.addEventListener('click', () => doDrop(), { signal: abort.signal });

  // 落下位置は指でなぞって動かす。画面の端を越えたら反対側から出てくる（無限軌道）
  let dragLastX = null;
  let dragStart = null;
  canvas.addEventListener('pointerdown', (event) => {
    dragLastX = event.clientX;
    dragStart = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture?.(event.pointerId);
  }, { signal: abort.signal });

  canvas.addEventListener('pointermove', (event) => {
    if (dragLastX === null || !aiming || state.finished) return;
    const dx = event.clientX - dragLastX;
    dragLastX = event.clientX;
    previewX = ((previewX + dx) % W + W) % W; // 端でループ
  }, { signal: abort.signal });

  canvas.addEventListener('pointerup', (event) => {
    // ほぼ真下へのスワイプなら落とす（横なぞりと区別する）
    if (dragStart) {
      const dy = event.clientY - dragStart.y;
      const dxTotal = Math.abs(event.clientX - dragStart.x);
      if (dy > 50 && dxTotal < 40) doDrop();
    }
    dragLastX = null;
    dragStart = null;
  }, { signal: abort.signal });

  startRound();
  rafId = requestAnimationFrame(loop);

  return {
    destroy() {
      cancelAnimationFrame(rafId); // §9: 画面遷移時にrAFを必ず解除
      for (const id of timers) clearTimeout(id);
      timers.clear();
      abort.abort();
      if (engine) {
        M.Composite.clear(engine.world, false);
        M.Engine.clear(engine);
      }
      root.replaceChildren();
    },
  };
}
