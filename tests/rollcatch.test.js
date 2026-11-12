// rollcatch.test.js — ころころキャッチ（シーソー型。v0.17.4で両手スライダー操作、v0.17.5でむずかしいにしかけ、v0.17.6で横スライダー1本、v0.17.8でおとな）の純ロジックのNodeテスト
// 実行方法: node tests/rollcatch.test.js

import assert from 'node:assert';
import {
  DIFFICULTY,
  WAVE_LENGTH,
  FEATURE,
  buildShelves,
  shelfProfile,
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
} from '../js/games/rollcatch/game.js';

// ---------- 難易度定義 ----------

{
  assert.strictEqual(DIFFICULTY.easy.wave, 0, 'かんたんはまっすぐな坂');
  assert.ok(DIFFICULTY.normal.wave > 0, 'ふつうはゆるい波波');
  assert.ok(DIFFICULTY.easy.shelfCount < DIFFICULTY.hard.shelfCount, 'むずかしいほど段が多い');
  assert.ok(DIFFICULTY.hard.gapRatio < DIFFICULTY.easy.gapRatio, 'むずかしいほど切れ目がせまい');
  assert.strictEqual(DIFFICULTY.easy.walls, true, 'かんたんだけ左右に壁（落ちない）');
  assert.strictEqual(DIFFICULTY.normal.walls, false);
  assert.strictEqual(DIFFICULTY.hard.walls, false);
  assert.deepStrictEqual(DIFFICULTY.easy.features, [], 'かんたんはしかけなし');
  assert.deepStrictEqual(DIFFICULTY.normal.features, [], 'ふつうはしかけなし');
  assert.strictEqual(DIFFICULTY.hard.features.length, DIFFICULTY.hard.shelfCount, 'むずかしいは全段にしかけ');
  assert.strictEqual(new Set(DIFFICULTY.hard.features).size, DIFFICULTY.hard.features.length, 'しかけは全部ちがう種類');
  assert.ok(DIFFICULTY.easy.maxTiltDeg >= 20, 'しっかり傾く（20°以上）');
  // 波の坂の最大角度は最大チルトより小さい（傾ければ越えられる。壁なしで難しさを出す）
  const slopeDeg = (Math.atan((DIFFICULTY.normal.wave * Math.PI * 2) / WAVE_LENGTH) * 180) / Math.PI;
  assert.ok(slopeDeg < DIFFICULTY.normal.maxTiltDeg, 'ふつう: 傾ければ波を越えられる');
}

// ---------- しかけの坂はどれも最大の傾き(26°)より緩い（傾ければ登れる。だんさだけは一方通行の崖） ----------

{
  const max = DIFFICULTY.hard.maxTiltDeg;
  for (const type of ['bumps', 'hill', 'valley']) {
    let worst = 0;
    for (let x = 0; x < 300; x += 0.5) {
      const dy = shelfProfile(type, DIFFICULTY.hard, x + 0.5, 150, 1) - shelfProfile(type, DIFFICULTY.hard, x, 150, 1);
      worst = Math.max(worst, (Math.atan(Math.abs(dy) / 0.5) * 180) / Math.PI);
    }
    assert.ok(worst < max, `${type}: 最大の坂 ${worst.toFixed(1)}° < ${max}°`);
  }
  assert.ok(shelfProfile('hill', DIFFICULTY.hard, 150, 150, 1) < -FEATURE.hill.height + 1e-9, 'やまの頂上は高い（上が負）');
  assert.ok(shelfProfile('valley', DIFFICULTY.hard, 150, 150, 1) > FEATURE.valley.depth - 1e-9, 'くぼみの底は低い');
  assert.strictEqual(shelfProfile('step', DIFFICULTY.hard, 100, 150, 1), -FEATURE.step.up, 'だんさ: 右へ進むなら左半分が高い');
  assert.strictEqual(shelfProfile('step', DIFFICULTY.hard, 200, 150, 1), FEATURE.step.down, '右半分は低い');
  assert.strictEqual(shelfProfile('step', DIFFICULTY.hard, 200, 150, -1), -FEATURE.step.up, 'だんさ: 左へ進むなら右半分が高い');
  assert.ok(FEATURE.step.up + FEATURE.step.down >= 20, 'だんさは はっきり（高低差20px以上）');
  let bumpMin = Infinity;
  let bumpMax = -Infinity;
  for (let x = 0; x < 300; x++) {
    const y = shelfProfile('bumps', DIFFICULTY.hard, x, 150, 1);
    bumpMin = Math.min(bumpMin, y);
    bumpMax = Math.max(bumpMax, y);
  }
  assert.ok(bumpMax - bumpMin >= 8, 'でこぼこは はっきり（高低差8px以上）');
}

