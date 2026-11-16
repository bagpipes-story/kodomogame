// こどもゲームボックス バランスゲームの 地図の つみき（とどうふけん・せかいのくに）の 共通部分。
// v0.17.42 で pref.js から 切り出した（せかいのくに も 同じ つくり）。
// データ（絵の りんかく・当たり判定の 凸の 部品・湖）は tools/mapgen/ の 開発用スクリプトで 作る。

// 地図の かたちは そのままで、北を 上に した まま 立ちやすく する 2つの くふう（v0.17.40）。
// ほんものの 境界は 底が でこぼこで 重心の 真下に ささえが ない ことが 多く、そのままだと 47都道府県の うち 37が
// 着地で 20°いじょう かたむき、12が よこだおしに ころがって 床の 外へ 行った。
// 1) 下の 部品ほど おもく する（おきあがりこぼしの ように 重心を 下げる。いちばん 下で 31ばい）
// 2) まわりにくさを すこし 大きく（2ばい）。v0.17.40 は 20ばい だったが、たおれる はずの ときも ほとんど まわらず、
//    細い ところで ささえた まま 止まって「物理が きいていない」ように 見えたので 2ばいに（v0.17.44）。
//    2ばいなら 台から 重心が はみ出した 地図は ちゃんと おち、まんなかに 落として ころがって 行く 地図も ない
const BALLAST = 30;
const INERTIA_SCALE = 2;

const toPoints = (flat) => {
  const pts = [];
  for (let i = 0; i < flat.length; i += 2) pts.push({ x: flat[i], y: flat[i + 1] });
  return pts;
};

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

function trace(ctx, flat) {
  ctx.moveTo(flat[0], flat[1]);
  for (let i = 2; i < flat.length; i += 2) ctx.lineTo(flat[i], flat[i + 1]);
  ctx.closePath();
}

// 1つの 地図の つみき。rings は 島ごとの りんかく（国の 中の 別の 国＝穴も 入る。evenodd で ぬるので 穴に なる）
export function mapPiece([fill, line], pad, rings, parts, lakes = []) {
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
      ctx.fill('evenodd');
      if (lakes.length) {
        ctx.beginPath();
        for (const r of lakes) trace(ctx, r);
        ctx.fillStyle = '#6fb6e4';
        ctx.fill('evenodd');
        // ふちは ほそく うすく（ほそながい 湖が くろい 線に 見えたため）
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = line;
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    },
  };
}

// data: { id: [なかま, よはく, 絵の りんかく, 当たり判定の 部品, 湖?] }、colors: { なかま: [ぬり, ふち] }
export function mapPieces(data, colors) {
  return Object.fromEntries(Object.entries(data).map(([id, [group, pad, rings, parts, lakes]]) => [id, mapPiece(colors[group], pad, rings, parts, lakes)]));
}
