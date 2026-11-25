// registry.js — ずかん画の なかま一覧と 読み込み（v0.19.0。別冊05 §4.2）
// なかまの 絵と 文字は、そのなかまを 使う ときに はじめて 読み込む（import()）。
// 1,000種を こえても はじめの 画面が 重く ならない ように するため。読むのは アプリの 中の ファイルだけ（外部通信では ない）。
// まだ ずかん画に なって いない なかまは null（なまえあては いままでの つみきの 絵を 使う）。

const LOADERS = {
  insect: () => Promise.all([import('./catalog/insect.js'), import('../i18n/zukan/insect.js')]),
};

export function hasZukanArt(set) {
  return Object.prototype.hasOwnProperty.call(LOADERS, set);
}

const cache = new Map();

// { ids, art(id) → { minX, minY, w, h, pad, draw(ctx) }, name(id), info(id), groupName(group) }
export function loadZukanSet(set) {
  if (!hasZukanArt(set)) return Promise.resolve(null);
  if (!cache.has(set)) {
    cache.set(set, LOADERS[set]().then(([catalog, words]) => makeSet(catalog, words.ZUKAN_TEXT)));
  }
  return cache.get(set);
}

export function makeSet(catalog, words) {
  const species = catalog.SPECIES;
  const arts = new Map();
  return {
    ids: Object.keys(species),
    groups: catalog.GROUPS,
    species,
    art(id) {
      if (!arts.has(id)) {
        const sp = species[id];
        if (!sp) return null;
        const [x0, y0, x1, y1] = sp.box;
        arts.set(id, { minX: x0, minY: y0, w: x1 - x0, h: y1 - y0, pad: sp.pad ?? 4, draw: (ctx) => sp.draw(ctx) });
      }
      return arts.get(id);
    },
    name(id) {
      return words.species[id]?.name ?? '';
    },
    info(id) {
      return words.species[id] ?? null;
    },
    groupName(group) {
      return words.groups[group] ?? '';
    },
  };
}

// 絵を わくに あわせて 描く（ずかんの 小さい 絵・確認ページ で 使う）
export function drawFit(ctx, art, W, H, fit = 0.92) {
  const fullW = art.w + art.pad * 2;
  const fullH = art.h + art.pad * 2;
  const scale = Math.min(W / fullW, H / fullH) * fit;
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, W / 2 - (art.minX + art.w / 2) * scale, H / 2 - (art.minY + art.h / 2) * scale);
  art.draw(ctx);
  ctx.restore();
}