// ---------- ゲートの開閉: 周期の前半は開く・後半は閉じる、なめらかに ----------

{
  const { periodMs, rampMs } = FEATURE.gate;
  assert.strictEqual(gateOpenRatio(0), 0, '始まりは閉じている');
  assert.strictEqual(gateOpenRatio(rampMs), 1, '上がりきったら開いている');
  assert.strictEqual(gateOpenRatio(periodMs / 2 - 1), 1, '前半は開いたまま');
  assert.strictEqual(gateOpenRatio(periodMs - 1), 0, '後半は閉じたまま');
  assert.ok(Math.abs(gateOpenRatio(rampMs / 2) - 0.5) < 1e-9, '途中は半分');
  assert.strictEqual(gateOpenRatio(periodMs * 3 + rampMs), 1, '周期でくり返す');
  assert.ok(periodMs / 2 - rampMs >= 1000, '開いている時間は1秒以上（4歳でも通れる）');
}

// ---------- シーソー板: ふだんは入口側が下、支点を越えると出口側へ倒れる ----------

{
  const f = { x: 150, y: 200, dir: 1, maxAngleDeg: 10 };
  const max = (10 * Math.PI) / 180;
  assert.ok(Math.abs(seesawTargetAngle(f, null, null) + max) < 1e-9, 'ボール無し: 左端（入口）が下がる＝負の角度');
  assert.ok(seesawTargetAngle(f, 120, 185) < 0, '支点の手前では入口側が下のまま');
  assert.ok(seesawTargetAngle(f, 160, 185) > 0, '支点を越えたら出口側（右）が下がる');
  assert.ok(seesawTargetAngle(f, 160, 100) < 0, '別の段の高さにいるボールは関係ない');
  const g = { ...f, dir: -1 };
  assert.ok(seesawTargetAngle(g, null, null) > 0, '左へ進む段では右端（入口）が下');
  assert.ok(seesawTargetAngle(g, 140, 185) < 0, '支点を越えたら左が下');
}

// ---------- 段の形: 互い違いの切れ目・範囲内・波・しかけ ----------

{
  const W = 300;
  for (const key of ['easy', 'normal', 'hard', 'adult']) {
    const shelves = buildShelves(DIFFICULTY[key], W);
    assert.strictEqual(shelves.length, DIFFICULTY[key].shelfCount, `${key}: 段数`);
    for (let i = 0; i < shelves.length; i++) {
      const shelf = shelves[i];
      assert.strictEqual(shelf.gapSide, i % 2 === 0 ? 'right' : 'left', '切れ目は互い違い');
      for (const p of shelf.points) {
        assert.ok(p.x >= 0 && p.x <= W, '点はx範囲内');
        if (!shelf.feature) assert.ok(Math.abs(p.y - shelf.baseY) <= DIFFICULTY[key].wave + 1e-9, '波の振幅内');
        else assert.ok(Math.abs(p.y - shelf.baseY) <= 14 + 1e-9, 'しかけの高さは上下14px以内');
      }
      if (DIFFICULTY[key].stopper > 0) {
        // 返し: 切れ目の反対側の端に丸い返しがある（段の面より上に出ている）
        assert.ok(shelf.stopper, `${key}: 返しがある`);
        const outer = shelf.gapSide === 'right' ? shelf.points[0] : shelf.points[shelf.points.length - 1];
        assert.ok(Math.abs(shelf.stopper.x - outer.x) <= 2 + 1e-9, '返しは外側の端');
        assert.ok(shelf.stopper.y - shelf.stopper.r < outer.y - 6, '返しの頭は段の面より上');
      } else {
        assert.strictEqual(shelf.stopper, null);
      }
      if (i > 0) assert.ok(shelf.baseY > shelves[i - 1].baseY, '上から順に下がる');
      if (i > 0) assert.ok(shelf.baseY - shelves[i - 1].baseY >= 50, '段の間はボールが通れる高さ（50px以上）');
      assert.ok(shelf.baseY < DIFFICULTY[key].boardHeight - 60, '最後の段の下にうけ皿・カゴの場所がある');
      if (shelf.feature?.gates) {
        for (const g of shelf.feature.gates) assert.ok(g.x > shelf.points[0].x + 30 && g.x < shelf.points.at(-1).x - 30, 'ゲートは段の上');
      }
      const expected = DIFFICULTY[key].features[i] ?? null;
      assert.strictEqual(shelf.feature?.type ?? null, expected, `${key} ${i}段目: しかけ ${expected}`);
      if (shelf.feature?.type === 'seesaw') {
        assert.strictEqual(shelf.segments.length, 2, 'シーソー板の段は点列が2本（まんなかが板）');
        const [a, b] = shelf.segments;
        const left = a[a.length - 1].x;
        const right = b[0].x;
        assert.ok(right - left >= FEATURE.seesaw.halfLength * 2 - 1e-9, '板の長さぶん空いている');
        assert.ok(Math.abs((left + right) / 2 - shelf.feature.x) < 1e-6, '板は点列のすき間の中心');
        assert.strictEqual(shelf.feature.dir, shelf.gapSide === 'right' ? 1 : -1, '板の向きは進む向き');
        // 倒れて下がった端は、となりの段の面と同じ高さ（段差で止まらない）
        const f = shelf.feature;
        const lowEndY = f.pivotY + f.halfLength * Math.sin((f.maxAngleDeg * Math.PI) / 180);
        assert.ok(Math.abs(lowEndY - shelf.baseY) < 1e-9, '下がった板の端は段の面とそろう');
      } else {
        assert.strictEqual(shelf.segments.length, 1);
      }
      if (shelf.feature?.type === 'step') {
        // 境目はほぼ垂直（逆走できない）
        const pts = shelf.points;
        const cliff = pts.find((p, k) => k > 0 && Math.abs(p.y - pts[k - 1].y) >= FEATURE.step.up + FEATURE.step.down - 1e-9);
        assert.ok(cliff, 'だんさの崖がある');
        const prev = pts[pts.indexOf(cliff) - 1];
        assert.ok(Math.abs(cliff.x - prev.x) <= 2, '崖は横幅2px以内');
      }
      if (shelf.feature?.type === 'gate') {
        assert.ok(shelf.feature.x > shelf.points[0].x + 40 && shelf.feature.x < shelf.points.at(-1).x - 40, 'ゲートは段のまんなか寄り');
      }
    }
  }
}

