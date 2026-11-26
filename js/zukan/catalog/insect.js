// catalog/insect.js — むしの ずかん画（v0.19.0。別冊05 §3）
// つみき画（balance/insect.js）とは 別の 絵。かわいさより「その種類だと 見分けられる」ことを 優先する:
// - 実物の 比率（からだの ながさと あたま・あし・はねの 比）・実物の 色・見分けの もようは 数と 位置まで
// - 目は 複眼（ひとみ・ハイライトの 白丸・ほっぺ・口は 描かない）
// - ポーズは 図鑑と 同じ: 甲虫・セミ・トンボ・チョウ・ハチは 真上から（あたまが 上）、バッタ・コオロギ・カマキリは 真横（左むき）、
//   ナナフシは 真上から（あたまが 左。ほそながいので よこに した）
// - オスと メスで ちがう 種類は ぜんぶ オスを 描く（v0.19.1 で きめた。メスは 描かない）
// 1種 = { group, level, similar, box: [x0, y0, x1, y1], draw(ctx) }。level: 1=よく 知られた 2=ふつう 3=くわしい人むけ
// 光は 左上から。座標は だいたい 1 = 0.5ミリ（大きさは わくに あわせて かわる ので めやす）

import {
  PI, sym, flipX, shift, ell, trace, shape, stroke, disc, oval, within, both,
  vgrad, hgrad, lgrad, rgrad, gloss, limb, leg, antenna, compoundEye, veins, dots, seeded, fill3d, bbox, ribbon, planform, mapLine, resample,
} from '../draw.js';

// GROUPS = 科（か）くらいの なかま、ORDERS = 目（もく）。図鑑と 同じ 2だんで ならべる（v0.19.4。ずかんの タブ＝目、タブの 中の 見出し＝科）。
// カブトムシ・クワガタムシも こうちゅう（甲虫目）、セミは カメムシ目、カマキリと ナナフシは べつの 目
export const GROUPS = ['kabuto', 'stag', 'beetle', 'butterfly', 'bee', 'cicada', 'dragonfly', 'grasshopper', 'mantis', 'stick'];
export const ORDERS = [
  { key: 'coleoptera', groups: ['kabuto', 'stag', 'beetle'] },
  { key: 'lepidoptera', groups: ['butterfly'] },
  { key: 'hymenoptera', groups: ['bee'] },
  { key: 'hemiptera', groups: ['cicada'] },
  { key: 'odonata', groups: ['dragonfly'] },
  { key: 'orthoptera', groups: ['grasshopper'] },
  { key: 'mantodea', groups: ['mantis'] },
  { key: 'phasmatodea', groups: ['stick'] },
];

// ---------- 甲虫（真上から） ----------

// 甲虫の からだ: あし → 触角 → あご → あたま → むね → はね の じゅんに かさねる。
// P.legs = 右の あし3本 [つけね, ひざ, あしくび, さき]、P.legOpt = 前・中・後 ごとの オプション
function dorsalBeetle(ctx, P) {
  const edge = P.edge;
  // あし（からだの 下に かくれる つけねから 先に）
  both(ctx, () => {
    P.legs.forEach((j, i) => leg(ctx, j, P.legW[i] ?? P.legW, P.legColor, edge, P.legOpt?.[i] ?? {}));
  });
  if (P.antenna) both(ctx, () => P.antenna(ctx));
  if (P.mandible) {
    both(ctx, () => {
      fill3d(ctx, P.mandible, P.mandTone ?? P.tone, edge, 0.8, [0.2, 0.2]);
      P.mandDetail?.(ctx);
    });
  }
  if (P.under) P.under(ctx);
  // くびれ（むねと はねの あいだの 小さな ふし）
  if (P.waist) fill3d(ctx, sym(P.waist), P.waistTone ?? P.tone, edge);
  const head = sym(P.head);
  fill3d(ctx, head, P.headTone ?? P.tone, edge);
  if (P.eye) both(ctx, () => compoundEye(ctx, ...P.eye, P.eyeColor ?? '#2a2420'));
  P.headDetail?.(ctx, head);
  const pron = sym(P.pron);
  fill3d(ctx, pron, P.pronTone ?? P.tone, edge);
  P.pronDetail?.(ctx, pron);
  // はね（右と 左を べつに 描いて、まんなかに あわせめの 線）
  const ely = sym(P.ely);
  fill3d(ctx, ely, P.elyTone ?? P.tone, edge);
  P.elyDetail?.(ctx, ely);
  const [, ey0, , ey1] = bbox(ely);
  stroke(ctx, [[0, ey0 + 1], [0, ey1 - 1.5]], P.suture ?? 'rgba(0,0,0,0.6)', 0.9, false);
  if (P.scutellum) shape(ctx, P.scutellum, P.scutColor ?? 'rgba(0,0,0,0.35)', null);
  // ふちの 光（左上から 光が あたる ふちを ほそく 明るく。かたちの 立体感 v0.19.1）
  if (P.rim) {
    for (const part of [head, pron, ely]) {
      within(ctx, part, () => {
        ctx.save();
        ctx.translate(1, 1.1);
        shape(ctx, part, null, `rgba(255,255,255,${P.rim})`, 1.6);
        ctx.restore();
      });
    }
  }
  // つやの 光（左上）
  if (P.gloss) {
    const g = P.gloss;
    gloss(ctx, pron, -g.pron[0], g.pron[1], g.pron[2], g.a ?? 0.3);
    gloss(ctx, ely, -g.ely[0], g.ely[1], g.ely[2], g.a ?? 0.3);
    gloss(ctx, ely, g.ely[0] * 0.8, g.ely[1], g.ely[2] * 0.7, (g.a ?? 0.3) * 0.5);
    if (g.head) gloss(ctx, head, -g.head[0], g.head[1], g.head[2], (g.a ?? 0.3) * 0.8);
  }
  P.after?.(ctx);
}

// はねの たての すじ（右の はね。x = すじの 位置、y0〜y1、はしで まがる）
function striae(ctx, xs, y0, y1, color, width = 0.5, bend = 0) {
  for (const x of xs) {
    stroke(ctx, [[x, y0], [x + bend * 0.3, (y0 + y1) / 2], [x * 0.75 + bend, y1]], color, width);
    stroke(ctx, [[-x, y0], [-x - bend * 0.3, (y0 + y1) / 2], [-x * 0.75 - bend, y1]], color, width);
  }
}

// 細かい 毛・点刻（こまかい ぽつぽつ）を 形の 中に ちらす
function speckle(ctx, pts, count, r, color, seed) {
  const rnd = seeded(seed);
  const [x0, y0, x1, y1] = bbox(pts);
  within(ctx, pts, () => {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const x = x0 + rnd() * (x1 - x0);
      const y = y0 + rnd() * (y1 - y0);
      ctx.beginPath();
      ctx.arc(x, y, r * (0.6 + rnd() * 0.6), 0, PI * 2);
      ctx.fill();
    }
  });
}

// クワガタの 触角: ひじで まがり、さきに くしの ような ふさ（3〜4まい）
function stagAntenna(base, elbow, tip, color) {
  return (ctx) => {
    stroke(ctx, [base, elbow], color, 1.5, false);
    const dx = tip[0] - elbow[0];
    const dy = tip[1] - elbow[1];
    const n = 6;
    for (let i = 0; i < n; i++) {
      const p = [elbow[0] + (dx * i) / n, elbow[1] + (dy * i) / n];
      disc(ctx, p[0], p[1], 0.75, color);
    }
    stroke(ctx, [elbow, [elbow[0] + dx * 0.62, elbow[1] + dy * 0.62]], color, 0.9, false);
    // ふさ: 外がわへ ひらく 3まい
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    for (let k = 0; k < 3; k++) {
      const t = 0.66 + k * 0.13;
      const p = [elbow[0] + dx * t, elbow[1] + dy * t];
      limb(ctx, p, [p[0] + uy * 3.2, p[1] - ux * 3.2], 1.6, 1.1, color, null);
    }
  };
}

// カブトムシの 触角: みじかく、さきに 3まいの ひだ
function scarabAntenna(base, tip, color) {
  return (ctx) => {
    stroke(ctx, [base, tip], color, 1, false);
    for (let k = 0; k < 3; k++) {
      const p = [tip[0] + k * 0.9, tip[1] - k * 1.3];
      oval(ctx, p[0] + 1.3, p[1] - 0.6, 2.2, 0.9, color, null, 0, -0.6);
    }
  };
}

// ---------- クワガタ（v0.19.1: ぜんぶ オスの 大きい かたちで 描きなおし） ----------
// オスの 見分けどころ: あたまが むねと 同じくらい ひろく、おおあごが からだの 3〜4わりの 長さ。
// メスは あたまが せまく あごが みじかいので、ここを まちがえると メスに 見える（v0.19.0 の オオクワガタが そうだった）

// おおあごの つやの すじ（芯を すこし 外がわに ずらして 白く うすく）
function mandRidge(spine, dx = 1.2, alpha = 0.2, width = 1.1) {
  return (c) => stroke(c, spine.slice(0, -1).map(([x, y], i) => [x + dx * (1 - i / spine.length), y]), `rgba(255,255,255,${alpha})`, width);
}

// あたまの 目の 上の でっぱり（眼縁＝がんえん）。目の まえを 半分 おおう 板
function canthus(c, pts, tone, edge) {
  both(c, () => fill3d(c, pts, tone, edge, 0.6));
}

// オオクワガタ（オス）: くろく、あたまが はばひろい。ふとい おおあごが まるく うちがわへ まがり、
// まんなか あたりに 前むきの 大きな 歯が 1つ。むねの うしろの かどに きれこみ。はねに こまかい たての すじ
const GIANT_MAND = [[14.5, -48], [18.5, -57], [19, -66], [16, -74], [9.5, -80]];
const giantStag = {
  group: 'stag', level: 1, similar: ['flatStag', 'sawStag', 'miyamaStag'],
  box: [-50, -82, 50, 76],
  draw(ctx) {
    const tone = ['#4c4c4a', '#1c1c1b', '#070707'];
    dorsalBeetle(ctx, {
      edge: '#000',
      tone,
      legColor: '#151514',
      legW: [[5.6, 4.4, 1.8], [5, 3.6, 1.7], [5, 3.6, 1.7]],
      legs: [
        [[14, -10], [29, -19], [38, -35], [42, -49]],
        [[15, 11], [33, 13], [44, 28], [50, 40]],
        [[15, 25], [31, 38], [41, 56], [45, 73]],
      ],
      legOpt: [{ spines: 4, spineLen: 2.2 }, { spines: 2 }, { spines: 2 }],
      antenna: stagAntenna([19, -45], [32, -49], [38, -60], '#1a1a1a'),
      mandible: ribbon(GIANT_MAND, [10, 8.8, 7, 4.2, 1.6], { teeth: [[0.42, 5.6, 0.8], [0.76, 1, 0.5]] }),
      mandTone: ['#3e3e3c', '#141413', '#050505'],
      mandDetail: mandRidge(GIANT_MAND, 1.4, 0.16),
      // あたま: まえの ふちは まっすぐ、目の うしろも まっすぐ で 四角い
      head: [[0, -49.5], [11, -50], [20, -49], [23, -45.5], [24, -40], [23.5, -33], [21.5, -28.5], [14, -26.5], [0, -26.5]],
      eye: [23.2, -39.5, 2.2, 3.2],
      headDetail(c, head) {
        canthus(c, [[19, -47.5], [23.5, -45.5], [24.6, -42], [21.5, -41.5]], tone, '#000');
        speckle(c, head, 260, 0.32, 'rgba(255,255,255,0.07)', 21);
        // おでこの まんなかの くぼみと、まえの ふちの もりあがり
        stroke(c, [[-13, -46.5], [0, -45], [13, -46.5]], 'rgba(255,255,255,0.13)', 1.1);
      },
      waist: [[0, -1], [15, -1], [17, 5], [0, 6]],
      // むね: まえの かどは とがり、よこは ほぼ まっすぐ、うしろの かどに きれこみ
      pron: [[0, -27.5], [12, -28], [23, -27.5], [26.5, -25, 1], [28.2, -18], [28.6, -10], [28, -3.5], [26.5, -1, 1], [24.6, -1.6, 1], [23.4, 1.2, 1], [12, 3], [0, 3]],
      pronDetail(c, pron) {
        speckle(c, pron, 380, 0.3, 'rgba(255,255,255,0.06)', 22);
      },
      ely: [[0, 4], [9, 4], [20, 4.5], [25, 7], [26.6, 12], [27, 25], [26.8, 42], [25, 56], [20, 66.5], [11, 71.5], [0, 72.5]],
      elyDetail(c) {
        striae(c, [4.5, 8.5, 12.5, 16.5, 20.5, 24], 8, 66, 'rgba(255,255,255,0.08)', 0.55, -2);
      },
      scutellum: [[-3, 4.5], [3, 4.5], [0, 9]],
      rim: 0.13,
      gloss: { pron: [10, -19, 14], ely: [11, 16, 22], head: [10, -42, 9], a: 0.2 },
    });
  },
};

// ヒラタクワガタ（オス）: とても ひらたく、つやつやの くろ。おおあごは ながく ほぼ まっすぐ（さきだけ うちがわ）、
// ねもと ちかくに 大きな 歯、その さきに こまかい ギザギザが ずらり
const FLAT_MAND = [[15, -48.5], [17, -60], [17.2, -72], [15.2, -82], [10.5, -89]];
const flatStag = {
  group: 'stag', level: 2, similar: ['giantStag', 'sawStag'],
  box: [-52, -92, 52, 74],
  draw(ctx) {
    const tone = ['#5c5c62', '#19191c', '#050505'];
    dorsalBeetle(ctx, {
      edge: '#000',
      tone,
      legColor: '#121214',
      legW: [[5.4, 4.2, 1.7], [4.8, 3.4, 1.6], [4.8, 3.4, 1.6]],
      legs: [
        [[14, -10], [30, -19], [40, -35], [44, -49]],
        [[15, 11], [34, 13], [45, 28], [52, 40]],
        [[15, 25], [32, 38], [42, 56], [46, 72]],
      ],
      legOpt: [{ spines: 5, spineLen: 1.8 }, { spines: 2 }, { spines: 2 }],
      antenna: stagAntenna([20, -45], [33, -49], [39, -60], '#1a1a1a'),
      mandible: ribbon(FLAT_MAND, [9.4, 6.6, 5.6, 4, 1.5], {
        teeth: [[0.12, 4.6, 0.25], ...[0.32, 0.38, 0.44, 0.5, 0.56, 0.62, 0.68, 0.74, 0.8, 0.86].map((t) => [t, 1.25, 0.45])],
      }),
      mandTone: ['#4e4e54', '#151517', '#040404'],
      mandDetail: mandRidge(FLAT_MAND, 1.3, 0.24),
      // あたま: よこに ながい 長方形（ひらたい）
      head: [[0, -50], [12, -50.5], [21.5, -49.5], [24.5, -46], [25.5, -40], [25, -33], [23, -28.5], [14, -27], [0, -27]],
      eye: [24.6, -40, 2.1, 3.1],
      headDetail(c) {
        canthus(c, [[20.5, -48], [25, -46], [26, -42.5], [22.5, -42]], tone, '#000');
        stroke(c, [[-15, -47.5], [0, -46.5], [15, -47.5]], 'rgba(255,255,255,0.16)', 1);
      },
      waist: [[0, -1], [15, -1], [17, 5], [0, 6]],
      // むね: よこに ひろく、かどは まるみ
      pron: [[0, -28], [13, -28.5], [25, -28], [28.8, -25], [30.2, -17], [30.2, -8], [28.8, -2.5], [25.5, 1], [12, 3], [0, 3]],
      ely: [[0, 4], [10, 4], [22, 4.5], [27, 7.5], [28.6, 13], [29, 26], [28.6, 43], [26.5, 56], [21, 66], [11, 70.5], [0, 71.5]],
      elyDetail(c) {
        striae(c, [7, 14, 21], 10, 62, 'rgba(255,255,255,0.05)', 0.5, -2);
      },
      scutellum: [[-3, 4.5], [3, 4.5], [0, 9]],
      // つやが つよい（光の まるが くっきり）
      rim: 0.16,
      gloss: { pron: [11, -19, 15], ely: [12, 18, 24], head: [10, -42, 10], a: 0.4 },
    });
  },
};

