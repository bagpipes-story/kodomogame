// kit.js — いきもの つみき（うみ・どうぶつ）の共通部品（v0.17.12）
// ①当たり判定の形（凸の点列）を作る関数 ②かわいい顔・もようを描く道具。
// DOMには触らない（描く道具は ctx を受け取るだけ）ので、Nodeのテストからも読み込める。
// 絵は ui.js が最初に1回だけ小さなキャンバスに描いて使い回す（毎フレーム描くと重いため）

const TAU = Math.PI * 2;
export const INK = '#4a3b33';

const round2 = (v) => Math.round(v * 100) / 100;

// となり同士がほぼ同じ点を消す（長さ0の辺があると当たり判定の計算が壊れる）
function dedupe(points) {
  const out = [];
  for (const p of points) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p.x - q.x, p.y - q.y) > 0.5) out.push({ x: round2(p.x), y: round2(p.y) });
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && Math.hypot(first.x - last.x, first.y - last.y) <= 0.5) out.pop();
  return out;
}

// だ円（from〜to を指定すると弧。弧のときは両はしの点も入れる）
export function ellipse(rx, ry, { n = 20, cx = 0, cy = 0, from = 0, to = TAU } = {}) {
  const full = Math.abs(to - from) >= TAU - 1e-9;
  const count = full ? n : n + 1;
  const points = [];
  for (let i = 0; i < count; i++) {
    const a = from + ((to - from) * i) / n;
    points.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return dedupe(points);
}

// 角まる四角。上の角(rt)と下の角(rb)を別にできる（上はまるく・下は平らにして積みやすく、などに使う）
export function blob(w, h, rt, rb, { cx = 0, cy = 0, seg = 4 } = {}) {
  const corners = [
    [-w / 2 + rt, -h / 2 + rt, rt, Math.PI],
    [w / 2 - rt, -h / 2 + rt, rt, Math.PI * 1.5],
    [w / 2 - rb, h / 2 - rb, rb, 0],
    [-w / 2 + rb, h / 2 - rb, rb, Math.PI * 0.5],
  ];
  const points = [];
  for (const [x, y, r, start] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = start + ((Math.PI / 2) * i) / seg;
      points.push({ x: cx + x + Math.cos(a) * r, y: cy + y + Math.sin(a) * r });
    }
  }
  return dedupe(points);
}

// おなかを平らにする（だ円のままだと とがった1点で着地して、車輪のように ころがり続けるため）
// 平らにした辺の とちゅうの点は消す（一直線に点が並ぶと、Matterが接地点を かたよって選び、
// 着地のいきおいで回り出してしまう）
export function flatBottom(points, y) {
  const flat = dedupe(points.map((p) => ({ x: p.x, y: Math.min(p.y, y) })));
  return flat.filter((p, i) => {
    const a = flat[(i + flat.length - 1) % flat.length];
    const b = flat[(i + 1) % flat.length];
    return !(a.y === y && p.y === y && b.y === y);
  });
}

export function pts(list) {
  return list.map(([x, y]) => ({ x, y }));
}

// ほしがた: へこんだ形は当たり判定にそのまま使えないので、まんなかの五角形＋とがり5つ（凸）に分ける
export function starPolys(outer, inner) {
  const top = -Math.PI / 2;
  const outerPts = [];
  const innerPts = [];
  for (let i = 0; i < 5; i++) {
    const a = top + (i * TAU) / 5;
    const b = a + Math.PI / 5;
    outerPts.push({ x: round2(Math.cos(a) * outer), y: round2(Math.sin(a) * outer) });
    innerPts.push({ x: round2(Math.cos(b) * inner), y: round2(Math.sin(b) * inner) });
  }
  const polys = [innerPts];
  for (let i = 0; i < 5; i++) polys.push([outerPts[i], innerPts[i], innerPts[(i + 4) % 5]]);
  return polys;
}

// テスト用: 点列が凸か（どの角でも同じ向きに曲がる）
export function isConvex(points) {
  if (points.length < 3) return false;
  let sign = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const c = points[(i + 2) % points.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-6) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return sign !== 0;
}

