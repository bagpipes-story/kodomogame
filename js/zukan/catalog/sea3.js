// catalog/sea3.js — うみの ずかん画 その3: さかな 1種・ほにゅうるい 6種・とり カメ 2種（v0.20.6。30種を 足して 60種に）
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

export const SPECIES = {
};

// 見分けポイントの 印の 場所（sea.js の MARK_POINTS と 同じ きまり）
export const MARK_POINTS = {
};
for (const [id, pts] of Object.entries(MARK_POINTS)) SPECIES[id].marks = pts;
