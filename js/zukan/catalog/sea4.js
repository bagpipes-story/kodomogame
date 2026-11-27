// catalog/sea4.js — うみの ずかん画 その4: エビ カニ 4種・イカ タコ かい 4種・ウニ ヒトデ クラゲ 3種（v0.20.6。30種を 足して 60種に）
// 描く 部品（fish・fin・snake・volume など）は sea.js の ものを 使う。きまりも 同じ:
// - かわいさより「その種類だと 見分けられる」こと。見分けポイント（i18n/zukan/sea.js の marks）を 先に 決めて その とおりに 描く
// - まず すがたと 比率（あたまの 大きさ・ひれの 位置・からだの 太さ）を その 種類らしく。ぬりや 細部は その あと
// - 形を べつべつに かさねて つなぎめに 線を 出さない（ひとつづきの りんかくに する）
// - オスと メスで ちがう 種類は オスを 描く。同じ なかまでも 形を 使いまわさない
// なかま（GROUPS）と タブ（ORDERS）は sea.js。registry.js が 4つの ファイルを 1つに まとめる

import {
  PI, sym, ell, trace, shape, stroke, disc, oval, within, both,
  vgrad, hgrad, lgrad, rgrad, gloss, limb, seeded, fill3d, bbox, resample,
} from '../draw.js';
import {
  mirrorY, bothY, sprinkle, volume, fur, edgeY, shadedBody, scales, fin, eye, snake, fish, eelBody, ribbonFin,
} from './sea.js';

// ---------- 部品 ----------

// とげ（つけね (x, y) から ang の むきへ len だけ のびる 三角）
function thorn(ctx, x, y, ang, len, w, fill, edge, lw = 0.3) {
  const cx = Math.cos(ang);
  const sy = Math.sin(ang);
  shape(ctx, [[x - sy * w, y + cx * w], [x + cx * len, y + sy * len, 1], [x + sy * w, y - cx * w]], fill, edge, lw);
}

// ふしの ふち（a→b）に ならぶ とげ。sides = どちらの ふちか（1 = 進む むきの 左、-1 = 右）。先の ほうへ すこし かたむく
function thorns(ctx, a, b, wa, wb, n, len, fill, edge, seed, sides = [1, -1]) {
  const rnd = seeded(seed);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  for (const side of sides) {
    const nx = uy * side;
    const ny = -ux * side;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5 + (rnd() - 0.5) * 0.4) / n;
      const w = (wa + (wb - wa) * t) / 2 - 0.4;
      const x = a[0] + dx * t + nx * w;
      const y = a[1] + dy * t + ny * w;
      const l = len * (0.8 + rnd() * 0.4);
      thorn(ctx, x, y, Math.atan2(ny + uy * 0.5, nx + ux * 0.5), l, len * 0.42, fill, edge);
    }
  }
}

// とがった つめ（あしの 先の ふし）。a（はば w）→ 先 b。bend = まがる むきと 強さ
function dactyl(ctx, a, b, w, fill, edge, bend = 0.14) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  const m = [a[0] + dx * 0.55 + nx * L * bend, a[1] + dy * 0.55 + ny * L * bend];
  shape(ctx, [[a[0] + nx * w / 2, a[1] + ny * w / 2], [m[0] + nx * w * 0.26, m[1] + ny * w * 0.26], [b[0], b[1], 1], [m[0] - nx * w * 0.26, m[1] - ny * w * 0.26], [a[0] - nx * w / 2, a[1] - ny * w / 2]], fill, edge, 0.4);
}

// ふしの ある あし（上から 見た カニ）。pts = 関節の 点、ws = ふしの つけねの 太さ（さいごの ふしは とがった つめ）。
// 先の ふしから 描いて、つけねがわの ふしが 上に かさなる。spine = とげの 数（ふしごと）
function jointLeg(ctx, pts, ws, fill, edge, { spine = null, spineLen = 2, spineFill = null, seed = 1, bend = 0.14, hi = 'rgba(255,238,220,0.17)', sides = [1, -1] } = {}) {
  const n = pts.length - 1;
  for (let i = n - 1; i >= 0; i--) {
    const a = pts[i];
    const b = pts[i + 1];
    const wa = ws[i];
    const wb = i === n - 1 ? 0 : Math.min(ws[i], ws[i + 1] + (ws[i] - ws[i + 1]) * 0.3);
    if (i === n - 1) {
      dactyl(ctx, a, b, wa, fill, edge, bend);
      continue;
    }
    if (spine && spine[i]) thorns(ctx, a, b, wa, wb, spine[i], spineLen, spineFill ?? fill, edge, seed * 10 + i, sides);
    limb(ctx, a, b, wa, wb, fill, edge, 0.45);
    // 上の 面の 光（左上から）
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    let nx = -dy / L;
    let ny = dx / L;
    if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }
    stroke(ctx, [[a[0] + dx * 0.12 + nx * wa * 0.2, a[1] + dy * 0.12 + ny * wa * 0.2], [a[0] + dx * 0.88 + nx * wb * 0.2, a[1] + dy * 0.88 + ny * wb * 0.2]], hi, Math.max(0.5, wa * 0.2), false);
  }
}

// ---------- エビ・カニ ----------

