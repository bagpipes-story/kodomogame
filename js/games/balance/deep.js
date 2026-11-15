// deep.js — しんかいの いきもの つみき（v0.17.34）
// うみ・どうぶつ・とり・たんすい・むし と同じしくみ: 1ぴきずつ「当たり判定の形（凸の部品）」と「絵の描き方」を持つ。みんな 左むき。
// この組は 積みやすさより、しんかいの いきもの らしい ふしぎな かたち（ながい あし・ひかる ちょうちん・大きな くち など）を だいじに する。
// それでも 床の上で とまるように、ころがる 形は そこを 平らに する（ほそい あし・ひれ・しょっかくは 部品を わける）

import {
  ellipse, pts, seg, turn, flatBottom, hull, smoothPath, smooth, smoothClip, blob,
  drawSilhouette, silhouetteOf, strokePart, clipPart,
  oval, ovalLine, dot, poly, line, curve, beak, scallop,
  eye, ringEye, colorEye, cheek, smile, shine, INK,
} from './kit.js';

const PI = Math.PI;
const r2 = (v) => Math.round(v * 100) / 100;

// 上から見た いきものの 見えない あしの板（y=±cy）。あしさきは y=±(cy+0.7) に 描くと 板の はしと そろう
const boards = (w, cx, cy) => [
  { points: blob(w, 4, 1.5, 1.5, { cx, cy }) },
  { points: blob(w, 4, 1.5, 1.5, { cx, cy: -cy }) },
];

// ふしの ある あし（さきほど ほそく）。ふちを 先に ぜんぶ 引いてから ぬる
function jointLeg(ctx, list, color, stroke, w) {
  const ws = [w, w * 0.82, w * 0.62, w * 0.5];
  for (let i = 0; i < list.length - 1; i++) line(ctx, [list[i], list[i + 1]], stroke, ws[i] + 1.6);
  for (let i = 0; i < list.length - 1; i++) line(ctx, [list[i], list[i + 1]], color, ws[i]);
}

// ひかる ところ（ちょうちん・はっこうき）: ぼんやり ひろがる ひかり＋まんなかの つぶ
function glow(ctx, x, y, r, color = '255, 248, 170') {
  oval(ctx, x, y, r * 2.6, r * 2.6, `rgba(${color}, 0.22)`);
  oval(ctx, x, y, r * 1.7, r * 1.7, `rgba(${color}, 0.38)`);
  dot(ctx, x, y, r, `rgb(${color})`);
}

// ひれの すじ（つけね→さきへ ならべる）
function rays(ctx, base, tips, color, w = 0.8) {
  for (const t of tips) line(ctx, [base, t], color, w);
}

// しろい ふちの め（くらい いろの からだでも 見えるように）
const darkEye = (ctx, x, y, r) => ringEye(ctx, x, y, r, '#ffffff');

// リュウグウノツカイ・ラブカの なみうつ からだ: まんなかの 線 y(x) に そって ふとさ t(x) の 凸の 四角を つなぐ
function waveBody(xs, y, t) {
  const parts = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    parts.push({ points: pts([[a, r2(y(a) - t(a))], [b, r2(y(b) - t(b))], [b, r2(y(b) + t(b))], [a, r2(y(a) + t(a))]]) });
  }
  return parts;
}
function wavePath(ctx, x0, x1, y, t, off = 0) {
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 2) ctx.lineTo(x, y(x) - t(x) - off);
  for (let x = x1; x >= x0; x -= 2) ctx.lineTo(x, y(x) + t(x) + off);
  ctx.closePath();
}

// ---------- かんたん（ずかんの 人気もの） ----------

const OAR_Y = (x) => 7 * Math.sin((x + 44) * 0.085);
const OAR_T = (x) => 5.4 - ((x + 44) / 92) * 3.6;

// ラブカ（v0.17.36）: ゆるく なみうつ、ふとさの そろった ながい からだ（しっぽの ほうだけ ほそく）
const FRILL_Y = (x) => 3.2 * Math.sin((x + 36) * 0.06);
const FRILL_T = (x) => (x < 18 ? 6.4 - (x + 36) * 0.01 : 5.86 - (x - 18) * 0.105);

