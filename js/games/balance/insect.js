// insect.js — むし つみき（v0.17.31）
// うみ・どうぶつ・とり・たんすい と同じしくみ: 1ぴきずつ「当たり判定の形（凸の部品）」と「絵の描き方」を持つ。みんな 左むき
// （チョウだけは ずかんで おなじみの はねを ひろげた すがたで、あたまが 上）。
// カブトムシ・クワガタ・セミ・トンボ などは 上から見た すがた（ずかんで おなじみ・2つの めが 見えて かわいい）。
// 上から見た むしは、あしの さきに 見えない板を 上下に おく（下=床に立つ・上=上に のせたものを ささえる）。
// 板は あしの 絵が かくす。バッタ・カマキリ・ナナフシ・ミツバチ は よこから見た すがた（あしで 立つ）

import {
  ellipse, blob, pts, seg, turn, flatBottom,
  drawSilhouette, silhouetteOf, strokePart, clipPart,
  oval, ovalLine, dot, poly, line, curve, leg, beak,
  eye, ringEye, colorEye, cheek, smile, shine, INK,
} from './kit.js';

const PI = Math.PI;
const r2 = (v) => Math.round(v * 100) / 100;

// 点の あつまりを つつむ 凸の形（当たり判定）。クワガタの あごのように すきまの ある形は、当たり判定では
// すきまを うめる（へこんだ部品は Matter で正しく ぶつからないため）。ちかすぎる点は まとめる（長さ0の辺で こわれるため）
function hull(list) {
  const p = list.map(([x, y]) => [r2(x), r2(y)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (arr) => {
    const out = [];
    for (const q of arr) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop();
      out.push(q);
    }
    return out.slice(0, -1);
  };
  const h = [...half(p), ...half([...p].reverse())];
  const out = [];
  for (const q of h) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) > 0.8) out.push(q);
  }
  if (out.length > 3 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= 0.8) out.pop();
  return pts(out);
}

// 上がわ（s=-1）と 下がわ（s=1）に 同じものを
const flip = (list, s) => list.map(([x, y]) => [x, y * s]);

// ふしの ある あし（つけね→もも→すね→あしさき。さきほど ほそく）。ふちを 先に ぜんぶ 引いてから ぬる（ふしの つなぎめを きれいに）
function bugLeg(ctx, list, color, stroke, w) {
  const ws = [w, w * 0.82, w * 0.58, w * 0.5];
  for (let i = 0; i < list.length - 1; i++) line(ctx, [list[i], list[i + 1]], stroke, ws[i] + 1.6);
  for (let i = 0; i < list.length - 1; i++) line(ctx, [list[i], list[i + 1]], color, ws[i]);
}
function legs(ctx, list, color, stroke, w = 2.4) {
  for (const s of [-1, 1]) for (const l of list) bugLeg(ctx, flip(l, s), color, stroke, w);
}

// 上から見た むしの 見えない あしの板（y=±cy、はば w）。あしさきは y=±(cy+0.7) に 描くと 板の はしと そろう
const boards = (w, cx, cy) => [
  { points: blob(w, 4, 1.5, 1.5, { cx, cy }) },
  { points: blob(w, 4, 1.5, 1.5, { cx, cy: -cy }) },
];

// なめらかな とじた形（はね・あご）。点は かどの めやす（線は 点と点の まんなかを とおる）
function smoothPath(ctx, list) {
  const n = list.length;
  const mid = (i) => [(list[i][0] + list[(i + 1) % n][0]) / 2, (list[i][1] + list[(i + 1) % n][1]) / 2];
  ctx.beginPath();
  const m0 = mid(n - 1);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(i);
    ctx.quadraticCurveTo(list[i][0], list[i][1], m[0], m[1]);
  }
  ctx.closePath();
}
function smooth(ctx, list, fill, stroke, width = 1.4) {
  smoothPath(ctx, list);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}
function smoothClip(ctx, list, fn) {
  ctx.save();
  smoothPath(ctx, list);
  ctx.clip();
  fn();
  ctx.restore();
}

// しろい ふちの め（くろい むしの かおでも 見えるように）
const bugEye = (ctx, x, y, r) => ringEye(ctx, x, y, r, '#ffffff');

// ---------- クワガタ（上から見た すがた）: はね・むね・あたま・あご。あごの 形で 見分ける ----------
// jaw = うえの あごの りんかく（下の あごは うらがえし）
function makeStag(o) {
  const jawHull = hull([...o.jaw, ...flip(o.jaw, 1)]);
  return {
    color: o.color,
    line: o.line,
    pad: o.pad,
    parts: [
      ...boards(o.board[0], o.board[1], o.board[2]),
      { points: o.elytra },
      { points: o.pronotum },
      { points: o.head },
      { points: jawHull },
    ],
    draw(ctx, piece) {
      legs(ctx, o.legs, o.legColor ?? o.color, o.line, o.legW ?? 2.4);
      for (const s of [-1, 1]) beak(ctx, flip(o.jaw, s), o.jawColor ?? o.color, o.line, 2.2); // あご
      silhouetteOf(ctx, piece, [2, 3, 4]);
      o.pattern?.(ctx, piece);
      strokePart(ctx, piece.parts[3], o.line, 1.5); // むねの ふち
      strokePart(ctx, piece.parts[4], o.line, 1.5); // あたまの ふち
      line(ctx, [[o.seam, 0], [o.tail, 0]], o.line, 1.3); // はねの あわせめ
      for (const s of [-1, 1]) {
        bugEye(ctx, o.eye[0], s * o.eye[1], 1.6);
        cheek(ctx, o.eye[0] + 4, s * (o.eye[1] - 2.6), 1.9, 1.2);
      }
      shine(ctx, o.tail - 20, -6.4, 9, 2.4, -0.15);
      shine(ctx, o.tail - 9, 5.6, 3, 1.2, 0.3);
      o.after?.(ctx, piece);
    },
  };
}

// はねの たての すじ（オオクワガタ・ミヤマ）
function grooves(ctx, piece, i, x0, x1, n, gap, color) {
  clipPart(ctx, piece.parts[i], () => {
    for (let k = 1; k <= n; k++) {
      for (const s of [-1, 1]) curve(ctx, [[x0, s * k * gap], [(x0 + x1) / 2, s * k * gap * 1.05], [x1, s * k * gap * 0.6]], color, 0.9);
    }
  });
}

// ノコギリクワガタの あご: 大きく まがった わ（うちがわに ノコギリの は）
// （はじめは まるい わに したら、2本の あごが とじた わっかに 見えたので、よこながの だ円に して さきを はなす）
function sawJaw() {
  const c = [-31, 1.6];
  const outer = [];
  const inner = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = (-40 - 116 * t) * (PI / 180);
    const w = 5 - 3.4 * t;
    const tooth = t > 0.3 && t < 0.8 && i % 2 === 1 ? 1.3 : 0; // は
    outer.push([c[0] + Math.cos(a) * 15, c[1] + Math.sin(a) * 12.6]);
    inner.push([c[0] + Math.cos(a) * (15 - w + tooth), c[1] + Math.sin(a) * (12.6 - w + tooth)]);
  }
  const tip = [c[0] + Math.cos(-158 * PI / 180) * 14.4, c[1] + Math.sin(-158 * PI / 180) * 10.4]; // さきは うちがわへ まがる
  return [...outer, tip, ...inner.reverse()].map(([x, y]) => [r2(x), r2(y)]);
}

// にじいろの おび（ニジイロクワガタ・タマムシの ひかり）。グラデーションは つかわず、ななめの 色の おびを かさねる
function rainbow(ctx, x0, colors, w, tilt = 0.5) {
  colors.forEach((c, i) => poly(ctx, [[x0 + i * w, -30], [x0 + (i + 1) * w + 0.6, -30], [x0 + (i + 1) * w + 0.6 + tilt * 60, 30], [x0 + i * w + tilt * 60, 30]], c));
}

// ---------- セミ（上から見た すがた）: ひろい あたまと とび出た め・むね・やねの ように たたんだ はね ----------
// clear=すきとおった はね（下の おなかが 見える）。half=はねの はばの半分、tip=はねの さき
function makeCicada(o) {
  const H = o.half;
  const X = o.tip;
  const outline = [[-17, -H * 0.84], [-2, -H], [16, -H * 0.94], [X - 12, -H * 0.68], [X - 3, -H * 0.34], [X + 1, 0],
    [X - 3, H * 0.34], [X - 12, H * 0.68], [16, H * 0.94], [-2, H], [-17, H * 0.84]];
  const wing = (s) => [[-17, s * H * 0.84], [-2, s * H], [16, s * H * 0.94], [X - 12, s * H * 0.68], [X - 3, s * H * 0.34], [X + 1, s * 1],
    [X - 8, s * 0.2], [8, s * 0.2], [-10, s * 2.4], [-15, s * H * 0.46]];
  const cy = o.board[2];
  return {
    color: o.color,
    line: o.line,
    parts: [
      ...boards(o.board[0], o.board[1], cy),
      { points: hull(outline) },                                                        // はね
      { points: ellipse(10.5, o.thoraxR, { cx: -18, n: 22 }) },                          // むね
      { points: ellipse(5.4, o.headR, { cx: -30.5, n: 18 }) },                           // あたま（とび出た め）
    ],
    draw(ctx, piece) {
      legs(ctx, [
        [[-24, 8], [-27, 12], [-30, 14.6], [-33, cy + 0.7]],
        [[-12, 9], [-10, 13], [-7, 15], [-4, cy + 0.7]],
        [[-2, 9], [5, 13], [12, 15], [17, cy + 0.7]],
      ], o.legColor, o.line, 2);
      if (o.clear) oval(ctx, 4, 0, 24, H * 0.6, o.body); // すきとおった はねの下の おなか
      for (const s of [-1, 1]) {
        const w = wing(s);
        smooth(ctx, w, o.wing, null);
        smoothClip(ctx, w, () => {
          o.wingPattern?.(ctx, s);
          // はねの すじ（つけねから ひろがる 3本と、さきの へりに そう すじ）
          for (const [y1, x2, y2] of [[0.7, X - 6, 0.5], [0.5, X - 2, 0.22], [0.3, X - 14, 0.08]]) {
            curve(ctx, [[-14, s * H * y1], [10, s * H * (y1 + y2) / 2 * 1.05], [x2, s * H * y2]], o.vein, 0.9);
          }
          curve(ctx, [[12, s * H * 0.84], [X - 14, s * H * 0.58], [X - 5, s * H * 0.26], [X - 4, s * 1.4]], o.vein, 0.9);
        });
        smooth(ctx, w, null, o.line, 1.6);
      }
      silhouetteOf(ctx, piece, [3, 4]);
      clipPart(ctx, piece.parts[3], () => o.thoraxPattern(ctx));
      strokePart(ctx, piece.parts[4], o.line, 1.4);
      for (const s of [-1, 1]) {
        colorEye(ctx, -31.2, s * (o.headR - 2.8), 3, o.eyeColor); // とび出た 大きな め
        cheek(ctx, -33.2, s * 3.4, 1.6, 1.1);
      }
      for (const [x, y] of [[-28.6, 0], [-27.4, -1.7], [-27.4, 1.7]]) dot(ctx, x, y, 0.75, '#e8584a'); // 3つの ちいさな め（たんがん）
      shine(ctx, -20, -5, 4.4, 1.8, -0.4);
    },
  };
}