// タラバガニ（オス・上から・前が 上）: カニでは なく ヤドカリの なかま。見える あしは はさみあしを 入れて 4つい＝8本
// （5つい目は 小さく、こうらの 中に かくれて えらを そうじする）。こうらは うしろが ひろい ハート〜洋なし形で とげだらけ。
// こうらの まんなか（心ぞうの ところ）に とげが 6つ（にた アブラガニは 4つ）。右の はさみが 左より 大きい。あしは 太く、とげが ならぶ。
// 生きて いる ときは くらい あかむらさき（ゆでると 赤く なる）
// v0.20.7（作りなおし）: 前の 絵は あしが とげつきの 棒、はさみが ミトンの ような 形で、こうらも のっぺり して いた。
// あしは ふし（長い ふし → みじかい ふし → 長い ふし → まがった つめ）ごとに 形を 作り、ふしの あいだに うすい 色の まく、
// ふちの とげは ふしと ひとつづき、せなかがわの とげは 上から 見た 円すい（まるい つけねと あかるい 先）で 描く。
// はさみは 手の ひらと 2本の ゆび（先は くろっぽい）。こうらは みぞで 分かれた ふくらみ（胃・心ぞう・えらの ところ）を 描く
const kingcrab = {
  group: 'hermit', level: 2, similar: ['crab', 'swimmingcrab', 'hermitcrab'],
  box: [-93, -64, 93, 68],
  draw(ctx) {
    const edge = '#2a0a10';
    const skin = rgrad(ctx, -30, -44, 160, ['#e6a088', '#b04a44', '#7c2630', '#551820']);
    const unit = (a, b) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      return [dx / l, dy / l, l];
    };
    // 上から 見た 円すいの とげ（まるい つけねの かげ → あかるい 円すい → 先の 光）
    const bump = (x, y, r) => {
      disc(ctx, x + r * 0.16, y + r * 0.2, r, 'rgba(58,10,18,0.6)');
      disc(ctx, x - r * 0.1, y - r * 0.12, r * 0.74, '#dc9480');
      disc(ctx, x - r * 0.26, y - r * 0.3, r * 0.3, 'rgba(255,238,224,0.9)');
    };
    // ふちの とげ（つけね → 先。先は くろっぽい）
    const spine = (bx, by, dx, dy, len, w) => {
      const px = -dy;
      const py = dx;
      shape(ctx, [[bx - px * w - dx * 0.6, by - py * w - dy * 0.6], [bx + dx * len, by + dy * len, 1], [bx + px * w - dx * 0.6, by + py * w - dy * 0.6]], skin, edge, 0.35);
      stroke(ctx, [[bx + dx * len * 0.5, by + dy * len * 0.5], [bx + dx * len * 0.94, by + dy * len * 0.94]], 'rgba(44,8,14,0.7)', w * 0.6, false);
    };
    const segPoly = (a, b, wa, wb) => {
      const [ux, uy] = unit(a, b);
      const nx = -uy;
      const ny = ux;
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const wm = ((wa + wb) / 2) * 1.08;
      return [
        [a[0] + (nx * wa) / 2, a[1] + (ny * wa) / 2], [m[0] + (nx * wm) / 2, m[1] + (ny * wm) / 2], [b[0] + (nx * wb) / 2, b[1] + (ny * wb) / 2],
        [b[0] + ux * wb * 0.32, b[1] + uy * wb * 0.32],
        [b[0] - (nx * wb) / 2, b[1] - (ny * wb) / 2], [m[0] - (nx * wm) / 2, m[1] - (ny * wm) / 2], [a[0] - (nx * wa) / 2, a[1] - (ny * wa) / 2],
        [a[0] - ux * wa * 0.3, a[1] - uy * wa * 0.3],
      ];
    };
    // ふし 1つ（a → b）。nSp = ふちの とげの 数、top = せなかがわの とげの 数
    const seg = (a, b, wa, wb, seed, nSp = 3, spLen = 3, top = 3) => {
      const [ux, uy, len] = unit(a, b);
      const nx = -uy;
      const ny = ux;
      const r = seeded(seed);
      for (const sd of [1, -1]) {
        for (let k = 0; k < nSp; k++) {
          const f = (k + 0.55 + r() * 0.3) / (nSp + 0.3);
          const w = wa + (wb - wa) * f;
          spine(a[0] + ux * len * f + nx * sd * w * 0.48, a[1] + uy * len * f + ny * sd * w * 0.48, nx * sd * 0.8 + ux * 0.6, ny * sd * 0.8 + uy * 0.6, spLen * (0.8 + r() * 0.4), 1.2);
        }
      }
      const poly = segPoly(a, b, wa, wb);
      shape(ctx, poly, skin, null);
      within(ctx, poly, () => {
        // まるみ: 光（左上）の 来ない ふちを くらく、来る ふちを あかるく
        for (const sd of [1, -1]) {
          const lit = nx * sd * -0.5 + ny * sd * -0.86;
          const e0 = [a[0] + (nx * sd * wa) / 2, a[1] + (ny * sd * wa) / 2];
          const e1 = [b[0] + (nx * sd * wb) / 2, b[1] + (ny * sd * wb) / 2];
          const wide = (wa + wb) / 2;
          if (lit > 0) stroke(ctx, [e0, e1], 'rgba(255,220,198,0.2)', wide * 0.5, false);
          else {
            stroke(ctx, [e0, e1], 'rgba(40,6,12,0.2)', wide * 0.9, false);
            stroke(ctx, [e0, e1], 'rgba(40,6,12,0.22)', wide * 0.45, false);
          }
        }
        // こまかい つぶ
        for (let k = 0; k < len * 0.9; k++) {
          const f = r();
          const g = (r() - 0.5) * 0.8;
          const w = wa + (wb - wa) * f;
          disc(ctx, a[0] + ux * len * f + nx * g * w, a[1] + uy * len * f + ny * g * w, 0.28 + r() * 0.2, r() < 0.5 ? 'rgba(255,224,206,0.3)' : 'rgba(50,8,14,0.3)');
        }
      });
      shape(ctx, poly, null, edge, 0.45);
      for (let k = 0; k < top; k++) {
        const f = (k + 0.7) / (top + 0.5);
        const w = wa + (wb - wa) * f;
        const g = (k % 2 ? 0.14 : -0.12) + (r() - 0.5) * 0.1;
        bump(a[0] + ux * len * f + nx * g * w, a[1] + uy * len * f + ny * g * w, 0.9 + w * 0.05);
      }
    };
    // ふしと ふしの あいだの うすい 色の まく
    const joint = (p, w) => disc(ctx, p[0], p[1], w * 0.42, '#f0c4a2', edge, 0.3);
    // つめ（先の ふし。まがって とがり、先は くろっぽい）
    const dactyl = (a, b, w, bend) => {
      const [ux, uy, len] = unit(a, b);
      const nx = -uy;
      const ny = ux;
      const m = [a[0] + ux * len * 0.55 + nx * bend, a[1] + uy * len * 0.55 + ny * bend];
      const poly = [[a[0] + (nx * w) / 2, a[1] + (ny * w) / 2], [m[0] + nx * w * 0.3, m[1] + ny * w * 0.3], [b[0], b[1], 1], [m[0] - nx * w * 0.3, m[1] - ny * w * 0.3], [a[0] - (nx * w) / 2, a[1] - (ny * w) / 2], [a[0] - ux * w * 0.25, a[1] - uy * w * 0.25]];
      shape(ctx, poly, skin, null);
      within(ctx, poly, () => {
        ctx.fillStyle = rgrad(ctx, b[0], b[1], len * 0.62, ['rgba(30,6,10,0.95)', 'rgba(30,6,10,0.8)', 'rgba(30,6,10,0)']);
        ctx.fillRect(b[0] - len, b[1] - len, len * 2, len * 2);
        stroke(ctx, [a, m], 'rgba(255,220,198,0.25)', w * 0.25, false);
      });
      shape(ctx, poly, null, edge, 0.45);
    };
    // あるく あし 1ぽん: [つけね, ふし1, ふし2, ふし3, つめの 先] と 太さ
    const leg = (J, W, seed, bend) => {
      seg(J[0], J[1], W[0], W[1], seed, 4, 3.3, 4);
      joint(J[1], W[1]);
      seg(J[1], J[2], W[1] * 0.92, W[2], seed + 1, 2, 2.8, 2);
      joint(J[2], W[2]);
      seg(J[2], J[3], W[2] * 0.94, W[3], seed + 2, 4, 2.6, 3);
      joint(J[3], W[3]);
      dactyl(J[3], J[4], W[3] * 0.9, bend);
    };
    const R = [
      { J: [[15, 13], [36, 31], [43, 39], [55, 54], [58, 65]], W: [9.2, 8.4, 7.2, 5], bend: -1.6 },
      { J: [[21, 3], [52, 3], [63, 5], [80, 15], [89, 25]], W: [9.8, 9, 7.6, 5.2], bend: -1.6 },
      { J: [[18, -10], [42, -29], [51, -35], [68, -42], [81, -41]], W: [9.4, 8.6, 7.4, 5], bend: -1.4 },
    ];
    // 左がわ: 右を うつして、すこしずつ ずらす（左右が ぴったり 同じだと かたく 見える）
    const tweak = [
      [[0, 0], [1, 1], [1, 2], [3, 0], [5, -1]],
      [[0, 0], [0, -2], [0, -3], [2, -6], [3, -8]],
      [[0, 0], [-1, 2], [-1, 2], [-3, 4], [-4, 7]],
    ];
    const Lf = R.map((l, i) => ({ J: l.J.map(([x, y], k) => [-x - tweak[i][k][0], y + tweak[i][k][1]]), W: l.W, bend: -l.bend }));
    [R[0], Lf[0], R[1], Lf[1], R[2], Lf[2]].forEach((l, i) => leg(l.J, l.W, 900 + i * 7, l.bend));
    // はさみあし（右が 大きい）。W = 手くび、F = ゆびの 先、k = 大きさ
    const chela = (W, F, k) => {
      const [ux, uy] = unit(W, F);
      let nx = -uy;
      let ny = ux;
      if (nx * W[0] > 0) { nx = -nx; ny = -ny; } // n = からだの まんなかの ほう（うごく ゆびの がわ）
      const G = ([l, w, sharp]) => {
        const q = [W[0] + (ux * l + nx * w) * k, W[1] + (uy * l + ny * w) * k];
        if (sharp) q.push(1);
        return q;
      };
      const palm = [[0, -3.9], [4, -5.1], [9, -5.2], [13, -4.6], [17.4, -3.2], [21, -1.6], [23.4, 0.3, 1], [20.4, 0.5], [16.4, -0.1], [12.6, 0.1, 1], [11, 2.4], [9.6, 4.7], [5, 5], [0, 3.9], [-1.6, 0]].map(G);
      const finger = [[9.8, 4.4], [13.4, 5.3], [17.4, 4.7], [20.8, 3.1], [22.8, 1.2, 1], [19.6, 1.4], [16, 1.3], [12.8, 0.7], [10.6, 1.8]].map(G);
      const tips = (poly, tip) => within(ctx, poly, () => {
        const [tx, ty] = G(tip);
        ctx.fillStyle = rgrad(ctx, tx, ty, 6.4 * k, ['rgba(26,6,10,0.95)', 'rgba(26,6,10,0.85)', 'rgba(26,6,10,0)']);
        ctx.fillRect(tx - 8 * k, ty - 8 * k, 16 * k, 16 * k);
      });
      // 手の ひらの ふちの とげ
      for (const [l, w, d] of [[3, -4.6, -1], [8, -5.2, -1], [13, -4.6, -1], [4, 4.8, 1], [8.6, 5, 1]]) {
        const [bx, by] = G([l, w * 0.92]);
        spine(bx, by, nx * d * 0.85 + ux * 0.52, ny * d * 0.85 + uy * 0.52, 2.4 * k, 1.1 * k);
      }
      shape(ctx, finger, skin, null);
      tips(finger, [22.8, 1.2]);
      shape(ctx, finger, null, edge, 0.45);
      shape(ctx, palm, skin, null);
      tips(palm, [23.4, 0.3]);
      within(ctx, palm, () => {
        stroke(ctx, [G([1, 3.6]), G([9, 4.4])], 'rgba(40,6,12,0.22)', 3 * k, false);
        stroke(ctx, [G([1, -2.6]), G([12, -3.4]), G([19, -1.6])], 'rgba(255,220,198,0.22)', 1.6 * k);
      });
      shape(ctx, palm, null, edge, 0.45);
      // ゆびの かみあう ふちの 白い 歯
      for (const l of [14, 16.4, 18.8]) {
        const [x, y] = G([l, 0.05]);
        disc(ctx, x, y, 0.5 * k, '#f6e8d8', 'rgba(40,10,14,0.6)', 0.2);
      }
      const [hx, hy] = G([10.4, 3.2]);
      disc(ctx, hx, hy, 1 * k, '#f0c4a2', edge, 0.3);
      for (const [l, w] of [[3.4, -1.4], [7.4, 1.2], [8.6, -2.4], [12.6, -2]]) {
        const [x, y] = G([l, w]);
        bump(x, y, 1 * k);
      }
    };
    const arm = (J, W, F, k, seed) => {
      seg(J[0], J[1], W[0], W[1], seed, 3, 2.8, 2);
      joint(J[1], W[1]);
      seg(J[1], J[2], W[1], W[2], seed + 1, 2, 2.6, 2);
      joint(J[2], W[2]);
      chela(J[2], F, k);
    };
    // 目（みじかい えの 先）と ひげ。こうらの 前の ふちの 下から 出る
    for (const sd of [1, -1]) {
      stroke(ctx, [[sd * 5.6, -24], [sd * 6.8, -31], [sd * 6, -38.4]], 'rgba(96,30,34,0.95)', 0.55);
      stroke(ctx, [[sd * 1.6, -25], [sd * 2.2, -31]], 'rgba(96,30,34,0.95)', 0.5);
      stroke(ctx, [[sd * 3.2, -23], [sd * 4.5, -27.8]], edge, 2);
      stroke(ctx, [[sd * 3.2, -23], [sd * 4.5, -27.8]], '#b04a44', 1.2);
      oval(ctx, sd * 4.8, -28.8, 1.6, 1.25, '#120608', 'rgba(230,180,160,0.6)', 0.3, sd * 0.4);
      disc(ctx, sd * 4.4, -29.2, 0.36, 'rgba(255,255,255,0.75)');
    }
    arm([[-9, -18], [-18.4, -29.4], [-17.4, -37.4]], [6.8, 6.6, 6.9], [-8.2, -52.6], 0.78, 951);
    arm([[9, -18], [20, -31], [19, -41]], [8, 7.7, 8.3], [7, -61], 1, 955);
    // こうら（前の まんなかに とげ、ふちに とげが ならぶ。うしろが ひろい）
    const cara = sym([[0, -26.6, 1], [1.8, -23.6], [4, -22.4], [6.6, -24.8, 1], [8, -21.4], [11.4, -20.4], [13.6, -23.2, 1], [14.6, -19], [18, -15.4], [21.2, -16.8, 1], [21, -12.4], [23.6, -7], [27, -7.6, 1], [25.6, -2.6], [26.6, 3], [29.8, 3.8, 1], [27, 7.6], [25.6, 12.6], [28, 15.2, 1], [23.6, 16.6], [19.6, 20.4], [20.6, 23.8, 1], [16, 22.4], [10.6, 24], [10.4, 27.2, 1], [6.6, 24.8], [0, 25.2]]);
    shape(ctx, cara, skin, null);
    within(ctx, cara, () => {
      // ふくらみ（胃・心ぞう・左右の えら・うしろ）の 光
      for (const [x, y, r, al] of [[-2, -15, 10, 0.2], [-16, 1, 13, 0.2], [13, 2, 13, 0.14], [-1, 3, 7, 0.2], [-1, 18, 6, 0.14]]) {
        ctx.fillStyle = rgrad(ctx, x, y, r, [`rgba(255,226,206,${al})`, 'rgba(255,226,206,0)']);
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // みぞ（ふくらみの さかい）
      const groove = (pts, w = 1.1) => {
        stroke(ctx, pts.map(([x, y]) => [x + 0.5, y + 0.8]), 'rgba(255,214,194,0.22)', 0.6);
        stroke(ctx, pts, 'rgba(48,8,16,0.5)', w);
      };
      groove([[-18, -13], [-11, -8.6], [-5.4, -5.6], [0, -6.8], [5.4, -5.6], [11, -8.6], [18, -13]]);
      for (const sd of [1, -1]) {
        groove([[sd * 5.4, -5.6], [sd * 7, 1.6], [sd * 6.2, 9.4], [sd * 3.6, 13.6], [0, 14.8]], 0.9);
        groove([[sd * 6.2, 9.4], [sd * 11.6, 16.4], [sd * 13.6, 22]], 0.7);
        groove([[sd * 11, -8.6], [sd * 14.6, -15.4]], 0.7);
      }
      // こまかい つぶ
      const r = seeded(977);
      for (let k = 0; k < 260; k++) disc(ctx, -30 + r() * 60, -27 + r() * 54, 0.3 + r() * 0.26, r() < 0.5 ? 'rgba(255,224,206,0.3)' : 'rgba(50,8,14,0.3)');
    });
    volume(ctx, cara, { dark: 0.2, wide: 3.4, light: 0.08 });
    shape(ctx, cara, null, edge, 0.55);
    // こうらの 上の とげ。まんなかの 6つ（心ぞうの ところ。2れつ × 3）は とくに 大きく
    for (const [x, y, r] of [[0, -18, 1.2], [4.4, -14.2, 1.4], [-4.4, -14.2, 1.4], [0, -11, 1.3], [8.2, -11, 1.1], [-8.2, -11, 1.1],
      [12, -15, 1.1], [-12, -15, 1.1], [16.4, -10.4, 1.1], [-16.4, -10.4, 1.1],
      [12.4, -3.4, 1.3], [18, -2.4, 1.3], [22.6, 1.6, 1.2], [13.4, 4, 1.3], [19.6, 8, 1.3], [12.6, 11, 1.2], [16.6, 15.4, 1.2], [9.6, 18, 1.1],
      [-12.4, -3.4, 1.3], [-18, -2.4, 1.3], [-22.6, 1.6, 1.2], [-13.4, 4, 1.3], [-19.6, 8, 1.3], [-12.6, 11, 1.2], [-16.6, 15.4, 1.2], [-9.6, 18, 1.1],
      [0, 19.6, 1.2], [4.6, 21.4, 1], [-4.6, 21.4, 1]]) bump(x, y, r);
    for (const [x, y] of [[2.9, -1.4], [-2.9, -1.4], [3.5, 3.8], [-3.5, 3.8], [2.8, 9], [-2.8, 9]]) bump(x, y, 1.75);
  },
};

