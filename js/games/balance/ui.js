// ui.js — バランスゲームの描画・入力（v0.8）
// 物理はMatter.js（lib/matter.min.jsをローカル同梱・グローバルMatter）、描画はCanvas。
// 性能規定（仕様§4.5）: 動くブロックは30こまで・sleeping有効・描画はrAFループのみ
// いきもの つみき（v0.17.12）の絵は しゅるいごとに1回だけ描いて、毎フレームは貼るだけ
// （ループ内でDOMは触らない。スコア等のDOM更新はイベント時だけ）。?debugでfps表示。

import {
  BLOCK_LIMIT,
  ACTIVE_LIMIT,
  createGame,
  continueRun,
  nextShape,
  dropStarted,
  confirmPlaced,
  collapse,
  SHAPES,
  fieldOf,
} from './game.js';
import { SEA_PIECES } from './sea.js';
import { ANIMAL_PIECES } from './animal.js';
import { BIRD_PIECES } from './bird.js';
import { boundsOf, buildPieceBody, dampSpin, fixCompoundInertia as fixInertia } from './kit.js';
import { text } from '../../i18n.js';
import { getNames, turnOf, winOf } from '../../players.js';
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
  star: '#f0d264',
  diamond: '#8fd3e8',
  hexagon: '#b7d98b',
  trapezoid: '#f2a97e',
  semicircle: '#e6b3d9',
};

// かたちの名前を書ける横はば（これより長い名前は文字を小さくして収める）。
// 今までのかたちは12pxの名前がそのまま入るはばにしてある（見た目を変えないため）
const LABEL_WIDTH = {
  square: 48, rect: 66, circle: 42, triangle: 48, lshape: 58,
  star: 26, diamond: 40, hexagon: 50, trapezoid: 52, semicircle: 52,
};
// 長い名前は2行に分ける（1行だと小さすぎて読めない）。数字は1行目の文字数
const LABEL_BREAK = { hexagon: 4 }; // ろっかく／けい
const LABEL_FONT = 12;
const LABEL_FONT_MIN = 8;

// いきもの つみき（v0.17.12）: しゅるい → 形と絵の定義・名前
const PIECE_SETS = {
  sea: { pieces: SEA_PIECES, names: text.sea },
  animal: { pieces: ANIMAL_PIECES, names: text.animals }, // v0.17.21
  bird: { pieces: BIRD_PIECES, names: text.birds }, // v0.17.23
};
const SPRITE_PAD = 8; // 絵のまわりの よゆう（太い線・とげ・あし が はみ出すぶん）

const SETTLE_FRAMES = 25;    // 静止とみなす連続フレーム数
const SETTLE_TIMEOUT_MS = 5000;
const CRASH_SHOW_MS = 1200;  // 崩れてから結果画面までの時間（星マーカー表示）