export const DEEP_PIECES = {
  // チョウチンアンコウ: まるい くろちゃの からだ・あたまから のびる ひかる ちょうちん・大きな くちに するどい は
  anglerfish: {
    color: '#4a3a36',
    line: '#1e1412',
    pad: 16,
    parts: [
      { points: flatBottom(hull([[-24, -4], [-20, -16], [-6, -21], [10, -19], [20, -10], [24, 0], [20, 10], [8, 15], [-8, 15], [-20, 10], [-27, 6], [-27, 0]]), 14) },
      { points: hull([[21, -3], [33, -12], [37, -4], [37, 4], [33, 11], [21, 4]]) },  // しっぽ
    ],
    draw(ctx, piece) {
      curve(ctx, [[-6, -20], [-12, -32], [-24, -36], [-32, -29]], '#1e1412', 2.6); // ちょうちんの さお
      curve(ctx, [[-6, -20], [-12, -32], [-24, -36], [-32, -29]], '#6a5248', 1.4);
      glow(ctx, -32.6, -26.4, 3.4); // ひかる ちょうちん
      ovalLine(ctx, -32.6, -26.4, 3.2, 3.2, 'rgba(255, 250, 200, 0.6)', '#8a7a40', 1);
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[1], () => rays(ctx, [22, 0], [[36, -9], [37, -4], [37, 2], [36, 8]], '#6a5248', 0.9));
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, 0, 12, 22, 7, '#5e4c46'); // おなか
        for (const [x, y] of [[-4, -14], [6, -12], [14, -6], [-12, -10], [2, -6], [12, 4]]) dot(ctx, x, y, 0.9, '#6a5852');
      });
      // 大きな くち（くちの なかは くらい あか・うえと したに するどい は）
      poly(ctx, [[-27.6, -1], [-12, 3], [-27.6, 9]], '#5a1e22');
      for (let i = 0; i < 4; i++) {
        const x = -26 + i * 3.4;
        poly(ctx, [[x, -0.6 + i * 0.95], [x + 1.4, 3 + i * 0.4], [x + 2.4, -0.3 + i * 0.95]], '#f6f2e8'); // うえの は
        poly(ctx, [[x, 8.6 - i * 1.3], [x + 1.2, 4.6 - i * 0.6], [x + 2.4, 8.2 - i * 1.3]], '#f6f2e8'); // したの は
      }
      line(ctx, [[-27.6, -1], [-12, 3], [-27.6, 9]], '#1e1412', 1.4);
      smooth(ctx, [[2, 3], [9, -3], [13, 1], [12, 7], [5, 8]], '#5e4c46', '#1e1412', 1.1); // むなびれ（うちわ形）
      rays(ctx, [3, 4], [[10, -1], [12, 3], [10, 6.4]], '#3e302c', 0.7);
      darkEye(ctx, -14, -9, 2.3);
      cheek(ctx, -9, -4, 2.2, 1.4);
      shine(ctx, -2, -15, 7, 2.4, -0.3);
    },
  },

  // ダイオウイカ: ふとく ながい どう（さきに ひしがたの ひれ）・いちばん 大きな め・8本の ふとい うでと とても ながい 2本の しょくわん
  // （v0.17.35: もっと 大きく。当たり判定を はば100 いっぱいに し、しょくわんは 絵だけ そとまで のばす）
  giantSquid: {
    color: '#d8643c',
    line: '#7a2a14',
    pad: 20,
    parts: [
      { points: hull([[0, -12.6], [16, -13.6], [32, -12], [38, -17], [50, -5], [52, 0], [50, 5], [38, 17], [32, 12], [16, 13.6], [0, 12.6]]) }, // どうと ひれ
      { points: ellipse(9.6, 12, { cx: -4, n: 18 }) },                                  // あたま
      { points: flatBottom(hull([[-10, -9], [-26, -10.6], [-42, -8], [-48, -3], [-48, 4], [-42, 9], [-26, 12], [-10, 11]]), 13) }, // うで
    ],
    draw(ctx, piece) {
      for (const dy of [-1, 1]) { // とても ながい しょくわん（さきの ふくらみに きゅうばん）
        const t = [[-38, dy * 2], [-50, dy * 9], [-58, dy * 4], [-64, dy * 9]];
        curve(ctx, t, '#7a2a14', 3.8);
        curve(ctx, t, '#e47e56', 2.2);
        ovalLine(ctx, -64, dy * 9, 3.6, 2.2, '#e47e56', '#7a2a14', 1.2, dy * 0.4);
        for (const dx of [-1.6, 0, 1.6]) dot(ctx, -64 + dx, dy * 9 + dy * 0.6, 0.6, '#f8d0b8');
      }
      const arms = [];
      for (let i = 0; i < 8; i++) { // 8本の ふとい うで
        const y0 = -7.6 + i * 2.3;
        const y1 = -7 + i * 2.4 + (i % 2 ? 1.6 : -1.6);
        arms.push([[-6, y0], [-24, y0 + (i % 2 ? 1.4 : -1.4)], [-38, y1 - (i % 2 ? 1.4 : -1.4)], [-48 + (i % 3) * 1.4, y1]]);
      }
      for (const a of arms) curve(ctx, a, '#7a2a14', 4.6);
      for (const a of arms) curve(ctx, a, '#dc6a42', 2.8);
      for (let x = -44; x < -10; x += 3.4) dot(ctx, x, 11 - (x + 44) * 0.03, 1, '#f8d0b8'); // きゅうばん
      const mantle = [[0, -12.6], [16, -13.6], [32, -12], [38, -17], [50, -5], [52, 0], [50, 5], [38, 17], [32, 12], [16, 13.6], [0, 12.6]];
      beak(ctx, mantle, '#d8643c', '#7a2a14', 3);
      ctx.save();
      ctx.beginPath();
      mantle.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.clip();
      oval(ctx, 22, -11, 30, 5, '#b84a28');                                              // せなかの こい いろ
      poly(ctx, [[32, -13], [38, -17], [50, -5], [52, 0], [50, 5], [38, 17], [32, 13]], '#e47a50'); // ひしがたの ひれ
      line(ctx, [[32, -12], [46, 0], [32, 12]], '#b84a28', 1.2);
      for (const [x, y, r] of [[6, -6, 1.8], [12, 4, 1.4], [18, -8, 2], [24, 5, 1.6], [8, 8, 1.2], [28, -3, 1.4], [16, -1, 1.2], [40, -6, 1.4], [42, 5, 1.2]]) {
        dot(ctx, x, y, r, '#b84a28'); // しきその てん
      }
      oval(ctx, 18, 10, 18, 3.4, '#ee9a74');
      ctx.restore();
      silhouetteOf(ctx, piece, [1]);
      clipPart(ctx, piece.parts[1], () => oval(ctx, -4, 8, 9, 4, '#e47e56'));
      ovalLine(ctx, -4, -1.4, 7.2, 7, '#ffffff', '#7a2a14', 1.6); // いちばん 大きな め
      dot(ctx, -4.8, -1.4, 4.8, INK);
      dot(ctx, -6.6, -3.4, 1.8, '#ffffff');
      dot(ctx, -3, 0.6, 0.8, '#ffffff');
      cheek(ctx, 3, 6.4, 2.6, 1.5);
      shine(ctx, 18, -8, 12, 2.2, -0.04);
    },
  },

  // メンダコ: おもちの ように ふっくらした かさ・くまの みみの ような まるい ひれ・うるうるの 大きな め・ほっぺ・にっこり
  // （v0.17.35 で もっと かわいく）
  flapjackOctopus: {
    color: '#f47c52',
    line: '#a8402a',
    parts: [
      { points: flatBottom(hull([[-27, 8], [-26, -1], [-20, -10], [-10, -15.6], [0, -17], [10, -15.6], [20, -10], [26, -1], [27, 8], [22, 11], [-22, 11]]), 10.6) }, // かさ
      { points: turn(ellipse(6, 4.6, { cx: -13, cy: -16, n: 14 }), -0.75, -13, -16) },   // みみの ひれ
      { points: turn(ellipse(6, 4.6, { cx: 13, cy: -16, n: 14 }), 0.75, 13, -16) },
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, { ...piece, parts: [piece.parts[1], piece.parts[2], piece.parts[0]] });
      for (const i of [1, 2]) clipPart(ctx, piece.parts[i], () => oval(ctx, (i === 1 ? -1 : 1) * 13, -15, 3.4, 2.4, '#ff9a72')); // みみの うちがわ
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, 0, -12, 22, 8, '#e8673e');                                       // あたまの こい いろ
        oval(ctx, 0, 2, 20, 9, '#ff9a72');                                         // かおの 明るい ところ
        for (let x = -24; x <= 24; x += 6) ovalLine(ctx, x, 11, 3.6, 2.6, '#f06c46', '#a8402a', 1); // うでの さき（ふちの まくから のぞく）
        for (const [x, y, r] of [[-14, -8, 1.3], [-6, -12, 1], [7, -12, 1.2], [15, -7, 1], [-19, -2, 0.9], [19, -1, 1.1]]) dot(ctx, x, y, r, '#ffb08c');
      });
      for (const s of [-1, 1]) { // うるうるの 大きな め
        dot(ctx, s * 8.4, -2.6, 3.4, INK);
        dot(ctx, s * 8.4 - 1.2, -3.9, 1.3, '#ffffff');
        dot(ctx, s * 8.4 + 1.1, -1.5, 0.6, '#ffffff');
        cheek(ctx, s * 14.6, 2.4, 3.2, 2);
      }
      ctx.beginPath(); // にっこり くち（ω）
      ctx.arc(-1.4, 2.6, 1.4, 0.1 * PI, 0.95 * PI);
      ctx.arc(1.4, 2.6, 1.4, 0.05 * PI, 0.9 * PI);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      ctx.stroke();
      shine(ctx, -8, -12, 6, 2.2, -0.35);
      dot(ctx, 4, -14, 1, 'rgba(255, 255, 255, 0.8)');
    },
  },

  // ダイオウグソクムシ（よこから見た すがた。v0.17.37）: ドームの ように もりあがる かたい せなか（まえの いたが うしろに のり、
  // 下の ふちは うしろむきに とがる）・あたまの よこの 大きな くろい め・まえへ のびる しょっかく・おなかの 下の 7つい の あし・
  // うしろへ さがる まるい たての しっぽ（ふちに とげ）。いろは ふかく こい むらさきがかった ちゃいろ
  giantIsopod: (() => {
    const top = (x) => -20 * Math.sqrt(Math.max(0, 1 - ((x - 2) / 41) ** 2)); // せなかの 高さ
    const BASE = '#7a6670';
    const SHADE = '#5a4852';
    const LINE = '#2a1e24';
    const LEG = '#a8949c';
    const plate = (ctx, x0, x1) => { // せなかの いた 1まい（下の ふちは うしろむきに とがる）
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(x0, top(x0) - 0.4);
        for (let x = x0 + 1; x < x1; x += 1) ctx.lineTo(x, top(x) - 0.6);
        ctx.lineTo(x1, top(x1) - 0.4);
        ctx.quadraticCurveTo(x1 + 2.2, (top(x1) + 3) / 2, x1 + 1.8, 4.6); // うしろの ふち → とがった 下の かど
        ctx.lineTo(x1 - 1, 3);
        ctx.lineTo(x0, 3);
        ctx.closePath();
      };
      path();
      ctx.fillStyle = BASE;
      ctx.fill();
      ctx.save();
      path();
      ctx.clip();
      const w = x1 - x0;
      ctx.beginPath(); // せなかの つや
      for (let x = x0; x <= x1 + 2; x += 1) ctx.lineTo(x, top(x) + 2);
      ctx.strokeStyle = 'rgba(232, 214, 224, 0.4)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      oval(ctx, x1 + 1, (top(x1) + 3) / 2, w * 0.36, 14, SHADE);                     // うしろの ふちの かげ
      oval(ctx, (x0 + x1) / 2, 3, w, 2.6, 'rgba(60, 40, 52, 0.45)');                  // 下の かげ
      for (const k of [0.35, 0.6]) dot(ctx, x0 + w * 0.5, top(x0 + w * 0.5) * k + 1, 0.5, 'rgba(40, 24, 34, 0.4)'); // つぶつぶ
      ctx.restore();
      path();
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.stroke();
    };
    const legAt = [];
    for (let i = 0; i < 7; i++) legAt.push(-26 + i * 6.9);
    return {
      color: BASE,
      line: LINE,
      pad: 18,
      parts: [
        { points: blob(56, 4, 1.5, 1.5, { cx: -2, cy: 10 }) },                            // あしの板
        { points: hull([[-41, -2], [-38, -7], ...[-34, -26, -16, -6, 4, 14, 24, 34].map((x) => [x, r2(top(x))]), [40, -6], [46.4, -1], [46.6, 1.6], [42, 3.6], [-38, 3.6]]) }, // せなか・あたま・しっぽ
      ],
      draw(ctx) {
        for (let i = 0; i < 7; i++) { // むこうがわの あし（くらい いろ）
          const x = legAt[i] + 2.6;
          const d = i < 3 ? -1 : 1;
          line(ctx, [[x, 3], [x + d * 1.6, 7.4], [x + d * 3.4, 10.7]], LINE, 3.2);
          line(ctx, [[x, 3], [x + d * 1.6, 7.4], [x + d * 3.4, 10.7]], '#5e4c56', 1.8);
        }
        // まえへ のびる しょっかく（ながい 2本め と みじかい 1本め）
        const ant = [[-39, -3], [-46, -7.4], [-53, -5.4], [-57, -0.4]];
        curve(ctx, ant, LINE, 2.4);
        curve(ctx, ant, '#9a8690', 1.2);
        for (let t = 0.25; t < 1; t += 0.18) dot(ctx, -39 - 17 * t, -3 - 4 * Math.sin(t * PI) + 2.6 * t, 0.5, LINE);
        curve(ctx, [[-40, -0.6], [-45, 0], [-47.6, 2.4]], LINE, 1.6);
        // しっぽの うちわ（下）
        beak(ctx, [[33, 2], [43, 3], [47, 6.6], [38, 6.4]], '#6a5660', LINE, 1.3);
        for (let t = 0.2; t < 1; t += 0.2) line(ctx, [[43 + 4 * t, 3 + 3.6 * t], [44.4 + 4 * t, 2.6 + 3.6 * t]], LINE, 0.7);
        // まるい たての しっぽ（うしろへ さがる・ふちに とげ）
        const shield = [[27, top(27) - 0.4], [34, top(34)], [40, top(40) + 0.4], [44.6, -2.6], [46.6, 0.6], [44, 3.2], [36, 3.6], [27, 3.4]];
        beak(ctx, shield, BASE, LINE, 1.6);
        ctx.save();
        ctx.beginPath();
        shield.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.clip();
        oval(ctx, 42, 0, 6, 8, SHADE);
        line(ctx, [[28, top(28) + 2.4], [43, -1.4]], 'rgba(232, 214, 224, 0.35)', 1.6);
        ctx.restore();
        for (let k = 0; k < 6; k++) { // ふちの とげ
          const x = 41 + k * 1;
          const y = -4.6 + k * 1.3;
          poly(ctx, [[x - 0.6, y - 0.5], [x + 1.4, y + 0.2], [x - 0.2, y + 0.9]], LINE);
        }
        // おなかの みじかい いた 5まい → せなかの いた 7まい（うしろから まえへ かさねる）
        for (let i = 4; i >= 0; i--) plate(ctx, 17.6 + i * 2, 19.6 + i * 2);
        for (let i = 6; i >= 0; i--) plate(ctx, -30 + i * 6.8, -23.2 + i * 6.8);
        for (let i = 0; i < 7; i++) { // てまえの あし（7本。まえの 3本は まえむき）
          const x = legAt[i];
          const d = i < 3 ? -1 : 1;
          line(ctx, [[x, 2.6], [x + d * 1.4, 7.2], [x + d * 3, 10.7]], LINE, 3.4);
          line(ctx, [[x, 2.6], [x + d * 1.4, 7.2], [x + d * 3, 10.7]], LEG, 2);
        }
        // あたま（まるい まえ・大きな くろい め）
        smooth(ctx, [[-29.4, top(-29.4) - 0.4], [-35, -9], [-40.6, -4.4], [-41, 0.6], [-37, 3.6], [-30, 3.4], [-28.6, -4]], BASE, LINE, 1.6);
        oval(ctx, -36, 1.6, 4, 1.6, 'rgba(60, 40, 52, 0.45)');
        ovalLine(ctx, -33.4, -5.6, 3.8, 3.1, '#221a20', '#120c10', 1.1, -0.3); // 大きな くろい め
        oval(ctx, -32.6, -4.6, 2.4, 1.6, 'rgba(150, 120, 170, 0.45)', -0.3);
        dot(ctx, -34.6, -6.8, 1.1, '#ffffff');
        dot(ctx, -32.4, -4.6, 0.5, '#ffffff');
        line(ctx, [[-40, 2.6], [-38, 4.6]], LINE, 1.2); // くち
        cheek(ctx, -37.6, -0.6, 1.6, 1);
      },
    };
  })(),

  // タカアシガニ（まえから見た すがた）: ちいさな こうらから とても ながい あしを ひろげる・オレンジに しろい てん
  spiderCrab: (() => {
    const legs = [];
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const a = [s * (9 - i * 0.6), -12 + i * 4];
        const k = [s * (20 + i * 7), -24 + i * 3];
        const tip = [s * (27 + i * 5.6), 22];
        legs.push([a, k, tip]);
      }
    }
    const claws = [[-1, 1], [1, 1]].map(([s]) => [[s * 6, 2], [s * 9, 12]]);
    return {
      color: '#e87a4a',
      line: '#8a3418',
      parts: [
        { points: hull([[-12, -4], [-10, -14], [-4, -19], [4, -19], [10, -14], [12, -4], [8, 4], [0, 6], [-8, 4]]) }, // こうら
        ...legs.flatMap(([a, k, tip]) => [{ points: seg(a[0], a[1], k[0], k[1], 3) }, { points: seg(k[0], k[1], tip[0], tip[1], 2.4) }]),
        ...claws.map(([a, b]) => ({ points: seg(a[0], a[1], b[0], b[1], 3.4) })),
      ],
      draw(ctx, piece) {
        for (const [a, k, tip] of legs) { // ながい あし（しろい おび）
          jointLeg(ctx, [a, k, [tip[0], tip[1] - 0.6]], '#e87a4a', '#8a3418', 2.8);
          for (const t of [0.35, 0.7]) dot(ctx, a[0] + (k[0] - a[0]) * t, a[1] + (k[1] - a[1]) * t, 0.9, '#fbe2d0');
          for (const t of [0.3, 0.6]) dot(ctx, k[0] + (tip[0] - k[0]) * t, k[1] + (tip[1] - k[1]) * t, 0.8, '#fbe2d0');
        }
        for (const [a, b] of claws) { // みじかい はさみ
          jointLeg(ctx, [a, b], '#e87a4a', '#8a3418', 3.2);
          ovalLine(ctx, b[0], b[1] + 1, 2.4, 2.8, '#e87a4a', '#8a3418', 1.2);
        }
        drawSilhouette(ctx, { ...piece, parts: [piece.parts[0]] });
        clipPart(ctx, piece.parts[0], () => {
          for (const [x, y, r] of [[-6, -12, 1.4], [5, -13, 1.2], [-8, -4, 1.2], [7, -5, 1.4], [0, -8, 1], [-2, 0, 1], [3, 1, 0.9]]) dot(ctx, x, y, r, '#fbe2d0');
        });
        for (const s of [-1, 1]) {
          line(ctx, [[s * 2.6, -18.6], [s * 5, -24.6]], '#8a3418', 1.8); // おでこの とげ
          line(ctx, [[s * 4.4, -15], [s * 6.4, -18]], '#8a3418', 1.4);
          darkEye(ctx, s * 6.8, -18.4, 1.5);
          cheek(ctx, s * 6, -9, 1.8, 1.2);
        }
        smile(ctx, 0, -7.4, 2);
        shine(ctx, -4, -14, 4, 1.6, -0.4);
      },
    };
  })(),

  // シーラカンス: あおい からだに しろい まだら・あしの ような にくの ある ひれ・まんなかに ちいさな ひれの ある 3つの しっぽ
  coelacanth: {
    color: '#3c5c8c',
    line: '#16263e',
    parts: [
      { points: hull([[-46, -1], [-44, -8], [-36, -14], [-22, -17], [-6, -17], [8, -14], [20, -9], [28, -5], [30, -3], [30, 3], [28, 5], [20, 9], [8, 13], [-8, 15], [-26, 14], [-38, 10], [-45, 5]]) },
      { points: hull([[-10, 12], [-2, 13], [2, 20], [-4, 21], [-8, 18]]) },               // はらびれ（にくの ある ひれ）
      { points: hull([[10, 10], [18, 8], [22, 15], [17, 17], [12, 15]]) },                // しりびれ
      { points: hull([[10, -12], [18, -9], [22, -16], [16, -19], [12, -16]]) },           // だい2せびれ
      { points: hull([[-12, -16], [-2, -17], [2, -27], [-8, -28]]) },                    // だい1せびれ
      { points: hull([[28, -4], [44, -16], [46, -6], [52, 0], [46, 6], [44, 16], [28, 4]]) }, // 3つの しっぽ
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      // ひれは にくの ある つけね（からだの色）＋ ひかる すじの ふち
      clipPart(ctx, piece.parts[4], () => rays(ctx, [-6, -16], [[-6, -28], [-2, -27], [1, -24], [-9, -27]], '#8ab0dc', 1));
      for (const i of [1, 2, 3]) clipPart(ctx, piece.parts[i], () => oval(ctx, ...[[-1, 19, 5, 3], [18, 15.4, 5, 2.6], [18, -17, 5, 2.6]][i - 1], '#6a90c4'));
      clipPart(ctx, piece.parts[5], () => {
        poly(ctx, [[46, -2], [52, 0], [46, 2], [36, 1.2], [36, -1.2]], '#6a90c4'); // まんなかの ちいさな しっぽ
        rays(ctx, [30, 0], [[44, -14], [45, -8], [45, 8], [44, 14]], '#8ab0dc', 0.9);
      });
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, -6, 13, 40, 5, '#4e72a6');
        for (let x = -34; x < 26; x += 6) for (let y = -12; y < 12; y += 6) scallop(ctx, x + (y % 12 ? 3 : 0), y, 2.6, '#304c78', 0.8); // うろこ
        for (const [x, y, r] of [[-28, -6, 2], [-16, -10, 1.6], [-8, 2, 2.2], [2, -8, 1.8], [10, 4, 1.6], [18, -3, 1.4], [-20, 6, 1.4], [6, 10, 1.2]]) {
          oval(ctx, x, y, r * 1.4, r, '#e8f0f8'); // しろい まだら
        }
        curve(ctx, [[-32, -12], [-29, 0], [-32, 10]], '#16263e', 1.2); // えらぶた
      });
      beak(ctx, [[-26, 4], [-20, 2], [-16, 10], [-20, 12]], '#4e72a6', '#16263e', 1.2); // むなびれ
      rays(ctx, [-24, 5], [[-17, 9], [-18, 11]], '#8ab0dc', 0.8);
      colorEye(ctx, -38, -4, 3.2, '#c8d88a');
      line(ctx, [[-46, 1], [-40, 3]], '#16263e', 1.2);
      cheek(ctx, -36, 3, 2.2, 1.4);
      shine(ctx, -14, -12, 9, 2, -0.08);
    },
  },

  // リュウグウノツカイ（しんかい版）: なみうつ ぎんいろの ながい リボン・せなか いっぱいの あかい ひれ・あたまの あかい かざり
  oarfish: {
    color: '#e6ecf4',
    line: '#7a8aa8',
    pad: 22,
    parts: [
      ...waveBody([-44, -30, -14, 2, 18, 34, 48], OAR_Y, OAR_T),
      { points: ellipse(7, 6.6, { cx: -44, cy: OAR_Y(-44), n: 16 }) },                   // あたま
    ],
    draw(ctx, piece) {
      // せなかの あかい ひれ（からだの なみに そって ずっと つづく）
      ctx.beginPath();
      for (let x = -40; x <= 48; x += 2) ctx.lineTo(x, OAR_Y(x) - OAR_T(x) - 4.4 + ((x / 2) % 2 ? 0.7 : -0.7));
      for (let x = 48; x >= -40; x -= 2) ctx.lineTo(x, OAR_Y(x) - OAR_T(x) + 1);
      ctx.closePath();
      ctx.fillStyle = '#ff6474';
      ctx.fill();
      for (let x = -38; x <= 46; x += 4) line(ctx, [[x, OAR_Y(x) - OAR_T(x) + 0.6], [x + 1, OAR_Y(x) - OAR_T(x) - 4]], '#e0404f', 0.8);
      for (const [cx, cy, ex, ey, w] of [[-40, -24, -24, -28, 2.6], [-34, -22, -14, -24, 2.2], [-44, -22, -34, -30, 2.4], [-30, -18, -4, -18, 2]]) {
        ctx.beginPath(); // あたまの あかい かざり（うしろへ なびく）
        ctx.moveTo(-42, -4);
        ctx.quadraticCurveTo(cx, cy, ex, ey);
        ctx.strokeStyle = '#ff5a6a';
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      curve(ctx, [[-40, 4], [-34, 9], [-26, 9.4]], '#ff5a6a', 1.6); // はらびれの ながい すじ
      ovalLine(ctx, -25, 9.4, 1.8, 1.2, '#ff7a86', '#e0404f', 0.8);
      // からだ（なみうつ ぎんいろ）
      wavePath(ctx, -44, 48, OAR_Y, OAR_T);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#7a8aa8';
      ctx.lineWidth = 3;
      ctx.stroke();
      silhouetteOf(ctx, piece, [6]);
      wavePath(ctx, -44, 48, OAR_Y, OAR_T);
      ctx.fillStyle = '#e6ecf4';
      ctx.fill();
      ctx.save();
      wavePath(ctx, -44, 48, OAR_Y, OAR_T);
      ctx.clip();
      for (let x = -36; x < 46; x += 5) {
        line(ctx, [[x, OAR_Y(x) - OAR_T(x) * 0.5], [x + 2, OAR_Y(x + 2) + OAR_T(x) * 0.4]], '#b4c3d8', 0.9); // うすい しま
      }
      ctx.beginPath();
      for (let x = -44; x <= 48; x += 2) ctx.lineTo(x, OAR_Y(x) - OAR_T(x) * 0.4);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
      darkEye(ctx, -45.4, OAR_Y(-44) - 1.4, 2.4);
      cheek(ctx, -41, OAR_Y(-44) + 2.6, 2, 1.2);
      smile(ctx, -49, OAR_Y(-44) + 2, 1.4);
    },
  },

  // オウムガイ: まきまきの からに あかちゃいろの しま・こげちゃの ずきん・たくさんの しょくしゅ
  nautilus: {
    color: '#f2e6d0',
    line: '#7a4a2a',
    pad: 10,
    parts: [
      { points: flatBottom(ellipse(20, 20, { cx: 6, cy: -4, n: 28 }), 14) },           // まきまきの から
      { points: flatBottom(hull([[-12, -10], [-20, -12], [-28, -6], [-32, 2], [-30, 10], [-20, 14.6], [-10, 12]]), 14) }, // ずきんと しょくしゅ
    ],
    draw(ctx, piece) {
      for (let i = 0; i < 9; i++) { // たくさんの しょくしゅ
        const y = -3 + i * 1.9;
        curve(ctx, [[-22, y], [-30, y - 1 + (i % 2) * 2], [-36, y + 1.4]], '#a8784a', 2.2);
        curve(ctx, [[-22, y], [-30, y - 1 + (i % 2) * 2], [-36, y + 1.4]], '#e8c89a', 1.1);
      }
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        for (let k = 0; k < 7; k++) { // あかちゃいろの ほのおの しま（からの うしろ はんぶん）
          const a = -PI * 0.5 + k * 0.3;
          const x0 = 6 + Math.cos(a) * 8;
          const y0 = -4 + Math.sin(a) * 8;
          curve(ctx, [[x0, y0], [6 + Math.cos(a + 0.15) * 15, -4 + Math.sin(a + 0.15) * 15], [6 + Math.cos(a) * 22, -4 + Math.sin(a) * 22]], '#b0522a', 3);
        }
        oval(ctx, 10, -4, 9, 9, 'rgba(242, 230, 208, 0.55)');
        curve(ctx, [[-6, -12], [2, -20], [14, -18], [18, -8], [14, 2], [6, 4], [0, 0]], '#7a4a2a', 1.2); // まきの すじ
        dot(ctx, 8, -4, 2.4, '#5a3a24');
      });
      clipPart(ctx, piece.parts[1], () => {
        poly(ctx, [[-34, -14], [-8, -14], [-10, -1], [-22, 0], [-34, -4]], '#8a5232'); // こげちゃの ずきん
        for (const [x, y] of [[-24, -8], [-18, -10], [-14, -6], [-26, -4], [-20, -4]]) dot(ctx, x, y, 0.9, '#a8704a');
        oval(ctx, -20, 8, 10, 6, '#e8d4b4');
      });
      darkEye(ctx, -16, 4, 2);
      cheek(ctx, -21, 9, 2, 1.2);
      shine(ctx, 0, -16, 7, 2.4, -0.5);
    },
  },
  // ---------- ふつう ----------

  // ヨコヅナイワシ: 2016年に みつかった 大きな しんかいぎょ・こい あおぐろの からだ・大きな あたまと め・うしろに よった せびれ
  giantSlickhead: {
    color: '#2a3650',
    line: '#0e1424',
    parts: [
      { points: flatBottom(hull([[-46, 0], [-44, -8], [-36, -15], [-22, -19], [-6, -19], [10, -16], [22, -11], [30, -6], [32, -4], [32, 4], [30, 6], [22, 10], [8, 14], [-10, 16], [-28, 15], [-40, 10], [-46, 4]]), 14) },
      { points: hull([[30, -4], [44, -15], [48, -13], [42, 0], [48, 13], [44, 14], [30, 4]]) },  // ふたまたの しっぽ
      { points: hull([[12, -15], [22, -11], [24, -20], [16, -22]]) },                    // うしろに よった せびれ
      { points: hull([[14, 12], [24, 9], [26, 14], [18, 14]]) },                         // しりびれ
    ],
    draw(ctx, piece) {
      // ふたまたの しっぽ（当たり判定は きれこみを うめた 形。絵は きれこみを 描く）
      beak(ctx, [[30, -4], [44, -15], [48, -13], [42, 0], [48, 13], [44, 14], [30, 4]], '#2a3650', '#0e1424', 3);
      beak(ctx, [[30, -4], [44, -15], [48, -13], [42, 0], [48, 13], [44, 14], [30, 4]], '#2a3650', '#2a3650', 0.1);
      rays(ctx, [32, 0], [[45, -12], [43, -6], [43, 6], [45, 12]], '#4a5670', 0.8);
      drawSilhouette(ctx, { ...piece, parts: [piece.parts[0], piece.parts[2], piece.parts[3]] });
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, -6, 13, 40, 6, '#3a4866');
        for (let x = -30; x < 28; x += 6.4) for (let y = -14; y < 12; y += 6) scallop(ctx, x + (y % 12 ? 3.2 : 0), y, 3, '#1a2238', 0.9); // 大きな うろこ
        line(ctx, [[-30, -4], [30, -3]], '#5a6a8a', 0.9);
        curve(ctx, [[-28, -14], [-25, 0], [-28, 12]], '#0e1424', 1.4); // えらぶた
      });
      line(ctx, [[-46, 2], [-34, 6]], '#0e1424', 1.4); // 大きな くち
      colorEye(ctx, -36, -5, 4.8, '#a8c0e0'); // 大きな め
      cheek(ctx, -33, 5, 2.4, 1.4);
      shine(ctx, -14, -14, 10, 2.2, -0.08);
    },
  },

  // デメニギス: あたまの 上が すきとおった ドーム・中に みどりの つつの め（上を 見る）・まえの 2つの あなが かおに 見える
  barreleye: {
    color: '#4a4038',
    line: '#1e1814',
    parts: [
      { points: flatBottom(hull([[-30, 2], [-26, -4], [-14, -7], [4, -7], [18, -5], [26, -2], [28, 0], [26, 3], [16, 7], [0, 9], [-18, 9], [-28, 6]]), 8) },
      { points: ellipse(13, 9.4, { cx: -15, cy: -9, n: 22 }) },                          // すきとおった ドーム
      { points: hull([[26, -2], [38, -9], [40, 0], [38, 9], [26, 3]]) },                 // しっぽ
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, { ...piece, parts: [piece.parts[0], piece.parts[2]] });
      clipPart(ctx, piece.parts[0], () => {
        for (let x = -18; x < 24; x += 5.4) for (let y = -4; y < 8; y += 5) scallop(ctx, x + (y % 10 ? 2.7 : 0), y, 2.4, '#2e2620', 0.8);
        oval(ctx, -4, 7, 26, 3, '#5a4e44');
      });
      clipPart(ctx, piece.parts[2], () => rays(ctx, [27, 0], [[37, -7], [39, -2], [39, 3], [37, 7]], '#6a5a4e', 0.8));
      // ドームの 中: みどりの つつの め（上を 見る）
      for (const [x, c] of [[-11, '#3aa04a'], [-16, '#5ad86a']]) {
        ctx.beginPath();
        ctx.moveTo(x - 2.6, -4);
        ctx.lineTo(x - 2.6, -12);
        ctx.arc(x, -12, 2.6, PI, 0);
        ctx.lineTo(x + 2.6, -4);
        ctx.closePath();
        ctx.fillStyle = c;
        ctx.fill();
        ctx.strokeStyle = '#1e5a26';
        ctx.lineWidth = 1;
        ctx.stroke();
        dot(ctx, x, -12.6, 1.6, '#c8ffb8');
      }
      ovalLine(ctx, -15, -9, 13, 9.4, 'rgba(200, 236, 242, 0.32)', '#6aa0a8', 1.3); // すきとおった ドーム
      curve(ctx, [[-24, -12], [-19, -16.6], [-12, -17.4]], 'rgba(255, 255, 255, 0.85)', 1.4);
      for (const dy of [-1, 1]) { // かおに 見える まえの 2つの あな
        dot(ctx, -25.4, -1 + dy * 2.2, 1.2, INK);
        dot(ctx, -25.8, -1.4 + dy * 2.2, 0.45, '#ffffff');
      }
      cheek(ctx, -22, 3.4, 1.8, 1.1);
      smooth(ctx, [[-6, 2], [4, -1], [10, 2], [8, 7], [-2, 6]], 'rgba(140, 120, 104, 0.8)', '#1e1814', 1); // むなびれ
    },
  },

  // ミツクリザメ: ももいろ・ひらたく ながい はな（ブレード）・とび出す あごに はりの ような は・ながい しっぽ
  goblinShark: {
    color: '#e8a8a8',
    line: '#9a5058',
    parts: [
      { points: flatBottom(hull([[-30, -2], [-24, -8], [-10, -11], [8, -10], [22, -6], [30, -3], [30, 3], [22, 6], [8, 9], [-10, 10], [-24, 8], [-30, 4]]), 9) },
      { points: hull([[-28, -7], [-48.6, -6], [-50.6, -4], [-48.6, -2], [-28, 0]]) },   // ひらたい はな
      { points: hull([[-30, 2], [-40, 4], [-44, 8], [-40, 10.4], [-30, 8]]) },          // とび出す あご
      { points: hull([[28, -3], [46, -15], [48.6, -12], [39, 0], [35, 6], [28, 4]]) },  // ながい しっぽ
      { points: hull([[-6, -10], [6, -10], [2, -18]]) },                                 // せびれ
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, -2, 9, 34, 5, '#f4c8c4');
        for (let i = 0; i < 5; i++) curve(ctx, [[-22 + i * 2.2, -5], [-21 + i * 2.2, 0], [-22 + i * 2.2, 4]], '#c07078', 0.9); // えら
      });
      clipPart(ctx, piece.parts[1], () => line(ctx, [[-30, -4.4], [-48.6, -4]], '#f4c8c4', 1));
      clipPart(ctx, piece.parts[2], () => oval(ctx, -38, 6.4, 8, 2.4, '#7a2e38'));
      for (let i = 0; i < 6; i++) line(ctx, [[-31 - i * 2, 4.6 + i * 0.4], [-31.6 - i * 2, 7 + i * 0.4]], '#ffffff', 0.8); // はりの ような は
      darkEye(ctx, -26, -4, 1.6);
      cheek(ctx, -22, 2, 1.8, 1.1);
      smooth(ctx, [[-6, 4], [4, 4], [8, 10], [0, 9]], '#dc9898', '#9a5058', 1.1); // むなびれ
      shine(ctx, -6, -7, 8, 1.6, -0.08);
    },
  },

  // ラブカ（v0.17.36 で リアルに 作りなおし）: こい ちゃいろの うなぎの ような サメ・ひらたい あたまの いちばん まえで 大きく あけた くち
  // （うえと したの あごに 3つに わかれた しろい はが ならぶ）・ひだの ある 6つの えら・うしろに よった ひれ・ながい さんかくの しっぽ
  frilledShark: (() => {
    const hy = FRILL_Y(-36);
    const head = [[-34, hy - 6.4], [-40, -6.6], [-45, -5.8], [-48.6, -3.8], [-50, -1.4], [-49, -0.2], [-44, 1.2], [-37.4, 2.6],
      [-44, 4.6], [-48.4, 6.2], [-49, 7.6], [-45, 9.6], [-40, 8.6], [-34, hy + 6.6]];
    const tail = (x) => FRILL_Y(x);
    return {
      color: '#5a4434',
      line: '#24170f',
      pad: 10,
      parts: [
        ...waveBody([-36, -22, -6, 10, 26, 40, 49.4], FRILL_Y, FRILL_T),
        { points: hull(head) },                                                          // あたま（くちを あけた 形を つつむ）
      ],
      draw(ctx) {
        const fin = (pts2, fill) => smooth(ctx, pts2, fill, '#24170f', 1.3);
        const yb = (x, d = 0) => FRILL_Y(x) + FRILL_T(x) + d;
        const yt = (x, d = 0) => FRILL_Y(x) - FRILL_T(x) - d;
        fin([[24, yb(24, -1)], [33, yb(33, -1)], [36, yb(36, 5.6)], [27, yb(27, 6.4)]], '#4e3a2c');   // しりびれ
        fin([[26, yt(26, -1)], [33, yt(33, -1)], [35, yt(35, 5)], [29, yt(29, 5.4)]], '#4e3a2c');     // せびれ
        fin([[8, yb(8, -1)], [16, yb(16, -0.6)], [20, yb(20, 6)], [11, yb(11, 7)], [7, yb(7, 3)]], '#4e3a2c'); // はらびれ
        beak(ctx, [[38, yt(38)], [50, tail(50) - 4.6], [49.4, tail(49) + 1.8], [44, yb(44, 1.4)], [38, yb(38)]], '#4e3a2c', '#24170f', 1.5); // ながい さんかくの しっぽ
        // からだ（せなかは こく、おなかは 明るく）
        wavePath(ctx, -36, 49.4, FRILL_Y, FRILL_T);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#24170f';
        ctx.lineWidth = 3;
        ctx.stroke();
        wavePath(ctx, -36, 49.4, FRILL_Y, FRILL_T);
        ctx.fillStyle = '#5a4434';
        ctx.fill();
        ctx.save();
        wavePath(ctx, -36, 49.4, FRILL_Y, FRILL_T);
        ctx.clip();
        ctx.beginPath();
        for (let x = -36; x <= 50; x += 2) ctx.lineTo(x, FRILL_Y(x) + FRILL_T(x) * 0.3);
        for (let x = 50; x >= -36; x -= 2) ctx.lineTo(x, yb(x, 2));
        ctx.closePath();
        ctx.fillStyle = '#86685a';
        ctx.fill();
        ctx.beginPath();
        for (let x = -36; x <= 50; x += 2) ctx.lineTo(x, yt(x, 2));
        for (let x = 50; x >= -36; x -= 2) ctx.lineTo(x, FRILL_Y(x) - FRILL_T(x) * 0.4);
        ctx.closePath();
        ctx.fillStyle = '#46342a';
        ctx.fill();
        ctx.beginPath(); // せなかの つや
        for (let x = -30; x <= 44; x += 2) ctx.lineTo(x, FRILL_Y(x) - FRILL_T(x) * 0.62);
        ctx.strokeStyle = 'rgba(200, 170, 150, 0.2)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
        // くちの なか（くらい あか）
        poly(ctx, [[-50, -0.8], [-36.6, 2.6], [-49, 7]], '#3a1014');
        poly(ctx, [[-44, 1.6], [-37, 2.6], [-44, 4]], '#6a2228');
        // あたま（くちを 大きく あける）
        beak(ctx, head, '#5a4434', '#24170f', 2.6);
        poly(ctx, [[-34, 2], [-40, 3.4], [-44.6, 6], [-48, 7.4], [-45, 9.2], [-40, 8.2], [-34, 6]], '#86685a'); // あごの 下の 明るい いろ
        poly(ctx, [[-34, -6], [-40, -6.2], [-45, -5.4], [-47, -4], [-40, -4.2], [-34, -3]], '#46342a');          // あたまの 上の こい いろ
        // 3つに わかれた しろい は（うえの あごと したの あご）
        const trident = (x, y, dir) => {
          for (const [dx, len] of [[-0.5, 0.9], [0, 1.6], [0.5, 0.9]]) line(ctx, [[x + dx * 0.6, y], [x + dx, y + dir * len]], '#f8f4ec', 0.55);
        };
        for (let i = 0; i < 6; i++) trident(-48.4 + i * 1.7, -0.2 + i * 0.42, 1);   // うえの は
        for (let i = 0; i < 6; i++) trident(-47.8 + i * 1.6, 6 - i * 0.5, -1);      // したの は
        line(ctx, [[-50, -1.4], [-49, -0.2], [-44, 1.2], [-37.4, 2.6], [-44, 4.6], [-48.4, 6.2], [-49, 7.6]], '#24170f', 1.2);
        dot(ctx, -48.2, -3.4, 0.6, '#24170f'); // はなの あな
        // ひだの ある 6つの えら（さいしょの えらは のどを まわる）
        for (let i = 5; i >= 0; i--) {
          const x = -31 + i * 2.9;
          const y = FRILL_Y(x);
          const tt = FRILL_T(x) + 0.4;
          const frill = [[x, y - tt * 0.92], [x + 1.6, y - tt * 0.6], [x + 2.6, y - tt * 0.2], [x + 2.8, y + tt * 0.25], [x + 2, y + tt * 0.7], [x - 0.6, y + tt],
            [x + 0.4, y + tt * 0.4], [x + 0.8, y], [x + 0.6, y - tt * 0.4]];
          smooth(ctx, frill, i === 0 ? '#e0aa98' : '#d29a88', '#3a2418', 0.7);
          for (const k of [-0.5, -0.15, 0.2, 0.55]) dot(ctx, x + 2.1, y + tt * k, 0.45, '#9a5a4a'); // ひだの なみ
          line(ctx, [[x + 0.2, y - tt * 0.9], [x + 0.6, y], [x - 0.4, y + tt * 0.96]], '#1a100a', 0.9); // えらあな
        }
        fin([[-14, FRILL_Y(-14) + 2], [-8, FRILL_Y(-8) + 4], [-5, FRILL_Y(-5) + 9], [-11, FRILL_Y(-11) + 9], [-15, FRILL_Y(-15) + 5]], '#4e3a2c'); // むなびれ
        ovalLine(ctx, -42.6, -2.8, 2.8, 2.2, '#5ab890', '#24170f', 1); // みどりの 大きな め
        oval(ctx, -42.4, -2.8, 1.5, 1.1, INK);
        dot(ctx, -43.4, -3.5, 0.6, '#ffffff');
      },
    };
  })(),

  // メガマウス: まるい 大きな あたまに よこに とても ひろい くち（うわくちびるが しろく ひかる）・ちいさな め
  megamouth: {
    color: '#5a5a62',
    line: '#22222a',
    parts: [
      { points: flatBottom(hull([[-46, 0], [-44, -10], [-36, -17], [-22, -19], [-4, -17], [14, -12], [28, -6], [34, -3], [34, 3], [28, 6], [14, 10], [-4, 14], [-22, 16], [-36, 15], [-44, 9]]), 14) },
      { points: hull([[32, -3], [48, -18], [51, -15], [42, 0], [46, 10], [32, 4]]) },   // しっぽ
      { points: hull([[-6, -17], [8, -14], [2, -26]]) },                                 // せびれ
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, -8, 14, 40, 7, '#7a7a84');
        for (let i = 0; i < 5; i++) curve(ctx, [[-20 + i * 2.4, -8], [-19 + i * 2.4, 0], [-20 + i * 2.4, 7]], '#3a3a44', 1); // えら
      });
      // よこに ひろい 大きな くち（メガマウスの しるし）
      ctx.beginPath();
      ctx.moveTo(-46.6, 1);
      ctx.quadraticCurveTo(-36, 7, -25, 3.4);
      ctx.quadraticCurveTo(-36, 12, -45, 6.6);
      ctx.closePath();
      ctx.fillStyle = '#3a1e24';
      ctx.fill();
      curve(ctx, [[-46.6, 0.6], [-36, 6.2], [-25, 3]], '#e8eef4', 2.4); // しろく ひかる うわくちびる
      curve(ctx, [[-45, 6.6], [-36, 11.6], [-25, 3.4]], '#22222a', 1.4);
      for (let x = -43; x < -28; x += 2.6) dot(ctx, x, 6.6 + (x + 36) * 0.06 + (x < -36 ? 0.6 : 0), 0.5, '#e8eef4');
      darkEye(ctx, -36, -6.4, 1.8);
      cheek(ctx, -30, -1, 2.2, 1.3);
      smooth(ctx, [[-14, 6], [-2, 6], [6, 15], [-6, 13]], '#4e4e56', '#22222a', 1.2); // むなびれ
      shine(ctx, -24, -14, 10, 2.2, -0.1);
    },
  },

  // センジュナマコ: ふっくら ももいろの すきとおった からだ・したに あしの ような かんそく・せなかの 上に のびる 2くみの つの
  seaPig: {
    color: '#f0a8b8',
    line: '#b0606e',
    parts: [
      { points: blob(44, 4, 1.5, 1.5, { cx: 1, cy: 11 }) },                              // あしの板
      { points: ellipse(26, 10, { cx: 0, cy: -3, n: 26 }) },                             // からだ
      { points: seg(-14, -10, -21, -26, 3) },                                           // せなかの つの
      { points: seg(-7, -12, -9, -28, 3) },
    ],
    draw(ctx, piece) {
      for (let i = 0; i < 7; i++) { // あしの ような かんそく
        const x = -20 + i * 6.6;
        line(ctx, [[x, 3], [x - 1, 10.6]], '#b0606e', 4.6);
        line(ctx, [[x, 3], [x - 1, 10.6]], '#f4bcc8', 3);
      }
      for (const [x0, y0, x1, y1] of [[-14, -10, -21, -26], [-7, -12, -9, -28]]) { // つの（さきが まるい）
        line(ctx, [[x0, y0], [x1, y1]], '#b0606e', 4.4);
        line(ctx, [[x0, y0], [x1, y1]], '#f4bcc8', 2.8);
        dot(ctx, x1, y1, 2, '#f4bcc8');
      }
      silhouetteOf(ctx, piece, [1]);
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, 4, -8, 18, 4, 'rgba(255, 255, 255, 0.45)');
        oval(ctx, 0, 5, 24, 4, '#e8909e');
        for (const x of [-2, 6, 14, 22]) dot(ctx, x, -11, 1.4, '#f8c4d0'); // せなかの こぶ
      });
      for (const x of [0, 8, 16]) ovalLine(ctx, x, -12.6, 1.6, 2, '#f4bcc8', '#b0606e', 1);
      darkEye(ctx, -19, -3, 2);
      cheek(ctx, -14, 1, 2.2, 1.3);
      smile(ctx, -23.4, 0.4, 1.6);
    },
  },

  // フクロウナギ: ふくろの ような とても 大きな くち・ちいさな からだ・ムチの ような しっぽの さきが ももいろに ひかる
  gulperEel: {
    color: '#2e2a3a',
    line: '#110f18',
    pad: 12,
    parts: [
      { points: flatBottom(hull([[-48, -12], [-30, -16], [-14, -8], [-12, 0], [-14, 8], [-30, 14], [-46, 10]]), 13) }, // 大きな くち
      { points: seg(-15, 0, 14, 3, 7) },                                                 // からだ
      { points: seg(12, 3, 30, 7, 4.4) },                                                // しっぽ
      { points: seg(29, 7, 44, 2, 3.2) },
      { points: seg(43, 3, 40, -10, 2.4) },
    ],
    draw(ctx, piece) {
      // ムチの ような しっぽ（さきが ひかる）
      curve(ctx, [[10, 3], [30, 8], [44, 2], [42, -8], [36, -12]], '#110f18', 4.4);
      curve(ctx, [[10, 3], [30, 8], [44, 2], [42, -8], [36, -12]], '#3e3a4e', 2.6);
      glow(ctx, 35.4, -12.4, 2.2, '255, 150, 190');
      drawSilhouette(ctx, { ...piece, parts: [piece.parts[1]] });
      // ふくろの ような くち: ほそながい うわあご・したあごを 大きく ひらき、あいだに うすい まくが たるむ
      ctx.beginPath();
      ctx.moveTo(-13, -4);
      ctx.quadraticCurveTo(-30, -16, -47, -13);
      ctx.quadraticCurveTo(-38, -1, -46, 10.6);
      ctx.quadraticCurveTo(-28, 15, -13, 4);
      ctx.closePath();
      ctx.fillStyle = 'rgba(86, 70, 110, 0.92)';
      ctx.fill();
      ctx.strokeStyle = '#110f18';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.beginPath(); // まくの おくの くらい ところ
      ctx.moveTo(-14, -1.6);
      ctx.quadraticCurveTo(-28, -6, -36, -2);
      ctx.quadraticCurveTo(-30, 6, -14, 2);
      ctx.closePath();
      ctx.fillStyle = '#231c2e';
      ctx.fill();
      for (const [a, b, c] of [[[-13, -4], [-30, -16.4], [-47.4, -13.4]], [[-13, 4], [-28, 15.4], [-46.4, 11]]]) { // ほそながい あご
        curve(ctx, [a, b, c], '#110f18', 3.6);
        curve(ctx, [a, b, c], '#5a4a72', 1.8);
      }
      for (let i = 0; i < 5; i++) { // ちいさな は
        const t = 0.3 + i * 0.13;
        dot(ctx, -13 - 34 * t, -4 - 11 * t + 2.6 * t * t * 4 * (1 - t), 0.5, '#e8e0f0');
      }
      darkEye(ctx, -12.4, -5, 1.6);
      cheek(ctx, -9, -1, 1.6, 1);
      shine(ctx, -34, -9, 7, 1.4, -0.15);
    },
  },

  // コウモリダコ: こい あかぐろ・うでの あいだの まくを マントの ように ひろげる・大きな あおい め・みみの ような ひれ
  vampireSquid: {
    color: '#7a2430',
    line: '#2e0a10',
    parts: [
      { points: ellipse(12, 13, { cx: 0, cy: -12, n: 22 }) },                            // どう
      { points: turn(ellipse(5, 3, { cx: -13, cy: -19, n: 12 }), -0.6, -13, -19) },      // みみの ひれ
      { points: turn(ellipse(5, 3, { cx: 13, cy: -19, n: 12 }), 0.6, 13, -19) },
      { points: flatBottom(hull([[-12, -6], [12, -6], [25, 9], [23, 14], [-23, 14], [-25, 9]]), 14) }, // マントの まく
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, { ...piece, parts: [piece.parts[1], piece.parts[2], piece.parts[3], piece.parts[0]] });
      clipPart(ctx, piece.parts[3], () => {
        oval(ctx, 0, 14, 28, 7, '#4a141c'); // マントの うら（くろ）
        for (let i = 0; i < 8; i++) line(ctx, [[-8 + i * 2.3, -6], [-22 + i * 6.3, 14]], '#5a1a24', 1.4); // うで
        for (let i = 0; i < 8; i++) for (const t of [0.45, 0.7]) dot(ctx, -8 + i * 2.3 + (-14 + i * 4) * t, -6 + 20 * t, 0.7, '#e8c8c8'); // しろい とげ
      });
      for (let i = 0; i < 8; i++) { // うでの さき（くるん）
        const x = -21 + i * 6;
        curve(ctx, [[x, 12.6], [x + 1.6, 14.6], [x + 3, 13]], '#1a0408', 1.4);
      }
      for (const s of [-1, 1]) { // 大きな あおい め
        ovalLine(ctx, s * 5.6, -9, 3.6, 3.6, '#5ab4ec', '#2e0a10', 1.2);
        dot(ctx, s * 5.6, -9, 2, INK);
        dot(ctx, s * 5.6 - 0.8, -10, 0.9, '#ffffff');
        cheek(ctx, s * 7.6, -4.6, 1.8, 1.1);
      }
      shine(ctx, -4, -19, 4, 2, -0.4);
    },
  },
  // ---------- むずかしい ----------

  // オオグチボヤ: うみの そこから のびる ほそい くき・その上で 大きな くちを ぱっくり あける（わらった かおに 見える）
  predatoryTunicate: {
    color: '#f4a890',
    line: '#b05a48',
    parts: [
      { points: blob(38, 4, 1.5, 1.5, { cx: 0, cy: 22 }) },                              // ねもと（ひろく ふんばる）
      { points: seg(0, 21, 2, -3, 4) },                                                  // くき
      { points: hull([[-16, -14], [-6, -24], [8, -24], [16, -14], [14, -4], [4, 0], [-8, -2], [-17, -8]]) }, // 大きな くちの からだ
    ],
    draw(ctx, piece) {
      for (const [x0, x1] of [[-2, -17], [1, 17], [0, -9], [2, 10]]) curve(ctx, [[x0, 21], [(x0 + x1) / 2, 22.6], [x1, 23.6]], '#b05a48', 1.6); // ねっこ
      line(ctx, [[0.2, 21], [2, -3]], '#b05a48', 4.6);
      line(ctx, [[0.2, 21], [2, -3]], 'rgba(250, 200, 184, 0.95)', 3); // すきとおった くき
      for (let y = 18; y > 0; y -= 4) line(ctx, [[-1, y], [3, y - 0.4]], '#e0907a', 0.8);
      smooth(ctx, [[-16, -14], [-6, -24], [8, -24], [16, -14], [14, -4], [4, 0], [-8, -2], [-17, -8]], 'rgba(246, 172, 148, 0.95)', '#b05a48', 2.4);
      // ぱっくり あいた 大きな くち（うえと したの くちびる）
      ctx.beginPath();
      ctx.moveTo(-17, -10);
      ctx.quadraticCurveTo(-4, -18, 4, -11);
      ctx.quadraticCurveTo(-4, -2, -16, -6);
      ctx.closePath();
      ctx.fillStyle = '#9a2a2e';
      ctx.fill();
      curve(ctx, [[-17, -10], [-4, -18.6], [4, -11]], '#f8c4b0', 2.2); // うわくちびる
      curve(ctx, [[-16, -6], [-4, -1.6], [4, -11]], '#f8c4b0', 2.2);  // したくちびる
      oval(ctx, -5, -8, 4, 1.6, '#c8484a');
      for (const s of [-1, 1]) dot(ctx, -1 + s * 5, -20.4, 1.5, INK); // め
      for (const s of [-1, 1]) dot(ctx, -1.4 + s * 5, -20.9, 0.55, '#ffffff');
      cheek(ctx, 10, -12, 2, 1.3);
      shine(ctx, 4, -21, 4, 1.4, -0.3);
    },
  },

  // ホウライエソ: ほそながい こん色の からだ・くちの そとまで とび出す とても ながい きば・せなかの ひかる ながい すじ・おなかに ならぶ ひかる てん
  viperfish: {
    color: '#2a3044',
    line: '#0c0e18',
    pad: 14,
    parts: [
      { points: flatBottom(hull([[-38, -2], [-32, -8], [-20, -10], [0, -9], [18, -6], [30, -4], [34, -2], [34, 2], [30, 4], [18, 6], [0, 8], [-20, 9], [-32, 8], [-38, 4]]), 8) },
      { points: hull([[-36, 2], [-46, 4], [-48, 7], [-36, 8]]) },                       // つき出た したあご
      { points: hull([[32, -2], [44, -9], [46, 0], [44, 9], [32, 2]]) },                // しっぽ
    ],
    draw(ctx, piece) {
      curve(ctx, [[-20, -10], [-28, -22], [-38, -24], [-42, -18]], '#4a5470', 1.2); // せなかの ながい すじ
      glow(ctx, -42, -17, 1.4, '150, 210, 255');
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, -2, 7, 36, 4, '#3e4a66');
        for (let x = -30; x < 30; x += 6) scallop(ctx, x, -2, 2.6, '#1a2032', 0.7);
      });
      clipPart(ctx, piece.parts[2], () => rays(ctx, [33, 0], [[43, -7], [45, -2], [45, 2], [43, 7]], '#4a5470', 0.8));
      for (let x = -32; x < 30; x += 4.6) glow(ctx, x, 6.2, 0.7, '120, 200, 255'); // おなかの ひかる てん
      // くちの そとまで とび出す ながい きば
      for (const [x0, y0, x1, y1, x2, y2] of [[-46.4, 5, -48.6, -2, -46, -9.4], [-42, 5, -43.4, 0, -41.6, -4.6]]) { // 大きな きば 2本
        ctx.beginPath();
        ctx.moveTo(x0 - 1.2, y0);
        ctx.quadraticCurveTo(x1 - 0.8, y1, x2, y2);
        ctx.quadraticCurveTo(x1 + 1, y1, x0 + 1.2, y0);
        ctx.closePath();
        ctx.fillStyle = '#f6f2e8';
        ctx.fill();
        ctx.strokeStyle = '#0c0e18';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      for (const x of [-44, -40]) poly(ctx, [[x, 1], [x + 1, 4.6], [x + 2, 1]], '#f6f2e8'); // うえの きば
      darkEye(ctx, -32, -3, 2.6);
      cheek(ctx, -28, 3, 2, 1.2);
      shine(ctx, -10, -6, 9, 1.4, -0.06);
    },
  },

  // オニキンメ: たかい あたまに ほねの でっぱり・めの よこまで とどく とても ながい したの きば・ほそい しっぽの え と ふたまたの しっぽ
  // （チョウチンアンコウと にないように、あたまを たかく、からだを うしろへ ほそく）
  fangtooth: {
    color: '#4a3e46',
    line: '#161016',
    parts: [
      { points: flatBottom(hull([[-26, -2], [-24, -16], [-14, -22], [-2, -20], [8, -14], [16, -7], [20, -4], [20, 4], [16, 7], [6, 12], [-8, 15], [-20, 13], [-27, 5]]), 14) },
      { points: hull([[18, -4], [26, -3], [26, 3], [18, 4]]) },                         // ほそい しっぽの え
      { points: hull([[24, -4], [36, -13], [38, -10], [32, 0], [38, 10], [36, 13], [24, 4]]) }, // ふたまたの しっぽ
    ],
    draw(ctx, piece) {
      beak(ctx, [[24, -4], [36, -13], [38, -10], [32, 0], [38, 10], [36, 13], [24, 4]], '#4a3e46', '#161016', 2.4);
      rays(ctx, [25, 0], [[36, -11], [34, -6], [34, 6], [36, 11]], '#6a5a64', 0.8);
      drawSilhouette(ctx, { ...piece, parts: [piece.parts[0], piece.parts[1]] });
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, -2, 12, 22, 5, '#5a4c56');
        curve(ctx, [[-22, -14], [-12, -18], [-2, -16]], '#2a2028', 1.4); // あたまの ほねの でっぱり
        curve(ctx, [[-20, -8], [-14, -12], [-6, -10]], '#2a2028', 1.2);
        curve(ctx, [[-4, -18], [-2, -6], [-6, 8]], '#2a2028', 1.2);       // えらぶた
        for (const [x, y] of [[4, -10], [10, -4], [2, 0], [8, 4], [-2, 8], [12, 2]]) dot(ctx, x, y, 0.8, '#6a5a64');
      });
      // とても 大きな くちと きば（したの きばは めの よこまで とどく）
      poly(ctx, [[-27.4, 0], [-10, 4], [-27.4, 11]], '#5a1e26');
      for (const [x, h] of [[-23.4, 16], [-17, 10]]) { // したの ながい きば
        const yb = 10.4 - (x + 27) * 0.36;
        poly(ctx, [[x - 1.6, yb], [x - 0.2, yb - h], [x + 1.6, yb]], '#f6f2e8');
        line(ctx, [[x - 1.6, yb], [x - 0.2, yb - h], [x + 1.6, yb]], '#161016', 0.8);
      }
      for (const x of [-25, -20, -14]) { // うえの きば
        const yt = 0.4 + (x + 27) * 0.24;
        poly(ctx, [[x - 1, yt], [x, yt + 4], [x + 1, yt]], '#f6f2e8');
      }
      line(ctx, [[-27.4, 0], [-10, 4], [-27.4, 11]], '#161016', 1.4);
      darkEye(ctx, -15, -10.6, 1.8);
      cheek(ctx, -8, -5, 2, 1.3);
      smooth(ctx, [[0, 2], [8, -2], [12, 2], [10, 7], [3, 7]], '#5a4c56', '#161016', 1.1); // むなびれ
      shine(ctx, -10, -17, 6, 1.8, -0.3);
    },
  },

  // ミズウオ: ほそながい ぎんいろの からだ・ほの ような とても 大きな せびれ・するどい きばの 大きな くち
  lancetfish: {
    color: '#c8d0dc',
    line: '#5a6478',
    parts: [
      { points: flatBottom(hull([[-46, -1], [-40, -6], [-28, -8], [0, -7], [24, -5], [34, -3], [36, 0], [34, 3], [24, 5], [0, 7], [-28, 8], [-40, 6], [-46, 2]]), 7) },
      { points: hull([[-30, -7], [-22, -26], [-6, -28], [10, -22], [24, -6]]) },        // ほの ような せびれ
      { points: hull([[34, -3], [46, -12], [48, 0], [46, 12], [34, 3]]) },              // しっぽ
    ],
    draw(ctx, piece) {
      beak(ctx, [[-30, -6], [-22, -26], [-6, -28], [10, -22], [24, -6]], 'rgba(90, 110, 150, 0.85)', '#3a4458', 2); // ほの ような せびれ
      for (let x = -26; x < 22; x += 4) line(ctx, [[x, -6.4], [x + 2, -24 + Math.abs(x + 6) * 0.3]], '#a8b8d4', 0.8);
      beak(ctx, [[34, -3], [46, -12], [48, -9], [42, 0], [48, 9], [46, 12], [34, 3]], '#c8d0dc', '#5a6478', 2.4); // ふたまたの しっぽ
      drawSilhouette(ctx, { ...piece, parts: [piece.parts[0]] });
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, -6, -6, 40, 3, '#9aa6ba');
        oval(ctx, -6, 6, 40, 3, '#e4e8f0');
        line(ctx, [[-36, 0], [32, 0]], '#9aa6ba', 0.8);
      });
      line(ctx, [[-46, 1], [-35, 3.4]], '#5a6478', 1.4); // 大きな くち
      for (let i = 0; i < 4; i++) poly(ctx, [[-44 + i * 2.4, 1.4 + i * 0.5], [-43.2 + i * 2.4, 3.6 + i * 0.5], [-42.4 + i * 2.4, 1.6 + i * 0.5]], '#ffffff');
      colorEye(ctx, -38, -2.4, 3, '#d8e0ec');
      cheek(ctx, -34, 3.6, 1.8, 1.1);
      shine(ctx, -14, -4.6, 10, 1.2, -0.04);
    },
  },

  // ギンザメ: ぎんいろ・とても 大きな みどりの め・うさぎの ような はな と まえば・とげの ある せびれ・ムチの ような しっぽ
  chimaera: {
    color: '#c4ccd4',
    line: '#5a6270',
    pad: 10,
    parts: [
      { points: flatBottom(hull([[-36, 0], [-34, -7], [-26, -12], [-12, -13], [2, -10], [16, -6], [28, -3], [34, -1], [34, 1], [28, 3], [16, 6], [2, 9], [-14, 11], [-28, 10], [-35, 5]]), 10) },
      { points: seg(32, 0, 50, 1, 2) },                                                  // ムチの ような しっぽ
      { points: hull([[-14, -12], [-6, -12], [-10, -26]]) },                             // とげの ある せびれ
    ],
    draw(ctx, piece) {
      beak(ctx, [[-4, -10], [24, -5], [26, -8], [0, -13]], '#b0b8c4', '#5a6270', 1.2); // ひくく ながい だい2せびれ
      line(ctx, [[30, 0], [50, 1]], '#5a6270', 2.6);
      line(ctx, [[30, 0], [50, 1]], '#c4ccd4', 1.2);
      drawSilhouette(ctx, { ...piece, parts: [piece.parts[0], piece.parts[2]] });
      line(ctx, [[-14, -12], [-10, -26]], '#5a6270', 1.4); // せびれの とげ
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, -2, 8, 32, 4, '#e2e6ec');
        for (const [x, y] of [[-6, -6], [4, -4], [12, -3], [18, 0], [-2, 2], [8, 3]]) dot(ctx, x, y, 1.1, '#a89070'); // ちゃいろの てん
        curve(ctx, [[-34, 2], [-28, -2], [-20, -4], [-12, -2], [0, -4]], '#8a6a5a', 0.9); // かおの すじ
        curve(ctx, [[-32, 5], [-24, 3], [-16, 6]], '#8a6a5a', 0.9);
      });
      smooth(ctx, [[-20, 2], [-4, -2], [8, 4], [-8, 8]], 'rgba(180, 190, 204, 0.95)', '#5a6270', 1.2); // つばさの ような むなびれ
      poly(ctx, [[-36.4, 2.6], [-34.4, 2.6], [-34.4, 5], [-36.4, 5]], '#ffffff'); // うさぎの ような まえば
      colorEye(ctx, -26, -4, 5, '#5adc8a'); // とても 大きな みどりの め
      cheek(ctx, -20, 3, 2, 1.2);
      shine(ctx, -10, -9, 8, 1.6, -0.1);
    },
  },

  // ハダカイワシ: こい あおの せなか・ぎんいろの よこはら・大きな め・からだの 下に ならぶ あおく ひかる てんの れつ・
  // めの まえの ひかる てん・ふたまたの しっぽ（v0.17.35: いろの かさね・ひれ・ひかる てんの ならびを 描きなおし）
  lanternfish: {
    color: '#9aaecc',
    line: '#1c2440',
    parts: [
      { points: flatBottom(hull([[-28, 0], [-24, -7], [-12, -10], [6, -9], [18, -6], [24, -3], [24, 3], [18, 6], [6, 9], [-12, 10], [-24, 7]]), 9) },
      { points: hull([[22, -3], [33, -10], [36, -8], [30, 0], [36, 8], [33, 9], [22, 3]]) }, // ふたまたの しっぽ
      { points: hull([[-6, -9.4], [6, -9], [1, -16]]) },                                  // せびれ
    ],
    draw(ctx, piece) {
      beak(ctx, [[22, -3], [33, -10], [36, -8], [30, 0], [36, 8], [33, 9], [22, 3]], '#4a5a80', '#1c2440', 2.4); // ふたまたの しっぽ
      rays(ctx, [23, 0], [[34, -8], [32, -4], [32, 4], [34, 7.6]], '#7a8aae', 0.8);
      beak(ctx, [[-6, -9.4], [6, -9], [1, -16]], '#4a5a80', '#1c2440', 1.6);             // せびれ
      rays(ctx, [0, -9], [[-3, -12], [0, -15], [3, -12]], '#7a8aae', 0.7);
      drawSilhouette(ctx, { ...piece, parts: [piece.parts[0]] });
      clipPart(ctx, piece.parts[0], () => {
        poly(ctx, [[-30, -12], [26, -12], [26, -3], [-30, -2]], '#2e3a5a');        // こい あおの せなか
        poly(ctx, [[-30, 4], [26, 2.6], [26, 12], [-30, 12]], '#dfe6f0');          // ぎんいろの おなか
        for (let x = -18; x < 22; x += 5) for (const y of [-3, 1.6]) scallop(ctx, x + (y > 0 ? 2.5 : 0), y, 2.4, 'rgba(255, 255, 255, 0.4)', 0.7); // うろこ
        oval(ctx, -4, -1, 18, 1.2, 'rgba(255, 255, 255, 0.6)');
      });
      dot(ctx, 15, -6.6, 1.6, '#2e3a5a'); // あぶらびれ
      smooth(ctx, [[-14, 2], [-6, 0], [-2, 3], [-8, 5]], 'rgba(150, 170, 200, 0.9)', '#1c2440', 1); // むなびれ
      smooth(ctx, [[8, 8], [16, 6], [16, 10], [10, 11]], '#4a5a80', '#1c2440', 1);                 // しりびれ
      for (let x = -18; x < 18; x += 3.6) { // ひかる てんの れつ（くろい ふちに あおい ひかり）
        dot(ctx, x, 7, 1.1, '#1c2440');
        glow(ctx, x, 7, 0.7, '120, 210, 255');
      }
      for (const [x, y] of [[-14, 3.6], [-8, 4], [-2, 4.2], [4, 4], [10, 3.4], [16, 2.6], [20, -1]]) {
        dot(ctx, x, y, 1, '#1c2440');
        glow(ctx, x, y, 0.6, '120, 210, 255');
      }
      glow(ctx, -24.4, -3.6, 0.9, '170, 230, 255'); // めの まえの ひかる てん
      colorEye(ctx, -18.6, -1.6, 4, '#c8d8ec');
      line(ctx, [[-28, 0.6], [-17, 4]], '#1c2440', 1.1);
      cheek(ctx, -14, 4, 1.7, 1);
      shine(ctx, -6, -6, 8, 1.2, -0.06);
    },
  },

  // ムネエソ: うすくて おのの ような 形の ぎんいろの からだ（かがみの ように ひかる）・上を 見る 大きな つつの め・
  // むねの ふちに ならぶ ひかる てん・ほそい しっぽの え（v0.17.35: 大きく、ぎんいろの ひかりと ひかる てんを 描きなおし）
  hatchetfish: {
    color: '#d8e2ec',
    line: '#4a5468',
    parts: [
      { points: flatBottom(hull([[-22, -12], [-8, -15], [6, -13], [14, -7], [17, -3], [13, 6], [2, 15], [-10, 18], [-19, 14], [-24, 4]]), 16) }, // おのの ような からだ
      { points: hull([[14, -5], [26, -3], [26, 3], [14, 2]]) },                          // しっぽの え
      { points: hull([[24, -6], [33, -11], [35, 0], [33, 9], [24, 4]]) },                 // しっぽ
      { points: hull([[-3, -14.6], [6, -13], [2, -21]]) },                                // せびれ
    ],
    draw(ctx, piece) {
      beak(ctx, [[-3, -14.6], [6, -13], [2, -21]], 'rgba(200, 214, 230, 0.9)', '#4a5468', 1.4); // せびれ
      beak(ctx, [[24, -6], [33, -11], [35, 0], [33, 9], [24, 4]], 'rgba(200, 214, 230, 0.9)', '#4a5468', 1.6);
      rays(ctx, [25, 0], [[33, -9], [34, -3], [34, 3], [33, 7.6]], '#9aa8bc', 0.8);
      drawSilhouette(ctx, { ...piece, parts: [piece.parts[0], piece.parts[1]] });
      clipPart(ctx, piece.parts[0], () => {
        poly(ctx, [[-26, -18], [18, -18], [18, -8], [-26, -7]], '#5a6a86');         // こい せなか
        for (let k = 0; k < 6; k++) { // かがみの ような ぎんいろの おび
          const x = -18 + k * 6;
          poly(ctx, [[x, -8], [x + 2.6, -8], [x + 5, 20], [x + 2.4, 20]], k % 2 ? 'rgba(255, 255, 255, 0.55)' : 'rgba(170, 200, 235, 0.45)');
        }
        oval(ctx, -6, 14, 16, 4, '#b8c6d8');                                        // むねの いた
        for (let x = -18; x < 10; x += 4) line(ctx, [[x, 10], [x + 1.4, 18]], '#8a9ab0', 0.8);
      });
      clipPart(ctx, piece.parts[1], () => line(ctx, [[14, -1], [26, 0]], 'rgba(255, 255, 255, 0.6)', 1.2));
      for (const [x, y] of [[-20, 12], [-16, 14.6], [-12, 15.8], [-8, 16], [-4, 15], [0, 13.4], [4, 11.4], [8, 8.4], [11, 5]]) { // ひかる てん
        dot(ctx, x, y - 1, 1.2, '#2a3448');
        glow(ctx, x, y - 1, 0.75, '140, 214, 255');
      }
      ctx.beginPath(); // 上を 見る 大きな つつの め
      ctx.moveTo(-17.4, -10);
      ctx.lineTo(-17.4, -18);
      ctx.arc(-14, -18, 3.4, PI, 0);
      ctx.lineTo(-10.6, -10);
      ctx.closePath();
      ctx.fillStyle = '#eef3f8';
      ctx.fill();
      ctx.strokeStyle = '#4a5468';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      dot(ctx, -14, -18.6, 2.6, INK);
      dot(ctx, -15, -19.6, 1, '#ffffff');
      dot(ctx, -13.2, -17.6, 0.5, '#ffffff');
      line(ctx, [[-24, 1], [-19.6, -4]], '#4a5468', 1.4); // 上むきの くち
      beak(ctx, [[-10, 2], [-2, -0.6], [2, 2.4], [-4, 4.6]], 'rgba(200, 214, 230, 0.9)', '#4a5468', 1); // むなびれ
      rays(ctx, [-9, 2.4], [[-2, 0], [1, 2.4], [-3, 4]], '#9aa8bc', 0.6);
      cheek(ctx, -13, -3, 2, 1.2);
    },
  },

  // ゴエモンコシオリエビ: しろい からだ・ふさふさの 毛に おおわれた ながい うで・さきに ちいさな はさみ（ねっすいの まわりに すむ）
  yetiCrab: (() => {
    const arm = [[-4, -4], [-18, -12], [-33, -9]];
    return {
      color: '#f2eee6',
      line: '#8a8478',
      pad: 12,
      parts: [
        { points: blob(40, 4, 1.5, 1.5, { cx: 6, cy: 10 }) },                            // あしの板
        { points: ellipse(14, 9, { cx: 6, cy: -3, n: 20 }) },                            // こうら
        { points: ellipse(8, 6, { cx: 21, cy: 1, n: 14 }) },                            // まるめた おなか
        { points: seg(arm[0][0], arm[0][1], arm[1][0], arm[1][1], 9) },                  // ふさふさの うで
        { points: seg(arm[1][0], arm[1][1], arm[2][0], arm[2][1], 9) },
        { points: hull([[-32, -12], [-40, -11], [-41, -7], [-32, -6]]) },                // ちいさな はさみ
      ],
      draw(ctx, piece) {
        for (const [x0, x1] of [[-2, -8], [6, 3], [14, 13], [20, 22]]) { // あし
          line(ctx, [[x0, 3], [x0 - 2, 7], [x1, 10.7]], '#8a8478', 3.4);
          line(ctx, [[x0, 3], [x0 - 2, 7], [x1, 10.7]], '#f2eee6', 2);
        }
        curve(ctx, [[-4, -8], [-22, -22], [-42, -21]], '#8a8478', 1); // しょっかく
        silhouetteOf(ctx, piece, [2, 1]);
        clipPart(ctx, piece.parts[1], () => {
          for (let x = -4; x < 18; x += 5) curve(ctx, [[x, -11], [x + 2, -3], [x, 5]], '#d8d2c4', 1);
        });
        // ふさふさの 毛の うで（毛を たくさん かさねて もこもこに）
        line(ctx, arm, '#8a8478', 9.6);
        line(ctx, arm, '#efe4c8', 8);
        for (let i = 0; i < 2; i++) {
          const [a, b] = [arm[i], arm[i + 1]];
          for (let k = 0; k <= 8; k++) {
            const t = k / 8;
            const x = a[0] + (b[0] - a[0]) * t;
            const y = a[1] + (b[1] - a[1]) * t;
            for (const [dx, dy] of [[-1, -4.6], [1, -4.2], [-1.4, 4.4], [1, 4.8], [0, -5]]) line(ctx, [[x, y], [x + dx, y + dy]], '#e2d2a8', 1.1);
          }
        }
        beak(ctx, [[-32, -11.4], [-40.4, -11], [-38, -9], [-41, -7.2], [-32, -6.6]], '#f2eee6', '#8a8478', 1.2); // ちいさな はさみ
        darkEye(ctx, -6, -9, 1.5);
        cheek(ctx, -2, -4, 1.8, 1.1);
        shine(ctx, 4, -8, 6, 1.6, -0.2);
      },
    };
  })(),
  // ---------- おとな（めずらしい 子） ----------

  // ユメナマコ: すきとおった ももいろの からだ・まえに 大きな ベール（ほねの ような すじ）・うしろに おびれの ような ベール・
  // すけて 見える ぐるぐるの くだ・くちの まわりの ちいさな しょくしゅ（v0.17.35: すきとおりを かさねて 描きなおし）
  swimmingSeaCucumber: {
    color: '#f2a0c4',
    line: '#a8406e',
    pad: 10,
    parts: [
      { points: flatBottom(hull([[-18, -4], [-8, -11], [8, -12], [22, -9], [30, -3], [30, 4], [22, 9], [6, 11], [-12, 10], [-20, 5]]), 10) }, // からだ
      { points: hull([[-12, -9], [-22, -24], [-34, -28], [-42, -20], [-40, -8], [-24, -2]]) }, // まえの ベール
      { points: hull([[18, -8], [30, -20], [40, -16], [38, -4], [30, 2]]) },             // うしろの ベール
    ],
    draw(ctx, piece) {
      const veil = (base, edge, fill) => { // ベール（ねもとから ひろがる すじ・ふちは なみなみ）
        smooth(ctx, [base[0], ...edge, base[1]], fill, '#a8406e', 1.6);
        for (let i = 0; i < edge.length; i++) curve(ctx, [[(base[0][0] + base[1][0]) / 2, (base[0][1] + base[1][1]) / 2], edge[i]], 'rgba(168, 64, 110, 0.55)', 0.9);
      };
      veil([[-12, -8], [-22, -3]], [[-20, -20], [-28, -27], [-36, -27], [-42, -20], [-40, -10]], 'rgba(246, 172, 204, 0.78)');
      veil([[20, -7], [30, 1]], [[28, -18], [36, -18], [40, -12], [39, -4]], 'rgba(246, 172, 204, 0.78)');
      for (let i = 0; i < 8; i++) { // くちの まわりの ちいさな しょくしゅ
        const x = -19 + i * 1.4;
        curve(ctx, [[x, 6], [x - 1.4, 9], [x - 0.4, 11.4]], '#c85a8a', 1.2);
      }
      const body = [[-18, -4], [-8, -11], [8, -12], [22, -9], [30, -3], [30, 4], [22, 9], [6, 11], [-12, 10], [-20, 5]];
      smooth(ctx, body, 'rgba(244, 160, 196, 0.92)', '#a8406e', 2.4);
      smoothClip(ctx, body, () => {
        oval(ctx, 8, 3, 14, 4, 'rgba(226, 100, 150, 0.3)');                   // すきとおりの おく
        oval(ctx, 4, -8, 18, 2.6, 'rgba(255, 255, 255, 0.6)');
      });
      // すけて 見える くだ（ほそい わ。なみせんに すると 大きな くちびるに 見えたため）
      curve(ctx, [[-8, -1], [2, -6], [14, -5], [22, -1], [16, 4], [4, 3], [-2, 0]], 'rgba(150, 30, 70, 0.75)', 1.4);
      dot(ctx, 20, 1, 1.6, 'rgba(150, 30, 70, 0.6)');
      for (let x = -12; x < 26; x += 4) line(ctx, [[x, 9.6], [x - 0.6, 11.6]], '#c85a8a', 1.1); // ちいさな あし
      dot(ctx, -14, -3.4, 1.7, INK);
      dot(ctx, -14.5, -4, 0.65, '#ffffff');
      cheek(ctx, -10, 1, 2, 1.2);
      dot(ctx, 12, -9, 0.9, 'rgba(255, 255, 255, 0.9)');
      dot(ctx, -30, -20, 0.8, 'rgba(255, 255, 255, 0.9)');
    },
  },

  // ウミユリ: うみの そこに 立つ ほそい くき（ふしと まきひげ）・上に 花のように ひらく 羽の ような 10本の うで（いきた かせき）
  seaLily: {
    color: '#f0b04a',
    line: '#9a5a1a',
    parts: [
      { points: blob(40, 4, 1.5, 1.5, { cx: 0, cy: 32 }) },                              // ねもと
      { points: seg(0, 31, 0, -10, 3.6) },                                               // くき
      { points: hull([[-6, -12], [-22, -28], [-17, -40], [0, -44], [17, -40], [22, -28], [6, -12]]) }, // 花の ような うで
    ],
    draw(ctx, piece) {
      for (const [x0, x1] of [[-2, -18], [2, 18], [-1, -10], [1, 10]]) curve(ctx, [[x0, 31], [(x0 + x1) / 2, 32], [x1, 33.6]], '#9a5a1a', 1.8); // ねもと
      line(ctx, [[0, 31], [0, -10]], '#9a5a1a', 4.6);
      line(ctx, [[0, 31], [0, -10]], '#d8963a', 3);
      for (let y = 28; y > -8; y -= 2.6) line(ctx, [[-1.6, y], [1.6, y]], '#9a5a1a', 0.7); // くきの ふし
      for (const y of [22, 10, -2]) for (const s of [-1, 1]) curve(ctx, [[0, y], [s * 5, y - 1], [s * 7, y + 2.6]], '#9a5a1a', 1.2); // まきひげ
      const arms = [];
      for (let i = 0; i < 10; i++) { // 羽の ような うで
        const a = -PI * 0.5 + (i - 4.5) * 0.17;
        const len = 30 - Math.abs(i - 4.5) * 1.6;
        arms.push([[0, -12], [Math.cos(a) * len * 0.55, -12 + Math.sin(a) * len * 0.55], [Math.cos(a - (i < 5 ? 0.2 : -0.2)) * len, -12 + Math.sin(a - (i < 5 ? 0.2 : -0.2)) * len]]);
      }
      for (const a of arms) {
        const [p0, p1, p2] = a;
        for (let t = 0.25; t < 1; t += 0.12) { // はねの ような こまかい えだ
          const x = p0[0] + (p2[0] - p0[0]) * t;
          const y = p0[1] + (p2[1] - p0[1]) * t;
          const nx = -(p2[1] - p0[1]) * 0.08;
          const ny = (p2[0] - p0[0]) * 0.08;
          line(ctx, [[x - nx, y - ny], [x + nx, y + ny]], '#f6c870', 1);
        }
        curve(ctx, a, '#9a5a1a', 3);
        curve(ctx, a, '#f0b04a', 1.6);
      }
      ovalLine(ctx, 0, -12, 4.6, 3.6, '#e09a3a', '#9a5a1a', 1.4); // うでの ねもと
      dot(ctx, -1.8, -12.4, 0.9, INK);
      dot(ctx, 1.8, -12.4, 0.9, INK);
    },
  },

  // カイロウドウケツ: ガラスの あみめで できた ほそながい つぼ・ねもとに ガラスの ふさ・中に すむ 2ひきの エビ
  glassSponge: {
    color: '#f0ecdc',
    line: '#9a9478',
    parts: [
      { points: blob(38, 4, 1.5, 1.5, { cx: -1, cy: 32 }) },                             // ガラスの ふさ
      { points: hull([[-10, 30], [-14, 10], [-16, -12], [-18, -30], [-14, -40], [4, -42], [16, -36], [16, -14], [12, 10], [8, 30]]) }, // つぼ
    ],
    draw(ctx, piece) {
      for (let k = 0; k < 9; k++) curve(ctx, [[-2 + (k - 4) * 0.8, 30], [-2 + (k - 4) * 2.6, 32], [-2 + (k - 4) * 4.4, 34]], '#c8c0a0', 1); // ガラスの ふさ
      const vase = [[-10, 30], [-14, 10], [-16, -12], [-18, -30], [-14, -40], [4, -42], [16, -36], [16, -14], [12, 10], [8, 30]];
      smooth(ctx, vase, 'rgba(244, 240, 224, 0.92)', '#9a9478', 2.4);
      smoothClip(ctx, vase, () => {
        for (let d = -80; d < 80; d += 5) { // ガラスの あみめ
          line(ctx, [[-20, d], [20, d + 30]], 'rgba(160, 150, 120, 0.55)', 0.7);
          line(ctx, [[-20, d + 30], [20, d]], 'rgba(160, 150, 120, 0.55)', 0.7);
        }
        for (let y = -36; y < 30; y += 7) line(ctx, [[-20, y], [20, y - 2]], 'rgba(150, 140, 110, 0.6)', 0.9);
        oval(ctx, -8, -10, 3, 26, 'rgba(255, 255, 255, 0.55)');
      });
      ovalLine(ctx, 0, -39.6, 13, 3.4, 'rgba(236, 230, 210, 0.95)', '#9a9478', 1.4, 0.12); // うえの ふた（ふるい）
      for (let x = -10; x <= 10; x += 3.4) dot(ctx, x, -39.6 + x * 0.12, 0.7, '#9a9478');
      for (const [x, y, s] of [[-3, -6, 1], [3, 6, -1]]) { // 中に すむ 2ひきの エビ
        curve(ctx, [[x - 4 * s, y], [x, y - 2], [x + 4 * s, y + 1], [x + 5 * s, y + 3]], '#e07a6a', 2.6);
        dot(ctx, x - 4 * s, y - 0.6, 0.9, INK);
        line(ctx, [[x - 4.4 * s, y - 1], [x - 7 * s, y - 3]], '#e07a6a', 0.6);
      }
    },
  },

  // シンカイクサウオ: いちばん ふかい うみに すむ さかな・すきとおった ももいろの オタマジャクシの ような からだ・ちいさな め
  snailfish: {
    color: '#f6c4cc',
    line: '#c07a88',
    parts: [
      { points: flatBottom(hull([[-30, 0], [-28, -9], [-18, -14], [-4, -12], [10, -8], [24, -4], [36, -2], [36, 2], [24, 4], [10, 7], [-4, 10], [-18, 12], [-28, 8]]), 10) },
    ],
    draw(ctx, piece) {
      // しっぽを まわる ひれ（すきとおる）
      smooth(ctx, [[-2, -12], [16, -11], [32, -7], [42, 0], [32, 7], [16, 10], [2, 11]], 'rgba(246, 196, 204, 0.55)', '#c07a88', 1.2);
      smooth(ctx, [[-30, 0], [-28, -9], [-18, -14], [-4, -12], [10, -8], [24, -4], [36, -2], [36, 2], [24, 4], [10, 7], [-4, 10], [-18, 12], [-28, 8]], 'rgba(246, 196, 204, 0.95)', '#c07a88', 2.4);
      oval(ctx, -12, 3, 8, 5, 'rgba(220, 120, 140, 0.45)'); // すけて 見える おなか
      oval(ctx, -8, -8, 14, 2.6, 'rgba(255, 255, 255, 0.6)');
      smooth(ctx, [[-18, 4], [-8, 6], [-4, 12], [-14, 11]], 'rgba(246, 196, 204, 0.8)', '#c07a88', 1.1); // むなびれ
      for (let x = 4; x < 34; x += 4) line(ctx, [[x, -9 + (x - 4) * 0.2], [x + 1, -7 + (x - 4) * 0.18]], 'rgba(192, 122, 136, 0.6)', 0.7);
      dot(ctx, -21, -5, 1.4, INK); // ちいさな め
      dot(ctx, -21.4, -5.5, 0.5, '#ffffff');
      cheek(ctx, -17, -0.6, 2, 1.2);
      smile(ctx, -27, -0.4, 1.4);
    },
  },

  // ムラサキカムリクラゲ: こい あかの かさ（まんなかが もりあがり、ふちは ぎざぎざ）・たくさんの しょくしゅ・ふちが あおく ひかる
  crownJelly: {
    color: '#b8283a',
    line: '#5a0e1a',
    pad: 20,
    parts: [
      { points: flatBottom(hull([[-24, 6], [-22, -2], [-14, -8], [-8, -16], [0, -18], [8, -16], [14, -8], [22, -2], [24, 6], [18, 9], [-18, 9]]), 8) }, // かさ
    ],
    draw(ctx, piece) {
      for (let i = 0; i < 12; i++) { // たくさんの しょくしゅ（よこへ ひろがって 上へ まく）
        const s = i < 6 ? -1 : 1;
        const k = i % 6;
        const x0 = s * (8 + k * 2.6);
        curve(ctx, [[x0, 6], [x0 + s * (6 + k * 1.4), 4 - k], [x0 + s * (9 + k * 1.2), -4 - k * 1.6]], '#d8506a', 1.2);
      }
      curve(ctx, [[18, 6], [32, 8], [40, -1], [37, -12], [30, -16]], '#d8506a', 1.6); // 1本だけ ながい しょくしゅ
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, 0, -9, 12, 9, '#8a1a2a');  // まんなかの もりあがり
        ctx.beginPath();
        ctx.ellipse(0, -2, 19, 7, 0, 0, PI * 2);
        ctx.strokeStyle = '#d84a5e'; // まわりの みぞ
        ctx.lineWidth = 1.6;
        ctx.stroke();
        for (let x = -22; x <= 22; x += 4.4) scallop(ctx, x, 5.6, 2.2, '#5a0e1a', 1); // ぎざぎざの ふち
      });
      for (let x = -20; x <= 20; x += 5) glow(ctx, x, 7, 0.7, '110, 190, 255'); // あおく ひかる ふち
      for (const s of [-1, 1]) dot(ctx, s * 4, -10, 1.4, INK);
      for (const s of [-1, 1]) dot(ctx, s * 4 - 0.4, -10.5, 0.5, '#ffffff');
      cheek(ctx, -8, -6, 1.8, 1.1);
      cheek(ctx, 8, -6, 1.8, 1.1);
      shine(ctx, -6, -14, 4, 1.6, -0.4);
    },
  },

  // スケーリーフット: ねっすいの まわりに すむ まきがい・てつの うろこで おおわれた あし・くろく ひかる から
  scalyFoot: {
    color: '#4a4a52',
    line: '#18181e',
    parts: [
      { points: ellipse(17, 15, { cx: 6, cy: -8, n: 24 }) },                             // まきがいの から
      { points: flatBottom(hull([[-24, 6], [-20, 0], [-6, -2], [18, -2], [24, 4], [20, 9], [-20, 9]]), 9) }, // てつの うろこの あし
    ],
    draw(ctx, piece) {
      for (const s of [-1, 1]) curve(ctx, [[-20, 1], [-26, -4 + s * 2], [-30, -8 + s * 3]], '#e8d4cc', 1.8); // しょっかく
      drawSilhouette(ctx, { ...piece, parts: [piece.parts[1], piece.parts[0]] });
      clipPart(ctx, piece.parts[0], () => {
        for (let k = 0; k < 4; k++) { // まきの すじ
          ctx.beginPath();
          ctx.arc(10 - k * 1.2, -10 + k * 0.8, 14 - k * 3.6, PI * 0.9, PI * 2.4);
          ctx.strokeStyle = '#26262c';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        for (let a = 0; a < 6; a++) line(ctx, [[6, -8], [6 + Math.cos(a) * 17, -8 + Math.sin(a) * 15]], 'rgba(120, 130, 150, 0.4)', 0.8);
        oval(ctx, 0, -16, 7, 3, 'rgba(170, 190, 220, 0.5)'); // てつの ひかり
      });
      clipPart(ctx, piece.parts[1], () => {
        for (let y = 0; y < 10; y += 3.4) for (let x = -18; x < 24; x += 4) { // てつの うろこ
          ovalLine(ctx, x + (y % 6.8 ? 2 : 0), y, 2.4, 2, '#2a2a30', '#5a6070', 0.7);
        }
      });
      ovalLine(ctx, -21, 3, 4.6, 4, '#f0dcd4', '#18181e', 1.2); // あたま
      dot(ctx, -22.4, 2.2, 1.1, INK);
      dot(ctx, -22.7, 1.8, 0.4, '#ffffff');
      cheek(ctx, -19.6, 5, 1.4, 0.9);
      shine(ctx, 4, -17, 6, 2, -0.3);
    },
  },
};
