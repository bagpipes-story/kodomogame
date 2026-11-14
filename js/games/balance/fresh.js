// fresh.js — たんすいの いきもの つみき（v0.17.28）
// うみ・どうぶつ・とり と同じしくみ: 1ぴきずつ「当たり判定の形（凸の部品）」と「絵の描き方」を持つ。みんな 左むき。
// さかなは makeFish() で つくる（からだの下は平らで 積める。おびれの下は からだより上で止めて、2か所で着地しない）。
// ヤマメ・アマゴ・イワナ など にた形の さかなは、もようで 見分ける（パーマーク・あかい てん・しろい てん・にじいろの おび）

import {
  ellipse, blob, pts, flatBottom, seg,
  drawSilhouette, silhouetteOf, strokePart, clipPart, cut,
  oval, ovalLine, dot, poly, line, curve, leg, beak, scallop,
  eye, colorEye, cheek, smile, shine, INK,
} from './kit.js';
import { SEA_PIECES } from './sea.js';

const PI = Math.PI;
const r2 = (v) => Math.round(v * 100) / 100;

// さかなの からだ（左むき）。x0=はなさき, x1=しっぽの つけね, top/bottom=せなか・おなかの 高さ, ped=つけねの 太さの半分
// おなかは まえから 2わり〜8わりの ところが 平ら（その上に 平らな2点だけを置く。点が 一直線に3つ ならぶと 着地で
// 回り出すため）。平らな ところを ひろく とって、しっぽの 重さで うしろに ころがらないように
function fishBody(x0, x1, top, bottom, ped, noseY) {
  const L = x1 - x0;
  return pts([
    [x0, noseY],
    [x0 + L * 0.07, noseY - top * 0.5],
    [x0 + L * 0.2, -top * 0.85],
    [x0 + L * 0.4, -top],
    [x0 + L * 0.62, -top * 0.9],
    [x1 - L * 0.16, -(ped + (top - ped) * 0.45)],
    [x1, -ped],
    [x1, ped],
    [x1 - L * 0.1, ped + (bottom - ped) * 0.6],
    [x1 - L * 0.2, bottom],
    [x0 + L * 0.2, bottom],
    [x0 + L * 0.07, bottom * 0.75],
    [x0 + L * 0.015, noseY + bottom * 0.35],
  ].map(([x, y]) => [r2(x), r2(y)]));
}

// さかなを 1ぴき つくる。fins=からだの うしろに描く ひれ、pattern=からだの中の もよう、after=からだの上に描く もの
function makeFish(o) {
  const { x0, x1, top, bottom } = o;
  const ped = o.ped ?? 3.4;
  const L = x1 - x0;
  const body = o.body ?? fishBody(x0, x1, top, bottom, ped, o.noseY ?? 1);
  const tl = o.tailLen ?? 14;
  const th = o.tailH ?? r2(top * 0.82);
  const tb = Math.min(th, bottom - 2);
  const tail = o.tailPoints ?? pts([[x1 - 2, -ped + 0.4], [x1 + tl, -th], [x1 + tl, tb], [x1 - 2, ped - 0.4]]);
  return {
    color: o.color,
    line: o.line,
    ...(o.pad ? { pad: o.pad } : {}),
    parts: [{ points: tail, fill: o.tailColor ?? o.finColor }, { points: body }],
    draw(ctx, piece) {
      for (const f of o.fins ?? []) beak(ctx, f, o.finColor, o.line, 1.2);
      drawSilhouette(ctx, piece);
      if (o.fork) { // おびれの きれこみ（くりぬいて ふちを描きなおす）
        const tx = x1 + tl;
        const notch = [[tx + 1, -th * 0.6], [tx - o.fork, (tb - th) / 2], [tx + 1, tb * 0.6]];
        cut(ctx, () => poly(ctx, notch, '#000000'));
        line(ctx, notch, o.line, 1.6);
      }
      clipPart(ctx, piece.parts[0], () => o.tailPattern?.(ctx));
      clipPart(ctx, piece.parts[1], () => {
        if (o.back) oval(ctx, x0 + L * 0.5, -top, L * 0.62, top * 0.95, o.back);
        if (o.belly) oval(ctx, x0 + L * 0.48, bottom, L * 0.52, bottom * 0.55, o.belly);
        o.pattern?.(ctx);
        curve(ctx, [[x0 + L * 0.2, -top * 0.62], [x0 + L * 0.235, 0], [x0 + L * 0.19, bottom * 0.7]], 'rgba(0, 0, 0, 0.16)', 1.2); // えらぶた
      });
      if (o.pec !== false) pectoral(ctx, x0 + L * 0.25, bottom * 0.25, o.finColor, o.line, o.finEdge); // むなびれ
      if (o.finEdge) { // はらびれ（まえの ふちが しろ）
        const px = x0 + L * 0.5;
        beak(ctx, [[px, bottom - 3], [px + 6, bottom - 1.4], [px + 1, bottom - 0.6]], o.finColor, o.line, 1);
        line(ctx, [[px, bottom - 2.8], [px + 5.6, bottom - 1.5]], o.finEdge, 1.1);
      }
      o.after?.(ctx);
      const [ex, ey, er] = o.eye ?? [x0 + L * 0.13, -top * 0.22, 2.6];
      if (o.eyeColor) colorEye(ctx, ex, ey, er, o.eyeColor);
      else eye(ctx, ex, ey, er);
      cheek(ctx, ex + er * 1.3, ey + er * 2.1, 2.3, 1.4);
    },
  };
}

// ヤマメ・アマゴ・イワナ・オショロコマ・ニジマス・アユ の かたち（にているので 同じ大きさ）
const TROUT = { x0: -38, x1: 22, top: 12, bottom: 10, fork: 3 };
const TROUT_FINS = [[[-16, -11.5], [-10, -19], [-3, -11]]]; // せびれ

// ヤマメの パーマーク（よこに ならぶ だ円の もよう。ヤマメ・アマゴの しるし）と せなかの くろい てん
function parrMarks(ctx) {
  for (let i = 0; i < 8; i++) oval(ctx, -25 + i * 6.2, 0.5, 2.4, 4.4, 'rgba(72, 92, 130, 0.5)');
  for (const [x, y] of [[-20, -8], [-12, -9], [-4, -9], [4, -8], [12, -6], [-16, -5.5], [0, -6], [8, -4.5]]) dot(ctx, x, y, 0.9, '#2e3226');
  oval(ctx, -6, 3.4, 26, 2.4, 'rgba(240, 160, 160, 0.3)');
}