// ノコギリクワガタ（オス・大がた）: あかちゃいろで つや。おおあごが 弓のように 大きく まがり、
// うちがわの まんなかに ノコギリの 歯が ならぶ。あたまの まえの ふちが とがり、うしろの かどは まるく でっぱり なし
const SAW_MAND = [[11, -47], [18.5, -55], [23, -66], [22.5, -78], [16.5, -87.5], [7, -92.5]];
const sawStag = {
  group: 'stag', level: 1, similar: ['miyamaStag', 'giantStag', 'flatStag'],
  box: [-47, -95, 47, 70],
  draw(ctx) {
    const tone = ['#ae5e30', '#6e2e10', '#2c1004'];
    dorsalBeetle(ctx, {
      edge: '#1a0800',
      tone,
      mandTone: ['#a4542a', '#62280c', '#240c02'],
      legColor: '#5a240c',
      legW: [[4.6, 3.4, 1.5], [4, 3, 1.4], [4, 3, 1.4]],
      legs: [
        [[12, -8], [26, -17], [35, -32], [39, -46]],
        [[13, 9], [30, 11], [40, 25], [46, 35]],
        [[13, 22], [28, 34], [37, 51], [41, 67]],
      ],
      legOpt: [{ spines: 4, spineLen: 1.8 }, { spines: 2 }, { spines: 2 }],
      antenna: stagAntenna([17, -43], [28, -47], [33, -57], '#3a1406'),
      mandible: ribbon(SAW_MAND, [8, 6.2, 4.8, 4, 3.2, 1.4], {
        teeth: [[0.12, 2.6, 0.2], [0.27, 2.6, 0.35], [0.34, 3.6, 0.35], [0.41, 4, 0.4], [0.48, 3.6, 0.4], [0.55, 3, 0.45], [0.62, 2.2, 0.45], [0.69, 1.6, 0.45]],
      }),
      mandDetail: mandRidge(SAW_MAND, 1.2, 0.22),
      head: [[0, -48.5], [3, -50, 1], [9, -48.5], [17, -47.5], [20.5, -43], [21.5, -36], [20, -30], [11, -27], [0, -27]],
      eye: [20.4, -39, 2, 3],
      eyeColor: '#2a1408',
      headDetail(c) {
        canthus(c, [[16.5, -46.5], [20.5, -44], [21.4, -41], [18.5, -41]], tone, '#1a0800');
        // あたまの まえの もりあがり（たてがみ のような 線）
        stroke(c, [[-10, -45], [0, -46.5], [10, -45]], 'rgba(255,220,180,0.2)', 1);
      },
      waist: [[0, -2], [13, -2], [15, 4], [0, 5]],
      pron: [[0, -28], [11, -28.5], [20.5, -28], [23.5, -25, 1], [24.8, -15], [24, -5], [21, 0.5, 1], [10, 2], [0, 2]],
      ely: [[0, 3], [9, 3], [19.5, 4], [23.5, 8.5], [24.6, 20], [24.2, 38], [21.8, 52], [16.5, 61.5], [8.5, 66], [0, 67]],
      elyDetail(c, ely) {
        // はねの ふちは くろっぽい
        within(c, ely, () => {
          c.fillStyle = hgrad(c, -25, 25, ['rgba(30,8,0,0.55)', 'rgba(30,8,0,0)', 'rgba(30,8,0,0)', 'rgba(30,8,0,0)', 'rgba(30,8,0,0.55)']);
          c.fillRect(-26, 0, 52, 70);
        });
      },
      scutellum: [[-2.6, 3.5], [2.6, 3.5], [0, 8]],
      suture: 'rgba(30,8,0,0.75)',
      rim: 0.16,
      gloss: { pron: [9, -20, 13], ely: [10, 14, 22], head: [8, -42, 8], a: 0.32 },
    });
  },
};

// ミヤマクワガタ（オス）: ちゃいろに きんいろの こまかい 毛（つやが すくない）。
// あたまの うしろが みみの ように 大きく はりだし、むねより ひろい。おおあごの さきが ふたまた、うちがわに 歯が 3〜4こ。
// ももの うらが きいろ（上から すこし 見える）
const MIYAMA_MAND = [[12.5, -48], [17, -58], [18.5, -69], [16.5, -80], [12, -88]];
const miyamaStag = {
  group: 'stag', level: 1, similar: ['sawStag', 'giantStag'],
  box: [-52, -92, 52, 74],
  draw(ctx) {
    const headTone = ['#8a6434', '#563818', '#221208'];
    const headHalf = [[0, -50], [3, -51.5, 1], [10, -50], [19, -49.5], [23, -46.5], [24, -42], [27, -38.5], [31.5, -35], [34, -30, 1], [31, -25.5], [22, -23.5], [0, -23]];
    const pronHalf = [[0, -24.5], [12, -25], [21, -24.5], [24.5, -21.5, 1], [26.2, -13], [25.5, -4], [22.5, 0.5, 1], [11, 2], [0, 2]];
    const elyHalf = [[0, 3], [9, 3], [21, 4], [25.5, 8.5], [26.5, 21], [26, 40], [23.5, 54], [18, 63.5], [9, 68], [0, 69]];
    dorsalBeetle(ctx, {
      edge: '#1c0e04',
      tone: ['#a47c46', '#6a4a22', '#2a180a'],
      headTone,
      mandTone: ['#6e4018', '#3e220a', '#180a02'],
      legColor: '#94621e', // ももが きいろっぽい（なまえの もとに なった もよう）
      legW: [[5, 3.6, 1.6], [4.4, 3.2, 1.5], [4.4, 3.2, 1.5]],
      legs: [
        [[13, -6], [28, -15], [38, -31], [42, -45]],
        [[14, 10], [32, 12], [43, 27], [50, 37]],
        [[14, 23], [30, 36], [40, 54], [44, 71]],
      ],
      legOpt: [{ spines: 4, spineLen: 1.8, tibiaColor: '#3c220c', tarsusColor: '#3c220c' }, { spines: 2, tibiaColor: '#3c220c', tarsusColor: '#3c220c' }, { spines: 2, tibiaColor: '#3c220c', tarsusColor: '#3c220c' }],
      antenna: stagAntenna([20, -45], [32, -48], [38, -58], '#2a1606'),
      mandible: ribbon(MIYAMA_MAND, [8.4, 6.2, 5, 4.4, 4], {
        teeth: [[0.2, 1.8, 0.3], [0.36, 3.6, 0.45], [0.5, 2.6, 0.45], [0.63, 2, 0.45]], fork: 4,
      }),
      mandDetail: mandRidge(MIYAMA_MAND, 1.2, 0.16),
      head: headHalf,
      eye: [23.3, -43, 2, 2.9],
      eyeColor: '#2a1608',
      headDetail(c, head) {
        // きんいろの 毛、みみの でっぱりの ふち、まえの ふちの もりあがり
        speckle(c, head, 600, 0.28, 'rgba(240,200,120,0.4)', 11);
        both(c, () => stroke(c, [[25, -39], [31, -34.5], [32.5, -29]], 'rgba(255,220,150,0.3)', 1));
        stroke(c, [[-14, -47], [0, -48], [14, -47]], 'rgba(255,220,150,0.25)', 1);
      },
      waist: [[0, -1], [14, -1], [16, 5], [0, 6]],
      pron: pronHalf,
      pronDetail(c, pron) {
        speckle(c, pron, 700, 0.28, 'rgba(240,200,120,0.42)', 12);
      },
      ely: elyHalf,
      elyDetail(c, ely) {
        speckle(c, ely, 1600, 0.28, 'rgba(240,200,120,0.4)', 13);
      },
      scutellum: [[-2.8, 3.5], [2.8, 3.5], [0, 8]],
      suture: 'rgba(20,10,0,0.6)',
      rim: 0.12,
      gloss: { pron: [9, -16, 12], ely: [10, 14, 20], a: 0.1 },
    });
  },
};

// ニジイロクワガタ（オス）: にじいろの つよい つや。からだは まるっこい。
// おおあごは まえに のびて さきが 上へ そりかえる（上から 見ると さきが 外へ ひらく）
const RAINBOW_MAND = [[9, -41.5], [11.5, -51], [13, -60], [16.5, -67.5], [21.5, -72]];
const rainbowStag = {
  group: 'stag', level: 2, similar: ['sawStag', 'jewelBeetle'],
  box: [-46, -75, 46, 66],
  draw(ctx) {
    // まんなかは みどり〜きんいろ、ふちへ いくほど あか・むらさき（見る 角度で かわる にじいろ）
    const rainbow = () => hgrad(ctx, -25, 25, ['#8a2a6a', '#c8402e', '#e0a02a', '#7ac040', '#3aa85a', '#7ac040', '#e0a02a', '#c8402e', '#8a2a6a']);
    dorsalBeetle(ctx, {
      edge: '#1a2414',
      tone: ['#9fe07a', '#3a9a44', '#14401c'],
      legColor: '#3a6a2a',
      legW: [[4.2, 3.2, 1.5], [3.8, 2.8, 1.4], [3.8, 2.8, 1.4]],
      legs: [
        [[11, -6], [24, -14], [32, -27], [35, -38]],
        [[12, 8], [28, 10], [37, 22], [43, 31]],
        [[12, 20], [26, 31], [34, 46], [37, 60]],
      ],
      legOpt: [{ spines: 3, tibiaColor: '#5a7a22' }, { spines: 1, tibiaColor: '#7a6a22' }, { spines: 1, tibiaColor: '#8a5a22' }],
      antenna: stagAntenna([16, -37], [26, -40], [30, -50], '#2a3a1a'),
      mandTone: ['#e0bc52', '#8e6c1c', '#3a2a08'],
      mandible: ribbon(RAINBOW_MAND, [7, 5.4, 4.2, 3.2, 1.6], { teeth: [[0.3, 1.6, 0.3], [0.56, 2.2, 0.5]] }),
      mandDetail: mandRidge(RAINBOW_MAND, 1, 0.3),
      head: [[0, -42], [9, -42.5], [16, -41], [19, -37], [19.5, -30], [17.5, -24], [8, -22], [0, -22]],
      headTone: ['#c8d860', '#4aa040', '#16401a'],
      eye: [18, -33, 1.9, 2.7],
      headDetail(c, head) {
        within(c, head, () => {
          c.fillStyle = rainbow();
          c.globalAlpha = 0.45;
          c.fillRect(-20, -44, 40, 24);
          c.globalAlpha = 1;
        });
      },
      waist: [[0, -2], [12, -2], [13, 3], [0, 4]],
      pron: [[0, -23], [10, -23.5], [19, -22.5], [22.5, -18, 1], [23.5, -10], [22.5, -3], [19.5, 0.5, 1], [10, 1.5], [0, 1.5]],
      pronDetail(c, pron) {
        within(c, pron, () => {
          c.fillStyle = rainbow();
          c.globalAlpha = 0.75;
          c.fillRect(-26, -26, 52, 32);
          c.globalAlpha = 1;
        });
      },
      ely: [[0, 2.5], [9, 2.5], [19.5, 3.5], [23.5, 8], [25, 20], [24.5, 36], [22, 49], [16.5, 58], [8.5, 62.5], [0, 63.5]],
      elyDetail(c, ely) {
        within(c, ely, () => {
          c.fillStyle = rainbow();
          c.globalAlpha = 0.8;
          c.fillRect(-26, 0, 52, 66);
          c.globalAlpha = 1;
        });
        striae(c, [5, 10, 15, 19.5], 7, 56, 'rgba(0,40,20,0.18)', 0.5, -2);
      },
      scutellum: [[-2.5, 3], [2.5, 3], [0, 7]],
      suture: 'rgba(10,40,20,0.55)',
      rim: 0.2,
      gloss: { pron: [8, -16, 12], ely: [9, 12, 20], head: [7, -36, 7], a: 0.42 },
    });
  },
};

// カブトムシ（オス）: あたまの ながい ツノ（さきが 2回 ふたまた）と むねの みじかい ツノ（さきが ふたまた）。
// はねは こげちゃで こまかい 毛（つやが すくない）、むねは つやが ある
const rhinoBeetle = {
  group: 'kabuto', level: 1, similar: ['hercules'],
  box: [-50, -100, 50, 74],
  draw(ctx) {
    const edge = '#120600';
    const tone = ['#7a3e1e', '#3e1a08', '#140602'];
    // あたまの ツノ（上から 見ると 細い 柄の さきが Yに ひらき、それぞれ また 2つ）
    const hornHalf = [[0, -40], [4.5, -44], [4, -60], [3.6, -74], [5.5, -82], [9.5, -88], [12.5, -95, 1], [10, -96], [8.5, -91.5, 1], [6, -94], [7, -97.5, 1], [4.6, -98], [2, -90], [0, -86]];
    dorsalBeetle(ctx, {
      edge,
      tone,
      legColor: '#2a1006',
      legW: [[5, 3.8, 1.6], [4.6, 3.6, 1.6], [4.6, 3.6, 1.6]],
      legs: [
        [[13, -10], [29, -18], [40, -32], [46, -44]],
        [[15, 10], [33, 12], [44, 28], [50, 40]],
        [[15, 26], [31, 40], [41, 56], [45, 72]],
      ],
      legOpt: [{ spines: 3, spineLen: 2.6 }, { spines: 3, spineLen: 2.2 }, { spines: 3, spineLen: 2.2 }],
      antenna: scarabAntenna([14, -38], [19, -42], '#3a1a08'),
      under(c) {
        fill3d(c, sym(hornHalf), ['#6a3418', '#341406', '#100400'], edge, 0.8, [0.3, 0.6]);
      },
      head: [[0, -44], [8, -43.5], [14, -40.5], [16.5, -35], [16, -30], [8, -28.5], [0, -28.5]],
      eye: [15, -35, 1.8, 2.4],
      eyeColor: '#1a0a04',
      pron: [[0, -32], [11, -31.5], [20, -28], [25.5, -21], [27.5, -12], [27, -4], [24, 1], [12, 3], [0, 3]],
      pronDetail(c) {
        // むねの ツノ（前へ みじかく。さきが ふたまた）
        const hornT = [[0, -26], [3.6, -27], [4.2, -32], [5.6, -36.5, 1], [3.5, -36], [2, -34.5], [0, -34]];
        fill3d(c, sym(hornT), ['#8a4a26', '#3e1a08', '#140602'], edge, 0.7, [0.3, 0.3]);
      },
      ely: [[0, 4], [10, 4], [22, 5], [26.5, 10], [27.5, 24], [27, 42], [24.5, 56], [18.5, 66], [9.5, 71], [0, 72]],
      elyTone: ['#6e3a1e', '#3a1a0a', '#160804'],
      elyDetail(c, ely) {
        // こまかい 毛（はねは つやが すくない）
        speckle(c, ely, 500, 0.4, 'rgba(190,140,90,0.28)', 21);
      },
      scutellum: [[-3.5, 4.5], [3.5, 4.5], [0, 10]],
      suture: 'rgba(10,2,0,0.65)',
      gloss: { pron: [9, -20, 14], ely: [11, 16, 22], a: 0.18 },
      after(c) {
        // むねは つやつや（はねより 強い 光）
        gloss(c, sym([[0, -32], [11, -31.5], [20, -28], [25.5, -21], [27.5, -12], [27, -4], [24, 1], [12, 3], [0, 3]]), -10, -20, 12, 0.3);
      },
    });
  },
};

// ヘラクレスオオカブト（オス）: むねの ツノが とても ながく（うらに ちゃいろの 毛）、あたまの ツノと はさむ。
// はねは きいろっぽい オリーブいろに くろい てん。むね・ツノ・あしは つやの ある くろ
const hercules = {
  group: 'kabuto', level: 2, similar: ['rhinoBeetle'],
  box: [-56, -150, 56, 82],
  draw(ctx) {
    const edge = '#000';
    const black = ['#4a4a4a', '#141414', '#020202'];
    const thoraxHorn = [[0, -30], [12, -33], [11, -46], [8.5, -68], [7.2, -95], [6.5, -114], [8.4, -121, 1], [5.2, -123.5], [4.6, -132], [3, -142], [0, -147]];
    dorsalBeetle(ctx, {
      edge,
      tone: black,
      legColor: '#111',
      legW: [[5.6, 4.2, 1.8], [5, 4, 1.7], [5, 4, 1.7]],
      legs: [
        [[14, -6], [33, -14], [45, -30], [52, -44]],
        [[16, 14], [36, 16], [48, 32], [54, 46]],
        [[16, 30], [34, 44], [45, 62], [49, 80]],
      ],
      legOpt: [{ spines: 3, spineLen: 2.6 }, { spines: 3, spineLen: 2.4 }, { spines: 3, spineLen: 2.4 }],
      antenna: scarabAntenna([14, -32], [19, -36], '#222'),
      under(c) {
        // あたまの ツノ（したの ツノ）: 上から 見ると むねの ツノの したから さきが 出る。こぶの ような 歯
        const headHorn = [[0, -36], [4.5, -40], [4.6, -60], [4.4, -85], [5.2, -96, 1], [4, -98], [4, -104], [3, -112], [0, -116]];
        fill3d(c, sym(headHorn), black, edge, 0.8);
      },
      head: [[0, -38], [8, -37.5], [14, -35], [16.5, -30], [16, -25], [8, -24], [0, -24]],
      eye: [15, -30, 1.8, 2.4],
      pron: [[0, -30], [12, -29.5], [22, -26], [28, -18], [30, -8], [29.5, 1], [26, 6], [13, 8], [0, 8]],
      pronDetail(c) {
        // むねの ツノの うらの ちゃいろい 毛（よこから はみだして 見える）
        const fur = [[0, -56], [10.5, -58], [11.5, -78], [10.2, -100], [9, -112], [0, -114]];
        fill3d(c, sym(fur), ['#c08a4a', '#8a5a26', '#4a2c10'], null);
        speckle(c, sym(fur), 160, 0.5, 'rgba(90,50,16,0.6)', 31);
        fill3d(c, sym(thoraxHorn), black, edge, 0.8, [0.3, 0.4]);
        gloss(c, sym(thoraxHorn), -3, -90, 30, 0.35);
      },
      ely: [[0, 9], [11, 9], [24, 10], [29, 16], [30, 32], [29.5, 52], [27, 66], [20.5, 76], [10.5, 80.5], [0, 81.5]],
      elyTone: ['#d8cc7a', '#a69a48', '#5a5220'],
      elyDetail(c) {
        // くろい てん（はねの もよう）
        const spots = [[9, 22, 2.2], [18, 18, 1.6], [22, 34, 2.4], [12, 40, 1.8], [6, 54, 2], [19, 52, 2.6], [24, 62, 1.6], [14, 66, 2], [7, 30, 1.4], [16, 28, 1.2], [21, 44, 1.4], [10, 72, 1.4]];
        both(c, () => dots(c, spots, 1.5, 'rgba(20,18,8,0.85)'));
      },
      scutellum: [[-4, 9.5], [4, 9.5], [0, 15]],
      suture: 'rgba(40,36,10,0.8)',
      gloss: { pron: [10, -16, 16], ely: [12, 22, 24], a: 0.25 },
    });
  },
};

