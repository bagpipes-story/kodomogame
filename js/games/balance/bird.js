// bird.js — とり つみき（v0.17.23。v0.17.25 で 18しゅ ふやして 48しゅ）
// うみ（sea.js）・どうぶつ（animal.js）と同じしくみ: 1わずつ「当たり判定の形（凸の部品）」と「絵の描き方」を持つ。
// みんな 左むき。立っている とりの あしは 当たり判定では1まいの だいけい（ほそい あしの すきまに 物が
// はさまるのを ふせぐ）、絵では2本の ほそい あし。サギの くびは 当たり判定は まっすぐの 板2まい、
// 絵は なめらかな S字（ふち→からだ→なかみ の順に描いて つなぎ目の線を消す）

import {
  ellipse, blob, pts, flatBottom,
  drawSilhouette, silhouetteOf, clipPart,
  oval, ovalLine, dot, poly, line, rrect,
  eye, cheek, shine, INK,
} from './kit.js';
import { ANIMAL_PIECES } from './animal.js';

const PI = Math.PI;
const r2 = (v) => Math.round(v * 100) / 100;

// 点を (cx,cy) のまわりに まわす（a>0 で右まわり。サギの からだを むね上がりに かたむける など）
function turn(points, a, cx = 0, cy = 0) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return points.map(({ x, y }) => ({
    x: r2(cx + (x - cx) * c - (y - cy) * s),
    y: r2(cy + (x - cx) * s + (y - cy) * c),
  }));
}

// ほそながい四角（くびの 当たり判定）。(x1,y1)→(x2,y2) を はば w で
function seg(x1, y1, x2, y2, w) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = (-(y2 - y1) / len) * (w / 2);
  const ny = ((x2 - x1) / len) * (w / 2);
  return pts([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]].map(([x, y]) => [r2(x), r2(y)]));
}

