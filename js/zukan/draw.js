// draw.js — ずかん画の 描き方の 道具（v0.19.0。別冊05 §3・§4.4）
// つみき画（balance/kit.js）とは 別に した。ずかん画は「見分けられる くわしさ」が 目あてで、
// 太い ふち線・大きな 目・ほっぺ など かわいく する 道具を 使わない ため。
// 形は 点の ならび [x, y] で 持つ（Path2D の 文字列に しないのは、Node の テストでも そのまま 描けて 確かめられる から）。
// 点の 3つめに 1 を つけると、そこは 角（とがらせる。クワガタの 歯 など）。それ以外は なめらかに つなぐ。
// 光は いつも 左上から（どの 絵も 同じ 向きに そろえると、ならべた ときに 見くらべやすい）。

export const PI = Math.PI;

// ---------- 点の ならび ----------

// 右半分（x≧0。上の まんなか → 右がわ → 下の まんなか）から、左右対称の 形 ぜんぶを 作る
export function sym(half) {
  const left = [];
  for (let i = half.length - 2; i >= 1; i--) {
    const p = half[i];
    left.push(p.length > 2 ? [-p[0], p[1], p[2]] : [-p[0], p[1]]);
  }
  return half.concat(left);
}

export const flipX = (list) => list.map((p) => (p.length > 2 ? [-p[0], p[1], p[2]] : [-p[0], p[1]]));
export const shift = (list, dx, dy) => list.map((p) => (p.length > 2 ? [p[0] + dx, p[1] + dy, p[2]] : [p[0] + dx, p[1] + dy]));
export const scalePts = (list, sx, sy = sx) => list.map((p) => (p.length > 2 ? [p[0] * sx, p[1] * sy, p[2]] : [p[0] * sx, p[1] * sy]));

// だ円の 点（cx, cy, rx, ry, 何点, 回転）
export function ell(cx, cy, rx, ry, n = 24, rot = 0) {
  const out = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}

// ---------- 線を ひく ----------