// ガザミ（オス・上から・前が 上）: ワタリガニとも よぶ。こうらは よこに 長い ひしがたで、両はしが 長い とげに なる。
// 前の ふちは 目の あいだに とげ 3つ、目の 外に 小さな とげが ならぶ。はさみあしは 長く、とげが ある（オスは 青みが つよい）。
// いちばん うしろの あしは ひらたい オール（およぐ ため。夜に 海面を およいで うつる）。こうらは あおみどりで うしろに 白い もよう
const swimmingcrab = {
  group: 'crab', level: 2, similar: ['crab', 'kingcrab', 'hermitcrab'],
  box: [-94, -46, 94, 54],
  draw(ctx) {
    const edge = '#0e1a18';
    const tone = ['#a8ba98', '#5c7458', '#24362a'];
    const skin = rgrad(ctx, -24, -30, 135, tone);
    const blueTone = ['#aebfc4', '#627f8c', '#283a48'];
    const blue = rgrad(ctx, -24, -34, 140, blueTone);
    const white = 'rgba(244,246,232,0.9)';
    both(ctx, () => {
      // およぐ あし（いちばん うしろ）: 先の 2つの ふしが ひらたい
      limb(ctx, [14, 16], [26, 28], 6.4, 6, blue, edge, 0.45);
      limb(ctx, [26, 28], [31, 33.6], 6, 6.4, blue, edge, 0.45);
      const prop = [[28, 31], [33.6, 29.6], [41.6, 35], [42.6, 41], [37, 42.6], [30.6, 37.6]];
      shape(ctx, prop, blue, edge, 0.45);
      const pad = ell(47.6, 45.4, 8.6, 5.4, 22, 0.7);
      shape(ctx, pad, blue, edge, 0.45);
      within(ctx, pad, () => {
        stroke(ctx, [[42, 40.6], [53, 50]], 'rgba(20,30,70,0.35)', 0.5, false);
        shape(ctx, pad, null, 'rgba(236,240,250,0.5)', 1.6);
      });
      // オールの ふちの 毛
      for (let k = 0; k < 13; k++) {
        const a = -0.9 + k * 0.33;
        const q = [47.6 + Math.cos(a) * 8.6 * Math.cos(0.7) - Math.sin(a) * 5.4 * Math.sin(0.7), 45.4 + Math.cos(a) * 8.6 * Math.sin(0.7) + Math.sin(a) * 5.4 * Math.cos(0.7)];
        stroke(ctx, [q, [q[0] + (q[0] - 47.6) * 0.16, q[1] + (q[1] - 45.4) * 0.16]], 'rgba(60,50,40,0.5)', 0.25, false);
      }
      // あるく あし 3つい（ほそく、すこし ひらたい）
      jointLeg(ctx, [[22, 13], [42, 21], [50, 24], [63, 34], [70, 45]], [5.4, 4.8, 4.2, 3.2], blue, edge, { bend: -0.12 });
      jointLeg(ctx, [[27, 9], [49, 12], [57, 14], [72, 24], [81, 35]], [5.6, 5, 4.4, 3.4], blue, edge, { bend: -0.12 });
      jointLeg(ctx, [[31, 5], [53, 2], [61, 3], [78, 11], [89, 20]], [5.6, 5, 4.4, 3.4], blue, edge, { bend: -0.12 });
      // はさみあし: 長い ふし（前の ふちに とげ 4本）→ みじかい ふし → 長い て（うねが ある）と ほそい ゆび
      const m0 = [18, -9];
      const m1 = [50, -25];
      thorns(ctx, m0, m1, 9, 9, 4, 3, blue, edge, 41, [1]);
      limb(ctx, m0, m1, 9, 9.4, blue, edge, 0.45);
      stroke(ctx, [[24, -10.4], [46, -21.4]], 'rgba(244,246,250,0.3)', 1.6, false);
      thorn(ctx, 55, -33.6, -1.9, 3.4, 1.1, blue, edge);
      limb(ctx, m1, [57, -30], 9, 8.6, blue, edge, 0.45);
      const hand = [[54.6, -26], [57.6, -34.6], [68, -39.6], [78, -41], [92, -42.6, 1], [80, -37.4], [72, -34], [62, -27.6]];
      const thumb = [[72, -34.6], [79, -37], [91.6, -40.6, 1], [82, -34], [74, -31]];
      shape(ctx, thumb, blue, edge, 0.45);
      shape(ctx, hand, blue, edge, 0.45);
      within(ctx, hand, () => {
        stroke(ctx, [[58, -31], [70, -37], [84, -40.6]], 'rgba(244,246,250,0.42)', 0.9);
        stroke(ctx, [[59, -28], [70, -33.6]], 'rgba(20,30,70,0.3)', 0.6);
      });
      // ゆびの 先は あかちゃいろ
      shape(ctx, [[85, -41.2], [92, -42.6, 1], [86.6, -40]], '#8a3a2a', null);
      shape(ctx, [[85.6, -38.6], [91.6, -40.6, 1], [86.6, -37]], '#8a3a2a', null);
      // 白い 点（はさみあしと あし）
      for (const [x, y] of [[28, -13], [36, -18], [44, -21], [62, -31], [68, -36], [38, 17], [46, 12.6], [50, 2.6], [70, 7], [66, 20], [58, 30]]) disc(ctx, x, y, 0.8, white);
    });
    // 目（こうらの 前の くぼみ）
    both(ctx, () => {
      stroke(ctx, [[7.6, -14], [8.6, -17.6]], tone[2], 1.7, false);
      oval(ctx, 8.8, -18, 1.9, 1.5, '#12100c', null, 0, -0.2);
      stroke(ctx, [[3.4, -15], [4.6, -20.6]], tone[2], 0.45, false);
    });
    // こうら: よこに 長い ひしがた。両はしは 長い とげ
    const half = [[0, -15.6], [4, -15.6], [6.4, -14], [9.6, -14], [11.6, -15.6], [18, -13.6], [25, -10.6], [31, -7], [35.4, -3.6], [43.6, -1.6, 1], [35, 1.6], [29, 7.6], [22, 13.4], [13, 16.8], [6, 17.8], [0, 17.8]];
    const shell = sym(half);
    both(ctx, () => {
      // 目の あいだの とげ と、目の 外に ならぶ 小さな とげ（8つ。9つ目が 長い とげ）
      thorn(ctx, 3.2, -15.4, -PI / 2, 2, 1, skin, edge);
      for (const [x, y] of [[12.4, -15.2], [15.4, -14.2], [18.6, -13.2], [21.8, -11.8], [25, -10.2], [28, -8.6], [31, -6.8], [33.8, -4.8]]) thorn(ctx, x, y, -1.15, 2.6, 1.1, skin, edge);
    });
    thorn(ctx, 0, -15.4, -PI / 2, 2.2, 1, skin, edge);
    shape(ctx, shell, skin, edge, 0.6);
    within(ctx, shell, () => {
      both(ctx, () => {
        // こうらを よこぎる つぶの うね（長い とげから 内へ）
        stroke(ctx, [[40, -1.6], [30, -2.6], [21, -5.6], [13, -4.6]], 'rgba(230,236,214,0.5)', 0.8);
        stroke(ctx, [[40, -1], [30, -1.8], [21, -4.8], [13, -3.8]], 'rgba(16,28,22,0.4)', 0.5);
        stroke(ctx, [[4, -9], [10, -10.6], [16, -9.6]], 'rgba(230,236,214,0.4)', 0.7);
        stroke(ctx, [[5, -3], [7, 4], [5.6, 11]], 'rgba(16,28,22,0.42)', 0.7);
        stroke(ctx, [[7, 4], [14, 3]], 'rgba(16,28,22,0.32)', 0.6);
      });
      // 白い もよう（うしろ半分と 両はしに 多い。くもの ような ふぞろいな 形）
      const rnd = seeded(811);
      for (let i = 0; i < 70; i++) {
        const x = (rnd() - 0.5) * 78;
        const y = -6 + rnd() * 23;
        if (Math.abs(x) < 6 && y < 4) continue;
        oval(ctx, x, y, 0.7 + rnd() * 1.5, 0.5 + rnd() * 1, 'rgba(240,244,226,0.8)', null, 0, rnd() * PI);
      }
      both(ctx, () => {
        stroke(ctx, [[30, 1.6], [35, 0.6], [39, -0.4]], 'rgba(240,244,226,0.7)', 1);
      });
    });
    sprinkle(ctx, shell, 300, 0.36, 'rgba(18,30,22,0.36)', 812);
    sprinkle(ctx, shell, 160, 0.36, 'rgba(226,236,208,0.36)', 813);
    volume(ctx, shell, { dark: 0.2, wide: 4.6 });
    gloss(ctx, shell, -12, -6, 16, 0.2);
  },
};

// クルマエビ（真横・左むき）: からだに こげちゃいろの 横じま。おなかを まるめると しまが 車の わの ように 見えるのが 名前の もと。
// あたまの 先に ぎざぎざの つの（額角。上に 9〜10 の 歯）。長い ひげ（第2触角）。あるく あし 5つい（前の 3ついは 小さな はさみ）と
// およぐ あし 5つい。おの 先は 青と きいろ。昼は すなに もぐり、夜に 出て あるく
const prawn = {
  group: 'shrimp', level: 1, similar: ['lobster', 'hermitcrab', 'crab'],
  box: [-92, -48, 68, 54],
  draw(ctx) {
    const edge = '#33221a';
    const tone = ['#fbf2dc', '#ead4ae', '#b08c62'];
    const skin = rgrad(ctx, -30, -30, 120, tone);
    const band = 'rgba(104,58,40,0.86)';
    // むこうがわの ひげ（長い 触角）
    stroke(ctx, [[-55, -5], [-66, -6], [-73, -17], [-66, -33], [-44, -42], [-12, -44.6], [20, -40], [46, -28]], 'rgba(150,80,56,0.55)', 0.6);
    // おなか: 6つの ふしが 下へ まるく まがる
    const N = 72;
    const A = snake([[-24, -6], [-8, -9.4], [0, -10], [17, -9], [31, -2.6], [42, 9], [48, 23], [50, 34]], [22.6, 22.6, 21.6, 19.6, 17, 13.6, 10.6, 8.6], N);
    const cut = [0, 0.21, 0.35, 0.5, 0.65, 0.78, 1].map((t) => Math.round(t * (N - 1)));
    // およぐ あし（ふし 1〜5 の 下。つけねの ふしと 2まいの ひれ）
    for (let k = 0; k < 5; k++) {
      const i = Math.round((cut[k] + cut[k + 1]) / 2);
      const b = A.down[i];
      const tx = A.c[Math.min(N - 1, i + 1)][0] - A.c[i - 1][0];
      const ty = A.c[Math.min(N - 1, i + 1)][1] - A.c[i - 1][1];
      const L = Math.hypot(tx, ty) || 1;
      const ox = -ty / L;
      const oy = tx / L;
      const bx = tx / L;
      const by = ty / L;
      const tip = [b[0] + ox * 15 + bx * 7, b[1] + oy * 15 + by * 7];
      const tip2 = [b[0] + ox * 12 + bx * 12, b[1] + oy * 12 + by * 12];
      shape(ctx, [[b[0] + bx * 2.4, b[1] + by * 2.4], [(b[0] + tip2[0]) / 2 + bx * 3, (b[1] + tip2[1]) / 2 + by * 3], [...tip2, 1], [(b[0] + tip2[0]) / 2 - bx * 0.6, (b[1] + tip2[1]) / 2 - by * 0.6]], '#e8b478', edge, 0.35);
      shape(ctx, [[b[0] - bx * 2.4, b[1] - by * 2.4], [b[0] + ox * 6 - bx * 2.4, b[1] + oy * 6 - by * 2.4], [...tip, 1], [b[0] + ox * 7 + bx * 3.6, b[1] + oy * 7 + by * 3.6], [b[0] + bx * 2.4, b[1] + by * 2.4]], '#f2c88a', edge, 0.35);
      stroke(ctx, [[b[0] + ox * 3, b[1] + oy * 3], [tip[0] - ox, tip[1] - oy]], 'rgba(170,90,50,0.6)', 0.4, false);
    }
    // おの 先（まんなかの とがった 板と 左右の ひれ）: つけねは ちゃいろ → きいろ → 青、ふちは あかい 毛
    const e = A.c[N - 1];
    const fanTone = lgrad(ctx, e[0] - 1, e[1] - 2, e[0] + 3, e[1] + 18, ['#a87a52', '#e8c648', '#3e6cc8', '#243c94']);
    const fanA = [[e[0] - 4.4, e[1] - 3], [e[0] - 10, e[1] + 6], [e[0] - 9, e[1] + 15], [e[0] - 3.6, e[1] + 18.6], [e[0] + 1, e[1] + 9], [e[0] + 2, e[1] - 1]];
    const fanB = [[e[0] - 1, e[1] - 2], [e[0] - 2, e[1] + 9], [e[0] + 1.6, e[1] + 19.6], [e[0] + 8, e[1] + 17], [e[0] + 9.6, e[1] + 8], [e[0] + 4.6, e[1] - 2]];
    for (const f of [fanB, fanA]) {
      shape(ctx, f, fanTone, edge, 0.45);
      within(ctx, f, () => {
        for (let k = -3; k <= 3; k++) stroke(ctx, [[e[0] + k * 1.2, e[1]], [e[0] + k * 3.4, e[1] + 20]], 'rgba(20,30,80,0.28)', 0.35, false);
        shape(ctx, f, null, 'rgba(200,70,50,0.7)', 1.2);
      });
    }
    shape(ctx, [[e[0] - 3, e[1] - 3], [e[0] - 1.4, e[1] + 8], [e[0] + 0.6, e[1] + 15.6, 1], [e[0] + 2.6, e[1] + 8], [e[0] + 3.4, e[1] - 3]], '#b48c60', edge, 0.4);
    // おなかの ふし（うしろ → 前の じゅん。ふしの 下は まるい 板に なって 下へ はりだす）
    const segs = [];
    for (let k = 0; k < 6; k++) {
      const i0 = cut[k];
      const i1 = cut[k + 1];
      const top = [];
      const bot = [];
      for (let i = i0; i <= i1; i++) {
        const s = (i - i0) / (i1 - i0);
        const lobe = k < 5 ? Math.sin(s * PI) ** 0.7 * 3.4 : 0;
        const d = [A.down[i][0] - A.c[i][0], A.down[i][1] - A.c[i][1]];
        const L = Math.hypot(d[0], d[1]) || 1;
        top.push(A.up[i]);
        bot.push([A.down[i][0] + (d[0] / L) * lobe, A.down[i][1] + (d[1] / L) * lobe]);
      }
      segs.push({ pts: [...top, ...bot.reverse()], i0, i1 });
    }
    for (let k = 5; k >= 0; k--) {
      const { pts, i0, i1 } = segs[k];
      shape(ctx, pts, skin, edge, 0.5);
      within(ctx, pts, () => {
        // こげちゃの 横じま（ふしの うしろ寄り。せなかから おなかの 板まで）
        const a = Math.round(i0 + (i1 - i0) * (k === 5 ? 0.5 : k === 0 ? 0.68 : 0.52));
        const b = Math.round(i0 + (i1 - i0) * (k === 5 ? 0.8 : k === 0 ? 0.94 : 0.9));
        const out = (i, f) => [A.c[i][0] + (A.down[i][0] - A.c[i][0]) * f, A.c[i][1] + (A.down[i][1] - A.c[i][1]) * f];
        const upp = (i, f) => [A.c[i][0] + (A.up[i][0] - A.c[i][0]) * f, A.c[i][1] + (A.up[i][1] - A.c[i][1]) * f];
        shape(ctx, [upp(a, 1.2), upp(b, 1.2), out(b - 1, 0.5), out(b - 2, 1.6), out(a - 1, 1.6), out(a, 0.5)], band, null);
        // せなかの こい 色と、わきの うすい あおみ
        stroke(ctx, A.up.slice(i0, i1 + 1), 'rgba(150,110,70,0.3)', 5);
        const mid = [];
        for (let i = i0; i <= i1; i++) mid.push(out(i, 0.62));
        stroke(ctx, mid, 'rgba(150,190,220,0.14)', 4.4);
      });
    }
    for (const { pts } of segs) volume(ctx, pts, { dark: 0.1, wide: 3, light: 0.1 });
    // むこうがわの あるく あし
    for (let k = 0; k < 5; k++) {
      const bx = -46 + k * 7;
      stroke(ctx, [[bx, 5], [bx - 7, 15], [bx - 9, 27]], 'rgba(160,120,80,0.7)', 1.5, false);
    }
    // あたまと むねの こうら
    const cara = [[-53, -18.6], [-40, -20], [-27, -19.8], [-15, -18.2], [-10.6, -8], [-12.6, 3.6], [-24, 7.4], [-38, 6.8], [-48.6, 3.6], [-53.6, -2], [-54.6, -9], [-52.6, -14.6]];
    // つの（額角）: 上の ふちに 歯が ならぶ。こうらの せなかの うねに つづく
    const rost = [[-50, -20], [-60, -21], [-70, -19.6], [-78, -17.4, 1], [-66, -16.4], [-52, -15]];
    for (let k = 0; k < 9; k++) thorn(ctx, -46 - k * 3.2, -19.9 - (k < 4 ? 0.3 : 0.9 - (k - 4) * 0.42), -2.2, 2, 0.9, tone[1], edge, 0.28);
    shape(ctx, rost, skin, edge, 0.45);
    stroke(ctx, [[-52, -17.4], [-66, -18.4], [-76, -17.6]], 'rgba(150,80,56,0.6)', 0.5);
    shape(ctx, cara, skin, edge, 0.55);
    within(ctx, cara, () => {
      // ななめの こげちゃの しま 3本
      shape(ctx, [[-44, -21], [-38, -21], [-45, 8], [-51, 8]], band, null);
      shape(ctx, [[-31, -21], [-25.4, -21], [-30, 9], [-36, 9]], band, null);
      shape(ctx, [[-19, -21], [-14, -21], [-13, 8], [-19.6, 8]], band, null);
      stroke(ctx, [[-52, -18.4], [-40, -19.8], [-26, -19.6], [-15, -18]], 'rgba(150,110,70,0.3)', 5);
      // こうらの みぞ と とげ
      stroke(ctx, [[-52, -8], [-44, -7], [-36, -9.6], [-27, -8]], 'rgba(80,50,30,0.42)', 0.5);
      stroke(ctx, [[-44, -7], [-40, 0], [-30, 3]], 'rgba(80,50,30,0.36)', 0.5);
    });
    volume(ctx, cara, { dark: 0.12, wide: 4, light: 0.1 });
    thorn(ctx, -53.6, -5, PI, 3, 1, skin, edge);
    // 手前の あるく あし 5つい（前の 3ついは 先が 小さな はさみ）
    for (let k = 0; k < 5; k++) {
      const bx = -44 + k * 7;
      const a = [bx, 6.4];
      const b = [bx - 5.6 + k * 0.6, 17];
      const c = [bx - 9 + k * 1.6, 30 - (k > 2 ? 0 : 2)];
      limb(ctx, a, b, 2.4, 2, '#f0d8a4', edge, 0.38);
      limb(ctx, b, c, 2, 1, '#f0d8a4', edge, 0.38);
      if (k < 3) {
        stroke(ctx, [c, [c[0] - 2.4, c[1] + 1.6]], edge, 0.6, false);
        stroke(ctx, [c, [c[0] - 1, c[1] + 2.6]], edge, 0.6, false);
      }
      disc(ctx, b[0], b[1], 0.9, 'rgba(90,130,200,0.75)');
    }
    // 口の わきの あし（あごあし）
    limb(ctx, [-49, 3], [-58, 5], 2.2, 1.6, '#f0d8a4', edge, 0.38);
    limb(ctx, [-58, 5], [-66, 1], 1.6, 0.8, '#f0d8a4', edge, 0.38);
    // 触角の つけねの うろこの ような 板、みじかい 触角（先が 2つ）、目
    const scale = [[-53, -10], [-64, -12.6], [-74, -11], [-75.6, -8.6, 1], [-66, -6.6], [-53, -5.6]];
    shape(ctx, scale, '#efe0bc', edge, 0.4);
    stroke(ctx, [[-55, -8.4], [-73, -9.6]], 'rgba(120,80,50,0.5)', 0.4, false);
    limb(ctx, [-54, -12.4], [-64, -14.6], 2.6, 2, '#e8d0a4', edge, 0.38);
    stroke(ctx, [[-64, -14.6], [-73, -20], [-82, -22]], 'rgba(150,80,56,0.9)', 0.5);
    stroke(ctx, [[-64, -14.6], [-74, -15], [-84, -13]], 'rgba(150,80,56,0.9)', 0.5);
    stroke(ctx, [[-52.6, -13.6], [-57, -16]], '#d8c098', 2, false);
    oval(ctx, -58.4, -16.8, 3.1, 2.6, '#1a1210', edge, 0.3, -0.5);
    disc(ctx, -59.4, -17.8, 0.7, 'rgba(255,255,255,0.7)');
    // 手前の ひげ（第2触角）: からだより 長く、うしろへ ながれる
    limb(ctx, [-54, -6.4], [-60, -5], 3, 2.4, '#e8d0a4', edge, 0.38);
    const whip = snake([[-60, -5], [-70, -5], [-80, -14], [-78, -30], [-58, -41], [-26, -45.4], [8, -43], [36, -34], [58, -18]], [1.5, 1.2, 0.9, 0.5], 60);
    shape(ctx, whip.outline, '#b46c50', 'rgba(60,30,20,0.6)', 0.25);
  },
};

