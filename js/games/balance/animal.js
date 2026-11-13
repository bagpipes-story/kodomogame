// animal.js — どうぶつ つみき（v0.17.21）
// うみの いきもの（sea.js）と同じしくみ: 1ぴきずつ「当たり判定の形（凸の部品）」と「絵の描き方」を持つ。
// 座標はそのどうぶつの まんなかが(0,0)。立っている子の あしは 当たり判定では1まいの板（あしの すきまに
// 物が はさまって ぬけなくなるのを ふせぐ）、絵では4本に描く。みみ・しっぽの先など細かいところは絵だけ
// parts の並びが ぬる順。fill を書いた部品はその色でぬる

import {
  ellipse, blob, pts, flatBottom,
  drawSilhouette, silhouetteOf, strokePart, clipPart,
  oval, ovalLine, dot, poly, line, rrect, legRow,
  eye, cheek, smile, shine, INK,
} from './kit.js';

const PI = Math.PI;

// ωの くち（ねこ・うさぎ など）
function mouthW(ctx, x, y, r = 1.6, color = INK) {
  ctx.beginPath();
  ctx.arc(x - r, y, r, 0, PI);
  ctx.arc(x + r, y, r, 0, PI);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  ctx.stroke();
}

// くろい もようの上の め（パンダ）: しろめ＋くろめ＋ひかり
function eyeOnDark(ctx, x, y, r = 2.4) {
  dot(ctx, x, y, r, '#ffffff');
  dot(ctx, x, y, r * 0.6, INK);
  dot(ctx, x - r * 0.25, y - r * 0.3, r * 0.25, '#ffffff');
}

// しっぽ（ふとい線＋ふち）
function tail(ctx, list, color, stroke, width = 4) {
  line(ctx, list, stroke, width + 2.4);
  line(ctx, list, color, width);
}

