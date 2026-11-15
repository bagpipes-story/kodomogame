};

const toPoints = (flat) => {
  const pts = [];
  for (let i = 0; i < flat.length; i += 2) pts.push({ x: flat[i], y: flat[i + 1] });
  return pts;
};
function trace(ctx, flat) {
  ctx.moveTo(flat[0], flat[1]);
  for (let i = 2; i < flat.length; i += 2) ctx.lineTo(flat[i], flat[i + 1]);
  ctx.closePath();
}

// 地図の かたちは そのままで、北を 上に した まま 立ちやすく する 2つの くふう。
// ほんものの 県境は 底が でこぼこで 重心の 真下に ささえが ない ことが 多く、そのままだと 47のうち 37が
// 着地で 20°いじょう かたむき、12が よこだおしに ころがって 床の 外へ 行った。
// 1) 下の 部品ほど おもく する（おきあがりこぼしの ように 重心を 下げる。いちばん 下で 31ばい）
// 2) まわりにくさを 20ばいに（ゆっくり かたむく あいだに ゆれが おさまって 止まる）。
//    積みやすさは ほとんど かわらない（シミュレーション: 1ばいでも 20ばいでも 15こ中 14〜15こ 積める）
const BALLAST = 30;
const INERTIA_SCALE = 20;
function ballast(parts) {
  const pts = parts.map(toPoints);
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) for (const v of p) { minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); }
  return pts.map((points) => {
    const cy = points.reduce((s, v) => s + v.y, 0) / points.length;
    const t = (cy - minY) / (maxY - minY || 1); // 0=上 1=下
    return { points, density: Math.round(0.002 * (1 + BALLAST * t ** 3) * 1e5) / 1e5 };
  });
}

function prefPiece(region, pad, rings, parts, lake) {
  const [fill, line] = REGION_COLOR[region];
  return {
    color: fill,
    line,
    pad, // 絵だけの ちいさい 島・ほそい みさきと ふちの 線の ぶん
    parts: ballast(parts),
    inertiaScale: INERTIA_SCALE, // kit.js の buildPieceBody が つかう
    draw(ctx) {
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (const r of rings) trace(ctx, r);
      ctx.strokeStyle = line;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = fill;
      ctx.fill();
      if (lake) {
        ctx.beginPath();
        trace(ctx, lake);
        ctx.fillStyle = '#6fb6e4';
        ctx.fill();
        ctx.strokeStyle = line;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    },
  };
}

export const PREF_PIECES = Object.fromEntries(Object.entries(DATA).map(([id, [region, pad, rings, parts, lake]]) => [id, prefPiece(region, pad, rings, parts, lake)]));