// 形全体のはこ（スプライトの大きさ・テストの大きさ確認に使う）
export function boundsOf(piece) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const part of piece.parts) {
    if (part.circle) {
      const [x, y, r] = part.circle;
      minX = Math.min(minX, x - r); maxX = Math.max(maxX, x + r);
      minY = Math.min(minY, y - r); maxY = Math.max(maxY, y + r);
    } else {
      for (const p of part.points) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
    }
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

// ---------- 物理ボディを作る（Matterは引数でもらう。ui.js とNodeのテストで同じものを使う） ----------

// 合体ボディの回りにくさ（慣性モーメント）を正しくする。Matterは部品ごとの値を足すだけで
// 「中心から離れた部品ほど回りにくい」ぶん（平行軸の定理）を入れないため、小さすぎて
// とがった先で ゆれながら すべり出してしまう（v0.17.10）
export function fixCompoundInertia(M, body) {
  let inertia = 0;
  for (const part of body.parts.slice(1)) {
    const dx = part.position.x - body.position.x;
    const dy = part.position.y - body.position.y;
    inertia += part.inertia + part.mass * (dx * dx + dy * dy);
  }
  M.Body.setInertia(body, inertia);
}

// ころがりにくさ（v0.17.14）。Matterには「転がりにくさ」の設定がないので、まるみのある いきものは
// 一度まわり出すと 丸太のように床を ころがり続け、広い床の はしから落ちていた。
// 毎フレーム まわる いきおいを少しずつ弱める（落ちる はやさ・まっすぐの動きは そのまま）
export const SPIN_DAMP = 0.95;

export function dampSpin(M, bodies, k = SPIN_DAMP) {
  for (const body of bodies) {
    if (body.isStatic || body.isSleeping || body.angularVelocity === 0) continue;
    M.Body.setAngularVelocity(body, body.angularVelocity * k);
  }
}

// いきもの1ぴきぶんのボディ。凸の部品を合体させる。
// Matterはボディの位置を「重さの中心」にするので、絵の(0,0)とのずれ（offset）も返す
export function buildPieceBody(M, piece, x, y) {
  const baseOptions = { friction: piece.friction ?? 0.9, frictionStatic: 1.2, restitution: 0, density: 0.002 };
  const parts = piece.parts.map((part) => {
    // 部品ごとの 重さ（v0.17.31）: トンボの ほそい おなかのように、形は ながいけれど かるい 部品に
    const options = part.density ? { ...baseOptions, density: part.density } : baseOptions;
    if (part.circle) {
      const [cx, cy, r] = part.circle;
      return M.Bodies.circle(x + cx, y + cy, r, options);
    }
    // 点の並びの向きをMatterの決まりにそろえる。逆だと接触点の計算がおかしくなる
    const points = M.Vertices.clockwiseSort(part.points.map((p) => ({ x: p.x, y: p.y })));
    const c = M.Vertices.centre(points);
    return M.Body.create({
      ...options,
      position: { x: x + c.x, y: y + c.y },
      vertices: points.map((p) => ({ x: p.x - c.x, y: p.y - c.y })),
    });
  });
  let body = parts[0];
  if (parts.length > 1) {
    body = M.Body.create({ ...baseOptions, parts });
    fixCompoundInertia(M, body);
  }
  return { body, offset: { x: x - body.position.x, y: y - body.position.y } };
}

// ---------- 描く道具（ctxだけ使う） ----------

function tracePart(ctx, part) {
  if (part.circle) {
    const [x, y, r] = part.circle;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, TAU);
    return;
  }
  const p = part.points;
  ctx.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
  ctx.closePath();
}

// からだ全体: 先に全部の線を太めに引いてから全部ぬる → 部品のつなぎ目の線が消えて、1つの形に見える
export function drawSilhouette(ctx, piece) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = piece.line;
  ctx.lineWidth = 3;
  for (const part of piece.parts) {
    ctx.beginPath();
    tracePart(ctx, part);
    ctx.stroke();
  }
  for (const part of piece.parts) {
    ctx.beginPath();
    tracePart(ctx, part);
    ctx.fillStyle = part.fill ?? piece.color;
    ctx.fill();
  }
}

// 部品の外がわの線をもう一度引く（こうらと あたま のように、色のちがう部品のさかいめを見せたいとき）
export function strokePart(ctx, part, color, width = 2) {
  ctx.beginPath();
  tracePart(ctx, part);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

// 部品の中だけに描く（おなかの色・もようが形からはみ出さないように）
export function clipPart(ctx, part, fn) {
  ctx.save();
  ctx.beginPath();
  tracePart(ctx, part);
  ctx.clip();
  fn();
  ctx.restore();
}

// 形をくりぬく（かにのハサミの切れこみ・たこの あしの すきま）
export function cut(ctx, fn) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  fn();
  ctx.restore();
}

export function oval(ctx, x, y, rx, ry, color, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
}

export function dot(ctx, x, y, r, color) {
  oval(ctx, x, y, r, r, color);
}