// ---------- おとな: 盤2倍・しかけ多め・カゴ ----------

{
  const a = DIFFICULTY.adult;
  const h = DIFFICULTY.hard;
  assert.strictEqual(a.boardHeight, h.boardHeight * 2, 'おとなは盤の高さ2倍');
  assert.strictEqual(a.shelfCount, h.shelfCount * 2, 'おとなは段も2倍');
  assert.ok(a.gapRatio < h.gapRatio, 'おとなは切れ目がもっとせまい');
  assert.ok(a.stopper < h.stopper, 'おとなは返しがもっと小さい');
  assert.strictEqual(a.walls, false);
  const featured = a.features.filter(Boolean);
  assert.ok(featured.length >= 10, 'しかけ多め（10段以上）');
  assert.ok(new Set(featured).size >= 8, 'しかけの種類は8つ以上');
  for (const t of ['conveyor', 'gate2']) assert.ok(featured.includes(t), `新しいしかけ ${t}`);
  assert.strictEqual(a.features.at(-1), null, '最後の段はカゴのタイミングに集中（しかけなし）');
  assert.ok(a.basket, 'おとなはカゴがゴール');
  for (const key of ['easy', 'normal', 'hard']) {
    assert.strictEqual(DIFFICULTY[key].basket, null, `${key}: 床に落ちたらゴール（変更なし）`);
    assert.strictEqual(DIFFICULTY[key].boardHeight, 400);
  }
  assert.ok(a.basket.innerWidth > 24 + 10, 'カゴの内側はボール（直径24）より十分広い');
  assert.ok(a.basket.innerWidth < 24 * 2.5, 'でもせまめ（ねらわないと入らない）');
  assert.ok(a.checkpoints.length >= 1 && a.checkpoints.every((i) => i > 0 && i < a.shelfCount - 1), 'はたは途中の段');

  const shelves = buildShelves(a, 300);
  assert.ok(shelves[a.checkpoints[0]].checkpoint, 'はたの段に印');
  assert.strictEqual(shelves.filter((sh) => sh.checkpoint).length, a.checkpoints.length);
  // ゲート2つ: 入口側が先に開き、出口側は半周期おくれる（同時には開かない）
  const g2 = shelves.find((sh) => sh.feature?.type === 'gate2');
  const [first, second] = g2.feature.gates;
  const dir = g2.gapSide === 'right' ? 1 : -1;
  assert.ok((second.x - first.x) * dir > 24 + 8 * 2, '2本の間でボールが待てる');
  assert.strictEqual(second.phaseMs - first.phaseMs, FEATURE.gate.periodMs / 2);
  for (let t = 0; t < FEATURE.gate.periodMs; t += 50) {
    assert.ok(!(gateOpenRatio(t, first.phaseMs) === 1 && gateOpenRatio(t, second.phaseMs) === 1), '2本同時には全開にならない');
  }
  // ベルト: 進む向きと逆に押す。ベルトの外や別の段では押さない
  const belt = shelves.find((sh) => sh.feature?.type === 'conveyor').feature;
  const restY = belt.y - 18; // 段の面の上で休んでいるボールの中心
  const push = conveyorPush(belt, belt.x, restY, 1.7, 12);
  assert.ok(push !== 0 && Math.sign(push) === -belt.dir, 'ベルトは進む向きと逆に押す');
  const sinDeg = (deg) => Math.sin((deg * Math.PI) / 180);
  assert.ok(Math.abs(push) > 1.7 * sinDeg(a.maxTiltDeg * 0.6), 'ベルトは強い: 6割の傾きでは押し戻される');
  assert.ok(Math.abs(push) < 1.7 * (sinDeg(a.maxTiltDeg) - sinDeg(6)), 'でも いっぱいに傾ければ越えられる（6°の坂ぶんの余裕）');
  assert.strictEqual(conveyorPush(belt, belt.x + belt.halfWidth + 20, restY, 1.7, 12), 0, 'ベルトの外は押さない');
  assert.strictEqual(conveyorPush(belt, belt.x, belt.y - 70, 1.7, 12), 0, '上の段にいるときは押さない');
  assert.strictEqual(conveyorPush(null, 0, 0, 1.7, 12), 0);
  const beltShelf = shelves.find((sh) => sh.feature?.type === 'conveyor');
  assert.ok(beltShelf.points.every((p) => Math.abs(p.y - beltShelf.baseY) < 1e-9), 'ベルトの段は平ら（波と押し戻しが重なって出られなくならない）');
}