// なめらかな 線（Catmull-Rom を ベジェに。角の 点は とがらせる）
export function trace(ctx, pts, closed = true, tension = 1) {
  const n = pts.length;
  if (n < 2) return;
  const tan = pts.map((p, i) => {
    if (p[2]) return [0, 0];
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    return [((b[0] - a[0]) / 2) * tension, ((b[1] - a[1]) / 2) * tension];
  });
  ctx.moveTo(pts[0][0], pts[0][1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const t0 = tan[i];
    const t1 = tan[(i + 1) % n];
    ctx.bezierCurveTo(p[0] + t0[0] / 3, p[1] + t0[1] / 3, q[0] - t1[0] / 3, q[1] - t1[1] / 3, q[0], q[1]);
  }
  if (closed) ctx.closePath();
}

// ぬる＋ふち（ふちは 細く、からだの 色に 近い こい色。つみき画の 太い 黒線は 使わない）
export function shape(ctx, pts, fillStyle, edge = null, width = 1) {
  ctx.beginPath();
  trace(ctx, pts, true);
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

// 線（とじない）
export function stroke(ctx, pts, color, width = 1, smooth = true) {
  ctx.beginPath();
  if (smooth) trace(ctx, pts, false);
  else {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function disc(ctx, x, y, r, fillStyle, edge = null, width = 1) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, PI * 2);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

export function oval(ctx, x, y, rx, ry, fillStyle, edge = null, width = 1, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, PI * 2);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

// 形の 中だけに 描く（もようを はみださせない）
export function within(ctx, pts, fn) {
  ctx.save();
  ctx.beginPath();
  trace(ctx, pts, true);
  ctx.clip();
  fn();
  ctx.restore();
}

// 左右 両方に 描く（右がわ x>0 の つもりで 描く fn を、鏡うつしにも する）
export function both(ctx, fn) {
  fn(1);
  ctx.save();
  ctx.scale(-1, 1);
  fn(-1);
  ctx.restore();
}

// ---------- 色 ----------

// たての グラデーション（上→下）
export function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

// よこの グラデーション（左→右）
export function hgrad(ctx, x0, x1, stops) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

export function lgrad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

// まるい グラデーション（つやの 光・まるみ）
export function rgrad(ctx, x, y, r, stops, x1 = x, y1 = y, r0 = 0) {
  const g = ctx.createRadialGradient(x, y, r0, x1, y1, r);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

// つやの 光（左上に ぼんやり）。かわいい 白丸の ハイライトでは なく、うすく ひろがる 光
export function gloss(ctx, pts, x, y, r, alpha = 0.35) {
  within(ctx, pts, () => {
    ctx.fillStyle = rgrad(ctx, x, y, r, [`rgba(255,255,255,${alpha})`, 'rgba(255,255,255,0)']);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  });
}

// ---------- むしの 部品 ----------

// ふしの ある 1本（a→b、太さ wa→wb）。台形を ぬって、ふしは まるく
export function limb(ctx, a, b, wa, wb, fillStyle, edge, width = 0.8) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(a[0] + nx * wa / 2, a[1] + ny * wa / 2);
  ctx.lineTo(b[0] + nx * wb / 2, b[1] + ny * wb / 2);
  ctx.arc(b[0], b[1], wb / 2, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true);
  ctx.lineTo(a[0] - nx * wa / 2, a[1] - ny * wa / 2);
  ctx.arc(a[0], a[1], wa / 2, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

// あし 1本: joints = [つけね, ひざ, あしくび, さき]、w = [もも, すね, あしくび] の 太さ
// tarsi = あしさきの ふしの 数（甲虫 5・セミ 3 など）、claw = つめの 長さ、spines = すねの とげ（外がわ）
// tibiaColor・tarsusColor = すね・あしさきの 色（ももだけ 色が ちがう 種類 用。v0.19.1）
export function leg(ctx, joints, w, color, edge, { tarsi = 5, claw = 2.2, spines = 0, spineLen = 2, tibiaColor = color, tarsusColor = color } = {}) {
  const [a, b, c, d] = joints;
  limb(ctx, a, b, w[0], w[0] * 0.75, color, edge);
  limb(ctx, b, c, w[1] * 0.7, w[1], tibiaColor, edge);
  // すねの とげ（外がわ＝右手がわに 出す）
  if (spines > 0) {
    const dx = c[0] - b[0];
    const dy = c[1] - b[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = dy / len;
    const ny = -dx / len;
    ctx.fillStyle = edge;
    for (let i = 1; i <= spines; i++) {
      const t = 0.25 + (0.7 * i) / spines;
      const x = b[0] + dx * t + nx * w[1] * 0.45;
      const y = b[1] + dy * t + ny * w[1] * 0.45;
      ctx.beginPath();
      ctx.moveTo(x - (dx / len) * spineLen * 0.5, y - (dy / len) * spineLen * 0.5);
      ctx.lineTo(x + nx * spineLen + (dx / len) * spineLen * 0.4, y + ny * spineLen + (dy / len) * spineLen * 0.4);
      ctx.lineTo(x + (dx / len) * spineLen * 0.5, y + (dy / len) * spineLen * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  }
  // あしさき: ふしを ならべて、さいごに つめ 2本
  const n = Math.max(1, tarsi);
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const p = [c[0] + (d[0] - c[0]) * t0, c[1] + (d[1] - c[1]) * t0];
    const q = [c[0] + (d[0] - c[0]) * t1, c[1] + (d[1] - c[1]) * t1];
    // ふしごとに すこし ふくらむ（ふしの くびれが 見える）。さいごの ふしは 長めで ほそい
    const wt = w[2] * (i === n - 1 ? 0.8 : 1);
    limb(ctx, p, q, wt * 0.7, wt, tarsusColor, null);
  }
  if (claw > 0) {
    const dx = d[0] - c[0];
    const dy = d[1] - c[1];
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    for (const side of [-1, 1]) {
      stroke(ctx, [d, [d[0] + ux * claw - uy * claw * 0.5 * side, d[1] + uy * claw + ux * claw * 0.5 * side]], edge, Math.max(0.6, w[2] * 0.4), false);
    }
  }
}

// 触角（ふしを 点で 打つ 糸のような もの）。pts = 根もと→さき、w0→w1 の 太さ、beads = ふしの 数
export function antenna(ctx, pts, w0, w1, color, { beads = 0, beadColor = color } = {}) {
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const w = w0 + ((w1 - w0) * i) / Math.max(1, n - 2);
    stroke(ctx, [pts[i], pts[i + 1]], color, w, false);
  }
  if (beads > 0) {
    // 線の 長さに そって ふしを 打つ
    const lens = [0];
    for (let i = 1; i < n; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = lens[n - 1];
    for (let k = 1; k <= beads; k++) {
      const at = (total * k) / (beads + 1);
      let j = 1;
      while (j < n - 1 && lens[j] < at) j++;
      const t = (at - lens[j - 1]) / (lens[j] - lens[j - 1] || 1);
      const x = pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * t;
      const y = pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * t;
      const w = w0 + (w1 - w0) * (at / total);
      disc(ctx, x, y, w * 0.62, beadColor);
    }
  }
}

// 複眼（虫の 目）: こい色の だ円に、左上から うすい 光。ひとみは 描かない（虫には ひとみが ない）
export function compoundEye(ctx, x, y, rx, ry, base, rot = 0) {
  oval(ctx, x, y, rx, ry, base, 'rgba(0,0,0,0.55)', 0.6, rot);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, PI * 2);
  ctx.clip();
  ctx.fillStyle = rgrad(ctx, x - rx * 0.35, y - ry * 0.4, Math.max(rx, ry) * 1.1, ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.08)', 'rgba(0,0,0,0.25)']);
  ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
  ctx.restore();
}

// はねの 脈（すきとおった はね 用）。from から to へ 何本か
export function veins(ctx, lines, color, width = 0.5) {
  for (const l of lines) stroke(ctx, l, color, width, true);
}

// ちいさな 毛・点の もよう（位置を きめうちで ならべる。乱数を 使わないので いつも 同じ 絵）
export function dots(ctx, list, r, color) {
  ctx.fillStyle = color;
  for (const [x, y, rr] of list) {
    ctx.beginPath();
    ctx.arc(x, y, rr ?? r, 0, PI * 2);
    ctx.fill();
  }
}

// きめうちの なんちゃって乱数（いつも 同じ 絵に なる）
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// 形の はこ（左上と 右下）
export function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

// まるみの ある ぬり（左上が あかるく、右下が くらい）。tone = [あかるい, ふつう, くらい]
export function fill3d(ctx, pts, tone, edge = null, width = 0.8, light = [0.32, 0.3]) {
  const [x0, y0, x1, y1] = bbox(pts);
  const w = x1 - x0;
  const h = y1 - y0;
  const lx = x0 + w * light[0];
  const ly = y0 + h * light[1];
  const r = Math.hypot(w, h) * 0.75;
  shape(ctx, pts, rgrad(ctx, lx, ly, r, tone), edge, width);
}

// はねの 平面形（v0.19.1）。つけね (x0, y0) から 右へ のびる はねを、長さ L・いちばん ひろい はば C と
// かたちの 数で きめる（種類ごとに はねの かたちを 描きわける ため）。
// alpha = つけねの ほそさ（大きいほど つけねが ほそい）、beta = さきの まるさ（小さいほど まるく ひろい・大きいほど とがる）、
// lead = はばの うち 前の ふちがわの わりあい（小さいほど 前の ふちが まっすぐ）、sweep = さきが 下（+）／上（-）へ ずれる 量、
// lobe = うしろの ふちの つけね ちかくの はりだし { at, w, size, kind: 'round' | 'angle' }（トンボの 後ばね）。
// u = つけね→さき（0〜1）、v = 前の ふち(-1)〜うしろの ふち(+1)。脈も (u, v) で きめて at() で うつすので、形が かわっても はみださない
export function planform({ x0 = 6, y0 = 0, L, C, base = 3, alpha = 0.45, beta = 0.5, lead = 0.32, sweep = 0, lobe = null, n = 56 }) {
  const raw = (u) => u ** alpha * (1 - u) ** beta;
  const um = alpha / (alpha + beta);
  const peak = raw(um);
  const chord = (u) => base * (1 - u) + (C - base * (1 - um)) * (raw(u) / peak);
  const extra = (u) => {
    if (!lobe) return 0;
    const d = Math.abs(u - lobe.at) / lobe.w;
    return lobe.size * (lobe.kind === 'angle' ? Math.max(0, 1 - d) : Math.exp(-d * d * 2.2));
  };
  const le = (u) => y0 + sweep * u * u - lead * chord(u);
  const te = (u) => y0 + sweep * u * u + (1 - lead) * chord(u) + extra(u);
  const at = (u, v) => {
    const a = le(u);
    return [x0 + u * L, a + ((v + 1) / 2) * (te(u) - a)];
  };
  const us = [];
  for (let i = 0; i <= n; i++) us.push(1 - (1 - i / n) ** 1.25); // さきの ほうを こまかく
  const outline = [...us.map((u) => at(u, -1)), ...us.slice(0, -1).reverse().map((u) => at(u, 1))];
  return { outline, at, chord };
}

// (u, v) の 点の ならびを 線に（脈を 描く ため）
export function mapLine(W, uvs) {
  return uvs.map(([u, v]) => W.at(u, v));
}

// 線（芯）を なめらかに こまかく する（Catmull-Rom を 等間かくの 点に）
export function resample(pts, n = 24) {
  const dense = [];
  const m = pts.length;
  for (let i = 0; i < m - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(m - 1, i + 2)];
    for (let k = 0; k < 12; k++) {
      const t = k / 12;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  dense.push(pts[m - 1]);
  // 長さで 等分
  const lens = [0];
  for (let i = 1; i < dense.length; i++) lens.push(lens[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = lens[lens.length - 1];
  const out = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const at = (total * k) / (n - 1);
    while (j < dense.length - 1 && lens[j] < at) j++;
    const t = (at - lens[j - 1]) / (lens[j] - lens[j - 1] || 1);
    out.push([dense[j - 1][0] + (dense[j][0] - dense[j - 1][0]) * t, dense[j - 1][1] + (dense[j][1] - dense[j - 1][1]) * t]);
  }
  return out;
}

// 芯に そった 太さの ある 形（クワガタの あご・ツノ など）。
// spine = 根もと→さき、widths = 芯の 点ごとの 太さ（とちゅうは なめらかに）、
// teeth = [[t(0〜1), 長さ, さきへの かたむき], ...] うちがわ（-n がわ）に とがりを 出す、
// outerTeeth = 外がわに 出す とがり、fork = さきを ふたまたに する 深さ（0 = しない）
export function ribbon(spine, widths, { teeth = [], outerTeeth = [], fork = 0, n = 40, side = 1 } = {}) {
  const c = resample(spine, n);
  const wAt = (t) => {
    const x = t * (widths.length - 1);
    const i = Math.min(widths.length - 2, Math.floor(x));
    const f = x - i;
    return widths[i] + (widths[i + 1] - widths[i]) * f;
  };
  const norm = (i) => {
    const a = c[Math.max(0, i - 1)];
    const b = c[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [(-dy / len) * side, (dx / len) * side, dx / len, dy / len];
  };
  const outer = [];
  const inner = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const w = wAt(t) / 2;
    const [nx, ny, tx, ty] = norm(i);
    const o = [c[i][0] + nx * w, c[i][1] + ny * w];
    const q = [c[i][0] - nx * w, c[i][1] - ny * w];
    outer.push(o);
    inner.push(q);
    for (const [tt, len, tilt = 0.4] of outerTeeth) {
      if (Math.round(tt * (n - 1)) === i) outer.push([o[0] + nx * len + tx * len * tilt, o[1] + ny * len + ty * len * tilt, 1], [o[0] + tx * 0.8, o[1] + ty * 0.8]);
    }
  }
  // うちがわの 歯（さきから 根もとへ たどる ので、あとで ぎゃくに する）
  const innerOut = [];
  for (let i = 0; i < n; i++) {
    const [nx, ny, tx, ty] = norm(i);
    const q = inner[i];
    const tooth = teeth.find(([tt]) => Math.round(tt * (n - 1)) === i);
    if (tooth) {
      const [, len, tilt = 0.4] = tooth;
      const base = Math.max(0.8, len * 0.45);
      innerOut.push([q[0] - tx * base, q[1] - ty * base], [q[0] - nx * len + tx * len * tilt, q[1] - ny * len + ty * len * tilt, 1], [q[0] + tx * base * 0.6, q[1] + ty * base * 0.6]);
    } else innerOut.push(q);
  }
  const tipI = n - 1;
  const [nx, ny, tx, ty] = norm(tipI);
  const w = wAt(1) / 2;
  const end = c[tipI];
  let tip;
  if (fork > 0) {
    tip = [
      [end[0] + nx * w + tx * fork * 0.6, end[1] + ny * w + ty * fork * 0.6, 1],
      [end[0] - tx * fork * 0.5, end[1] - ty * fork * 0.5, 1],
      [end[0] - nx * (w + fork * 0.3) + tx * fork * 0.4, end[1] - ny * (w + fork * 0.3) + ty * fork * 0.4, 1],
    ];
  } else {
    tip = [[end[0] + tx * Math.max(1, w), end[1] + ty * Math.max(1, w), 1]];
  }
  return outer.slice(0, -1).concat(tip, innerOut.slice(0, -1).reverse());
}

// ---------- うみ・どうぶつ 共通の 部品（v0.20.x で sea.js に 作り、v0.21.0 で ここへ うつした） ----------

// 形の 中に こまかい 点を ちらす（はだの つぶつぶ・ごまもよう）
export function sprinkle(ctx, pts, count, r, color, seed) {
  const rnd = seeded(seed);
  const [x0, y0, x1, y1] = bbox(pts);
  within(ctx, pts, () => {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const x = x0 + rnd() * (x1 - x0);
      const y = y0 + rnd() * (y1 - y0);
      ctx.beginPath();
      ctx.arc(x, y, r * (0.6 + rnd() * 0.7), 0, PI * 2);
      ctx.fill();
    }
  });
}

// まるみ（v0.20.2）: 形の ふちへ むかって くらく、上を あかるく・下を くらく。なめらかな はだや 毛の ある 生きものの 立体感
export function volume(ctx, pts, { dark = 0.12, wide = 8, light = 0.14 } = {}) {
  const [x0, y0, x1, y1] = bbox(pts);
  within(ctx, pts, () => {
    // ふちの かげは 4だんに 分けて ぼかす（2だん だと 帯の さかいが りんかくの ように 見える）
    for (const k of [2, 1.5, 1, 0.5]) shape(ctx, pts, null, `rgba(0,0,0,${dark * 0.3})`, wide * k);
    ctx.fillStyle = vgrad(ctx, y0, y1, [`rgba(255,255,255,${light})`, 'rgba(255,255,255,0)', 'rgba(0,0,0,0)', `rgba(0,0,0,${dark})`]);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  });
}

// みじかい 毛・すじ（むきの そろった 短い 線を ちらす）。angle = 毛の むき、spread = むきの ばらつき
export function fur(ctx, pts, count, len, angle, color, seed, spread = 0.6, width = 0.3) {
  const rnd = seeded(seed);
  const [x0, y0, x1, y1] = bbox(pts);
  within(ctx, pts, () => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const x = x0 + rnd() * (x1 - x0);
      const y = y0 + rnd() * (y1 - y0);
      const a = angle + (rnd() - 0.5) * spread;
      const l = len * (0.6 + rnd() * 0.8);
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    }
    ctx.stroke();
  });
}

// ヘビの ような ながい からだ（ウナギ・ウツボ・チンアナゴ・タコの うで）。芯と 太さから りんかくを 作る。
// up = 進む むきの 左がわ（左→右へ のびる 芯なら 上）、down = 右がわ
export function snake(spine, widths, n = 48) {
  const c = resample(spine, n);
  const wAt = (t) => {
    const x = t * (widths.length - 1);
    const i = Math.min(widths.length - 2, Math.floor(x));
    return widths[i] + (widths[i + 1] - widths[i]) * (x - i);
  };
  const up = [];
  const down = [];
  for (let i = 0; i < n; i++) {
    const a = c[Math.max(0, i - 1)];
    const b = c[Math.min(n - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = (b[1] - a[1]) / len;
    const ny = -(b[0] - a[0]) / len;
    const w = wAt(i / (n - 1)) / 2;
    up.push([c[i][0] + nx * w, c[i][1] + ny * w]);
    down.push([c[i][0] - nx * w, c[i][1] - ny * w]);
  }
  // はしを まるく とじる
  const cap = (i, j, w) => {
    const len = Math.hypot(c[i][0] - c[j][0], c[i][1] - c[j][1]) || 1;
    return [c[i][0] + ((c[i][0] - c[j][0]) / len) * w, c[i][1] + ((c[i][1] - c[j][1]) / len) * w];
  };
  const head = cap(0, 1, wAt(0) * 0.45);
  const tail = cap(n - 1, n - 2, wAt(1) * 0.45);
  return { c, up, down, outline: [head, ...up, tail, ...down.slice().reverse()], wAt };
}

// ---------- どうぶつの 部品（v0.21.0） ----------

// むきの そろった 毛。dir = 角度（ラジアン）か (x, y) => 角度。毛なみが からだの 形に そって ながれる ように 場所ごとに むきを かえられる。
// 1本ずつ 描かず 1つの パスに まとめて 1回で ぬるので、数百本 でも 重く ならない。毛は 2だんで すこし まがる
export function furFlow(ctx, pts, count, len, dir, color, seed, width = 0.3, spread = 0.35) {
  const rnd = seeded(seed);
  const [x0, y0, x1, y1] = bbox(pts);
  const f = typeof dir === 'function' ? dir : () => dir;
  within(ctx, pts, () => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const x = x0 + rnd() * (x1 - x0);
      const y = y0 + rnd() * (y1 - y0);
      const a = f(x, y) + (rnd() - 0.5) * spread;
      const l = len * (0.6 + rnd() * 0.8);
      const bx = x + Math.cos(a) * l * 0.5;
      const by = y + Math.sin(a) * l * 0.5;
      const a2 = a + (rnd() - 0.5) * 0.5;
      ctx.moveTo(x, y);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + Math.cos(a2) * l * 0.5, by + Math.sin(a2) * l * 0.5);
    }
    ctx.stroke();
  });
}

// ほにゅうるい・とり・はちゅうるい・カエルの 目。r = 目の 半径。iris = ひとみの まわり（こうさい）の 色。
// pupil: 'round'（まるい）| 'slit'（たてに ほそい: ネコ・キツネ・ワニ など）| 'bar'（よこに ながい: ヒツジ・ウシ・カエル など）。pr = ひとみの 大きさ
// lid = まぶたの 線の 色（null で なし）。図鑑の 絵なので 白目や 大きな 光の 玉は 描かない（光は 小さく 1つ）
export function mEye(ctx, x, y, r, { iris = '#6a4a22', pupil = 'round', pr = 0.5, ring = 'rgba(0,0,0,0.8)', lid = null, shine = true, rot = 0 } = {}) {
  disc(ctx, x, y, r, iris, ring, Math.max(0.2, r * 0.16));
  within(ctx, ell(x, y, r, r, 18), () => {
    // 上は まぶたの かげで くらく、下は あかるい
    ctx.fillStyle = vgrad(ctx, y - r, y + r, ['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.08)', 'rgba(255,255,255,0.16)']);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    if (pupil === 'slit') oval(ctx, x, y, r * pr * 0.34, r * 0.94, '#060504', null, 0, rot);
    else if (pupil === 'bar') oval(ctx, x, y, r * 0.88, r * pr * 0.44, '#060504', null, 0, rot);
    else disc(ctx, x, y, r * pr, '#060504');
  });
  if (shine) disc(ctx, x - r * 0.32, y - r * 0.36, r * 0.18, 'rgba(255,255,255,0.88)');
  if (lid) stroke(ctx, [[x - r * 1.2, y - r * 0.1], [x - r * 0.5, y - r * 1.02], [x + r * 0.5, y - r * 1.02], [x + r * 1.2, y - r * 0.1]], lid, Math.max(0.3, r * 0.2));
}