// むなびれ（えらの うしろから うしろへ ひろがる。edge を わたすと まえの ふちを その色に＝イワナの しろい ふち）
function pectoral(ctx, x, y, fill, stroke, edge) {
  beak(ctx, [[x, y - 1.2], [x + 7.5, y + 0.4], [x + 6.4, y + 3.8], [x, y + 1.4]], fill, stroke, 1);
  for (const t of [0.35, 0.7]) line(ctx, [[x + 0.6, y], [x + 6.6, y + 0.5 + t * 3.2]], stroke, 0.6);
  if (edge) line(ctx, [[x + 0.4, y - 0.9], [x + 7, y + 0.6]], edge, 1.2);
}

// おうぎ形の 大きな ひれ（カジカ・ヨシノボリの むなびれ）
function fanFin(ctx, x, y, r, a0, a1, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, r, a0, a1);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.1;
  ctx.stroke();
  for (let i = 1; i < 4; i++) {
    const a = a0 + ((a1 - a0) * i) / 4;
    line(ctx, [[x, y], [x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9]], stroke, 0.6);
  }
}

// あぶらびれ（サケの なかまの しるし。せなかの うしろの ちいさい ひれ）
function adiposeFin(ctx, x, y, fill, stroke) {
  ovalLine(ctx, x, y, 2.6, 1.8, fill, stroke, 1);
}