// ---------- イカ・タコ・かい ----------

// コウイカ（オス・上から・胴の うしろが 左）: 胴は だえんで、まわり ぜんぶに ひれが つく（スルメイカは 先だけ）。
// 胴の 中に かたい「こう」（石灰の ふねの 形の ほね）が あり、その 先が 胴の うしろに 小さな とげと して 出る。
// オスは せなかに 白い 波の 横じま。うでは みじかい 8本と、ふだんは しまって いる 長い 2本。目の ひとみは W字
const cuttlefish = {
  group: 'cephalopod', level: 2, similar: ['squid', 'octopus', 'nautilus'],
  box: [-80, -29, 82, 29],
  draw(ctx) {
    const edge = '#2c180e';
    const tone = ['#c69a7a', '#86583c', '#402414'];
    const skin = rgrad(ctx, -40, -14, 130, tone);
    const cream = 'rgba(248,236,214,0.92)';
    // 長い うで 2本（えものを とる とき だけ のばす。ここでは 先を すこし 出す）
    bothY(ctx, () => {
      const T = snake([[26, -9], [42, -13.4], [58, -14.6], [68, -13]], [1.8, 1.4, 1.2, 1.2], 24);
      shape(ctx, T.outline, '#c8a084', edge, 0.35);
      const club = [[66, -14.6], [72, -16.4], [79, -14, 1], [73, -10.6], [66, -11.4]];
      shape(ctx, club, '#d2ac90', edge, 0.4);
      for (let k = 0; k < 5; k++) disc(ctx, 68.4 + k * 2, -13.6 + (k % 2 ? 0.9 : -0.6), 0.6, '#f8ecdc', 'rgba(90,50,30,0.6)', 0.22);
    });
    // みじかい うで 8本（外がわ → まんなかの じゅん。先へ とがり、横じまが ある）
    bothY(ctx, () => {
      const arms = [
        [[[21, -10.4], [33, -15], [45, -17.6]], [7.6, 5.6, 1]],
        [[[23, -8], [37, -10.8], [50, -11.4]], [6.2, 4.6, 0.9]],
        [[[24, -5], [39, -6.4], [53, -6]], [5.6, 4.2, 0.9]],
        [[[24, -2.2], [40, -2.4], [55, -1.6]], [5.2, 3.8, 0.8]],
      ];
      for (const [spine, w] of arms) {
        const A = snake(spine, w, 24);
        shape(ctx, A.outline, skin, edge, 0.4);
        within(ctx, A.outline, () => {
          for (let i = 2; i < 22; i += 2) stroke(ctx, [A.up[i], A.down[i]], cream, 0.6, false);
          stroke(ctx, A.down, 'rgba(40,20,10,0.25)', 1.6);
        });
      }
    });
    // ひれ: 胴の まわり ぜんぶに つく うすい ひだ（うしろの 先だけ 左右に 分かれる）
    const fins = mirrorY([[-71, 0], [-75.6, -3.4], [-74, -10.6], [-65, -18.6], [-49, -24], [-30, -25.8], [-13, -24.4], [-2, -19.6], [1.6, -13], [0, -7], [0, 0]]);
    fill3d(ctx, fins, ['#f6ead8', '#dcc0a4', '#a08064'], edge, 0.45);
    within(ctx, fins, () => bothY(ctx, () => {
      for (let k = 0; k < 30; k++) {
        const x = -70 + k * 2.4;
        stroke(ctx, [[x, -12], [x - 1.4, -27]], 'rgba(120,80,56,0.2)', 0.3, false);
      }
    }));
    // あたまと 目（W字の ひとみ。上から 見ると 目は 左右に ふくらむ）
    const head = mirrorY([[3, 0], [4, -9], [8.6, -13.6], [16, -14.8], [22.6, -12.4], [26, -6.4], [27, 0]]);
    shape(ctx, head, skin, edge, 0.5);
    within(ctx, head, () => {
      for (let k = 0; k < 4; k++) stroke(ctx, [[9 + k * 4.6, -16], [10.6 + k * 4.6, -6], [10.6 + k * 4.6, 6], [9 + k * 4.6, 16]], 'rgba(248,236,214,0.5)', 0.7);
    });
    bothY(ctx, () => {
      oval(ctx, 15.4, -12.6, 4.6, 2.9, '#d8c49a', edge, 0.4, 0.08);
      stroke(ctx, [[12, -13.6], [13.6, -11.8], [15.4, -13], [17.2, -11.8], [18.8, -13.6]], '#140c08', 1.25);
      stroke(ctx, [[11.4, -14.8], [15.4, -15.8], [19.6, -14.6]], tone[2], 0.9);
    });
    // 胴: だえん。前の ふちは あたまの 上に まるく はりだす
    const mantle = mirrorY([[-71.6, 0], [-70, -6.4], [-62, -13.8], [-48, -18.8], [-32, -20.8], [-16, -19.8], [-4.6, -16.6], [2.6, -12], [6.6, -6.4], [8, 0]]);
    shape(ctx, mantle, skin, edge, 0.6);
    within(ctx, mantle, () => {
      // オスの 白い 波の 横じま（左右に わたる ほそい 線。まんなかで とぎれる ものも ある）
      const rnd = seeded(821);
      for (let k = 0; k < 17; k++) {
        const x = -66 + k * 4.2 + (rnd() - 0.5) * 1.2;
        const amp = 1 + rnd() * 0.9;
        const ph = rnd() * 6;
        const line = [];
        for (let y = -22; y <= 22; y += 2.2) line.push([x + Math.sin(y * 0.42 + ph) * amp + Math.abs(y) * 0.05, y]);
        const gap = rnd() < 0.4 ? 3 + Math.floor(rnd() * 3) : 0;
        if (gap) {
          stroke(ctx, line.slice(0, 10 - gap), cream, 1.05);
          stroke(ctx, line.slice(11 + gap - 2), cream, 1.05);
        } else stroke(ctx, line, cream, 1.05);
      }
      // せなかの まんなか（こうの 上）は すこし あかるい。ふちに そって 白い 点
      oval(ctx, -32, 0, 34, 6, 'rgba(255,236,214,0.1)');
      bothY(ctx, () => { for (let k = 0; k < 13; k++) disc(ctx, -62 + k * 5, -17.4 + Math.abs(k - 6) ** 2 * 0.19, 0.7, 'rgba(250,244,230,0.85)'); });
    });
    sprinkle(ctx, mantle, 360, 0.36, 'rgba(40,20,10,0.35)', 822);
    sprinkle(ctx, mantle, 200, 0.34, 'rgba(255,238,214,0.34)', 823);
    volume(ctx, mantle, { dark: 0.2, wide: 5 });
    gloss(ctx, mantle, -40, -8, 24, 0.18);
    // ひれの つけねの 白い 線
    within(ctx, fins, () => shape(ctx, mantle, null, 'rgba(250,246,236,0.8)', 1.5));
    shape(ctx, mantle, null, edge, 0.6);
    // こうの うしろの 先の 小さな とげ
    thorn(ctx, -71, 0, PI, 4.4, 0.9, '#f4ead8', edge, 0.35);
  },
};