// ゲンジボタル: むねが ピンクで くろい じゅうじ。はねは くろく やわらかい。おしりの さきが うすい きいろ（ひかる ところ）
const firefly = {
  group: 'beetle', level: 1, similar: ['ladybug', 'rosalia'],
  box: [-30, -54, 30, 56],
  draw(ctx) {
    const black = ['#4a4a4e', '#1c1c20', '#08080a'];
    dorsalBeetle(ctx, {
      edge: '#000',
      tone: black,
      legColor: '#1c1c1e',
      legW: [[2.4, 1.8, 1], [2.2, 1.6, 0.9], [2.2, 1.6, 0.9]],
      legs: [
        [[6, -24], [15, -30], [20, -38], [23, -44]],
        [[7, -8], [17, -8], [22, 2], [26, 8]],
        [[7, 2], [16, 8], [21, 20], [24, 30]],
      ],
      legOpt: [{ tarsi: 5, claw: 1.2 }, { tarsi: 5, claw: 1.2 }, { tarsi: 5, claw: 1.2 }],
      antenna(c) {
        antenna(c, [[3, -40], [8, -45], [13, -48], [17, -52], [20, -53]], 1.3, 0.8, '#1a1a1c', { beads: 10 });
      },
      under(c) {
        // おしりの さきの ひかる ところ（はねの 下から 少し 見える）
        shape(c, sym([[0, 40], [8, 41], [9.5, 46], [7, 51], [0, 53]]), '#f2e7a0', '#8a7a30', 0.6);
        stroke(c, [[-8, 46], [8, 46]], 'rgba(120,100,30,0.6)', 0.5, false);
      },
      head: [[0, -41], [4, -41], [6.5, -38], [6.5, -34], [0, -33]],
      eye: [5.6, -37, 2.2, 2.6],
      pron: [[0, -38], [6, -37.5], [11, -34], [13.5, -27], [13.5, -21], [12.5, -18.5, 1], [6, -18], [0, -18]],
      pronTone: ['#ffc2c2', '#f0868a', '#b44a50'],
      pronDetail(c) {
        // まんなかの くろい じゅうじ
        shape(c, [[-2, -36], [2, -36], [2.2, -30], [6.5, -29.5], [6.5, -26], [2.4, -25.5], [2.6, -19], [-2.6, -19], [-2.4, -25.5], [-6.5, -26], [-6.5, -29.5], [-2.2, -30]], '#1c1416');
      },
      ely: [[0, -17.5], [6, -17.5], [12.5, -16.5], [14, -12], [14, 10], [13.5, 32], [11, 42], [6, 46], [0, 46.5]],
      elyDetail(c, ely) {
        speckle(c, ely, 300, 0.35, 'rgba(120,120,130,0.25)', 41);
        // はねの ふちは すこし あかるい（やわらかい はね）
        both(c, () => stroke(c, [[13.2, -12], [13.4, 10], [12.8, 32], [10.4, 41]], 'rgba(140,140,150,0.45)', 0.8));
      },
      scutellum: [[-2, -17], [2, -17], [0, -13.5]],
      suture: 'rgba(120,120,130,0.5)',
      gloss: { pron: [6, -32, 8], ely: [7, -6, 12], a: 0.16 },
    });
  },
};

// ナナホシテントウ: まるい あかい はねに くろい てん 7つ（まんなかの 1つは 左右に またがる）。むねは くろく 前の かどが しろい
const ladybug = {
  group: 'beetle', level: 1, similar: ['firefly', 'tigerBeetle'],
  box: [-38, -40, 38, 46],
  draw(ctx) {
    const edge = '#1a0a04';
    const elyHalf = [[0, -14], [12, -15], [23, -10], [29.5, 0], [30.5, 12], [27, 25], [18, 35], [8, 39.5], [0, 40.5]];
    dorsalBeetle(ctx, {
      edge,
      tone: ['#4a4a4a', '#151515', '#050505'],
      legColor: '#121212',
      legW: [[3, 2.4, 1.2], [3, 2.4, 1.2], [3, 2.4, 1.2]],
      legs: [
        [[12, -14], [22, -18], [27, -24], [31, -28]],
        [[14, 2], [26, 5], [31, 10], [35, 14]],
        [[14, 12], [24, 20], [28, 28], [30, 34]],
      ],
      legOpt: [{ tarsi: 3, claw: 1.3 }, { tarsi: 3, claw: 1.3 }, { tarsi: 3, claw: 1.3 }],
      antenna(c) {
        antenna(c, [[7, -31], [11, -34], [13, -36]], 0.9, 0.9, '#1a1a1a');
        oval(c, 13.6, -36.8, 1.6, 1.1, '#1a1a1a', null, 0, -0.6);
      },
      head: [[0, -33], [6, -33], [9.5, -30], [10, -26], [0, -25]],
      eye: [8.5, -29.5, 2, 2.4],
      headDetail(c) {
        both(c, () => oval(c, 4.2, -30, 1.6, 1.2, '#f4f0e6'));
      },
      pron: [[0, -27], [8, -27], [16, -25], [21, -21], [23.5, -15.5], [22.5, -13], [12, -12.5], [0, -12.5]],
      pronDetail(c) {
        both(c, () => shape(c, [[13, -25.5], [18.5, -23], [22, -18], [22.5, -14.5], [17, -15.5], [14, -19.5]], '#f4f0e6'));
      },
      ely: elyHalf,
      elyTone: ['#ff8a5a', '#e2321c', '#901404'],
      elyDetail(c, ely) {
        within(c, ely, () => {
          const spot = '#141010';
          disc(c, 0, -11, 5.6, spot); // まんなかの 1つ（左右に またがる）
          both(c, () => {
            oval(c, 14, -2, 5.4, 5, spot);
            oval(c, 21, 13, 6.4, 6.2, spot);
            oval(c, 12, 27, 5.2, 5, spot);
          });
        });
      },
      scutellum: [[-2, -13.5], [2, -13.5], [0, -10.5]],
      suture: 'rgba(60,0,0,0.6)',
      gloss: { pron: [8, -23, 8], ely: [13, -4, 16], a: 0.4 },
    });
  },
};

// タマムシ（ヤマトタマムシ）: ほそながく おしりが とがる。みどりの つや＋あかむらさきの たての すじ 2ほん。しょっかくは みじかく ギザギザ
const jewelBeetle = {
  group: 'beetle', level: 2, similar: ['rainbowStag', 'tigerBeetle'],
  box: [-32, -70, 32, 68],
  draw(ctx) {
    const green = ['#9af0a0', '#22a050', '#0a4a24'];
    const stripe = ['#e88a9a', '#b02a6a', '#5a0a3a'];
    dorsalBeetle(ctx, {
      edge: '#062a14',
      tone: green,
      legColor: '#1a7a3c',
      legW: [[3.4, 2.4, 1.3], [3.4, 2.4, 1.3], [3.6, 2.6, 1.3]],
      legs: [
        [[8, -36], [17, -42], [22, -50], [25, -58]],
        [[10, -22], [21, -22], [26, -14], [30, -8]],
        [[10, -8], [20, -2], [25, 8], [28, 16]],
      ],
      legOpt: [{ tarsi: 5, claw: 1.4 }, { tarsi: 5, claw: 1.4 }, { tarsi: 5, claw: 1.4 }],
      antenna(c) {
        // みじかい ギザギザの 触角
        const pts = [[6, -59], [9, -62], [12, -64], [15, -65.5], [18, -66.5]];
        antenna(c, pts, 1.2, 0.9, '#123a20');
        for (let i = 1; i < pts.length; i++) shape(c, [pts[i], [pts[i][0] + 1, pts[i][1] - 2.2, 1], [pts[i][0] + 2.2, pts[i][1] - 0.4]], '#123a20');
      },
      head: [[0, -61], [5, -61], [9, -58], [10, -53], [8, -49.5], [0, -49]],
      headTone: ['#c8e8a0', '#4aa040', '#164a1a'],
      eye: [8.4, -55.5, 2.6, 3.6],
      eyeColor: '#3a3a2a',
      pron: [[0, -51], [8, -51.5], [12.5, -50], [15.5, -44], [16.5, -37], [16, -34, 1], [8, -33], [0, -33]],
      pronDetail(c, pron) {
        within(c, pron, () => both(c, () => shape(c, [[4.2, -52], [8.5, -52], [9, -32], [4.6, -32]], stripe[1])));
        speckle(c, pron, 160, 0.35, 'rgba(0,50,20,0.35)', 51);
      },
      ely: [[0, -33], [9, -33], [15.5, -32], [17, -27], [17, -5], [15.5, 20], [12, 40], [7, 56], [3, 64.5, 1], [0, 64]],
      elyDetail(c, ely) {
        within(c, ely, () => both(c, () => {
          // はねの たての すじ（あかむらさき）
          shape(c, [[5, -33], [10, -33], [10.6, 0], [9, 30], [6.5, 52], [4.2, 52], [5.6, 30], [6.2, 0]], lgrad(c, 0, -30, 0, 50, [stripe[0], stripe[1], stripe[2]]));
        }));
        striae(c, [3, 12, 14.5], -28, 50, 'rgba(0,40,20,0.3)', 0.5, -3);
        speckle(c, ely, 500, 0.35, 'rgba(0,40,16,0.3)', 52);
      },
      scutellum: [[-1.6, -33], [1.6, -33], [0, -30]],
      suture: 'rgba(0,40,20,0.7)',
      gloss: { pron: [7, -45, 10], ely: [9, -12, 22], head: [5, -57, 5], a: 0.45 },
    });
  },
};

// ルリボシカミキリ: あかるい みずいろに くろい もよう（はねに 3くみ・むねに 1つ）。からだより ながい 触角に くろい 毛の たば
const rosalia = {
  group: 'beetle', level: 2, similar: ['tigerBeetle', 'jewelBeetle'],
  box: [-66, -70, 66, 66],
  draw(ctx) {
    const blue = ['#c8f0ff', '#68bce4', '#2a6a9a'];
    const black = '#121418';
    dorsalBeetle(ctx, {
      edge: '#1a3a52',
      tone: blue,
      legColor: '#3a7aa8',
      legW: [[2.6, 1.8, 1.1], [2.6, 1.8, 1.1], [2.8, 2, 1.1]],
      legs: [
        [[6, -24], [17, -32], [24, -44], [28, -54]],
        [[7, -8], [20, -6], [28, 6], [34, 14]],
        [[7, 4], [20, 12], [28, 28], [33, 42]],
      ],
      legOpt: [{ tarsi: 4, claw: 1.3, tibiaColor: '#2a4a68' }, { tarsi: 4, claw: 1.3, tibiaColor: '#2a4a68' }, { tarsi: 4, claw: 1.3, tibiaColor: '#2a4a68' }],
      antenna(c) {
        // 11ふし。ふしの さきに くろい 毛の たば（3〜6ふしめ が めだつ）
        const pts = [[5, -44], [12, -54], [22, -62], [34, -66], [45, -63], [53, -54], [58, -42], [61, -28], [62, -14], [62.5, 0], [63, 12], [63.5, 24]];
        for (let i = 0; i < pts.length - 1; i++) {
          stroke(c, [pts[i], pts[i + 1]], i < 2 ? '#3a7aa8' : '#5aa0cc', i < 2 ? 2.2 : 1.5 - i * 0.05, false);
          if (i >= 2 && i <= 8) oval(c, pts[i + 1][0], pts[i + 1][1], i <= 6 ? 2.4 : 1.6, i <= 6 ? 1.9 : 1.3, black);
        }
      },
      head: [[0, -48], [4.5, -48], [7.5, -45], [8, -39], [6.5, -35], [0, -34.5]],
      eye: [7, -41.5, 1.8, 3.2],
      eyeColor: '#151a20',
      pron: [[0, -36.5], [6, -36.5], [8.5, -34], [9, -29], [12, -27, 1], [9.5, -24], [9, -20.5], [7, -18.5], [0, -18.5]],
      pronDetail(c) {
        oval(c, 0, -27.5, 4, 3.6, black);
      },
      ely: [[0, -18.5], [7, -18.5], [12, -17], [13, -12], [12.8, 10], [12.2, 35], [11, 50], [8, 58], [3, 60.5], [0, 60]],
      elyDetail(c, ely) {
        within(c, ely, () => both(c, () => {
          // まえの 小さい もよう・まんなかの おおきな おび・うしろの もよう
          shape(c, [[2, -12], [7, -14], [11, -11], [12, -5], [9, -1], [4, -3]], black);
          shape(c, [[0.5, 10], [7, 7], [13, 9], [13, 22], [8, 25], [0.5, 23]], black);
          shape(c, [[1, 37], [8, 35], [12.5, 38], [11.5, 47], [6, 49], [1, 46]], black);
        }));
        speckle(c, ely, 500, 0.3, 'rgba(255,255,255,0.25)', 61);
      },
      scutellum: [[-1.8, -18.5], [1.8, -18.5], [0, -15]],
      scutColor: black,
      suture: 'rgba(20,50,80,0.6)',
      gloss: { pron: [4, -30, 6], ely: [7, -6, 14], a: 0.18 },
    });
  },
};

// ハンミョウ: あたま・むねは みどりと あかの きんぞくいろ。はねは あおむらさきに しろい もようと あかい おび。おおきな め、しろい おおあご
const tigerBeetle = {
  group: 'beetle', level: 2, similar: ['rosalia', 'jewelBeetle'],
  box: [-42, -60, 42, 56],
  draw(ctx) {
    const metal = ['#e8d070', '#c0402a', '#3a6a2a'];
    dorsalBeetle(ctx, {
      edge: '#0a1a1a',
      tone: metal,
      legColor: '#3a7a6a',
      legW: [[2.4, 1.8, 1], [2.4, 1.8, 1], [2.6, 1.9, 1]],
      legs: [
        [[6, -20], [18, -24], [26, -34], [31, -42]],
        [[7, -10], [21, -8], [30, 4], [37, 12]],
        [[7, -2], [20, 8], [30, 26], [36, 42]],
      ],
      legOpt: [{ tarsi: 5, claw: 1.4, tibiaColor: '#b04a30' }, { tarsi: 5, claw: 1.4, tibiaColor: '#b04a30' }, { tarsi: 5, claw: 1.4, tibiaColor: '#b04a30' }],
      antenna(c) {
        antenna(c, [[8, -40], [15, -46], [21, -50], [27, -51], [33, -48], [37, -43]], 1.2, 0.8, '#2a3a3a', { beads: 9, beadColor: '#3a5a5a' });
      },
      mandible: ribbon([[4, -41], [6.5, -46], [5, -51], [1.5, -54]], [4, 3.2, 2.2, 0.8], { teeth: [[0.5, 1.6, 0.2], [0.7, 1.4, 0.2]] }),
      mandTone: ['#ffffff', '#f2ecd8', '#a89a70'],
      head: [[0, -43], [6, -43], [11, -40], [13.5, -35], [12.5, -29], [7, -26.5], [0, -26.5]],
      headTone: ['#f0e080', '#3aa060', '#1a4a3a'],
      eye: [10.5, -35, 4, 5],
      eyeColor: '#3a3a2a',
      pron: [[0, -28.5], [5, -28.5], [8, -27], [9, -22], [8.5, -16.5], [6.5, -14.5], [0, -14.5]],
      pronTone: ['#f0b070', '#c03a2a', '#3a6a2a'],
      ely: [[0, -14.5], [7, -14.5], [12, -13], [13.5, -8], [13.5, 10], [12.5, 30], [10, 42], [5.5, 48], [0, 49]],
      elyTone: ['#6a6ad8', '#2a2a8a', '#0e0e3a'],
      elyDetail(c, ely) {
        within(c, ely, () => {
          // はねの まえは みどり・ふちは みどりがかった あお
          c.fillStyle = vgrad(c, -15, 0, ['rgba(60,170,90,0.9)', 'rgba(60,170,90,0)']);
          c.fillRect(-15, -15, 30, 16);
          // あかい おび
          c.fillStyle = 'rgba(214,60,40,0.92)';
          c.beginPath();
          trace(c, [[-14, 6], [14, 6], [14, 13], [-14, 13]], true, 0.2);
          c.fill();
          both(c, () => {
            const white = '#f4f2e6';
            oval(c, 10, -8, 2.4, 1.8, white, null, 0, 0.5); // かたの しろい もよう
            oval(c, 4, -1, 1.8, 1.6, white);
            shape(c, [[12.4, 16], [9, 18], [7, 22], [9.5, 23], [13, 21]], white);
            oval(c, 4.5, 28, 2.2, 1.8, white);
            shape(c, [[11.5, 33], [7, 36], [6, 40], [9.5, 40], [11.5, 37]], white);
          });
        });
      },
      scutellum: [[-1.5, -14.5], [1.5, -14.5], [0, -12]],
      suture: 'rgba(10,10,40,0.6)',
      gloss: { pron: [3, -24, 6], ely: [7, -5, 12], head: [5, -38, 6], a: 0.38 },
    });
  },
};