// ---------- 段と段の間はボール（直径24）が通れる ----------
// 段の面は点列の上6px、段の下面は下6px（厚さ12）。上下で重なるxで「下の段の面 − 上の段の下面」を調べる。
// シーソー板は、どちらに倒れても上がった端がいちばん高くなる場合で調べる

{
  const surfaceAt = (shelf, x) => {
    const f = shelf.feature;
    if (f?.type === 'seesaw' && Math.abs(x - f.x) <= f.halfLength) {
      const a = (f.maxAngleDeg * Math.PI) / 180;
      return { top: f.pivotY - Math.abs(x - f.x) * Math.sin(a) - 6, bottom: f.pivotY + Math.abs(x - f.x) * Math.sin(a) + 6 };
    }
    for (const pts of shelf.segments) {
      for (let k = 0; k < pts.length - 1; k++) {
        const p = pts[k];
        const q = pts[k + 1];
        if (x >= p.x && x <= q.x) {
          const y = q.x === p.x ? Math.min(p.y, q.y) : p.y + ((q.y - p.y) * (x - p.x)) / (q.x - p.x);
          // だんさの崖の上は高いほう（上面）／低いほう（下面）で見る
          return { top: (q.x - p.x <= 2 ? Math.min(p.y, q.y) : y) - 6, bottom: (q.x - p.x <= 2 ? Math.max(p.y, q.y) : y) + 6 };
        }
      }
    }
    return null;
  };
  for (const key of ['easy', 'normal', 'hard', 'adult']) {
    const shelves = buildShelves(DIFFICULTY[key], 300);
    let worst = Infinity;
    for (let i = 0; i < shelves.length - 1; i++) {
      for (let x = 0; x <= 300; x += 1) {
        const upper = surfaceAt(shelves[i], x);
        const lower = surfaceAt(shelves[i + 1], x);
        if (upper && lower) worst = Math.min(worst, lower.top - upper.bottom);
      }
    }
    assert.ok(worst >= 24 + 1, `${key}: 段と段のすき間 ${worst.toFixed(1)}px ≥ ボールの直径24px＋1`);
  }
}

// ---------- カゴの動き ----------

{
  const b = DIFFICULTY.adult.basket;
  const W = 300;
  let min = Infinity;
  let max = -Infinity;
  for (let t = 0; t < b.periodMs; t += 10) {
    const x = basketX(t, b, W);
    min = Math.min(min, x);
    max = Math.max(max, x);
  }
  assert.ok(min - b.innerWidth / 2 >= 0 && max + b.innerWidth / 2 <= W, 'カゴは盤の中だけを動く');
  assert.ok(max - min > W * 0.6, 'カゴは盤のはばの6割以上を往復する（タイミングが要る）');
  assert.ok(Math.abs(basketX(0, b, W) - basketX(b.periodMs, b, W)) < 1e-9, '周期でくり返す');
  assert.ok(Math.abs(basketX(0, b, W) - W / 2) < 1e-9, 'はじめはまんなか');
}