// オウムガイ（真横・左むき）: うずまきの からに 入った イカ・タコの なかま。からは 白に あかちゃいろの ほのおの ような しま
// （口の 近くは 白、うずの 中心の そばは 黒い）。からの 口の 上に ずきん（からに ひっこんだ とき ふたに なる）。
// うでは 90本 くらいで きゅうばんが ない。目は あなが あいた だけ（レンズが ない）。下の ろうとから 水を ふいて およぐ
const nautilus = {
  group: 'cephalopod', level: 1, similar: ['turban', 'squid', 'hermitcrab'],
  box: [-52, -29, 52, 42],
  draw(ctx) {
    const edge = '#3a2416';
    const C = [16, 0];
    // からの そとがわの りんかく: 対数らせん（1まわりで 3ばい）。口の 下の ふち（左下）から うしろへ たどる
    const R = (deg) => 46 * 3 ** ((deg - 140) / 360);
    const at = (deg, k = 1) => [C[0] + Math.cos((deg * PI) / 180) * R(deg) * k, C[1] + Math.sin((deg * PI) / 180) * R(deg) * k];
    const outer = [];
    for (let d = 140; d >= -176; d -= 9) outer.push(at(d));
    const lip = outer[0];
    const top = outer[outer.length - 1];
    // からの 口の ふち（目の うしろで くぼむ）
    const rim = [[top[0] + 2.6, top[1] + 5], [5, 5], [5.6, 13], [0, 20], [-9, 24.6], [-17, 27]];
    const shell = [...outer, ...rim];
    // からだ（からの 口から 出る）と ろうと
    const body = [[-2, -6], [-20, -7], [-29, 0], [-30, 10], [-25, 20], [-17, 27], [-4, 26], [6, 14], [5, 2]];
    shape(ctx, body, '#e6d2b8', edge, 0.5);
    const funnel = [[-17, 22], [-26, 21.6], [-33, 26], [-36, 31.6], [-31.6, 33.6], [-25, 30], [-16, 28]];
    shape(ctx, funnel, lgrad(ctx, -18, 22, -34, 32, ['#e8d6bc', '#c8a682']), edge, 0.45);
    stroke(ctx, [[-20, 24.6], [-31, 29.6]], 'rgba(120,70,40,0.4)', 0.5, false);
    oval(ctx, -34, 32.4, 1.4, 2, 'rgba(70,40,24,0.8)', null, 0, 0.9);
    // うで: きゅうばんの ない ほそい うでが たくさん（太い さやから ほそい 先が 出る）。むこうがわ → 手前の じゅん
    const rnd = seeded(831);
    const tent = (ang, len, far) => {
      const a = (ang * PI) / 180;
      const b0 = [-24 + Math.cos(a) * 2 + (far ? 2 : 0), 8 + Math.sin(a) * 5];
      const bend = (rnd() - 0.5) * 0.5;
      const p1 = [b0[0] + Math.cos(a) * len * 0.45, b0[1] + Math.sin(a) * len * 0.45];
      const p2 = [b0[0] + Math.cos(a + bend) * len * 0.8, b0[1] + Math.sin(a + bend) * len * 0.8];
      const p3 = [b0[0] + Math.cos(a + bend * 2.2) * len, b0[1] + Math.sin(a + bend * 2.2) * len];
      const A = snake([b0, p1, p2, p3], [3.4, 2.6, 1.1, 0.5], 22);
      shape(ctx, A.outline, far ? '#cdb292' : '#f2e4cc', edge, 0.35);
      within(ctx, A.outline, () => {
        for (let i = 1; i < 11; i += 2) stroke(ctx, [A.up[i], A.down[i]], 'rgba(130,74,40,0.7)', 0.8, false);
        for (let i = 11; i < 21; i++) stroke(ctx, [A.up[i], A.down[i]], 'rgba(130,74,40,0.4)', 0.25, false);
      });
    };
    for (let k = 0; k < 9; k++) tent(152 + k * 9 + rnd() * 4, 20 + rnd() * 6, true);
    for (let k = 0; k < 11; k++) tent(140 + k * 9.6 + rnd() * 4, 23 + rnd() * 7, false);
    // から
    shape(ctx, shell, '#f6f0e2', null);
    within(ctx, shell, () => {
      // あかちゃいろの しま: うずの 中心から 外へ、ほのおの ように まがって のびる。口の 近く（下）は 白い まま
      for (let k = 0; k < 15; k++) {
        const d0 = -172 + k * 15.4 + (rnd() - 0.5) * 5;
        const w = 4.6 + rnd() * 3.4;
        const fade = Math.max(0, 1 - Math.max(0, d0 - 10) / 46);
        if (fade <= 0.05) continue;
        const a = [];
        const b = [];
        for (let t = 0.12; t <= 1.04; t += 0.08) {
          const sweep = Math.sin(t * PI) * 13 - t * 9; // まんなかで 口と 反対へ ふくらみ、ふちでは 口の ほうへ
          const ww = w * (0.35 + t * 0.9) * (0.8 + Math.sin(t * 9 + k) * 0.2);
          a.push(at(d0 - sweep - ww / 2, t));
          b.push(at(d0 - sweep + ww / 2, t));
        }
        shape(ctx, [...a, ...b.reverse()], `rgba(150,74,38,${0.9 * fade})`, null);
      }
      // うずの 中心の まわりは しまが つながって こい
      ctx.fillStyle = rgrad(ctx, C[0] - 3, C[1] - 3, 15, ['rgba(120,56,28,0.85)', 'rgba(120,56,28,0)']);
      ctx.fillRect(C[0] - 20, C[1] - 20, 40, 40);
      // 生長の すじ（ほそい 線）
      for (let k = 0; k < 40; k++) {
        const d0 = -176 + k * 8;
        const line = [];
        for (let t = 0.2; t <= 1.02; t += 0.1) line.push(at(d0 - Math.sin(t * PI) * 13 + t * 9, t));
        stroke(ctx, line, 'rgba(120,90,60,0.14)', 0.3);
      }
      // ずきんの あたる ところ（前の まきの 上）は 黒い
      const dark = [];
      for (let d = -176; d <= -118; d += 8) dark.push(at(d));
      stroke(ctx, dark, 'rgba(22,16,12,0.5)', 13);
      stroke(ctx, dark, 'rgba(22,16,12,0.9)', 8.6);
      // まるみ: ふちへ くらく、左上に 光
      ctx.fillStyle = rgrad(ctx, C[0] - 8, C[1] - 12, 62, ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0)', 'rgba(60,40,20,0.3)']);
      ctx.fillRect(-30, -32, 86, 78);
      stroke(ctx, rim, 'rgba(60,40,20,0.28)', 3);
    });
    shape(ctx, shell, null, edge, 0.6);
    // うずの 中心（へそ）
    disc(ctx, C[0], C[1], 2.4, '#d8ccb8', 'rgba(60,36,20,0.7)', 0.4);
    // ずきん: からの 口の 上を おおう かたい 皮（ちゃいろに 白い つぶ）
    const hood = [[4, -9], [-8, -11.6], [-21, -10], [-31, -4.6], [-32.6, 1.6], [-27, 5], [-15, 5.6], [-3, 6.6], [4.6, 3]];
    fill3d(ctx, hood, ['#c89868', '#8e5c34', '#4c2c16'], edge, 0.55, [0.35, 0.25]);
    sprinkle(ctx, hood, 70, 0.7, 'rgba(250,236,212,0.75)', 832);
    sprinkle(ctx, hood, 60, 0.5, 'rgba(60,30,14,0.4)', 833);
    volume(ctx, hood, { dark: 0.16, wide: 3 });
    // 目: レンズが なく、小さな あなが あいて いる だけ
    disc(ctx, -4.6, 12.6, 4.2, '#8c7a66', edge, 0.45);
    within(ctx, ell(-4.6, 12.6, 4.2, 4.2, 16), () => {
      ctx.fillStyle = rgrad(ctx, -6, 11, 6, ['rgba(255,244,226,0.5)', 'rgba(255,244,226,0)', 'rgba(40,30,20,0.5)']);
      ctx.fillRect(-10, 8, 11, 10);
    });
    disc(ctx, -5, 12.6, 1.5, 'rgba(236,224,200,0.75)');
    disc(ctx, -5, 12.6, 1.05, '#0c0a08');
    stroke(ctx, [[-5, 13.6], [-5.6, 16.4]], 'rgba(40,30,20,0.6)', 0.4, false);
  },
};

// サザエ（からの 口を こちらに 向けた すがた・上が とがる）: こぶしの ような あつい まきがい。
// からに 太い つの（管の ような とげ）が 2れつ（波の しずかな 海の ものは つのが ない ことも ある）。らせんの うね。
// 口には 石灰の かたい ふた（外がわは 白っぽく、うずまきの つぶつぶ）。口の 内がわは しんじゅの 色。からの 外は 海そうが ついて くすんだ みどりちゃ
const turban = {
  group: 'snail', level: 1, similar: ['shell', 'hermitcrab', 'nautilus'],
  box: [-50, -45, 48, 45],
  draw(ctx) {
    const edge = '#20241a';
    const tone = ['#b2b092', '#74765c', '#383c2e'];
    const skin = rgrad(ctx, -18, -24, 100, tone);
    // つの（管の 形。上の れつ・下の れつ）。りんかくから 外へ 出る もの → から → 手前の もの の じゅん
    const horn = (x, y, ang, len, w) => {
      const cx = Math.cos(ang);
      const sy = Math.sin(ang);
      const tipX = x + cx * len;
      const tipY = y + sy * len;
      const pts = [[x - sy * w * 1.2, y + cx * w * 1.2], [x - sy * w * 0.8 + cx * len * 0.5, y + cx * w * 0.8 + sy * len * 0.5], [tipX - sy * w * 0.42, tipY + cx * w * 0.42], [tipX + cx * w * 0.3, tipY + sy * w * 0.3], [tipX + sy * w * 0.42, tipY - cx * w * 0.42], [x + sy * w * 0.8 + cx * len * 0.5, y - cx * w * 0.8 + sy * len * 0.5], [x + sy * w * 1.2, y - cx * w * 1.2]];
      shape(ctx, pts, skin, edge, 0.45);
      within(ctx, pts, () => {
        stroke(ctx, [[x + sy * w * 0.5, y - cx * w * 0.5], [tipX + sy * w * 0.3, tipY - cx * w * 0.3]], 'rgba(255,250,230,0.3)', w * 0.5, false);
        for (let k = 1; k < 4; k++) stroke(ctx, [[x - sy * w + cx * len * k * 0.24, y + cx * w + sy * len * k * 0.24], [x + sy * w + cx * len * k * 0.24, y - cx * w + sy * len * k * 0.24]], 'rgba(30,34,24,0.3)', 0.3, false);
      });
      // 先は あいた 管（中が くらい）
      oval(ctx, tipX - cx * w * 0.1, tipY - sy * w * 0.1, w * 0.3, w * 0.16, 'rgba(30,30,22,0.6)', null, 0, ang + PI / 2);
    };
    horn(-33, 0, -2.75, 12, 4.2);
    horn(31, -7, -0.5, 11, 4);
    horn(-33, 22, 2.95, 9.6, 3.6);
    horn(-21, -15, -2.5, 6, 3);
    // から: 上へ だんだんに とがる（かたの はった まき）
    const body = [[-3, -41], [-9.6, -34], [-15.6, -26.6], [-14.6, -22.6], [-22, -16], [-25, -9.6], [-23.4, -6], [-32, -1], [-37, 8], [-37, 19], [-31, 30], [-18, 38.4], [0, 41.4], [17, 38], [30, 28], [36.6, 12], [35, -1], [29, -8.6], [22, -11], [21.6, -17], [16, -23.6], [10, -26.6], [9, -31], [3.6, -37.6]];
    shape(ctx, body, skin, edge, 0.65);
    within(ctx, body, () => {
      // まきの さかい（ぬいめ）と かたの だん
      const seams = [
        [[-15, -23], [-6, -19.6], [4, -19.6], [14, -22.6], [22, -14]],
        [[-24, -6.6], [-12, -1], [2, 0.6], [15, -2.6], [24, -10]],
      ];
      for (const sLine of seams) {
        stroke(ctx, sLine, 'rgba(24,28,20,0.6)', 0.9);
        stroke(ctx, sLine.map(([x, y]) => [x, y + 1.6]), 'rgba(255,250,226,0.2)', 1.2);
      }
      // らせんの うね（太い うねと 細い うねが かわりばんこ）
      const rib = (pts, w, a) => {
        stroke(ctx, pts, `rgba(24,28,20,${a})`, w);
        stroke(ctx, pts.map(([x, y]) => [x - 0.3, y - 1]), `rgba(240,236,208,${a * 0.6})`, w * 0.6);
      };
      rib([[-9, -33], [-2, -30.6], [6, -31.6]], 0.6, 0.4);
      rib([[-14, -27.6], [-4, -24.6], [8, -26]], 0.6, 0.4);
      rib([[-21, -15], [-8, -10.6], [6, -10.4], [18, -14.6]], 0.7, 0.42);
      rib([[-24, -10.6], [-10, -6], [6, -5.6], [20, -10.6]], 0.6, 0.36);
      rib([[-35, 4], [-22, 9.6], [-8, 10.6], [0, 8]], 0.8, 0.45);
      rib([[-37, 12], [-24, 17.6], [-10, 19], [-2, 17]], 0.7, 0.4);
      rib([[-36, 20], [-24, 25.6], [-10, 27.6], [-1, 26]], 0.8, 0.45);
      rib([[-31, 29], [-20, 33.4], [-6, 35.6], [4, 34.6]], 0.7, 0.4);
      rib([[-20, 37], [-6, 39.6], [10, 39]], 0.6, 0.36);
      // 生長の うろこの ような すじ（うねと 交わる ほそい 線）
      const rnd = seeded(841);
      for (let k = 0; k < 46; k++) {
        const x = -36 + rnd() * 40;
        const y = -34 + rnd() * 74;
        stroke(ctx, [[x, y], [x + 1.4 + rnd(), y + 3.4 + rnd() * 2]], 'rgba(24,28,20,0.22)', 0.35, false);
      }
      // 海そう（みどり）と 石灰の も（うすい ピンク）、てっぺんの すりへった 白
      for (let k = 0; k < 16; k++) oval(ctx, -34 + rnd() * 44, -20 + rnd() * 58, 2 + rnd() * 4, 1.4 + rnd() * 2.6, `rgba(70,104,52,${0.16 + rnd() * 0.16})`, null, 0, rnd() * PI);
      for (let k = 0; k < 9; k++) oval(ctx, -32 + rnd() * 40, -26 + rnd() * 60, 1.4 + rnd() * 2.4, 1 + rnd() * 1.6, 'rgba(222,170,170,0.36)', null, 0, rnd() * PI);
      oval(ctx, -2, -38, 5, 4.4, 'rgba(236,230,214,0.5)');
    });
    sprinkle(ctx, body, 300, 0.4, 'rgba(24,28,20,0.3)', 842);
    sprinkle(ctx, body, 170, 0.4, 'rgba(240,236,208,0.3)', 843);
    volume(ctx, body, { dark: 0.24, wide: 6 });
    // 手前の つの（上の れつは かたの だんに、下の れつは その 下に ならぶ）
    horn(-19, 0, -1.95, 7.4, 3.6);
    horn(-5, 2.6, -1.62, 7, 3.4);
    horn(-23, 22.6, 2.5, 6.4, 3.2);
    horn(-10, 30, 2.05, 5.6, 3);
    // 口: あつい ふちの 内がわが しんじゅの 色。その 中に 石灰の ふた
    const mouth = ell(14, 17, 18.6, 19.6, 30, 0.2);
    shape(ctx, mouth, '#f4f0e6', edge, 0.6);
    within(ctx, mouth, () => {
      // しんじゅの いろ（うすい ピンク・みどり・あおが うつる）
      ctx.fillStyle = lgrad(ctx, -4, 0, 32, 34, ['rgba(250,214,226,0.9)', 'rgba(222,244,230,0.9)', 'rgba(214,226,250,0.9)', 'rgba(252,236,214,0.9)']);
      ctx.fillRect(-8, -6, 46, 46);
      shape(ctx, mouth, null, 'rgba(255,255,255,0.7)', 2.4);
      shape(ctx, ell(13.4, 17.6, 15.4, 16.4, 30, 0.2), 'rgba(60,50,40,0.5)', null);
    });
    const lid = ell(13, 17.6, 14.6, 15.6, 30, 0.2);
    fill3d(ctx, lid, ['#fbf8ee', '#e2dcc8', '#a8a288'], '#4a4636', 0.5, [0.35, 0.3]);
    within(ctx, lid, () => {
      // ふたの うずまきと つぶつぶ（外がわは ざらざら）
      const spiral = [];
      for (let t = 0; t < 4.6 * PI; t += 0.3) spiral.push([16 + Math.cos(t + 1) * (0.9 + t * 0.95), 20 + Math.sin(t + 1) * (0.9 + t)]);
      stroke(ctx, spiral, 'rgba(120,116,90,0.5)', 0.7);
      ctx.fillStyle = rgrad(ctx, 18, 22, 16, ['rgba(180,190,150,0.3)', 'rgba(180,190,150,0)']);
      ctx.fillRect(-4, 0, 36, 36);
    });
    sprinkle(ctx, lid, 150, 0.5, 'rgba(120,116,90,0.4)', 844);
    sprinkle(ctx, lid, 90, 0.5, 'rgba(255,255,250,0.7)', 845);
    volume(ctx, lid, { dark: 0.14, wide: 3 });
  },
};

