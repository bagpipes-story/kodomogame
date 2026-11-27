// catalog/animal3.js — どうぶつの ずかん画 その2: ウシ・ウマ・ゾウ・ウサギ 10種（v0.21.0）
// なかま（GROUPS）と タブ（ORDERS）は animal.js。registry.js が animal.js〜animal4.js を 1つに まとめる。
// きまり: かわいさより「その種類だと 見分けられる」こと（見分けポイント = i18n/zukan/animal.js の marks を 先に 決めて その とおりに 描く）。
// 真横から（左むき）で 立った すがた。からだは ひとつづきの りんかくで 描き、むこうがわの あしは 先に こい 色で 描く。
// オスと メスで ちがう 種類は オス。毛なみは furFlow、まるみは volume、目は mEye（draw.js）

import {
  PI, sym, ell, trace, shape, stroke, disc, oval, within, both,
  vgrad, hgrad, lgrad, rgrad, gloss, limb, seeded, fill3d, bbox, resample,
  sprinkle, volume, fur, snake, furFlow, mEye,
} from '../draw.js';

export const SPECIES = {
};

// 見分けポイントの 印の 場所（文字の marks と 同じ 数・同じ じゅん。絵の はこの 中）
export const MARK_POINTS = {
};
for (const [id, pts] of Object.entries(MARK_POINTS)) SPECIES[id].marks = pts;