// ---------- バッタの なかま（よこから見た すがた）: からだ・大きな うしろあしの もも・ほそい あし ----------
// 床は y=12（あしの板は y=8〜12）。あしは さきを y=10.7 に 描くと 板の下と そろう
function makeHopper(o) {
  return {
    color: o.color,
    line: o.line,
    pad: o.pad,
    parts: [
      { points: blob(o.board[0], 4, 1.5, 1.5, { cx: o.board[1], cy: 10 }) },            // あしの板
      { points: hull(o.body) },                                                         // からだ（あたま・むね・はね）
      { points: hull(o.femur) },                                                        // うしろあしの もも
      ...(o.extra ?? []),
    ],
    draw(ctx, piece) {
      for (const l of o.farLegs) bugLeg(ctx, l, o.far, o.line, 1.8); // むこうがわの あし（すこし こく）
      o.back?.(ctx, piece);
      silhouetteOf(ctx, piece, [1]);
      o.detail(ctx, piece);
      for (const l of o.nearLegs) bugLeg(ctx, l, o.legColor, o.line, 1.9);
      smooth(ctx, o.femur, o.femurColor ?? o.legColor, o.line, 1.8); // もも（からだより 明るく。同じ色だと わっかに 見えたため）
      const f = o.femur;
      const hip = [(f[0][0] + f[7][0]) / 2, (f[0][1] + f[7][1]) / 2];
      for (let t = 0.2; t < 0.86; t += 0.13) { // ももの ギザギザ もよう（バッタの あしらしく）
        const x = hip[0] + (f[4][0] - hip[0]) * t;
        const y = hip[1] + (f[4][1] - hip[1]) * t;
        line(ctx, [[x + 1.4, y - 2.2 * (1 - t * 0.5)], [x - 0.8, y], [x + 1.4, y + 2.2 * (1 - t * 0.5)]], o.far, 0.9);
      }
      o.femurPattern?.(ctx);
      bugLeg(ctx, o.tibia, o.legColor, o.line, 2);                 // うしろあしの すね
      o.front?.(ctx, piece);
    },
  };
}

// ながい しょっかく（キリギリス・コオロギ・スズムシ）。bands=しろい おびの 色
function antenna(ctx, list, color, stroke, bands) {
  curve(ctx, list, stroke, 2.2);
  curve(ctx, list, color, 1);
  if (bands) for (let i = 1; i < list.length; i++) dot(ctx, (list[i - 1][0] + list[i][0]) / 2, (list[i - 1][1] + list[i][1]) / 2, 0.9, bands);
}

// ---------- トンボ（上から見た すがた）: 大きな め・4まいの すきとおった はねを よこに ひろげる・ほそながい おなか ----------
// 下の はね 2まいの さきで 立つ（まえばねは すこし まえへ、うしろばねは すこし うしろへ ひらいて、足もとを ひろく）
function makeDragonfly(o) {
  const L = o.wingLen;
  const wings = [];
  for (const s of [-1, 1]) {
    // はねは「X」の字に ひらく（まっすぐ よこに ひろげると、2まいの さきの あいだが せまくて、おなかの 重さで うしろに たおれた）。
    // うしろばねは かたむけた ぶん ながくして、さきの 高さを まえばねと そろえる（2まいの さきで 立つ）
    const AF = 0.5;
    const AH = 0.6;
    const LH = (L * Math.cos(AF)) / Math.cos(AH);
    wings.push({ c: [-29.5, s * (4 + L)], rx: 4.8, ry: L, a: s * AF, at: [-29.5, s * 4] });       // まえばね
    wings.push({ c: [-21.5, s * (4 + LH)], rx: 6.2, ry: LH, a: -s * AH, at: [-21.5, s * 4] });   // うしろばね
  }
  const wingPoints = (w) => turn(ellipse(w.rx, w.ry, { cx: w.c[0], cy: w.c[1], n: 20 }), w.a, w.at[0], w.at[1]);
  // はねの さきを すこし 平らに して、下の 2まいの さきの 高さを ぴったり そろえる（とがった さき だと、着地の いきおいで
  // まえばねが はねかえされて まわり出し、うしろに たおれた）。上の 2まいも 同じ（上に のせやすく）
  const tipY = Math.min(...wings.filter((w) => w.c[1] > 0).map((w) => Math.max(...wingPoints(w).map((p) => p.y)))) - 0.6;
  const level = (w) => {
    const s = Math.sign(w.c[1]);
    return flatBottom(wingPoints(w).map((p) => ({ x: p.x, y: p.y * s })), tipY).map((p) => ({ x: p.x, y: r2(p.y * s) }));
  };
  return {
    color: o.thorax,
    line: o.line,
    parts: [
      ...wings.map((w) => ({ points: level(w) })),
      { points: ellipse(7.6, 5.8, { cx: -31, n: 16 }) },                                 // むね
      { points: ellipse(5.4, 7.6, { cx: -42, n: 16 }), fill: o.eyeColor },               // あたま（大きな め）
      { points: seg(-24, 0, o.tail, 0, 4.6), density: 0.0006 },                         // ほそながい おなか（かるい。重さが うしろに かたよらない）
    ],
    draw(ctx, piece) {
      for (const w of wings) {
        const [c] = turn([{ x: w.c[0], y: w.c[1] }], w.a, w.at[0], w.at[1]).map((p) => [p.x, p.y]);
        ctx.save();
        ctx.translate(c[0], c[1]);
        ctx.rotate(w.a);
        ovalLine(ctx, 0, 0, w.rx, w.ry, o.wingTint, '#5a6470', 1.1);
        const s = Math.sign(w.c[1]);
        line(ctx, [[-w.rx * 0.55, -s * w.ry * 0.9], [-w.rx * 0.6, s * w.ry * 0.9]], '#7a8490', 0.8); // はねの すじ
        line(ctx, [[w.rx * 0.1, -s * w.ry * 0.9], [w.rx * 0.2, s * w.ry * 0.7]], '#8a94a0', 0.7);
        for (let k = -2; k <= 2; k++) line(ctx, [[-w.rx * 0.6, s * w.ry * k * 0.3], [w.rx * 0.5, s * w.ry * (k * 0.3 + 0.06)]], 'rgba(120, 130, 140, 0.45)', 0.6);
        poly(ctx, [[-w.rx * 0.85, s * w.ry * 0.7], [-w.rx * 0.2, s * w.ry * 0.7], [-w.rx * 0.2, s * w.ry * 0.82], [-w.rx * 0.7, s * w.ry * 0.82]], o.stigma); // はねの さきの てん
        ctx.restore();
      }
      // おなか（つけねは すこし ふとく、さきへ ほそく）
      const T = o.tail;
      beak(ctx, [[-25, -2.8], [-18, -2.2], [T - 6, -1.9], [T, -1.4], [T + 0.6, 0], [T, 1.4], [T - 6, 1.9], [-18, 2.2], [-25, 2.8]], o.body, o.line, 1.8);
      o.abdomen(ctx);
      silhouetteOf(ctx, piece, [4, 5]);
      clipPart(ctx, piece.parts[4], () => o.thoraxPattern?.(ctx));
      for (const s of [-1, 1]) { // 大きな め
        ovalLine(ctx, -42.6, s * 3.8, 4.4, 4, o.eyeColor, o.line, 1.2);
        dot(ctx, -43.4, s * 3.6, 1.7, INK);
        dot(ctx, -44, s * 3.6 - 0.8, 0.7, '#ffffff');
      }
      cheek(ctx, -37.6, -5.4, 1.4, 0.9);
      cheek(ctx, -37.6, 5.4, 1.4, 0.9);
      shine(ctx, -31, -2.4, 3.6, 1.4, -0.2);
    },
  };
}

// ---------- チョウ（はねを ひろげた すがた・あたまが 上）: まえばね・うしろばね・ほそい からだ ----------
// 下の はねの そこを 平らに して 2か所で 立つ（アゲハは しっぽの さきで 立つ）
function makeButterfly(o) {
  const right = (list) => list.map(([x, y]) => [-x, y]);
  return {
    color: o.body,
    line: o.line,
    parts: [
      { points: hull(o.fore) },
      { points: hull(right(o.fore)) },
      { points: hull(o.hind) },
      { points: hull(right(o.hind)) },
      { points: seg(0, -12, 0, 19, 5) },                                                // からだ
      { points: ellipse(4.2, 4.2, { cx: 0, cy: -15, n: 14 }) },                          // あたま
    ],
    draw(ctx, piece) {
      for (const s of [-1, 1]) { // しょっかく（さきが まるい）
        curve(ctx, [[s * 1.4, -18], [s * 3.6, -25], [s * 8, -30.6]], o.line, 1.3);
        dot(ctx, s * 8.2, -30.8, 1.6, o.line);
      }
      for (const [list, pattern] of [[o.hind, o.hindPattern], [o.fore, o.forePattern]]) {
        for (const s of [-1, 1]) {
          const w = s < 0 ? list : right(list);
          smooth(ctx, w, o.wing, null);
          smoothClip(ctx, w, () => {
            ctx.save();
            ctx.scale(-s, 1); // もようは 左の はねで 描いて、右は うつす
            pattern(ctx);
            ctx.restore();
          });
          smooth(ctx, w, null, o.line, 1.8);
        }
      }
      silhouetteOf(ctx, piece, [4, 5]);
      o.bodyPattern?.(ctx);
      for (const s of [-1, 1]) {
        dot(ctx, s * 1.9, -15.6, 1.25, INK);
        dot(ctx, s * 1.9 - 0.4, -16.1, 0.45, '#ffffff');
        cheek(ctx, s * 2.4, -13.2, 1.2, 0.8);
      }
    },
  };
}