// クリオネ（正面・立った すがた）: からの ない まきがいの なかま（和名は ハダカカメガイ）。からだが すきとおり、中の 赤い ないぞうが 見える。
// あたまに つのの ような でっぱりが 2つ。むねの 左右の つばさの ような あしを はばたいて およぐ。下は ほそく とがる。
// 白い 紙の 上でも 見える ように、うすい 青で ぬって 青い ふちを つけて ある
const clione = {
  group: 'seaslug', level: 1, similar: ['jellyfish', 'seahare', 'squid'],
  box: [-31, -46, 31, 44],
  draw(ctx) {
    const edge = '#3c6c9e';
    const glass = lgrad(ctx, -12, -40, 12, 40, ['#f6fcff', '#dcecf8', '#b4d0e8']);
    // つばさの ような あし（うすい まく）
    both(ctx, () => {
      const wing = [[5.6, -21], [12, -27.6], [21, -31.6], [28, -28.6], [28.6, -21.6], [22, -15.4], [12.6, -13], [6, -15]];
      shape(ctx, wing, 'rgba(206,230,248,0.85)', edge, 0.5);
      within(ctx, wing, () => {
        for (let k = 0; k < 7; k++) stroke(ctx, [[6, -18], [29, -32 + k * 3]], 'rgba(90,140,190,0.3)', 0.35, false);
        shape(ctx, wing, null, 'rgba(255,255,255,0.8)', 1.6);
        stroke(ctx, [[8, -18.6], [20, -23.6], [27, -25]], 'rgba(255,255,255,0.6)', 1.4);
      });
      shape(ctx, wing, null, edge, 0.5);
    });
    // からだ: まるい あたま（上に つの 2つ）→ くびれ → 下へ ほそく とがる 胴
    const body = sym([[0, -40.6], [2.4, -41.6], [4.4, -44.6], [6.8, -41], [9, -36.6], [9.6, -31], [8, -26.4], [5.4, -22.6], [7.6, -18.6], [9.8, -12], [10.4, -3], [9.6, 7], [7.6, 17], [5, 26], [2.6, 34], [0.9, 40], [0, 42]]);
    shape(ctx, body, glass, null);
    within(ctx, body, () => {
      // からだの かべ（すきとおった 外がわの 層）
      shape(ctx, body, null, 'rgba(120,170,214,0.35)', 3.4);
      shape(ctx, body, null, 'rgba(255,255,255,0.55)', 1.2);
      // 中の ないぞう: あたまの 赤い かたまり（えものを つかまえる うで が しまって ある）、胴の オレンジの ないぞう、下の 先
      const headIn = [[0, -37.6], [3.4, -38.6], [5.6, -35], [4.6, -30.6], [2, -27.6], [0, -26.6], [-2, -27.6], [-4.6, -30.6], [-5.6, -35], [-3.4, -38.6]];
      shape(ctx, headIn, rgrad(ctx, -1, -34, 8, ['#ffb070', '#f0602c', '#c43a18']), 'rgba(160,50,20,0.6)', 0.35);
      stroke(ctx, [[0, -37], [0, -28]], 'rgba(160,50,20,0.5)', 0.4, false);
      const gut = [[0, -23], [3.4, -20], [4.8, -13], [4.4, -5], [2.6, 2], [0, 6], [-2.6, 2], [-4.4, -5], [-4.8, -13], [-3.4, -20]];
      shape(ctx, gut, rgrad(ctx, -1.4, -14, 15, ['#ffb468', '#f26a2c', '#c84418']), 'rgba(160,50,20,0.6)', 0.35);
      stroke(ctx, [[0, -27], [0, -22.6]], 'rgba(230,110,60,0.8)', 0.9, false);
      stroke(ctx, [[0, 6], [0, 30]], 'rgba(240,150,100,0.5)', 0.6, false);
      oval(ctx, 0, 37, 1.2, 3.4, 'rgba(244,130,70,0.6)');
      // てり
      stroke(ctx, [[-6.4, -10], [-7, 0], [-6, 12], [-4, 22]], 'rgba(255,255,255,0.85)', 1.3);
      stroke(ctx, [[-6, -37], [-6.6, -32]], 'rgba(255,255,255,0.85)', 1.3);
      stroke(ctx, [[7, -8], [6.6, 6], [4.6, 20]], 'rgba(100,150,200,0.25)', 1.8);
    });
    shape(ctx, body, null, edge, 0.6);
  },
};

