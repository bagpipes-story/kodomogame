// registry.js — ずかん画の なかま一覧と 読み込み（v0.19.0。別冊05 §4.2）
// なかまの 絵と 文字は、そのなかまを 使う ときに はじめて 読み込む（import()）。
// 1,000種を こえても はじめの 画面が 重く ならない ように するため。読むのは アプリの 中の ファイルだけ（外部通信では ない）。
// まだ ずかん画に なって いない なかまは null（なまえあては いままでの つみきの 絵を 使う）。

// むしは 絵の ファイルを 3つに 分けて ある（insect.js = はじめの 30種と 描く 型、insect2.js = v0.19.10 の 30種、insect3.js = v0.19.12 の 30種）
const LOADERS = {
  insect: () => Promise.all([import('./catalog/insect.js'), import('./catalog/insect2.js'), import('./catalog/insect3.js'), import('../i18n/zukan/insect.js')])
    .then(([a, b, c, words]) => [mergeCatalogs(a, b, c), words]),
  // うみ: sea.js = はじめの 30種と 描く 部品（v0.20.0）、sea2〜sea4.js = v0.20.6 の 30種（さかな／ほにゅうるい・とり・カメ／エビ カニ・かい ほか）
  sea: () => Promise.all([import('./catalog/sea.js'), import('./catalog/sea2.js'), import('./catalog/sea3.js'), import('./catalog/sea4.js'), import('../i18n/zukan/sea.js')])
    .then(([a, b, c, d, words]) => [mergeCatalogs(a, b, c, d), words]),
  // どうぶつ（v0.21.0）: animal.js = なかまと タブ、animal2〜animal4.js = 絵（10種ずつ）
  animal: () => Promise.all([import('./catalog/animal.js'), import('./catalog/animal2.js'), import('./catalog/animal3.js'), import('./catalog/animal4.js'), import('../i18n/zukan/animal.js')])
    .then(([a, b, c, d, words]) => [mergeCatalogs(a, b, c, d), words]),
};

// 分けた 絵の ファイルを 1つの なかまに まとめる（なかま・目の ならびは 1つめの ファイルの もの）
export function mergeCatalogs(first, ...rest) {
  return { GROUPS: first.GROUPS, ORDERS: first.ORDERS, SPECIES: Object.assign({}, first.SPECIES, ...rest.map((m) => m.SPECIES)) };
}

export function hasZukanArt(set) {
  return Object.prototype.hasOwnProperty.call(LOADERS, set);
}

const cache = new Map();

// { ids, groups, species, art(id) → { minX, minY, w, h, pad, draw(ctx) }, name(id), info(id), groupName(group) }
// species[id].marks = 見分けポイントの 印の 場所（v0.19.3。詳細ページ）
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
    // 目（もく）。なかま（科）が どの 目か（v0.19.4）
    orders: catalog.ORDERS ?? [],
    orderName(order) {
      return words.orders?.[order] ?? '';
    },
    // 分類の 目の 名前（「コウチュウ」→ 画面で「コウチュウもく」。v0.19.5）
    taxOrderName(order) {
      return words.taxOrders?.[order] ?? '';
    },
    // その 種類の 目（v0.20.0）。うみの ように 1つの タブに いろいろな 目が まざる なかまは、種類ごとの order を 使う。
    // むしの ように タブ＝目の なかまは タブの 目の 名前
    taxOrderOf(id) {
      const sp = species[id];
      return words.species[id]?.order ?? (sp ? words.taxOrders?.[this.orderOf(sp.group)] : '') ?? '';
    },
    orderOf(group) {
      return (catalog.ORDERS ?? []).find((o) => o.groups.includes(group))?.key ?? null;
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