export const ANIMAL_PIECES = {
  // ---------- かんたん（平らで 積みやすい） ----------

  // ぶた: まるい からだ・はな・まきまき しっぽ
  pig: {
    color: '#ffc2cf',
    line: '#d9849a',
    parts: [
      { points: blob(70, 36, 10, 12, { cy: -4 }) },                       // からだ（せなかは すこし平ら。上に積めるように）
      { points: blob(54, 8, 2, 3, { cy: 16 }) },                          // あし（板）
      { points: ellipse(6, 8, { cx: -36, cy: -2, n: 12 }), fill: '#ff9fb4' }, // はな
    ],
    draw(ctx, piece) {
      poly(ctx, [[-26, -19], [-31, -31], [-15, -23]], '#ff9fb4'); // みみ
      poly(ctx, [[-12, -22], [-10, -33], [-1, -22]], '#ff9fb4');
      ctx.beginPath(); // まきまき しっぽ
      ctx.arc(39, -9, 3.5, 0.6, PI * 1.9);
      ctx.strokeStyle = '#d9849a';
      ctx.lineWidth = 2;
      ctx.stroke();
      legRow(ctx, [-24, -12, 10, 22], 8, 20, 8, '#ffb3c4', '#d9849a', '#e38fa6');
      silhouetteOf(ctx, piece, [0, 2]);
      clipPart(ctx, piece.parts[0], () => oval(ctx, 0, 13, 30, 8, '#ffd9e2'));
      oval(ctx, -37.5, -4, 1.3, 2.4, '#c9607a'); // はなの あな
      oval(ctx, -34, -4, 1.3, 2.4, '#c9607a');
      shine(ctx, -10, -16, 7, 3);
      eye(ctx, -24, -10, 3);
      cheek(ctx, -21, -1);
      smile(ctx, -30, 7, 2.6);
    },
  },

  // うし: しろに くろい もよう・ピンクの はな・つの
  cow: {
    color: '#ffffff',
    line: '#6b6b6b',
    parts: [
      { points: blob(62, 10, 2, 3, { cy: 15 }) },                    // あし（板）
      { points: blob(76, 34, 10, 8, { cy: -6 }) },                   // からだ
      { points: blob(26, 24, 9, 10, { cx: -42, cy: -10 }) },         // あたま
    ],
    draw(ctx, piece) {
      for (const horn of [[[-51, -20], [-55, -29], [-46, -22]], [[-37, -21], [-33, -30], [-31, -20]]]) {
        poly(ctx, horn, '#f3e6c4');
        line(ctx, [...horn, horn[0]], '#a89a7a', 1.3);
      }
      tail(ctx, [[37, -14], [43, -3], [43, 6]], '#ffffff', '#6b6b6b', 2);
      oval(ctx, 43, 8, 2.6, 4, '#3b3b3b');
      legRow(ctx, [-28, -16, 14, 26], 6, 20, 8, '#ffffff', '#6b6b6b', '#4a4a4a');
      silhouetteOf(ctx, piece, [1, 2]);
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, -12, -10, 10, 7, '#3b3b3b', 0.3);
        oval(ctx, 14, -1, 9, 6, '#3b3b3b', -0.2);
        oval(ctx, 30, -16, 7, 5, '#3b3b3b');
        oval(ctx, -26, 4, 5, 4, '#3b3b3b');
      });
      ovalLine(ctx, -57, -13, 5, 3, '#ffffff', '#6b6b6b', 1.4, -0.4); // みみ
      ovalLine(ctx, -27, -14, 5, 3, '#ffffff', '#6b6b6b', 1.4, 0.4);
      clipPart(ctx, piece.parts[2], () => {
        oval(ctx, -42, 1, 13, 7.5, '#ffc4cf'); // はな
        oval(ctx, -37, -18, 4.5, 3.5, '#3b3b3b');
      });
      dot(ctx, -46, 0, 1.4, '#c9607a');
      dot(ctx, -38, 0, 1.4, '#c9607a');
      eye(ctx, -47, -10, 2.6);
      eye(ctx, -37, -10, 2.6);
      shine(ctx, -6, -18, 7, 3);
    },
  },

  // ひつじ: もこもこの けいと・こげちゃの かお
  sheep: {
    color: '#fffaf0',
    line: '#c9bba6',
    parts: [
      { points: blob(48, 8, 2, 3, { cy: 16 }) },                           // あし（板）
      { points: blob(68, 36, 10, 14, { cy: -4 }) },                        // からだ（せなかは すこし平ら）
      { points: ellipse(11, 12, { cx: -36, cy: -6, n: 14 }), fill: '#6b5a50' }, // かお
    ],
    draw(ctx, piece) {
      legRow(ctx, [-20, -8, 8, 20], 8, 20, 7, '#6b5a50', '#4a3d35');
      // もこもこ（からだの ふちに まるを ならべて、1つの形として描く）
      const bumps = [
        [-24, -19, 7], [-12, -22, 7], [0, -23, 7], [12, -22, 7], [24, -19, 7],
        [33, -8, 6], [33, 4, 6], [-20, 11, 6], [-6, 12, 6], [8, 12, 6], [22, 11, 6],
      ];
      drawSilhouette(ctx, { line: piece.line, color: piece.color, parts: [piece.parts[1], ...bumps.map((circle) => ({ circle }))] });
      for (const [x, y] of [[-10, -8], [6, -12], [16, 0], [-2, 4]]) { // けいとの うずまき
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, PI * 1.5);
        ctx.strokeStyle = '#e8dfcf';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ovalLine(ctx, -47, -6, 6, 3, '#6b5a50', '#4a3d35', 1.3, 0.4); // みみ
      ovalLine(ctx, -25, -8, 6, 3, '#6b5a50', '#4a3d35', 1.3, -0.4);
      silhouetteOf(ctx, piece, [2]);
      dot(ctx, -39, -17, 4.5, '#fffaf0'); // あたまの けいと
      dot(ctx, -33, -18, 4.5, '#fffaf0');
      dot(ctx, -40, -6, 3.2, '#ffffff');
      dot(ctx, -32, -6, 3.2, '#ffffff');
      eye(ctx, -40, -6, 2.2);
      eye(ctx, -32, -6, 2.2);
      cheek(ctx, -42, 1, 2.4, 1.6);
      cheek(ctx, -30, 1, 2.4, 1.6);
      smile(ctx, -36, 2.5, 2.2);
      shine(ctx, -6, -21, 6, 2.5);
    },
  },

  // かば: 大きな あたま・ちいさな みみ・ひろい はな
  hippo: {
    color: '#b8a9c9',
    line: '#7f6f94',
    parts: [
      { points: blob(66, 8, 2, 3, { cx: -2, cy: 18 }) },              // あし（板。大きな あたまの下まで）
      { points: blob(70, 38, 11, 12, { cx: 6, cy: -4 }) },            // からだ（せなかは すこし平ら）
      { points: blob(36, 30, 12, 12, { cx: -32, cy: -8 }) },          // あたま（てっぺんを せなかと同じ高さに。上に乗った子が かたむかない）
    ],
    draw(ctx, piece) {
      ovalLine(ctx, -43, -23, 3, 4, '#b8a9c9', '#7f6f94', 1.4); // みみ
      ovalLine(ctx, -24, -23, 3, 4, '#b8a9c9', '#7f6f94', 1.4);
      tail(ctx, [[41, -6], [45, 0]], '#b8a9c9', '#7f6f94', 2);
      legRow(ctx, [-29, -15, 14, 27], 10, 22, 9, '#a897bd', '#7f6f94');
      silhouetteOf(ctx, piece, [1, 2]);
      clipPart(ctx, piece.parts[1], () => oval(ctx, 8, 15, 32, 9, '#d6cbe3'));
      clipPart(ctx, piece.parts[2], () => oval(ctx, -33, 0, 18, 10, '#cdbfdd')); // はな
      oval(ctx, -40, -5, 1.8, 1.3, '#6d5d82');
      oval(ctx, -26, -5, 1.8, 1.3, '#6d5d82');
      eye(ctx, -38, -14, 2.6);
      eye(ctx, -27, -14, 2.6);
      cheek(ctx, -45, -2, 3, 2);
      cheek(ctx, -20, -2, 3, 2);
      smile(ctx, -33, 1, 5);
      rrect(ctx, -37, 2.5, 2.6, 3, 0.8, '#ffffff', null); // は
      rrect(ctx, -31.6, 2.5, 2.6, 3, 0.8, '#ffffff', null);
      shine(ctx, 0, -17, 8, 3);
    },
  },

  // わに: ひらべったくて ながい・せなかの ぎざぎざ・ながい くち
  crocodile: {
    color: '#8cc77a',
    line: '#4f8a43',
    parts: [
      { points: pts([[-50, 2], [-46, -3], [-26, -5], [-26, 8], [-48, 8]]) },                 // はなさき
      { points: pts([[-28, -6], [-22, -11], [-12, -11], [34, -7], [50, 2], [46, 8], [-28, 8]]) }, // からだ
    ],
    draw(ctx, piece) {
      for (let x = -14; x <= 36; x += 6) { // せなかの ぎざぎざ（絵だけ）
        const top = -11 + Math.max(0, x + 12) * (4 / 46);
        poly(ctx, [[x, top + 1], [x + 3, top - 3.5], [x + 6, top + 1]], '#6faa5e');
      }
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[1], () => oval(ctx, 8, 8, 44, 4, '#d8ec9a'));
      clipPart(ctx, piece.parts[0], () => oval(ctx, -38, 8, 14, 3, '#d8ec9a'));
      for (const x of [-18, -6, 18, 30]) oval(ctx, x, 7, 4, 2.4, '#6faa5e'); // みじかい あし
      line(ctx, [[-49, 3], [-24, 4]], '#3f7a35', 1.4); // くち
      for (let x = -46; x <= -30; x += 4) poly(ctx, [[x, 3.2], [x + 1.2, 5.4], [x + 2.4, 3.4]], '#ffffff');
      dot(ctx, -47, -1, 1, '#3f7a35');
      dot(ctx, -20, -9, 3.8, '#ffffff');
      eye(ctx, -20, -9, 2.6);
      cheek(ctx, -22, 1, 3, 2);
      shine(ctx, 0, -6, 8, 2);
    },
  },

  // ねこ: こうばこずわり（まるい パン みたい）
  cat: {
    color: '#f7c08a',
    line: '#c98a4e',
    parts: [
      { points: blob(64, 38, 15, 8, { cx: 6, cy: -2 }) }, // からだ（ふっくら高め。せなかと あたまの高さを近づけて、上に積みやすく）
      { circle: [-20, -8, 15] },                         // あたま
    ],
    draw(ctx, piece) {
      for (const ear of [[[-33, -15], [-34, -30], [-22, -22]], [[-18, -23], [-7, -29], [-7, -15]]]) {
        poly(ctx, ear, '#f7c08a');
        line(ctx, [...ear, ear[0]], '#c98a4e', 1.8);
      }
      poly(ctx, [[-31, -18], [-32, -26], [-25, -21]], '#ffc4cf');
      poly(ctx, [[-15, -22], [-9, -26], [-9, -18]], '#ffc4cf');
      silhouetteOf(ctx, piece, [0, 1]);
      clipPart(ctx, piece.parts[0], () => {
        for (const x of [8, 16, 24, 32]) line(ctx, [[x, -22], [x + 2, -16], [x, -10]], '#e39a5a', 2.6); // しま
        oval(ctx, -8, 12, 10, 8, '#fff7ee'); // むね
      });
      tail(ctx, [[38, 10], [24, 15], [6, 15], [-4, 14]], '#f7c08a', '#c98a4e', 4.5); // しっぽ（まえに まく）
      for (const x of [-24, -20, -16]) line(ctx, [[x, -21], [x, -16]], '#e39a5a', 2);
      oval(ctx, -20, 0, 8.5, 5.5, '#fff7ee'); // くちもと
      eye(ctx, -26, -8, 2.8);
      eye(ctx, -14, -8, 2.8);
      poly(ctx, [[-21.6, -3.4], [-18.4, -3.4], [-20, -1.6]], '#ff8fa0');
      mouthW(ctx, -20, -0.8);
      for (const [a, b] of [[[-28, -1], [-37, -3]], [[-28, 1], [-37, 2]], [[-12, -1], [-3, -3]], [[-12, 1], [-3, 2]]]) line(ctx, [a, b], '#b07a46', 0.9);
      cheek(ctx, -29, 2, 2.6, 1.7);
      cheek(ctx, -11, 2, 2.6, 1.7);
      ovalLine(ctx, -10, 15, 4.5, 2.6, '#fff7ee', '#c98a4e', 1.2);
      shine(ctx, 14, -9, 6, 2.4);
    },
  },

  // いぬ: ふせ。たれた みみ・まきまき しっぽ
  dog: {
    color: '#e8b27a',
    line: '#a8723f',
    parts: [
      { points: blob(66, 36, 13, 8, { cx: 8, cy: -1 }) },             // からだ（ふっくら高め。上に積みやすく）
      { points: blob(24, 8, 3, 3, { cx: -30, cy: 13 }), fill: '#fff3df' }, // まえあし
      { circle: [-22, -6, 15] },                                      // あたま
    ],
    draw(ctx, piece) {
      ctx.beginPath(); // まきまき しっぽ（絵だけ）
      ctx.arc(40, -15, 6, PI * 0.6, PI * 2.1);
      ctx.strokeStyle = '#a8723f';
      ctx.lineWidth = 6.4;
      ctx.stroke();
      ctx.strokeStyle = '#e8b27a';
      ctx.lineWidth = 4;
      ctx.stroke();
      silhouetteOf(ctx, piece, [0, 1, 2]);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, 18, -12, 10, 6, '#d9965a');
        oval(ctx, 8, 15, 28, 4, '#fff3df');
      });
      line(ctx, [[-34, 13], [-34, 17]], '#c9a882', 1.1); // ゆび
      line(ctx, [[-26, 13], [-26, 17]], '#c9a882', 1.1);
      ovalLine(ctx, -34, -8, 5, 9, '#b97f4a', '#8a5a30', 1.4, 0.35); // たれた みみ
      ovalLine(ctx, -10, -8, 5, 9, '#b97f4a', '#8a5a30', 1.4, -0.35);
      oval(ctx, -22, 1, 9, 6, '#fff3df');
      oval(ctx, -22, -2.5, 3, 2.2, INK); // はな
      smile(ctx, -24, 2.5, 2);
      smile(ctx, -20, 2.5, 2);
      oval(ctx, -22, 5.2, 1.8, 2.2, '#ff8fa0'); // した
      eye(ctx, -27, -9, 2.8);
      eye(ctx, -17, -9, 2.8);
      cheek(ctx, -30, 0, 2.6, 1.7);
      cheek(ctx, -14, 0, 2.6, 1.7);
      shine(ctx, 10, -13, 6, 2.2);
    },
  },

  // ぞう: 大きな みみ・ながい はな（はなの先が 地面に つく）
  elephant: {
    color: '#aab8cc',
    line: '#6d7d96',
    parts: [
      { points: blob(56, 10, 2, 3, { cx: 6, cy: 18 }) },                  // あし（板）
      { points: blob(66, 40, 11, 10, { cx: 6, cy: -6 }) },                // からだ（せなかは すこし平ら）
      { points: pts([[-46, -6], [-38, -2], [-44, 20], [-51, 20]]) },      // はな
      { circle: [-32, -12, 16] },                                         // あたま
    ],
    draw(ctx, piece) {
      tail(ctx, [[38, -14], [43, -4]], '#aab8cc', '#6d7d96', 2);
      oval(ctx, 43.5, -2, 2, 3, '#6d7d96');
      legRow(ctx, [-14, -2, 20, 30], 8, 23, 9, '#aab8cc', '#6d7d96');
      for (const x of [-14, -2, 20, 30]) for (const dx of [-2.2, 0, 2.2]) dot(ctx, x + dx, 21.5, 0.9, '#ffffff'); // つめ
      line(ctx, [[-49, 18], [-55, 18], [-56, 13]], '#6d7d96', 6.4); // はなの先を くるん（絵だけ）
      line(ctx, [[-49, 18], [-55, 18], [-56, 13]], '#aab8cc', 4);
      silhouetteOf(ctx, piece, [1, 2, 3]);
      for (const y of [4, 9, 14]) line(ctx, [[-49, y], [-43, y + 1]], '#8a98ae', 1.1); // はなの しわ
      ovalLine(ctx, -19, -12, 11, 14, '#bcc8da', '#6d7d96', 1.8); // 大きな みみ
      oval(ctx, -19, -12, 7, 10, '#f3c9d4');
      poly(ctx, [[-44, -2], [-50, 3], [-43, 1]], '#ffffff'); // きば
      eye(ctx, -37, -15, 2.8);
      cheek(ctx, -38, -6, 3, 2);
      shine(ctx, 10, -20, 8, 3);
    },
  },

  // ---------- ふつう ----------

  // うさぎ: すわって まえを むく。ながい みみ
  rabbit: {
    color: '#fdfbf7',
    line: '#b9aaa0',
    parts: [
      { points: ellipse(5, 12, { cx: -7, cy: -31, n: 12 }) },          // みみ（ひだり）
      { points: ellipse(5, 12, { cx: 7, cy: -31, n: 12 }) },           // みみ（みぎ）
      { points: flatBottom(ellipse(20, 17, { cy: 9 }), 22) },          // からだ
      { points: ellipse(15, 13, { cy: -10, n: 18 }) },                 // あたま
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      oval(ctx, -7, -31, 2.4, 9, '#ffc4d2');
      oval(ctx, 7, -31, 2.4, 9, '#ffc4d2');
      eye(ctx, -6, -11, 2.8);
      eye(ctx, 6, -11, 2.8);
      oval(ctx, 0, -6, 1.8, 1.3, '#ff8fa0');
      mouthW(ctx, 0, -4.4, 1.4);
      cheek(ctx, -10, -5);
      cheek(ctx, 10, -5);
      ovalLine(ctx, -6, 17, 4, 3, '#fdfbf7', '#b9aaa0', 1.2); // まえあし
      ovalLine(ctx, 6, 17, 4, 3, '#fdfbf7', '#b9aaa0', 1.2);
      ovalLine(ctx, -15, 19, 6, 3, '#fdfbf7', '#b9aaa0', 1.2); // うしろあし
      ovalLine(ctx, 15, 19, 6, 3, '#fdfbf7', '#b9aaa0', 1.2);
      shine(ctx, -6, -19, 4, 2);
    },
  },

  // くま: すわって まえを むく
  bear: {
    color: '#b07a4f',
    line: '#7a4f2e',
    parts: [
      { circle: [-13, -24, 6] },
      { circle: [13, -24, 6] },
      { points: flatBottom(ellipse(22, 18, { cy: 10 }), 24) },
      { circle: [0, -10, 16] },
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      dot(ctx, -13, -24, 3, '#d9a77a');
      dot(ctx, 13, -24, 3, '#d9a77a');
      clipPart(ctx, piece.parts[2], () => oval(ctx, 0, 12, 13, 11, '#d9a77a'));
      ovalLine(ctx, -17, 6, 5, 8, '#9a6840', '#7a4f2e', 1.3, 0.3); // うで
      ovalLine(ctx, 17, 6, 5, 8, '#9a6840', '#7a4f2e', 1.3, -0.3);
      ovalLine(ctx, -10, 21, 6, 3.5, '#d9a77a', '#7a4f2e', 1.2);  // あしの うら
      ovalLine(ctx, 10, 21, 6, 3.5, '#d9a77a', '#7a4f2e', 1.2);
      oval(ctx, 0, -4, 8, 6, '#f1d3b0');
      oval(ctx, 0, -6.5, 3, 2, INK);
      mouthW(ctx, 0, -3.6, 1.5);
      eye(ctx, -6, -13, 2.6);
      eye(ctx, 6, -13, 2.6);
      cheek(ctx, -10, -5, 2.8, 1.8);
      cheek(ctx, 10, -5, 2.8, 1.8);
      shine(ctx, -6, -21, 4, 2);
    },
  },

  // パンダ: しろと くろ・めの まわりが くろい・ささを もつ
  panda: {
    color: '#ffffff',
    line: '#6b6b6b',
    parts: [
      { circle: [-13, -24, 6], fill: '#3b3b3b' },
      { circle: [13, -24, 6], fill: '#3b3b3b' },
      { points: flatBottom(ellipse(22, 18, { cy: 10 }), 24) },
      { circle: [0, -10, 16] },
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[2], () => {
        oval(ctx, 0, -2, 26, 7, '#3b3b3b');   // かたの くろい おび
        oval(ctx, -13, 21, 9, 7, '#3b3b3b');  // あし
        oval(ctx, 13, 21, 9, 7, '#3b3b3b');
      });
      oval(ctx, -6, -11, 4.2, 5.6, '#3b3b3b', 0.5); // めの まわり
      oval(ctx, 6, -11, 4.2, 5.6, '#3b3b3b', -0.5);
      eyeOnDark(ctx, -6, -11);
      eyeOnDark(ctx, 6, -11);
      oval(ctx, 0, -5, 2.6, 1.8, INK);
      mouthW(ctx, 0, -2.6, 1.4);
      cheek(ctx, -11, -3, 2.6, 1.7);
      cheek(ctx, 11, -3, 2.6, 1.7);
      line(ctx, [[6, 12], [16, -6]], '#7cc36a', 3); // ささ
      oval(ctx, 18, -8, 5, 2, '#9bd86a', -0.8);
      oval(ctx, 13, -3, 5, 2, '#9bd86a', 0.6);
      dot(ctx, 8, 8, 4, '#3b3b3b'); // ささを もつ て
    },
  },

  // ライオン: まるい たてがみ
  lion: {
    color: '#ffd27f',
    line: '#b06a2a',
    parts: [
      { points: blob(34, 22, 10, 6, { cy: 17 }) }, // からだ
      { circle: [0, -8, 22], fill: '#e8a050' },   // たてがみ
    ],
    draw(ctx, piece) {
      tail(ctx, [[16, 22], [26, 16], [28, 6]], '#ffd27f', '#b06a2a', 2.4);
      dot(ctx, 28, 4, 3.6, '#c8782e');
      const bumps = [];
      for (let i = 0; i < 12; i++) {
        const a = (i * PI * 2) / 12;
        bumps.push({ circle: [Math.cos(a) * 20, -8 + Math.sin(a) * 20, 6.5], fill: '#e8a050' });
      }
      drawSilhouette(ctx, { line: piece.line, color: piece.color, parts: [piece.parts[0], piece.parts[1], ...bumps] });
      ovalLine(ctx, -12, -21, 4, 4, '#ffd27f', '#b06a2a', 1.4); // みみ
      ovalLine(ctx, 12, -21, 4, 4, '#ffd27f', '#b06a2a', 1.4);
      ovalLine(ctx, 0, -6, 14, 13, '#ffd27f', '#c8823a', 1.4);  // かお
      oval(ctx, 0, 0, 8, 5, '#fff1d6');
      poly(ctx, [[-3, -3.5], [3, -3.5], [0, -0.5]], '#8a5a3a');
      mouthW(ctx, 0, 0.4, 1.5);
      eye(ctx, -6, -9, 2.6);
      eye(ctx, 6, -9, 2.6);
      cheek(ctx, -10, -2, 2.6, 1.7);
      cheek(ctx, 10, -2, 2.6, 1.7);
      for (const [x, y] of [[-5, 1], [-6, 3], [5, 1], [6, 3]]) dot(ctx, x, y, 0.6, '#b07a46');
      clipPart(ctx, piece.parts[0], () => oval(ctx, 0, 22, 10, 8, '#fff1d6'));
      ovalLine(ctx, -7, 26, 5.5, 3, '#ffd27f', '#b06a2a', 1.2);
      ovalLine(ctx, 7, 26, 5.5, 3, '#ffd27f', '#b06a2a', 1.2);
    },
  },

  // とら: ふせ。オレンジに くろい しま
  tiger: {
    color: '#ffb347',
    line: '#c2702a',
    parts: [
      { points: blob(68, 34, 13, 8, { cx: 8, cy: 0 }) }, // からだ（ふっくら高め）
      { points: blob(24, 8, 3, 3, { cx: -30, cy: 13 }), fill: '#fff3df' },
      { circle: [-22, -6, 15] },
    ],
    draw(ctx, piece) {
      ctx.beginPath(); // ながい しっぽ（絵だけ）
      ctx.moveTo(40, 2);
      ctx.quadraticCurveTo(52, -2, 47, -18);
      ctx.strokeStyle = '#c2702a';
      ctx.lineWidth = 6.4;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 4;
      ctx.stroke();
      for (const [x, y] of [[48.5, -6], [48.5, -12]]) line(ctx, [[x - 2, y], [x + 2, y]], INK, 1.6);
      ovalLine(ctx, -32, -17, 5, 5, '#ffb347', '#c2702a', 1.4); // まるい みみ
      ovalLine(ctx, -12, -17, 5, 5, '#ffb347', '#c2702a', 1.4);
      dot(ctx, -32, -17, 2.4, '#4a3b33');
      dot(ctx, -12, -17, 2.4, '#4a3b33');
      silhouetteOf(ctx, piece, [0, 1, 2]);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, 10, 15, 30, 5, '#ffe2b8');
        for (const x of [2, 10, 18, 26, 34]) line(ctx, [[x, -17], [x - 1, -11], [x + 0.5, -6]], INK, 2.8); // しま（せなかから おりる）
        for (const x of [6, 14, 22, 30]) line(ctx, [[x, 17], [x + 1, 12]], INK, 2.2);
      });
      for (const x of [-26, -22, -18]) line(ctx, [[x, -20], [x, -15]], INK, 1.8); // おでこの しま
      line(ctx, [[-37, -6], [-33, -5]], INK, 1.6);
      line(ctx, [[-7, -6], [-11, -5]], INK, 1.6);
      oval(ctx, -22, 1, 9, 6, '#fff6e6');
      poly(ctx, [[-24, -2.6], [-20, -2.6], [-22, -0.6]], '#ff8fa0');
      mouthW(ctx, -22, 0.4, 1.5);
      eye(ctx, -27, -8, 2.8);
      eye(ctx, -17, -8, 2.8);
      cheek(ctx, -30, 2, 2.6, 1.7);
      cheek(ctx, -14, 2, 2.6, 1.7);
      shine(ctx, 12, -12, 6, 2.2);
    },
  },

  // ひよこ: まんまるで きいろ
  chick: {
    color: '#ffe066',
    line: '#d9a520',
    parts: [{ points: flatBottom(ellipse(20, 19, { n: 22 }), 15) }],
    draw(ctx, piece) {
      for (const [x, r] of [[-3, -0.4], [0, 0], [3, 0.4]]) oval(ctx, x, -21, 2, 4.5, '#ffd43b', r); // あたまの け
      drawSilhouette(ctx, piece);
      ovalLine(ctx, 13, 4, 6, 8, '#ffd43b', '#d9a520', 1.4, 0.4); // はね
      eye(ctx, -6, -5, 2.8);
      eye(ctx, 6, -5, 2.8);
      poly(ctx, [[-3.4, 0], [3.4, 0], [0, 4]], '#ff9f40');
      cheek(ctx, -11, 2, 3, 2);
      cheek(ctx, 11, 2, 3, 2);
      line(ctx, [[-6, 12], [-6, 15], [-8.5, 16]], '#ff9f40', 1.6); // あし
      line(ctx, [[6, 12], [6, 15], [8.5, 16]], '#ff9f40', 1.6);
      shine(ctx, -7, -13, 5, 2.4);
    },
  },

  // はりねずみ: せなかが とげとげ・とがった はな
  hedgehog: {
    color: '#a87c56',
    line: '#6e4f36',
    parts: [
      { points: [...ellipse(30, 22, { cy: 10, from: PI, to: PI * 2, n: 14 }), ...pts([[29, 14], [-29, 14]])] }, // せなか
      { points: pts([[-26, 2], [-40, 8], [-38, 12], [-26, 14]]), fill: '#f3dcc0' },                             // はな
    ],
    draw(ctx, piece) {
      for (const [row, len] of [[0, 9], [0.5, 7]]) { // とげ（絵だけ）
        for (let i = 0; i <= 10; i++) {
          const a = PI * (1.08 + ((i + row) * 0.84) / 10);
          const bx = Math.cos(a) * 27;
          const by = 10 + Math.sin(a) * 19;
          const tx = Math.cos(a) * (27 + len);
          const ty = 10 + Math.sin(a) * (19 + len);
          const nx = -Math.sin(a) * 3;
          const ny = Math.cos(a) * 3;
          poly(ctx, [[bx - nx, by - ny], [tx, ty], [bx + nx, by + ny]], row ? '#8a6448' : '#6e4f36');
        }
      }
      silhouetteOf(ctx, piece, [1, 0]);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, -20, 11, 13, 11, '#f3dcc0'); // かお
        oval(ctx, 2, 14, 26, 4, '#f3dcc0');
      });
      dot(ctx, -16, -1, 3, '#c9a07a'); // みみ
      dot(ctx, -39, 9, 2.2, INK);
      eye(ctx, -24, 4, 2.6);
      cheek(ctx, -27, 10, 2.6, 1.7);
      smile(ctx, -33, 11, 2);
      ovalLine(ctx, -12, 14, 3.5, 2, '#f3dcc0', '#6e4f36', 1);
      ovalLine(ctx, 12, 14, 3.5, 2, '#f3dcc0', '#6e4f36', 1);
    },
  },

  // コアラ: ふわふわの 大きな みみ・大きな くろい はな
  koala: {
    color: '#b8bec8',
    line: '#7a828f',
    parts: [
      { circle: [-17, -18, 9] },
      { circle: [17, -18, 9] },
      { points: flatBottom(ellipse(20, 17, { cy: 10 }), 24) },
      { circle: [0, -10, 16] },
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      for (const s of [-1, 1]) {
        dot(ctx, s * 17, -18, 5.5, '#f4f4f6'); // みみの ふわふわ
        for (const [dx, dy] of [[-4, -3], [-1, -5], [3, -4]]) dot(ctx, s * (17 + dx), -18 + dy, 1.4, '#f4f4f6');
      }
      clipPart(ctx, piece.parts[2], () => oval(ctx, 0, 12, 12, 10, '#e3e6ec'));
      ovalLine(ctx, -13, 8, 4.5, 7, '#a6adb8', '#7a828f', 1.2, 0.4); // うで
      ovalLine(ctx, 13, 8, 4.5, 7, '#a6adb8', '#7a828f', 1.2, -0.4);
      oval(ctx, 16, 2, 5, 2.2, '#8ccf6a', -0.6); // はっぱ
      oval(ctx, 0, -6, 4.2, 5.6, '#4a4a52'); // 大きな はな
      dot(ctx, -1.2, -8.5, 1.1, '#8a8a96');
      eye(ctx, -8, -12, 2.4);
      eye(ctx, 8, -12, 2.4);
      smile(ctx, 0, 1, 2);
      cheek(ctx, -11, -3, 2.8, 1.8);
      cheek(ctx, 11, -3, 2.8, 1.8);
    },
  },

  // ---------- むずかしい（せが高い・上が でこぼこ・まるい） ----------

  // キリン: ながい くび・ちゃいろの もよう
  giraffe: {
    color: '#ffd27a',
    line: '#c8923a',
    parts: [
      { points: blob(36, 12, 2, 3, { cx: 8, cy: 26 }) },                 // あし（板）
      { points: blob(40, 22, 8, 6, { cx: 8, cy: 10 }) },                 // からだ
      { points: pts([[-12, 4], [-2, 2], [-14, -34], [-22, -34]]) },      // くび
      { points: blob(20, 12, 5, 5, { cx: -24, cy: -37 }) },              // あたま
    ],
    draw(ctx, piece) {
      for (const [x, tx] of [[-26, -27], [-20, -19]]) { // つの
        line(ctx, [[x, -42], [tx, -48]], '#c8923a', 2.4);
        dot(ctx, tx, -49, 2, '#a8773f');
      }
      tail(ctx, [[28, 4], [33, 13]], '#ffd27a', '#c8923a', 1.6);
      oval(ctx, 33.5, 15, 1.8, 2.8, '#a8773f');
      legRow(ctx, [-6, 4, 14, 22], 18, 32, 6, '#ffd27a', '#c8923a', '#a8773f');
      silhouetteOf(ctx, piece, [1, 2, 3]);
      line(ctx, [[-3, 0], [-13, -32]], '#c8823a', 3); // たてがみ
      clipPart(ctx, piece.parts[1], () => {
        for (const [x, y, rx, ry, r] of [[2, 6, 5, 4, 0.3], [14, 4, 5, 3.5, -0.2], [23, 12, 4, 3.5, 0.4], [7, 15, 4, 3, 0], [-6, 11, 3.5, 3, 0.2]]) oval(ctx, x, y, rx, ry, '#d4924a', r);
      });
      clipPart(ctx, piece.parts[2], () => {
        for (const [x, y, r] of [[-10, -4, 3], [-14, -14, 2.8], [-16, -24, 2.4], [-8, -11, 2.2], [-12, -30, 2]]) oval(ctx, x, y, r, r * 0.85, '#d4924a');
      });
      ovalLine(ctx, -15, -40, 4, 2, '#ffd27a', '#c8923a', 1.2, -0.5); // みみ
      clipPart(ctx, piece.parts[3], () => oval(ctx, -32, -35, 5, 4.5, '#f2c06a'));
      dot(ctx, -32, -36, 0.9, '#a8773f');
      eye(ctx, -24, -39, 2.4);
      cheek(ctx, -22, -34, 2.4, 1.6);
      smile(ctx, -30, -33.5, 1.8);
    },
  },

  // しまうま: しろと くろの しま・たてがみ
  zebra: {
    color: '#ffffff',
    line: '#4a4a4a',
    parts: [
      { points: blob(44, 14, 2, 3, { cy: 17 }) },                                                     // あし（板）
      { points: blob(56, 26, 12, 8, { cy: -2 }) },                                                    // からだ
      { points: pts([[-24, -6], [-16, -14], [-26, -34], [-34, -35], [-46, -20], [-44, -14]]) },       // くび＋あたま
    ],
    draw(ctx, piece) {
      poly(ctx, [[-30, -33], [-28, -43], [-23, -33]], '#ffffff'); // みみ
      line(ctx, [[-30, -33], [-28, -43], [-23, -33]], '#4a4a4a', 1.6);
      poly(ctx, [[-28.5, -35], [-27.6, -40], [-25.4, -35]], '#ffc4cf');
      tail(ctx, [[28, -10], [33, 2]], '#ffffff', '#4a4a4a', 1.6);
      oval(ctx, 33.5, 4, 2, 3.4, INK);
      legRow(ctx, [-16, -6, 8, 18], 8, 24, 6, '#ffffff', '#4a4a4a', INK);
      for (const x of [-16, -6, 8, 18]) for (const y of [12, 16]) line(ctx, [[x - 2.5, y], [x + 2.5, y]], INK, 1.4);
      silhouetteOf(ctx, piece, [1, 2]);
      clipPart(ctx, piece.parts[1], () => {
        for (const x of [-20, -12, -4, 4, 12, 20]) line(ctx, [[x - 2, -16], [x + 2, -5], [x - 1, 6]], INK, 3);
      });
      clipPart(ctx, piece.parts[2], () => {
        for (const [a, b] of [[[-27, -12], [-19, -18]], [[-29, -18], [-21, -24]]]) line(ctx, [a, b], INK, 2.6); // くびの しま
        oval(ctx, -44, -18, 6.5, 5.5, '#4a4a4a'); // くろい はなさき
      });
      line(ctx, [[-17, -15], [-26, -33]], INK, 3.6); // たてがみ（くろい おび）
      for (let i = 0; i < 5; i++) line(ctx, [[-17.5 - i * 1.9, -16 - i * 3.8], [-15 - i * 1.9, -17.5 - i * 3.8]], INK, 2);
      dot(ctx, -46, -19, 1, '#ffffff');
      dot(ctx, -32, -27, 3.4, '#ffffff');
      eye(ctx, -32, -27, 2.6);
      cheek(ctx, -35, -21, 2.6, 1.7);
    },
  },

  // さる: ハートの かお・くるんと まいた しっぽ・バナナ
  monkey: {
    color: '#a0703f',
    line: '#6e4a28',
    parts: [
      { circle: [-16, -10, 6] },
      { circle: [16, -10, 6] },
      { points: flatBottom(ellipse(17, 16, { cy: 12 }), 26) },
      { circle: [0, -10, 15] },
    ],
    draw(ctx, piece) {
      ctx.beginPath(); // くるんと まいた しっぽ（絵だけ）
      ctx.moveTo(14, 20);
      ctx.quadraticCurveTo(30, 18, 27, 4);
      ctx.arc(23, 4, 4, 0, -PI * 1.4, true);
      ctx.strokeStyle = '#6e4a28';
      ctx.lineWidth = 4.4;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.strokeStyle = '#a0703f';
      ctx.lineWidth = 2.4;
      ctx.stroke();
      drawSilhouette(ctx, piece);
      dot(ctx, -16, -10, 3, '#f5c9a0');
      dot(ctx, 16, -10, 3, '#f5c9a0');
      dot(ctx, -5, -12, 6, '#f5c9a0'); // ハートの かお
      dot(ctx, 5, -12, 6, '#f5c9a0');
      oval(ctx, 0, -5, 9.5, 7.5, '#f5c9a0');
      clipPart(ctx, piece.parts[2], () => oval(ctx, 0, 14, 10, 9, '#f5c9a0'));
      eye(ctx, -5, -12, 2.4);
      eye(ctx, 5, -12, 2.4);
      dot(ctx, -1.4, -6, 0.9, '#8a5a3a');
      dot(ctx, 1.4, -6, 0.9, '#8a5a3a');
      smile(ctx, 0, -3, 3.2);
      cheek(ctx, -9, -5, 2.6, 1.7);
      cheek(ctx, 9, -5, 2.6, 1.7);
      ctx.beginPath(); // バナナ
      ctx.arc(2, 4, 8, PI * 0.15, PI * 0.75);
      ctx.strokeStyle = '#e8c23a';
      ctx.lineWidth = 3.6;
      ctx.stroke();
      ovalLine(ctx, -6, 10, 3.6, 3, '#a0703f', '#6e4a28', 1.2); // て
      ovalLine(ctx, 9, 10, 3.6, 3, '#a0703f', '#6e4a28', 1.2);
    },
  },

  // ふくろう: たまご形・大きな め・みみの はね
  owl: {
    color: '#b08b62',
    line: '#7a5a3a',
    parts: [{ points: flatBottom(ellipse(20, 28, { n: 22 }), 24) }],
    draw(ctx, piece) {
      poly(ctx, [[-17, -18], [-16, -33], [-8, -24]], '#94704a'); // みみの はね
      poly(ctx, [[17, -18], [16, -33], [8, -24]], '#94704a');
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, -19, 4, 6, 15, '#94704a'); // つばさ
        oval(ctx, 19, 4, 6, 15, '#94704a');
        oval(ctx, 0, 11, 12, 14, '#f1dcc0'); // おなか
      });
      for (const [x, y] of [[-5, 4], [4, 4], [-7, 11], [2, 11], [-3, 18], [6, 17]]) {
        line(ctx, [[x - 2, y - 1.5], [x, y], [x + 2, y - 1.5]], '#b08b62', 1.2);
      }
      ovalLine(ctx, -8, -12, 8, 8, '#f7ecdc', '#c9a780', 1.2);
      ovalLine(ctx, 8, -12, 8, 8, '#f7ecdc', '#c9a780', 1.2);
      dot(ctx, -8, -12, 5, '#ffcc4d');
      dot(ctx, 8, -12, 5, '#ffcc4d');
      eye(ctx, -8, -12, 3.2);
      eye(ctx, 8, -12, 3.2);
      poly(ctx, [[-2.5, -6], [2.5, -6], [0, -1]], '#f2a33a');
      cheek(ctx, -13, -3, 2.6, 1.7);
      cheek(ctx, 13, -3, 2.6, 1.7);
      for (const x of [-6, 6]) for (const dx of [-2, 0, 2]) line(ctx, [[x + dx, 21], [x + dx, 24]], '#f2a33a', 1.4); // あし
    },
  },

  // りす: ふさふさの 大きな しっぽ・どんぐりを もつ
  squirrel: {
    color: '#d9894a',
    line: '#9a5a2a',
    parts: [
      // しっぽ と からだ の下は 同じ高さで平ら（しっぽが おもいので、しっぽでも ささえる。1点だと たおれる）
      { points: flatBottom(ellipse(13, 23, { cx: 14, cy: 0, n: 16 }), 20), fill: '#e8a060' }, // しっぽ
      { points: flatBottom(ellipse(14, 16, { cx: -6, cy: 9 }), 20) },         // からだ
      { circle: [-10, -12, 11] },                                             // あたま
    ],
    draw(ctx, piece) {
      poly(ctx, [[-15, -20], [-16, -31], [-8, -22]], '#d9894a'); // みみ
      line(ctx, [[-15, -20], [-16, -31], [-8, -22]], '#9a5a2a', 1.4);
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        for (const y of [-14, -4, 6]) {
          ctx.beginPath();
          ctx.arc(14, y, 9, PI * 1.1, PI * 1.9);
          ctx.strokeStyle = '#f3c08a';
          ctx.lineWidth = 2.4;
          ctx.stroke();
        }
      });
      clipPart(ctx, piece.parts[1], () => oval(ctx, -8, 12, 8, 9, '#fbe3c4'));
      oval(ctx, -17, -9, 5, 4, '#fbe3c4');
      dot(ctx, -21, -10, 1.4, INK);
      eye(ctx, -11, -14, 2.6);
      cheek(ctx, -11, -7, 2.6, 1.7);
      smile(ctx, -17, -6.5, 1.8);
      oval(ctx, -15, 6, 3.4, 4, '#c08850'); // どんぐり
      oval(ctx, -15, 2.6, 4, 2, '#7a5a3a');
      ovalLine(ctx, -19, 5, 2.6, 2.2, '#d9894a', '#9a5a2a', 1.1); // て
      ovalLine(ctx, -11, 5, 2.6, 2.2, '#d9894a', '#9a5a2a', 1.1);
    },
  },

  // かえる: 上に とびだした め・大きな くち
  frog: {
    color: '#8fd16a',
    line: '#4f9a3a',
    parts: [
      { circle: [-12, -11, 7] },
      { circle: [12, -11, 7] },
      { points: flatBottom(ellipse(24, 16, { cy: 4 }), 18) },
    ],
    draw(ctx, piece) {
      ovalLine(ctx, -21, 14, 8, 4, '#7cc35a', '#4f9a3a', 1.4, -0.2); // うしろあし
      ovalLine(ctx, 21, 14, 8, 4, '#7cc35a', '#4f9a3a', 1.4, 0.2);
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[2], () => oval(ctx, 0, 15, 14, 8, '#e6f5c8'));
      for (const [x, y] of [[-6, -6], [8, -4], [16, 2], [-15, 0]]) dot(ctx, x, y, 1.6, '#6fb84f');
      dot(ctx, -12, -12, 4.6, '#ffffff');
      dot(ctx, 12, -12, 4.6, '#ffffff');
      eye(ctx, -12, -12, 2.6);
      eye(ctx, 12, -12, 2.6);
      ctx.beginPath(); // 大きな にっこり くち
      ctx.arc(0, -2, 10, PI * 0.18, PI * 0.82);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      cheek(ctx, -15, 4, 3.4, 2.2);
      cheek(ctx, 15, 4, 3.4, 2.2);
      ovalLine(ctx, -7, 16, 3.6, 2, '#7cc35a', '#4f9a3a', 1.1); // まえあし
      ovalLine(ctx, 7, 16, 3.6, 2, '#7cc35a', '#4f9a3a', 1.1);
    },
  },

  // へび: とぐろを まいた 3だん・ちろっと した
  snake: {
    color: '#9bd27a',
    line: '#5a9a42',
    parts: [
      { points: blob(56, 14, 7, 6, { cy: 12 }) },                 // した の だん
      { points: blob(44, 13, 6, 6, { cy: -1 }) },                 // まんなか
      { points: blob(30, 12, 6, 6, { cy: -13 }) },                // うえ
      { points: ellipse(10, 7, { cx: 4, cy: -24, n: 14 }) },      // あたま
    ],
    draw(ctx, piece) {
      line(ctx, [[-5, -22], [-11, -22], [-13, -24]], '#ff6b78', 1.3); // した（絵だけ）
      line(ctx, [[-11, -22], [-13, -20]], '#ff6b78', 1.3);
      drawSilhouette(ctx, piece);
      piece.parts.forEach((part, i) => {
        if (i === 3) return;
        const bottom = [19, 5.5, -7][i];
        const half = [26, 20, 13][i];
        clipPart(ctx, part, () => {
          oval(ctx, 0, bottom, half, 3.2, '#e2f3b8'); // おなか
          for (let x = -half + 6; x <= half - 6; x += 8) oval(ctx, x, bottom - 6.5, 2.4, 1.6, '#6fb84f'); // もよう
        });
      });
      strokePart(ctx, piece.parts[1], '#5a9a42', 1.6); // だんの さかいめ
      strokePart(ctx, piece.parts[2], '#5a9a42', 1.6);
      strokePart(ctx, piece.parts[3], '#5a9a42', 1.6);
      eye(ctx, 0, -26, 2.4);
      cheek(ctx, 3, -21, 2.4, 1.6);
      smile(ctx, -3, -22, 1.8);
      shine(ctx, 8, -27, 3, 1.6);
    },
  },

  // きつね: とがった みみ・しろい ほっぺ・ふさふさ しっぽ
  fox: {
    color: '#f59a4a',
    line: '#c0622a',
    parts: [
      // しっぽは 地面から すこし うかせる（からだと しっぽの2か所で 同時に着地すると、
      // ぶつかった いきおいが 左右で ずれて たおれやすいため。おもさの中心は からだの下に ある）
      { points: flatBottom(ellipse(9, 17, { cx: 18, cy: 8, n: 14 }), 20) },      // しっぽ
      { points: flatBottom(ellipse(15, 17, { cy: 10 }), 22) },                    // からだ
      { points: pts([[-17, -18], [-15, -33], [-5, -20]]) },                       // みみ（ひだり）
      { points: pts([[17, -18], [15, -33], [5, -20]]) },                          // みみ（みぎ）
      { points: pts([[-17, -20], [17, -20], [13, -8], [0, 2], [-13, -8]]) },      // あたま
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => oval(ctx, 18, 21, 9, 6, '#ffffff'));    // しっぽの先
      clipPart(ctx, piece.parts[2], () => oval(ctx, -15, -31, 4, 5, '#4a3b33'));  // みみの先
      clipPart(ctx, piece.parts[3], () => oval(ctx, 15, -31, 4, 5, '#4a3b33'));
      poly(ctx, [[-13, -20], [-13, -27], [-8, -21]], '#ffd9c0');
      poly(ctx, [[13, -20], [13, -27], [8, -21]], '#ffd9c0');
      clipPart(ctx, piece.parts[4], () => {
        oval(ctx, -7, -5, 8, 6, '#fff7ee'); // しろい ほっぺ
        oval(ctx, 7, -5, 8, 6, '#fff7ee');
      });
      clipPart(ctx, piece.parts[1], () => oval(ctx, 0, 6, 8, 9, '#fff7ee'));
      eye(ctx, -7, -12, 2.4);
      eye(ctx, 7, -12, 2.4);
      dot(ctx, 0, -2, 2, INK);
      smile(ctx, 0, 1, 1.8);
      cheek(ctx, -10, -7, 2.4, 1.6);
      cheek(ctx, 10, -7, 2.4, 1.6);
      oval(ctx, -6, 20, 4, 2.6, '#4a3b33'); // くつした
      oval(ctx, 6, 20, 4, 2.6, '#4a3b33');
    },
  },

  // ---------- おとな（1本あし・まんまる・でこぼこ） ----------

  // フラミンゴ: 1本あしで立つ・S字の くび
  flamingo: {
    color: '#ffa3be',
    line: '#d9607f',
    parts: [
      // あし＋あしの うら は 当たり判定では1つの だいけい（部品が分かれていると 着地で ゆれが大きい）。絵は ほそい あし
      { points: pts([[1, 4], [6, 4], [14, 31], [-7, 31]]) },
      { points: ellipse(20, 12, { cx: 4, cy: -6, n: 18 }) },                         // からだ
      { points: pts([[-12, -12], [-6, -10], [-12, -34], [-17, -34]]) },              // くび
      { circle: [-13, -37, 6] },                                                     // あたま
    ],
    draw(ctx, piece) {
      line(ctx, [[6, 2], [14, 11], [6, 17]], '#d9607f', 3.4); // まげた あし（絵だけ）
      line(ctx, [[6, 2], [14, 11], [6, 17]], '#ff8fb0', 2);
      line(ctx, [[3.5, 4], [3.5, 29]], '#d9607f', 4.4); // 立っている あし
      line(ctx, [[3.5, 4], [3.5, 29]], '#ff8fb0', 2.6);
      rrect(ctx, -6, 28, 19, 3.4, 1.6, '#ff8fb0', '#d9607f', 1.4); // あしの うら
      poly(ctx, [[22, -10], [30, -12], [24, -4]], '#ff7fa4'); // しっぽの はね
      silhouetteOf(ctx, piece, [1, 2, 3]);
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, 9, -6, 12, 7, '#ff7fa4'); // はね
        for (const x of [4, 9, 14]) line(ctx, [[x, -10], [x + 3, -3]], '#ffb8cb', 1.2);
      });
      poly(ctx, [[-18, -38], [-24, -33], [-21, -31], [-17, -35]], '#ffd9e2'); // くちばし
      poly(ctx, [[-21.5, -34], [-24, -33], [-21, -31]], INK);
      eye(ctx, -12, -39, 2);
      cheek(ctx, -10, -35, 2, 1.4);
    },
  },

  // カンガルー: 大きな あし・ふとい しっぽ・おなかの ポケットに あかちゃん
  kangaroo: {
    color: '#c99060',
    line: '#8a5a34',
    pad: 12, // みみが はみ出すぶん
    parts: [
      { points: pts([[8, 8], [14, 8], [30, 25], [26, 28]]) },                  // しっぽ
      { points: pts([[-14, 22], [12, 22], [14, 28], [-16, 28]]), fill: '#b57d50' }, // あし
      { points: ellipse(14, 20, { cx: 2, cy: 4, n: 18 }) },                    // からだ
      { points: ellipse(9, 8, { cx: -2, cy: -22, n: 14 }) },                   // あたま
    ],
    draw(ctx, piece) {
      ovalLine(ctx, -7, -32, 3, 7, '#c99060', '#8a5a34', 1.4, -0.3); // みみ
      ovalLine(ctx, 3, -33, 3, 7, '#c99060', '#8a5a34', 1.4, 0.3);
      oval(ctx, -7, -32, 1.4, 4.5, '#f3b8a8', -0.3);
      oval(ctx, 3, -33, 1.4, 4.5, '#f3b8a8', 0.3);
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[2], () => oval(ctx, 0, 9, 9, 13, '#f0d2b0'));
      ovalLine(ctx, -8, 25.5, 9, 3.4, '#c99060', '#8a5a34', 1.4); // 大きな あし 2つ
      ovalLine(ctx, 6, 25.5, 9, 3.4, '#c99060', '#8a5a34', 1.4);
      ovalLine(ctx, 1, 6, 4.6, 4.6, '#c99060', '#8a5a34', 1.2); // あかちゃん
      dot(ctx, -0.6, 5.6, 0.9, INK);
      dot(ctx, 2.6, 5.6, 0.9, INK);
      ctx.beginPath(); // ポケット
      ctx.arc(1, 6, 8, PI * 0.1, PI * 0.9);
      ctx.strokeStyle = '#8a5a34';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ovalLine(ctx, -9, -5, 2.6, 4.6, '#c99060', '#8a5a34', 1.2, 0.3); // て
      oval(ctx, -6, -19, 5, 4, '#f0d2b0');
      dot(ctx, -10, -21, 1.5, INK);
      eye(ctx, -3, -24, 2.4);
      cheek(ctx, 1, -19, 2.4, 1.6);
      smile(ctx, -7, -17, 1.6);
    },
  },

  // らくだ: せなかに こぶ2つ（上が でこぼこ）
  camel: {
    color: '#e0b57a',
    line: '#a8773f',
    parts: [
      { points: blob(40, 16, 2, 3, { cx: 4, cy: 15 }) },                      // あし（板）
      { points: blob(54, 22, 8, 6, { cx: 4, cy: -4 }) },                      // からだ
      { circle: [-4, -16, 9] },                                               // こぶ
      { circle: [16, -16, 9] },
      { points: pts([[-24, -6], [-14, -6], [-30, -24], [-40, -24]]) },        // くび
      { points: blob(16, 10, 4, 4, { cx: -38, cy: -27 }) },                   // あたま
    ],
    draw(ctx, piece) {
      tail(ctx, [[31, -6], [35, 4]], '#e0b57a', '#a8773f', 1.6);
      oval(ctx, 35.5, 5.5, 1.8, 3, '#a8773f');
      legRow(ctx, [-10, 0, 14, 22], 4, 23, 5.5, '#e0b57a', '#a8773f', '#a8773f');
      for (const x of [-10, 0, 14, 22]) ovalLine(ctx, x, 13, 3.4, 2, '#e0b57a', '#a8773f', 1); // ひざ
      silhouetteOf(ctx, piece, [1, 2, 3, 4, 5]);
      shine(ctx, -6, -21, 4, 2);
      shine(ctx, 14, -21, 4, 2);
      ovalLine(ctx, -32, -31, 2.6, 1.6, '#e0b57a', '#a8773f', 1.1, -0.4); // みみ
      line(ctx, [[-39, -30], [-41, -31]], '#a8773f', 1); // まつげ
      eye(ctx, -38, -28, 2.2);
      dot(ctx, -45, -27, 0.9, '#a8773f');
      smile(ctx, -43, -25.5, 1.8);
      cheek(ctx, -35, -24, 2.2, 1.5);
    },
  },

  // さい: はなの上に 大きな つの
  rhino: {
    color: '#a9a9b5',
    line: '#6d6d7a',
    parts: [
      { points: blob(52, 10, 2, 3, { cx: 6, cy: 18 }) },                                  // あし（板）
      { points: blob(68, 36, 16, 10, { cx: 6, cy: -4 }) },                                // からだ
      { points: pts([[-26, -14], [-18, 8], [-44, 8], [-50, 0], [-42, -12]]) },            // あたま
      { points: pts([[-46, -2], [-50, -22], [-38, -8]]), fill: '#e2dccd' },               // つの
    ],
    draw(ctx, piece) {
      ovalLine(ctx, -28, -17, 3, 5, '#a9a9b5', '#6d6d7a', 1.4, 0.3); // みみ
      tail(ctx, [[40, -8], [44, 2]], '#a9a9b5', '#6d6d7a', 1.6);
      legRow(ctx, [-12, 0, 22, 32], 10, 23, 9, '#a9a9b5', '#6d6d7a');
      for (const x of [-12, 0, 22, 32]) for (const dx of [-2.2, 0, 2.2]) dot(ctx, x + dx, 21.5, 0.9, '#e2dccd');
      silhouetteOf(ctx, piece, [1, 2, 3]);
      poly(ctx, [[-34, -12], [-35, -19], [-30, -13]], '#e2dccd'); // 2本めの つの
      clipPart(ctx, piece.parts[1], () => {
        for (const x of [-12, 22]) {
          ctx.beginPath();
          ctx.arc(x, -2, 16, PI * 1.25, PI * 1.75);
          ctx.strokeStyle = '#8f8f9c';
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
        oval(ctx, 6, 13, 30, 5, '#c2c2cc');
      });
      eye(ctx, -31, -4, 2.4);
      cheek(ctx, -33, 2, 2.8, 1.8);
      smile(ctx, -44, 3, 2);
      dot(ctx, -47, -1, 1, '#6d6d7a');
      shine(ctx, 0, -18, 7, 2.6);
    },
  },

  // ハムスター: おすわりした ぜんしん（v0.17.22で かおだけ→からだつきに）。ほおぶくろ・しろい おなか・
  // りょうてで ひまわりの たね・ピンクの あし。おしりの下は平らで すわれるが、あたまは まるいので上に積みにくい
  hamster: {
    color: '#f5c28a',
    line: '#c98a4e',
    friction: 0.8,
    parts: [
      { points: flatBottom(ellipse(23, 18, { cy: 4, n: 28 }), 20) }, // からだ（ずんぐり）
      { points: ellipse(19, 14, { cy: -13, n: 26 }) },               // あたま
    ],
    draw(ctx, piece) {
      ovalLine(ctx, -12, -24, 5.5, 5, '#f5c28a', '#c98a4e', 1.6); // みみ
      ovalLine(ctx, 12, -24, 5.5, 5, '#f5c28a', '#c98a4e', 1.6);
      dot(ctx, -12, -24, 3, '#ffc4cf');
      dot(ctx, 12, -24, 3, '#ffc4cf');
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => oval(ctx, 0, 12, 15, 13, '#fff8ee')); // しろい おなか
      clipPart(ctx, piece.parts[1], () => oval(ctx, 0, -3, 14, 7.5, '#fff8ee')); // くちの まわり
      oval(ctx, -12, -6, 7, 5.5, '#ffe6cc'); // ほおぶくろ（ぷっくり）
      oval(ctx, 12, -6, 7, 5.5, '#ffe6cc');
      eye(ctx, -7.5, -14, 2.8);
      eye(ctx, 7.5, -14, 2.8);
      oval(ctx, 0, -9.5, 1.8, 1.3, '#ff8fa0'); // はな
      mouthW(ctx, 0, -7.6, 1.4);
      cheek(ctx, -12.5, -7, 3, 2);
      cheek(ctx, 12.5, -7, 3, 2);
      ovalLine(ctx, -10.5, 4, 5.5, 3.4, '#f5c28a', '#c98a4e', 1.4, 0.55); // うで
      ovalLine(ctx, 10.5, 4, 5.5, 3.4, '#f5c28a', '#c98a4e', 1.4, -0.55);
      ovalLine(ctx, 0, 6, 3.4, 5.6, '#4a3b33', '#2f2520', 1); // ひまわりの たね
      line(ctx, [[0, 2], [0, 10]], '#ffffff', 1);
      ovalLine(ctx, -4.6, 6.5, 2.6, 2.3, '#ffb3c0', '#d98c99', 1.2); // て
      ovalLine(ctx, 4.6, 6.5, 2.6, 2.3, '#ffb3c0', '#d98c99', 1.2);
      for (const s of [-1, 1]) { // あし（あしうらと ゆび）
        ovalLine(ctx, s * 11, 17.5, 5.5, 2.8, '#ffb3c0', '#d98c99', 1.3);
        for (const dx of [-2.6, 0, 2.6]) dot(ctx, s * 11 + dx, 16.2, 0.9, '#ff8fa0');
      }
      shine(ctx, -8, -21, 5, 2.4);
    },
  },

  // だちょう: ながい くびと ながい あし・くろい からだに しろい はね
  ostrich: {
    color: '#4a4a52',
    line: '#2e2e36',
    parts: [
      { points: pts([[0, 10], [12, 10], [14, 30], [-2, 30]]) },                            // あし（板）
      { points: ellipse(20, 14, { cx: 6, cy: -2, n: 18 }) },                               // からだ
      { points: pts([[-8, -8], [-2, -6], [-10, -34], [-15, -34]]), fill: '#f2c6c6' },      // くび
      { points: ellipse(6, 5, { cx: -13, cy: -37, n: 12 }), fill: '#f2c6c6' },             // あたま
    ],
    draw(ctx, piece) {
      for (const [a, b, c] of [[[3, 10], [0, 20], [1, 29]], [[9, 10], [12, 20], [11, 29]]]) { // ながい あし
        line(ctx, [a, b, c], '#b07a7a', 4);
        line(ctx, [a, b, c], '#f2b0b0', 2.4);
      }
      oval(ctx, -1, 29.5, 4, 1.6, '#b07a7a');
      oval(ctx, 13, 29.5, 4, 1.6, '#b07a7a');
      silhouetteOf(ctx, piece, [1, 2, 3]);
      ovalLine(ctx, 26, -6, 5, 4, '#ffffff', '#c9c9d2', 1.2); // しっぽの しろい はね
      ovalLine(ctx, 24, -12, 4, 3.4, '#ffffff', '#c9c9d2', 1.2);
      clipPart(ctx, piece.parts[1], () => oval(ctx, 10, -6, 10, 6, '#ffffff')); // はね
      for (const x of [6, 10, 14]) line(ctx, [[x, -10], [x + 2, -3]], '#d6d6de', 1.1);
      poly(ctx, [[-18, -37], [-24, -35], [-18, -34]], '#f2a33a');
      line(ctx, [[-14, -40], [-16, -42]], INK, 1); // まつげ
      eye(ctx, -13, -38, 2.4);
      cheek(ctx, -10, -34, 2, 1.4);
    },
  },
};
