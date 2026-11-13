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
};