// シャコ（上から・あたま 左）: エビに にるが べつの なかま（口脚類）。カマキリの ような おりたたむ 前あし（ほかく脚）で えものを つかまえる。
// 前あしの 先の ふしの 内がわに とげが 6本。あたまの 前に えの ついた 目と 触角。こうらは みじかく、むねの ふし 4つが 見える。
// おなかの ふしは はばひろく 大きく、たての うねが ある。おの 先は とげの ある おうぎ形（まんなかの 板と 左右の ひれ）。
// うすい はいちゃいろで ふしの うしろの ふちが こい。おの 先に 青や きいろ
const mantisshrimp = {
  group: 'mantis', level: 2, similar: ['prawn', 'lobster', 'hermitcrab'],
  box: [-92, -32, 82, 32],
  draw(ctx) {
    const edge = '#3a2c1c';
    const tone = ['#f2ead6', '#cabd9e', '#877a5c'];
    const skin = rgrad(ctx, -30, -16, 130, tone);
    const line = 'rgba(128,66,44,0.62)';
    const seg = (x0, x1, h0, h1) => mirrorY([[x0, 0], [x0, -h0 + 1.4], [x0 + 1.2, -h0], [x1 - 1.6, -h1 - 0.3], [x1, -h1 + 0.2, 1], [x1 - 0.5, -h1 + 2.4], [x1, 0]]);
    // 触角（先が 3つに 分かれる みじかい もの）と、うろこの ような 板・ほそい 触角
    bothY(ctx, () => {
      stroke(ctx, [[-57, -1.8], [-64, -2.6], [-71, -2.4]], '#c0b08c', 1.5, false);
      for (const tip of [[-88, -7.6], [-90, -3], [-87, 0.6]]) stroke(ctx, [[-71, -2.4], [(tip[0] - 71) / 2, tip[1] * 0.7 - 0.8], tip], 'rgba(120,96,60,0.9)', 0.45);
      stroke(ctx, [[-56, -9], [-66, -17], [-78, -22], [-88, -23.4]], 'rgba(120,96,60,0.8)', 0.45);
      const plate = ell(-61.6, -13.4, 7.6, 3.2, 20, 0.42);
      shape(ctx, plate, '#f0e2b8', edge, 0.4);
      within(ctx, plate, () => {
        stroke(ctx, [[-56, -11], [-67.6, -16]], 'rgba(150,110,60,0.5)', 0.4, false);
        shape(ctx, plate, null, 'rgba(230,190,90,0.6)', 1.4);
      });
    });
    // あるく あし（むねの うしろ 3つの ふしから。ほそい）
    bothY(ctx, () => {
      for (const [x, y] of [[-22, -10.6], [-17.6, -11], [-13.4, -11.6]]) {
        limb(ctx, [x, y], [x + 4.6, y - 8], 1.8, 1.5, '#d8cba8', edge, 0.35);
        limb(ctx, [x + 4.6, y - 8], [x + 10.6, y - 11.6], 1.5, 0.7, '#d8cba8', edge, 0.35);
      }
    });
    // おの 先の 左右の ひれ（尾肢）: つけねの ふしから、外の ひれ（ふちに とげ。先は こい 青）と 内の ひれ（きいろ）
    bothY(ctx, () => {
      limb(ctx, [49.6, -13.6], [57, -19.6], 6, 5.4, skin, edge, 0.45);
      // ふたまたの 長い とげ
      shape(ctx, [[57, -17], [67, -15.4, 1], [61, -18.4], [70, -19.6, 1], [58, -21.4]], '#e8dcc0', edge, 0.35);
      const inner = ell(65.6, -21.4, 7, 3, 20, -0.22);
      shape(ctx, inner, '#ead46a', edge, 0.4);
      within(ctx, inner, () => shape(ctx, inner, null, 'rgba(60,70,40,0.4)', 1.4));
      thorns(ctx, [56.6, -22.6], [66, -27.4], 4.4, 4.4, 7, 2.6, '#f4ecd8', edge, 51, [1]);
      limb(ctx, [56.6, -22], [66, -26.6], 5, 4.6, skin, edge, 0.45);
      const outer = ell(72.6, -27, 6.6, 3.5, 20, -0.3);
      shape(ctx, outer, lgrad(ctx, 66, -26, 79, -29, ['#6a82b8', '#2c3e7e', '#141c44']), edge, 0.4);
      within(ctx, outer, () => stroke(ctx, [[66.6, -25.6], [78, -28.6]], 'rgba(200,214,250,0.5)', 0.6, false));
    });
    // おなかの ふし 5つ（うしろへ はばが ひろがる）と 6つ目、その 前の むねの ふし 4つ
    const widths = [13.6, 14.6, 15.6, 16.4, 16.8];
    const plates = [];
    for (let k = 0; k < 4; k++) plates.push(seg(-30 + k * 4.5, -25.5 + k * 4.5 + 0.6, 10.4 + k * 0.5, 10.6 + k * 0.5));
    for (let k = 0; k < 5; k++) plates.push(seg(-12 + k * 11.6, -0.4 + k * 11.6 + 0.6, k ? widths[k - 1] + 0.3 : 12.6, widths[k]));
    plates.push(seg(46, 53.6, 16.2, 15.4));
    // おの まんなかの 板（尾節）: ふちに 大きな とげ 6つ、まんなかに たての うね
    const telson = mirrorY([[53, 0], [53, -13.4], [57, -15.4], [62, -14.8], [66.6, -16.6, 1], [66.8, -11.8], [72, -11.6, 1], [71, -6.8], [77, -3.6, 1], [74, -1.3], [74.6, 0]]);
    shape(ctx, telson, skin, edge, 0.5);
    within(ctx, telson, () => {
      stroke(ctx, [[55, 0], [71, 0]], 'rgba(70,90,60,0.7)', 2.4, false);
      stroke(ctx, [[55, 0], [70, 0]], 'rgba(230,224,196,0.6)', 0.7, false);
      bothY(ctx, () => {
        for (const pts of [[[55, -4.4], [64, -4], [73, -3]], [[55, -9], [63, -9], [69.6, -10.4]], [[55, -12.6], [61, -13.4], [65, -15]]]) stroke(ctx, pts, line, 0.7);
        for (const [x, y] of [[59, -6.6], [63, -6.6], [67, -7], [60, -11], [64, -11.6]]) disc(ctx, x, y, 0.6, 'rgba(60,84,60,0.6)');
        // とげの 先は 赤っぽい
        for (const [x, y] of [[66.4, -16.2], [71.6, -11.5], [76.4, -3.6]]) disc(ctx, x, y, 0.9, 'rgba(200,80,60,0.75)');
      });
    });
    volume(ctx, telson, { dark: 0.14, wide: 3 });
    for (let k = plates.length - 1; k >= 0; k--) {
      const pts = plates[k];
      const [x0, , x1] = bbox(pts);
      shape(ctx, pts, skin, edge, 0.5);
      within(ctx, pts, () => {
        // うしろの ふちは こい 色。たての うね（まんなかの 左右・わき・ふち）
        stroke(ctx, [[x1 - 0.9, -18], [x1 - 0.9, 18]], 'rgba(96,70,44,0.6)', 1.5, false);
        stroke(ctx, [[x0 + 1, -18], [x0 + 1, 18]], 'rgba(255,250,236,0.4)', 1, false);
        if (k >= 4) bothY(ctx, () => { for (const y of [-3.2, -8.6, -12.8]) stroke(ctx, [[x0 + 0.6, y - (k - 4) * 0.2], [x1 - 0.4, y - (k - 4) * 0.36]], line, 0.6, false); });
        ctx.fillStyle = vgrad(ctx, -17, 17, ['rgba(60,50,30,0.18)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.12)', 'rgba(60,50,30,0.18)']);
        ctx.fillRect(x0, -18, x1 - x0, 36);
      });
    }
    // こうら（あたまと むねの 前を おおう。みじかい）: うしろが ひろい 台形で、たての うね
    const cara = mirrorY([[-57.6, 0], [-56.6, -4.6], [-53, -8.4], [-45, -10.6], [-36, -12.6], [-30.6, -13, 1], [-28.6, -9.6], [-29, 0]]);
    // 前あし（ほかく脚）: 太い つけねの ふし → 前へ のびる 長い ふし → おりたたむ 先の ふし（内がわに とげ 6本。ここでは すこし ひらく）
    bothY(ctx, () => {
      // からだの わきに ぴったり よせる（はなすと 棒が ういて いる ように 見える）。つけねは こうらの 下に かくれる
      ctx.save();
      ctx.translate(0, 3.4);
      limb(ctx, [-43, -10], [-32.6, -19], 7.6, 6.8, skin, edge, 0.45);
      const dTip = [-41, -28];
      const dBase = [-59, -17.2];
      const dx = dTip[0] - dBase[0];
      const dy = dTip[1] - dBase[1];
      for (let k = 0; k < 5; k++) {
        const t = 0.16 + k * 0.165;
        thorn(ctx, dBase[0] + dx * t + 0.6, dBase[1] + dy * t + 1, 0.78, 4.2 - k * 0.3, 0.7, '#f6eedc', edge, 0.3);
      }
      shape(ctx, [[-60, -15.6], [-52, -23.2], [-44, -28], [-39, -29.2, 1], [-45, -25.2], [-52.6, -20], [-57.6, -15.6]], '#eadfc4', edge, 0.4);
      limb(ctx, [-32.6, -19], [-59, -16.8], 6.4, 4.6, skin, edge, 0.45);
      stroke(ctx, [[-36, -20.6], [-56, -18.4]], 'rgba(255,250,236,0.5)', 1, false);
      for (let k = 0; k < 9; k++) disc(ctx, -37 - k * 2.4, -16.8 + k * 0.22, 0.42, 'rgba(96,70,44,0.6)');
      ctx.restore();
    });
    shape(ctx, cara, skin, edge, 0.55);
    within(ctx, cara, () => {
      stroke(ctx, [[-56, 0], [-30, 0]], line, 0.7, false);
      bothY(ctx, () => {
        stroke(ctx, [[-53, -3.6], [-42, -4.6], [-30, -5]], line, 0.6);
        stroke(ctx, [[-50, -7.4], [-40, -9], [-30, -10.2]], line, 0.6);
        stroke(ctx, [[-46, -11], [-44, -5], [-45, 0]], 'rgba(96,70,44,0.4)', 0.6);
      });
    });
    volume(ctx, cara, { dark: 0.14, wide: 3.4 });
    sprinkle(ctx, cara, 60, 0.4, 'rgba(70,90,60,0.4)', 852);
    // 目（みじかい えの 先。よこに 長い）と、目の あいだの 小さな 板
    shape(ctx, mirrorY([[-61.6, 0], [-59.6, -2.2], [-57, -2.6], [-56.6, 0]]), '#e0d4b4', edge, 0.4);
    bothY(ctx, () => {
      stroke(ctx, [[-58, -3], [-63, -6.6]], '#cdbf9c', 2.2, false);
      oval(ctx, -65.4, -8, 3.6, 2.3, '#2a3424', edge, 0.4, -0.6);
      stroke(ctx, [[-67.4, -6.4], [-63.6, -9.4]], 'rgba(214,226,170,0.7)', 0.6, false);
    });
  },
};

// ---------- ウニ・ヒトデ・クラゲ ----------

// マナマコ（よこに ねた すがたを ななめ上から・口が 左）: キュウリの ような 太い つつ形。せなかに 円すいの いぼ（いぼあし）が ならぶ。
// 下がわには 小さな あし（管足）が たくさん あり、これで はう。口の まわりに ふさの ような しょくしゅ（20本）で すなや どろを 口へ はこぶ。
// 色は 赤・青（みどりっぽい）・黒の 3つの 型が あり、ここでは 岩場に 多い あかちゃいろの まだら
const seacucumber = {
  group: 'echinoderm', level: 1, similar: ['seahare', 'starfish', 'urchin'],
  box: [-89, -29, 80, 28],
  draw(ctx) {
    const edge = '#30140c';
    const N = 64;
    const B = snake([[-62, 9], [-42, 1], [-12, -3.6], [22, -2.6], [50, 3.4], [69, 11.6]], [23, 31, 35, 35, 31, 21], N);
    const P = (i, f) => {
      const e = f < 0 ? B.up[i] : B.down[i];
      const k = Math.abs(f);
      return [B.c[i][0] + (e[0] - B.c[i][0]) * k, B.c[i][1] + (e[1] - B.c[i][1]) * k];
    };
    const rnd = seeded(861);
    // 口の まわりの しょくしゅ（先が ふさに なる）。むこうがわの もの
    const tentacle = (ang, len, front) => {
      const a = (ang * PI) / 180;
      const b0 = [-70 + Math.cos(a) * 3, 12.6 + Math.sin(a) * 4];
      const tip = [b0[0] + Math.cos(a) * len, b0[1] + Math.sin(a) * len];
      stroke(ctx, [b0, tip], edge, 2.6, false);
      stroke(ctx, [b0, tip], front ? '#e2b08a' : '#b8805e', 1.9, false);
      for (let k = 0; k < 7; k++) {
        const q = [tip[0] + Math.cos(a + (k - 3) * 0.5) * 2.2, tip[1] + Math.sin(a + (k - 3) * 0.5) * 2.2];
        disc(ctx, q[0], q[1], 1.15, front ? '#f2d2ac' : '#caa07a', edge, 0.3);
      }
      disc(ctx, tip[0], tip[1], 1.3, front ? '#f2d2ac' : '#caa07a');
    };
    for (const [a, l] of [[150, 8], [176, 9.6], [202, 9], [232, 8]]) tentacle(a, l, false);
    // 下がわの 小さな あし（管足）
    for (let i = 5; i < N - 4; i++) {
      for (const off of [0, 0.5]) {
        const q = P(i, 1);
        const x = q[0] + (off ? 0.8 : 0) + (rnd() - 0.5);
        stroke(ctx, [[x, q[1] - 2], [x - 0.6 + rnd() * 1.2, q[1] + 2.2 + rnd() * 1.4]], '#e8b494', 1.1, false);
      }
    }
    // せなかの いぼ（上の りんかくから 出る れつ）
    const wart = (x, y, h, w, lean = 0) => {
      const pts = [[x - w, y + 0.6], [x - w * 0.5 + lean * 0.5, y - h * 0.6], [x + lean, y - h, 1], [x + w * 0.56 + lean * 0.5, y - h * 0.55], [x + w, y + 0.6], [x, y + w * 0.5]];
      shape(ctx, pts, lgrad(ctx, x - w, y, x + w, y, ['#e09a70', '#b05e3c', '#6a2c1c']), edge, 0.4);
      disc(ctx, x + lean * 0.9 - 0.2, y - h * 0.86, 0.6, 'rgba(255,226,190,0.9)');
    };
    for (let i = 5; i < N - 3; i += 5) {
      const q = P(i, -1);
      wart(q[0] + (rnd() - 0.5) * 2, q[1] + 1.6, 5.4 + rnd() * 2.2, 2.8 + rnd() * 0.8, (i - N / 2) * 0.03);
    }
    // からだ
    const [, y0, , y1] = bbox(B.outline);
    shape(ctx, B.outline, vgrad(ctx, y0, y1, ['#d08a62', '#b0583a', '#8e3c28', '#b25e48']), edge, 0.6);
    within(ctx, B.outline, () => {
      // あかちゃいろの まだら（こい しみ と あかるい しみ）
      for (let k = 0; k < 46; k++) {
        const i = 3 + Math.floor(rnd() * (N - 6));
        const [x, y] = P(i, -0.9 + rnd() * 1.6);
        oval(ctx, x, y, 2.4 + rnd() * 4.4, 1.6 + rnd() * 2.6, `rgba(84,30,18,${0.2 + rnd() * 0.22})`, null, 0, rnd() * PI);
      }
      for (let k = 0; k < 20; k++) {
        const i = 3 + Math.floor(rnd() * (N - 6));
        const [x, y] = P(i, -0.8 + rnd() * 1.2);
        oval(ctx, x, y, 2 + rnd() * 3, 1.4 + rnd() * 2, 'rgba(240,180,130,0.2)', null, 0, rnd() * PI);
      }
      // おなかがわ（下）は あかるい 赤
      const belly = [];
      for (let i = 0; i < N; i++) belly.push(P(i, 0.72));
      shape(ctx, [...belly, ...B.down.slice().reverse()], 'rgba(226,120,96,0.34)', null);
    });
    sprinkle(ctx, B.outline, 420, 0.4, 'rgba(60,20,12,0.32)', 862);
    sprinkle(ctx, B.outline, 220, 0.4, 'rgba(255,214,180,0.3)', 863);
    volume(ctx, B.outline, { dark: 0.24, wide: 7, light: 0.12 });
    // せなかの いぼ（手前の 2れつ と わきの 小さな れつ）
    for (const [f, step, h, w, start] of [[-0.56, 6, 6, 3.4, 6], [-0.08, 6, 5.4, 3.2, 9], [0.4, 7, 3.4, 2.4, 7]]) {
      for (let i = start; i < N - 4; i += step) {
        const q = P(i, f + (rnd() - 0.5) * 0.12);
        wart(q[0] + (rnd() - 0.5) * 2, q[1], h * (0.8 + rnd() * 0.4), w, (i - N / 2) * 0.03);
      }
    }
    // ぬれた てり
    within(ctx, B.outline, () => {
      const hi = [];
      for (let i = 8; i < N - 8; i++) hi.push(P(i, -0.74));
      stroke(ctx, hi, 'rgba(255,240,224,0.16)', 3);
    });
    // 手前の しょくしゅ と 口
    oval(ctx, -70.6, 12.4, 3, 4.6, '#5a2014', edge, 0.4, 0.3);
    for (const [a, l] of [[118, 7.6], [142, 9], [166, 10], [190, 10.4], [214, 9.6], [240, 8.4], [264, 7]]) tentacle(a, l, true);
  },
};