export function poly(ctx, list, color) {
  ctx.beginPath();
  ctx.moveTo(list[0][0], list[0][1]);
  for (let i = 1; i < list.length; i++) ctx.lineTo(list[i][0], list[i][1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export function line(ctx, list, color, width = 2) {
  ctx.beginPath();
  ctx.moveTo(list[0][0], list[0][1]);
  for (let i = 1; i < list.length; i++) ctx.lineTo(list[i][0], list[i][1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

// くろめ＋白いひかり（ひかりがあると ぐっと かわいく見える）
export function eye(ctx, x, y, r = 3.2) {
  dot(ctx, x, y, r, INK);
  dot(ctx, x - r * 0.35, y - r * 0.4, r * 0.4, '#ffffff');
}

export function cheek(ctx, x, y, rx = 4.2, ry = 2.8) {
  oval(ctx, x, y, rx, ry, 'rgba(255, 120, 145, 0.45)');
}

export function smile(ctx, x, y, w = 3.5) {
  ctx.beginPath();
  ctx.arc(x, y - w * 0.5, w, Math.PI * 0.2, Math.PI * 0.8);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.stroke();
}

// 「お」の口（ふぐ・たこ など）
export function pout(ctx, x, y, r = 2.2) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// つやの白いひかり
export function shine(ctx, x, y, rx = 5, ry = 3, rotation = -0.4) {
  oval(ctx, x, y, rx, ry, 'rgba(255, 255, 255, 0.55)', rotation);
}

// ---------- どうぶつ編（v0.17.21）で足した道具 ----------

// 部品の一部だけを1つの形として描く（あし の部品は描かず、からだ・あたま だけ など）
export function silhouetteOf(ctx, piece, indexes) {
  drawSilhouette(ctx, { line: piece.line, color: piece.color, parts: indexes.map((i) => piece.parts[i]) });
}

// 角まるの四角（ぬってから ふちを描く）
export function rrect(ctx, x, y, w, h, r, fill, stroke, width = 2) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

// ふちどりつきの だ円（みみ・ほっぺの もよう など、からだの上に のせる部品）
export function ovalLine(ctx, x, y, rx, ry, fill, stroke, width = 1.6, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

// 4本あし（xs = あしの まんなか）。hoof を わたすと 先を その色に（ひづめ）
export function legRow(ctx, xs, top, bottom, w, fill, stroke, hoof) {
  for (const x of xs) {
    rrect(ctx, x - w / 2, top, w, bottom - top, Math.min(3, w / 2), fill, stroke, 1.8);
    if (hoof) rrect(ctx, x - w / 2, bottom - 3.5, w, 3.5, 1.5, hoof, stroke, 1.4);
  }
}

// ---------- とり編（v0.17.23）で bird.js に作り、たんすい編（v0.17.28）で 共通に した道具 ----------

// 点を (cx,cy) のまわりに まわす（a>0 で右まわり。サギの からだを むね上がりに かたむける など）
export function turn(points, a, cx = 0, cy = 0) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return points.map(({ x, y }) => ({
    x: round2(cx + (x - cx) * c - (y - cy) * s),
    y: round2(cy + (x - cx) * s + (y - cy) * c),
  }));
}

// ほそながい四角（くびの 当たり判定）。(x1,y1)→(x2,y2) を はば w で
export function seg(x1, y1, x2, y2, w) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = (-(y2 - y1) / len) * (w / 2);
  const ny = ((x2 - x1) / len) * (w / 2);
  return pts([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]].map(([x, y]) => [round2(x), round2(y)]));
}

// なめらかな線（点の あいだを まるく つなぐ）。くび・かざりばね に使う
export function curve(ctx, list, color, width) {
  ctx.beginPath();
  ctx.moveTo(list[0][0], list[0][1]);
  for (let i = 1; i < list.length - 1; i++) {
    const [x, y] = list[i];
    const [nx, ny] = list[i + 1];
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  const last = list[list.length - 1];
  ctx.lineTo(last[0], last[1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

// ふちどりした ほそい あし
export function leg(ctx, list, color, stroke, w = 2) {
  line(ctx, list, stroke, w + 1.6);
  line(ctx, list, color, w);
}

// あしゆび（左むき: まえに ながく、うしろに みじかく）
export function foot(ctx, x, y, len, color, stroke, w = 1.8) {
  leg(ctx, [[x + len * 0.4, y], [x - len, y]], color, stroke, w);
}

// ふちどりつきの多角形（くちばし・しっぽ）
export function beak(ctx, list, fill, stroke, width = 1.2) {
  ctx.beginPath();
  ctx.moveTo(list[0][0], list[0][1]);
  for (let i = 1; i < list.length; i++) ctx.lineTo(list[i][0], list[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

// はねの うろこもよう（∪）
export function scallop(ctx, x, y, r, color, w = 1.1) {
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI * 0.15, Math.PI * 0.85);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.stroke();
}

// まわりを ふちどった め（くろい かおの上でも見えるように）
export function ringEye(ctx, x, y, r, ring) {
  dot(ctx, x, y, r + 1.1, ring);
  eye(ctx, x, y, r);
}

// いろつきの め（あかい め・きいろい め）: いろ→くろめ→ひかり
export function colorEye(ctx, x, y, r, iris) {
  dot(ctx, x, y, r, iris);
  dot(ctx, x, y, r * 0.52, INK);
  dot(ctx, x - r * 0.3, y - r * 0.35, r * 0.24, '#ffffff');
}