export const INSECT_PIECES = {
  // ---------- かんたん: 上から見た カブトムシ・クワガタ・タマムシ・セミ と ナナフシ ----------

  // カブトムシ: つやつやの こげちゃ・あたまの ながい つの（さきが ふたまた）・むねの みじかい つの
  rhinoBeetle: {
    color: '#6a3820',
    line: '#2a1408',
    parts: [
      ...boards(62, 0, 18.6),
      { points: ellipse(23, 13.5, { cx: 12, n: 28 }) },                                 // はね
      { points: ellipse(10.5, 12, { cx: -12, n: 22 }) },                                // むね
      { points: ellipse(5, 6.5, { cx: -24, n: 14 }) },                                  // あたま
      { points: pts([[-25, -4.6], [-43, -2.8], [-46.6, 0], [-43, 2.8], [-25, 4.6]]) },   // つの（ふとく。ほそいと ぼうに 見えたため）
    ],
    draw(ctx, piece) {
      legs(ctx, [
        [[-14, 9], [-19, 14], [-26, 16.2], [-31, 19.3]],
        [[0, 10], [3, 15], [10, 17], [14, 19.3]],
        [[10, 11], [16, 15.4], [25, 17], [31, 19.3]],
      ], '#5a2e18', '#2a1408', 2.6);
      silhouetteOf(ctx, piece, [2, 3, 4, 5]);
      // つのの さきの ふたまた（カブトムシの しるし。さらに さきが 2つに わかれる）
      beak(ctx, [[-40, -2.8], [-47, -5.4], [-51.4, -8.2], [-50.4, -5.6], [-52.4, -4.6], [-48.6, -3], [-47, -1], [-47, 1], [-48.6, 3],
        [-52.4, 4.6], [-50.4, 5.6], [-51.4, 8.2], [-47, 5.4], [-40, 2.8]], '#6a3820', '#2a1408', 1.6);
      strokePart(ctx, piece.parts[3], '#2a1408', 1.5);
      line(ctx, [[-1.5, 0], [35, 0]], '#2a1408', 1.3);
      beak(ctx, [[-13, -2.4], [-24.6, -1.2], [-27.2, -3], [-26.4, 0], [-27.2, 3], [-24.6, 1.2], [-13, 2.4]], '#7a4428', '#2a1408', 1.4); // むねの つの
      shine(ctx, -36, -1.2, 8, 1, 0.02); // つのの つや
      for (const s of [-1, 1]) {
        bugEye(ctx, -24.4, s * 5.2, 1.6);
        cheek(ctx, -19.4, s * 8.4, 2, 1.3);
      }
      shine(ctx, 8, -6.8, 11, 3, -0.12);
      shine(ctx, 24, 6, 4, 1.4, 0.3);
      shine(ctx, -13, -5.6, 4.4, 2, -0.5);
    },
  },

  // オオクワガタ: くろくて ひらたい・ふとく 内がわに まがる あご（まんなかに 大きな は）・はねに たての すじ
  giantStag: makeStag({
    color: '#2c2824',
    line: '#0e0c0a',
    board: [61, 2.5, 18.6],
    elytra: ellipse(19, 12.8, { cx: 16, n: 26 }),
    pronotum: blob(16, 25, 6, 6, { cx: -8 }),
    head: blob(13, 21, 5, 4, { cx: -21 }),
    jaw: [[-26, -8.6], [-31, -9.8], [-35.5, -9], [-38.8, -6.4], [-40, -3], [-38.6, -2.2], [-36.6, -4.4], [-34.6, -4.6],
      [-33.6, -1.6], [-32, -1.4], [-31.2, -4.6], [-26, -4.6]],
    legs: [
      [[-11, 9], [-16, 14], [-23, 16.2], [-28, 19.3]],
      [[2, 10], [5, 14.6], [11, 16.6], [15, 19.3]],
      [[14, 10], [20, 14.6], [28, 16.6], [33, 19.3]],
    ],
    seam: -2,
    tail: 35,
    eye: [-24.6, 8.4],
    pattern: (ctx, piece) => grooves(ctx, piece, 2, 0, 33, 3, 3.4, '#46403a'),
  }),

  // ヒラタクワガタ: ひらたく はばひろ・まっすぐ ながい あご（うちがわに こまかい は）
  flatStag: makeStag({
    color: '#221f1e',
    line: '#080606',
    board: [61, 4.5, 18.6],
    elytra: ellipse(18, 13.4, { cx: 18, n: 26 }),
    pronotum: blob(14, 27, 5, 5, { cx: -5.5 }),
    head: blob(12.5, 22.5, 4, 3, { cx: -17.6 }),
    jaw: [[-23.4, -8.4], [-36, -8.4], [-42, -7.6], [-45.4, -5.6], [-46.2, -3.4], [-44.6, -2.6], [-42.6, -3.8], [-40.4, -3.1],
      [-38.6, -4.3], [-36.6, -3.1], [-34.8, -4.3], [-32.8, -3.2], [-30.8, -4.3], [-28.6, -3.5], [-26.4, -4.5], [-23.6, -4.5]],
    legs: [
      [[-9, 9.5], [-14, 14.5], [-21, 16.6], [-26, 19.3]],
      [[4, 10.5], [7, 15], [13, 16.8], [17, 19.3]],
      [[16, 10.5], [22, 15], [30, 16.8], [35, 19.3]],
    ],
    seam: 0,
    tail: 36,
    eye: [-21.4, 9.4],
    after: (ctx) => shine(ctx, -6, -7, 3.6, 2, -0.6),
  }),

  // ノコギリクワガタ: あかちゃいろ・大きく わの ように まがった あご（うちがわに ノコギリの は）
  sawStag: makeStag({
    color: '#8a3a1c',
    line: '#3a1406',
    legColor: '#6a2a12',
    jawColor: '#7e3418',
    board: [60, 7, 18.6],
    elytra: ellipse(17, 12, { cx: 21, n: 26 }),
    pronotum: blob(13, 23, 5, 5, { cx: -2 }),
    head: blob(12, 19, 4, 3, { cx: -13 }),
    jaw: sawJaw(),
    legs: [
      [[-6, 8], [-11, 13], [-18, 16], [-23, 19.3]],
      [[7, 9.5], [10, 14.5], [16, 16.6], [20, 19.3]],
      [[19, 9.5], [25, 14.5], [33, 16.6], [37, 19.3]],
    ],
    seam: 4,
    tail: 38,
    eye: [-16.4, 7.8],
  }),

  // タマムシ: ほそながい だんがんの 形・にじいろに ひかる みどりに 2本の あかむらさきの すじ
  jewelBeetle: {
    color: '#2e9a5a',
    line: '#0e3e22',
    parts: [
      ...boards(50, 4, 16.2),
      { points: pts([[-6, -11], [6, -11.6], [18, -10.4], [28, -7.6], [35, -4], [38, 0], [35, 4], [28, 7.6], [18, 10.4], [6, 11.6], [-6, 11]]) }, // はね
      { points: pts([[-18, -7.6], [-6, -10.6], [-6, 10.6], [-18, 7.6]]) },             // むね
      { points: ellipse(4.6, 6.6, { cx: -21, n: 14 }) },                                // あたま
    ],
    draw(ctx, piece) {
      legs(ctx, [
        [[-12, 7], [-16, 11.5], [-20, 14], [-23, 16.9]],
        [[2, 9], [5, 13], [9, 14.6], [12, 16.9]],
        [[12, 9], [17, 13], [24, 14.6], [29, 16.9]],
      ], '#2a7a4a', '#0e3e22', 2);
      silhouetteOf(ctx, piece, [2, 3, 4]);
      clipPart(ctx, piece.parts[2], () => {
        rainbow(ctx, -40, ['#2e9a5a', '#3cb06a', '#58c47a', '#3cb06a', '#2e9a5a', '#2a8a62'], 12, 0.15); // みどりの ひかり
        for (const s of [-1, 1]) {
          line(ctx, [[-6, s * 5.6], [20, s * 5.4], [32, s * 2.6]], '#e8a040', 4.6);   // あかむらさきの すじ（ふちは きんいろ）
          line(ctx, [[-6, s * 5.6], [20, s * 5.4], [32, s * 2.6]], '#b02c6a', 3.2);
        }
      });
      clipPart(ctx, piece.parts[3], () => {
        for (const s of [-1, 1]) line(ctx, [[-18, s * 4.6], [-6, s * 5.6]], '#b02c6a', 2.6);
      });
      strokePart(ctx, piece.parts[3], '#0e3e22', 1.4);
      line(ctx, [[-6, 0], [38, 0]], '#0e3e22', 1.2);
      for (const s of [-1, 1]) {
        bugEye(ctx, -21.8, s * 4.8, 1.5);
        cheek(ctx, -17.4, s * 4.8, 1.6, 1.1);
      }
      shine(ctx, 10, -7.2, 10, 2, -0.08);
      shine(ctx, -12, -4.6, 3, 1.4, -0.3);
    },
  },
  // アブラゼミ: ちゃいろの すきとおらない はね（まだら もよう）・くろい むね
  brownCicada: makeCicada({
    color: '#7a5236',
    line: '#2e1c10',
    half: 14,
    tip: 40,
    thoraxR: 11.4,
    headR: 13,
    board: [50, -8, 16.6],
    legColor: '#5a3c26',
    wing: '#86603e',
    vein: '#4a3020',
    eyeColor: '#7a5a3a',
    wingPattern: (ctx, s) => {
      for (const [x, y, r] of [[0, 0.5, 3.4], [10, 0.3, 2.6], [20, 0.55, 3], [26, 0.28, 2.2], [32, 0.4, 2], [6, 0.78, 2.2]]) oval(ctx, x, s * 14 * y, r * 1.4, r, '#6a4a2e');
      for (const [x, y, r] of [[-6, 0.6, 2], [15, 0.7, 1.8], [28, 0.55, 1.6]]) oval(ctx, x, s * 14 * y, r * 1.3, r, '#a8805a');
    },
    thoraxPattern: (ctx) => {
      oval(ctx, -18, 0, 11, 12, '#2e2420');
      line(ctx, [[-25, -6], [-14, -3], [-10, 0], [-14, 3], [-25, 6]], '#7a5a3a', 1.6); // むねの もよう（すじ。まるい もようは かおに 見えたため）
      line(ctx, [[-22, 0], [-12, 0]], '#5a4430', 1.4);
    },
  }),

  // ツクツクボウシ: ほっそり・すきとおった はね・みどりと くろの からだ
  slimCicada: makeCicada({
    color: '#4e5e3a',
    line: '#1e2414',
    half: 11.4,
    tip: 39,
    thoraxR: 9.6,
    headR: 11,
    board: [50, -8, 14.6],
    legColor: '#5a6a42',
    clear: true,
    body: '#3a4430',
    wing: 'rgba(236, 246, 240, 0.55)',
    vein: '#5a4a2a',
    eyeColor: '#8a7a4a',
    thoraxPattern: (ctx) => {
      oval(ctx, -18, 0, 11, 11, '#6a8a4a');
      line(ctx, [[-25, -5], [-13, -2.4], [-9, 0], [-13, 2.4], [-25, 5]], '#1e2414', 1.6);
      line(ctx, [[-24, 0], [-12, 0]], '#1e2414', 1.2);
    },
  }),

  // ナナフシ（よこから見た すがた）: えだの ような ほそながい からだ・ほそい あし・まえあしを まえに のばす
  stickInsect: {
    color: '#86a64e',
    line: '#3e5420',
    pad: 11,
    parts: [
      { points: blob(57, 4, 1.5, 1.5, { cx: 3.5, cy: 9.4 }) },                          // あしの板
      { points: seg(-41, -5, 48, -5, 4.8) },                                            // えだの ような からだ
      { points: ellipse(4.4, 3.6, { cx: -44, cy: -5.4, n: 14 }) },                       // あたま
    ],
    draw(ctx, piece) {
      const far = '#6e8a40';
      for (const l of [[[-8, -4], [-11, 2], [-14, 10.1]], [[18, -4], [21, 2], [24, 10.1]]]) leg(ctx, l, far, '#3e5420', 1.5); // むこうの あし
      for (const l of [[[-12, -4], [-19, 1], [-25, 10.1]], [[14, -4], [24, 1], [32, 10.1]]]) leg(ctx, l, '#86a64e', '#3e5420', 1.6);
      leg(ctx, [[-40, -4.6], [-52, -5.6], [-56, -5.8]], '#86a64e', '#3e5420', 1.5); // まえに のばした まえあし（えだに なりきる）
      line(ctx, [[-47, -7], [-55, -9]], '#5e7a30', 1); // しょっかく
      drawSilhouette(ctx, { line: piece.line, color: piece.color, parts: piece.parts.slice(1) });
      for (const x of [-22, -4, 14, 30]) line(ctx, [[x, -7], [x, -3]], '#6e8a3a', 1); // ふし
      line(ctx, [[-38, -6.4], [46, -6.4]], '#a8c46e', 1);
      eye(ctx, -45.2, -6.4, 1.5);
      cheek(ctx, -42.4, -4, 1.6, 1);
    },
  },

  // ---------- ふつう: ＋ミヤマ・ニジイロ・カミキリ・ミンミン・ホタル・テントウ・バッタ ----------

  // ミヤマクワガタ: あたまの よこが みみの ように はり出す・きんいろの 毛・さきが ふたまたの あご
  miyamaStag: makeStag({
    color: '#6e4220',
    line: '#2e1a08',
    legColor: '#5a3418',
    board: [56, 8, 18.6],
    elytra: ellipse(17, 12.5, { cx: 20, n: 26 }),
    pronotum: blob(12, 22, 4, 4, { cx: -1 }),
    head: pts([[-4.8, -9.6], [-5.6, -14.2], [-10.4, -13.6], [-16.4, -11], [-20.4, -7.8], [-21.6, -4], [-21.6, 4], [-20.4, 7.8],
      [-16.4, 11], [-10.4, 13.6], [-5.6, 14.2], [-4.8, 9.6]]),
    jaw: [[-20.8, -7.6], [-26, -9.4], [-31, -9.4], [-35.6, -7.8], [-39.4, -5.6], [-41.8, -3.6], [-40.2, -3], [-40.6, -1.2],
      [-38.4, -1.6], [-36.4, -3.4], [-34.4, -2.6], [-32.6, -4.4], [-30.4, -3.6], [-28, -5.2], [-24, -4.6], [-21, -4.2]],
    legs: [
      [[-3, 8], [-8, 13], [-15, 16], [-20, 19.3]],
      [[8, 9.5], [11, 14.5], [17, 16.6], [21, 19.3]],
      [[19, 9.5], [25, 14.5], [32, 16.6], [36, 19.3]],
    ],
    seam: 3,
    tail: 37,
    eye: [-18.2, 9.4],
    pattern: (ctx, piece) => {
      grooves(ctx, piece, 2, 4, 35, 2, 4.2, '#5a3418');
      for (const i of [2, 3, 4]) {
        clipPart(ctx, piece.parts[i], () => {
          for (let k = 0; k < 26; k++) dot(ctx, -20 + ((k * 37) % 58), -12 + ((k * 23) % 25), 0.6, 'rgba(232, 196, 110, 0.75)'); // きんいろの 毛
        });
      }
    },
  }),

  // ニジイロクワガタ: にじいろに ひかる からだ・みじかく まがった あご
  rainbowStag: makeStag({
    color: '#3cae6a',
    line: '#1a3a26',
    legColor: '#4a8a5a',
    jawColor: '#b8903a',
    board: [50, 5, 16.6],
    elytra: ellipse(16, 11.5, { cx: 16, n: 26 }),
    pronotum: blob(12, 20, 5, 5, { cx: -4 }),
    head: blob(10, 15, 4, 3, { cx: -14 }),
    jaw: [[-18.6, -5.6], [-23, -7.2], [-27.6, -6.6], [-30.4, -4.2], [-31, -1.6], [-29.4, -1.4], [-27.8, -3.2], [-24.4, -3.8], [-21, -2.8], [-18.6, -2.6]],
    legs: [
      [[-6, 7.5], [-10, 11.5], [-16, 14], [-20, 17.3]],
      [[4, 9], [7, 13], [12, 14.8], [16, 17.3]],
      [[14, 9], [19, 13], [26, 14.8], [30, 17.3]],
    ],
    seam: 0,
    tail: 32,
    eye: [-16.6, 6.2],
    pattern: (ctx, piece) => {
      clipPart(ctx, piece.parts[2], () => rainbow(ctx, -14, ['#36b46a', '#9ad048', '#f2cc3e', '#f28a3a', '#e2485e', '#b04ad0', '#5a5ae0'], 6.4, 0.25));
      clipPart(ctx, piece.parts[3], () => rainbow(ctx, -34, ['#36b46a', '#9ad048', '#f2cc3e', '#9ad048'], 6, 0.2));
      clipPart(ctx, piece.parts[4], () => oval(ctx, -14, 0, 6, 8, '#5ac47a'));
    },
  }),

  // ルリボシカミキリ: そらいろの からだに くろい もよう・からだより ながい しょっかく（あおと くろの しま）
  rosalia: {
    color: '#62b8e6',
    line: '#1a4a6a',
    pad: 22,
    parts: [
      ...boards(46, 7, 15.6),
      { points: blob(44, 19, 7, 7, { cx: 15 }) },                                       // ほそながい はね
      { points: ellipse(6, 7.6, { cx: -10, n: 16 }) },                                  // むね
      { points: ellipse(4.6, 5.6, { cx: -19, n: 14 }) },                                // あたま
    ],
    draw(ctx, piece) {
      legs(ctx, [
        [[-10, 6], [-13, 10.5], [-16, 13.4], [-16, 16.3]],
        [[2, 8], [5, 12], [8, 14], [10, 16.3]],
        [[12, 8], [18, 12], [25, 14], [30, 16.3]],
      ], '#4a98c8', '#1a4a6a', 1.9);
      for (const s of [-1, 1]) { // ながい しょっかく（ふしごとに くろい ふさ）
        const a = [[-21, s * 3.4], [-31, s * 8.6], [-39, s * 14.4], [-43.6, s * 20]];
        curve(ctx, a, '#1a4a6a', 3);
        curve(ctx, a, '#7ac4ea', 1.6);
        for (const t of [0.2, 0.4, 0.6, 0.8]) dot(ctx, -21 - 22.6 * t, s * (3.4 + 16.6 * t * t * 0.6 + 16.6 * t * 0.4), 1.3, '#1a2a3a');
      }
      silhouetteOf(ctx, piece, [2, 3, 4]);
      clipPart(ctx, piece.parts[2], () => {
        for (const s of [-1, 1]) {
          oval(ctx, -1, s * 6, 3.4, 3, '#1a2028');
          oval(ctx, 15, s * 6.4, 4.8, 3.8, '#1a2028');
          oval(ctx, 29, s * 5.6, 3.2, 2.6, '#1a2028');
        }
      });
      clipPart(ctx, piece.parts[3], () => oval(ctx, -10, 0, 3, 3.6, '#1a2028'));
      clipPart(ctx, piece.parts[4], () => oval(ctx, -18, 0, 3.4, 4.4, '#2a3a4a'));
      strokePart(ctx, piece.parts[3], '#1a4a6a', 1.3);
      line(ctx, [[-7, 0], [37, 0]], '#1a4a6a', 1.2);
      for (const s of [-1, 1]) {
        bugEye(ctx, -20, s * 4.2, 1.5);
        cheek(ctx, -15.6, s * 4.2, 1.6, 1.1);
      }
      shine(ctx, 10, -5.4, 9, 1.8, -0.06);
    },
  },

  // ミンミンゼミ: すきとおった はね（つけねが みどり）・くろと みどりの からだ
  greenCicada: makeCicada({
    color: '#3a4a3a',
    line: '#141c14',
    half: 14.4,
    tip: 40,
    thoraxR: 11.4,
    headR: 13.2,
    board: [50, -8, 16.8],
    legColor: '#4e7a4a',
    clear: true,
    body: '#2a3028',
    wing: 'rgba(236, 248, 242, 0.55)',
    vein: '#3e6a4a',
    eyeColor: '#6a7a5a',
    wingPattern: (ctx, s) => oval(ctx, -12, s * 8, 6, 5, 'rgba(90, 170, 110, 0.5)'),
    thoraxPattern: (ctx) => {
      oval(ctx, -18, 0, 11, 12, '#5aa86a');
      line(ctx, [[-25, -6], [-13, -3], [-9, 0], [-13, 3], [-25, 6]], '#141c14', 1.8);
      line(ctx, [[-26, 0], [-11, 0]], '#141c14', 1.4);
    },
  }),

  // ゲンジボタル: くろい はね・ももいろの むねに くろい 十字・おしりが きいろく ひかる
  firefly: {
    color: '#262628',
    line: '#0c0c10',
    parts: [
      ...boards(44, 0, 15.4),
      { points: ellipse(20, 9.6, { cx: 8, n: 24 }) },                                   // はね
      { points: ellipse(7.5, 10.4, { cx: -15.5, n: 18 }), fill: '#f2907a' },            // ももいろの むね
      { points: ellipse(4, 5, { cx: -23.5, n: 12 }) },                                  // あたま
      { points: ellipse(4.2, 5.6, { cx: 29, n: 12 }), fill: '#f6ee7a' },                // ひかる おしり
    ],
    draw(ctx, piece) {
      oval(ctx, 30, 0, 10, 12, 'rgba(250, 248, 140, 0.3)'); // ひかり
      oval(ctx, 30, 0, 7, 8.6, 'rgba(250, 248, 140, 0.45)');
      legs(ctx, [
        [[-14, 7], [-17, 11], [-20, 13.4], [-22, 16.1]],
        [[0, 7], [2, 11], [5, 13.4], [8, 16.1]],
        [[10, 7], [14, 11], [19, 13.4], [22, 16.1]],
      ], '#2a2a2e', '#0c0c10', 1.8);
      for (const s of [-1, 1]) curve(ctx, [[-26, s * 2], [-31, s * 4.6], [-34, s * 7.6]], '#1a1a1e', 1.6); // しょっかく
      silhouetteOf(ctx, piece, [2, 5, 3, 4]);
      clipPart(ctx, piece.parts[5], () => {
        for (const x of [27, 30.4]) line(ctx, [[x, -6], [x, 6]], '#fffbc0', 1.4);
      });
      clipPart(ctx, piece.parts[3], () => {
        line(ctx, [[-15.5, -6.4], [-15.5, 6.4]], '#1a1a1e', 2.6); // くろい 十字（ゲンジボタルの しるし）
        line(ctx, [[-19.4, 0], [-11.6, 0]], '#1a1a1e', 2.6);
      });
      strokePart(ctx, piece.parts[3], '#0c0c10', 1.4);
      line(ctx, [[-8, 0], [27, 0]], '#0c0c10', 1.2);
      for (const s of [-1, 1]) bugEye(ctx, -24.4, s * 3.2, 1.4);
      shine(ctx, 6, -5, 9, 1.8, -0.06);
      shine(ctx, -17, -5, 2.6, 1.4, -0.4);
    },
  },

  // テントウムシ（ナナホシテントウ）: まるい あかい はねに 7つの くろい てん・くろい むねに しろい もよう
  ladybug: {
    color: '#e2322a',
    line: '#5a0e0a',
    parts: [
      ...boards(38, 0, 17.2),
      { points: ellipse(17, 15.6, { cx: 5, n: 28 }) },                                  // まるい はね
      { points: ellipse(6.5, 10.6, { cx: -11, n: 18 }), fill: '#221c1c' },              // くろい むね
      { points: ellipse(5.4, 7, { cx: -16.5, n: 14 }), fill: '#221c1c' },               // あたま
    ],
    draw(ctx, piece) {
      legs(ctx, [
        [[-10, 8], [-14, 12], [-17, 15], [-19, 17.9]],
        [[0, 10], [2, 14], [5, 16], [7, 17.9]],
        [[10, 10], [14, 14], [17, 16], [19, 17.9]],
      ], '#221c1c', '#0e0a0a', 1.9);
      silhouetteOf(ctx, piece, [2, 3, 4]);
      clipPart(ctx, piece.parts[2], () => {
        dot(ctx, -9, 0, 4, '#221c1c'); // まんなかの てん（7つめ）
        for (const s of [-1, 1]) {
          dot(ctx, -2, s * 8.6, 3.3, '#221c1c');
          dot(ctx, 8, s * 10.8, 2.9, '#221c1c');
          dot(ctx, 13, s * 4.4, 3.1, '#221c1c');
        }
      });
      clipPart(ctx, piece.parts[3], () => {
        for (const s of [-1, 1]) oval(ctx, -12.4, s * 7.2, 2.6, 3, '#f6f2ea'); // むねの しろい もよう
      });
      line(ctx, [[-5, 0], [22, 0]], '#5a0e0a', 1.3);
      for (const s of [-1, 1]) {
        bugEye(ctx, -17.6, s * 3.6, 1.8);
        cheek(ctx, -13.6, s * 4.2, 1.6, 1.1);
      }
      shine(ctx, 4, -8, 9, 3, -0.3);
      shine(ctx, 15, 8, 3, 1.4, 0.4);
    },
  },

  // トノサマバッタ: みどりの からだ・ちゃいろの はねに てんてん・ふとい うしろあし
  locust: makeHopper({
    color: '#7cae4a',
    line: '#2e4a1a',
    pad: 10,
    legColor: '#7cae4a',
    femurColor: '#9ccc66',
    far: '#5e8a36',
    board: [63, -3.5],
    body: [[-41, -2], [-40, -7], [-36, -10.6], [-30, -12], [-20, -12.4], [-12, -11.8], [4, -10.6], [22, -8.6], [38, -5.6], [46, -2.6],
      [46, 0], [38, 1.4], [20, 2.4], [-10, 2.6], [-30, 2.6], [-37, 1.8]],
    femur: [[-8, -2], [-4, -6.4], [8, -9.6], [22, -11.6], [27, -10], [24, -7.6], [10, -2.6], [-3, 2.4]],
    tibia: [[25, -10], [19, 4], [16, 10.7], [22, 10.7]],
    nearLegs: [[[-12, 1], [-15, 6], [-13, 10.7], [-9, 10.7]], [[-26, 1], [-30, 6], [-31, 10.7], [-35, 10.7]]],
    farLegs: [[[-9, 1], [-9, 6], [-6, 10.7], [-3, 10.7]], [[-23, 1], [-24, 6], [-24, 10.7], [-27, 10.7]], [[29, -8], [24, 4], [22, 10.7], [28, 10.7]]],
    back: (ctx) => curve(ctx, [[-37, -9], [-43, -14], [-48, -16]], '#2e4a1a', 1.6), // みじかい しょっかく
    detail: (ctx, piece) => {
      clipPart(ctx, piece.parts[1], () => {
        poly(ctx, [[-13, -14], [48, -9], [48, -1.6], [-13, -1.2]], '#b4a26c'); // はね
        for (const [x, y] of [[0, -6], [8, -8], [14, -5], [22, -6.6], [30, -4.6], [36, -3.4], [5, -3.4]]) oval(ctx, x, y, 1.6, 1.1, '#6a5430');
        line(ctx, [[-12, -8], [44, -3]], '#8a7a4a', 0.9);
        line(ctx, [[-36, -10.6], [-14, -12], [-13, 1.4]], '#2e4a1a', 1.2); // むねの ふち
        line(ctx, [[-30, -7], [-15, -8]], '#a8cc6a', 1);
      });
      colorEye(ctx, -34, -6.4, 2.8, '#c8a860');
      cheek(ctx, -36.6, -1.8, 1.8, 1.1);
      smile(ctx, -39.4, -1, 1.4);
    },
  }),

  // ショウリョウバッタ: とても ほそながい・とがった あたま・ながい うしろあし
  longHeadGrasshopper: makeHopper({
    color: '#8cc05a',
    line: '#3a5a20',
    pad: 10,
    legColor: '#8cc05a',
    femurColor: '#a8d478',
    far: '#6e9a44',
    board: [70, -1],
    body: [[-51, -11], [-44, -12.6], [-34, -12], [-24, -10], [-10, -9], [10, -8], [30, -6.4], [46, -3.6], [49, -1.4], [46, 0.6],
      [30, 1.6], [0, 2.2], [-24, 2.2], [-32, 1.6], [-38, -1], [-46, -6.6]],
    femur: [[-6, -1.6], [-2, -5.4], [14, -8.6], [32, -10.6], [35, -9], [32, -7], [14, -2.4], [-2, 2]],
    tibia: [[34, -9.4], [27, 4], [24, 10.7], [30, 10.7]],
    nearLegs: [[[-14, 1.4], [-16, 6], [-14, 10.7], [-10, 10.7]], [[-28, 1.4], [-31, 6], [-32, 10.7], [-36, 10.7]]],
    farLegs: [[[-11, 1.4], [-10, 6], [-7, 10.7], [-4, 10.7]], [[-25, 1.4], [-26, 6], [-26, 10.7], [-29, 10.7]], [[37, -8], [31, 4], [29, 10.7], [34, 10.7]]],
    back: (ctx) => {
      for (const dy of [0, 1.6]) beak(ctx, [[-49, -12.4 + dy], [-57, -15 + dy], [-49, -10.6 + dy]], '#7aae4a', '#3a5a20', 1); // ひらたい しょっかく
    },
    detail: (ctx, piece) => {
      clipPart(ctx, piece.parts[1], () => {
        poly(ctx, [[-22, -14], [52, -8], [52, -1.4], [-22, -2]], '#9ccc6a'); // はね
        line(ctx, [[-20, -6], [46, -2.6]], '#78a44a', 0.9);
        line(ctx, [[-49, -7.4], [-36, -4.6], [-10, -3.4], [40, -0.6]], '#e8f2b0', 1.3); // よこの すじ
        line(ctx, [[-34, -12], [-22, -10.6], [-22, 1.4]], '#3a5a20', 1.1);
      });
      colorEye(ctx, -41, -8.6, 2.2, '#a8c870');
      cheek(ctx, -40, -4.6, 1.6, 1);
    },
  }),

  // ---------- むずかしい: ＋キリギリス・スズムシ・コオロギ・ハンミョウ・トンボ ----------

  // キリギリス: ずんぐりした みどりの からだ・ちゃいろの はねに くろい てん・とても ながい しょっかく
  katydid: makeHopper({
    color: '#6aa63e',
    line: '#284a16',
    pad: 22,
    legColor: '#6aa63e',
    femurColor: '#8cc45c',
    far: '#4e8430',
    board: [67, 0.5],
    body: [[-37, -2], [-37, -8], [-33, -12.4], [-26, -14], [-14, -14], [-6, -12.6], [8, -11.4], [22, -9.4], [32, -6.4], [36, -2],
      [32, 2], [16, 4], [-8, 4], [-28, 3.4], [-34, 1.6]],
    femur: [[-6, 0], [-2, -4.6], [12, -8.6], [28, -12], [31, -10.4], [28, -8], [12, -1.6], [-2, 3.4]],
    tibia: [[30, -11], [26, 4], [23, 10.7], [30, 10.7]],
    nearLegs: [[[-10, 3], [-14, 7], [-12, 10.7], [-8, 10.7]], [[-24, 3], [-28, 7], [-29, 10.7], [-33, 10.7]]],
    farLegs: [[[-7, 3], [-7, 7], [-4, 10.7], [-1, 10.7]], [[-21, 3], [-22, 7], [-22, 10.7], [-25, 10.7]], [[33, -10], [30, 4], [28, 10.7], [34, 10.7]]],
    back: (ctx) => antenna(ctx, [[-34, -11], [-44, -18], [-53, -18.6], [-57.6, -14]], '#7ab04a', '#284a16'),
    detail: (ctx, piece) => {
      clipPart(ctx, piece.parts[1], () => {
        poly(ctx, [[-6, -14], [38, -8], [38, -1], [-6, -2]], '#a8925a'); // みじかめの はね
        for (const [x, y] of [[2, -8], [8, -5], [14, -8], [20, -4.6], [26, -6.4], [31, -3.6]]) dot(ctx, x, y, 1.2, '#2e2418');
        poly(ctx, [[-27, -14.4], [-6, -14.4], [-6, -11.6], [-27, -11.6]], '#8a6a3a'); // むねの ちゃいろい ふち
        line(ctx, [[-27, -12], [-6, -12.6], [-6, 3.4]], '#284a16', 1.2);
      });
      colorEye(ctx, -31.4, -7, 2.8, '#c8b060');
      cheek(ctx, -33.4, -2.4, 1.8, 1.1);
      smile(ctx, -35.6, -1.6, 1.4);
    },
  }),

  // スズムシ: くろい からだ・はねを 立てて なく すがた（すきとおった はね）・しろい おびの ながい しょっかく
  bellCricket: makeHopper({
    color: '#2c2620',
    line: '#100c08',
    pad: 22,
    legColor: '#3a322a',
    femurColor: '#4e4438',
    far: '#241e18',
    board: [60, -2],
    body: [[-30, -2], [-30, -7], [-26, -10], [-20, -10.6], [-12, -9.6], [10, -8], [24, -6], [30, -2.4], [26, 2], [0, 3], [-20, 3], [-27, 1.6]],
    femur: [[-4, -0.6], [0, -4.2], [12, -7], [22, -8.6], [25, -7], [22, -5], [12, -0.6], [0, 2.6]],
    tibia: [[24, -7.6], [20, 4], [18, 10.7], [24, 10.7]],
    nearLegs: [[[-8, 2], [-11, 6.4], [-10, 10.7], [-6, 10.7]], [[-19, 2], [-23, 6.4], [-24, 10.7], [-28, 10.7]]],
    farLegs: [[[-5, 2], [-5, 6.4], [-2, 10.7], [1, 10.7]], [[-16, 2], [-17, 6.4], [-17, 10.7], [-20, 10.7]], [[27, -6.4], [24, 4], [22, 10.7], [28, 10.7]]],
    extra: [{ points: turn(ellipse(9.6, 13, { cx: 8, cy: -16, n: 20 }), 0.42, 8, -16) }], // 立てた はね（せなかから 立ち上がる）
    back: (ctx) => {
      antenna(ctx, [[-27, -8], [-37, -15], [-46, -16], [-51, -11.6]], '#5a5040', '#100c08', '#f2ecd8');
      for (const dy of [-3, 0]) line(ctx, [[28, -2 + dy], [40, -5 + dy * 1.6]], '#3a322a', 1.2); // おしりの 2本の ひげ
      ctx.save(); // 立てた はね（すきとおって すこし ちゃいろ。なみの すじ）
      ctx.translate(8, -16);
      ctx.rotate(0.42);
      ovalLine(ctx, 0, 0, 9.6, 13, 'rgba(226, 210, 168, 0.88)', '#100c08', 1.6);
      for (const dx of [-4.4, 0, 4.4]) curve(ctx, [[dx, 11], [dx - 2.2, 5], [dx + 1.6, -1], [dx - 1.8, -7], [dx * 0.6, -11.6]], '#8a7a54', 0.9);
      ctx.restore();
    },
    detail: (ctx, piece) => {
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, -24, -6, 6, 5, '#1c1814');
        line(ctx, [[-19, -10.6], [-18, 2.6]], '#100c08', 1.1);
      });
      ringEye(ctx, -25, -5.6, 1.9, '#ffffff');
      cheek(ctx, -26.8, -1.4, 1.6, 1);
    },
    femurPattern: (ctx) => line(ctx, [[-1, 0], [6, -3]], '#d8d0b8', 1.2),
  }),

  // コオロギ（エンマコオロギ）: くろちゃいろ・まるくて つやつやの あたまに まゆの ような すじ・おしりに 2本の ひげ
  cricket: makeHopper({
    color: '#3a2c22',
    line: '#140e0a',
    pad: 22,
    legColor: '#4a3828',
    femurColor: '#5e4834',
    far: '#2e2218',
    board: [63, -1.5],
    body: [[-36, -2], [-36, -7.6], [-32, -11.6], [-25, -12.8], [-18, -12], [-10, -10.6], [10, -9.6], [26, -8], [32, -5], [33, -1],
      [28, 2.6], [0, 3.6], [-24, 3.4], [-32, 1.8]],
    femur: [[-4, -0.6], [0, -4.6], [12, -7.6], [24, -9.4], [27, -7.6], [24, -5.6], [12, -0.6], [0, 3]],
    tibia: [[26, -8.6], [22, 4], [19, 10.7], [26, 10.7]],
    nearLegs: [[[-10, 3], [-13, 7], [-12, 10.7], [-8, 10.7]], [[-23, 3], [-27, 7], [-28, 10.7], [-33, 10.7]]],
    farLegs: [[[-7, 3], [-7, 7], [-4, 10.7], [-1, 10.7]], [[-20, 3], [-21, 7], [-21, 10.7], [-24, 10.7]], [[29, -7.4], [26, 4], [24, 10.7], [30, 10.7]]],
    back: (ctx) => {
      antenna(ctx, [[-34, -10], [-43, -16], [-52, -16.6], [-57, -12]], '#5a4630', '#140e0a');
      for (const dy of [-3, 0]) line(ctx, [[31, -2 + dy], [44, -5.6 + dy * 1.8]], '#4a3828', 1.4); // おしりの 2本の ひげ
    },
    detail: (ctx, piece) => {
      clipPart(ctx, piece.parts[1], () => {
        poly(ctx, [[-10, -12], [34, -9], [34, 0], [-10, 0.6]], '#6a4e34'); // ちゃいろの はね
        for (const y of [-6.6, -3.4]) line(ctx, [[-8, y], [30, y + 1.6]], '#4a3424', 0.9);
        oval(ctx, -27, -6, 9.6, 7.4, '#221a14'); // つやつやの あたま
        line(ctx, [[-11, -10.6], [-11, 3.2]], '#140e0a', 1.1);
      });
      curve(ctx, [[-33.4, -10.6], [-29, -11.4], [-24.4, -10]], '#e8d6a0', 1.6); // まゆの ような すじ（エンマコオロギの しるし）
      ringEye(ctx, -30, -6.6, 1.9, '#ffffff');
      cheek(ctx, -32, -2.2, 1.7, 1);
      shine(ctx, -24, -9, 3.6, 1.6, -0.3);
    },
  }),

  // ハンミョウ（上から見た すがた）: あお・あか・みどりに しろい てんの きれいな はね・大きな め・白い 大きな あご・ながい あし
  tigerBeetle: {
    color: '#2c4aa0',
    line: '#141c3a',
    pad: 18,
    parts: [
      ...boards(60, 3, 18.6),
      { points: ellipse(17, 10.5, { cx: 12, n: 24 }) },                                 // はね
      { points: ellipse(5.4, 6.4, { cx: -9.4, n: 14 }), fill: '#c8403a' },              // むね
      { points: ellipse(6.4, 9.4, { cx: -19, n: 16 }), fill: '#2a9a66' },               // あたま
      { points: hull([[-24, -4.6], [-29, -5.6], [-32.6, -3.6], [-33.6, -0.6], [-33.6, 0.6], [-32.6, 3.6], [-29, 5.6], [-24, 4.6]]) }, // あご
    ],
    draw(ctx, piece) {
      legs(ctx, [
        [[-9, 5], [-15, 10], [-22, 14], [-27, 19.3]],
        [[4, 7], [6, 13], [11, 16], [15, 19.3]],
        [[12, 8], [18, 13], [27, 16], [33, 19.3]],
      ], '#3a7a9a', '#141c3a', 1.7);
      for (const s of [-1, 1]) curve(ctx, [[-24, s * 3.4], [-34, s * 10.4], [-41, s * 17]], '#141c3a', 1.4); // しょっかく
      for (const s of [-1, 1]) beak(ctx, [[-24, s * 4.6], [-29, s * 5.6], [-32.6, s * 3.6], [-33.6, s * -0.6], [-32.2, s * -1], [-30.4, s * 1.6], [-27.4, s * 2.4], [-24.4, s * 1.6]], '#f2e8c8', '#141c3a', 1.4); // 大きな あご
      silhouetteOf(ctx, piece, [2, 3, 4]);
      clipPart(ctx, piece.parts[2], () => {
        oval(ctx, 4, 0, 4.6, 12, '#d8343a');                                         // あかい おび
        oval(ctx, 15, 0, 4.4, 12, '#2aa066');                                        // みどりの おび
        oval(ctx, 27, 0, 3.6, 12, '#7a3ab0');                                        // むらさきの さき
        for (const s of [-1, 1]) {
          for (const [x, y, r] of [[-1, 6, 1.6], [9, 7.4, 1.4], [20, 4.4, 1.5], [24, 8, 1.2]]) dot(ctx, x, s * y, r, '#f6f2e4'); // しろい てん
        }
      });
      clipPart(ctx, piece.parts[3], () => oval(ctx, -9.4, 0, 3, 6.4, '#2aa066'));
      clipPart(ctx, piece.parts[4], () => oval(ctx, -17, 0, 3, 5, '#c8403a'));
      line(ctx, [[-5, 0], [29, 0]], '#141c3a', 1.2);
      for (const s of [-1, 1]) {
        bugEye(ctx, -19.4, s * 6.6, 2.3); // 大きな め
        cheek(ctx, -15.6, s * 5, 1.6, 1);
      }
      shine(ctx, 10, -5.4, 8, 1.8, -0.06);
    },
  },

  // オニヤンマ: いちばん 大きい トンボ・くろに きいろの しま・みどりの め
  goldenRinged: makeDragonfly({
    thorax: '#2a2a26',
    line: '#121210',
    body: '#2a2a26',
    eyeColor: '#3aa86a',
    wingTint: 'rgba(252, 248, 226, 0.55)',
    stigma: '#3a3a30',
    wingLen: 15.4,
    tail: 46,
    abdomen: (ctx) => { for (let x = -18; x < 44; x += 6.4) line(ctx, [[x, -1.7], [x, 1.7]], '#f2d23a', 2); }, // きいろの しま
    thoraxPattern: (ctx) => { for (const x of [-34, -28]) line(ctx, [[x - 2, -6], [x + 2, 6]], '#f2d23a', 1.8); },
  }),

  // ギンヤンマ: きみどりの むね・おなかの つけねが みずいろ・みどりの め
  emperorDragonfly: makeDragonfly({
    thorax: '#8ac83a',
    line: '#2a3a16',
    body: '#8a7a54',
    eyeColor: '#5ab84a',
    wingTint: 'rgba(248, 240, 214, 0.55)',
    stigma: '#a08a4a',
    wingLen: 15,
    tail: 44,
    abdomen: (ctx) => {
      beak(ctx, [[-24.6, -2.6], [-14, -2.1], [-14, 2.1], [-24.6, 2.6]], '#4ab4e8', '#2a3a16', 1); // みずいろ（ギンヤンマの しるし）
      line(ctx, [[-12, 0], [42, 0]], '#4a3e2a', 1);
    },
  }),

  // シオカラトンボ: みずいろがかった はいいろの おなか・さきが くろい
  skimmer: makeDragonfly({
    thorax: '#4a4a46',
    line: '#1a1a18',
    body: '#a8c4d8',
    eyeColor: '#4a9aaa',
    wingTint: 'rgba(244, 248, 252, 0.55)',
    stigma: '#2a2a28',
    wingLen: 14,
    tail: 40,
    abdomen: (ctx) => beak(ctx, [[28, -1.9], [40, -1.4], [40.6, 0], [40, 1.4], [28, 1.9]], '#2a2a28', '#1a1a18', 1), // くろい さき
    thoraxPattern: (ctx) => oval(ctx, -31, 0, 5, 2.6, '#8a9aa6'),
  }),

  // アキアカネ: まっかな おなか（あかとんぼ）・ちゃいろの むね・はねの つけねが すこし だいだい
  redDragonfly: makeDragonfly({
    thorax: '#b8603a',
    line: '#4a1a0e',
    body: '#e0442a',
    eyeColor: '#c0563a',
    wingTint: 'rgba(252, 236, 220, 0.55)',
    stigma: '#7a3a1e',
    wingLen: 14,
    tail: 40,
    abdomen: (ctx) => { for (let x = -16; x < 38; x += 5.6) line(ctx, [[x, -1.6], [x, 1.6]], '#b02e1a', 0.8); },
    thoraxPattern: (ctx) => { for (const x of [-34, -28]) line(ctx, [[x - 2, -6], [x + 2, 6]], '#4a1a0e', 1.1); },
  }),

  // ---------- おとな: ＋カマキリ・ヘラクレス・チョウ・ミツバチ ----------

  // カマキリ（よこから見た すがた）: ながい くびを 立てて、カマの まえあしを たたむ・さんかくの あたまに 大きな め
  mantis: {
    color: '#7ab84a',
    line: '#2e5418',
    pad: 12,
    parts: [
      { points: blob(51, 4, 1.5, 1.5, { cx: 8.5, cy: 10 }) },                            // あしの板
      { points: hull([[-6, -8], [6, -9.6], [24, -8.6], [38, -6], [46, -3], [46, 0], [38, 2], [20, 3], [0, 2.4], [-6, 0]]) }, // おなかと はね
      { points: seg(-3, -5, -19, -21, 5) },                                             // ながい くび（むね）
      { points: hull([[-17, -28.6], [-22, -30.4], [-27.6, -28.4], [-29.4, -24], [-26.6, -19.6], [-21, -19], [-16.6, -22.6]]) }, // あたま
      { points: hull([[-16, -19], [-26.4, -6], [-29.8, -6.6], [-37.8, -19], [-37, -23.2], [-32, -23.2], [-24, -14]]) }, // たたんだ カマ
    ],
    draw(ctx, piece) {
      for (const l of [[[0, -2], [-5, 3], [-7, 10.7], [-10, 10.7]], [[8, -2], [16, 2], [22, 10.7], [26, 10.7]]]) bugLeg(ctx, l, '#5e9a38', '#2e5418', 1.6);
      curve(ctx, [[-25, -29.4], [-30, -36], [-37, -39]], '#2e5418', 1.2); // しょっかく
      curve(ctx, [[-23, -30], [-26, -37], [-31, -41]], '#2e5418', 1.2);
      silhouetteOf(ctx, piece, [1, 2, 3]);
      clipPart(ctx, piece.parts[1], () => {
        poly(ctx, [[-4, -11], [48, -5], [48, -1.4], [-4, -2.4]], '#94cc62'); // はね
        line(ctx, [[0, -6], [44, -2.6]], '#5e9a38', 0.9);
        line(ctx, [[4, -8.4], [40, -4.2]], '#b4dc84', 0.9);
      });
      for (const l of [[[-2, -2], [-10, 2], [-14, 10.7], [-17, 10.7]], [[6, -2], [18, 0], [30, 10.7], [34, 10.7]]]) bugLeg(ctx, l, '#7ab84a', '#2e5418', 1.7);
      // カマ（「く」の字: つけね→下へ→上へ もも→たたんだ すね）
      leg(ctx, [[-16, -17], [-26.6, -7.4]], '#7ab84a', '#2e5418', 3.4);
      beak(ctx, [[-25, -6.2], [-29.4, -6.8], [-37.4, -18.8], [-36.8, -22.8], [-32.6, -22.8], [-27.6, -13.2], [-24.2, -8.6]], '#94cc62', '#2e5418', 1.5); // もも（ふとく）
      beak(ctx, [[-36, -22], [-31, -12.4], [-28.4, -9.8], [-29.6, -13.4], [-33.4, -21.6]], '#b8e088', '#2e5418', 1.2); // たたんだ すね
      for (let i = 0; i < 4; i++) {
        const x = -28.6 - i * 1.9;
        const y = -10.4 - i * 2.8;
        line(ctx, [[x + 0.8, y], [x + 2.4, y - 0.8]], '#2e5418', 0.9); // とげ
      }
      colorEye(ctx, -24.4, -26.4, 3.2, '#c4e070'); // 大きな め
      cheek(ctx, -22, -22.2, 1.8, 1.1);
      curve(ctx, [[-27.4, -21.6], [-26.4, -20.6], [-25.2, -21.4]], INK, 1); // くち
    },
  },
  // ヘラクレスオオカブト（よこから見た すがた）: きいろっぽい はねに くろい てん・はさみの ような 2本の ながい つの
  // （上から見たら つのが かたなに 見えたので、はさみが よく わかる よこからに）
  hercules: {
    color: '#c4ae58',
    line: '#2a2418',
    parts: [
      { points: blob(66, 4, 1.5, 1.5, { cx: 11, cy: 10 }) },                             // あしの板
      { points: hull([[2, -14], [14, -17], [28, -16], [38, -11], [43, -4], [42, 1], [34, 4], [14, 4.6], [2, 4]]) }, // はね
      { points: hull([[-14, -8], [-10, -14.6], [-2, -16.6], [4, -14], [5, 0], [0, 4], [-10, 3], [-14, -1]]), fill: '#1e1c1c' }, // むね
      { points: ellipse(5, 4.6, { cx: -14, cy: 0.6, n: 12 }), fill: '#1e1c1c' },         // あたま
      { points: hull([[-6, -16], [-20, -16.4], [-34, -15], [-46, -12], [-53, -8.4], [-55, -5.6], [-46, -6.6], [-42, -3.8], [-24, 0.4], [-12, 1.6]]), fill: '#1e1c1c' }, // 2本の つの
    ],
    draw(ctx, piece) {
      for (const l of [[[-4, 2], [-8, 6], [-10, 10.7], [-14, 10.7]], [[14, 3], [14, 7], [18, 10.7], [22, 10.7]], [[28, 3], [34, 6.4], [40, 10.7], [44, 10.7]]]) {
        bugLeg(ctx, l, '#1a1816', '#0a0908', 2.4); // むこうの あし
      }
      silhouetteOf(ctx, piece, [1, 2, 3]);
      // うえの つの（むねから。下に 毛の ふさ）と したの つの（あたまから。上に でこぼこ）。あいだは すきま
      beak(ctx, [[-6, -16], [-20, -16.4], [-34, -15], [-46, -12], [-53, -8.4], [-55, -5.6], [-53, -5], [-49, -7.6], [-40, -10], [-28, -11.4], [-14, -11], [-8, -10]], '#1e1c1c', '#0a0908', 1.6);
      for (let x = -14; x > -48; x -= 2.2) dot(ctx, x, -10.6 + (x + 14) * 0.06, 1, '#c8984a'); // 毛の ふさ
      beak(ctx, [[-12, 1.6], [-24, 0.4], [-34, -1.6], [-42, -3.8], [-46, -6.6], [-44.6, -7.2], [-40, -6], [-32, -4.6], [-22, -2.6], [-14, -2.4]], '#1e1c1c', '#0a0908', 1.6);
      for (const x of [-24, -30]) beak(ctx, [[x, -2.8], [x - 1.4, -5.4], [x - 2.8, -3.2]], '#1e1c1c', '#0a0908', 1.1); // したの つのの でこぼこ
      clipPart(ctx, piece.parts[1], () => {
        for (const [x, y, r] of [[10, -10, 1.6], [16, -4, 2], [22, -12, 1.4], [26, -6, 1.8], [32, -10, 1.4], [36, -3, 1.6], [12, 0, 1.2], [30, 1, 1.2], [20, 1, 1.4]]) {
          oval(ctx, x, y, r * 1.3, r, '#3a3020');
        }
        line(ctx, [[2, -12.6], [42, -6]], '#a8924a', 1);
      });
      strokePart(ctx, piece.parts[2], '#0a0908', 1.4);
      for (const l of [[[-8, 2], [-14, 6], [-18, 10.7], [-22, 10.7]], [[10, 3], [8, 7], [12, 10.7], [16, 10.7]], [[24, 3], [30, 6.4], [36, 10.7], [40, 10.7]]]) {
        bugLeg(ctx, l, '#2a2622', '#0a0908', 2.6);
      }
      bugEye(ctx, -16, -0.6, 1.5);
      cheek(ctx, -13.4, 2.2, 1.5, 1);
      shine(ctx, 20, -12, 9, 2.2, 0.1);
      shine(ctx, -4, -12, 4, 1.8, -0.3);
      shine(ctx, -32, -13.6, 8, 0.9, 0.12);
    },
  },

  // アゲハチョウ: きいろに くろい すじ・うしろばねに あおと あかの てん・しっぽ
  swallowtail: makeButterfly({
    body: '#2a2420',
    line: '#1a1410',
    wing: '#f6d64a',
    fore: [[-2, -9], [-10, -22], [-24, -31], [-38, -32], [-43, -27], [-38, -14], [-28, -4], [-4, -2]],
    hind: [[-3, -1], [-24, -2], [-34, 6], [-33, 16], [-27, 24], [-22.6, 36.4], [-19.4, 36.4], [-17.6, 28], [-9, 28], [-3, 18]],
    forePattern: (ctx) => {
      ctx.lineWidth = 7.4; ctx.strokeStyle = '#1e1a16';
      smoothPath(ctx, [[-2, -9], [-10, -22], [-24, -31], [-38, -32], [-43, -27], [-38, -14], [-28, -4], [-4, -2]]);
      ctx.stroke(); // くろい ふち
      for (const [x, y] of [[-40, -27], [-38, -21], [-35, -15], [-31, -9.4], [-26, -5]]) dot(ctx, x, y, 1, '#f6d64a'); // ふちの きいろい てん
      for (const [x, y] of [[-14, -24], [-22, -26], [-30, -26], [-34, -18]]) line(ctx, [[-3, -6], [x, y]], '#1e1a16', 1.6); // すじ
      poly(ctx, [[-2, -10], [-12, -24], [-17, -24], [-6, -4]], '#1e1a16');
    },
    hindPattern: (ctx) => {
      ctx.lineWidth = 9; ctx.strokeStyle = '#1e1a16';
      smoothPath(ctx, [[-3, -1], [-24, -2], [-34, 6], [-33, 16], [-27, 24], [-22.6, 36.4], [-19.4, 36.4], [-17.6, 28], [-9, 28], [-3, 18]]);
      ctx.stroke();
      for (const [x, y] of [[-29, 8], [-28, 15], [-24, 21], [-15, 24]]) dot(ctx, x, y, 1.4, '#5a8ae0'); // あおい てん
      dot(ctx, -7, 22.6, 2.2, '#e8583a'); // あかい てん
      for (const [x, y] of [[-26, 6], [-24, 14], [-16, 18]]) line(ctx, [[-4, 2], [x, y]], '#1e1a16', 1.2);
    },
    bodyPattern: (ctx) => line(ctx, [[0, -10], [0, 17]], '#f6d64a', 1),
  }),

  // モンシロチョウ: しろい はね・まえばねの さきが くろい・くろい てん
  cabbageWhite: makeButterfly({
    body: '#3a3a38',
    line: '#4a4a46',
    wing: '#f8f8f2',
    fore: [[-2, -9], [-10, -22], [-22, -30], [-34, -31], [-40, -26], [-38, -14], [-28, -4], [-4, -2]],
    hind: [[-3, -1], [-22, -2], [-32, 5], [-33, 15], [-28, 23], [-20, 28], [-10, 28], [-4, 20]],
    forePattern: (ctx) => {
      oval(ctx, -36, -28, 8, 6, '#4a4a48', 0.5); // さきが くろい
      dot(ctx, -24, -16, 2.6, '#3a3a38');
      dot(ctx, -27, -8, 2.2, '#3a3a38');
      oval(ctx, -4, -6, 6, 4, '#d8d8d0');
    },
    hindPattern: (ctx) => {
      dot(ctx, -22, -0.6, 2.2, '#4a4a48');
      oval(ctx, -5, 2, 5, 5, '#e2e2da');
    },
    bodyPattern: (ctx) => { for (let y = -9; y < 18; y += 4) line(ctx, [[-1.6, y], [1.6, y]], '#8a8a84', 0.8); },
  }),

  // オオムラサキ: こげちゃの はねの つけねが あざやかな むらさき・しろと きいろの てん・あかい てん
  purpleEmperor: makeButterfly({
    body: '#3a2a22',
    line: '#1a120e',
    wing: '#3e2c24',
    fore: [[-2, -9], [-10, -22], [-24, -31], [-38, -32], [-43, -27], [-38, -14], [-28, -4], [-4, -2]],
    hind: [[-3, -1], [-24, -2], [-34, 6], [-34, 16], [-27, 24], [-22, 30], [-12, 30], [-4, 20]],
    forePattern: (ctx) => {
      oval(ctx, -8, -8, 15, 12, '#7a4ad8', -0.6); // あざやかな むらさき
      oval(ctx, -8, -8, 9, 7, '#9a6ae8', -0.6);
      for (const [x, y, r] of [[-38, -27, 1.6], [-33, -26, 1.4], [-30, -18, 1.8], [-24, -22, 1.6], [-35, -18, 1.3], [-27, -11, 1.4]]) dot(ctx, x, y, r, '#f4ecc0');
    },
    hindPattern: (ctx) => {
      oval(ctx, -9, 6, 13, 10, '#7a4ad8', 0.4);
      oval(ctx, -8, 5, 7, 6, '#9a6ae8', 0.4);
      for (const [x, y] of [[-28, 10], [-25, 17], [-20, 22], [-29, 4]]) dot(ctx, x, y, 1.5, '#f2d870');
      dot(ctx, -14, 25, 2, '#e04a3a'); // あかい てん
    },
  }),

  // ミツバチ（よこから見た すがた）: ふわふわの むね・きいろと くろの しまの おなか・すきとおった はね・あしに 花ふんの だんご
  honeybee: {
    color: '#c8903a',
    line: '#3a2410',
    parts: [
      { points: blob(36, 4, 1.5, 1.5, { cx: 1, cy: 10 }) },                              // あしの板
      { points: ellipse(10, 9.5, { cx: -6, cy: -5, n: 20 }) },                           // ふわふわの むね
      { points: ellipse(14, 10.5, { cx: 14, cy: -3, n: 22 }), fill: '#f0b432' },         // しまの おなか
      { points: ellipse(7, 8, { cx: -20, cy: -6, n: 16 }), fill: '#3a2a1a' },            // あたま
      { points: turn(ellipse(13, 6, { cx: 4, cy: -22, n: 18 }), -0.5, -2, -13) },        // はね
    ],
    draw(ctx, piece) {
      for (const l of [[[-9, 2], [-11, 6], [-10, 10.7], [-13, 10.7]], [[0, 3], [1, 7], [4, 10.7], [7, 10.7]], [[8, 3], [13, 6.4], [16, 10.7], [19, 10.7]]]) {
        bugLeg(ctx, l, '#2a1c10', '#1a1008', 1.7); // むこうの あし
      }
      curve(ctx, [[-23, -13], [-26, -19], [-31, -21]], '#2a1c10', 1.5); // くの字の しょっかく
      curve(ctx, [[-20, -13.4], [-21, -20], [-26, -23.4]], '#2a1c10', 1.5);
      ctx.save(); // うしろの はね（ちいさい）
      ctx.translate(10, -18);
      ctx.rotate(-0.3);
      ovalLine(ctx, 0, 0, 9, 4.4, 'rgba(240, 248, 255, 0.6)', '#6a7480', 1);
      ctx.restore();
      silhouetteOf(ctx, piece, [1, 2, 3]);
      clipPart(ctx, piece.parts[2], () => {
        for (const x of [9, 16, 23]) oval(ctx, x, -3, 2.4, 12, '#3a2410'); // くろい しま
        oval(ctx, 18, -9, 8, 2.6, 'rgba(255, 240, 200, 0.5)');
      });
      clipPart(ctx, piece.parts[1], () => {
        for (let k = 0; k < 18; k++) dot(ctx, -15 + ((k * 7) % 19), -13 + ((k * 11) % 17), 0.8, '#e2b060'); // ふわふわの 毛
      });
      for (const l of [[[-12, 1], [-16, 5], [-16, 10.7], [-19, 10.7]], [[-4, 3], [-6, 7], [-4, 10.7], [-1, 10.7]], [[4, 2], [9, 5.6], [13, 10.7], [17, 10.7]]]) {
        bugLeg(ctx, l, '#3a2814', '#1a1008', 1.8);
      }
      ovalLine(ctx, 9.4, 5.6, 3.2, 2.8, '#f29a2a', '#8a4a10', 1.1); // 花ふんの だんご
      const [wc] = turn([{ x: 4, y: -22 }], -0.5, -2, -13); // まえの はね
      ctx.save();
      ctx.translate(wc.x, wc.y);
      ctx.rotate(-0.5);
      ovalLine(ctx, 0, 0, 13, 6, 'rgba(240, 248, 255, 0.65)', '#5a6470', 1.2);
      line(ctx, [[-11, 1], [10, -1]], '#8a94a0', 0.8);
      line(ctx, [[-6, -3.6], [6, 2.6]], 'rgba(120, 130, 140, 0.5)', 0.7);
      ctx.restore();
      ringEye(ctx, -21.6, -7.4, 2.4, '#ffffff');
      cheek(ctx, -18.6, -2.6, 1.9, 1.2);
      smile(ctx, -24, -2.2, 1.4);
      shine(ctx, -8, -11, 4, 1.6, -0.3);
    },
  },
};