// ---------- はねを ひろげた むし（真上から。セミ・トンボ・チョウ・ハチ） ----------

// すきとおった はね: うすい いろ＋ふちの 線＋はねの 脈。tint = はねの いろ（すけぐあい こみ）
function clearWing(ctx, outline, tint, veinColor, veinLines, edgeWidth = 0.9) {
  shape(ctx, outline, tint, veinColor, edgeWidth);
  within(ctx, outline, () => {
    // つけねの ほうが すこし こい（光の あたりかた）
    const [x0, y0, x1, y1] = bbox(outline);
    ctx.fillStyle = hgrad(ctx, x0, x1, ['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    veins(ctx, veinLines, veinColor, 0.55);
  });
}

// 線の あいだを つなぐ 横の 脈（a・b = 2本の 縦の 脈。t の 位置に はしごの ように）
function rungs(a, b, ts) {
  const at = (line, t) => {
    const i = Math.min(line.length - 2, Math.floor(t * (line.length - 1)));
    const f = t * (line.length - 1) - i;
    return [line[i][0] + (line[i + 1][0] - line[i][0]) * f, line[i][1] + (line[i + 1][1] - line[i][1]) * f];
  };
  return ts.map((t) => [at(a, t), at(b, t)]);
}

// セミの 前ばねの 脈（u, v で きめる）: つけねから 5本 → 中ほどの 横の 脈（結節線）→ さきで 8つの へや（端室）に わかれ、
// ふちの すこし 内がわを 1周する 脈（縁脈）で とじる。どの 種類も 同じ つくりで、はねの かたちだけ ちがう
function cicadaForeVeins(W) {
  const lines = [];
  const startV = [-0.8, -0.5, -0.2, 0.15, 0.5];
  const nodeV = [-0.88, -0.58, -0.22, 0.2, 0.62];
  const nodeU = [0.6, 0.58, 0.56, 0.54, 0.5];
  for (let k = 0; k < 5; k++) lines.push(mapLine(W, [[0.02, startV[k]], [nodeU[k] * 0.5, (startV[k] + nodeV[k]) / 2], [nodeU[k], nodeV[k]]]));
  lines.push(mapLine(W, nodeU.map((u, k) => [u, nodeV[k]]))); // 結節線
  // さきの 8つの へやを わける 7本（どの 根もとから 出るか, おわりの u, v）
  const ends = [[0, 0.86, -0.9], [0, 0.94, -0.88], [1, 0.985, -0.3], [2, 0.985, 0.35], [3, 0.94, 0.88], [3, 0.86, 0.9], [4, 0.76, 0.9]];
  const mid = [];
  for (const [k, u, v] of ends) {
    const m = [(nodeU[k] + u) / 2 + 0.04, nodeV[k] * 0.5 + v * 0.5];
    mid.push(m);
    lines.push(mapLine(W, [[nodeU[k], nodeV[k]], m, [u, v]]));
  }
  lines.push(mapLine(W, mid)); // 端室の 根もとを つなぐ 横の 脈
  // 縁脈（ふちの 内がわを 1周）
  lines.push(mapLine(W, [[0.62, -0.9], [0.8, -0.9], [0.94, -0.88], [0.985, -0.3], [0.985, 0.35], [0.94, 0.88], [0.8, 0.9], [0.62, 0.9], [0.5, 0.9]]));
  return lines;
}

function cicadaHindVeins(W) {
  const lines = [];
  for (const v of [-0.7, -0.35, 0.05, 0.45]) lines.push(mapLine(W, [[0.03, v * 0.6], [0.5, v], [0.92, v * 0.95]]));
  lines.push(mapLine(W, [[0.45, -0.7], [0.48, -0.35], [0.5, 0.05], [0.48, 0.45]]));
  lines.push(mapLine(W, [[0.5, -0.88], [0.8, -0.88], [0.95, -0.5], [0.97, 0], [0.95, 0.5], [0.8, 0.88], [0.5, 0.9]]));
  return lines;
}

// セミ: はねを ひろげた 標本の すがた。P.fw・P.hw = 前ばね・後ばねの 平面形（planform。種類ごとに かたちが ちがう）、
// P.wing = はねの ぬり、P.veins = 脈の 色、P.opaque = すけない はねの もよう（アブラゼミ）
function cicada(ctx, P) {
  const edge = P.edge;
  // 後ばね → 前ばね（前ばねが 上に かさなる）
  both(ctx, () => {
    const HW = planform({ x0: 8, ...P.hw });
    clearWing(ctx, HW.outline, P.hwTint ?? P.wing, P.veins, cicadaHindVeins(HW));
    const FW = planform({ x0: 8, ...P.fw });
    const fv = cicadaForeVeins(FW);
    if (P.opaque) {
      shape(ctx, FW.outline, P.wing, P.veins, 0.9);
      within(ctx, FW.outline, () => {
        P.opaque(ctx, FW);
        veins(ctx, fv, P.veins, 0.7);
      });
    } else {
      clearWing(ctx, FW.outline, P.wing, P.veins, fv);
    }
    // 前の ふちの ふとい 脈（つけねから 結節まで）
    stroke(ctx, mapLine(FW, [[0.01, -0.86], [0.3, -0.9], [0.6, -0.92]]), P.costa ?? P.veins, 1.4);
  });
  // からだ: おなか → むね（中胸）→ 前胸 → あたま
  if (P.legs) both(ctx, () => P.legs.forEach((j) => leg(ctx, j, [2.4, 1.8, 1], P.legColor, edge, { tarsi: 3, claw: 1.2, spines: 0 })));
  fill3d(ctx, sym(P.abd), P.abdTone, edge);
  P.abdDetail?.(ctx, sym(P.abd));
  const meso = sym(P.meso);
  fill3d(ctx, meso, P.mesoTone, edge);
  P.mesoDetail?.(ctx, meso);
  // あたま → 前胸 の じゅんに かさね、前胸の まえの ふちが あたまの うしろを おおう（v0.19.9: あたまと 前胸の 幅を そろえ、
  // 前胸は うしろへ なめらかに ひろがって かどは まるい。前は あたまの うしろが まっすぐで 前胸の かどが 出て、段が できて いた）
  const head = sym(P.head);
  fill3d(ctx, head, P.headTone, edge);
  within(ctx, head, () => P.headDetail?.(ctx, head));
  const pro = sym(P.pro);
  fill3d(ctx, pro, P.proTone, edge);
  within(ctx, pro, () => {
    P.proDetail?.(ctx, pro);
    // うしろの ふちの えり（すこし もりあがった 帯）
    const [px0, , px1, py1] = bbox(pro);
    stroke(ctx, [[px0 + 2, py1 - 2.6], [0, py1 - 2.2], [px1 - 2, py1 - 2.6]], 'rgba(255,255,255,0.14)', 0.9);
  });
  both(ctx, () => compoundEye(ctx, ...P.eye, P.eyeColor));
  // 単眼（あたまの まんなかの 小さな 3つの め）
  dots(ctx, [[0, P.eye[1] - 1.5], [-2.2, P.eye[1] + 0.6], [2.2, P.eye[1] + 0.6]], 0.8, '#d04a3a');
  // みじかい 触角
  both(ctx, () => stroke(ctx, [[P.eye[0] - 3.5, P.eye[1] - 3.5], [P.eye[0] - 1.5, P.eye[1] - 7.5]], P.legColor, 0.8, false));
  gloss(ctx, meso, -5, P.meso[2][1], 10, 0.22);
}

const CICADA_LEGS = [
  [[6, -10], [13, -14], [16, -19], [18, -23]],
  [[7, 0], [14, 2], [17, 6], [19, 9]],
  [[7, 6], [13, 10], [16, 16], [18, 20]],
];

// アブラゼミ: はねが ちゃいろで すけない（こい まだら）。からだは くろっぽい ちゃいろ
const brownCicada = {
  group: 'cicada', level: 1, similar: ['greenCicada', 'slimCicada'],
  box: [-84, -28, 84, 44],
  draw(ctx) {
    cicada(ctx, {
      edge: '#1a0e06',
      // 前ばねは はばが ひろく、さきの ほうが いちばん ひろくて まるい（ずんぐり）
      fw: { y0: 1, L: 76, C: 31, base: 6, alpha: 0.55, beta: 0.24, lead: 0.32, sweep: 1 },
      hw: { y0: 14, L: 46, C: 25, base: 6, alpha: 0.3, beta: 0.4, lead: 0.3, sweep: 3 },
      wing: '#8a5a32',
      hwTint: 'rgba(120,80,40,0.85)',
      veins: '#3a200c',
      costa: '#2a1606',
      opaque(c, FW) {
        // こい ちゃいろの まだら（くもの ような もよう）。はねの 中の (u, v) に ちらす
        const rnd = seeded(71);
        for (let i = 0; i < 30; i++) {
          const [x, y] = FW.at(0.2 + rnd() * 0.75, -0.8 + rnd() * 1.6);
          oval(c, x, y, 2.5 + rnd() * 5, 1.8 + rnd() * 3.5, 'rgba(60,32,12,0.45)', null, 0, rnd() * PI);
        }
        c.fillStyle = hgrad(c, 8, 40, ['rgba(40,20,8,0.5)', 'rgba(40,20,8,0)']);
        c.fillRect(8, -20, 32, 42);
      },
      legs: CICADA_LEGS,
      legColor: '#4a2c14',
      abd: [[0, 8], [8, 9], [11, 16], [10.5, 28], [7.5, 38], [3, 43], [0, 44]],
      abdTone: ['#6a4a30', '#3a2414', '#140a04'],
      abdDetail(c, abd) {
        within(c, abd, () => { for (let y = 14; y < 44; y += 5) stroke(c, [[-12, y], [0, y + 1.2], [12, y]], 'rgba(200,180,150,0.35)', 0.7); });
      },
      meso: [[0, -10], [11.5, -10], [14.2, -6.5], [13.6, 1], [11, 6.5], [7, 10.2], [0, 11.2]],
      mesoTone: ['#5a4030', '#2a1a10', '#0e0804'],
      mesoDetail(c) {
        // 中胸の もよう（ちゃいろの W と、うしろの ばってん）
        both(c, () => stroke(c, [[2, -8], [5, -3], [3, 3]], 'rgba(170,120,70,0.7)', 1.2));
        shape(c, [[-3.5, 4], [3.5, 4], [5, 7], [2, 9.5], [0, 8.5], [-2, 9.5], [-5, 7]], '#8a6040');
      },
      pro: [[0, -18.3], [7, -18.5], [11.9, -18.1], [13.8, -16.6], [15.2, -14.2], [16.3, -11.5], [16.7, -9.2], [15.6, -7.6], [0, -7.9]],
      proTone: ['#6a4a30', '#3a2414', '#140a04'],
      proDetail(c) {
        both(c, () => stroke(c, [[4, -17], [7, -12], [11, -11]], 'rgba(170,120,70,0.6)', 1));
      },
      head: [[0, -26.5], [4, -26.2], [8, -25], [11.5, -23.2], [13.6, -20.6], [13.6, -18], [12.2, -16.6], [0, -16.6]],
      headTone: ['#5a4030', '#2a1a10', '#0e0804'],
      eye: [13.8, -21, 2.8, 2.6],
      eyeColor: '#4a3a24',
    });
  },
};

// ミンミンゼミ: はねが すきとおる。からだは くろく、むね に みどりの もよう。ずんぐり ふとい
const greenCicada = {
  group: 'cicada', level: 1, similar: ['slimCicada', 'brownCicada'],
  box: [-90, -28, 90, 46],
  draw(ctx) {
    const green = '#4aa872';
    cicada(ctx, {
      edge: '#0a1a10',
      // 前ばねは ながく、さきは やや まるい。前の ふちは ほぼ まっすぐ
      fw: { y0: 0, L: 82, C: 27, base: 5, alpha: 0.45, beta: 0.38, lead: 0.3, sweep: 2 },
      hw: { y0: 13, L: 50, C: 22, base: 5, alpha: 0.35, beta: 0.5, lead: 0.3, sweep: 4 },
      wing: 'rgba(214,232,226,0.35)',
      veins: '#2a4a34',
      costa: '#3a8a5a', // 前の ふちの 脈が みどり
      legs: CICADA_LEGS,
      legColor: '#2a3a2a',
      abd: [[0, 8], [9, 9], [12.5, 16], [12, 28], [8.5, 39], [3.5, 45], [0, 46]],
      abdTone: ['#4a4a48', '#1c1c1c', '#080808'],
      abdDetail(c, abd) {
        // おなかの ふしの さかいに しろい こな
        within(c, abd, () => { for (let y = 14; y < 46; y += 5) stroke(c, [[-13, y], [0, y + 1.2], [13, y]], 'rgba(230,236,240,0.55)', 1.1); });
      },
      meso: [[0, -10], [12.2, -10], [15, -6.5], [14.4, 1], [11.6, 6.8], [7.4, 10.6], [0, 11.6]],
      mesoTone: ['#3a3a38', '#161616', '#060606'],
      mesoDetail(c) {
        // みどりの もよう（ふち と まんなかの くさび）
        both(c, () => {
          shape(c, [[9, -9], [12.5, -5], [12, 3], [9, 6], [10.5, -1]], green);
          shape(c, [[1, -9], [4.5, -9], [3, -2], [1, -1]], green);
        });
        shape(c, [[-4, 4], [4, 4], [5.5, 7.5], [2, 10], [0, 9], [-2, 10], [-5.5, 7.5]], green);
      },
      pro: [[0, -18.3], [7.42, -18.5], [12.61, -18.1], [14.63, -16.6], [16.11, -14.2], [17.28, -11.5], [17.7, -9.2], [16.54, -7.6], [0, -7.9]],
      proTone: ['#3a3a38', '#161616', '#060606'],
      proDetail(c) {
        both(c, () => {
          shape(c, [[12, -16.5], [16, -14.5], [17, -10], [13, -10]], green);
          stroke(c, [[2, -17], [4, -12], [2.5, -10]], green, 1.3);
        });
      },
      head: [[0, -26.5], [4.24, -26.2], [8.48, -25], [12.19, -23.2], [14.42, -20.6], [14.42, -18], [12.93, -16.6], [0, -16.6]],
      headTone: ['#3a4a3a', '#162016', '#060a06'],
      headDetail(c) {
        both(c, () => stroke(c, [[3, -23.5], [7, -22], [10, -19]], green, 1));
      },
      eye: [14.6, -21, 2.9, 2.7],
      eyeColor: '#3a4a38',
    });
  },
};

// ツクツクボウシ: はねが すきとおる。からだが ほそく おなかが ながい。みどりっぽい くろに みどりの もよう
const slimCicada = {
  group: 'cicada', level: 2, similar: ['greenCicada', 'brownCicada'],
  box: [-78, -25, 78, 50],
  draw(ctx) {
    const green = '#6ab878';
    cicada(ctx, {
      edge: '#0a1a10',
      // 前ばねは ほそながく、さきが とがる（からだも ほそい）
      fw: { y0: 0, L: 70, C: 19, base: 4, alpha: 0.55, beta: 0.85, lead: 0.36, sweep: 2.5 },
      hw: { y0: 10, L: 41, C: 15, base: 4, alpha: 0.4, beta: 0.7, lead: 0.3, sweep: 3.5 },
      wing: 'rgba(220,236,226,0.32)',
      veins: '#2a4a2e',
      legs: CICADA_LEGS.map((j) => j.map(([x, y]) => [x * 0.85, y * 0.95])),
      legColor: '#3a5030',
      abd: [[0, 7], [6.5, 8], [8.5, 15], [8.2, 28], [6.5, 40], [3.5, 48], [0, 50]],
      abdTone: ['#5a6a48', '#26301e', '#0c1008'],
      abdDetail(c, abd) {
        within(c, abd, () => { for (let y = 13; y < 50; y += 5) stroke(c, [[-9, y], [0, y + 1], [9, y]], 'rgba(150,200,140,0.45)', 0.9); });
      },
      meso: [[0, -8.5], [9, -8.5], [11, -5.5], [10.5, 1], [8.5, 5.5], [5.5, 8.6], [0, 9.5]],
      mesoTone: ['#4a5a40', '#1e2a18', '#080c06'],
      mesoDetail(c) {
        both(c, () => {
          shape(c, [[6.5, -7.5], [9.5, -4], [9, 2.5], [6.5, 5], [7.5, -1]], green);
          shape(c, [[0.8, -7.5], [3.2, -7.5], [2.2, -2], [0.8, -1]], green);
        });
        shape(c, [[-3, 3.5], [3, 3.5], [4.2, 6.2], [1.5, 8.3], [0, 7.5], [-1.5, 8.3], [-4.2, 6.2]], green);
      },
      pro: [[0, -14.64], [5.46, -14.8], [9.28, -14.48], [10.76, -13.28], [11.86, -11.36], [12.71, -9.2], [13.03, -7.36], [12.17, -6.08], [0, -6.32]],
      proTone: ['#4a5a40', '#1e2a18', '#080c06'],
      proDetail(c) {
        both(c, () => shape(c, [[8.5, -14.5], [11.5, -12.5], [12.2, -8.6], [9.5, -8.6]], green));
      },
      head: [[0, -21.2], [3.12, -20.96], [6.24, -20], [8.97, -18.56], [10.61, -16.48], [10.61, -14.4], [9.52, -13.28], [0, -13.28]],
      headTone: ['#4a5a40', '#1e2a18', '#080c06'],
      eye: [11, -16.8, 2.4, 2.2],
      eyeColor: '#4a5a3a',
    });
  },
};

// トンボ: 4まいの はねを よこに ひろげた 標本の すがた。P.body = からだの ながさの めやす
function dragonfly(ctx, P) {
  const edge = P.edge;
  // はね（後ばね → 前ばね）。P.fw・P.hw = 平面形（planform）。種類ごとに はばや 後ばねの つけねの かたちが ちがう:
  // ヤンマの なかまは ほそながく、トンボ科（シオカラ・アカネ）は 後ばねの つけねが 大きく ひろがる。
  // オニヤンマの オスは 後ばねの つけねが かどばり、ギンヤンマの オスは まるい
  both(ctx, () => {
    for (const spec of [P.hw, P.fw]) {
      const W = planform({ x0: 6, ...spec });
      // 縦の 脈（v の いち, はじまりの u, おわりの u）。前の ふちに こまかい 横の 脈（前縁横脈）が ならぶ
      const longs = [[-0.84, 0, 0.46], [-0.72, 0, 0.985], [-0.5, 0.28, 0.98], [-0.26, 0.02, 0.96], [0.06, 0.04, 0.93], [0.4, 0.02, 0.8], [0.72, 0.02, 0.5]];
      const lines = longs.map(([v, u0, u1]) => mapLine(W, [[u0, v * (u0 < 0.05 ? 0.5 : 1)], [(u0 + u1) / 2, v], [u1, v]]));
      const cross = [];
      for (let u = 0.04; u < 0.46; u += 0.028) cross.push(mapLine(W, [[u, -1], [u, -0.84]]));
      for (let k = 1; k < longs.length; k++) {
        const [va, a0, a1] = longs[k - 1];
        const [vb, b0, b1] = longs[k];
        const from = Math.max(a0, b0) + 0.03;
        const to = Math.min(a1, b1) - 0.02;
        for (let u = from; u < to; u += 0.045) cross.push(mapLine(W, [[u + (k % 2) * 0.02, va], [u + 0.01 + (k % 2) * 0.02, vb]]));
      }
      clearWing(ctx, W.outline, P.wingTint, P.veins, [...lines, ...cross], 0.7);
      if (spec.amber) {
        // つけねの こはくいろ（アキアカネなど）
        within(ctx, W.outline, () => {
          ctx.fillStyle = hgrad(ctx, 6, 6 + spec.L * 0.22, [spec.amber, 'rgba(0,0,0,0)']);
          ctx.fillRect(6, spec.y0 - spec.C, spec.L * 0.22, spec.C * 2.5);
        });
      }
      // 縁紋（はねの さきの 前の ふちの こい しるし）。ヤンマは ながい
      const [s0, s1] = spec.stigma ?? [0.84, 0.9];
      shape(ctx, mapLine(W, [[s0, -0.99], [s1, -0.99], [s1, -0.74], [s0, -0.74]]), P.stigma, null);
      // 結節（前の ふちの まんなかの くびれ）
      disc(ctx, ...W.at(0.46, -0.96), 0.9, P.veins);
    }
  });
  // おなか（ふしに わけて ぬる）
  const segs = P.segs;
  const abdTop = P.abdTop;
  const abdLen = P.abdLen;
  const abd = sym([[0, abdTop], ...P.abdHalf.map(([w, t]) => [w, abdTop + abdLen * t]), [0, abdTop + abdLen]]);
  fill3d(ctx, abd, P.abdTone, edge, 0.7, [0.3, 0.1]);
  within(ctx, abd, () => {
    for (let i = 0; i < segs; i++) {
      const y0 = abdTop + (abdLen * i) / segs;
      const y1 = abdTop + (abdLen * (i + 1)) / segs;
      P.seg?.(ctx, i, y0, y1);
      if (i > 0) stroke(ctx, [[-8, y0], [8, y0]], 'rgba(0,0,0,0.5)', 0.5, false);
    }
    stroke(ctx, [[0, abdTop + 2], [0, abdTop + abdLen - 2]], 'rgba(0,0,0,0.25)', 0.5, false);
  });
  // 尾の さきの 付属器
  both(ctx, () => stroke(ctx, [[1, abdTop + abdLen - 1], [2.6, abdTop + abdLen + 3.5]], edge, 1.1));
  // むね
  const thorax = sym(P.thorax);
  fill3d(ctx, thorax, P.thoraxTone, edge);
  P.thoraxDetail?.(ctx, thorax);
  // あたま（大きな 複眼）
  P.head(ctx);
}

// トンボの あたま: 複眼の つきかた（'point' = 1点で つく・'seam' = ながく くっつく・'meet' = みじかく くっつく）
function dragonHead(ctx, y, r, eyeTone, faceColor, style) {
  const gap = style === 'point' ? 0.1 : 0;
  const ex = style === 'seam' ? r * 0.78 : r * 0.88;
  // 顔（前の ほう）
  oval(ctx, 0, y + r * 0.62, r * 0.9, r * 0.5, faceColor, 'rgba(0,0,0,0.6)', 0.6);
  both(ctx, () => {
    const pts = ell(ex + gap, y, r, r * 0.95, 28);
    fill3d(ctx, pts, eyeTone, 'rgba(0,0,0,0.55)', 0.6, [0.4, 0.25]);
  });
  if (style === 'seam') stroke(ctx, [[0, y - r * 0.75], [0, y + r * 0.5]], 'rgba(0,0,0,0.45)', 0.6, false);
}

// オニヤンマ: くろに きいろの しま。みどりの めが 上で 1点だけ つく。いちばん 大きい
const goldenRinged = {
  group: 'dragonfly', level: 1, similar: ['emperorDragonfly', 'skimmer'],
  box: [-126, -66, 126, 106],
  draw(ctx) {
    const yellow = '#f0d23a';
    dragonfly(ctx, {
      edge: '#0a0a04',
      // ほそながい はね。後ばねの つけねは かどばる（オス）。縁紋は くろく ながい
      fw: { y0: -46, L: 120, C: 22, base: 4, alpha: 0.4, beta: 0.42, lead: 0.3, sweep: -2, stigma: [0.8, 0.9] },
      hw: { y0: -24, L: 113, C: 24, base: 5, alpha: 0.3, beta: 0.45, lead: 0.28, sweep: 0, stigma: [0.8, 0.9], lobe: { at: 0.1, w: 0.11, size: 8, kind: 'angle' } },
      wingTint: 'rgba(236,230,200,0.3)', veins: 'rgba(40,36,20,0.7)', stigma: '#1a1a10',
      abdTop: -21, abdLen: 122, segs: 10,
      abdHalf: [[5.5, 0.02], [4.2, 0.1], [3.6, 0.2], [3.6, 0.6], [4.2, 0.85], [4, 0.95]],
      abdTone: ['#4a4a40', '#141410', '#040404'],
      seg(c, i, y0, y1) {
        // ふしごとに きいろの わ（ふしの まえの ほう）
        const h = (y1 - y0) * (i < 2 ? 0.35 : 0.22);
        c.fillStyle = yellow;
        c.fillRect(-8, y0 + (y1 - y0) * 0.1, 16, h);
      },
      thorax: [[0, -54], [7, -54], [11, -47], [11.5, -35], [9.5, -24], [5.5, -19], [0, -18.5]],
      thoraxTone: ['#4a4a40', '#141410', '#040404'],
      thoraxDetail(c, th) {
        within(c, th, () => both(c, () => {
          shape(c, [[3, -52], [5, -52], [9, -32], [7, -31]], yellow);
          shape(c, [[8.5, -47], [10.2, -47], [11.4, -27], [9.8, -27]], yellow);
        }));
      },
      head(c) {
        dragonHead(c, -58, 7.5, ['#9af0b0', '#2aa860', '#0a4a28'], '#e8d84a', 'point');
      },
    });
  },
};

// ギンヤンマ（オス）: むねが きみどり。おなかの つけねが みずいろ、その さきは ちゃいろ。めは ながく くっつく
const emperorDragonfly = {
  group: 'dragonfly', level: 1, similar: ['goldenRinged', 'skimmer'],
  box: [-108, -56, 108, 84],
  draw(ctx) {
    dragonfly(ctx, {
      edge: '#14200a',
      // ほそながい はね。オスの 後ばねの つけねは まるい（ヤンマの なかまでは めずらしい）。縁紋は ちゃいろ
      fw: { y0: -38.5, L: 102, C: 19.5, base: 3.5, alpha: 0.4, beta: 0.42, lead: 0.3, sweep: -2, stigma: [0.8, 0.89] },
      hw: { y0: -19.5, L: 96, C: 22, base: 5, alpha: 0.3, beta: 0.45, lead: 0.28, sweep: 0, stigma: [0.8, 0.89], lobe: { at: 0.12, w: 0.14, size: 5, kind: 'round' } },
      wingTint: 'rgba(236,224,190,0.32)', veins: 'rgba(60,48,24,0.7)', stigma: '#8a6a2a',
      abdTop: -16, abdLen: 96, segs: 10,
      abdHalf: [[6.5, 0.02], [5.8, 0.12], [3.6, 0.22], [3.4, 0.6], [3.8, 0.85], [3.6, 0.95]],
      abdTone: ['#a87a4a', '#6a4422', '#2a1808'],
      seg(c, i, y0, y1) {
        if (i === 0) {
          c.fillStyle = '#8ac850';
          c.fillRect(-8, y0, 16, y1 - y0);
        } else if (i === 1) {
          c.fillStyle = '#6ac8ec';
          c.fillRect(-8, y0, 16, y1 - y0);
        } else {
          // ちゃいろの ふしに こい せすじの もよう
          shape(c, [[-1.2, y0 + 1], [1.2, y0 + 1], [2.4, y1 - 1], [-2.4, y1 - 1]], 'rgba(40,20,6,0.6)', null);
        }
      },
      thorax: [[0, -45], [6.5, -45], [10, -39], [10.5, -29], [8.5, -19], [5, -14.5], [0, -14]],
      thoraxTone: ['#d8f0a0', '#8ac84a', '#3a6a1a'],
      head(c) {
        dragonHead(c, -48.5, 7.2, ['#b0f0c0', '#3ab870', '#145a30'], '#d8e070', 'seam');
      },
    });
  },
};

// シオカラトンボ（オス）: おなかは しろっぽい みずいろの こな、さきは くろ。むねは くろっぽい。おなかが ひらたく ふとめ
const skimmer = {
  group: 'dragonfly', level: 1, similar: ['redDragonfly', 'emperorDragonfly'],
  box: [-90, -48, 90, 62],
  draw(ctx) {
    dragonfly(ctx, {
      edge: '#0a1014',
      // トンボ科: 後ばねの つけねが 大きく ひろがる。縁紋は くろく みじかい
      fw: { y0: -32, L: 84, C: 16.5, base: 3, alpha: 0.35, beta: 0.38, lead: 0.32, sweep: -1.5 },
      hw: { y0: -16, L: 79, C: 16, base: 6, alpha: 0.25, beta: 0.4, lead: 0.25, lobe: { at: 0.14, w: 0.2, size: 10, kind: 'round' } },
      wingTint: 'rgba(230,232,236,0.3)', veins: 'rgba(38,42,48,0.7)', stigma: '#1a1a1a',
      abdTop: -12, abdLen: 70, segs: 10,
      abdHalf: [[6, 0.03], [5.4, 0.12], [5, 0.3], [4.6, 0.6], [3.8, 0.85], [3.2, 0.95]],
      abdTone: ['#e0ecf4', '#9ab4c8', '#4a6070'],
      seg(c, i, y0, y1) {
        if (i >= 7) {
          c.fillStyle = '#141618';
          c.fillRect(-8, y0, 16, y1 - y0 + 1);
        }
      },
      thorax: [[0, -38], [6, -38], [9.5, -33], [10, -24], [8, -14], [5, -11], [0, -10.5]],
      thoraxTone: ['#6a7480', '#2e343c', '#101418'],
      thoraxDetail(c, th) {
        speckle(c, th, 60, 0.5, 'rgba(180,200,215,0.35)', 81);
      },
      head(c) {
        dragonHead(c, -41.5, 6.4, ['#8ab0d0', '#3a5a7a', '#14243a'], '#c8c8b8', 'meet');
      },
    });
  },
};

// アキアカネ（オス）: あきに おなかが まっか。むねは ちゃいろに くろい すじ。はねは すきとおる
const redDragonfly = {
  group: 'dragonfly', level: 1, similar: ['skimmer', 'goldenRinged'],
  box: [-82, -44, 82, 60],
  draw(ctx) {
    dragonfly(ctx, {
      edge: '#2a0a04',
      // トンボ科: 後ばねの つけねが ひろがり、つけねが すこし こはくいろ。縁紋は あかちゃいろ
      fw: { y0: -30, L: 76, C: 15, base: 3, alpha: 0.35, beta: 0.4, lead: 0.32, sweep: -1.5, amber: 'rgba(230,160,50,0.3)' },
      hw: { y0: -15.5, L: 72, C: 15, base: 6, alpha: 0.25, beta: 0.4, lead: 0.25, lobe: { at: 0.13, w: 0.19, size: 9, kind: 'round' }, amber: 'rgba(230,150,40,0.45)' },
      wingTint: 'rgba(240,226,210,0.3)', veins: 'rgba(74,42,26,0.7)', stigma: '#8a3a1a',
      abdTop: -11.5, abdLen: 66, segs: 10,
      abdHalf: [[4.6, 0.03], [4, 0.12], [3.4, 0.3], [3.3, 0.6], [3.6, 0.85], [3, 0.95]],
      abdTone: ['#ff8a6a', '#d8321c', '#7a1004'],
      seg(c, i, y0, y1) {
        // うしろの ふしの よこに 小さな くろい しるし
        if (i >= 7) both(c, () => shape(c, [[2.4, y0 + 1], [4, y0 + 1.5], [4, y1 - 1.5], [2.6, y1 - 1]], '#3a0a04'));
      },
      thorax: [[0, -35], [5.5, -35], [8.5, -30.5], [9, -22], [7.5, -13], [4.5, -10.5], [0, -10]],
      thoraxTone: ['#d8a060', '#a06a30', '#4a2a10'],
      thoraxDetail(c, th) {
        within(c, th, () => both(c, () => {
          stroke(c, [[3, -34], [6.5, -22], [5, -15]], '#2a1408', 1.1);
          stroke(c, [[7, -31], [8.8, -24]], '#2a1408', 0.9);
        }));
      },
      head(c) {
        dragonHead(c, -38.5, 5.8, ['#e0a080', '#a04a2a', '#4a1a0a'], '#e0c090', 'meet');
      },
    });
  },
};

// チョウ: はねを ひろげた 標本の すがた（あたまが 上）。前ばねが 後ばねの 上に かさなる
function butterfly(ctx, P) {
  both(ctx, () => {
    shape(ctx, P.hw, P.hwBase ?? P.base, null);
    within(ctx, P.hw, () => P.hwPaint(ctx));
    shape(ctx, P.hw, null, P.edge, 0.7);
    shape(ctx, P.fw, P.base, null);
    within(ctx, P.fw, () => P.fwPaint(ctx));
    shape(ctx, P.fw, null, P.edge, 0.7);
  });
  // からだ（毛の ある むね・ほそい おなか）
  const abd = sym([[0, -2], [3.2, 0], [3.6, 10], [3, 24], [1.6, 32], [0, 34]].map(([x, y]) => [x * P.bodyW, y * P.bodyL]));
  fill3d(ctx, abd, P.bodyTone, '#000', 0.6);
  P.abdDetail?.(ctx, abd);
  const th = ell(0, -7 * P.bodyL, 4.6 * P.bodyW, 9 * P.bodyL, 20);
  fill3d(ctx, th, P.bodyTone, '#000', 0.6);
  speckle(ctx, th, 80, 0.5, P.hair ?? 'rgba(200,190,170,0.4)', 91);
  P.thDetail?.(ctx, th);
  const hy = -17.5 * P.bodyL;
  oval(ctx, 0, hy, 3.6 * P.bodyW, 3.2, P.bodyTone[1], '#000', 0.6);
  both(ctx, () => {
    compoundEye(ctx, 2.6 * P.bodyW, hy - 0.4, 1.8, 2.2, P.eyeColor ?? '#3a3424');
    // こん棒の ような 触角（さきが ふくらむ）
    const tip = P.antTip;
    stroke(ctx, [[1.5, hy - 2.5], [tip[0] * 0.5, (hy + tip[1]) / 2 - 2], tip], P.antColor ?? '#1a1a1a', 0.9);
    oval(ctx, tip[0] + 0.6, tip[1] - 0.8, 1.5, 2.6, P.antColor ?? '#1a1a1a', null, 0, 0.5);
  });
}

// はねの 脈（つけねから ふちへ）
function wingVeins(ctx, from, tos, color, width) {
  for (const to of tos) stroke(ctx, [from, [(from[0] + to[0]) / 2 + (to[1] - from[1]) * 0.04, (from[1] + to[1]) / 2], to], color, width);
}

// ナミアゲハ: きいろに くろい すじ。前ばねの つけねに こまかい しま、後ばねに しっぽ・あおい てん・オレンジの まるい もよう
const swallowtail = {
  group: 'butterfly', level: 1, similar: ['cabbageWhite', 'purpleEmperor'],
  box: [-88, -62, 88, 70],
  draw(ctx) {
    const black = '#1c1a16';
    const yellow = '#f4de7e';
    butterfly(ctx, {
      edge: '#16140e',
      base: yellow,
      bodyW: 1.1, bodyL: 1.05,
      bodyTone: ['#4a4436', '#1c1a14', '#060604'],
      antTip: [17, -52],
      abdDetail(c) {
        both(c, () => stroke(c, [[2.6, 2], [3.2, 14], [2.4, 28]], yellow, 0.9));
      },
      fw: [[3, -10], [20, -27], [45, -41], [69, -51], [83, -54, 1], [81, -40], [74, -22], [64, -6], [53, 3, 1], [32, -1], [12, -2], [4, -2]],
      fwPaint(c) {
        // つけねの こまかい しま（くろと きいろ）
        for (let k = 0; k < 6; k++) {
          const y = -6 - k * 4.3;
          stroke(c, [[4, -3 - k * 1.2], [16 + k * 2, y - 2], [30 + k * 1.5, y - 8 - k]], black, 2);
        }
        // すじ と くろい おび（はしの ほう ほど くろい）
        wingVeins(c, [5, -5], [[60, -48], [70, -44], [76, -34], [76, -24], [72, -14], [66, -6], [58, 0], [42, 0]], black, 1.3);
        shape(c, [[40, -40], [48, -46], [54, -24], [52, -4], [46, -2], [44, -22]], black);
        shape(c, [[62, -54], [86, -56], [82, -38], [74, -20], [64, -4], [54, 4], [48, 2], [58, -10], [66, -24], [70, -40]], black);
        // くろい ふちの なかの きいろい てん（ならぶ）
        const spots = [[73, -44], [72.5, -36], [70, -27], [65.5, -18], [60, -10], [54, -3]];
        for (const [x, y] of spots) oval(c, x, y, 2.4, 3.2, yellow, null, 0, 0.4);
        stroke(c, [[3, -10], [20, -27], [45, -41], [69, -51], [83, -54]], black, 3);
      },
      hw: [[4, -2], [24, -2], [44, 4], [57, 13], [61, 25], [57, 36], [50, 44], [46, 49], [47, 58], [45, 67, 1], [41.5, 59], [38, 51], [31, 53], [22, 52], [12, 46], [6, 34], [3, 14]],
      hwPaint(c) {
        wingVeins(c, [5, 2], [[34, 2], [50, 12], [58, 24], [56, 36], [46, 48], [32, 52], [18, 50], [8, 40]], black, 1.3);
        // ふちの くろい おびと、その中の あおい てん・きいろい 三日月
        shape(c, [[60, 18], [64, 30], [58, 42], [48, 52], [36, 58], [22, 56], [14, 50], [24, 46], [36, 44], [46, 38], [52, 28], [56, 18]], black);
        for (const [x, y] of [[54, 30], [48, 39], [40, 45], [31, 48]]) oval(c, x, y, 2.4, 1.6, '#4a7ad0', null, 0, 0.6);
        for (const [x, y] of [[58.5, 32], [53, 42.5], [44, 50], [33, 53.5], [23, 52.5]]) oval(c, x, y, 2.4, 1.4, yellow, null, 0, 0.5);
        // しっぽ と オレンジの まるい もよう（くろい ひとみ）
        shape(c, [[46, 48], [48, 58], [46, 68], [41, 60], [40, 50]], black);
        oval(c, 18, 48, 4.4, 3.6, '#e8702a');
        oval(c, 18, 48.6, 1.8, 1.6, black);
        // うちがわ（からだの そば）の くろい ふち
        shape(c, [[2, 6], [8, 4], [12, 24], [14, 46], [8, 50], [2, 30]], black);
      },
    });
  },
};

// モンシロチョウ: しろい はね。前ばねの かどが くろく、くろい てんが 2つ。後ばねの 前の はしにも くろい てん
const cabbageWhite = {
  group: 'butterfly', level: 1, similar: ['swallowtail', 'purpleEmperor'],
  box: [-62, -54, 62, 46],
  draw(ctx) {
    const black = '#2a2a2a';
    butterfly(ctx, {
      edge: '#8a8a80',
      base: '#fbfaf3',
      bodyW: 0.85, bodyL: 0.8,
      bodyTone: ['#6a6a66', '#2a2a28', '#0a0a0a'],
      hair: 'rgba(240,240,230,0.6)',
      antTip: [14, -46],
      fw: [[3, -9], [18, -24], [36, -36], [50, -43], [57, -42], [59, -32], [55, -17], [47, -5], [39, 1], [25, 0], [10, -2], [4, -2]],
      fwPaint(c) {
        // つけねの 灰いろ、かどの くろ、くろい てん 2つ
        c.fillStyle = rgrad(c, 3, -5, 15, ['rgba(90,90,90,0.55)', 'rgba(90,90,90,0)']);
        c.fillRect(0, -40, 40, 44);
        shape(c, [[42, -46], [60, -45], [60, -30], [55, -28], [53, -34], [47, -38]], 'rgba(40,40,40,0.85)');
        oval(c, 39, -21, 3.6, 3.8, black);
        oval(c, 33, -7, 3.2, 3.2, 'rgba(42,42,42,0.85)');
        wingVeins(c, [5, -5], [[40, -40], [52, -40], [56, -30], [54, -18], [48, -8], [40, -2]], 'rgba(150,150,140,0.5)', 0.6);
      },
      hw: [[4, -2], [20, -1], [36, 5], [46, 15], [47, 27], [40, 37], [28, 42], [15, 40], [7, 32], [3, 12]],
      hwPaint(c) {
        c.fillStyle = rgrad(c, 3, 2, 13, ['rgba(90,90,90,0.5)', 'rgba(90,90,90,0)']);
        c.fillRect(0, -2, 40, 30);
        oval(c, 40, 10, 3.2, 2.6, 'rgba(42,42,42,0.85)', null, 0, 0.6);
        wingVeins(c, [5, 2], [[42, 12], [46, 24], [38, 36], [26, 41], [14, 39]], 'rgba(150,150,140,0.5)', 0.6);
      },
    });
  },
};

// オオムラサキ（オス）: こげちゃの はねの うちがわが むらさきに ひかる。しろと きいろの もよう。後ばねの かどに あかい てん
const purpleEmperor = {
  group: 'butterfly', level: 2, similar: ['swallowtail', 'cabbageWhite'],
  box: [-86, -60, 86, 62],
  draw(ctx) {
    const white = '#f4f0e2';
    const cream = '#efd88a';
    const purple = (c, x, y, r) => {
      c.fillStyle = rgrad(c, x, y, r, ['rgba(120,70,220,0.95)', 'rgba(110,60,200,0.8)', 'rgba(90,50,160,0)']);
      c.fillRect(x - r, y - r, r * 2, r * 2);
    };
    butterfly(ctx, {
      edge: '#1a120c',
      base: '#3a2a1e',
      bodyW: 1.15, bodyL: 1,
      bodyTone: ['#5a4a3a', '#2a1e14', '#0a0604'],
      antTip: [16, -50],
      eyeColor: '#4a3a24',
      fw: [[3, -10], [22, -29], [48, -43], [71, -51], [80, -51, 1], [77, -41], [73, -28], [68, -15], [60, -1, 1], [38, -2], [14, -3], [4, -2]],
      fwPaint(c) {
        purple(c, 6, -8, 46);
        for (const [x, y, rx, ry] of [[36, -27, 3.4, 2.6], [46, -33, 3, 2.4], [56, -38, 2.6, 2.2], [64, -42, 2.2, 2], [44, -16, 3.2, 2.8], [53, -22, 3, 2.6], [36, -12, 2.8, 2.4]]) oval(c, x, y, rx, ry, white, null, 0, -0.4);
        for (const [x, y] of [[73, -36], [70, -26], [65, -15], [60, -6]]) oval(c, x, y, 1.8, 1.6, cream);
        wingVeins(c, [5, -5], [[60, -48], [72, -46], [74, -32], [70, -20], [64, -8], [50, -2]], 'rgba(10,6,2,0.5)', 0.8);
      },
      hw: [[4, -2], [26, -1], [48, 4], [60, 14], [62, 26], [58.5, 33], [57, 38], [52, 44], [48, 47], [42, 51], [33, 55], [24, 55], [16, 51], [8, 42], [4, 26], [3, 8]],
      hwPaint(c) {
        purple(c, 8, 6, 40);
        for (const [x, y, rx, ry] of [[32, 12, 3.4, 2.8], [40, 18, 3.2, 2.8], [46, 27, 3, 2.6], [36, 30, 2.8, 2.4], [26, 22, 2.8, 2.4]]) oval(c, x, y, rx, ry, white, null, 0, 0.4);
        for (const [x, y] of [[56, 24], [54, 34], [48, 42], [40, 48], [31, 51]]) oval(c, x, y, 2, 1.6, cream);
        oval(c, 19, 49, 3, 2.4, '#d8382a');
        oval(c, 12, 44, 2.4, 2, '#d8382a');
        wingVeins(c, [5, 2], [[46, 8], [58, 22], [54, 38], [40, 50], [24, 53], [12, 45]], 'rgba(10,6,2,0.5)', 0.8);
      },
    });
  },
};

// セイヨウミツバチ（はたらきバチ）: むねに ちゃいろの 毛。おなかに オレンジと くろの しま。すきとおった はね 4まい
const honeybee = {
  group: 'bee', level: 1, similar: ['firefly', 'slimCicada'],
  box: [-64, -40, 64, 38],
  draw(ctx) {
    const edge = '#140c04';
    // はね（後ばね → 前ばね）
    both(ctx, () => {
      const hw = [[6, -5], [20, -3], [34, -1], [41, 2], [36, 5.5], [20, 4.5], [7, 0]];
      clearWing(ctx, hw, 'rgba(226,230,236,0.3)', 'rgba(60,50,40,0.65)', [[[7, -3], [24, -1.5], [38, 1.5]], [[7, -1], [22, 2]]], 0.6);
      const fw = [[6, -12], [22, -21], [42, -27], [56, -28], [61, -24], [55, -18], [38, -12], [20, -7], [7, -7]];
      clearWing(ctx, fw, 'rgba(226,230,236,0.3)', 'rgba(60,50,40,0.65)', [
        [[7, -11], [24, -19.5], [44, -25.5], [55, -26.5]], [[7, -9.5], [24, -15], [36, -18]], [[7, -8], [22, -10.5], [34, -13]],
        [[36, -18], [44, -22], [50, -24]], [[34, -13], [42, -16], [48, -19]], [[36, -18], [34, -13]], [[44, -22], [42, -16]], [[24, -19.5], [24, -15]],
      ], 0.6);
    });
    // あし（あと あしの すねは ひらたく ひろい＝花粉を はこぶ かご）
    both(ctx, () => {
      leg(ctx, [[5, -10], [13, -14], [17, -20], [20, -26]], [2.2, 1.7, 1], '#2a1e14', edge, { tarsi: 5, claw: 1 });
      leg(ctx, [[6, -4], [15, -2], [19, 4], [23, 8]], [2.2, 1.8, 1], '#2a1e14', edge, { tarsi: 5, claw: 1 });
      leg(ctx, [[6, 2], [14, 8], [19, 17], [22, 26]], [2.4, 3.2, 1.1], '#2a1e14', edge, { tarsi: 5, claw: 1 });
    });
    // おなか（ふしの しま）
    const abd = sym([[0, 2], [6.5, 3], [9.5, 9], [10, 18], [8, 27], [4.5, 33], [0, 35, 1]]);
    fill3d(ctx, abd, ['#e8a85a', '#b06a24', '#4a2a0a'], edge, 0.7);
    within(ctx, abd, () => {
      const bands = [[8, 11], [14.5, 17.5], [21, 24], [27, 36]];
      for (const [y0, y1] of bands) {
        ctx.fillStyle = 'rgba(30,18,6,0.88)';
        ctx.beginPath();
        trace(ctx, [[-12, y0], [0, y0 + 1.2], [12, y0], [12, y1], [0, y1 + 1.2], [-12, y1]], true, 0.3);
        ctx.fill();
      }
      for (const y of [7, 13.5, 20]) stroke(ctx, [[-11, y], [0, y + 1.2], [11, y]], 'rgba(240,210,150,0.55)', 1.2);
    });
    // むね（ちゃいろの 毛が ふさふさ）
    const th = ell(0, -9, 9, 9.5, 24);
    fill3d(ctx, th, ['#c89a5a', '#7a5228', '#2a1a08'], edge, 0.7);
    speckle(ctx, th, 260, 0.45, 'rgba(240,200,130,0.55)', 101);
    // あたま（大きな 複眼・ひじで まがる 触角）
    const head = sym([[0, -26], [5, -25.5], [8.5, -22], [8, -19], [4, -17], [0, -16.5]]);
    fill3d(ctx, head, ['#5a4a3a', '#2a1e14', '#0a0604'], edge, 0.7);
    both(ctx, () => {
      compoundEye(ctx, 6.4, -21.5, 2.6, 4, '#2a2420', -0.3);
      stroke(ctx, [[2.5, -25.5], [5, -31]], '#2a1e14', 1, false);
      antenna(ctx, [[5, -31], [9, -34], [13, -37], [15, -39]], 1, 0.9, '#2a1e14', { beads: 6 });
    });
  },
};

// ---------- よこから 見た むし（左むき。バッタ・コオロギ・カマキリ） ----------

// むこうがわの あしは こい いろで すこし ずらして 先に 描く（2本ずつ 見える）
function farSide(ctx, fn, dx = 3, dy = -1.5) {
  ctx.save();
  ctx.translate(dx, dy);
  ctx.globalAlpha = 0.85;
  fn(true);
  ctx.restore();
}

// バッタ型の うしろあし: もも（ふとく 矢羽の もよう）→ すね（とげ 2列）→ あしさき
function hopperHind(ctx, P, far) {
  const f = P.femur;
  const col = far ? P.farColor : P.legColor;
  fill3d(ctx, f, far ? [P.farColor, P.farColor, '#000'] : P.femurTone, P.edge, 0.7, [0.4, 0.2]);
  if (!far && P.femurPattern) within(ctx, f, () => P.femurPattern(ctx));
  const [k, a, t] = P.hindJoints;
  limb(ctx, k, a, P.tibiaW, P.tibiaW * 0.8, far ? P.farColor : P.tibiaColor ?? col, P.edge, 0.6);
  // すねの とげ（うしろがわ）
  const n = P.spines ?? 8;
  for (let i = 1; i <= n; i++) {
    const tt = i / (n + 1);
    const x = k[0] + (a[0] - k[0]) * tt;
    const y = k[1] + (a[1] - k[1]) * tt;
    stroke(ctx, [[x + 0.8, y], [x + 2.6, y + 1.6]], P.edge, 0.6, false);
  }
  leg(ctx, [a, a, a, t], [0.1, 0.1, P.tarsusW ?? 1.6], col, P.edge, { tarsi: 3, claw: 1.2 });
}

// 前・中の あし（よこから）: つけね → ひざ → あしくび → さき
function sideLeg(ctx, joints, w, color, edge, opt = {}) {
  leg(ctx, joints, w, color, edge, { tarsi: 3, claw: 1.2, ...opt });
}

// ながい 糸のような 触角（v0.19.1）: ねもとから さきへ だんだん ほそく。bands = [いろ1, いろ2, ながさ, どこまで] で しまもよう
// （スズムシの 白と くろの まだら）。キリギリス・スズムシ・コオロギは 長さ・むき・太さ・色で 描きわける
function threadAntenna(ctx, pts, w0, w1, color, { bands = null, alpha = 1 } = {}) {
  // 1本の ほそながい 形に して ぬる（線を つなぐと つなぎめが こく なって てんてんに 見えるため）
  const line = resample(pts, 80);
  const n = line.length;
  const side = [];
  for (let i = 0; i < n; i++) {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(n - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const w = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
    side.push([(-(b[1] - a[1]) / len) * w, ((b[0] - a[0]) / len) * w]);
  }
  const piece = (i0, i1, fill) => {
    ctx.beginPath();
    ctx.moveTo(line[i0][0] + side[i0][0], line[i0][1] + side[i0][1]);
    for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(line[i][0] + side[i][0], line[i][1] + side[i][1]);
    for (let i = i1; i >= i0; i--) ctx.lineTo(line[i][0] - side[i][0], line[i][1] - side[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  ctx.save();
  ctx.globalAlpha = alpha;
  if (!bands) piece(0, n - 1, color);
  else {
    // しまの ところは みじかい 区切りごとに 色を かえる（区切りは かさならない）
    let run = 0;
    let start = 0;
    let cur = bands[0];
    const stop = Math.round((n - 1) * bands[3]);
    for (let i = 1; i <= stop; i++) {
      run += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
      const c = Math.floor(run / bands[2]) % 2 ? bands[1] : bands[0];
      if (c !== cur || i === stop) {
        piece(start, i, cur);
        start = i;
        cur = c;
      }
    }
    piece(stop, n - 1, color);
  }
  ctx.restore();
}

// トノサマバッタ: 大きな からだ（みどり）。はねは ちゃいろの まだら。うしろあしの ももが ふとく、すねは あかっぽい
const locust = {
  group: 'grasshopper', level: 1, similar: ['longHeadGrasshopper', 'katydid'],
  box: [-76, -36, 70, 25],
  draw(ctx) {
    const edge = '#1a2a10';
    const green = ['#b8e08a', '#6aa848', '#2a5a1c'];
    const P = {
      edge, legColor: '#6aa848', farColor: '#3a6a28', femurTone: green, tibiaColor: '#c87a5a', tibiaW: 2.6,
      femur: [[-18, -2], [-6, -8], [12, -12.5], [26, -12.5], [28.5, -9.5], [16, -5], [-4, 2], [-16, 4]],
      femurPattern(c) {
        for (let x = -10; x < 26; x += 4) stroke(c, [[x, -10], [x + 3, -6], [x + 1, -1]], 'rgba(40,70,20,0.45)', 0.8);
      },
      hindJoints: [[27.5, -10.5], [7, 20], [-6, 22]],
      spines: 9,
    };
    farSide(ctx, (far) => {
      sideLeg(ctx, [[-34, 3], [-29, 13], [-36, 21], [-42, 22]], [2.4, 1.8, 1.2], P.farColor, edge);
      sideLeg(ctx, [[-23, 4], [-16, 13], [-22, 21], [-28, 22]], [2.4, 1.8, 1.2], P.farColor, edge);
      hopperHind(ctx, P, far);
    });
    // おなか → はね
    fill3d(ctx, [[-24, -6], [0, -4], [30, -3], [42, 0], [40, 4], [20, 6], [-10, 6], [-24, 4]], ['#c8e098', '#8ab858', '#3a6a28'], edge);
    const wing = [[-26, -15], [10, -14.5], [50, -11.5], [67, -7.5], [65, -3.5], [40, -2.5], [0, -3.5], [-24, -5]];
    fill3d(ctx, wing, ['#c8b48a', '#9a7a4e', '#5a4024'], edge, 0.7, [0.3, 0.1]);
    within(ctx, wing, () => {
      const rnd = seeded(111);
      for (let i = 0; i < 40; i++) oval(ctx, -20 + rnd() * 84, -13 + rnd() * 9, 1 + rnd() * 2.2, 0.8 + rnd() * 1.2, 'rgba(70,46,20,0.55)');
      stroke(ctx, [[-24, -12], [20, -10.5], [62, -7]], 'rgba(60,40,20,0.5)', 0.6);
      stroke(ctx, [[-24, -8], [20, -7], [60, -5]], 'rgba(60,40,20,0.4)', 0.5);
    });
    // 手前の あし
    sideLeg(ctx, [[-36, 2], [-31, 12], [-38, 20.5], [-45, 22]], [2.6, 2, 1.3], P.legColor, edge, { spines: 3, spineLen: 1 });
    sideLeg(ctx, [[-25, 3], [-18, 12.5], [-24, 20.5], [-31, 22]], [2.6, 2, 1.3], P.legColor, edge, { spines: 3, spineLen: 1 });
    hopperHind(ctx, P, false);
    // むね（せの すじが 弓の ように もりあがる）
    const pron = [[-42, -15], [-34, -18.5], [-24, -17], [-21.5, -9], [-23.5, 2], [-33, 4], [-40, 2]];
    fill3d(ctx, pron, green, edge);
    stroke(ctx, [[-42, -14.5], [-33, -18], [-24, -16.5]], 'rgba(255,255,255,0.35)', 0.8);
    stroke(ctx, [[-40, -6], [-30, -7], [-23, -5]], 'rgba(40,70,20,0.4)', 0.6);
    // あたま
    const head = [[-56, -14], [-50, -18], [-43, -16], [-39, -8], [-40, 2], [-46, 7], [-54, 5], [-58, -4]];
    fill3d(ctx, head, green, edge);
    shape(ctx, [[-57, 3], [-52, 4], [-50, 8], [-55, 9]], '#5a7a3a', edge, 0.5); // 口
    compoundEye(ctx, -49, -10, 3.4, 4.4, '#7a6a4a', 0.2);
    stroke(ctx, [[-52, -6.5], [-47, -4]], 'rgba(60,40,20,0.6)', 0.8); // めの 下の すじ
    antenna(ctx, [[-54, -15], [-60, -22], [-66, -28], [-72, -33], [-76, -35]], 1.2, 0.8, '#5a6a3a', { beads: 14, beadColor: '#4a5a2a' });
  },
};

// ショウリョウバッタ: あたまが とがって ほそながい（さきに め）。ひらたく みじかい 触角。からだが ほそく うしろあしが とても ながい
const longHeadGrasshopper = {
  group: 'grasshopper', level: 1, similar: ['locust', 'katydid'],
  box: [-100, -26, 82, 25],
  draw(ctx) {
    const edge = '#1a3010';
    const green = ['#c8f09a', '#78c050', '#2c6420'];
    const P = {
      edge, legColor: '#78c050', farColor: '#3a7028', femurTone: green, tibiaW: 1.6,
      femur: [[-26, -1], [-8, -6], [20, -11], [40, -12.5], [42, -10], [20, -6.5], [-8, 0], [-24, 2.5]],
      femurPattern(c) {
        stroke(c, [[-24, 0.5], [10, -6], [41, -11]], 'rgba(255,255,255,0.35)', 0.8);
      },
      hindJoints: [[41, -11.5], [6, 21], [-8, 22]],
      spines: 11, tarsusW: 1.3,
    };
    farSide(ctx, (far) => {
      sideLeg(ctx, [[-44, 2], [-40, 12], [-46, 21], [-52, 22]], [1.8, 1.4, 1], P.farColor, edge);
      sideLeg(ctx, [[-30, 3], [-24, 12], [-30, 21], [-36, 22]], [1.8, 1.4, 1], P.farColor, edge);
      hopperHind(ctx, P, far);
    });
    fill3d(ctx, [[-30, -4], [10, -3], [50, -2], [62, 0], [58, 3.5], [20, 4], [-20, 4.5], [-30, 3]], green, edge);
    const wing = [[-32, -10], [20, -10], [66, -6], [80, -2.5, 1], [64, -1.5], [20, -2.5], [-30, -3]];
    fill3d(ctx, wing, ['#b8e090', '#70b048', '#2c5a1c'], edge, 0.7, [0.3, 0.1]);
    within(ctx, wing, () => {
      stroke(ctx, [[-30, -7], [30, -6.5], [74, -3]], 'rgba(30,60,20,0.45)', 0.6);
      stroke(ctx, [[-30, -4.5], [30, -4.2], [70, -2.2]], 'rgba(255,255,255,0.3)', 0.6);
    });
    sideLeg(ctx, [[-46, 1], [-42, 11.5], [-48, 20.5], [-55, 22]], [2, 1.6, 1.1], P.legColor, edge);
    sideLeg(ctx, [[-32, 2], [-26, 11.5], [-32, 20.5], [-39, 22]], [2, 1.6, 1.1], P.legColor, edge);
    hopperHind(ctx, P, false);
    const pron = [[-50, -10], [-40, -11.5], [-31, -10.5], [-29, -4], [-31, 3], [-40, 4], [-48, 3]];
    fill3d(ctx, pron, green, edge);
    stroke(ctx, [[-50, -5], [-40, -5.5], [-31, -4.5]], 'rgba(255,255,255,0.45)', 0.9);
    // とがった あたま（さきに め と 触角）
    const head = [[-84, -11.5, 1], [-70, -14], [-56, -12.5], [-48, -9], [-48, 1], [-54, 4], [-66, -1], [-78, -6]];
    fill3d(ctx, head, green, edge);
    stroke(ctx, [[-82, -9], [-66, -6], [-49, -4]], 'rgba(255,255,255,0.45)', 0.9);
    compoundEye(ctx, -72, -10.5, 2.4, 3.4, '#8a9a5a', -0.3);
    // 剣のような ひらたい 触角
    fill3d(ctx, [[-83, -13], [-97, -21.5, 1], [-99, -20], [-85, -10.5]], ['#a8d880', '#68a840', '#2a5a1c'], edge, 0.6);
  },
};

// キリギリス: しょっかくが とても ながい（からだより ながい）。はねは みじかく くろい てんが ならぶ。からだは みどり
const katydid = {
  group: 'grasshopper', level: 2, similar: ['locust', 'bellCricket'],
  box: [-62, -63, 136, 25],
  draw(ctx) {
    const edge = '#1a2a10';
    const green = ['#c8e890', '#74b04a', '#2a5a1c'];
    const P = {
      edge, legColor: '#74b04a', farColor: '#3a6a28', femurTone: green, tibiaW: 1.8,
      femur: [[-14, 0], [0, -5], [20, -9], [36, -9.5], [37.5, -7], [20, -3.5], [0, 3], [-12, 4]],
      hindJoints: [[37, -8.5], [14, 21], [2, 22]],
      spines: 12, tarsusW: 1.5,
    };
    // 触角: からだの 2ばい ちかく ながく、ほそい。せなかの うえを 高く 弓なりに こえて うしろへ（2本）
    threadAntenna(ctx, [[-53, -14], [-49, -30], [-32, -45], [0, -56], [40, -61], [80, -58], [114, -49], [134, -36]], 0.9, 0.35, '#6a7a48', { alpha: 0.6 });
    threadAntenna(ctx, [[-54, -13], [-52, -26], [-40, -40], [-14, -50], [24, -54], [64, -50], [98, -40], [120, -26], [130, -12]], 1, 0.35, '#5a6a3a');
    farSide(ctx, (far) => {
      sideLeg(ctx, [[-36, 4], [-32, 13], [-40, 21], [-46, 22]], [2.2, 1.6, 1.1], P.farColor, edge, { spines: 4, spineLen: 1.2 });
      sideLeg(ctx, [[-22, 4], [-14, 13], [-20, 21], [-26, 22]], [2.2, 1.6, 1.1], P.farColor, edge, { spines: 3, spineLen: 1 });
      hopperHind(ctx, P, far);
    });
    // おなか（はねから はみだす）
    const abd = [[-22, -7], [6, -8], [26, -6], [38, -2], [40, 3], [30, 7], [6, 8], [-20, 6]];
    fill3d(ctx, abd, green, edge);
    within(ctx, abd, () => { for (let x = 0; x < 40; x += 6) stroke(ctx, [[x, -9], [x + 1, 8]], 'rgba(30,60,20,0.3)', 0.6); });
    // みじかい はね（ちゃいろ・くろい てんの ならび）
    const wing = [[-24, -12], [0, -12.5], [18, -10], [22, -6], [16, -3], [-4, -3], [-22, -5]];
    fill3d(ctx, wing, ['#c8a874', '#8e6a3e', '#4a3418'], edge, 0.7, [0.3, 0.1]);
    within(ctx, wing, () => {
      for (let i = 0; i < 7; i++) oval(ctx, -18 + i * 5.6, -7.6 + Math.sin(i) * 0.6, 1.3, 1.2, '#1c140a');
      stroke(ctx, [[-22, -10], [18, -8]], 'rgba(60,40,20,0.5)', 0.6);
    });
    sideLeg(ctx, [[-38, 3], [-34, 12], [-42, 20.5], [-48, 22]], [2.4, 1.8, 1.2], P.legColor, edge, { spines: 4, spineLen: 1.3 });
    sideLeg(ctx, [[-24, 3], [-16, 12], [-22, 20.5], [-29, 22]], [2.4, 1.8, 1.2], P.legColor, edge, { spines: 3, spineLen: 1.1 });
    hopperHind(ctx, P, false);
    // ながい むね（せなかに ちゃいろの おび）
    const pron = [[-44, -14], [-34, -15], [-22, -14], [-20, -6], [-22, 3], [-34, 4], [-42, 2]];
    fill3d(ctx, pron, green, edge);
    within(ctx, pron, () => shape(ctx, [[-46, -16], [-20, -16], [-20, -11.5], [-34, -12], [-46, -11.5]], '#7a5430'));
    const head = [[-56, -12], [-49, -16], [-43, -14], [-41, -6], [-42, 3], [-48, 8], [-55, 6], [-59, -2]];
    fill3d(ctx, head, green, edge);
    shape(ctx, [[-58, 4], [-53, 5], [-51, 9], [-56, 10]], '#5a7a3a', edge, 0.5);
    compoundEye(ctx, -50, -9, 2.6, 2.8, '#8a7a4a');
  },
};

// スズムシ（オス）: なく ときの すがた。ひろい 前ばねを せなかの 上に まっすぐ たてて、こすりあわせて「リーン」と なく。
// はねは すけて、うずのような 脈（音を ひびかせる ところ）。からだは くろ、あしは うすい いろ。
// 触角は からだの 2ばいいじょう ながく、白と くろの まだら。1本は まえへ、1本は うしろへ
const bellCricket = {
  group: 'grasshopper', level: 2, similar: ['cricket', 'katydid'],
  box: [-114, -66, 56, 24],
  draw(ctx) {
    const edge = '#000';
    const black = ['#4a4640', '#1a1814', '#050403'];
    const pale = '#d8cca8';
    const bands = ['#f4f0e6', '#1a1814', 3.2, 0.75];
    const P = {
      edge: '#3a3020', legColor: pale, farColor: '#a89a78', femurTone: ['#f0e6c8', '#cfc19a', '#8a7a58'], tibiaW: 1.6,
      femur: [[-10, 1], [2, -4], [16, -6.5], [24, -6], [24.5, -3], [14, -0.5], [0, 4], [-9, 5]],
      hindJoints: [[24, -4.5], [8, 20], [-2, 22]],
      spines: 7, tarsusW: 1.3,
    };
    // むこうの 触角（うしろへ。たてた はねの 上を こえる）
    threadAntenna(ctx, [[-44, -8], [-47, -22], [-42, -38], [-26, -52], [-2, -60], [24, -63], [52, -59]], 1, 0.35, '#c8c0a8', { bands, alpha: 0.65 });
    farSide(ctx, (far) => {
      sideLeg(ctx, [[-30, 5], [-27, 13], [-33, 21], [-38, 22]], [2, 1.5, 1], P.farColor, P.edge);
      sideLeg(ctx, [[-18, 5], [-12, 13], [-18, 21], [-24, 22]], [2, 1.5, 1], P.farColor, P.edge);
      hopperHind(ctx, P, far);
    });
    // おしりの 2本の 尾（尾毛）
    stroke(ctx, [[24, 2], [40, -1], [54, -3]], '#2a2620', 1);
    stroke(ctx, [[24, 3.5], [40, 3], [52, 3]], '#2a2620', 0.9);
    // おなか（はねを たてて いるので ふしが 見える）
    const abd = [[-22, -5], [0, -6], [22, -4], [27, 1], [24, 6], [0, 8], [-20, 6]];
    fill3d(ctx, abd, black, edge);
    within(ctx, abd, () => { for (let x = -14; x < 26; x += 5.5) stroke(ctx, [[x, -7], [x + 1, 8]], 'rgba(200,190,170,0.25)', 0.6); });
    // たてた 前ばね（むこうの 1まい → てまえの 1まい）。うちわの ような まるい かたち
    const wing = [[-21, -6], [-25, -16], [-22, -29], [-11, -39], [5, -43], [18, -38], [26, -27], [27, -15], [21, -6], [12, -4]];
    const drawWing = (dx, dy, a) => {
      ctx.save();
      ctx.translate(dx, dy);
      const w = wing;
      shape(ctx, w, `rgba(46,40,32,${a})`, '#14100a', 0.8);
      within(ctx, w, () => {
        ctx.fillStyle = vgrad(ctx, -44, -6, ['rgba(230,220,200,0.32)', 'rgba(230,220,200,0.08)']);
        ctx.fillRect(-30, -46, 60, 44);
        // つけねから ひろがる 脈と、うずのように まがる 脈（ハープと よばれる ところ）
        for (const [x, y] of [[-24, -20], [-17, -35], [-2, -42], [14, -40], [24, -29], [26, -16]]) stroke(ctx, [[-14, -7], [(x - 14) / 2, (y - 7) / 2 - 3], [x, y]], 'rgba(20,16,10,0.7)', 0.6);
        for (const r of [10, 17, 24, 31]) stroke(ctx, [[-14 - r * 0.45, -7 - r * 0.4], [-14 + r * 0.05, -7 - r * 0.85], [-14 + r * 0.7, -7 - r * 0.8], [-14 + r * 1.15, -7 - r * 0.3]], 'rgba(20,16,10,0.55)', 0.5);
        // 鏡（まるく すきとおった ところ）
        oval(ctx, 9, -28, 7.5, 6.5, 'rgba(240,235,220,0.18)', 'rgba(20,16,10,0.6)', 0.5, 0.4);
      });
      ctx.restore();
    };
    drawWing(5, -3, 0.5);
    drawWing(0, 0, 0.62);
    sideLeg(ctx, [[-32, 4], [-29, 12], [-35, 20.5], [-41, 22]], [2.2, 1.7, 1.1], pale, P.edge);
    sideLeg(ctx, [[-20, 4], [-14, 12], [-20, 20.5], [-27, 22]], [2.2, 1.7, 1.1], pale, P.edge);
    hopperHind(ctx, P, false);
    const pron = [[-34, -11], [-24, -12], [-20, -6], [-21, 4], [-30, 5], [-35, 2]];
    fill3d(ctx, pron, black, edge);
    // 小さめの あたま
    const head = ell(-40, -2, 6.5, 7.5, 22);
    fill3d(ctx, head, black, edge);
    compoundEye(ctx, -42, -5, 1.8, 2.2, '#3a3428');
    gloss(ctx, head, -42, -6, 5, 0.25);
    // てまえの 触角（まえへ ながく）
    threadAntenna(ctx, [[-45, -7], [-56, -14], [-70, -20], [-86, -22], [-100, -20], [-112, -14]], 1.1, 0.4, '#d8d0b8', { bands });
  },
};

// エンマコオロギ: あたまが おおきく まるい。めの 上に クリームいろの まゆ。つやの ある こげちゃ
const cricket = {
  group: 'grasshopper', level: 1, similar: ['bellCricket', 'locust'],
  box: [-60, -40, 90, 24],
  draw(ctx) {
    const edge = '#0a0604';
    const brown = ['#6a4a30', '#3a2414', '#100804'];
    const P = {
      edge, legColor: '#5a3a20', farColor: '#3a2414', femurTone: ['#8a6440', '#5a3a1e', '#2a1808'], tibiaW: 2,
      femur: [[-12, 2], [0, -5], [14, -8.5], [24, -8], [25, -5], [14, -1], [0, 5], [-10, 6]],
      femurPattern(c) {
        for (let x = -6; x < 24; x += 4) stroke(c, [[x, -6], [x + 2.5, -3], [x + 1, 2]], 'rgba(20,10,4,0.4)', 0.7);
      },
      hindJoints: [[24.5, -6], [9, 20], [-2, 22]],
      spines: 7, tarsusW: 1.5,
    };
    // 触角: こげちゃで ねもとが ふとい。からだの 1.5ばいほど、せなかに そって ひくく うしろへ（2本）
    threadAntenna(ctx, [[-51, -11], [-47, -23], [-34, -32], [-10, -37], [22, -38], [54, -35], [84, -29]], 1.6, 0.45, '#24160a', { alpha: 0.6 });
    threadAntenna(ctx, [[-52, -10], [-50, -19], [-41, -26], [-20, -29], [10, -29], [40, -25], [66, -19], [88, -13]], 1.8, 0.45, '#2a1a0c');
    farSide(ctx, (far) => {
      sideLeg(ctx, [[-34, 6], [-31, 14], [-37, 21], [-42, 22]], [2.4, 1.8, 1.1], P.farColor, edge);
      sideLeg(ctx, [[-22, 6], [-16, 14], [-22, 21], [-28, 22]], [2.4, 1.8, 1.1], P.farColor, edge);
      hopperHind(ctx, P, far);
    });
    stroke(ctx, [[24, 1], [42, -2], [56, -4]], '#3a2414', 1.1);
    stroke(ctx, [[24, 3], [42, 3], [54, 3]], '#3a2414', 1);
    fill3d(ctx, [[-24, -4], [0, -5], [22, -3], [27, 1], [24, 7], [0, 9], [-22, 7]], brown, edge);
    const wing = [[-26, -9], [-4, -11], [16, -10], [24, -6], [22, -2.5], [-4, -2.5], [-24, -4]];
    fill3d(ctx, wing, ['#9a7a54', '#6a4a2a', '#2e1c0c'], edge, 0.7, [0.3, 0.1]);
    within(ctx, wing, () => {
      for (const k of [0, 1, 2]) stroke(ctx, [[-22, -8.5 + k * 2], [0, -9 + k * 2], [20, -7 + k * 1.6]], 'rgba(30,16,6,0.5)', 0.6);
    });
    sideLeg(ctx, [[-36, 5], [-33, 13], [-39, 20.5], [-45, 22]], [2.6, 2, 1.2], P.legColor, edge);
    sideLeg(ctx, [[-24, 5], [-18, 13], [-24, 20.5], [-31, 22]], [2.6, 2, 1.2], P.legColor, edge);
    hopperHind(ctx, P, false);
    const pron = [[-38, -11], [-27, -12], [-22, -6], [-23, 6], [-33, 7], [-38, 3]];
    fill3d(ctx, pron, ['#5a4028', '#2e1c0c', '#0a0604'], edge);
    // 大きく まるい あたま（めの 上に クリームいろの まゆ）
    const head = ell(-46, -2, 10, 10.5, 24);
    fill3d(ctx, head, ['#5a4028', '#24160a', '#060302'], edge);
    compoundEye(ctx, -49, -3, 2.6, 3.4, '#2a2018');
    stroke(ctx, [[-54, -6], [-51, -9], [-46, -9.5], [-41, -7]], '#efe0b0', 1.6);
    stroke(ctx, [[-50, -10.5], [-44, -11.8]], 'rgba(239,224,176,0.7)', 1);
    gloss(ctx, head, -49, -7, 8, 0.3);
    shape(ctx, [[-56, 4], [-51, 5], [-50, 9], [-55, 9.5]], '#3a2414', edge, 0.5);
  },
};

// オオカマキリ: まえあしが かま。むね（くびの ように 見える）が ほそながい。三角の あたまに 大きな め
const mantis = {
  group: 'mantis', level: 1, similar: ['stickInsect', 'longHeadGrasshopper'],
  box: [-70, -48, 78, 25],
  draw(ctx) {
    const edge = '#1a3010';
    const green = ['#c8f0a0', '#76b84c', '#2a5a1c'];
    const legC = '#6aa844';
    const far = '#3a6a28';
    // むこうがわの 中・後あし
    farSide(ctx, () => {
      sideLeg(ctx, [[-6, 3], [-14, 10], [-22, 21], [-28, 22]], [1.8, 1.4, 1], far, edge);
      sideLeg(ctx, [[4, 4], [20, 10], [34, 21], [40, 22]], [1.8, 1.4, 1], far, edge);
    });
    // おなか と はね（はねは おなかの 上に たたむ）
    fill3d(ctx, [[-8, -3], [20, -5], [50, -4], [70, 0], [66, 6], [40, 7], [10, 6], [-8, 4]], ['#b8e090', '#6aa848', '#2a5a1c'], edge);
    const wing = [[-10, -6], [20, -8.5], [52, -7.5], [74, -3, 1], [56, -1], [20, -1], [-8, -1]];
    fill3d(ctx, wing, ['#c8f0a8', '#7ec058', '#3a6a24'], edge, 0.7, [0.3, 0.1]);
    within(ctx, wing, () => {
      stroke(ctx, [[-8, -5], [30, -6.5], [70, -3]], 'rgba(30,60,20,0.45)', 0.6);
      shape(ctx, [[-10, -7], [40, -9], [72, -3.5], [60, -5.5], [30, -7.5], [-8, -5.5]], 'rgba(110,80,40,0.45)'); // まえの ふちは ちゃいろっぽい
    });
    // 手前の 中・後あし
    sideLeg(ctx, [[-6, 2], [-15, 9], [-24, 20.5], [-31, 22]], [2, 1.5, 1.1], legC, edge);
    sideLeg(ctx, [[4, 3], [21, 9], [35, 20.5], [43, 22]], [2, 1.5, 1.1], legC, edge);
    // ほそながい まえの むね（ななめ 上へ）
    const pro = [[-12, 0], [-14, -5], [-30, -18], [-46, -29], [-50, -26], [-36, -13], [-18, 3]];
    fill3d(ctx, pro, green, edge);
    // かま（つけね → もも〔とげ〕→ すね を たたむ）
    const coxa = [[-42, -24], [-46, -20], [-46, -6], [-41, -4], [-38, -10]];
    fill3d(ctx, coxa, green, edge);
    const femur = [[-44, -6], [-48, -9], [-62, -20], [-66, -19], [-58, -9], [-46, -2]];
    fill3d(ctx, femur, green, edge);
    for (let i = 0; i < 6; i++) {
      const x = -47 - i * 3;
      const y = -4 - i * 2.4;
      stroke(ctx, [[x, y], [x + 1.6, y + 2.4]], '#2a3a18', 0.7, false);
    }
    const tibia = [[-64, -19], [-60, -22], [-48, -12], [-47, -8.5], [-52, -10]];
    fill3d(ctx, tibia, green, edge);
    // 三角の あたま（上の かどに 大きな め）
    const head = [[-56, -38], [-45, -36], [-42, -31], [-46, -25], [-52, -22], [-57, -28]];
    fill3d(ctx, head, green, edge);
    compoundEye(ctx, -52, -35, 3.6, 3.6, '#a0c870');
    stroke(ctx, [[-52, -38], [-60, -44], [-70, -46]], '#5a7a3a', 0.7);
    stroke(ctx, [[-50, -38], [-56, -45], [-64, -48]], '#5a7a3a', 0.6);
  },
};

// ナナフシモドキ: えだの ような からだ。はねが ない。触角は まえあしより みじかい（上から 見た すがた・あたまが 左）
const stickInsect = {
  group: 'stick', level: 2, similar: ['mantis', 'longHeadGrasshopper'],
  box: [-148, -50, 104, 50],
  draw(ctx) {
    const edge = '#2a3a14';
    const body = ['#b8cc78', '#7a9440', '#3a4a1c'];
    const legC = '#7a9440';
    // 上下（左右の あし）に 同じものを
    const pair = (fn) => {
      fn();
      ctx.save();
      ctx.scale(1, -1);
      fn();
      ctx.restore();
    };
    pair(() => {
      // まえあしは まえへ まっすぐ（触角と そろえる）、中・後あしは ひろげる
      leg(ctx, [[-88, 1.5], [-104, 4.5], [-136, 4], [-146, 3.5]], [2, 1.4, 1], legC, edge, { tarsi: 4, claw: 1.2 });
      leg(ctx, [[-44, 1.5], [-36, 22], [-54, 38], [-60, 44]], [2, 1.5, 1], legC, edge, { tarsi: 4, claw: 1.2 });
      leg(ctx, [[-18, 1.5], [0, 26], [-10, 42], [-14, 48]], [2, 1.5, 1], legC, edge, { tarsi: 4, claw: 1.2 });
      // みじかい 触角
      antenna(ctx, [[-100, 1], [-108, 3.2], [-116, 4.8], [-122, 5.6]], 0.9, 0.6, '#5a6a2a', { beads: 8 });
    });
    // からだ（ふしごとに すこし ふくらむ）
    const half = [[-102, 0], [-101, 2.8], [-95, 3], [-92, 2], [-88, 2.6], [-80, 2], [-44, 2.4], [-40, 2], [-16, 2.8], [-12, 2.2], [20, 2.4], [60, 2.2], [90, 1.8], [100, 1.2], [104, 0]];
    const pts = half.concat(half.slice(1, -1).reverse().map(([x, y]) => [x, -y]));
    fill3d(ctx, pts, body, edge, 0.7, [0.3, 0.2]);
    within(ctx, pts, () => {
      for (let x = -12; x < 100; x += 10) stroke(ctx, [[x, -3], [x, 3]], 'rgba(40,50,20,0.4)', 0.5, false);
      stroke(ctx, [[-100, -0.6], [100, -0.6]], 'rgba(255,255,255,0.25)', 0.6, false);
    });
    oval(ctx, -98, -2.2, 1.4, 1.2, '#4a4a2a');
    oval(ctx, -98, 2.2, 1.4, 1.2, '#4a4a2a');
  },
};

export const SPECIES = {
  rhinoBeetle,
  hercules,
  giantStag,
  flatStag,
  sawStag,
  miyamaStag,
  rainbowStag,
  jewelBeetle,
  rosalia,
  firefly,
  ladybug,
  tigerBeetle,
  brownCicada,
  greenCicada,
  slimCicada,
  goldenRinged,
  emperorDragonfly,
  skimmer,
  redDragonfly,
  swallowtail,
  cabbageWhite,
  purpleEmperor,
  honeybee,
  locust,
  longHeadGrasshopper,
  katydid,
  bellCricket,
  cricket,
  mantis,
  stickInsect,
};

// 見分けポイントの 印の 場所（v0.19.3。ずかんの 詳細ページで 絵の 上に 番号を つける）。
// 文字（js/i18n/zukan/insect.js の marks）と 同じ じゅん・同じ 数。絵の 座標で、からだ ぜんたいの ことは からだの まんなか。
// 3つめの 数は 番号を 右（1）／左（-1）の どちらに 出すか（なければ 絵の まんなかより 右か 左かで きめる）。
// 左右が 同じ 形の むしは 左がわの 点を つかって 番号を 左右に わけ、かさならない ように する
export const MARK_POINTS = {
  rhinoBeetle: [[7, -93], [3, -32], [-14, 40]],
  hercules: [[3, -135], [-6, -95], [19, 52]],
  giantStag: [[-19, -36], [11, -61], [24.5, 0], [-12, 42]],
  flatStag: [[-16, 36], [13, -74], [11, -54]],
  sawStag: [[18, -67], [-12, 36], [20, -31]],
  miyamaStag: [[32, -30], [-12, 36], [12, -88], [31, 12]],
  rainbowStag: [[-12, 30], [21, -72], [23, -10]],
  jewelBeetle: [[2, 60], [-9, 0], [14, -65]],
  rosalia: [[-5, -28], [8, 12], [34, -66]],
  firefly: [[8, -28], [-8, 14], [0, 51]],
  ladybug: [[21, 13], [0, -11], [18, -19]],
  tigerBeetle: [[-4, -21], [8, 22], [10.5, -35]],
  brownCicada: [[-44, 2], [62, -6], [82, 6], [-5, 26]],
  greenCicada: [[40, -7], [-10, -3], [-5, 30]],
  slimCicada: [[74, 3], [-4, 36], [-7, -4]],
  goldenRinged: [[-3, 40], [0, -64], [18, -6], [-6, -36]],
  emperorDragonfly: [[-6, -30], [-3, -1], [3, 44], [18, -4]],
  skimmer: [[-4, 14], [2, 52], [-6, -25], [18, -2]],
  redDragonfly: [[-3, 26], [-6, -22], [12, -8]],
  swallowtail: [[44, -26], [-18, -14], [44, 60]],
  cabbageWhite: [[-30, -18], [52, -37], [27, 4]],
  purpleEmperor: [[30, -16], [-62, -32], [14, 46]],
  honeybee: [[-4, -9], [-4, 20], [44, -22]],
  locust: [[-32, -6], [30, -9], [14, -7]],
  longHeadGrasshopper: [[-78, -8], [-92, -16], [24, -8]],
  katydid: [[24, -54], [-4, -8, 1], [-32, -4]],
  bellCricket: [[2, -28], [14, -3], [-84, -21]],
  cricket: [[-42, 4], [-48, -9], [2, -6, 1], [24, -29]],
  mantis: [[-58, -13], [-32, -14], [-50, -30]],
  stickInsect: [[40, 0], [-30, 0], [-112, 3.5]],
};
for (const [id, pts] of Object.entries(MARK_POINTS)) SPECIES[id].marks = pts;