// オニヒトデ（上から）: うでが 13〜16本 くらい ある 大きな ヒトデ（ここでは 14本）。からだの まんなかが ひろく まるい。
// からだじゅうに 長い どくの とげ（さされると とても いたい）。とげの 先は 赤や オレンジ。からだは あおはいいろ〜むらさき。
// サンゴを たべる ので、ふえすぎると サンゴしょうが あれる
const crownofthorns = {
  group: 'echinoderm', level: 2, similar: ['starfish', 'urchin', 'octopus'],
  box: [-47, -46, 46, 46],
  draw(ctx) {
    const edge = '#1a1a30';
    const tone = ['#a6aec8', '#626a90', '#2c3050'];
    const ARMS = 14;
    const rnd = seeded(871);
    const armA = [];
    const armR = [];
    for (let k = 0; k < ARMS; k++) {
      armA.push((k / ARMS) * PI * 2 - PI / 2 + (rnd() - 0.5) * 0.1);
      armR.push(35 + rnd() * 5);
    }
    const pol = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
    const pts = [];
    for (let k = 0; k < ARMS; k++) {
      const a = armA[k];
      const R = armR[k];
      pts.push(pol(a - PI / ARMS, 21));
      for (const [da, f] of [[-0.15, 0.66], [-0.11, 0.84], [-0.055, 0.97], [0, 1], [0.055, 0.97], [0.11, 0.84], [0.15, 0.66]]) pts.push(pol(a + da * (22 / (R * f)) * 1.5, R * f));
    }
    // とげ 1本: つけねは からだの 色、先へ オレンジ〜赤
    const spine = (x, y, ang, len, w = 0.9) => {
      const tx = x + Math.cos(ang) * len;
      const ty = y + Math.sin(ang) * len;
      thorn(ctx, x, y, ang, len, w, lgrad(ctx, x, y, tx, ty, ['#8088a8', '#c88868', '#e8502c', '#c0281c']), 'rgba(40,20,30,0.75)', 0.3);
    };
    // りんかくから 外へ 出る とげ
    for (let k = 0; k < ARMS; k++) {
      const a = armA[k];
      const R = armR[k];
      for (let j = 0; j < 5; j++) {
        const r = 23 + j * (R - 24) / 4.4;
        const hw = 5.6 - j * 0.7;
        for (const side of [-1, 1]) {
          const base = [Math.cos(a) * r - Math.sin(a) * hw * side, Math.sin(a) * r + Math.cos(a) * hw * side];
          spine(base[0], base[1], a + side * (1.05 - j * 0.12) + (rnd() - 0.5) * 0.2, 6.6 + rnd() * 2, 1);
        }
      }
      spine(Math.cos(a) * (R - 1), Math.sin(a) * (R - 1), a + (rnd() - 0.5) * 0.3, 7 + rnd() * 2, 1);
    }
    fill3d(ctx, pts, tone, edge, 0.6, [0.4, 0.36]);
    within(ctx, pts, () => {
      // うでの まんなかの うね と、うでの あいだの みぞ
      for (let k = 0; k < ARMS; k++) {
        stroke(ctx, [pol(armA[k], 12), pol(armA[k], armR[k] - 2)], 'rgba(220,226,246,0.14)', 3.4, false);
        stroke(ctx, [pol(armA[k] - PI / ARMS, 15), pol(armA[k] - PI / ARMS, 21.4)], 'rgba(20,20,44,0.4)', 0.9, false);
      }
      // あかむらさきの くすんだ まだら
      for (let k = 0; k < 40; k++) {
        const [x, y] = pol(rnd() * PI * 2, rnd() * 36);
        oval(ctx, x, y, 1.6 + rnd() * 3, 1.2 + rnd() * 2, 'rgba(150,70,90,0.22)', null, 0, rnd() * PI);
      }
    });
    sprinkle(ctx, pts, 520, 0.4, 'rgba(18,18,44,0.4)', 872);
    sprinkle(ctx, pts, 300, 0.4, 'rgba(226,232,250,0.36)', 873);
    volume(ctx, pts, { dark: 0.22, wide: 5 });
    // からだの 上の とげ（上から 見るので 外へ たおれて みじかく 見える）。かげを 先に
    const tops = [];
    for (let k = 0; k < ARMS; k++) {
      const a = armA[k];
      for (let j = 0; j < 4; j++) {
        const r = 20 + j * (armR[k] - 23) / 3.6;
        tops.push([pol(a + (j % 2 ? 0.05 : -0.05), r), a + (rnd() - 0.5) * 0.7, 4.2 + rnd() * 1.4]);
      }
    }
    for (let k = 0; k < 40; k++) {
      const a = rnd() * PI * 2;
      const r = 2 + Math.sqrt(rnd()) * 16;
      tops.push([pol(a, r), r < 4 ? rnd() * PI * 2 : a + (rnd() - 0.5) * 0.9, 3.6 + rnd() * 1.6]);
    }
    for (const [[x, y], ang, len] of tops) oval(ctx, x + 0.8, y + 1, 1.5, 1.1, 'rgba(10,10,30,0.4)');
    for (const [[x, y], ang, len] of tops) spine(x, y, ang, len, 0.85);
  },
};

// カツオノエボシ（真横）: 1ぴきに 見えるが、やくめの ちがう 小さな 個体が たくさん あつまった むれ（群体）。
// 青く すきとおった うきぶくろ（上に 三角の ほ。ふちは ピンク）で 海面に うき、風に ふかれて ながれる。
// うきぶくろの 下に ふさの ような もの（えさを たべる・ふえる ための 個体）と、こい 青の 長い しょくしゅ（つよい どく）
const manofwar = {
  group: 'jelly', level: 2, similar: ['jellyfish', 'squid', 'octopus'],
  box: [-42, -60, 42, 64],
  draw(ctx) {
    const edge = '#2a3a94';
    const rnd = seeded(881);
    // 長い しょくしゅ: じゅずの ように つぶが ならび、ところどころ らせんに ちぢむ
    const tentacle = (x0, len, amp, k, coil, seed, w = 0.7) => {
      const r = seeded(seed);
      const pts = [];
      const ph = r() * 6;
      for (let y = -18; y <= -18 + len; y += 1.1) {
        const t = (y + 18) / len;
        const c = coil && t > coil[0] && t < coil[1] ? Math.sin((t - coil[0]) * 110) * 3 : 0;
        pts.push([x0 + Math.sin(t * k + ph) * amp * (0.3 + t) + c, y]);
      }
      stroke(ctx, pts, '#22308a', w + 0.5);
      stroke(ctx, pts, '#3e5cd2', w);
      for (let i = 0; i < pts.length; i += 2) disc(ctx, pts[i][0], pts[i][1], w * 0.95 + 0.2, '#2c40ae', 'rgba(16,22,80,0.7)', 0.2);
    };
    tentacle(-13, 62, 5, 5, [0.5, 0.72], 1, 0.6);
    tentacle(13, 54, 4.4, 6, [0.3, 0.5], 2, 0.6);
    tentacle(-2, 78, 6, 4.4, [0.6, 0.86], 3, 0.85);
    tentacle(6, 68, 5.6, 5.4, [0.4, 0.62], 4, 0.7);
    tentacle(-8, 44, 3.6, 7, null, 5, 0.55);
    tentacle(18, 36, 3, 6, null, 6, 0.5);
    tentacle(-18, 30, 3, 6.6, null, 7, 0.5);
    // うきぶくろの 下の ふさ（えさを たべる つつ・ふえる ための ふさ・みじかい しょくしゅ）
    for (let k = 0; k < 46; k++) {
      const x = -22 + rnd() * 44;
      const y = -22 + rnd() * 6 + (1 - Math.abs(x) / 24) * 4;
      const len = 5 + rnd() * 9;
      const a = PI / 2 + (rnd() - 0.5) * 0.9;
      const tip = [x + Math.cos(a) * len, y + Math.sin(a) * len];
      const kind = rnd();
      if (kind < 0.5) {
        // えさを たべる つつ（青みどり。先が すこし ふくらむ）
        const A = snake([[x, y], [(x + tip[0]) / 2 + (rnd() - 0.5) * 3, (y + tip[1]) / 2], tip], [1.6, 2.2, 1.3], 10);
        shape(ctx, A.outline, lgrad(ctx, x, y, tip[0], tip[1], ['#5a8ae0', '#3aa0c8', '#e8d67a']), 'rgba(24,36,110,0.8)', 0.3);
      } else if (kind < 0.8) {
        // ふえる ための ふさ（ピンク〜むらさきの つぶ）
        for (let j = 0; j < 5; j++) disc(ctx, x + (rnd() - 0.5) * 4, y + 1 + rnd() * 6, 0.9 + rnd() * 0.7, j % 2 ? '#c884c8' : '#8e6cd0', 'rgba(60,30,110,0.7)', 0.25);
      } else {
        // みじかい まいた しょくしゅ
        const pts = [];
        for (let t = 0; t <= 1; t += 0.1) pts.push([x + Math.sin(t * 9) * 1.6, y + t * len]);
        stroke(ctx, pts, '#2c40ae', 0.8);
      }
    }
    // ほ（うきぶくろの 上の 三角の ひだ。ふちは ピンク）
    const sail = [[-25, -37], [-19, -47], [-10, -53.6], [2, -57], [13, -55.6], [22, -50], [27, -42], [29, -36]];
    const sailFill = [...sail, [20, -38], [0, -40], [-18, -38]];
    shape(ctx, sailFill, lgrad(ctx, 0, -58, 0, -38, ['#f0a8d0', '#c8b4f0', '#a8c8f8']), edge, 0.5);
    within(ctx, sailFill, () => {
      for (let k = 0; k < 13; k++) {
        const x = -22 + k * 4;
        stroke(ctx, [[x * 0.72 + 1, -38], [x * 0.92 + 1, -47], [x * 1.04 + 1, -58]], 'rgba(120,80,170,0.4)', 0.5);
        stroke(ctx, [[x * 0.72 + 2.2, -38], [x * 0.92 + 2.2, -47], [x * 1.04 + 2.2, -58]], 'rgba(255,255,255,0.4)', 0.6);
      }
      stroke(ctx, sail, 'rgba(236,100,170,0.8)', 2.2);
    });
    stroke(ctx, sail, edge, 0.5);
    // うきぶくろ（気体の 入った ふくろ。すきとおった 青むらさき。かたほうの はしが とがる）
    const float = [[-36, -27], [-33, -34], [-22, -40], [-6, -42.6], [10, -42], [24, -39.6], [34, -37.6], [39.4, -38.4, 1], [35.6, -32.6], [28, -24.6], [16, -18.4], [0, -15.6], [-16, -16.6], [-29, -20.6]];
    shape(ctx, float, lgrad(ctx, 0, -44, 0, -15, ['#d2c4f2', '#b8d0f8', '#82aaea', '#4e76d4']), null);
    within(ctx, float, () => {
      // うすい まくの しわ と、中の 気体の あかるさ
      for (let k = 0; k < 8; k++) stroke(ctx, [[-30 + k * 8.4, -42], [-33 + k * 8.6, -30], [-30 + k * 8.4, -15]], 'rgba(60,80,190,0.18)', 0.5);
      ctx.fillStyle = rgrad(ctx, -4, -30, 30, ['rgba(255,255,255,0.4)', 'rgba(255,255,255,0)']);
      ctx.fillRect(-40, -46, 80, 30);
      stroke(ctx, [[-30, -22.6], [-16, -19], [0, -18], [16, -20.6], [29, -27.6]], 'rgba(40,60,170,0.34)', 3);
      stroke(ctx, [[-27, -32], [-14, -38], [2, -40]], 'rgba(255,255,255,0.8)', 1.7);
      stroke(ctx, [[8, -40], [14, -39.4]], 'rgba(255,255,255,0.8)', 1.5);
      shape(ctx, float, null, 'rgba(236,120,180,0.3)', 2);
    });
    shape(ctx, float, null, edge, 0.6);
  },
};

export const SPECIES = {
  kingcrab,
  swimmingcrab,
  prawn,
  cuttlefish,
  nautilus,
  turban,
  clione,
  mantisshrimp,
  seacucumber,
  crownofthorns,
  manofwar,
};

// 見分けポイントの 印の 場所（sea.js の MARK_POINTS と 同じ きまり）
export const MARK_POINTS = {
  kingcrab: [[40, 3], [-40, -1], [0, 4], [13, -51]],
  swimmingcrab: [[40, -1], [47, 45], [-40, -20], [-10, 8]],
  prawn: [[8, -9], [44, 13], [53, 46], [-66, -19]],
  cuttlefish: [[-30, -25], [-36, 6], [3, -10], [-73, 0]],
  nautilus: [[30, -12], [-40, 14], [-5, 12.6], [-18, -4]],
  turban: [[-20, 14], [-40, -4], [14, 20], [28, 6]],
  clione: [[7, 10], [4.6, -43], [22, -24], [0, -12]],
  mantisshrimp: [[-48, -20.6], [18, -6], [66, 3], [-65.4, -8]],
  seacucumber: [[30, 6], [-4, -19], [-78, 14], [20, 17]],
  crownofthorns: [[27, 20], [-22, -32], [0, 3], [40, -12]],
  manofwar: [[10, -30], [4, -52], [-2, 40], [-10, -12]],
};
for (const [id, pts] of Object.entries(MARK_POINTS)) SPECIES[id].marks = pts;