// なめらかな線（点の あいだを まるく つなぐ）。くび・かざりばね に使う
function curve(ctx, list, color, width) {
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
function leg(ctx, list, color, stroke, w = 2) {
  line(ctx, list, stroke, w + 1.6);
  line(ctx, list, color, w);
}

// あしゆび（左むき: まえに ながく、うしろに みじかく）
function foot(ctx, x, y, len, color, stroke, w = 1.8) {
  leg(ctx, [[x + len * 0.4, y], [x - len, y]], color, stroke, w);
}

// 2本あし（上の はしと 下の はしの x をならべる）
function legs(ctx, list, top, bottom, color, stroke, w, footLen, footColor = color, footStroke = stroke) {
  for (const [x0, x1] of list) {
    leg(ctx, [[x0, top], [x1, bottom]], color, stroke, w);
    foot(ctx, x1, bottom + 0.5, footLen, footColor, footStroke, w * 0.85);
  }
}

// ふちどりつきの多角形（くちばし・しっぽ）
function beak(ctx, list, fill, stroke, width = 1.2) {
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
function scallop(ctx, x, y, r, color, w = 1.1) {
  ctx.beginPath();
  ctx.arc(x, y, r, PI * 0.15, PI * 0.85);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.stroke();
}

// まわりを ふちどった め（くろい かおの上でも見えるように）
function ringEye(ctx, x, y, r, ring) {
  dot(ctx, x, y, r + 1.1, ring);
  eye(ctx, x, y, r);
}

// いろつきの め（あかい め・きいろい め）: いろ→くろめ→ひかり
function colorEye(ctx, x, y, r, iris) {
  dot(ctx, x, y, r, iris);
  dot(ctx, x, y, r * 0.52, INK);
  dot(ctx, x - r * 0.3, y - r * 0.35, r * 0.24, '#ffffff');
}

// サギの くび: 当たり判定の板とは別に、絵は なめらかな S字。ふち（下じき）を からだより先に描く
function neckUnder(ctx, list, w, stroke) {
  curve(ctx, list, stroke, w + 3);
}
function neckOver(ctx, list, w, color) {
  curve(ctx, list, color, w);
}

const WHITE_LINE = '#a6aeb7';

export const BIRD_PIECES = {
  // ---------- かんたん（すわる・うかぶ。おなかが平ら） ----------

  // すずめ: ふくらすずめ。ちゃいろの ぼうし・しろい ほっぺ・のどの くろ
  // （ほっぺの くろい てんは「2つめの め」に見えるので v0.17.24 で なくした）
  sparrow: {
    color: '#b98a5e',
    line: '#7a5534',
    parts: [{ points: flatBottom(ellipse(27, 19, { cx: 2, cy: -2, n: 24 }), 14) }], // まるい からだ（下は平ら）
    draw(ctx, piece) {
      beak(ctx, [[22, -6], [37, -13], [40, -7], [25, 4]], '#8a6440', '#7a5534', 1.6); // しっぽ
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, -2, 12, 25, 11, '#efe4d4'); // おなか
        oval(ctx, -12, -21, 17, 10, '#9a5530'); // ちゃいろの ぼうし
        oval(ctx, 13, -3, 14, 10, '#a0724a'); // つばさ
      });
      for (const [x, y] of [[6, -9], [12, -7], [18, -5], [9, -1], [15, 1]]) line(ctx, [[x, y], [x + 4, y + 2]], '#5e4028', 1.4);
      line(ctx, [[4, 5], [22, 3]], '#f3e7d6', 1.4); // つばさの しろい すじ
      oval(ctx, -11, -2.6, 7.5, 4.6, '#ffffff'); // しろい ほっぺ
      oval(ctx, -19.5, 3, 2.6, 3.2, INK); // のどの くろ
      beak(ctx, [[-23, -8], [-30, -5.8], [-23, -3.5]], '#5a5050', '#3a3030', 1);
      eye(ctx, -15, -10, 2.7);
      cheek(ctx, -14, 3, 2.6, 1.6);
      foot(ctx, -4, 13.5, 5, '#c79a7a', '#8a6450', 1.4);
      foot(ctx, 7, 13.5, 5, '#c79a7a', '#8a6450', 1.4);
      shine(ctx, -6, -15, 5, 2.4);
    },
  },

  // からす: まっくろ・ふとい くちばし。せなかは ひくめで 上に のせやすく
  crow: {
    color: '#3d4150',
    line: '#22252e',
    parts: [
      { points: blob(22, 8, 2, 2, { cx: 0, cy: 18 }) },                                      // あし（板）
      { points: ellipse(26, 14, { cx: 4, cy: 2, n: 22 }) },                                  // からだ
      { points: ellipse(12, 11, { cx: -17, cy: -9, n: 16 }) },                               // あたま
      { points: pts([[-26, -14], [-37, -11], [-41, -8], [-26, -4]]), fill: '#2b2e38' },      // くちばし
      { points: pts([[26, -3], [44, 3], [42, 9], [26, 8]]) },                                // しっぽ
    ],
    draw(ctx, piece) {
      legs(ctx, [[-3, -4], [7, 6]], 12, 21, '#3a3a40', '#1c1d22', 2.4, 5);
      silhouetteOf(ctx, piece, [1, 2, 3, 4]);
      clipPart(ctx, piece.parts[1], () => oval(ctx, 12, 0, 18, 11, '#30333f')); // つばさ
      for (const y of [-2, 3, 8]) line(ctx, [[4, y], [24, y + 2]], '#59627c', 1.2); // はねの つや
      line(ctx, [[-37, -10.5], [-27, -9]], '#4c5060', 1);
      ringEye(ctx, -19, -12, 3, '#ffffff');
      cheek(ctx, -15, -4, 2.8, 1.8);
      shine(ctx, -17, -17, 4, 2);
      shine(ctx, 6, -9, 7, 2.4);
    },
  },

  // カルガモ: うかんでいる。くちばしの さきが きいろ・かおに 2本の すじ・あおい はね
  spotbill: {
    color: '#9b7a58',
    line: '#5e4630',
    parts: [
      { points: blob(66, 26, 12, 6, { cx: 6, cy: 6 }) },                                     // からだ
      { points: ellipse(11, 12, { cx: -19, cy: -13, n: 16 }) },                              // あたま
      { points: pts([[-28, -16], [-41, -13], [-42, -9], [-28, -8]]), fill: '#3a3a3a' },      // くちばし
      { points: ellipse(10, 10, { cx: -16, cy: -2, n: 14 }) },                               // むね（あたまと からだを つなぐ）
    ],
    draw(ctx, piece) {
      beak(ctx, [[30, -4], [44, -12], [43, -3], [35, 2]], '#4e3a2a', '#5e4630', 1.4); // しっぽ
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, 18, -1, 19, 7, '#7d5e42'); // つばさ
        for (const [x, y] of [[-16, 8], [-8, 4], [0, 9], [-10, 13], [8, 13], [16, 11], [-2, 15], [24, 13]]) scallop(ctx, x, y, 3, '#7a5c40');
      });
      rrect(ctx, 12, -2.5, 13, 4.5, 1.5, '#3f6fd8', '#ffffff', 1.2); // あおい はね（カルガモの しるし）
      line(ctx, [[22, -5.5], [36, -4]], '#f4ece0', 1.6);
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, -19, -10, 12, 10, '#efe2c8'); // うすい いろの かお
        oval(ctx, -15, -26, 14, 7, '#4e3a2a'); // あたまの てっぺん
        curve(ctx, [[-30, -15], [-20, -15.5], [-9, -14]], '#5e4630', 1.8); // めを とおる すじ
        curve(ctx, [[-28, -10], [-19, -9], [-11, -8]], '#8a7058', 1.4); // ほっぺの すじ
      });
      eye(ctx, -20, -15, 2.6);
      oval(ctx, -39, -11, 3, 2.3, '#ffd43b'); // くちばしの きいろい さき
      cheek(ctx, -15, -5, 2.6, 1.6);
      shine(ctx, -22, -21, 3.6, 1.8);
    },
  },

  // オオバン: くろい からだ・しろい くちばしと ひたい・あかい め
  coot: {
    color: '#3f4048',
    line: '#24252b',
    parts: [
      { points: blob(58, 30, 15, 6, { cx: 6, cy: 4 }) },                              // からだ
      { points: ellipse(10, 10, { cx: -17, cy: -14, n: 16 }) },                        // あたま
      { points: pts([[-25, -16.5], [-36, -12], [-25, -8]]), fill: '#f4f2ea' },          // しろい くちばし
    ],
    draw(ctx, piece) {
      beak(ctx, [[28, -6], [40, -10], [38, -1]], '#33343b', '#24252b', 1.4); // しっぽ
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => oval(ctx, 14, -3, 19, 10, '#4c4e58')); // つばさ
      for (const [x, y] of [[8, -4], [16, -3], [24, -2]]) scallop(ctx, x, y, 3.4, '#5c5f6a');
      beak(ctx, [[-25, -8], [-36, -12], [-24, -21.5], [-21.5, -23.5], [-19.5, -21], [-21, -14]], '#f4f2ea', '#bdb9ad', 1); // しろい くちばしと ひたい（オオバンの しるし）
      colorEye(ctx, -18, -15, 3.2, '#d8343c');
      cheek(ctx, -14, -8, 2.6, 1.6);
      shine(ctx, -15, -21, 3.4, 1.8);
      shine(ctx, 4, -6, 7, 2.4);
    },
  },

  // ユリカモメ: しろい からだ・はいいろの つばさ・こげちゃの ずきん・あかい くちばし
  gull: {
    color: '#ffffff',
    line: '#98a2ad',
    parts: [
      { points: blob(64, 24, 12, 6, { cx: 6, cy: 6 }) },                              // からだ
      { points: ellipse(11, 10, { cx: -17, cy: -11, n: 16 }) },                        // あたま
      { points: pts([[-26, -13], [-38, -10.5], [-26, -8]]), fill: '#e2474b' },          // あかい くちばし
      { points: pts([[30, -4], [48, -1], [32, 4]]), fill: '#3a3c44' },                 // つばさの さき（くろ）
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => oval(ctx, 12, -4, 24, 9, '#c6cfd8')); // はいいろの つばさ
      line(ctx, [[0, 2], [28, 2]], '#ffffff', 1.4);
      dot(ctx, 42, -0.8, 1.3, '#ffffff');
      clipPart(ctx, piece.parts[1], () => oval(ctx, -20, -12, 11, 9.5, '#5b4436')); // こげちゃの ずきん
      ringEye(ctx, -18, -13, 2.4, '#ffffff');
      cheek(ctx, -15, -6, 2.6, 1.6);
      shine(ctx, -4, 0, 7, 2.4);
    },
  },

  // メジロ: うぐいすいろ・めの まわりが しろい・のどが きいろ
  whiteEye: {
    color: '#a8c43c',
    line: '#6c8a1e',
    parts: [{ points: flatBottom(ellipse(24, 18, { cy: -1, n: 24 }), 14) }],
    draw(ctx, piece) {
      beak(ctx, [[17, -4], [31, -11], [33, -6], [21, 4]], '#8aa82a', '#6c8a1e', 1.4); // しっぽ
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, -2, 13, 19, 10, '#f2efdc'); // おなか
        oval(ctx, -16, 2, 7, 5, '#f2dc3c'); // きいろい のど
        oval(ctx, 10, -2, 13, 9, '#8fae2a'); // つばさ
      });
      line(ctx, [[3, 2], [18, 1]], '#6c8a1e', 1.2);
      line(ctx, [[5, -4], [17, -5]], '#6c8a1e', 1.2);
      ovalLine(ctx, -12, -6, 4.8, 4.8, '#ffffff', '#d9dccf', 0.8); // しろい めの わ（メジロの しるし）
      eye(ctx, -12, -6, 2.6);
      beak(ctx, [[-22, -7], [-29, -5], [-22, -3]], '#55555c', '#3a3a40', 1);
      cheek(ctx, -9, 3, 2.6, 1.6);
      foot(ctx, -4, 13.5, 4.5, '#7a7a84', '#55555c', 1.4);
      foot(ctx, 6, 13.5, 4.5, '#7a7a84', '#55555c', 1.4);
      shine(ctx, -4, -13, 5, 2.4);
    },
  },

  // シジュウカラ: くろい あたま・しろい ほっぺ・むねの くろい ネクタイ
  tit: {
    color: '#f4f4ee',
    line: '#5f6b75',
    parts: [{ points: flatBottom(ellipse(25, 18, { cx: 1, cy: -1, n: 24 }), 14) }],
    draw(ctx, piece) {
      beak(ctx, [[19, -4], [33, -10], [35, -5], [23, 4]], '#6f7f8c', '#5f6b75', 1.4); // しっぽ
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, 14, -3, 17, 13, '#8c9ba6'); // せなか・つばさ
        oval(ctx, 3, -16, 8, 5, '#b9c94c'); // せなかの きみどり
        oval(ctx, -12, -14, 15, 11, '#2e3036'); // くろい あたま
        oval(ctx, -17, 0, 5, 4, '#2e3036'); // のど
        oval(ctx, -10, -5, 6.5, 4.4, '#ffffff'); // しろい ほっぺ
      });
      line(ctx, [[-16, 1], [-9, 14]], '#2e3036', 4.5); // ネクタイ（シジュウカラの しるし）
      line(ctx, [[6, -1], [22, 0]], '#ffffff', 1.4);
      ringEye(ctx, -15, -11, 2.4, '#ffffff');
      beak(ctx, [[-21.5, -9], [-28, -7], [-21.5, -5]], '#2e3036', '#1e2024', 1);
      cheek(ctx, -9, -3, 2.4, 1.5);
      foot(ctx, -3, 13.5, 4.5, '#7a7f8a', '#555a64', 1.4);
      foot(ctx, 7, 13.5, 4.5, '#7a7f8a', '#555a64', 1.4);
      shine(ctx, -8, -16, 4, 2);
    },
  },

  // ライチョウ: ふゆの まっしろ・あかい まゆ・ふわふわの あし
  // （めの まえの くろい すじ＝ふゆの オスの もようは、線1本だと 何か分からないので v0.17.24 で なくした）
  ptarmigan: {
    color: '#ffffff',
    line: '#a4abb6',
    parts: [{ points: flatBottom(ellipse(29, 21, { cx: 2, cy: -2, n: 24 }), 16) }],
    draw(ctx, piece) {
      beak(ctx, [[24, -2], [37, -6], [38, 1], [26, 6]], '#33353c', '#a4abb6', 1.4); // くろい しっぽ
      drawSilhouette(ctx, piece);
      for (const [x, y] of [[4, -9], [12, -7], [20, -5], [8, -1], [16, 1]]) scallop(ctx, x, y, 4, '#e1e5ec', 1.3);
      const fluff = [[-11, 15], [-8, 16], [-5, 15], [5, 15], [8, 16], [11, 15]]; // ふわふわの あし
      for (const [x, y] of fluff) dot(ctx, x, y, 3.3, '#cdd2da');
      for (const [x, y] of fluff) dot(ctx, x, y, 2.5, '#ffffff');
      ovalLine(ctx, -15, -15, 5, 2.4, '#ea3a4c', '#c42a3a', 1); // あかい まゆ（ライチョウの しるし）
      eye(ctx, -16, -10, 2.6);
      beak(ctx, [[-25, -8], [-31, -6], [-25, -4]], '#33353c', '#22242a', 1);
      cheek(ctx, -14, -1, 3, 1.8);
      shine(ctx, -6, -17, 6, 2.6);
    },
  },

  // ---------- v0.17.25 で ふえた とり（かんたん） ----------

  // シマエナガ: まっしろ まんまる・つぶらな め・ちいさな くちばし・ながい くろい しっぽ
  longTailedTit: {
    color: '#ffffff',
    line: '#b4bac4',
    parts: [
      { points: flatBottom(ellipse(19, 17, { cy: -1, n: 24 }), 13) },                   // まんまるの からだ
      { points: pts([[14, -6], [42, -10], [43, -6], [15, 1]]), fill: '#2e3036' },       // ながい しっぽ
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      line(ctx, [[17, -0.5], [42, -6.5]], '#ffffff', 1.1); // しっぽの しろい ふち
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, 15, -9, 7, 5, '#f6e2da'); // せなかの うすい ももいろ
        for (const y of [-8, -3, 2]) line(ctx, [[7, y], [20, y + 2]], '#2e3036', 1.6); // つばさの くろい すじ
      });
      for (const [x, y] of [[-16, -12], [-10, -16], [-3, -17]]) scallop(ctx, x, y, 2.6, '#e6e9ee', 1); // ふわふわの け
      eye(ctx, -9, -5, 2.2); // つぶらな め（シマエナガの しるし）
      beak(ctx, [[-18.5, -3], [-22, -1.8], [-18.5, -0.6]], '#2e3036', '#1e2024', 0.8);
      cheek(ctx, -10, 1.5, 2.6, 1.6);
      foot(ctx, -3, 12.5, 3.6, '#4a4a52', '#2e2e36', 1.2);
      foot(ctx, 5, 12.5, 3.6, '#4a4a52', '#2e2e36', 1.2);
      shine(ctx, -5, -12, 6, 2.6);
    },
  },

  // オシドリ（オス）: せなかの オレンジの「いちょうばね」（イチョウの はの形。v0.17.26 で とがった三角から なおした）・
  // めの上から うしろへ しろい すじ・オレンジの ほお・あかい くちばし
  mandarinDuck: {
    color: '#e9b77c',
    line: '#8a5a34',
    parts: [
      { points: blob(60, 24, 11, 6, { cx: 6, cy: 7 }) },                                // からだ
      { points: ellipse(11, 11, { cx: -17, cy: -12, n: 16 }) },                         // あたま
      { points: ellipse(10, 10, { cx: -14, cy: 0, n: 14 }) },                           // むね
      { points: pts([[-26, -14], [-35, -11], [-26, -8]]), fill: '#e8383d' },            // あかい くちばし
      { points: pts([[9, -4], [14, -4], [21, -12], [19, -17], [13, -19], [8, -16]]), fill: '#f08a3a' }, // いちょうばね（上が まるく ひろがる）
    ],
    draw(ctx, piece) {
      beak(ctx, [[30, -2], [42, -8], [41, 0], [34, 3]], '#4a3a30', '#8a5a34', 1.4); // しっぽ
      beak(ctx, [[6, -4], [10, -4], [15, -14], [11, -18.5], [5, -17], [3, -12]], '#d8742a', '#8a5a34', 1.4); // おくの いちょうばね（2まいで 1くみ）
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, 24, -4, 15, 6, '#4a3a30'); // せなか
        for (const x of [-6, 0, 6, 12]) line(ctx, [[x, 4], [x + 3, 15]], '#d39a60', 0.9); // わきの こまかい もよう
      });
      clipPart(ctx, piece.parts[2], () => oval(ctx, -16, 2, 10, 10, '#6e3a5c')); // むらさきの むね
      line(ctx, [[-6, -3], [-5, 9]], '#ffffff', 1.8); // むねの しろと くろの すじ
      line(ctx, [[-3.6, -3], [-2.6, 9]], INK, 1.4);
      clipPart(ctx, piece.parts[4], () => {
        for (const [x, y] of [[9.5, -15], [12.5, -17.5], [16, -17], [19, -13.5]]) line(ctx, [[11.5, -4], [x, y]], '#d06a20', 0.9); // いちょうばねの すじ
        curve(ctx, [[7, -16], [13, -20], [19.5, -17.5], [22, -12]], '#4a3a30', 2.4); // 上の ふち
      });
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, -16, -21, 12, 6, '#3a6a5a'); // みどりの かんむり
        oval(ctx, -16, -4, 10, 6, '#f08a3a'); // オレンジの ほおの はね
        for (const x of [-22, -18, -14, -10]) line(ctx, [[x, -8], [x + 1, -1]], '#d06a20', 0.9);
      });
      curve(ctx, [[-22, -15.5], [-14, -17], [-5, -14]], '#ffffff', 3.2); // しろい すじ（オシドリの しるし）
      eye(ctx, -19, -13, 2.4);
      dot(ctx, -33.5, -11, 1, '#f6e0c0'); // くちばしの さき
      shine(ctx, -20, -20, 3.4, 1.8);
    },
  },

  // カイツブリ: ちいさな まるい みずどり・くりいろの ほお・くちばしの つけねの きいろい てん
  grebe: {
    color: '#5a4636',
    line: '#33261c',
    parts: [
      { points: flatBottom(ellipse(18, 12, { cx: 4, cy: 3, n: 22 }), 12) },             // まるい からだ
      { points: ellipse(8.5, 8, { cx: -9, cy: -6, n: 16 }) },                           // あたま
      { points: pts([[-16, -7], [-23, -5.5], [-16, -4]]), fill: '#2e2620' },            // くちばし
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, 17, 0, 8, 8, '#7a6450'); // ふわふわの おしり
        oval(ctx, -8, 4, 6, 6, '#b0502a'); // くりいろの くび
        for (const [x, y] of [[4, -2], [10, -1], [16, 1]]) scallop(ctx, x, y, 3, '#73604e');
      });
      clipPart(ctx, piece.parts[1], () => oval(ctx, -9, -1, 8, 5.5, '#b0502a')); // くりいろの ほお
      oval(ctx, -15.5, -4.6, 1.6, 1.2, '#f2e27a'); // きいろい てん（カイツブリの しるし）
      colorEye(ctx, -10, -8, 2.4, '#f0d040');
      cheek(ctx, -6, -2, 2, 1.3);
      shine(ctx, -10, -12, 3, 1.5);
      shine(ctx, 4, -4, 5, 1.8);
    },
  },

  // ハクチョウ: まっしろ・ながい くび・きいろと くろの くちばし（みずに うかぶ）
  swan: {
    color: '#ffffff',
    line: WHITE_LINE,
    parts: [
      { points: blob(64, 24, 12, 6, { cx: 8, cy: 9 }) },                                // からだ
      { points: seg(-15, 2, -15, -24, 8) },                                             // くび
      { points: ellipse(8, 6.5, { cx: -18, cy: -27, n: 16 }) },                         // あたま
      { points: pts([[-25, -29.5], [-38, -25], [-25, -23.5]]), fill: '#f2c43a' },       // くちばし
    ],
    draw(ctx, piece) {
      const neck = [[-14, 4], [-12, -8], [-15, -18], [-17, -25]];
      beak(ctx, [[34, 0], [46, -6], [44, 3], [38, 6]], '#ffffff', WHITE_LINE, 1.6); // しっぽ
      neckUnder(ctx, neck, 8, WHITE_LINE);
      silhouetteOf(ctx, piece, [0, 2, 3]);
      neckOver(ctx, neck, 8, '#ffffff');
      clipPart(ctx, piece.parts[0], () => {
        for (const [x, y] of [[8, 2], [16, 1], [24, 2], [12, 7], [20, 7], [28, 6]]) scallop(ctx, x, y, 3.6, '#e2e6ec', 1.2); // はね
      });
      clipPart(ctx, piece.parts[3], () => poly(ctx, [[-31, -30], [-40, -25], [-31, -22]], '#2e3036')); // くちばしの さきは くろ
      eye(ctx, -19, -28, 2.2);
      cheek(ctx, -15, -24, 2, 1.3);
      shine(ctx, 10, 0, 8, 2.4);
    },
  },

  // キーウィ: まるい ちゃいろの からだ・ほそながい くちばし（したむき。床には つかない）・ふとい あし
  kiwi: {
    color: '#8a6a4a',
    line: '#5a4028',
    parts: [
      { points: blob(22, 8, 2, 2, { cx: 1, cy: 18 }) },                                 // あし（板）
      { points: ellipse(24, 18, { cx: 5, cy: -2, n: 24 }) },                            // まんまるの からだ
      { points: ellipse(8.5, 8, { cx: -16, cy: -8, n: 16 }) },                          // あたま
      { points: pts([[-23, -9], [-40, 6], [-38, 8], [-21, -4]]), fill: '#e2cfa6' },     // ながい くちばし
    ],
    draw(ctx, piece) {
      for (const [x0, x1] of [[-4, -6], [5, 5]]) {
        leg(ctx, [[x0, 12], [x1, 21]], '#c9b89a', '#8a7a5c', 3.2);
        foot(ctx, x1, 21.5, 5, '#c9b89a', '#8a7a5c', 2.2);
      }
      silhouetteOf(ctx, piece, [1, 2, 3]);
      clipPart(ctx, piece.parts[1], () => {
        for (let i = 0; i < 28; i++) { // ふわふわの け（きまった ならびの みじかい線）
          const x = -14 + ((i * 37) % 42);
          const y = -16 + ((i * 13) % 30);
          line(ctx, [[x, y], [x + 1.5, y + 3]], '#6e5236', 1);
        }
      });
      eye(ctx, -17, -10, 2);
      cheek(ctx, -13, -4, 2.2, 1.4);
      shine(ctx, 2, -14, 7, 2.4);
    },
  },

  // ---------- ふつう（立つ・たてながの子が ふえる） ----------

  // ムクドリ: ちゃいろっぽい くろ・しろい ほっぺ・オレンジの くちばしと あし
  starling: {
    color: '#6e5e55',
    line: '#42372f',
    parts: [
      { points: pts([[-6, 12], [8, 12], [11, 24], [-9, 24]]) },                        // あし（板）
      { points: ellipse(22, 14, { cx: 4, cy: 0, n: 20 }) },                            // からだ
      { points: ellipse(11, 10, { cx: -14, cy: -10, n: 16 }) },                        // あたま
      { points: pts([[-23, -13], [-36, -10], [-23, -7]]), fill: '#f4a53a' },            // くちばし
      { points: pts([[22, -5], [37, 2], [34, 8], [20, 6]]) },                          // しっぽ
    ],
    draw(ctx, piece) {
      legs(ctx, [[-2, -4], [5, 7]], 11, 23, '#f29a3a', '#b86a1e', 2.2, 5);
      silhouetteOf(ctx, piece, [1, 2, 3, 4]);
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, -4, 9, 16, 7, '#8a7a70'); // おなか
        oval(ctx, 11, -2, 14, 10, '#594a42'); // つばさ
      });
      clipPart(ctx, piece.parts[2], () => oval(ctx, -14, -13, 12, 9, '#3f3530')); // くろっぽい あたま
      oval(ctx, -11, -5, 6, 4.4, '#f2ede6'); // しろい ほっぺ
      for (const [x, y] of [[-13, -5], [-10, -3.5], [-9, -6]]) dot(ctx, x, y, 0.7, '#9a8a80');
      line(ctx, [[23, 4], [33, 6]], '#ffffff', 1.4); // こしの しろ
      dot(ctx, -34.5, -10, 1.3, '#5a4a40'); // くちばしの さき
      ringEye(ctx, -15, -12, 2.4, '#ffffff');
      cheek(ctx, -9, -1, 2.4, 1.5);
      shine(ctx, -14, -17, 3.6, 1.8);
    },
  },

  // カワセミ: せなかが あおい・おなかが オレンジ・ながい くちばし
  kingfisher: {
    color: '#2a8fd8',
    line: '#17588f',
    parts: [
      { points: flatBottom(ellipse(16, 17, { cx: -1, cy: 4, n: 24 }), 15) },             // からだ（下を広く平らに。大きな あたまと くちばしで まえに たおれないように）
      { points: ellipse(13, 12, { cx: -5, cy: -15, n: 18 }) },                          // 大きな あたま
      { points: pts([[-17, -18.5], [-38, -14], [-17, -10.5]]), fill: '#2e2e36' },       // ながい くちばし
    ],
    draw(ctx, piece) {
      beak(ctx, [[8, 10], [21, 14], [19, 19], [8, 17]], '#1f5f9a', '#17588f', 1.4); // みじかい しっぽ
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, -5, 11, 11, 13, '#f28a3c'); // オレンジの おなか
        oval(ctx, 11, 3, 8, 14, '#1d6fb4', -0.2); // つばさ
      });
      for (const [x, y] of [[9, -3], [12, 2], [8, 5], [13, 8], [10, 11]]) dot(ctx, x, y, 1, '#6fd8f4');
      curve(ctx, [[4, -11], [13, -4], [15, 8]], '#5ad6f2', 2); // せなかの みずいろ
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, -6, -11, 10, 3.4, '#f28a3c'); // めの下の オレンジ
        oval(ctx, -12, -5, 5, 3, '#ffffff'); // しろい のど
        for (const [x, y] of [[-9, -23], [-3, -24], [2, -22], [-6, -20], [0, -19], [4, -17]]) dot(ctx, x, y, 0.9, '#6fd8f4');
      });
      oval(ctx, 4, -8, 2.6, 2, '#ffffff'); // くびの しろい てん
      eye(ctx, -8, -16, 2.8);
      foot(ctx, -4, 17.5, 4.5, '#ea4a4a', '#a82e2e', 1.6);
      foot(ctx, 4, 17.5, 4.5, '#ea4a4a', '#a82e2e', 1.6);
      shine(ctx, -8, -23, 4, 2);
    },
  },

  // チドリ（コチドリ）: ちいさい・きいろい めの わ・くろい むねの おび（v0.17.24で 8わりの 大きさに）
  plover: {
    color: '#ffffff',
    line: '#7c6a56',
    parts: [
      { points: pts([[-4, 7], [6, 7], [8, 21], [-6, 21]]) },                           // あし（板）
      { points: ellipse(14.5, 9.5, { cx: 2.5, cy: 0, n: 20 }) },                        // からだ
      { points: ellipse(8, 7.2, { cx: -9, cy: -8, n: 16 }) },                           // あたま
      { points: pts([[13, -5], [24, -1.5], [13, 3]]) },                                 // しっぽ
    ],
    draw(ctx, piece) {
      legs(ctx, [[-1, -2.5], [3.5, 5]], 8, 20, '#e6c86a', '#a8893a', 1.6, 3.8);
      silhouetteOf(ctx, piece, [1, 2, 3]);
      clipPart(ctx, piece.parts[1], () => oval(ctx, 7, -5, 14.5, 6.5, '#b08a62')); // ちゃいろの せなか
      clipPart(ctx, piece.parts[3], () => oval(ctx, 18, -2.5, 8, 4, '#b08a62'));
      clipPart(ctx, piece.parts[2], () => {
        oval(ctx, -6.5, -14.5, 9, 5, '#b08a62'); // ちゃいろの あたま
        line(ctx, [[-15.5, -11.5], [-3, -12.5]], INK, 1.7); // ひたいの くろ
        oval(ctx, -9.5, -7.2, 7.2, 2.1, INK); // めの くろい すじ
      });
      curve(ctx, [[-15, -1], [-9, 1.6], [-1.5, 0], [3, -3]], INK, 2.5); // むねの くろい おび
      colorEye(ctx, -9.5, -8, 2.8, '#ffd43b');
      dot(ctx, -9.5, -8, 1.6, INK);
      dot(ctx, -10, -8.6, 0.6, '#ffffff');
      beak(ctx, [[-16, -8], [-21.6, -6.8], [-16, -5.6]], '#33333a', '#22222a', 1);
      cheek(ctx, -6.5, -3.2, 2, 1.2);
    },
  },

  // シギ（セイタカシギ）: とても ながい ピンクの あし・くろい せなかと つばさ・しろい からだ・ほそい くちばし
  // （v0.17.24。あしの板は 重さの中心の真下。板が ながいぶん 下が重く、せが高くても たおれにくい）
  sandpiper: {
    color: '#ffffff',
    line: '#8a939e',
    parts: [
      { points: pts([[-3, -6], [5, -6], [11, 38], [-9, 38]]) },                         // ながい あし（板）
      { points: ellipse(18, 9, { cx: 4, cy: -12, n: 20 }) },                            // からだ
      { points: ellipse(7.5, 7, { cx: -12, cy: -19, n: 16 }) },                         // あたま
      { points: pts([[-18, -20.5], [-38, -18], [-18, -17.5]]), fill: '#2e3036' },       // ほそながい くちばし
      { points: pts([[18, -15], [36, -11], [20, -7]]), fill: '#2a2c34' },               // つばさの さき（くろ）
    ],
    draw(ctx, piece) {
      legs(ctx, [[0, -3], [6, 7]], -5, 37, '#f28aa0', '#c0566c', 1.8, 4.5); // ながい ピンクの あし（セイタカシギの しるし）
      silhouetteOf(ctx, piece, [1, 2, 3, 4]);
      clipPart(ctx, piece.parts[1], () => oval(ctx, 10, -16, 16, 7, '#2a2c34')); // くろい せなかと つばさ
      clipPart(ctx, piece.parts[2], () => oval(ctx, -6, -24, 6, 4, '#dfe3e8')); // うしろあたまの うすい はいいろ
      colorEye(ctx, -14, -20.5, 2.4, '#e2383c');
      cheek(ctx, -10.5, -15.5, 2.2, 1.4);
      shine(ctx, -2, -8, 5, 1.8);
    },
  },

  // カワウ: つばさを ひろげて かわかしている（カワウの おなじみの ポーズ）
  cormorant: {
    color: '#353840',
    line: '#1d1f25',
    parts: [
      { points: blob(26, 6, 2, 2, { cy: 22 }) },                                       // みずかき（板）
      { points: flatBottom(ellipse(12, 21, { cy: 2, n: 20 }), 21) },                   // からだ
      { points: pts([[-8, -12], [-40, -20], [-37, -6], [-10, 4]]) },                    // ひだりの つばさ
      { points: pts([[8, -12], [10, 4], [37, -6], [40, -20]]) },                        // みぎの つばさ
      { points: seg(0, -14, -1, -27, 8) },                                             // くび
      { points: ellipse(7.5, 6.5, { cx: -2, cy: -30, n: 14 }) },                       // あたま
      { points: pts([[-8, -31.5], [-21, -29], [-8, -26]]), fill: '#5a5a62' },           // くちばし
    ],
    draw(ctx, piece) {
      rrect(ctx, -13, 20.5, 11, 4.5, 1.5, '#2a2c32', '#1d1f25', 1.2); // みずかき
      rrect(ctx, 2, 20.5, 11, 4.5, 1.5, '#2a2c32', '#1d1f25', 1.2);
      silhouetteOf(ctx, piece, [1, 2, 3, 4, 5, 6]);
      for (const s of [-1, 1]) {
        clipPart(ctx, piece.parts[s < 0 ? 2 : 3], () => {
          oval(ctx, s * 17, -6, 10, 10, '#5f5446'); // ブロンズいろの はね
          for (const [x, y] of [[12, -10], [18, -11], [14, -5], [20, -6], [16, 0]]) scallop(ctx, s * x, y, 2.6, '#2e2a24');
          for (let k = 0; k < 4; k++) line(ctx, [[s * (25 + k * 4), -17 - k * 0.6], [s * (23 + k * 4), -6 - k * 0.9]], '#50545e', 1.1);
        });
      }
      clipPart(ctx, piece.parts[5], () => {
        oval(ctx, -2, -25, 5.5, 4, '#f4f4ee'); // しろい ほっぺ
        oval(ctx, -7.5, -29, 2.6, 2.4, '#f2c53a'); // くちばしの つけねの きいろ
      });
      line(ctx, [[-21, -29], [-21.5, -27.2]], '#5a5a62', 1.6); // まがった くちばしの さき
      colorEye(ctx, -3, -32, 2.6, '#33b58c');
      cheek(ctx, 2, -27, 2.2, 1.4);
      shine(ctx, -4, -6, 2.6, 6, 0);
    },
  },

  // コアジサシ: とても ちいさい（v0.17.24で 6わりの 大きさに）。すなの上に すわる。くろい ぼうし・きいろい くちばし・ながい つばさ
  tern: {
    color: '#ffffff',
    line: '#98a2ad',
    parts: [
      { points: blob(34, 13, 6, 4, { cx: 2.4, cy: 2.4 }) },                            // からだ
      { points: ellipse(6.2, 5.8, { cx: -10.2, cy: -4.8, n: 16 }) },                    // あたま
      { points: pts([[-15, -6], [-24, -4.2], [-15, -3]]), fill: '#ffd43b' },            // きいろい くちばし
      { points: pts([[15.6, -3.6], [27.6, -1.8], [16.8, 1.8]]), fill: '#d6dde4' },      // ながい つばさの さき
    ],
    draw(ctx, piece) {
      for (const [y1, y2] of [[-1.2, -5.4], [0, -3]]) { // ふたまたの しっぽ
        line(ctx, [[18, y1], [26.4, y2]], '#b8c0c8', 2);
        line(ctx, [[18, y1], [26.4, y2]], '#ffffff', 0.9);
      }
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => oval(ctx, 6, -1.8, 13.2, 4.8, '#d6dde4')); // はいいろの つばさ
      line(ctx, [[18, -2], [27, -1.8]], '#3a3c44', 1.2);
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, -7.8, -8.4, 6.6, 4.2, '#2e3036'); // くろい ぼうし（ひたいは しろ）
        line(ctx, [[-15.6, -5.4], [-9.6, -6]], '#2e3036', 1.4);
      });
      ringEye(ctx, -10.2, -6.3, 1.6, '#ffffff');
      dot(ctx, -22.8, -4.2, 0.9, INK); // くちばしの さき
      foot(ctx, -3.6, 8.6, 2.6, '#f29a3a', '#b86a1e', 1.2);
      foot(ctx, 2.4, 8.6, 2.6, '#f29a3a', '#b86a1e', 1.2);
      cheek(ctx, -7.8, -1.8, 1.6, 1);
      shine(ctx, -1, 1, 4, 1.4);
    },
  },

  // ツノメドリ: しろい かお・3しょくの 大きな くちばし・めの上の つの
  puffin: {
    color: '#2f3138',
    line: '#1b1c21',
    parts: [
      { points: blob(38, 44, 15, 7, { cx: 1, cy: 6 }) },                               // からだ
      { points: ellipse(14, 13, { cx: -1, cy: -16, n: 18 }) },                          // あたま
      { points: pts([[-12, -23], [-29, -14], [-12, -8]]), fill: '#f2683a' },            // 大きな くちばし
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, -4, 13, 11, 15, '#ffffff'); // しろい おなか
        oval(ctx, 14, 6, 7, 15, '#26272d'); // つばさ
      });
      clipPart(ctx, piece.parts[1], () => oval(ctx, -4, -14, 10, 9, '#e9ebee')); // しろい かお
      clipPart(ctx, piece.parts[2], () => {
        poly(ctx, [[-12, -24], [-16.5, -21.5], [-16.5, -9.5], [-12, -7]], '#8794ad'); // つけねの あおはいいろ
        line(ctx, [[-17, -21], [-17, -10]], '#f9d23c', 1.6);
        line(ctx, [[-21.5, -18], [-21.5, -11]], '#ffb08a', 1);
      });
      poly(ctx, [[-5.5, -21], [-3, -25], [-0.5, -21]], '#5a5f6a'); // めの上の つの（ツノメの しるし）
      colorEye(ctx, -3, -18, 2.8, '#e8584a');
      dot(ctx, -3, -18, 1.6, INK);
      line(ctx, [[0, -17], [5, -16]], '#9aa0aa', 1);
      cheek(ctx, -7, -10, 2.6, 1.6);
      ovalLine(ctx, -6, 27.5, 6, 2.4, '#f28a3a', '#c8642a', 1.2); // あし
      ovalLine(ctx, 9, 27.5, 6, 2.4, '#f28a3a', '#c8642a', 1.2);
      shine(ctx, -4, -25, 4, 2);
    },
  },

  // エトピリカ: まっくろ・しろい かお・あかい くちばし・きいろの ながい かざりばね
  tuftedPuffin: {
    color: '#2a2c32',
    line: '#17181c',
    parts: [
      { points: blob(38, 44, 15, 7, { cx: 1, cy: 6 }) },                               // からだ
      { points: ellipse(14, 13, { cx: -1, cy: -16, n: 18 }) },                          // あたま
      { points: pts([[-12, -22], [-30, -13], [-12, -7]]), fill: '#f2552e' },            // あかい くちばし
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, -4, 12, 11, 15, '#3b3d45'); // おなか
        oval(ctx, 14, 6, 7, 15, '#202227'); // つばさ
      });
      clipPart(ctx, piece.parts[1], () => oval(ctx, -5, -15, 9, 7.5, '#f6f4ee')); // しろい かお
      clipPart(ctx, piece.parts[2], () => poly(ctx, [[-12, -23], [-15.5, -21], [-15.5, -8.5], [-12, -6]], '#d8c25a'));
      for (const [list, w] of [[[[-2, -20.5], [6, -21], [12, -18], [17, -12]], 2], [[[-1, -19], [6, -18], [11, -14], [14, -8]], 1.6]]) { // かざりばね（エトピリカの しるし）
        curve(ctx, list, '#d4bc72', w + 1.3);
        curve(ctx, list, '#f8eab4', w);
      }
      colorEye(ctx, -4, -17, 2.8, '#f0ead0');
      cheek(ctx, -8, -11, 2.6, 1.6);
      ovalLine(ctx, -6, 27.5, 6, 2.4, '#f28a3a', '#c8642a', 1.2); // あし
      ovalLine(ctx, 9, 27.5, 6, 2.4, '#f28a3a', '#c8642a', 1.2);
      shine(ctx, 6, -24, 3.4, 1.8);
    },
  },

  // ---------- v0.17.25 で ふえた とり（ふつう） ----------

  // ハクセキレイ: しろい かお・めを とおる くろい すじ・くろい むね・はいいろの せなか・ながい しっぽ
  wagtail: {
    color: '#ffffff',
    line: '#6a7078',
    parts: [
      { points: pts([[-2, 9], [8, 9], [11, 24], [-5, 24]]) },                           // あし（板）
      { points: turn(ellipse(16, 9, { cx: 2, cy: 0, n: 20 }), 0.1, 2, 0) },             // からだ
      { points: ellipse(8, 7.5, { cx: -12, cy: -7, n: 16 }) },                          // あたま
      { points: pts([[14, -4], [38, -9], [39, -5], [16, 3]]), fill: '#2e3036' },        // ながい しっぽ
    ],
    draw(ctx, piece) {
      legs(ctx, [[0, -2], [5, 6]], 8, 23, '#2e3036', '#1e2024', 1.6, 4);
      silhouetteOf(ctx, piece, [1, 2, 3]);
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, 6, -5, 14, 6, '#8a9098'); // はいいろの せなか
        oval(ctx, -9, -1, 6, 6, '#2e3036'); // くろい むね
        oval(ctx, 10, 0, 9, 4, '#2e3036'); // つばさ
        line(ctx, [[4, 1], [16, 2]], '#ffffff', 1.4); // つばさの しろい すじ
      });
      line(ctx, [[17, 1.5], [38, -5.4]], '#ffffff', 1.1); // しっぽの しろい ふち
      clipPart(ctx, piece.parts[2], () => {
        oval(ctx, -9, -13, 9, 5, '#2e3036'); // くろい あたま
        oval(ctx, -10, 0.5, 7, 3.5, '#2e3036');
        line(ctx, [[-18, -7.5], [-5, -6.5]], '#2e3036', 1.4); // めを とおる くろい すじ
      });
      ringEye(ctx, -13, -7.5, 2, '#ffffff');
      beak(ctx, [[-19.5, -7], [-25, -6], [-19.5, -5]], '#2e3036', '#1e2024', 1);
      cheek(ctx, -10, -3, 2, 1.3);
    },
  },

  // ルリビタキ（オス）: るりいろの せなかと あたま・しろい のど・オレンジの わき
  bluetail: {
    color: '#f6f6f2',
    line: '#3a5a9a',
    parts: [{ points: flatBottom(ellipse(22, 17, { cx: 1, cy: -1, n: 24 }), 13) }],
    draw(ctx, piece) {
      beak(ctx, [[17, -5], [32, -11], [34, -5], [21, 3]], '#3a6ad0', '#2a4a90', 1.4); // あおい しっぽ
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, 6, -12, 22, 12, '#3a6ad0'); // るりいろの あたまと せなか
        oval(ctx, 5, 5, 8, 4.2, '#f5a040'); // オレンジの わき（ルリビタキの しるし。つばさの下）
        oval(ctx, 13, -1, 12, 8, '#2f58b0'); // つばさ
      });
      line(ctx, [[-16, -10.5], [-8, -12]], '#dfe8ff', 1.2); // うすい しろの まゆ
      eye(ctx, -12, -6.5, 2.6);
      beak(ctx, [[-20, -6], [-26, -4.4], [-20, -2.8]], '#2e3036', '#1e2024', 1);
      cheek(ctx, -10, 1, 2.4, 1.5);
      foot(ctx, -3, 12.5, 4.5, '#4a4a52', '#2e2e36', 1.4);
      foot(ctx, 6, 12.5, 4.5, '#4a4a52', '#2e2e36', 1.4);
      shine(ctx, -4, -14, 5, 2.4);
    },
  },

  // フクロウ: どうぶつ つみき と同じ絵・同じ形
  owl: ANIMAL_PIECES.owl,

  // ニワトリ: まっしろ・あかい とさかと にくだれ・きいろい くちばしと あし・はねあがった しっぽ
  chicken: {
    color: '#ffffff',
    line: '#a9aeb6',
    parts: [
      { points: pts([[-4, 12], [8, 12], [11, 26], [-7, 26]]) },                         // あし（板）
      { points: ellipse(20, 15, { cx: 3, cy: 0, n: 22 }) },                             // からだ
      { points: seg(-9, -2, -11, -14, 11) },                                            // くび
      { points: ellipse(9, 9, { cx: -12, cy: -17, n: 16 }) },                           // あたま
      { points: pts([[-20, -19], [-27, -16], [-20, -14]]), fill: '#f5b82a' },           // くちばし
      { points: pts([[14, -10], [26, -24], [32, -14], [22, 2]]) },                      // しっぽ
    ],
    draw(ctx, piece) {
      legs(ctx, [[0, -2], [6, 8]], 11, 25, '#f5b82a', '#b8861a', 2.4, 5.5);
      for (const [x, y, r] of [[-16, -25, 3.4], [-12, -27.5, 3.8], [-7.5, -26, 3.2]]) ovalLine(ctx, x, y, r, r, '#e8303a', '#b82028', 1.2); // とさか
      silhouetteOf(ctx, piece, [1, 2, 3, 4, 5]);
      clipPart(ctx, piece.parts[1], () => {
        for (const [x, y] of [[6, -6], [12, -4], [9, 1], [15, 2]]) scallop(ctx, x, y, 4, '#e2e6ec', 1.2); // はね
      });
      clipPart(ctx, piece.parts[5], () => {
        for (const k of [0, 1, 2]) curve(ctx, [[16 + k * 3, -2], [22 + k * 3, -14], [26 + k * 2, -20]], '#e2e6ec', 1.1);
      });
      ovalLine(ctx, -18, -10.5, 2.4, 3.6, '#e8303a', '#b82028', 1); // あかい にくだれ
      eye(ctx, -13, -18, 2.4);
      cheek(ctx, -9, -13, 2.2, 1.4);
      shine(ctx, 0, -10, 7, 2.4);
    },
  },

  // ヤンバルクイナ: くろい かおと むね（しろい しま）・あかい くちばし・あかい あし・あかい め
  okinawaRail: {
    color: '#6a5a3a',
    line: '#3a3020',
    parts: [
      { points: pts([[-5, 10], [7, 10], [10, 26], [-8, 26]]) },                         // あし（板）
      { points: ellipse(19, 13, { cx: 4, cy: 0, n: 22 }) },                             // からだ
      { points: ellipse(9, 8.5, { cx: -11, cy: -10, n: 16 }) },                         // あたま
      { points: pts([[-18, -13], [-31, -9.5], [-18, -6]]), fill: '#e8383d' },           // あかい ふとい くちばし
    ],
    draw(ctx, piece) {
      legs(ctx, [[0, -2], [6, 8]], 9, 25, '#e8484a', '#a82e2e', 2.4, 5.5);
      beak(ctx, [[20, -4], [28, -2], [21, 3]], '#4a4030', '#3a3020', 1.2); // しっぽ
      silhouetteOf(ctx, piece, [1, 2, 3]);
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, -6, 6, 14, 10, '#2a2a2e'); // くろい むね・おなか
        for (const y of [2, 6, 10]) for (const x of [-12, -6, 0]) line(ctx, [[x, y], [x + 4, y]], '#ffffff', 1.1); // しろい しまもよう
      });
      clipPart(ctx, piece.parts[2], () => {
        oval(ctx, -13, -4, 9, 8, '#2a2a2e'); // くろい かお
        curve(ctx, [[-10, -9], [-4, -8], [2, -5]], '#ffffff', 1.6); // めの うしろの しろい すじ
      });
      colorEye(ctx, -12, -11, 2.6, '#e2383c');
      dot(ctx, -29.5, -9.5, 1, '#f6e0c0'); // くちばしの さき
      cheek(ctx, -8, -5, 2.2, 1.4);
      shine(ctx, 6, -9, 6, 2);
    },
  },

  // ---------- むずかしい（サギの なかま・せが高い） ----------

  // ゴイサギ: ずんぐり・くびが みじかい・こん色の せなか・あかい め・しろい かざりばね
  nightHeron: {
    color: '#b8c0c9',
    line: '#6c7682',
    parts: [
      { points: pts([[-6, 12], [8, 12], [11, 30], [-11, 30]]) },                       // あし（板）
      { points: turn(ellipse(22, 15, { cx: 5, cy: 0, n: 20 }), 0.15, 5, 0) },          // からだ
      { points: ellipse(12, 11, { cx: -13, cy: -13, n: 16 }) },                         // あたま
      { points: pts([[-23, -16], [-37, -12.5], [-23, -9]]), fill: '#2b2e36' },          // くちばし
    ],
    draw(ctx, piece) {
      legs(ctx, [[0, -3], [7, 9]], 11, 29, '#e8c94a', '#a8892a', 2.2, 5.5);
      silhouetteOf(ctx, piece, [1, 2, 3]);
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, 4, -13, 22, 8, '#2f4058'); // こん色の せなか
        oval(ctx, -8, 9, 14, 10, '#f3f4f6'); // しろい おなか
      });
      clipPart(ctx, piece.parts[2], () => {
        oval(ctx, -11, -21, 13, 7, '#2f4058'); // こん色の あたま
        oval(ctx, -16, -6, 10, 6, '#f3f4f6');
      });
      curve(ctx, [[-4, -20], [10, -19], [22, -11]], '#9aa4ae', 2.6); // しろい かざりばね
      curve(ctx, [[-4, -20], [10, -19], [22, -11]], '#ffffff', 1.4);
      colorEye(ctx, -15, -14, 3.2, '#e2383c');
      cheek(ctx, -12, -7, 2.6, 1.6);
      shine(ctx, 6, -10, 6, 2);
    },
  },

  // アマサギ: しろい からだに オレンジいろの あたま・くび・せなか（なつの すがた）
  cattleEgret: {
    color: '#ffffff',
    line: WHITE_LINE,
    parts: [
      { points: pts([[-5, 10], [7, 10], [11, 30], [-11, 30]]) },                        // あし（板）
      { points: turn(ellipse(19, 12, { cx: 5, cy: 0, n: 20 }), 0.25, 5, 0) },          // からだ
      { points: seg(-8, -2, -9, -20, 9) },                                             // ふとい くび
      { points: ellipse(8.5, 8, { cx: -11, cy: -24, n: 16 }) },                         // あたま
      { points: pts([[-18, -26.5], [-31, -23.5], [-18, -21]]), fill: '#f5a623' },       // くちばし
    ],
    draw(ctx, piece) {
      const neck = [[-8, -2], [-7, -12], [-10, -21]];
      legs(ctx, [[1, -2], [6, 8]], 10, 29, '#d9a54a', '#9a7028', 2, 5.5);
      neckUnder(ctx, neck, 8.5, WHITE_LINE);
      silhouetteOf(ctx, piece, [1, 3, 4]);
      neckOver(ctx, neck, 8.5, '#f5b25a'); // オレンジの くび
      clipPart(ctx, piece.parts[3], () => oval(ctx, -10, -26, 9, 7, '#f5b25a')); // オレンジの あたま
      clipPart(ctx, piece.parts[1], () => oval(ctx, 7, -9, 14, 6, '#f7c27a')); // せなかの かざりばね
      for (const y of [-10, -7]) curve(ctx, [[0, y], [10, y + 1], [20, y + 5]], '#f0a850', 1);
      for (const x of [-10, -7]) line(ctx, [[x, -6], [x - 1, 1]], '#e89a48', 1); // むねの かざりばね
      colorEye(ctx, -12, -25, 2.8, '#ffd43b');
      cheek(ctx, -8, -20, 2.2, 1.4);
    },
  },

  // コサギ: ほっそり まっしろ・くろい くちばし・くろい あしに きいろい ゆび・あたまの 2本の かざりばね
  littleEgret: {
    color: '#ffffff',
    line: WHITE_LINE,
    parts: [
      { points: pts([[-4, 8], [8, 8], [12, 28], [-9, 28]]) },                           // あし（板）
      { points: turn(ellipse(17, 10, { cx: 5, cy: 0, n: 20 }), 0.35, 5, 0) },          // からだ
      { points: seg(-7, -2, -3, -16, 6) },                                             // くび（した）
      { points: seg(-3, -16, -9, -26, 5.5) },                                          // くび（うえ）
      { points: ellipse(6, 5, { cx: -10, cy: -29, n: 14 }) },                           // あたま
      { points: pts([[-14, -30.5], [-30, -28], [-14, -27]]), fill: '#2e3036' },         // くろい くちばし
    ],
    draw(ctx, piece) {
      const neck = [[-7, -2], [-2, -14], [-4, -21], [-9, -28]];
      legs(ctx, [[2, 0], [7, 8]], 8, 27, '#34363e', '#1e2024', 2, 5.5, '#f5d23c', '#b8961e');
      curve(ctx, [[-6, -31], [3, -33], [12, -27]], '#c4cad1', 2.4); // あたまの かざりばね
      curve(ctx, [[-6, -31], [3, -33], [12, -27]], '#ffffff', 1.1);
      neckUnder(ctx, neck, 5.5, WHITE_LINE);
      silhouetteOf(ctx, piece, [1, 4, 5]);
      neckOver(ctx, neck, 5.5, '#ffffff');
      for (const y of [-4, 0]) curve(ctx, [[4, y], [16, y + 3], [26, y + 10]], '#d2d7dd', 1.1); // せなかの レースの はね
      colorEye(ctx, -10, -30, 2.4, '#ffd43b');
      cheek(ctx, -8, -26, 2, 1.3);
    },
  },

  // チュウサギ: まっしろ・まるい あたま・きいろくて みじかめの くちばし（さきが くろ）・くろい あし
  intermediateEgret: {
    color: '#ffffff',
    line: WHITE_LINE,
    parts: [
      { points: pts([[-4, 8], [8, 8], [12, 31], [-10, 31]]) },                          // あし（板）
      { points: turn(ellipse(18, 11, { cx: 5, cy: -1, n: 20 }), 0.3, 5, -1) },         // からだ
      { points: seg(-8, -4, -3, -19, 6.5) },                                           // くび（した）
      { points: seg(-3, -19, -9, -30, 6) },                                            // くび（うえ）
      { points: ellipse(7, 6.5, { cx: -10, cy: -33, n: 14 }) },                         // まるい あたま
      { points: pts([[-15, -34.5], [-29, -32], [-15, -30.5]]), fill: '#f2c43a' },       // きいろい くちばし
    ],
    draw(ctx, piece) {
      const neck = [[-8, -4], [-2, -17], [-4, -25], [-9, -32]];
      legs(ctx, [[2, 0], [7, 8]], 8, 30, '#34363e', '#1e2024', 2.2, 6);
      neckUnder(ctx, neck, 6, WHITE_LINE);
      silhouetteOf(ctx, piece, [1, 4, 5]);
      neckOver(ctx, neck, 6, '#ffffff');
      dot(ctx, -27.5, -32, 1.4, '#4a4a3a'); // くちばしの さき
      colorEye(ctx, -10, -34, 2.6, '#ffd43b');
      cheek(ctx, -8, -29, 2, 1.3);
      shine(ctx, 8, -6, 6, 2);
    },
  },

  // アオサギ: はいいろの からだ・しろい くび・めから うしろへ くろい すじと かざりばね
  greyHeron: {
    color: '#9fabb8',
    line: '#5f6b78',
    parts: [
      { points: pts([[-3, 8], [9, 8], [13, 32], [-9, 32]]) },                           // あし（板）
      { points: turn(ellipse(19, 11, { cx: 6, cy: -1, n: 20 }), 0.3, 6, -1) },         // からだ
      { points: seg(-7, -5, -2, -21, 7) },                                             // くび（した）
      { points: seg(-2, -21, -9, -33, 6) },                                            // くび（うえ）
      { points: ellipse(7, 6, { cx: -10, cy: -36, n: 14 }), fill: '#f4f5f6' },          // しろい あたま
      { points: pts([[-15, -37.5], [-32, -35], [-15, -33.5]]), fill: '#f2c43a' },       // きいろい くちばし
    ],
    draw(ctx, piece) {
      const neck = [[-7, -5], [-1, -19], [-3, -28], [-9, -35]];
      legs(ctx, [[3, 1], [8, 10]], 8, 31, '#c9a86a', '#8a6c38', 2.2, 6);
      neckUnder(ctx, neck, 6.5, '#5f6b78');
      silhouetteOf(ctx, piece, [1, 4, 5]);
      neckOver(ctx, neck, 6.5, '#f4f5f6');
      for (const [x, y] of [[-5, -10], [-3.5, -15], [-3, -20]]) line(ctx, [[x - 1, y - 1.5], [x - 1.6, y + 1.5]], '#2e3036', 1.2); // くびの まえの くろい もよう
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, 18, 3, 12, 8, '#7a8796', 0.3); // かざきりばね
        oval(ctx, -5, -2, 2.6, 3.4, '#3a3f48'); // かたの くろ
      });
      line(ctx, [[-11, -37], [-3, -38.5]], '#2e3036', 2.4); // くろい すじ（アオサギの しるし）
      curve(ctx, [[-4, -38.5], [6, -38], [14, -33]], '#2e3036', 1.6); // くろい かざりばね
      colorEye(ctx, -11, -36.5, 2.4, '#ffd43b');
      cheek(ctx, -8, -32, 2, 1.3);
      shine(ctx, 10, -8, 6, 2);
    },
  },

  // トキ: トキいろ（うすい ももいろ）の はね・あかい かお・したに まがった くろい くちばし・うしろあたまの かざりばね
  ibis: {
    color: '#fbf1ee',
    line: '#c99a90',
    parts: [
      { points: pts([[-4, 8], [8, 8], [12, 28], [-10, 28]]) },                          // あし（板）
      { points: turn(ellipse(20, 12, { cx: 6, cy: -1, n: 20 }), 0.2, 6, -1) },         // からだ
      { points: seg(-9, -5, -8, -17, 7) },                                             // くび
      { points: ellipse(8, 7.5, { cx: -11, cy: -21, n: 16 }) },                         // あたま
      { points: pts([[-17, -24], [-34, -16], [-31, -13], [-17, -19]]) },                // くちばし（当たり判定は まっすぐ）
    ],
    draw(ctx, piece) {
      legs(ctx, [[1, -2], [6, 8]], 8, 27, '#e04a4a', '#a02a2a', 2, 5.5);
      for (const [x, y] of [[-5, -30], [1, -28], [4, -24], [3, -20]]) beak(ctx, [[-8, -25], [x, y], [-5, -20]], '#f7e1da', '#c99a90', 1); // うしろあたまの かざりばね
      silhouetteOf(ctx, piece, [1, 2, 3]);
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, 11, 0, 17, 8, '#f6b4a4'); // トキいろの はね
        for (const [x, y] of [[4, -2], [10, -1], [16, 0], [22, 2]]) line(ctx, [[x, y - 3], [x + 3, y + 4]], '#f09a88', 1.1);
      });
      clipPart(ctx, piece.parts[3], () => oval(ctx, -15, -21, 6, 6.5, '#e8383d')); // あかい かお
      ctx.beginPath(); // したに まがった くちばし
      ctx.moveTo(-17, -24);
      ctx.quadraticCurveTo(-28, -23, -34, -14);
      ctx.quadraticCurveTo(-27, -18, -17, -19);
      ctx.closePath();
      ctx.fillStyle = '#2e3036';
      ctx.fill();
      dot(ctx, -33, -15, 1.6, '#e8383d'); // くちばしの さきの あか
      colorEye(ctx, -12, -22.5, 2.4, '#ffd43b');
      cheek(ctx, -7, -17, 2.2, 1.4);
    },
  },

  // ハシビロコウ: くつの ような 大きな くちばし・じっと みつめる め・はいいろ
  shoebill: {
    color: '#8e9aa6',
    line: '#56606b',
    parts: [
      { points: pts([[-5, 14], [7, 14], [11, 34], [-11, 34]]) },                        // あし（板）
      { points: ellipse(16, 20, { cx: 6, cy: 0, n: 20 }) },                             // からだ
      { points: ellipse(12, 11, { cx: -5, cy: -23, n: 18 }) },                          // あたま
      { points: pts([[-13, -29], [-33, -22], [-32, -16], [-12, -15]]), fill: '#cfc5a6' }, // くつの ような くちばし
    ],
    draw(ctx, piece) {
      legs(ctx, [[-1, -3], [5, 6]], 14, 33, '#3e444c', '#22262c', 2.4, 6);
      beak(ctx, [[4, -29], [11, -32], [7, -25]], '#8e9aa6', '#56606b', 1.2); // うしろあたまの ちょんまげ
      silhouetteOf(ctx, piece, [1, 2, 3]);
      clipPart(ctx, piece.parts[1], () => {
        for (const [x, y] of [[4, -10], [12, -9], [8, -3], [16, -2], [6, 4], [14, 5], [10, 11], [18, 12]]) scallop(ctx, x, y, 4, '#b0bac4', 1.3);
      });
      line(ctx, [[-12, -18.5], [-31, -19.5]], '#a69b7c', 1);
      for (const [x, y] of [[-22, -22], [-26, -18], [-18, -17]]) dot(ctx, x, y, 0.9, '#9a8f72');
      line(ctx, [[-33, -22], [-34, -18.5]], '#8a8068', 1.8); // くちばしの さきの かぎ
      colorEye(ctx, -6, -24, 3, '#f5f0c8');
      dot(ctx, -6, -24, 1.3, INK);
      line(ctx, [[-9.5, -27.3], [-2.5, -27.3]], '#56606b', 1.2); // じーっと みる まぶた
      cheek(ctx, -1, -18, 2.4, 1.5);
      shine(ctx, 10, -12, 5, 2.2);
    },
  },

  // オオタカ: とまっている。はいいろの せなか・しまもようの むね・しろい まゆ・オレンジの め
  goshawk: {
    color: '#5d6878',
    line: '#38414d',
    parts: [
      { points: flatBottom(ellipse(15, 21, { cx: 2, cy: 2, n: 24 }), 18) },              // からだ
      { points: ellipse(12, 11, { cx: -4, cy: -19, n: 18 }) },                          // あたま
      { points: pts([[10, 6], [19, 4], [24, 15], [15, 16]]) },                          // しっぽ（床から すこし うかせる）
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, -4, 6, 10, 15, '#f4f4f2'); // しろい むね
        for (let y = -6; y <= 16; y += 3.2) line(ctx, [[-10, y], [1, y - 1]], '#9aa2ae', 1); // しまもよう
        oval(ctx, 10, 0, 8, 18, '#4c5664', -0.15); // つばさ
      });
      clipPart(ctx, piece.parts[2], () => {
        for (const t of [0.3, 0.6]) line(ctx, [[10, 6 + t * 13], [26, 4 + t * 14]], '#3e4652', 1.6);
      });
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, -2, -26, 13, 7, '#3b4350'); // くろっぽい あたま
        line(ctx, [[-6, -19], [8, -18]], '#3b4350', 3); // めの うしろの くろ
        oval(ctx, -9, -12, 5, 3.4, '#f4f4f2'); // しろい のど
      });
      curve(ctx, [[-13, -22.5], [-5, -25], [4, -23]], '#ffffff', 1.5); // しろい まゆ（オオタカの しるし）
      colorEye(ctx, -9, -19.5, 3, '#f5a030');
      beak(ctx, [[-15, -21], [-21, -19], [-22, -15], [-19, -16.5], [-15, -16]], '#3a3f48', '#22262c', 1);
      oval(ctx, -15.5, -19, 1.8, 2, '#f2c43a'); // くちばしの つけねの きいろ
      for (const x of [-3, 5]) {
        ovalLine(ctx, x, 19, 3.6, 2, '#f2c43a', '#b8902a', 1); // きいろい あし
        dot(ctx, x - 3.2, 20.5, 0.8, INK);
      }
      cheek(ctx, -6, -14, 2.4, 1.5);
      shine(ctx, -6, -26, 3.6, 1.8);
    },
  },

  // ---------- v0.17.25 で ふえた とり（むずかしい） ----------

  // ヤマセミ: しろと くろの まだら・ぼさぼさの 大きな かんむり・大きな くちばし
  crestedKingfisher: {
    color: '#ffffff',
    line: '#5a5f68',
    parts: [
      { points: flatBottom(ellipse(17, 18, { cx: -1, cy: 5, n: 24 }), 16) },            // からだ
      { points: ellipse(13, 12, { cx: -5, cy: -15, n: 18 }) },                          // あたま
      { points: pts([[-17, -18.5], [-39, -14], [-17, -10.5]]), fill: '#4a4e56' },       // 大きな くちばし
    ],
    draw(ctx, piece) {
      beak(ctx, [[8, 11], [22, 15], [20, 20], [8, 19]], '#3a3e46', '#22262c', 1.4); // しっぽ
      for (const [x, y] of [[-14, -31], [-8, -35], [-1, -34], [5, -30], [10, -24]]) beak(ctx, [[-9, -23], [x, y], [1, -22]], '#3a3e46', '#22262c', 1); // ぼさぼさの かんむり（ヤマセミの しるし）
      for (const [x, y] of [[-8, -30], [-2, -30], [3, -27]]) dot(ctx, x, y, 1, '#ffffff');
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, 11, 3, 10, 17, '#3a3e46', -0.15); // くろい せなかと つばさ
        for (let y = -10; y <= 16; y += 4) line(ctx, [[5, y], [16, y + 1]], '#ffffff', 1.1); // しろい しま
        for (const x of [-13, -9, -5, -1]) dot(ctx, x, -3, 1.7, '#3a3e46'); // むねの まだらの おび
      });
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, -1, -22, 13, 7, '#3a3e46'); // くろい あたま
        for (const [x, y] of [[-6, -22], [-1, -24], [4, -21]]) dot(ctx, x, y, 1, '#ffffff');
        line(ctx, [[-16, -9], [-4, -6]], '#3a3e46', 2); // ひげの くろい すじ
      });
      eye(ctx, -8, -16, 2.6);
      dot(ctx, -37, -14, 1.2, '#d8dce2'); // くちばしの さき
      foot(ctx, -4, 15.5, 4.5, '#5a5f68', '#3a3e46', 1.6);
      foot(ctx, 4, 15.5, 4.5, '#5a5f68', '#3a3e46', 1.6);
      cheek(ctx, -4, -9, 2.4, 1.5);
    },
  },

  // アカショウビン: からだ ぜんぶが あかっぽい オレンジ・大きな まっかな くちばし・こしに うすむらさき
  ruddyKingfisher: {
    color: '#e8703a',
    line: '#a8401a',
    parts: [
      { points: flatBottom(ellipse(16, 17, { cx: -1, cy: 4, n: 24 }), 15) },            // からだ
      { points: ellipse(13, 12, { cx: -5, cy: -15, n: 18 }) },                          // あたま
      { points: pts([[-17, -20], [-38, -14], [-37, -11], [-17, -9]]), fill: '#e8282a' }, // 大きな あかい くちばし
    ],
    draw(ctx, piece) {
      beak(ctx, [[8, 10], [21, 14], [19, 19], [8, 17]], '#c85a2a', '#a8401a', 1.4); // しっぽ
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, -5, 11, 11, 13, '#f5a060'); // おなか
        oval(ctx, 11, 3, 8, 14, '#c85a2a', -0.2); // つばさ
      });
      curve(ctx, [[5, -8], [12, -2], [13, 8]], '#c0a8e8', 2.2); // こしの うすむらさき
      line(ctx, [[-17, -14.5], [-37, -12.5]], '#b81a1c', 1); // くちばしの あわせめ
      eye(ctx, -8, -16, 2.9);
      foot(ctx, -4, 14.5, 4.5, '#e8484a', '#a82e2e', 1.6);
      foot(ctx, 4, 14.5, 4.5, '#e8484a', '#a82e2e', 1.6);
      cheek(ctx, -4, -9, 2.4, 1.5);
      shine(ctx, -8, -23, 4, 2);
    },
  },

  // ブッポウソウ: うつくしい はねを ひろげた すがた（v0.17.26）。あおみどりの からだ・こい あおの かざきりばね・
  // はねの しろっぽい まる（とぶと見える ブッポウソウの しるし）・くろっぽい あたま・あかい くちばしと あし。
  // ひろげた はねは カワウと同じく V字（上に のせた子が まんなかに あつまる）。ひろげた しっぽが 床に つく
  dollarbird: {
    color: '#2a6a7a',
    line: '#163e48',
    parts: [
      { points: pts([[-6, 12], [6, 12], [11, 24], [-11, 24]]), fill: '#1f5560' },       // ひろげた しっぽ（床に つく）
      { points: ellipse(11, 16, { cy: 2, n: 20 }) },                                    // からだ
      { points: pts([[-6, -8], [-42, -24], [-40, -12], [-8, 4]]) },                      // ひだりの つばさ
      { points: pts([[6, -8], [8, 4], [40, -12], [42, -24]]) },                          // みぎの つばさ
      { points: ellipse(9, 8.5, { cx: -2, cy: -20, n: 16 }), fill: '#262a30' },         // くろっぽい あたま
      { points: pts([[-10, -22], [-19, -19.5], [-10, -16]]), fill: '#e8402a' },         // あかい くちばし
    ],
    draw(ctx, piece) {
      for (const s of [-1, 1]) { // はねの さきの ぎざぎざ（1まいずつの はねに見せる。絵だけ）
        for (let k = 0; k < 5; k++) ovalLine(ctx, s * (14 + k * 6.4), 1.5 - k * 3.1, 3.2, 5.6, k >= 3 ? '#1c2f66' : '#2a56a8', '#163e48', 1.4, s * 0.45);
        for (let k = 0; k < 3; k++) ovalLine(ctx, s * 43, -22 + k * 4.4, 5.4, 2.4, '#1c2f66', '#163e48', 1.4, s * -0.25);
      }
      drawSilhouette(ctx, piece);
      for (const s of [-1, 1]) {
        clipPart(ctx, piece.parts[s < 0 ? 2 : 3], () => {
          oval(ctx, s * 12, -2, 8, 9, '#2f8a86'); // つけねの あおみどり
          poly(ctx, [[s * 17, -32], [s * 48, -32], [s * 48, 10], [s * 15, 10]], '#2a56a8'); // あおい かざきりばね
          poly(ctx, [[s * 31, -32], [s * 48, -32], [s * 48, 10], [s * 29, 10]], '#1c2f66'); // さきの こい あお
          for (let k = 0; k < 5; k++) line(ctx, [[s * (19 + k * 4.4), -18 - k * 1.2], [s * (17 + k * 4.4), -2 - k * 1.8]], '#16285a', 1); // はねの すじ
          ovalLine(ctx, s * 28, -13, 4.6, 3.2, '#c6e8f4', '#7ab0c8', 0.8, s * 0.4); // しろっぽい まる（ブッポウソウの しるし）
        });
      }
      clipPart(ctx, piece.parts[0], () => {
        for (const x of [-4, 0, 4]) line(ctx, [[x * 0.6, 13], [x * 1.8, 24]], '#163e48', 1); // しっぽの すじ
      });
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, 0, 8, 7, 9, '#3a8a96'); // おなか
        oval(ctx, -4, -11, 4.5, 3.4, '#3a7ac0'); // あおい のど
      });
      dot(ctx, -4, -21, 3.6, '#e8402a'); // めの まわりの あか
      eye(ctx, -4, -21, 2.4);
      foot(ctx, -3, 16.5, 4, '#e8484a', '#a82e2e', 1.6);
      foot(ctx, 4, 16.5, 4, '#e8484a', '#a82e2e', 1.6);
      cheek(ctx, 1, -15, 2.2, 1.4);
      shine(ctx, -5, -26, 3.2, 1.6);
    },
  },

  // キツツキ（アカゲラ）: きりかぶに つかまって つつく。くろと しろ・あたまの うしろと おしりが あか
  // （きりかぶは 下に ねっこを つけて広く平らに。とりの重さで たおれないように）
  woodpecker: {
    color: '#2e3036',
    line: '#1a1c20',
    parts: [
      { points: blob(26, 50, 4, 2, { cx: -10, cy: 2 }), fill: '#a0703e' },              // きりかぶ
      { points: pts([[-25, 24], [5, 24], [10, 30], [-30, 30]]), fill: '#a0703e' },       // ねっこ（床に つく ところ）
      { points: turn(ellipse(8.5, 13, { cx: 9, cy: 2, n: 18 }), -0.25, 9, 2) },         // からだ（みきに つかまる）
      { points: ellipse(7, 6.5, { cx: 6, cy: -13, n: 16 }) },                           // あたま
      { points: pts([[0, -14.5], [-5, -12.5], [0, -10.5]]), fill: '#3a3e46' },          // くちばし（みきを つつく）
      { points: pts([[6, 12], [12, 13], [6, 24], [2, 23]]) },                           // かたい しっぽ（みきに あてる）
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        for (const x of [-18, -12, -6, 0]) curve(ctx, [[x, -18], [x + 1.5, 0], [x - 1, 24]], '#7a5028', 1.2); // きの かわ
      });
      ovalLine(ctx, -10, -22.5, 12.5, 2.6, '#e8c48a', '#7a5028', 1.2); // きりくち
      ovalLine(ctx, -10, -22.5, 6, 1.2, '#e8c48a', '#c89a5a', 0.8);
      clipPart(ctx, piece.parts[2], () => {
        oval(ctx, 4, 4, 6, 12, '#f2ede6', -0.25); // しろっぽい おなか
        oval(ctx, 13, -3, 3.4, 5, '#ffffff'); // かたの しろ
        for (const [x, y] of [[14, 4], [15, 8], [13, 11]]) dot(ctx, x, y, 0.9, '#ffffff');
        oval(ctx, 7, 14, 3, 2.6, '#e8283a'); // あかい おしり
      });
      clipPart(ctx, piece.parts[3], () => {
        oval(ctx, 5, -9, 6, 4, '#f2ede6'); // しろい ほお
        line(ctx, [[1, -9.5], [10, -7]], INK, 1.3);
        oval(ctx, 12, -14, 3, 3.4, '#e8283a'); // あたまの うしろの あか（アカゲラの しるし）
      });
      ringEye(ctx, 4, -14, 1.9, '#ffffff');
      cheek(ctx, 7, -10.5, 1.8, 1.2);
    },
  },

  // ---------- おとな（せが とても高い・かざりの 大きな子） ----------

  // ダイサギ: いちばん 大きい しろい サギ。ながい S字の くび・ながい きいろの くちばし
  greatEgret: {
    color: '#ffffff',
    line: WHITE_LINE,
    parts: [
      { points: pts([[-3, 6], [9, 6], [14, 34], [-8, 34]]) },                           // あし（板）
      { points: turn(ellipse(18, 10, { cx: 7, cy: -2, n: 20 }), 0.3, 7, -2) },         // からだ
      { points: seg(-6, -6, 0, -22, 6.5) },                                            // くび（した）
      { points: seg(0, -22, -8, -36, 5.5) },                                           // くび（うえ）
      { points: ellipse(6.5, 5.5, { cx: -10, cy: -39, n: 14 }) },                       // あたま
      { points: pts([[-15, -40.5], [-36, -37.5], [-15, -36.5]]), fill: '#f2c43a' },     // ながい くちばし
    ],
    draw(ctx, piece) {
      const neck = [[-6, -6], [1, -18], [0, -27], [-8, -37]];
      legs(ctx, [[4, 2], [9, 11]], 6, 33, '#34363e', '#1e2024', 2.2, 6.5);
      neckUnder(ctx, neck, 5.5, WHITE_LINE);
      silhouetteOf(ctx, piece, [1, 4, 5]);
      neckOver(ctx, neck, 5.5, '#ffffff');
      for (const y of [-8, -4]) curve(ctx, [[6, y], [20, y + 4], [30, y + 12]], '#d2d7dd', 1.1); // せなかの かざりばね
      line(ctx, [[-15, -38.5], [-9.5, -38]], INK, 0.9); // くちの すじ（めの うしろまで のびる）
      colorEye(ctx, -10, -40, 2.4, '#ffd43b');
      cheek(ctx, -8, -35.5, 2, 1.3);
      shine(ctx, 9, -8, 6, 2);
    },
  },

  // ツル（タンチョウ）: しろい からだ・くろい くび・あたまの てっぺんが あか・くろい おしりの はね
  crane: {
    color: '#ffffff',
    line: '#9aa3ad',
    parts: [
      { points: pts([[-2, 8], [10, 8], [15, 34], [-7, 34]]) },                          // あし（板）
      { points: turn(ellipse(22, 13, { cx: 8, cy: -2, n: 22 }), 0.12, 8, -2) },        // からだ
      { points: seg(-9, -6, -7, -24, 7) },                                             // くび（した）
      { points: seg(-7, -24, -11, -36, 6) },                                           // くび（うえ）
      { points: ellipse(7, 6, { cx: -12, cy: -39, n: 14 }) },                           // あたま
      { points: pts([[-17, -40.5], [-33, -37.5], [-17, -36.5]]), fill: '#a3ab90' },     // くちばし
    ],
    draw(ctx, piece) {
      const neck = [[-9, -6], [-6, -22], [-8, -31], [-12, -37]];
      legs(ctx, [[5, 3], [10, 12]], 8, 33, '#3a3a40', '#1e1e24', 2.4, 6.5);
      neckUnder(ctx, neck, 6.5, '#1c1c22');
      silhouetteOf(ctx, piece, [1, 4, 5]);
      neckOver(ctx, neck, 6.5, '#2c2c32');
      clipPart(ctx, piece.parts[4], () => oval(ctx, -15, -37, 6, 6, '#2c2c32')); // くろい かお
      ctx.save(); // あかい あたま（タンチョウの しるし）
      ctx.beginPath();
      ctx.ellipse(-12, -39, 7, 6, 0, 0, PI * 2);
      ctx.clip();
      oval(ctx, -12, -45, 5, 3.6, '#e8283a');
      ctx.restore();
      oval(ctx, 26, 3, 10, 6, '#2c2c32', 0.35); // くろい おしりの はね
      for (const k of [0, 1, 2]) line(ctx, [[20 + k * 3, 0], [30 + k * 3, 10 + k]], '#46464e', 1);
      ringEye(ctx, -13, -40, 2, '#ffffff');
      cheek(ctx, -9, -35, 2, 1.3);
      shine(ctx, 6, -10, 7, 2.2);
    },
  },

  // フラミンゴ: どうぶつ つみき と同じ絵・同じ形（1本あし）
  flamingo: ANIMAL_PIECES.flamingo,

  // クジャク: はねを ひろげた ところ（まえから）。め玉もようの 大きな はね・あおい からだ・あたまの かんむり
  peacock: {
    color: '#2f8f5a',
    line: '#1d5e3a',
    pad: 10, // かんむりの さき
    parts: [{ points: ellipse(46, 50, { cy: 28, from: PI, to: PI * 2, n: 22 }) }], // ひろげた はね（下が平らな 半だ円）
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        for (let i = 0; i <= 14; i++) {
          const a = PI + (PI * i) / 14;
          line(ctx, [[0, 26], [Math.cos(a) * 50, 28 + Math.sin(a) * 54]], '#43a874', 1);
        }
        for (const [k, n] of [[0.84, 9], [0.58, 7]]) {
          for (let i = 0; i < n; i++) {
            const a = PI + (PI * (i + 0.5)) / n;
            const x = Math.cos(a) * 46 * k;
            const y = 28 + Math.sin(a) * 50 * k;
            const rot = a + PI / 2;
            oval(ctx, x, y, 4.2, 5.4, '#d6b84a', rot); // め玉もよう
            oval(ctx, x, y, 3, 3.9, '#2aa198', rot);
            oval(ctx, x, y + 0.4, 1.7, 2.2, '#1f3c8f', rot);
          }
        }
      });
      for (const s of [-1, 1]) ovalLine(ctx, s * 9, 17, 5, 8, '#c08a4a', '#8a5a2a', 1.4, s * 0.35); // ちゃいろの つばさ
      for (const s of [-1, 1]) {
        leg(ctx, [[s * 3, 20], [s * 4, 27.5]], '#a8a8b0', '#6a6a72', 1.8);
        leg(ctx, [[s * 4, 27.5], [s * 7, 27.5]], '#a8a8b0', '#6a6a72', 1.5);
      }
      ovalLine(ctx, 0, 3, 4.6, 9, '#2a64c8', '#1a3f86', 1.6); // くび
      ovalLine(ctx, 0, 14, 8.5, 10, '#2a64c8', '#1a3f86', 1.6); // あおい からだ
      oval(ctx, 0, 3, 3.4, 8, '#2a64c8');
      for (const dx of [-4, -2, 0, 2, 4]) { // あたまの かんむり
        line(ctx, [[0, -12], [dx * 1.3, -20]], '#1a3f86', 1);
        dot(ctx, dx * 1.3, -20.5, 1.4, '#2a9aa0');
      }
      ovalLine(ctx, 0, -6, 6.5, 7, '#2a64c8', '#1a3f86', 1.6); // あたま
      for (const s of [-1, 1]) {
        oval(ctx, s * 3.2, -4.6, 2.3, 1.1, '#ffffff'); // めの下の しろ
        eye(ctx, s * 2.8, -7.2, 1.7);
        cheek(ctx, s * 4.4, -3.4, 1.5, 1);
      }
      poly(ctx, [[-1.4, -4.4], [1.4, -4.4], [0, -1.6]], '#cfc6b0'); // くちばし
      shine(ctx, -24, -6, 6, 2.6);
    },
  },

  // オオフウチョウ: きいろの ふさふさの かざりばね・みどりの のど・きいろい あたま
  birdOfParadise: {
    color: '#7a3e26',
    line: '#4c2414',
    pad: 10,
    parts: [
      // かざりばねと からだの下は 同じ高さで平ら（2か所で着地しても ゆれないように）
      { points: flatBottom(ellipse(22, 20, { cx: 16, cy: 6, n: 22 }), 24), fill: '#f5c842' }, // かざりばね
      { points: flatBottom(ellipse(12, 19, { cx: -6, cy: 7, n: 20 }), 24) },               // からだ
      { points: ellipse(9.5, 9, { cx: -11, cy: -15, n: 16 }) },                            // あたま
    ],
    draw(ctx, piece) {
      for (let i = 0; i < 8; i++) { // ふちから はみ出す ほそい はね（ふさふさに見せる）
        const a = -PI * 0.46 + (PI * 0.62 * i) / 7;
        const x0 = 16 + Math.cos(a) * 18;
        const y0 = 6 + Math.sin(a) * 16;
        const x1 = 16 + Math.cos(a) * 27;
        const y1 = 6 + Math.sin(a) * 23;
        const list = [[x0, y0], [(x0 + x1) / 2 + 2, (y0 + y1) / 2 - 2], [x1, y1]];
        curve(ctx, list, '#c9902a', 3.6);
        curve(ctx, list, '#ffe58a', 2);
      }
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, 32, 6, 9, 16, '#fff3c4'); // さきの しろっぽい ところ
        for (let i = 0; i < 9; i++) {
          const t = i / 8;
          curve(ctx, [[0, -8 + t * 24], [18, -10 + t * 26], [40, -8 + t * 30]], i % 2 ? '#f39a2a' : '#fff0b0', 1.4);
        }
      });
      curve(ctx, [[2, 10], [20, 22], [34, 16], [30, 10]], '#3a1e10', 1.1); // ながい はりがね みたいな しっぽ
      curve(ctx, [[0, 12], [14, 23], [26, 20]], '#3a1e10', 1.1);
      clipPart(ctx, piece.parts[1], () => oval(ctx, 0, 8, 7, 14, '#5e2c18')); // つばさ
      clipPart(ctx, piece.parts[2], () => {
        oval(ctx, -7, -20, 11, 7, '#f2d03a'); // きいろい あたま
        oval(ctx, -15, -7, 7, 5.5, '#1f9a62'); // みどりの のど（オオフウチョウの しるし）
        oval(ctx, -19, -14, 3.6, 3.4, '#3a2016');
      });
      beak(ctx, [[-19, -16], [-27, -13.5], [-19, -12]], '#a8c0d0', '#6a8494', 1);
      colorEye(ctx, -13, -15, 2.6, '#f5e04a');
      foot(ctx, -9, 23.5, 4, '#a89aa8', '#6e6070', 1.6);
      foot(ctx, -2, 23.5, 4, '#a89aa8', '#6e6070', 1.6);
      cheek(ctx, -9, -10, 2.2, 1.4);
      shine(ctx, -8, -21, 3.4, 1.6);
    },
  },

  // ハゲワシ: はげた あたま・ふわふわの しろい えり・ちゃいろの 大きな からだ
  vulture: {
    color: '#6b4a34',
    line: '#3f2a1c',
    parts: [
      { points: flatBottom(ellipse(24, 21, { cx: 5, cy: 4, n: 24 }), 18) },              // からだ
      { points: ellipse(12, 9, { cx: -9, cy: -12, n: 16 }), fill: '#f3e7d0' },            // ふわふわの えり
      { points: seg(-11, -16, -15, -28, 6), fill: '#e3b0a0' },                           // はだかの くび
      { points: ellipse(7.5, 7, { cx: -16, cy: -31, n: 14 }), fill: '#e9b8a8' },          // はげた あたま
      { points: pts([[-22, -33], [-31, -29.5], [-22, -27]]), fill: '#5a4a40' },           // くちばし
    ],
    draw(ctx, piece) {
      for (const x of [-4, 6]) foot(ctx, x, 21.5, 5, '#c9b89a', '#8a7a5c', 2); // あし
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, 14, 4, 16, 16, '#563a28'); // つばさ
        for (const [x, y] of [[4, -6], [12, -6], [20, -4], [8, 0], [16, 1], [24, 2], [12, 7], [20, 8]]) scallop(ctx, x, y, 3.6, '#8a6a50', 1.2);
        for (let k = 0; k < 3; k++) line(ctx, [[22 + k * 3, 8], [26 + k * 3, 20]], '#3f2a1c', 1.2);
      });
      clipPart(ctx, piece.parts[1], () => {
        for (const [x, y] of [[-16, -14], [-10, -16], [-4, -14], [-13, -9], [-7, -9]]) scallop(ctx, x, y, 2.8, '#d6c6a6', 1.1);
      });
      oval(ctx, -23, -30.5, 1.8, 2.2, '#d9c9b0'); // くちばしの つけね
      eye(ctx, -16, -32, 2.3);
      cheek(ctx, -13, -27, 2.2, 1.4);
      shine(ctx, -17, -36, 3, 1.4);
      shine(ctx, 4, -10, 7, 2.4);
    },
  },

  // ---------- v0.17.25 で ふえた とり（おとな） ----------

  // キジ（オス）: みどりの からだ・まっかな かお・あおむらさきの あたま・しまもようの ながい しっぽ
  pheasant: {
    color: '#2f6e52',
    line: '#1a4232',
    parts: [
      { points: pts([[-5, 10], [7, 10], [10, 26], [-8, 26]]) },                         // あし（板。ながい しっぽの ぶん うしろ寄り）
      { points: ellipse(18, 13, { cx: -4, cy: 0, n: 22 }) },                            // からだ
      { points: seg(-16, -4, -19, -16, 9) },                                            // くび
      { points: ellipse(8, 7.5, { cx: -20, cy: -19, n: 16 }), fill: '#3a3a7a' },        // あおむらさきの あたま
      { points: pts([[-27, -20], [-33, -18], [-27, -16.5]]), fill: '#e8d6a0' },         // くちばし
      { points: pts([[10, -6], [56, -16], [57, -11], [12, 4]]), fill: '#9a8a5a' },      // ながい しっぽ
    ],
    draw(ctx, piece) {
      legs(ctx, [[-3, -5], [3, 4]], 9, 25, '#a8907a', '#6e5a48', 2.2, 5);
      silhouetteOf(ctx, piece, [1, 2, 3, 4, 5]);
      clipPart(ctx, piece.parts[5], () => {
        for (let i = 0; i < 7; i++) line(ctx, [[18 + i * 6, -14], [16 + i * 6, 6]], '#5a4a2a', 1.3); // しっぽの しま
      });
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, 6, -4, 12, 9, '#8a7a50'); // ちゃいろの せなか
        for (const [x, y] of [[2, -6], [8, -5], [5, 0], [11, 1]]) scallop(ctx, x, y, 3, '#5a4a2a');
      });
      oval(ctx, -20, -19, 4.6, 5.6, '#e8303a'); // まっかな かお（キジの しるし）
      beak(ctx, [[-16, -25], [-12, -30], [-11, -24]], '#3a3a7a', '#1a4232', 1); // みみの はね
      eye(ctx, -20, -20, 2);
      shine(ctx, -10, -6, 6, 2);
    },
  },

  // ヤマドリ（オス）: あかがね いろの からだ・うろこもよう・とても ながい しまの しっぽ・あかい かお
  copperPheasant: {
    color: '#b05a2a',
    line: '#6a3014',
    parts: [
      { points: pts([[-4, 10], [8, 10], [11, 26], [-7, 26]]) },                         // あし（板）
      { points: ellipse(18, 13, { cx: -4, cy: 0, n: 22 }) },                            // からだ
      { points: seg(-16, -4, -19, -16, 9) },                                            // くび
      { points: ellipse(8, 7.5, { cx: -20, cy: -19, n: 16 }) },                         // あたま
      { points: pts([[-27, -20], [-33, -18], [-27, -16.5]]), fill: '#e8d6a0' },         // くちばし
      { points: pts([[10, -6], [61, -14], [62, -9], [12, 4]]), fill: '#c87a3a' },       // とても ながい しっぽ
    ],
    draw(ctx, piece) {
      legs(ctx, [[-3, -5], [3, 4]], 9, 25, '#a8907a', '#6e5a48', 2.2, 5);
      silhouetteOf(ctx, piece, [1, 2, 3, 4, 5]);
      clipPart(ctx, piece.parts[5], () => {
        for (let i = 0; i < 6; i++) { // ふとい しま（ヤマドリの しるし）
          line(ctx, [[20 + i * 7.5, -14], [18 + i * 7.5, 6]], '#5a2a10', 2.4);
          line(ctx, [[22.4 + i * 7.5, -14], [20.4 + i * 7.5, 6]], '#f6e6d0', 0.9);
        }
      });
      clipPart(ctx, piece.parts[1], () => {
        for (const [x, y] of [[-14, -4], [-8, -6], [-2, -6], [4, -5], [10, -3], [-11, 2], [-5, 1], [1, 1], [7, 2], [-8, 7], [-2, 7], [4, 7]]) scallop(ctx, x, y, 3, '#e8a070', 1.1); // うろこもよう
      });
      clipPart(ctx, piece.parts[3], () => oval(ctx, -20, -19, 3.6, 4, '#e8303a')); // あかい かお
      eye(ctx, -20, -20, 2);
      shine(ctx, -10, -6, 6, 2);
    },
  },

  // ペリカン: しろい 大きな からだ・のどぶくろの ついた ながい くちばし・みじかい あし
  pelican: {
    color: '#ffffff',
    line: WHITE_LINE,
    parts: [
      { points: pts([[-9, 14], [5, 14], [9, 30], [-14, 30]]) },                         // あし（板。大きな くちばしの ぶん まえ寄り）
      { points: ellipse(22, 17, { cx: 6, cy: 0, n: 22 }) },                             // からだ
      { points: seg(-8, -6, -10, -20, 10) },                                            // くび
      { points: ellipse(9, 8, { cx: -11, cy: -24, n: 16 }) },                           // あたま
      { points: pts([[-17, -27], [-44, -21], [-40, -10], [-16, -17]]), fill: '#f5b84a' }, // くちばしと のどぶくろ
    ],
    draw(ctx, piece) {
      legs(ctx, [[-2, -4], [3, 4]], 13, 29, '#f5a040', '#b8701a', 3, 6);
      silhouetteOf(ctx, piece, [1, 2, 3, 4]);
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, 25, 3, 8, 11, '#2e3036'); // くろい かざきりばね
        for (const [x, y] of [[6, -6], [13, -5], [10, 0], [17, 1]]) scallop(ctx, x, y, 4, '#e2e6ec', 1.2);
      });
      clipPart(ctx, piece.parts[4], () => poly(ctx, [[-16, -20], [-43, -18], [-40, -10], [-16, -17]], '#f7d08a')); // のどぶくろ（ペリカンの しるし）
      line(ctx, [[-17, -23.5], [-43, -19.5]], '#d08a2a', 1.2);
      line(ctx, [[-44, -21], [-45, -18.5]], '#d08a2a', 1.6); // くちばしの さきの かぎ
      dot(ctx, -11, -26, 3.4, '#f7c8b8'); // めの まわりの ももいろ
      eye(ctx, -11, -26, 2.2);
      cheek(ctx, -6, -21, 2.2, 1.4);
      shine(ctx, 6, -10, 8, 2.4);
    },
  },

  // ヒクイドリ: くろい ふさふさの からだ・あおい くび・あかい にくだれ・あたまの かぶと・ふとい あし
  cassowary: {
    color: '#26262c',
    line: '#141418',
    parts: [
      { points: pts([[-6, 12], [10, 12], [14, 34], [-10, 34]]) },                       // ふとい あし（板）
      { points: ellipse(22, 18, { cx: 6, cy: -2, n: 22 }) },                            // くろい からだ
      { points: seg(-8, -10, -10, -28, 9), fill: '#3a8ad8' },                           // あおい くび
      { points: ellipse(7.5, 7, { cx: -11, cy: -31, n: 16 }), fill: '#3a8ad8' },        // あたま
      { points: pts([[-15, -36], [-12, -45], [-6, -43], [-7, -35]]), fill: '#b0905a' }, // かぶと（ヒクイドリの しるし）
      { points: pts([[-17, -32], [-27, -29], [-17, -27]]), fill: '#2e3036' },           // くちばし
    ],
    draw(ctx, piece) {
      for (const [x0, x1] of [[-1, -4], [7, 9]]) {
        leg(ctx, [[x0, 12], [x1, 33]], '#8a8a90', '#55555c', 4);
        foot(ctx, x1, 33.5, 6, '#8a8a90', '#55555c', 3);
      }
      silhouetteOf(ctx, piece, [1, 2, 3, 4, 5]);
      clipPart(ctx, piece.parts[1], () => {
        for (let i = 0; i < 14; i++) { // ふさふさの はね
          const x = -12 + ((i * 23) % 38);
          const y = -16 + ((i * 11) % 28);
          curve(ctx, [[x, y], [x + 3, y + 4], [x + 4, y + 9]], '#45454e', 1.2);
        }
      });
      clipPart(ctx, piece.parts[3], () => oval(ctx, -13, -30, 5, 5, '#6ab8f0')); // かおの うすい あお
      oval(ctx, -6, -24, 2.6, 3.2, '#e8303a'); // くびの うしろの あか
      ovalLine(ctx, -13.5, -19, 2.2, 4.2, '#e8303a', '#a82028', 1); // あかい にくだれ
      ovalLine(ctx, -10.5, -17, 2, 3.6, '#e8303a', '#a82028', 1);
      eye(ctx, -11, -32, 2.2);
      cheek(ctx, -8, -28, 2, 1.3);
      shine(ctx, 4, -12, 8, 2.4);
    },
  },
};