export function mount(root, config, { onExit }) {
  const M = window.Matter;
  const abort = new AbortController();
  const timers = new Set();

  const isTwoMode = config.mode === 'two';
  const names = getNames(config.mode, [text.redName, text.blueName]);
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
  let platform = null;
  let placedBodies = [];     // 積めた順のボディ（古いものから固定していく）
  let namePill = null;       // いきもの つみき: 次に落とす子の名前（{label, width, fontSize}。幅は1回だけ測る）

  const pieceSet = PIECE_SETS[config.blocks] ?? null; // null = いままでの「かたち」
  const spriteCache = new Map(); // いきもの → 1回だけ描いた絵（キャンバス）

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
  const SCREEN_W = Math.min(root.clientWidth || 375, 400);
  const SCREEN_H = 430;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = SCREEN_W * dpr;
  canvas.height = SCREEN_H * dpr;
  canvas.style.height = `${SCREEN_H}px`;
  const ctx = canvas.getContext('2d');

  // 盤の座標（W×H）は画面より広くできる。おとなは床2倍ぶん広げて、viewScaleで縮めて描く
  const field = fieldOf(config.difficulty, config.blocks); // 床の長さ（かたち: おとな以外1.1倍・おとな2倍／うみ: おとな以外1.404倍・おとな2.4倍。v0.17.15）
  const viewScale = field.viewScale;
  const W = SCREEN_W / viewScale;
  const H = SCREEN_H / viewScale;
  ctx.scale(dpr * viewScale, dpr * viewScale);

  const GROUND_Y = H - 26;
  const PLATFORM_W = Math.round(SCREEN_W * 0.54 * field.platformRatio);
  const KILL_Y = H + 80; // ここより下に落ちたら「崩れた」

  // ---------- 表示の差分更新（DOMはイベント時のみ） ----------

  function updateBanner() {
    if (isTwoMode) {
      banner.textContent = `${names[state.currentPlayer]}${text.turnSuffix}　${state.placed}こ`;
      banner.className = `kgb-turn-banner is-blinking kgb-player-${state.currentPlayer}`;
    } else {
      banner.textContent = state.endless
        ? `${text.balanceEndless}　${state.placed}こ`
        : `${text.balanceCount}: ${state.placed}`;
      banner.className = 'kgb-turn-banner';
    }
  }

  // ---------- Matterボディの生成 ----------

  // 凸の多角形（中心からの相対座標）を1つのボディにする。Matterは頂点の重心をpositionにそろえる
  function convexBody(x, y, points, options) {
    return M.Body.create({ ...options, position: { x, y }, vertices: points });
  }

  // 合体ボディの回りにくさ（慣性モーメント）を正しくする。Matterは部品ごとの値を足すだけで
  // 「中心から離れた部品ほど回りにくい」ぶん（平行軸の定理）を入れないため、小さすぎて
  // ほしが とがった先で ゆれながら すべり出していた。setPositionで重心へ動かしたあとに呼ぶ
  // （計算は kit.js に移した。いきもの つみき と共通）
  function fixCompoundInertia(body) {
    fixInertia(M, body);
  }

  function polar(count, radius, startAngle) {
    const points = [];
    for (let i = 0; i < count; i++) {
      const a = startAngle + (i * Math.PI * 2) / count;
      points.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
    }
    return points;
  }

  // ほし: へこんだ形はMatterの当たり判定にそのまま使えないので、
  // まんなかの五角形＋とがり5つ（すべて凸）を合体させる。描画は外周の線で1つの形に見せる
  function makeStar(x, y, options) {
    const { outer, inner } = SHAPES.star;
    const top = -Math.PI / 2;
    const outerPts = polar(5, outer, top);
    const innerPts = polar(5, inner, top + Math.PI / 5);
    const parts = [convexBody(x, y, innerPts, options)];
    for (let i = 0; i < 5; i++) {
      const tri = [outerPts[i], innerPts[i], innerPts[(i + 4) % 5]];
      const cx = (tri[0].x + tri[1].x + tri[2].x) / 3;
      const cy = (tri[0].y + tri[1].y + tri[2].y) / 3;
      parts.push(convexBody(x + cx, y + cy, tri.map((p) => ({ x: p.x - cx, y: p.y - cy })), options));
    }
    const body = M.Body.create({ ...options, parts });
    M.Body.setPosition(body, { x, y });
    fixCompoundInertia(body);
    const outline = [];
    for (let i = 0; i < 5; i++) outline.push(outerPts[i], innerPts[i]);
    return { body, outline };
  }

  // ラベルの文字の大きさは作るときに1回だけ測る（毎フレームmeasureTextしない）
  function labelLayout(shape, label) {
    const cut = LABEL_BREAK[shape];
    const lines = cut ? [label.slice(0, cut), label.slice(cut)] : [label];
    ctx.font = `bold ${LABEL_FONT}px -apple-system, sans-serif`;
    const width = Math.max(...lines.map((line) => ctx.measureText(line).width));
    const room = LABEL_WIDTH[shape] ?? 40;
    const fontSize = width <= room
      ? LABEL_FONT
      : Math.max(LABEL_FONT_MIN, Math.floor((LABEL_FONT * room) / width));
    return { lines, fontSize };
  }

  // いきものの絵を小さなキャンバスに1回だけ描く。毎フレームは drawImage で貼るだけにして軽くする
  // （顔・もようを毎フレーム線で描くと、ブロックが増えたときに重くなるため）
  function spriteOf(id, piece) {
    let sprite = spriteCache.get(id);
    if (sprite) return sprite;
    const box = boundsOf(piece);
    const pad = piece.pad ?? SPRITE_PAD; // ひげ・とげが長い子は よゆうを広く（v0.17.17）
    const w = box.w + pad * 2;
    const h = box.h + pad * 2;
    const ratio = dpr * viewScale; // 画面に出る大きさと同じ細かさで描く（ぼやけない・むだに大きくしない）
    const cvs = document.createElement('canvas');
    cvs.width = Math.ceil(w * ratio);
    cvs.height = Math.ceil(h * ratio);
    const g = cvs.getContext('2d');
    g.scale(ratio, ratio);
    g.translate(pad - box.minX, pad - box.minY);
    piece.draw(g, piece);
    sprite = { canvas: cvs, x: box.minX - pad, y: box.minY - pad, w, h };
    spriteCache.set(id, sprite);
    return sprite;
  }

  // いきもの つみき: 形は kit.js で作る（Nodeのテストと同じもの）。
  // offset = 絵の(0,0)と重さの中心のずれ。描くときに足して絵と当たり判定をそろえる
  function makePieceBody(id, piece, x, y) {
    const { body, offset } = buildPieceBody(M, piece, x, y);
    body.plugin.kgb = { shape: id, sprite: spriteOf(id, piece), offset };
    return body;
  }

  function makeBody(shape, x, y) {
    const piece = pieceSet?.pieces[shape];
    if (piece) return makePieceBody(shape, piece, x, y);
    const options = { friction: 0.9, frictionStatic: 1.2, restitution: 0, density: 0.002 };
    let body;
    let outline = null;
    let labelY = 0;
    if (shape === 'star') {
      ({ body, outline } = makeStar(x, y, options));
    } else if (shape === 'diamond') {
      const { halfW, halfH } = SHAPES.diamond;
      body = convexBody(x, y, [{ x: 0, y: -halfH }, { x: halfW, y: 0 }, { x: 0, y: halfH }, { x: -halfW, y: 0 }], options);
    } else if (shape === 'hexagon') {
      body = convexBody(x, y, polar(6, SHAPES.hexagon.r, 0), options); // 上下が平ら
    } else if (shape === 'trapezoid') {
      const { bottom, top, h } = SHAPES.trapezoid;
      body = convexBody(x, y, [
        { x: -top / 2, y: -h / 2 }, { x: top / 2, y: -h / 2 },
        { x: bottom / 2, y: h / 2 }, { x: -bottom / 2, y: h / 2 },
      ], options);
    } else if (shape === 'semicircle') {
      const { r } = SHAPES.semicircle;
      const arc = [];
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI + (i * Math.PI) / 10; // 左→上→右（平らな面が下）
        arc.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
      }
      body = convexBody(x, y, arc, { ...options, friction: 0.8 });
      labelY = 3; // 重心は平らな面寄りなので、文字を少し下げて形のまんなかに見せる
    } else if (shape === 'circle') {
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
      fixCompoundInertia(body);
    } else {
      body = M.Bodies.rectangle(x, y, 46, 46, options);
    }
    const label = text.shapes[shape];
    body.plugin.kgb = {
      shape,
      color: SHAPE_COLORS[shape],
      label,
      ...labelLayout(shape, label),
      labelY: shape === 'lshape' ? 16 : labelY,
      outline, // 合体ボディ（ほし）は外周だけを描く
    };
    return body;
  }

  // ---------- 描画（rAFループ。DOMには触らない） ----------

  function drawBody(body) {
    const info = body.plugin.kgb;
    if (info?.sprite) {
      const { sprite, offset } = info;
      ctx.save();
      ctx.translate(body.position.x, body.position.y);
      ctx.rotate(body.angle);
      ctx.drawImage(sprite.canvas, offset.x + sprite.x, offset.y + sprite.y, sprite.w, sprite.h);
      ctx.restore();
      return;
    }
    ctx.fillStyle = info ? info.color : '#b98d6e';
    if (info?.outline) {
      ctx.save();
      ctx.translate(body.position.x, body.position.y);
      ctx.rotate(body.angle);
      ctx.beginPath();
      ctx.moveTo(info.outline[0].x, info.outline[0].y);
      for (let i = 1; i < info.outline.length; i++) ctx.lineTo(info.outline[i].x, info.outline[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(74, 63, 53, 0.25)';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }
    const parts = info?.outline ? [] : body.parts.length > 1 ? body.parts.slice(1) : body.parts;
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
    if (info?.lines) { // 土台（platform）には名前がない
      ctx.save();
      ctx.translate(body.position.x, body.position.y);
      ctx.rotate(body.angle);
      ctx.fillStyle = 'rgba(74, 63, 53, 0.75)';
      ctx.font = `bold ${info.fontSize}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lineH = info.fontSize + 1;
      const firstY = info.labelY - ((info.lines.length - 1) * lineH) / 2;
      info.lines.forEach((line, i) => ctx.fillText(line, 0, firstY + i * lineH));
      ctx.restore();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(0, -cameraY);

    // 画面より下に流れたブロックは描かない（高い塔でも描く数が増えすぎない）
    const viewBottom = cameraY + H;
    for (const body of M.Composite.allBodies(engine.world)) {
      if (body.bounds.min.y <= viewBottom) drawBody(body);
    }

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

    // 崩れたときの重心マーカー（星）
    if (starPos) {
      // 星を線で描く（絵文字ではなく。端末で見た目が変わらない）
      ctx.fillStyle = '#f0c94a';
      ctx.strokeStyle = '#5b4a3f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 17 : 7;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const px = starPos.x + Math.cos(a) * r;
        const py = starPos.y - 12 + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // いきもの つみき: 次の子の名前を右上に（ことばの知育。からだに字を書くと顔が隠れるので外に出す）
    if (aiming && namePill) {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pillW = namePill.width + 24;
      const pillX = SCREEN_W - pillW - 10;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath(); // まるい はしの 名ふだ（roundRect は古いiOSに無いので arc で描く）
      ctx.arc(pillX + 15, 25, 15, Math.PI / 2, Math.PI * 1.5);
      ctx.arc(pillX + pillW - 15, 25, 15, -Math.PI / 2, Math.PI / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#4a3f35';
      ctx.font = `bold ${namePill.fontSize}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(namePill.label, pillX + pillW / 2, 26);
      ctx.restore();
    }

    if (debugMode) {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // fpsは画面の座標で書く
      ctx.fillStyle = '#4a3f35';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${fpsValue}fps`, 8, 18);
      ctx.restore();
    }
  }

  function loop(now) {
    rafId = requestAnimationFrame(loop);
    M.Engine.update(engine, 1000 / 60);
    // いきもの つみき: まるい子が ころがり続けないように（v0.17.14。かたちは今までどおり）
    if (pieceSet) dampSpin(M, M.Composite.allBodies(engine.world));

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
      // 固定したブロックも塔の一部（platformだけ除く）
      if (body !== platform && body !== dropping) towerTop = Math.min(towerTop, body.position.y);
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
    updateNamePill();
    aiming = true;
    updateBanner();
  }

  function updateNamePill() {
    if (!pieceSet) return;
    const label = pieceSet.names[previewShape];
    ctx.save();
    ctx.font = 'bold 17px -apple-system, sans-serif';
    let width = ctx.measureText(label).width;
    let fontSize = 17;
    // 「りゅうぐうのつかい」のような長い名前は 文字を小さくして、落とす前の絵に かぶりにくくする（v0.17.18）
    if (width > 110) {
      fontSize = 13;
      ctx.font = `bold ${fontSize}px -apple-system, sans-serif`;
      width = ctx.measureText(label).width;
    }
    namePill = { label, width, fontSize };
    ctx.restore();
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
    const settled = dropping;
    dropping = null;
    const result = confirmPlaced(state);
    if (!result.ok) return;
    placedBodies.push(settled);
    freezeOldBlocks();
    playPlace();
    updateBanner();
    if (state.finished) {
      // 30こ到達クリア（仕様§4.5）／きろく ちょうせん の積みきり。
      // cleared は「30こ到達ずみ」の印で つづけたあとも true のままなので、終わりは finished で見る
      later(() => finishGame(), 400);
      return;
    }
    spawnPreview();
  }

  // 性能規定: 動くブロックは ACTIVE_LIMIT こまで。超えたら古い順に、止まっている（スリープ中の）ものを
  // 固定する。古いブロックは塔の下のほうで上の重みで落ち着いているので、固定しても遊びはほぼ変わらない。
  // まだ動いているものは固定しない（次に積んだときにまた試す）
  function freezeOldBlocks() {
    let active = placedBodies.filter((b) => !b.isStatic).length;
    for (const body of placedBodies) {
      if (active <= ACTIVE_LIMIT) break;
      if (body.isStatic || !body.isSleeping) continue;
      M.Sleeping.set(body, false); // static にする前に起こしておく（スリープのまま固定すると状態が残る）
      M.Body.setStatic(body, true);
      active--;
    }
  }

  function onCollapse() {
    if (crashing) return;
    crashing = true;
    aiming = false;
    clearTimeout(dropTimeoutId);
    dropping = null;
    collapse(state);
    playCrash();
    // 重心マーカー: 残っているブロックの平均位置に星（バランスの直感を言語化。仕様§4.5）
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
    // 30こクリアの区切りで1プレイとして記録する。つづけて積んだぶんは同じプレイの続き
    // （スタンプ・プレイ回数を二重に数えない）。保存はどちらの区切りでも1回だけ（§9）
    const isBreak = state.cleared && !state.endless; // 30こクリア（ここから つづけられる）
    const continued = state.endless;
    if (!continued) {
      roundsPlayed++;
      emitPraise('finished_game');
      if (roundsPlayed >= 3) emitPraise('retried');
    }

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
    if (!continued) recordPlay('balance', { won: false });

    let title;
    let detail;
    let celebrate;
    if (isBreak) {
      title = text.balanceClear;
      detail = isTwoMode ? text.balanceContinueAsk : `${text.bestLabel}: ${best}\n${text.balanceContinueAsk}`;
      celebrate = true;
    } else if (state.maxed) {
      title = `${state.placed}${text.balanceMaxedSuffix}`;
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

    // 30こクリアのときだけ「つづけて つむ」を大きく上に出す（もういちど・ホームは下の段）
    let continueButton = null;
    if (isBreak) {
      continueButton = document.createElement('button');
      continueButton.type = 'button';
      continueButton.className = 'kgb-dialog-button kgb-dialog-primary kgb-balance-continue';
      continueButton.textContent = text.balanceContinue;
    }

    const buttons = document.createElement('div');
    buttons.className = 'kgb-dialog-buttons';
    const replayButton = document.createElement('button');
    replayButton.type = 'button';
    replayButton.className = isBreak ? 'kgb-dialog-button' : 'kgb-dialog-button kgb-dialog-primary';
    replayButton.textContent = text.replay;
    const homeButton = document.createElement('button');
    homeButton.type = 'button';
    homeButton.className = 'kgb-dialog-button';
    homeButton.textContent = text.goHome;
    buttons.append(replayButton, homeButton);

    dialog.append(titleEl, detailEl, praiseBox);
    if (continueButton) dialog.append(continueButton);
    dialog.append(buttons);
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
    continueButton?.addEventListener('click', () => {
      playTap();
      resumeEndless();
    }, { signal: abort.signal });
  }

  // 30こクリアのあと、同じ塔のまま きろく ちょうせん を始める
  function resumeEndless() {
    if (!continueRun(state)) return;
    resultOverlay.hidden = true;
    resultOverlay.replaceChildren(); // ボタンのリスナーごと捨てる
    spawnPreview();
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
    platform = M.Bodies.rectangle(W / 2, GROUND_Y, PLATFORM_W, 18, {
      isStatic: true,
      friction: 1,
    });
    platform.plugin.kgb = { shape: 'platform', color: '#8a6a4e', label: '' };
    M.Composite.add(engine.world, platform);

    state = createGame({ difficulty: config.difficulty, mode: config.mode, blocks: config.blocks });
    cameraY = 0;
    placedBodies = [];
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
    const dx = (event.clientX - dragLastX) / viewScale; // 画面の指の動き→盤の座標
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

  // ?debug のときだけ: ブラウザでの自動確認用（本番の遊びには影響しない）
  if (debugMode) {
    window.__kgbBalance = {
      get placed() { return state.placed; },
      get finished() { return state.finished; },
      get endless() { return state.endless; },
      get activeCount() { return placedBodies.filter((b) => !b.isStatic).length; },
      get frozenCount() { return placedBodies.filter((b) => b.isStatic).length; },
      get preview() { return previewShape; },
      get aiming() { return aiming; },
      get world() { return { W, H, platformW: PLATFORM_W, viewScale }; },
      get bodies() {
        return M.Composite.allBodies(engine.world)
          .filter((b) => !b.isStatic)
          .map((b) => ({ shape: b.plugin.kgb?.shape, x: b.position.x, y: b.position.y, sleeping: b.isSleeping }));
      },
      setX(x) { previewX = x; },
      setShape(shape) {
        previewShape = shape;
        previewBody = makeBody(shape, previewX, 52);
        updateNamePill();
      },
      drop: () => doDrop(),
    };
  }

  return {
    destroy() {
      cancelAnimationFrame(rafId); // §9: 画面遷移時にrAFを必ず解除
      for (const id of timers) clearTimeout(id);
      timers.clear();
      abort.abort();
      if (debugMode) delete window.__kgbBalance;
      spriteCache.clear();
      if (engine) {
        M.Composite.clear(engine.world, false);
        M.Engine.clear(engine);
      }
      root.replaceChildren();
    },
  };
}