// ---------- はた（なかま地点）とやり直す段 ----------

{
  const state = createGame({ difficulty: 'adult', mode: 'solo' });
  const shelves = buildShelves(state.settings, 300);
  startRun(state, 0);
  const cp = state.settings.checkpoints[0];
  assert.strictEqual(respawnShelf(state, 'side'), 0, 'はたの前に横から落ちたら いちばん上から');
  assert.strictEqual(updateCheckpoint(state, shelves, shelves[cp - 1].baseY - 18), 0, 'はたの手前の段ではまだ');
  assert.strictEqual(updateCheckpoint(state, shelves, shelves[cp].baseY - 18), cp, 'はたの段に乗ったら通過');
  assert.strictEqual(updateCheckpoint(state, shelves, shelves[0].baseY), cp, '一度通ったら戻らない');
  assert.strictEqual(respawnShelf(state, 'side'), cp, '横から落ちたら はた から');
  assert.strictEqual(respawnShelf(state, 'miss'), state.settings.shelfCount - 1, 'カゴを外したら最後の段から');
  finishRun(state, 1000);
  const again = createGame({ difficulty: 'adult', mode: 'two' });
  startRun(again, 0);
  updateCheckpoint(again, shelves, 9999);
  finishRun(again, 1000);
  startRun(again, 2000);
  assert.strictEqual(again.checkpoint, 0, '次の人は はた なしから');
  const normal = createGame({ difficulty: 'normal', mode: 'solo' });
  startRun(normal, 0);
  assert.strictEqual(updateCheckpoint(normal, buildShelves(normal.settings, 300), 9999), 0, 'おとな以外は はた なし');
}

// ---------- 横スライダー → 傾き ----------

{
  const max = 24;
  const maxRad = (max * Math.PI) / 180;
  assert.strictEqual(tiltFromSlider(0.5, max), 0, 'まんなかなら水平');
  assert.ok(tiltFromSlider(0.8, max) > 0, '右へ動かすと右さがり（正）');
  assert.ok(tiltFromSlider(0.2, max) < 0, '左へ動かすと左さがり（負）');
  assert.ok(Math.abs(tiltFromSlider(1, max) - maxRad) < 1e-9, 'いちばん右で maxTiltDeg');
  assert.ok(Math.abs(tiltFromSlider(0, max) + maxRad) < 1e-9, 'いちばん左で -maxTiltDeg');
  assert.ok(Math.abs(tiltFromSlider(0.75, max) - maxRad / 2) < 1e-9, '半分なら半分の角度');
  assert.ok(Math.abs(tiltFromSlider(5, max) - maxRad) < 1e-9, '範囲外の値は丸める');
  assert.ok(Math.abs(tiltFromSlider(-5, max) + maxRad) < 1e-9, '範囲外の値は丸める（左）');
}

// ---------- タイム計測・落下・こうたい対戦 ----------

{
  const state = createGame({ difficulty: 'normal', mode: 'solo' });
  assert.strictEqual(startRun(state, 1000), true);
  assert.strictEqual(startRun(state, 1100), false, '走行中は二重に始めない');
  assert.strictEqual(elapsedOf(state, 3500), 2500);
  assert.strictEqual(recordFall(state), 1);
  assert.strictEqual(recordFall(state), 2);
  const result = finishRun(state, 6000);
  assert.deepStrictEqual(result, { elapsedMs: 5000, falls: 2, finished: true, winner: null });
  assert.strictEqual(state.finished, true);
  assert.strictEqual(recordFall(state), 0, '終わった後は数えない');
}

{
  const state = createGame({ difficulty: 'easy', mode: 'two' });
  startRun(state, 0);
  const first = finishRun(state, 4000);
  assert.deepStrictEqual(first, { elapsedMs: 4000, falls: 0, nextPlayer: 1 });
  assert.strictEqual(state.currentPlayer, 1);
  startRun(state, 10000);
  recordFall(state);
  const second = finishRun(state, 13000);
  assert.strictEqual(second.winner, 1, '3.0秒 < 4.0秒 であおの勝ち（落ちても速ければ勝ち）');
  assert.deepStrictEqual(state.results, [4000, 3000]);
  assert.deepStrictEqual(state.fallsBy, [0, 1]);
}

console.log('rollcatch.test.js: all passed');
