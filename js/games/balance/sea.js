// sea.js — うみの いきもの つみき（v0.17.12）
// 1ぴきずつ「当たり判定の形（凸の部品）」と「絵の描き方」を持つ。座標はそのいきものの まんなかが(0,0)。
// 形は絵とほぼ同じにしてある（見た目と ころがり方が ずれると、子どもが「なんで？」となるため）。
// ひれ・あしの先など細かいところは絵だけ（当たり判定に入れると引っかかりすぎて積めない）
// parts の並びが ぬる順（あとのものが上に重なる）。fill を書いた部品はその色でぬる

import {
  ellipse, blob, pts, starPolys, flatBottom,
  drawSilhouette, strokePart, clipPart, cut,
  oval, dot, poly, line, eye, cheek, smile, pout, shine,
} from './kit.js';

const PI = Math.PI;

export const SEA_PIECES = {
  // くじら: 平らなおなかで いちばん積みやすい（かんたん）
  whale: {
    color: '#8fc6f0',
    line: '#4f88c0',
    parts: [
      // しっぽは せなかより上に出さない（上に乗せた子が しっぽの先に乗って かたむくため）
      { points: pts([[30, -6], [46, -8], [46, 6], [32, 12]]) },   // しっぽの つけね
      { points: pts([[40, -6], [52, -20], [59, -14], [46, 0]]) },  // おびれ（うえ）
      { points: pts([[40, 4], [46, -2], [59, 10], [52, 16]]) },    // おびれ（した）
      { points: blob(80, 42, 14, 8) },                            // せなかは すこし平ら（上に積めるように）
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[3], () => oval(ctx, -8, 22, 40, 12, '#e3f2fc')); // おなか
      shine(ctx, -10, -13, 7, 3.5);
      eye(ctx, -24, -3);
      cheek(ctx, -15, 5);
      smile(ctx, -31, 5, 4);
    },
  },

  // かめ: こうら＋あし（平ら）＋あたま
  turtle: {
    color: '#8fd19e',
    line: '#4f9a62',
    parts: [
      { points: blob(58, 10, 2, 5, { cx: 2, cy: 15 }), fill: '#f3e3a1' }, // あし
      { circle: [-37, -3, 11], fill: '#f3e3a1' },                         // あたま
      { points: blob(66, 34, 10, 5, { cy: -4 }) },                        // こうら（上は すこし平ら。まるいと上の子が すべる）
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      line(ctx, [[-12, 13], [-12, 20]], '#c9b26a', 1.6); // あしの さかいめ
      line(ctx, [[16, 13], [16, 20]], '#c9b26a', 1.6);
      clipPart(ctx, piece.parts[2], () => {
        // こうらの もよう（まんなかの六角形から外へ線）
        const hex = [];
        for (let i = 0; i < 6; i++) {
          const a = (i * PI) / 3;
          hex.push([2 + Math.cos(a) * 9, -6 + Math.sin(a) * 8]);
          line(ctx, [[2 + Math.cos(a) * 9, -6 + Math.sin(a) * 8], [2 + Math.cos(a) * 40, -6 + Math.sin(a) * 36]], '#5ea873', 1.6);
        }
        poly(ctx, hex, '#a8dcb3');
        line(ctx, [...hex, hex[0]], '#5ea873', 1.6);
      });
      strokePart(ctx, piece.parts[2], '#4f9a62', 2);
      shine(ctx, -14, -15, 6, 3);
      eye(ctx, -41, -6, 2.8);
      cheek(ctx, -34, 0, 3.4, 2.2);
      smile(ctx, -42, 0, 3);
    },
  },

  // かに: よこに ひろくて平ら。ハサミは上（かんたん）
  crab: {
    color: '#ff8f85',
    line: '#d1544b',
    parts: [
      { circle: [-32, -12, 10] }, // ハサミは低め・外がわ（上に出すぎると上の子が乗りにくい）
      { circle: [32, -12, 10] },
      { points: blob(64, 32, 12, 12) },
    ],
    draw(ctx, piece) {
      for (const s of [-1, 1]) {
        for (let k = 0; k < 3; k++) line(ctx, [[s * 24, 1 + k * 5], [s * 36, 7 + k * 5]], '#d1544b', 3); // あし
      }
      drawSilhouette(ctx, piece);
      cut(ctx, () => {
        poly(ctx, [[-33, -13], [-38, -24], [-28, -24]], '#000'); // ハサミの切れこみ
        poly(ctx, [[33, -13], [28, -24], [38, -24]], '#000');
      });
      shine(ctx, -12, -9, 5, 2.5);
      eye(ctx, -9, -4);
      eye(ctx, 9, -4);
      cheek(ctx, -17, 3);
      cheek(ctx, 17, 3);
      smile(ctx, 0, 4);
    },
  },

  // あざらし: ねそべって ながい（かんたん）
  seal: {
    color: '#dfe4ec',
    line: '#8e99aa',
    parts: [
      { points: pts([[30, -2], [46, -12], [50, 0], [44, 10], [32, 10]]), fill: '#c5ccd8' }, // うしろあし
      { points: blob(80, 34, 17, 10) },
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      dot(ctx, 8, -9, 2.6, '#c5ccd8');
      dot(ctx, 18, -4, 2, '#c5ccd8');
      dot(ctx, 24, -11, 1.8, '#c5ccd8');
      oval(ctx, -2, 11, 8, 3, '#c5ccd8', -0.3); // むなびれ
      shine(ctx, -18, -11, 7, 3);
      eye(ctx, -29, -5);
      eye(ctx, -13, -5);
      oval(ctx, -21, 0, 3, 2, '#4a3b33'); // はな
      smile(ctx, -23, 3.5, 2);
      smile(ctx, -19, 3.5, 2);
      cheek(ctx, -34, 3, 3.6, 2.4);
      cheek(ctx, -8, 3, 3.6, 2.4);
    },
  },

  // ふぐ: まんまる（ころがる。ふつう）
  puffer: {
    color: '#ffe08a',
    line: '#d8a640',
    friction: 0.8,
    parts: [
      { points: pts([[18, -5], [34, -14], [36, 14], [18, 5]]), fill: '#f7c766' }, // おびれ
      { circle: [0, 0, 25] },
    ],
    draw(ctx, piece) {
      for (let i = 0; i < 9; i++) { // とげ（絵だけ）
        const a = PI * 0.62 + (i * PI * 1.36) / 8;
        const c = Math.cos(a);
        const s = Math.sin(a);
        line(ctx, [[c * 22, s * 22], [c * 29, s * 29]], '#d8a640', 2.4);
      }
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[1], () => oval(ctx, 0, 14, 20, 10, '#fff3c4'));
      dot(ctx, -4, -16, 1.8, '#e8b54a');
      dot(ctx, 6, -14, 1.8, '#e8b54a');
      dot(ctx, 13, -19, 1.6, '#e8b54a');
      shine(ctx, -12, -13, 5, 3);
      eye(ctx, -9, -3, 3.4);
      eye(ctx, 7, -3, 3.4);
      cheek(ctx, -15, 5);
      cheek(ctx, 13, 5);
      pout(ctx, -1, 7);
    },
  },

  // さかな（ふつう）
  fish: {
    color: '#ffb38a',
    line: '#e07b4a',
    parts: [
      { points: pts([[16, 0], [36, -16], [38, 13]]), fill: '#ff9e70' }, // おびれ（下のはしは おなかと同じ高さ）
      { points: flatBottom(ellipse(28, 17, { cx: -4 }), 13) },  // おなかは平ら（まるいと ころがり続ける）
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, 2, 0, 3.5, 20, '#ffd6bf');
        oval(ctx, 12, 0, 3, 20, '#ffd6bf');
      });
      line(ctx, [[24, -4], [33, -10]], '#e07b4a', 1.4);
      line(ctx, [[24, 4], [33, 10]], '#e07b4a', 1.4);
      shine(ctx, -14, -9, 6, 3);
      eye(ctx, -20, -3);
      cheek(ctx, -13, 5);
      smile(ctx, -27, 4, 3);
    },
  },

  // たこ: あたまが まるくて、あしで平ら（ふつう）
  octopus: {
    color: '#ff9eab',
    line: '#d9637a',
    parts: [
      { points: [...ellipse(26, 26, { cy: -2, from: PI, to: PI * 2, n: 12 }), ...pts([[25, 12], [21, 22], [-21, 22], [-25, 12]])] },
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      cut(ctx, () => { // あしの すきま
        for (const x of [-12.6, -4.2, 4.2, 12.6]) dot(ctx, x, 22.5, 3.2, '#000');
      });
      dot(ctx, 9, -17, 2.4, '#ffc6cf');
      dot(ctx, 15, -10, 1.8, '#ffc6cf');
      dot(ctx, 3, -22, 1.6, '#ffc6cf');
      shine(ctx, -10, -17, 6, 4);
      eye(ctx, -9, -1, 3.4);
      eye(ctx, 9, -1, 3.4);
      cheek(ctx, -16, 6);
      cheek(ctx, 16, 6);
      pout(ctx, 0, 9, 2.6);
    },
  },

  // ペンギン: たてに ながい（ふつう）
  penguin: {
    color: '#5f6f88',
    line: '#39465a',
    parts: [{ points: blob(42, 56, 21, 10) }],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, 0, 8, 15, 19, '#ffffff'); // おなか
        oval(ctx, -20, 6, 4, 12, '#4b5a72', 0.2); // つばさ
        oval(ctx, 20, 6, 4, 12, '#4b5a72', -0.2);
      });
      oval(ctx, -6, -12, 7, 7, '#ffffff');
      oval(ctx, 6, -12, 7, 7, '#ffffff');
      eye(ctx, -6, -12, 2.6);
      eye(ctx, 6, -12, 2.6);
      poly(ctx, [[-4, -6], [4, -6], [0, -1]], '#ffb347'); // くちばし
      cheek(ctx, -12, -4, 3.4, 2.2);
      cheek(ctx, 12, -4, 3.4, 2.2);
      oval(ctx, -8, 26.5, 6, 2.6, '#ffb347'); // あし
      oval(ctx, 8, 26.5, 6, 2.6, '#ffb347');
      shine(ctx, -10, -22, 4, 2.5);
    },
  },

  // いるか: ほそながくて せびれつき（むずかしい）
  dolphin: {
    color: '#9cc3e6',
    line: '#5a8cbf',
    parts: [
      { points: pts([[-8, -11], [4, -27], [12, -10]]) },          // せびれ
      { points: pts([[26, -3], [44, -15], [46, 9], [30, 5]]) },   // おびれ
      { points: ellipse(10, 6, { cx: -36, cy: 4, n: 12 }) },      // くちさき
      { points: ellipse(34, 15, { n: 22 }) },
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[3], () => oval(ctx, -6, 13, 30, 8, '#e9f3fc'));
      clipPart(ctx, piece.parts[2], () => oval(ctx, -36, 9, 10, 4, '#e9f3fc'));
      shine(ctx, -12, -9, 7, 3);
      eye(ctx, -22, -3, 3);
      cheek(ctx, -16, 4, 3.6, 2.4);
      smile(ctx, -38, 5, 3);
    },
  },

  // くらげ: かさが ひろくて、あしは ほそい（ぐらぐら。むずかしい）
  jellyfish: {
    color: '#d6c4f5',
    line: '#9a7fd1',
    parts: [
      { points: blob(34, 22, 4, 8, { cy: 15 }), fill: '#efe6fc' }, // しょくしゅ
      { points: [...ellipse(30, 26, { from: PI, to: PI * 2, n: 14 }), ...pts([[29, 5], [-29, 5]])] }, // かさ
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        for (const x of [-11, -4, 4, 11]) {
          const wave = [];
          for (let y = 6; y <= 26; y += 4) wave.push([x + ((y / 4) % 2 ? 2 : -2), y]);
          line(ctx, wave, '#b79be3', 2);
        }
      });
      line(ctx, [[-29, 5], [29, 5]], '#9a7fd1', 2);
      dot(ctx, 14, -16, 2.2, '#ece2fd');
      dot(ctx, 20, -9, 1.6, '#ece2fd');
      shine(ctx, -12, -17, 6, 3.5);
      eye(ctx, -10, -7);
      eye(ctx, 10, -7);
      cheek(ctx, -17, -1);
      cheek(ctx, 17, -1);
      smile(ctx, 0, -2, 3);
    },
  },

  // ひとで: ほしがた（とがった先で立つと ぐらぐら。むずかしい）
  starfish: {
    color: '#ffa98a',
    line: '#e06c50',
    parts: starPolys(32, 15).map((points) => ({ points })),
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      for (let i = 0; i < 5; i++) {
        const a = -PI / 2 + (i * 2 * PI) / 5;
        dot(ctx, Math.cos(a) * 22, Math.sin(a) * 22, 2.2, '#ffd8c6');
        dot(ctx, Math.cos(a) * 15.5, Math.sin(a) * 15.5, 1.6, '#ffd8c6');
      }
      eye(ctx, -6, -3, 2.8);
      eye(ctx, 6, -3, 2.8);
      cheek(ctx, -10, 3, 3, 2);
      cheek(ctx, 10, 3, 3, 2);
      smile(ctx, 0, 4, 3);
    },
  },

  // いか: たてに ながくて あたまが とがる（むずかしい）
  squid: {
    color: '#fbf2fb',
    line: '#c79ad3',
    parts: [{ points: pts([[0, -34], [19, -12], [16, 24], [-16, 24], [-19, -12]]) }],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => poly(ctx, [[0, -36], [22, -10], [-22, -10]], '#f6d4ec')); // さんかくの ひれ
      cut(ctx, () => {
        for (const x of [-8, 0, 8]) dot(ctx, x, 24, 3, '#000'); // あしの すきま
      });
      dot(ctx, -4, -20, 1.8, '#f2b6dc');
      dot(ctx, 5, -16, 1.6, '#f2b6dc');
      eye(ctx, -7, 4, 3.2);
      eye(ctx, 7, 4, 3.2);
      cheek(ctx, -12, 11, 3.4, 2.2);
      cheek(ctx, 12, 11, 3.4, 2.2);
      smile(ctx, 0, 11, 3);
    },
  },

  // かい（ほたてがい）: 下が ほそい おうぎがた（むずかしい・おとな）
  shell: {
    color: '#ffc8da',
    line: '#e48aa8',
    parts: [{ points: [...ellipse(36, 36, { cy: 16, from: PI * (7 / 6), to: PI * (11 / 6), n: 10 }), ...pts([[7, 18], [-7, 18]])] }],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        for (let deg = 222; deg <= 318; deg += 16) {
          const a = (deg * PI) / 180;
          line(ctx, [[0, 17], [Math.cos(a) * 40, 16 + Math.sin(a) * 40]], 'rgba(228, 138, 168, 0.45)', 1.6);
        }
      });
      oval(ctx, 0, 15, 8, 3.5, '#f7a8c4');
      shine(ctx, -12, -10, 6, 3);
      eye(ctx, -8, 0, 2.8);
      eye(ctx, 8, 0, 2.8);
      cheek(ctx, -14, 6, 3.4, 2.2);
      cheek(ctx, 14, 6, 3.4, 2.2);
      smile(ctx, 0, 5, 3);
    },
  },

  // まんぼう: うえと したに ながい ひれ（むずかしい・おとな）
  sunfish: {
    color: '#bccbdd',
    line: '#7c8fa8',
    parts: [
      // ひれの先は平ら（とがっていると立てず、たおれて ころがっていくため）
      { points: pts([[-4, -18], [0, -36], [10, -36], [14, -16]]), fill: '#a3b5cb' }, // せびれ
      { points: pts([[-4, 18], [0, 36], [10, 36], [14, 16]]), fill: '#a3b5cb' },     // しりびれ
      { points: pts([[18, -13], [30, -9], [30, 9], [18, 13]]), fill: '#a3b5cb' }, // うしろの ひれ
      { points: ellipse(24, 22) },
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[3], () => oval(ctx, -4, 14, 20, 9, '#dde6f0'));
      oval(ctx, 3, 3, 5, 3, '#a3b5cb', -0.3);
      dot(ctx, 6, -10, 1.8, '#dde6f0');
      dot(ctx, 13, -4, 1.5, '#dde6f0');
      shine(ctx, -10, -12, 6, 3);
      eye(ctx, -10, -4, 3.2);
      cheek(ctx, -5, 4);
      pout(ctx, -20, 3, 2);
    },
  },
  // ---------- v0.17.13 で追加（各難易度に2しゅずつ） ----------

  // うなぎ: ほそながい板（下は平ら。いちばんの土台になる。かんたん）
  eel: {
    color: '#b9a98a',
    line: '#7d6e50',
    parts: [{ points: [...ellipse(12, 11, { cx: -36, from: PI / 2, to: PI * 1.5, n: 8 }), ...pts([[34, -9], [48, 3], [46, 11]])] }],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, 2, 12, 50, 6, '#e6dcc4'); // おなか
        const fin = [];
        for (let x = -22; x <= 42; x += 8) fin.push([x, -9 + ((x + 22) / 8) % 2 * 2.5 + (x + 22) * 0.02]);
        line(ctx, fin, '#d6c9a8', 2.5); // せびれ（なみなみ）
      });
      oval(ctx, -20, 4, 4, 2.5, '#9c8b68', 0.3); // むなびれ
      shine(ctx, -36, -6, 5, 2.5);
      eye(ctx, -38, -2, 3);
      cheek(ctx, -31, 5, 3.2, 2.2);
      smile(ctx, -44, 4, 2.6);
    },
  },

  // ラッコ: あおむけで ぷかぷか。おなかに かい を のせている（かんたん）
  otter: {
    color: '#c99f7e',
    line: '#8c6448',
    parts: [
      { points: blob(64, 26, 12, 10, { cx: 9, cy: 2 }) }, // からだ
      { circle: [-28, -2, 15] },                          // あたま
    ],
    draw(ctx, piece) {
      oval(ctx, 37, -11, 4, 6, '#8c6448', 0.4); // あし（絵だけ）
      oval(ctx, 31, -12, 4, 6, '#8c6448', 0.2);
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => oval(ctx, 10, -2, 22, 9, '#e3c7ad')); // おなか
      dot(ctx, 8, -8, 5.5, '#f7b7c8'); // かい
      line(ctx, [[5, -11], [8, -5], [11, -11]], '#e48aa8', 1.2);
      oval(ctx, 1, -5, 4, 3, '#8c6448'); // おてて
      oval(ctx, 15, -5, 4, 3, '#8c6448');
      oval(ctx, -28, 1, 10, 8, '#f1dfcd'); // かお
      eye(ctx, -33, -3, 2.6);
      eye(ctx, -23, -3, 2.6);
      oval(ctx, -28, 1, 2.6, 1.8, '#4a3b33'); // はな
      smile(ctx, -28, 4.5, 2);
      cheek(ctx, -36, 3, 3, 2);
      cheek(ctx, -20, 3, 3, 2);
      shine(ctx, -34, -11, 4, 2);
    },
  },

  // あめふらし: ぽってりした ドーム。あたまに みみ（ふつう）
  seahare: {
    color: '#cdb3e0',
    line: '#9677b5',
    parts: [{ points: [...ellipse(36, 24, { cy: 6, from: PI, to: PI * 2, n: 14 }), ...pts([[35, 12], [-35, 12]])] }],
    draw(ctx, piece) {
      oval(ctx, -24, -12, 3.5, 7, '#b597d1', -0.5); // みみ（絵だけ）
      oval(ctx, -14, -16, 3.5, 7, '#b597d1', -0.2);
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        line(ctx, [[-4, -10], [6, -14], [16, -10], [26, -4]], '#b597d1', 2.5); // せなかの ひらひら
        oval(ctx, 0, 14, 40, 6, '#e3d4ef');
      });
      dot(ctx, 6, -4, 2.2, '#a98cc4');
      dot(ctx, 18, 2, 1.8, '#a98cc4');
      dot(ctx, 26, -2, 1.5, '#a98cc4');
      dot(ctx, -2, 4, 1.6, '#a98cc4');
      shine(ctx, -6, -11, 6, 3);
      eye(ctx, -24, -1, 2.8);
      eye(ctx, -14, -2, 2.8);
      cheek(ctx, -28, 6, 3.2, 2.2);
      cheek(ctx, -9, 5, 3.2, 2.2);
      smile(ctx, -19, 5, 2.6);
    },
  },

  // くまのみ: オレンジに しろい しま（ふつう）
  clownfish: {
    color: '#ffa552',
    line: '#d9722a',
    parts: [
      { points: pts([[16, 0], [32, -13], [34, 13]]) },             // おびれ
      { points: flatBottom(ellipse(26, 18, { cx: -4 }), 14) },     // おなかは平ら
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[1], () => {
        for (const x of [-12, 6]) {
          oval(ctx, x, 0, 5.5, 22, '#4a3b33');
          oval(ctx, x, 0, 4, 22, '#ffffff');
        }
      });
      clipPart(ctx, piece.parts[0], () => {
        oval(ctx, 34, 0, 4, 16, '#4a3b33');
        oval(ctx, 34, 0, 2.6, 16, '#ffffff');
      });
      shine(ctx, -4, -12, 5, 2.5);
      eye(ctx, -21, -3, 3);
      cheek(ctx, -20, 5, 3, 2);
      smile(ctx, -27, 4, 2.6);
    },
  },

  // うつぼ: あたまが大きく、しっぽへ ほそくなる。上が ななめで すべりやすい（むずかしい）
  moray: {
    color: '#cfe08a',
    line: '#8fa04a',
    parts: [{ points: [...ellipse(14, 16, { cx: -34, from: PI / 2, to: PI * 1.5, n: 8 }), ...pts([[28, -8], [46, 2], [40, 16]])] }],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[0], () => {
        line(ctx, [[-30, -15], [28, -7]], '#e4eeb4', 3); // せびれ
        for (const [x, y, r] of [[-14, -2, 2.6], [-2, 6, 2.2], [8, -2, 2.4], [18, 6, 2], [26, 0, 1.8], [-8, 10, 1.8]]) {
          dot(ctx, x, y, r, '#a9bd5c');
        }
      });
      poly(ctx, [[-48, 3], [-36, 4], [-47, 9]], '#ff9aa8'); // あいた くち
      line(ctx, [[-48, 3], [-36, 4], [-47, 9]], '#8fa04a', 1.4);
      shine(ctx, -36, -10, 5, 2.5);
      eye(ctx, -37, -5, 3);
      cheek(ctx, -30, 4, 3.2, 2.2);
    },
  },

  // たつのおとしご: たてに ながく、まるまった しっぽで立つ（ぐらぐら。むずかしい）
  seahorse: {
    color: '#ffcf7a',
    line: '#d99a3a',
    parts: [
      { circle: [4, 20, 8] },                                        // まるまった しっぽ
      { points: ellipse(13, 17, { cx: 2, cy: -2, n: 16 }) },         // おなか
      { points: pts([[-10, -29], [-22, -27], [-22, -21], [-9, -20]]) }, // くちさき
      { circle: [-3, -25, 10] },                                     // あたま
    ],
    draw(ctx, piece) {
      poly(ctx, [[12, -16], [20, -10], [18, 2], [13, 4]], '#ffb956'); // せびれ（絵だけ）
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[1], () => {
        oval(ctx, -6, 0, 6, 16, '#ffe6b3'); // おなか
        for (const y of [-10, -4, 2, 8]) line(ctx, [[-12, y], [-1, y]], '#f2b860', 1.2);
      });
      ctx.beginPath(); // しっぽの うずまき
      ctx.arc(4, 20, 3.5, 0, Math.PI * 1.6);
      ctx.strokeStyle = '#d99a3a';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      dot(ctx, -3, -35, 2.2, '#ffb956'); // あたまの とげ
      shine(ctx, 0, -31, 4, 2);
      eye(ctx, -4, -26, 2.8);
      cheek(ctx, -8, -19, 3, 2);
    },
  },

  // ちんあなご: すなから にょきっと。ほそくて たかい（とても ぐらぐら。おとな）
  gardeneel: {
    color: '#f7f3ea',
    line: '#a59d8c',
    parts: [
      { points: [...ellipse(20, 10, { cy: 30, from: PI, to: PI * 2, n: 10 })], fill: '#f1dca8' }, // すなの おやま
      { points: blob(16, 52, 8, 3, { cy: -2 }) },                                                 // からだ
      { points: ellipse(10, 8, { cx: -5, cy: -30, n: 14 }) },                                     // あたま
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      for (const [x, y] of [[3, -16], [-2, -6], [4, 4], [-3, 12], [2, 19], [3, -24]]) dot(ctx, x, y, 1.6, '#5b544a');
      dot(ctx, -10, 27, 1.4, '#e3c785'); // すなつぶ
      dot(ctx, 9, 25, 1.4, '#e3c785');
      dot(ctx, 14, 28, 1.2, '#e3c785');
      eye(ctx, -9, -31, 2.6);
      cheek(ctx, -6, -25, 2.8, 1.8);
      smile(ctx, -12, -26, 2);
    },
  },

  // えい: おなかがわから見た にっこり顔。ほそい しっぽで立つと たおれる（おとな）
  ray: {
    color: '#f6eef0',
    line: '#b9a3ad',
    parts: [
      { points: pts([[-2, 12], [2, 12], [1.5, 30], [-1.5, 30]]) },                      // しっぽ
      { points: pts([[-38, -2], [-6, -18], [6, -18], [38, -2], [10, 14], [-10, 14]]) }, // からだ
    ],
    draw(ctx, piece) {
      drawSilhouette(ctx, piece);
      clipPart(ctx, piece.parts[1], () => {
        poly(ctx, [[-40, -4], [-6, -20], [-20, 6]], '#e6d6dc'); // つばさの ふち
        poly(ctx, [[40, -4], [6, -20], [20, 6]], '#e6d6dc');
      });
      eye(ctx, -6, -4, 2.6);
      eye(ctx, 6, -4, 2.6);
      cheek(ctx, -12, 2, 3.2, 2.2);
      cheek(ctx, 12, 2, 3.2, 2.2);
      smile(ctx, 0, 5, 4);
      shine(ctx, -14, -8, 5, 2.5);
    },
  },
};