export const FRESH_PIECES = {
  // ---------- かんたん（平ら・ほそながい板） ----------

  // オオサンショウウオ: ひらたい 大きな あたま・ちいさな め・いぼいぼの まだら・ひらたい しっぽ
  giantSalamander: {
    color: '#6e5c46',
    line: '#3e3226',
    parts: [
      { points: flatBottom(ellipse(17, 11, { cx: -30, cy: 0, n: 20 }), 10) },          // ひらたい 大きな あたま（からだより すこし高い）
      { points: blob(54, 17, 7, 4, { cx: 0, cy: 1.5 }) },                              // からだ
      { points: pts([[24, -6], [48, -1], [48, 3], [24, 10]]) },                        // ひらたい しっぽ
    ],
    draw(ctx, piece) {
      for (const x of [-18, 16]) ovalLine(ctx, x, 8.5, 5.5, 2.6, '#5e4e3a', '#3e3226', 1.2); // みじかい あし
      drawSilhouette(ctx, piece);
      const spots = [[-38, -2, 3], [-26, -5, 2.4], [-20, 2, 3.4], [-10, -3, 2.8], [-2, 4, 2.4], [6, -4, 3.2], [14, 2, 2.6], [22, -3, 2.4], [30, 0, 2.6], [40, 0.5, 2]];
      for (const part of piece.parts) {
        clipPart(ctx, part, () => {
          for (const [x, y, r] of spots) oval(ctx, x, y, r * 1.3, r, '#4a3c2c');
          for (const [x, y] of [[-34, 3], [-22, -2], [-6, 0], [10, -1], [26, 3], [36, -2]]) dot(ctx, x, y, 0.9, '#9a886a'); // いぼ
        });
      }
      for (const [x, r] of [[-17, 0.6], [17, -0.6]]) { // みじかい あし
        ovalLine(ctx, x, 6.5, 3.2, 4.4, '#5e4e3a', '#3e3226', 1.2, r);
        for (const dx of [-2, 0, 2]) dot(ctx, x + dx + r * 3, 10, 0.8, '#3e3226');
      }
      dot(ctx, -37, -5, 1.6, INK); // ちいさな め（オオサンショウウオの しるし）
      dot(ctx, -37.4, -5.5, 0.5, '#ffffff');
      curve(ctx, [[-47, 4], [-38, 6.5], [-28, 5]], '#3e3226', 1.2); // 大きな くち
      cheek(ctx, -31, 2, 2.6, 1.5);
      shine(ctx, -30, -6, 6, 1.8);
    },
  },

  // スッポン: ひらたい やわらかい こうら・ながい くび・ブタのような はな
  softshellTurtle: {
    color: '#7a8a5c',
    line: '#46522e',
    parts: [
      { points: blob(46, 5, 2, 2, { cx: 4, cy: 12 }), fill: '#b8b890' },                // あし（板）
      { points: blob(58, 16, 8, 4, { cx: 4, cy: 3 }) },                                // ひらたい こうら
      { points: seg(-22, 4, -32, 1, 7), fill: '#a8aa80' },                             // ながい くび
      { points: ellipse(7, 5.5, { cx: -34, cy: 0, n: 14 }), fill: '#a8aa80' },          // あたま
      { points: pts([[-40, -2], [-47, -1.5], [-47, 1], [-40, 2]]), fill: '#a8aa80' },   // ブタのような はな（スッポンの しるし）
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        for (const x of [-10, 18]) line(ctx, [[x, 9], [x, 15]], '#8a8a60', 1.2); // あしの さかいめ
      });
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, 4, 10, 30, 3, '#98a878'); // やわらかい ふち
        for (const [x, y] of [[-12, -1], [-2, -3], [8, -2], [18, -1], [26, 2], [-6, 3], [12, 3]]) dot(ctx, x, y, 1.1, '#5a6a40');
      });
      dot(ctx, -46.6, -0.3, 0.8, INK); // はなの あな
      eye(ctx, -34, -1.6, 1.8);
      line(ctx, [[-40, 2.6], [-33, 3]], '#6a6a48', 1);
      cheek(ctx, -31, 2.5, 1.8, 1.2);
      shine(ctx, -4, -2, 8, 2);
    },
  },

  // イシガメ: ちゃいろの まるい こうら（きっこう もよう・うしろは ぎざぎざ）・つめの ある あし
  pondTurtle: {
    color: '#b0803e',
    line: '#6a4a1e',
    parts: [
      { points: blob(52, 8, 2, 3, { cx: 2, cy: 14 }), fill: '#8a8050' },                // あし（板）
      { points: blob(60, 26, 18, 4, { cx: 2, cy: 0 }) },                               // まるい こうら（上は すこし平ら）
      { points: ellipse(8, 7, { cx: -32, cy: 4, n: 16 }), fill: '#8a8050' },            // あたま
    ],
    draw(ctx, piece) {
      beak(ctx, [[29, 9], [38, 12], [29, 13]], '#8a8050', '#6a4a1e', 1.2); // しっぽ
      for (let x = 22; x <= 30; x += 4) beak(ctx, [[x, 11], [x + 3, 15], [x + 4, 10]], '#b0803e', '#6a4a1e', 1); // うしろの ぎざぎざ
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        for (const x of [-14, 18]) line(ctx, [[x, 10], [x, 18]], '#6e6640', 1.2);
        for (const x of [-22, -19, 10, 13]) dot(ctx, x, 16.5, 0.8, '#3a3420'); // つめ
      });
      clipPart(ctx, piece.parts[1], () => {
        for (const cx of [-12, 2, 16]) { // きっこう もよう（六角形）
          ctx.beginPath();
          ctx.moveTo(cx - 7, -3);
          for (const [dx, dy] of [[-3.5, -9], [3.5, -9], [7, -3], [3.5, 3], [-3.5, 3]]) ctx.lineTo(cx + dx, dy);
          ctx.closePath();
          ctx.fillStyle = '#c08a48';
          ctx.fill();
          ctx.strokeStyle = '#7a5426';
          ctx.lineWidth = 1.3;
          ctx.stroke();
        }
        line(ctx, [[-30, 7], [34, 7]], '#7a5426', 1.3); // ふちの ならび
        for (let x = -24; x <= 30; x += 6) line(ctx, [[x, 7], [x, 13]], '#7a5426', 1);
        for (const x of [-19, -5, 9, 23]) line(ctx, [[x, 0], [x, 7]], '#7a5426', 1);
      });
      colorEye(ctx, -34, 2, 2.4, '#e8c060');
      smile(ctx, -37, 7, 2);
      cheek(ctx, -30, 7, 2, 1.3);
      shine(ctx, -10, -8, 7, 2.2);
    },
  },

  // コイ（にしきごい・こうはく）: しろに あかい もよう・2本の ひげ・大きな おびれ
  carp: makeFish({
    x0: -36, x1: 20, top: 15, bottom: 12, tailLen: 16, tailH: 13, fork: 4,
    color: '#fbfaf6', line: '#b8aca4', finColor: '#f2ede6',
    fins: [[[-14, -14.5], [-8, -21], [10, -15], [12, -10.5]]], // ながい せびれ
    pattern(ctx) {
      oval(ctx, -20, -12, 11, 6, '#e8402a'); // あかい もよう
      oval(ctx, 2, -10, 10, 7, '#e8402a');
      oval(ctx, 14, -5, 5, 4, '#e8402a');
      for (let x = -14; x <= 16; x += 6) for (let y = -6; y <= 8; y += 5) scallop(ctx, x + (y % 2), y, 3, 'rgba(160, 120, 110, 0.35)');
    },
    after(ctx) {
      line(ctx, [[-35, 3], [-40, 7]], '#c8a8a0', 1.2); // ひげ（コイの しるし）
      line(ctx, [[-33, 4], [-35, 8.5]], '#c8a8a0', 1.2);
    },
  }),

  // フナ: たかさの ある からだ・おちついた みどりがかった ぎんいろ（ひげは ない）
  crucianCarp: makeFish({
    x0: -34, x1: 18, top: 16, bottom: 12, tailLen: 14, tailH: 12, fork: 4,
    color: '#cbc39c', line: '#6e6848', finColor: '#a8a07a', back: '#8a845e', belly: '#e6e0c4',
    fins: [[[-12, -15.5], [-6, -21], [8, -16], [10, -11]]],
    pattern(ctx) {
      for (let x = -20; x <= 14; x += 5) for (let y = -10; y <= 8; y += 4.5) scallop(ctx, x + (y > 0 ? 2.5 : 0), y, 2.6, 'rgba(70, 66, 40, 0.35)');
    },
  }),

  // カジカ: 大きな ひらたい あたま・大きな むなびれ・ちゃいろの まだら（そこに すむ）
  sculpin: {
    color: '#8a7a5a',
    line: '#4e4230',
    parts: [
      { points: pts([[-34, 10], [-34, 2], [-28, -8], [-16, -12], [0, -10], [18, -5], [26, -2], [26, 4], [18, 8], [4, 10]]) }, // からだ（下は平ら）
      { points: pts([[24, -2], [36, -7], [38, 0], [36, 7], [24, 4]]), fill: '#9a8a68' },  // まるい おびれ
    ],
    draw(ctx, piece) {
      beak(ctx, [[-12, -11.5], [-8, -16], [-2, -10.5]], '#9a8a68', '#4e4230', 1.1); // せびれ
      beak(ctx, [[0, -10], [4, -14.5], [18, -9], [20, -5]], '#9a8a68', '#4e4230', 1.1);
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        for (const x of [-18, -2, 14]) oval(ctx, x, -8, 5, 7, '#5e4e36'); // せなかの こい もよう
        for (const [x, y] of [[-26, 2], [-10, 4], [6, 3], [20, 2]]) dot(ctx, x, y, 1.4, '#6a5a40');
        oval(ctx, -8, 9, 28, 3, '#c8b890'); // おなか
      });
      fanFin(ctx, -19, 1, 12, -0.45, 0.85, '#a8946a', '#4e4230'); // 大きな むなびれ（カジカの しるし）
      eye(ctx, -25, -5, 2.4);
      curve(ctx, [[-34, 4], [-29, 6], [-24, 5]], '#4e4230', 1.2);
      cheek(ctx, -26, 1, 2.2, 1.4);
    },
  },

  // ウナギ: うみの いきもの と同じ絵・同じ形
  eel: SEA_PIECES.eel,

  // ドジョウ: ほそながい からだ・くちの まわりの たくさんの ひげ・まだら
  loach: {
    color: '#a8986e',
    line: '#5e5034',
    parts: [
      { points: blob(76, 16, 7, 5, { cx: -2, cy: 0 }) },                               // ほそながい からだ
      { points: pts([[34, -5], [44, -6], [46, 0], [44, 6], [34, 5]]), fill: '#9a8a60' }, // まるい おびれ
    ],
    draw(ctx, piece) {
      for (const [x, y] of [[-40, 1], [-40, 3], [-39, 5]]) line(ctx, [[x, y], [x - 6, y + (y - 3) * 1.4 + 1]], '#7a6a48', 1.1); // ひげ（ドジョウの しるし）
      beak(ctx, [[-2, -7.5], [3, -11], [8, -7.5]], '#9a8a60', '#5e5034', 1); // せびれ
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, -2, 7, 38, 3, '#d8ccaa'); // おなか
        for (let x = -30; x <= 30; x += 5) dot(ctx, x, -3 + ((x / 5) % 2) * 2.5, 1.2, '#6e5e40'); // まだら
      });
      eye(ctx, -33, -2.5, 1.8);
      cheek(ctx, -30, 2.5, 2, 1.3);
      shine(ctx, -10, -4, 10, 1.6);
    },
  },

  // ---------- ふつう（さかなが ふえる） ----------

  // ヤマメ: パーマーク（よこに ならぶ だ円の もよう）・せなかの くろい てん
  yamame: makeFish({
    ...TROUT, color: '#e6e2d2', line: '#5e6a5a', finColor: '#b8bca0', back: '#7a8a6a',
    fins: TROUT_FINS,
    pattern: parrMarks,
    tailPattern(ctx) { for (const [x, y] of [[28, -5], [31, 0], [29, 4]]) dot(ctx, x, y, 0.8, '#2e3226'); },
    after(ctx) { adiposeFin(ctx, 13, -7.5, '#b8bca0', '#5e6a5a'); },
  }),

  // アマゴ: ヤマメの もように あかい てん（アマゴの しるし）
  amago: makeFish({
    ...TROUT, color: '#e6e2d2', line: '#5e6a5a', finColor: '#c8c0a0', back: '#7a8a6a',
    fins: TROUT_FINS,
    pattern(ctx) {
      parrMarks(ctx);
      for (const [x, y] of [[-22, -3], [-14, 3.5], [-8, -2.5], [-1, 4], [6, -1.5], [12, 3], [-18, 1], [2, 0.5], [16, -1]]) dot(ctx, x, y, 1.25, '#e8503a');
    },
    after(ctx) { adiposeFin(ctx, 13, -7.5, '#e8b090', '#5e6a5a'); },
  }),

  // ニジマス: にじいろ（ももいろ）の おび・からだと しっぽに くろい てんてん
  rainbowTrout: makeFish({
    ...TROUT, color: '#e2e8e2', line: '#5a6a5e', finColor: '#b8c4b0', back: '#6f8f74',
    fins: TROUT_FINS,
    pattern(ctx) {
      oval(ctx, -6, 1.5, 32, 3.8, 'rgba(240, 110, 145, 0.6)'); // にじいろの おび（ニジマスの しるし）
      for (const [x, y] of [[-22, -7], [-16, -9], [-10, -6], [-4, -9], [2, -6], [8, -8], [14, -5], [-12, 4], [-2, 6], [6, 4], [14, 2], [18, -2], [-6, -3], [10, -2]]) dot(ctx, x, y, 0.85, '#2e3226');
    },
    tailPattern(ctx) { for (const [x, y] of [[26, -5], [30, -2], [33, -6], [28, 2], [32, 4], [34, 0]]) dot(ctx, x, y, 0.8, '#2e3226'); },
    after(ctx) { adiposeFin(ctx, 13, -7.5, '#b8c4b0', '#5a6a5e'); },
  }),

  // アユ: ほっそり・えらの うしろの きいろい てん・きいろっぽい ひれ・大きな せびれ
  ayu: makeFish({
    x0: -38, x1: 22, top: 10, bottom: 8, fork: 4,
    color: '#dcd6a8', line: '#6e6a40', finColor: '#e8d070', back: '#8e8c58', belly: '#f2eedc',
    fins: [[[-12, -9.5], [-6, -17], [2, -15], [4, -8.5]]],
    pattern(ctx) { oval(ctx, -21, -1.5, 3.8, 2.6, '#f5d030'); }, // きいろい てん（アユの しるし）
    after(ctx) { adiposeFin(ctx, 13, -6.5, '#e8d070', '#6e6a40'); },
  }),

  // オイカワ（はるの オス）: あおみどりと ももいろの たての しま・大きな しりびれ
  paleChub: makeFish({
    x0: -36, x1: 20, top: 12, bottom: 10, fork: 4,
    color: '#8ec8d2', line: '#3a6a74', finColor: '#f29a8a', back: '#4a8a9a',
    fins: [[[-8, -11.5], [-3, -18], [4, -11]], [[2, 7], [14, 6], [12, 11.5], [4, 11.5]]],
    pattern(ctx) {
      for (let i = 0; i < 6; i++) oval(ctx, -20 + i * 7.5, 1, 2.6, 11, '#f29a8a'); // ももいろの しま（オイカワの しるし）
      oval(ctx, -30, 4, 7, 6, '#e8806a');
      for (const [x, y] of [[-32, -2], [-29, -4], [-27, 0]]) dot(ctx, x, y, 0.7, '#3a3a3a');
    },
  }),

  // ウグイ（はるの すがた）: よこに 3本の あかい すじ
  dace: makeFish({
    x0: -36, x1: 22, top: 11, bottom: 9, fork: 4,
    color: '#c9cdd3', line: '#4c535c', finColor: '#d8605a', back: '#4c535c',
    fins: [[[-8, -10.5], [-3, -17], [4, -10]]],
    pattern(ctx) {
      curve(ctx, [[-28, -2], [-6, -3], [20, -2]], '#e8502a', 2.4); // あかい すじ（ウグイの しるし）
      curve(ctx, [[-26, 3], [-4, 3.6], [20, 2]], '#2e3238', 1.6);
      oval(ctx, -6, 9, 26, 3, '#e8502a');
    },
  }),

  // メダカ: ちいさい・大きな め・上むきの くち・うしろの せびれ
  medaka: makeFish({
    x0: -24, x1: 12, top: 8, bottom: 8, ped: 2.6, tailLen: 10, tailH: 7,
    color: '#e2d29a', line: '#8a7a40', finColor: '#ecdcaa', back: '#b0a064',
    eye: [-17.5, -2.6, 3],
    fins: [[[3, -6], [7, -10.5], [10, -5]]],
    pattern(ctx) { line(ctx, [[-12, 0.5], [12, 0.5]], '#9a8a50', 0.9); },
    after(ctx) {
      poly(ctx, [[-3, 6.5], [11, 5], [11, 7.6], [-3, 7.6]], '#ecdcaa'); // ながい しりびれ
      line(ctx, [[-24, -1], [-21, -1.8]], '#8a7a40', 1); // 上むきの くち
    },
  }),

  // ヨシノボリ: そこに すむ ハゼの なかま・ほおの あおい もよう・2つの せびれ
  goby: {
    color: '#c8b088',
    line: '#6e5a3e',
    parts: [
      { points: pts([[-32, 9], [-32, 1], [-27, -6], [-16, -9], [2, -8], [18, -4], [24, -2], [24, 3], [18, 7], [4, 9]]) }, // からだ（下は平ら）
      { points: pts([[22, -2], [34, -6], [36, 0], [34, 6], [22, 3]]), fill: '#d8c098' },  // まるい おびれ
    ],
    draw(ctx, piece) {
      beak(ctx, [[-12, -8.5], [-9, -15], [-4, -14], [-2, -8.5]], '#d8c098', '#6e5a3e', 1.1); // だい1せびれ
      beak(ctx, [[2, -8], [6, -12.5], [18, -7], [19, -4]], '#d8c098', '#6e5a3e', 1.1);       // だい2せびれ
      line(ctx, [[-11, -12], [-4, -12.5]], '#3a8ad0', 1.2); // せびれの あおい ふち
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        for (const x of [-14, -4, 6, 16]) oval(ctx, x, 1, 3.4, 3, '#8a6e48'); // よこの まだら
        oval(ctx, -6, 9, 26, 2.6, '#e8dcc0');
      });
      clipPart(ctx, piece.parts[1], () => line(ctx, [[35, -5], [37, 0], [35, 5]], '#f0a040', 1.6));
      curve(ctx, [[-28, 2], [-24, 1], [-20, 3]], '#3a8ad0', 1.2); // ほおの あおい もよう（ヨシノボリの しるし）
      curve(ctx, [[-27, 5], [-23, 4], [-19, 6]], '#3a8ad0', 1.1);
      fanFin(ctx, -17, 2.5, 7, -0.3, 0.9, '#d8c098', '#6e5a3e'); // むなびれ
      colorEye(ctx, -24, -3.5, 2.6, '#e8c050');
      cheek(ctx, -21, 4, 2, 1.2);
    },
  },

  // ---------- むずかしい（はさみ・あし・まるい子） ----------

  // イワナ: こい いろの からだに しろい てん・ひれの ふちが しろ
  iwana: makeFish({
    ...TROUT, color: '#8f8f72', line: '#46462e', finColor: '#a8906a', back: '#5e5e48', belly: '#ead8b4', finEdge: '#ffffff',
    fins: TROUT_FINS,
    pattern(ctx) {
      for (const [x, y] of [[-24, -5], [-18, -8], [-12, -4], [-6, -8], [0, -3], [6, -7], [12, -3], [16, -6], [-20, 1], [-10, 2], [0, 3], [10, 2], [18, 1], [-15, -1], [5, -1]]) dot(ctx, x, y, 1.1, '#f2eedc'); // しろい てん（イワナの しるし）
    },
    after(ctx) {
      adiposeFin(ctx, 13, -7.5, '#a8906a', '#46462e');
    },
  }),

  // オショロコマ: あかい てん・オレンジの おなか・ひれの ふちが しろ
  dollyVarden: makeFish({
    ...TROUT, color: '#878b68', line: '#44482e', finColor: '#e8905a', back: '#5a5e44', belly: '#f2a868', finEdge: '#ffffff',
    fins: TROUT_FINS,
    pattern(ctx) {
      for (const [x, y] of [[-22, -4], [-14, -7], [-8, -2], [-2, -6], [4, -1], [10, -5], [16, -2], [-18, 2], [-6, 3], [8, 2]]) {
        dot(ctx, x, y, 1.7, 'rgba(240, 230, 210, 0.6)');
        dot(ctx, x, y, 1.2, '#e8483a'); // あかい てん（オショロコマの しるし）
      }
    },
    after(ctx) {
      adiposeFin(ctx, 13, -7.5, '#c87a50', '#44482e');
    },
  }),

  // サワガニ: ちいさい かに（まえから）・あかちゃいろ・ハサミを あげる
  riverCrab: {
    color: '#c0502e',
    line: '#7a2c18',
    parts: [
      { points: blob(70, 4, 1.5, 1.5, { cy: 15 }) },                                   // あし（板）
      { points: blob(46, 28, 12, 9, { cy: -2 }) },                                     // こうら
      { points: ellipse(9, 7, { cx: -30, cy: -14, n: 16 }) },                          // ハサミ
      { points: ellipse(8, 6.5, { cx: 29, cy: -13, n: 16 }) },
    ],
    draw(ctx, piece) {
      for (const s of [-1, 1]) {
        for (let k = 0; k < 3; k++) leg(ctx, [[s * 20, 1 + k * 4], [s * 30, 5 + k * 3.6], [s * (33 - k * 3), 15.5]], '#d8784a', '#7a2c18', 2.2); // あし
        leg(ctx, [[s * 18, -6], [s * 24, -11]], '#d8784a', '#7a2c18', 2.6); // うで
      }
      for (const s of [-1, 1]) leg(ctx, [[s * 6, -15], [s * 7, -21]], '#d8784a', '#7a2c18', 1.8); // めの え
      silhouetteOf(ctx, piece, [1, 2, 3]);
      clipPart(ctx, piece.parts[1], () => oval(ctx, 0, -6, 16, 9, '#d06640'));
      for (const [s, cx, cy] of [[-1, -30, -14], [1, 29, -13]]) {
        line(ctx, [[cx + s * 8, cy - 1], [cx - s * 1, cy]], '#7a2c18', 1.3); // ハサミの きれめ
        dot(ctx, cx + s * 7, cy - 3, 1.2, '#f4e0d0');
      }
      for (const s of [-1, 1]) {
        dot(ctx, s * 7, -22, 3, '#ffffff');
        eye(ctx, s * 7, -22, 2.1);
      }
      smile(ctx, 0, 2, 3);
      cheek(ctx, -12, 0, 3, 1.8);
      cheek(ctx, 12, 0, 3, 1.8);
      shine(ctx, -8, -10, 6, 2.4);
    },
  },

  // ザリガニ: まっかな からだ・大きな ハサミ・ながい しょっかく・おうぎの しっぽ
  crayfish: {
    color: '#d8402a',
    line: '#8a2414',
    parts: [
      { points: blob(36, 4, 1.5, 1.5, { cy: 12 }) },                                   // あし（板）
      { points: blob(30, 16, 7, 5, { cx: -6, cy: 2 }) },                               // あたま・むね
      { points: pts([[8, -5], [30, -2], [30, 7], [8, 9]]) },                           // しっぽ（ふし）
      { points: pts([[28, -4], [40, -8], [40, 10], [28, 7]]) },                        // おうぎの しっぽ
      { points: ellipse(10, 6, { cx: -36, cy: -9, n: 16 }) },                          // 大きな ハサミ
      { points: seg(-18, -2, -28, -7, 5) },                                            // うで
    ],
    draw(ctx, piece) {
      for (let k = 0; k < 4; k++) leg(ctx, [[-12 + k * 6, 8], [-14 + k * 6, 13]], '#c83a24', '#8a2414', 1.5); // あし
      curve(ctx, [[-20, -3], [-30, -15], [-12, -21], [12, -18]], '#8a2414', 1); // ながい しょっかく
      curve(ctx, [[-19, -4], [-26, -12], [-10, -16], [6, -14]], '#8a2414', 1);
      ovalLine(ctx, -32, -15, 8, 4.6, '#b8301e', '#8a2414', 1.4, -0.2); // おくの ハサミ
      silhouetteOf(ctx, piece, [1, 2, 3, 4, 5]);
      line(ctx, [[-46, -9], [-34, -9]], '#8a2414', 1.2); // ハサミの きれめ
      for (const x of [-42, -38]) dot(ctx, x, -12, 0.9, '#f2a090');
      clipPart(ctx, piece.parts[2], () => { for (const x of [13, 18, 23]) line(ctx, [[x, -5], [x, 9]], '#a82e1a', 1.1); });
      clipPart(ctx, piece.parts[3], () => { for (const y of [-3, 1, 5]) line(ctx, [[30, y * 0.6], [40, y * 1.6]], '#a82e1a', 1); });
      eye(ctx, -18, -4, 2.2);
      cheek(ctx, -14, 2, 2.2, 1.4);
      shine(ctx, -8, -3, 5, 1.8);
    },
  },

  // アカハライモリ: くろい せなか・まっかな おなか（くろい てんてん）・たてに ひらたい しっぽ
  newt: {
    color: '#3a3430',
    line: '#1e1a18',
    parts: [
      { points: blob(36, 4, 1.5, 1.5, { cx: -6, cy: 12 }) },                           // あし（板）
      { points: blob(40, 12, 6, 5, { cx: -6, cy: 4 }) },                               // からだ
      { points: ellipse(9, 6.5, { cx: -30, cy: 3, n: 16 }) },                          // あたま
      { points: pts([[12, -1], [42, 0], [42, 5], [12, 9]]) },                          // しっぽ（床から うかせる）
    ],
    draw(ctx, piece) {
      for (const [x, d] of [[-20, -3], [-14, 3], [2, -3], [8, 3]]) leg(ctx, [[x, 8], [x + d * 0.4, 11], [x + d, 13.5]], '#3a3430', '#1e1a18', 2.2); // あし
      silhouetteOf(ctx, piece, [1, 2, 3]);
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, -6, 11, 22, 4.6, '#f0602a'); // まっかな おなか（アカハライモリの しるし）
        for (const x of [-20, -12, -4, 4]) dot(ctx, x, 8.6, 1, '#1e1a18');
      });
      clipPart(ctx, piece.parts[2], () => oval(ctx, -30, 9.5, 7, 2.6, '#f0602a'));
      line(ctx, [[13, 8], [40, 4.6]], '#e8702a', 1.4); // しっぽの したの オレンジ
      colorEye(ctx, -32, 1, 2.4, '#e8b040');
      smile(ctx, -36, 5.5, 1.8);
      cheek(ctx, -29, 5, 2, 1.2);
      shine(ctx, -10, 0, 8, 1.6);
    },
  },

  // ゲンゴロウ（上から見た ところ）: つやつやの くろみどり・まわりが きいろ・オールの ような うしろあし
  divingBeetle: {
    color: '#2e3a2a',
    line: '#141a12',
    parts: [
      { points: flatBottom(ellipse(26, 15, { cx: 2, cy: 0, n: 24 }), 13) },             // まるい からだ
      { points: ellipse(6, 7, { cx: -24, cy: 0, n: 14 }) },                             // あたま
    ],
    draw(ctx, piece) {
      for (const s of [-1, 1]) {
        leg(ctx, [[14, s * 9], [26, s * 12.5], [38, s * 11.5]], '#3a4632', '#141a12', 2.6); // オールの ような あし
        for (const x of [28, 32, 36]) line(ctx, [[x, s * 12], [x + 1, s * 14]], '#3a4632', 0.8); // あしの 毛
        leg(ctx, [[-12, s * 10], [-18, s * 12.5]], '#3a4632', '#141a12', 1.6);
        curve(ctx, [[-28, s * 3], [-34, s * 7], [-36, s * 11]], '#3a4632', 1); // しょっかく
      }
      silhouetteOf(ctx, piece, [0, 1]);
      clipPart(ctx, piece.parts[0], () => {
        ctx.beginPath();
        ctx.ellipse(2, 0, 24, 13.5, 0, 0, PI * 2);
        ctx.strokeStyle = '#e8c840'; // きいろい ふち（ゲンゴロウの しるし）
        ctx.lineWidth = 3;
        ctx.stroke();
        line(ctx, [[-10, 0], [28, 0]], '#141a12', 1.2); // はねの あわせめ
        curve(ctx, [[-10, -12], [-12, 0], [-10, 12]], '#141a12', 1.1);
      });
      eye(ctx, -26, -3.6, 1.7);
      eye(ctx, -26, 3.6, 1.7);
      shine(ctx, 0, -6, 10, 3);
    },
  },

  // タガメ（上から見た ところ）: ひらたい ちゃいろの からだ・かぎの ような まえあし
  waterBug: {
    color: '#8a6a44',
    line: '#4a3420',
    parts: [
      { points: blob(54, 4, 1.5, 1.5, { cx: 4, cy: 14 }) },                            // あし（板）
      { points: ellipse(30, 11, { cx: 6, cy: 0, n: 22 }) },                            // ひらたい からだ
      { points: pts([[-22, -5], [-32, 0], [-22, 5]]) },                                // あたま
    ],
    draw(ctx, piece) {
      for (const s of [-1, 1]) {
        leg(ctx, [[8, s * 8], [14, s * 13], [24, s * 15.5]], '#7a5a38', '#4a3420', 1.8); // なかあし・うしろあし
        leg(ctx, [[18, s * 7], [26, s * 12], [36, s * 15]], '#7a5a38', '#4a3420', 1.8);
        leg(ctx, [[-14, s * 7], [-26, s * 12], [-34, s * 8.5]], '#8a6a44', '#4a3420', 2.8); // かぎの ような まえあし（タガメの しるし）
        leg(ctx, [[-34, s * 8.5], [-30, s * 6]], '#8a6a44', '#4a3420', 2);
      }
      line(ctx, [[36, 0], [41, 0]], '#4a3420', 1.4); // こきゅうの くだ
      silhouetteOf(ctx, piece, [1, 2]);
      clipPart(ctx, piece.parts[1], () => {
        line(ctx, [[-4, 0], [36, 0]], '#5a4228', 1.2);
        curve(ctx, [[-6, -10], [-8, 0], [-6, 10]], '#5a4228', 1.1);
        for (const y of [-6, 6]) line(ctx, [[2, y], [30, y * 0.5]], '#a8845a', 1);
      });
      eye(ctx, -26, -3.4, 1.8);
      eye(ctx, -26, 3.4, 1.8);
      cheek(ctx, -23, -6.5, 1.8, 1.1);
      cheek(ctx, -23, 6.5, 1.8, 1.1);
      shine(ctx, 4, -5, 10, 2.2);
    },
  },

  // オタマジャクシ: まるい からだ・ながい しっぽ・大きな め
  tadpole: {
    color: '#4a4636',
    line: '#2a2820',
    parts: [
      { points: flatBottom(ellipse(15, 12, { cx: -12, cy: -1, n: 22 }), 7) },          // まるい からだ（下を広く平らに。しっぽの 重さで うしろに たおれないように）
      { points: pts([[-2, -3], [32, -1.5], [32, 1.5], [-2, 4]]) },                     // しっぽ（当たり判定は ほそく。床から うかせる）
    ],
    draw(ctx, piece) {
      ctx.beginPath(); // ひらひらの しっぽ
      ctx.moveTo(-2, -6);
      ctx.quadraticCurveTo(10, -9, 18, -4);
      ctx.quadraticCurveTo(28, 0, 36, -1);
      ctx.quadraticCurveTo(28, 3, 18, 3);
      ctx.quadraticCurveTo(8, 6, -2, 6);
      ctx.closePath();
      ctx.fillStyle = '#6a6450';
      ctx.fill();
      ctx.strokeStyle = '#2a2820';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      curve(ctx, [[0, 0], [14, -1], [26, 0], [34, -1]], '#4a4636', 1.4);
      silhouetteOf(ctx, piece, [0]);
      clipPart(ctx, piece.parts[0], () => {
        for (const [x, y] of [[-18, 4], [-10, 6], [-4, 2], [-14, 0]]) dot(ctx, x, y, 0.9, '#c8b070'); // きんいろの てん
      });
      dot(ctx, -19, -5, 3.6, '#ffffff');
      eye(ctx, -19, -5, 2.6);
      smile(ctx, -25, 1, 1.8);
      cheek(ctx, -16, 1, 2.2, 1.3);
      shine(ctx, -10, -8, 5, 2);
    },
  },

  // ---------- おとな（ながい・まるい・のりにくい子） ----------

  // イトウ: とても ながい・大きな あたまと くち・ちいさな くろい てん・うしろが あかい
  ito: makeFish({
    x0: -50, x1: 32, top: 13, bottom: 11, tailLen: 14, tailH: 11, fork: 3,
    color: '#b4a48a', line: '#5a5040', finColor: '#c87a5a', tailColor: '#c86a50', back: '#6a6050', belly: '#e8dcc8',
    fins: [[[-8, -12.5], [-2, -20], [6, -12]]],
    pattern(ctx) {
      oval(ctx, 26, 1, 22, 14, 'rgba(214, 96, 72, 0.45)'); // うしろの あか
      for (const [x, y] of [[-34, -6], [-26, -8], [-18, -5], [-10, -9], [-2, -6], [6, -8], [14, -4], [22, -6], [-22, 0], [-6, 1], [10, 0]]) {
        line(ctx, [[x - 1, y - 1], [x + 1, y + 1]], '#3a3228', 1); // ちいさな ×の てん
        line(ctx, [[x + 1, y - 1], [x - 1, y + 1]], '#3a3228', 1);
      }
    },
    after(ctx) {
      adiposeFin(ctx, 23, -8, '#c87a5a', '#5a5040');
      line(ctx, [[-50, 2], [-39, 4.5]], '#4a4032', 1.2); // 大きな くち
    },
  }),

  // アロワナ: ぎんいろの 大きな うろこ・上むきの くち・あごの 2本の ひげ・うしろの ながい ひれ
  arowana: makeFish({
    x0: -48, x1: 30, top: 13, bottom: 11,
    body: pts([[-48, -7], [-40, -11], [-20, -13], [10, -12], [24, -8], [30, -3], [30, 3], [24, 6], [10, 11], [-24, 11], [-38, 7], [-46, 0]]),
    tailPoints: pts([[28, -3], [44, -9], [47, 0], [44, 9], [28, 4]]),
    color: '#e2e6ec', line: '#7a8494', finColor: '#c8ccd8',
    eye: [-40, -6.5, 2.8],
    fins: [[[2, -11.5], [18, -15], [30, -5], [24, -6]], [[4, 10], [20, 11.8], [30, 5]]],
    pattern(ctx) {
      for (let x = -34; x <= 26; x += 7) for (let y = -8; y <= 8; y += 5.5) scallop(ctx, x + (y > 0 ? 3.5 : 0), y, 4, '#b4c0d2', 1.2); // 大きな うろこ
      oval(ctx, -6, 2, 30, 5, 'rgba(240, 190, 200, 0.35)');
    },
    after(ctx) {
      line(ctx, [[-46, -3], [-54, -9]], '#9aa4b4', 1.4); // あごの ひげ（アロワナの しるし）
      line(ctx, [[-45, -2], [-53, -5.5]], '#9aa4b4', 1.4);
      line(ctx, [[-48, -7], [-39, -3.5]], '#7a8494', 1.2); // 上むきの 大きな くち
    },
  }),

  // イワトコナマズ: ひらたい あたま・大きな くち・ながい ひげ・きいろっぽい まだら
  rockCatfish: makeFish({
    x0: -44, x1: 30, top: 11, bottom: 9,
    body: pts([[-44, 2], [-40, -6], [-30, -10], [-14, -11], [6, -9], [22, -5], [30, -2], [30, 3], [22, 6], [6, 9], [-30, 9], [-41, 6]]),
    tailPoints: pts([[28, -3], [40, -7], [42, 0], [40, 6], [28, 4]]),
    color: '#c8a868', line: '#5a4628', finColor: '#b8985a', belly: '#ecdcb0',
    eye: [-35, -4, 1.8],
    fins: [[[-10, -10.5], [-6, -15], [-2, -10]]],
    pec: true,
    pattern(ctx) {
      for (const [x, y, r] of [[-30, -5, 4], [-18, -7, 5], [-6, -4, 4], [6, -7, 4.6], [16, -3, 3.6], [-24, 2, 3], [0, 3, 3.4], [14, 3, 2.6], [24, -1, 2.6]]) oval(ctx, x, y, r * 1.2, r, '#6e5634'); // まだら（イワトコナマズの しるし）
      oval(ctx, 8, 7.5, 22, 1.8, '#a88a52'); // ながい しりびれ
    },
    after(ctx) {
      curve(ctx, [[-42, 0], [-50, -6], [-53, 1]], '#5a4628', 1.4); // ながい ひげ
      curve(ctx, [[-41, 1], [-48, -2], [-50, 4]], '#5a4628', 1.1);
      line(ctx, [[-41, 5], [-45, 9]], '#5a4628', 1);
      curve(ctx, [[-44, 3], [-38, 4.6], [-32, 3.6]], '#5a4628', 1.2); // 大きな くち
    },
  }),

  // ヤツメウナギ: ほそながい・めの うしろに 7つの あな（ヤツメの しるし）・まるい すいつく くち
  lamprey: {
    color: '#d8dce2',
    line: '#4a5868',
    parts: [{ points: [...ellipse(8, 8, { cx: -38, from: PI / 2, to: PI * 1.5, n: 8 }), ...pts([[30, -7], [46, -2], [46, 2], [30, 8]])] }],
    draw(ctx, piece) {
      beak(ctx, [[8, -7.5], [16, -11], [22, -7.2]], '#8a98a8', '#4a5868', 1); // せびれ（2つ）
      beak(ctx, [[24, -6.8], [34, -10], [44, -2.6]], '#8a98a8', '#4a5868', 1);
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, 0, -8, 50, 7, '#6e7e90'); // あおはいいろの せなか
        for (let i = 0; i < 7; i++) {
          dot(ctx, -30 + i * 3.2, -0.5, 1.4, '#c8d0da');
          dot(ctx, -30 + i * 3.2, -0.5, 0.9, '#2a3440'); // 7つの あな（ヤツメウナギの しるし）
        }
      });
      ovalLine(ctx, -45, 1, 2.4, 4, '#e2c0c0', '#4a5868', 1); // まるい くち
      eye(ctx, -37, -3, 2);
      cheek(ctx, -35, 2.5, 2, 1.2);
      shine(ctx, -6, -4, 12, 1.6);
    },
  },

  // モリアオガエル: きみどりの カエル（まえから）・しろい あわの たまごの上に すわる
  treeFrog: {
    color: '#6cc44a',
    line: '#3a8a2a',
    parts: [
      { points: flatBottom(ellipse(27, 13, { cy: 8, n: 22 }), 18) },                   // あわの たまご（モリアオガエルの しるし）
      { points: ellipse(18, 11, { cx: 0, cy: -10, n: 20 }) },                          // からだ
      { circle: [-10, -20, 5.5] },                                                     // め
      { circle: [10, -20, 5.5] },
    ],
    draw(ctx, piece) {
      const foam = piece.parts[0];
      strokePart(ctx, foam, '#cfc8b4', 3);
      clipPart(ctx, foam, () => {
        oval(ctx, 0, 8, 30, 16, '#fbf8ee');
        for (const [x, y, r] of [[-18, 6, 3], [-10, 12, 3.4], [-2, 5, 2.6], [6, 13, 3], [14, 6, 3.2], [20, 12, 2.6], [-20, 14, 2.4], [0, 15, 2.2]]) ovalLine(ctx, x, y, r, r, '#fffdf6', '#e4ddc8', 0.8); // あわ
      });
      for (const s of [-1, 1]) ovalLine(ctx, s * 18, -4, 7, 4, '#62b840', '#3a8a2a', 1.4, s * -0.4); // うしろあし
      silhouetteOf(ctx, piece, [1, 2, 3]);
      oval(ctx, 0, -5, 11, 5, '#d8eeb0'); // のど
      for (const s of [-1, 1]) {
        ovalLine(ctx, s * 12, 0, 4, 2.6, '#6cc44a', '#3a8a2a', 1.2); // まえあし
        for (const dx of [-2.4, 0, 2.4]) dot(ctx, s * 12 + dx, 1.8, 1, '#f5a050'); // ゆびの まるい きゅうばん
        colorEye(ctx, s * 10, -20.5, 3.6, '#e8902a');
      }
      smile(ctx, 0, -9, 4);
      cheek(ctx, -10, -11, 3, 1.8);
      cheek(ctx, 10, -11, 3, 1.8);
      shine(ctx, -6, -16, 4, 1.8);
    },
  },

  // タニシ: とがった まきがい・からの もよう・あしの まえに しょっかく
  mudSnail: {
    color: '#6a6a48',
    line: '#3a3a26',
    parts: [
      { points: blob(46, 8, 3, 3, { cx: -4, cy: 12 }), fill: '#9a8a70' },               // あし（からだ）
      { points: pts([[-14, 10], [-16, -2], [-6, -18], [6, -30], [12, -28], [18, -12], [16, 10]]) }, // とがった から
    ],
    draw(ctx, piece) {
      leg(ctx, [[-24, 9], [-32, 3]], '#9a8a70', '#3a3a26', 2.2); // しょっかく
      leg(ctx, [[-21, 9], [-26, 2]], '#9a8a70', '#3a3a26', 2);
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[1], () => {
        for (const [y0, y1] of [[-22, -16], [-10, -2], [2, 8]]) curve(ctx, [[-18, y0 + 4], [0, y1], [20, y0]], '#3a3a26', 1.6); // まきの すじ
        oval(ctx, 6, -10, 6, 14, 'rgba(160, 160, 110, 0.4)');
      });
      eye(ctx, -22, 10, 1.8);
      smile(ctx, -25, 13.5, 1.6);
      cheek(ctx, -18, 13, 1.8, 1.1);
      shine(ctx, 2, -12, 3, 6, 0.4);
    },
  },
};
