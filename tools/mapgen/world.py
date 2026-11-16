"""Natural Earth（パブリックドメイン。日本から 見た 国境）から せかいのくに 60の つみきデータを 作る。
かたち = メルカトル図法（見なれた 世界地図の かたち）。大きさ = イコールアース図法（面積が 正しい）で はかった
ほんとうの 面積を もとに、面積^P で ちぢめる（ほんとうの 比の ままだと ロシアは ベルギーの やく560倍で 小さい 国が 点に なる）。
出力: JSON（id → {group, pad, draw: [rings], parts: [convex pts], lakes: [rings]}）
"""
import json, math, sys
import numpy
import shapely
from shapely.geometry import shape, Polygon, MultiPolygon
from shapely.ops import unary_union
from common import polys_of, tf, clean_ring, convex_parts, pts_of

P_EXP = float(sys.argv[3]) if len(sys.argv) > 3 else 0.24
MAX_W, MAX_H = 148, 86  # つみきの 大きさの 上限（v0.17.43。大きい 国を ほかの つみきより 大きく して 大きさの ちがいを はっきり。テストは 150×88）

# id: Natural Earth の ADM0_A3
COUNTRIES = {
    'japan': 'JPN', 'china': 'CHN', 'southKorea': 'KOR', 'india': 'IND', 'russia': 'RUS', 'uk': 'GBR', 'france': 'FRA',
    'italy': 'ITA', 'usa': 'USA', 'canada': 'CAN', 'brazil': 'BRA', 'mexico': 'MEX', 'egypt': 'EGY', 'southAfrica': 'ZAF',
    'australia': 'AUS', 'germany': 'DEU', 'spain': 'ESP', 'greece': 'GRC', 'norway': 'NOR', 'sweden': 'SWE',
    'mongolia': 'MNG', 'thailand': 'THA', 'vietnam': 'VNM', 'philippines': 'PHL', 'indonesia': 'IDN', 'saudiArabia': 'SAU',
    'kenya': 'KEN', 'argentina': 'ARG', 'chile': 'CHL', 'newZealand': 'NZL', 'portugal': 'PRT', 'netherlands': 'NLD',
    'switzerland': 'CHE', 'finland': 'FIN', 'iceland': 'ISL', 'ireland': 'IRL', 'turkey': 'TUR', 'iran': 'IRN',
    'nepal': 'NPL', 'sriLanka': 'LKA', 'malaysia': 'MYS', 'morocco': 'MAR', 'madagascar': 'MDG', 'cuba': 'CUB',
    'colombia': 'COL', 'austria': 'AUT', 'denmark': 'DNK', 'poland': 'POL', 'ukraine': 'UKR', 'belgium': 'BEL',
    'kazakhstan': 'KAZ', 'pakistan': 'PAK', 'cambodia': 'KHM', 'nigeria': 'NGA', 'ethiopia': 'ETH', 'ghana': 'GHA',
    'tanzania': 'TZA', 'algeria': 'DZA', 'peru': 'PER', 'venezuela': 'VEN',
    # v0.17.45 で 30 ふやした
    'bangladesh': 'BGD', 'myanmar': 'MMR', 'laos': 'LAO', 'uzbekistan': 'UZB', 'bhutan': 'BTN', 'oman': 'OMN',
    'romania': 'ROU', 'hungary': 'HUN', 'czechia': 'CZE', 'croatia': 'HRV', 'serbia': 'SRB', 'bulgaria': 'BGR',
    'belarus': 'BLR', 'estonia': 'EST', 'angola': 'AGO', 'sudan': 'SDN', 'libya': 'LBY', 'mali': 'MLI',
    'zambia': 'ZMB', 'namibia': 'NAM', 'uganda': 'UGA', 'coteDIvoire': 'CIV', 'cameroon': 'CMR', 'ecuador': 'ECU',
    'bolivia': 'BOL', 'paraguay': 'PRY', 'uruguay': 'URY', 'panama': 'PAN', 'costaRica': 'CRI', 'papuaNewGuinea': 'PNG',
}
GROUP = {'Asia': 'asia', 'Europe': 'europe', 'Africa': 'africa', 'North America': 'northAmerica',
         'South America': 'southAmerica', 'Oceania': 'oceania'}

# 遠い 領土は 入れない（ほんとうの 国の かたちが 小さく なって わかりにくく なる）。lon/lat の まんなかで きめる
def far_territory(cid, lon, lat):
    if cid == 'usa':
        return lon < -125 or lat > 50  # アラスカ・ハワイ
    if cid == 'norway':
        return lat > 72 or lon < 0     # スバールバル・ヤンマイエン
    if cid == 'france':
        return lon < -10 or lat < 40   # 海外県
    if cid == 'netherlands':
        return lat < 45                # カリブの 島
    if cid == 'ecuador':
        return lon < -85               # ガラパゴス
    return False

R = 6371.0
def mercator(xy):
    out = []
    for lon, lat in xy:
        lat = max(-85.0, min(85.0, lat))
        out.append((R * math.radians(lon), -R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))))
    return out

A1, A2, A3, A4 = 1.340264, -0.081106, 0.000893, 0.003796
def equal_earth(xy):
    out = []
    for lon, lat in xy:
        th = math.asin(math.sqrt(3) / 2 * math.sin(math.radians(lat)))
        t2 = th * th
        t6 = t2 * t2 * t2
        x = 2 * math.sqrt(3) * math.radians(lon) * math.cos(th) / (3 * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1))
        y = A4 * t6 * t2 * th + A3 * t6 * th + A2 * t2 * th + A1 * th
        out.append((R * x, R * y))
    return out

def unwrap(polys):
    lo = min(q.bounds[0] for q in polys)
    hi = max(q.bounds[2] for q in polys)
    if hi - lo <= 180:
        return polys
    return [shapely.affinity.translate(q, 360, 0) if q.centroid.x < 0 else q for q in polys]

D = json.load(open(sys.argv[1]))
LAKES = [shape(f['geometry']) for f in json.load(open(sys.argv[2]))['features']]
by_code = {}
for f in D['features']:
    p = f['properties']
    by_code.setdefault(p['ADM0_A3'], []).append(f)

info = {}
for cid, code in COUNTRIES.items():
    feats = by_code[code]
    assert len(feats) == 1, (cid, len(feats))
    f = feats[0]
    polys = unwrap(polys_of(shape(f['geometry'])))
    polys = [q for q in polys if not far_territory(cid, q.centroid.x, q.centroid.y)]
    merc = [tf(q, mercator) for q in polys]
    true_area = [tf(q, equal_earth).area for q in polys]
    mi = max(range(len(polys)), key=lambda i: true_area[i])
    M = merc[mi]
    size = max(M.bounds[2] - M.bounds[0], M.bounds[3] - M.bounds[1])
    keep = [i for i in range(len(polys)) if i == mi or merc[i].distance(M) <= 0.5 * size]
    info[cid] = dict(group=GROUP[f['properties']['CONTINENT']], ll=[polys[i] for i in keep], merc=[merc[i] for i in keep],
                     true=sum(true_area[i] for i in keep), merc_area=sum(merc[i].area for i in keep))

def scale_for(I, K):
    return math.sqrt(K * I['true'] ** (2 * P_EXP) / I['merc_area'])

def select(I, s):
    """その 大きさで つみきに 入れる 島（当たり判定あり=big、絵だけ=small）を えらぶ（メルカトルの 単位で かえす）"""
    big = [q for q in I['merc'] if q.area * s * s >= 24]  # 当たり判定に 入れる 島（ちいさい 島が 多い カナダ・ロシアで 部品が ふえすぎない ように）
    if not big:
        big = [max(I['merc'], key=lambda q: q.area)]
    core = unary_union(big)
    b = core.bounds
    size = max(b[2] - b[0], b[3] - b[1]) * s
    small = [q for q in I['merc'] if q not in big and q.area * s * s >= 0.8 and q.distance(core) * s <= 0.12 * size]
    return big, small

def fit(I, s):
    # えらんだ 島で はかる（入れない 北極の ちいさい 島などで ちぢまない ように）。島えらびが かわるので 2かい くりかえす
    k = 1.0
    for _ in range(3):
        big, small = select(I, s * k)
        b = unary_union(big + small).bounds
        k = min(1.0, MAX_W / ((b[2] - b[0]) * s), MAX_H / ((b[3] - b[1]) * s))
    return k

# いちばん 大きい ロシアが 上限いっぱいに なる ように きめる。ほかで 上限を こえる 国（ほそながい 国）は その国だけ ちぢめる
R0 = info['russia']
s1 = scale_for(R0, 1.0)
big, small = select(R0, s1)
b = unary_union(big + small).bounds
s_r = s1 * min(MAX_W / ((b[2] - b[0]) * s1), MAX_H / ((b[3] - b[1]) * s1))
for _ in range(3):  # 島えらびが かわっても 上限に おさまる まで
    big, small = select(R0, s_r)
    b = unary_union(big + small).bounds
    s_r *= min(MAX_W / ((b[2] - b[0]) * s_r), MAX_H / ((b[3] - b[1]) * s_r))
K = s_r ** 2 * R0['merc_area'] / R0['true'] ** (2 * P_EXP)

out = {}
for cid, I in info.items():
    s0 = scale_for(I, K)
    shrink = fit(I, s0)
    s = s0 * shrink
    sc = lambda g: shapely.affinity.scale(g, s, s, origin=(0, 0))
    bigm, smallm = select(I, s)
    big = [sc(q) for q in bigm]
    small = [sc(q) for q in smallm]
    core = unary_union(big)
    b = core.bounds
    cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
    mv = lambda g: shapely.affinity.translate(g, -cx, -cy)
    big = [mv(q) for q in big]
    small = [mv(q) for q in small]
    core = unary_union(big)
    draw = []
    for q in big + small:
        q2 = q.simplify(0.6, preserve_topology=True)  # 絵の りんかく（0.6px より こまかい でこぼこは 見えない ので はぶいて かるく）
        for qq in polys_of(q2):
            if qq.area < 0.8:
                continue
            draw.append(clean_ring(list(qq.exterior.coords)))
            for hole in qq.interiors:  # 国の 中の 別の 国（南アフリカの 中の レソト など）
                if Polygon(hole).area >= 1.5:
                    draw.append(clean_ring(list(hole.coords)))
    parts = []
    for q in big:
        q2 = q.simplify(1.4, preserve_topology=True).buffer(0)
        for qq in polys_of(q2):
            if qq.area < 6:
                continue
            for cp in convex_parts(Polygon(qq.exterior)):
                if cp.area < 2.5:
                    continue
                r = pts_of(cp)
                if len(r) >= 3 and Polygon(r).area > 2:
                    parts.append(r)
    # 湖: 国に かさなる 大きな 湖（国の 中だけ。国境の 湖も 国の ぶんだけ）
    lakes = []
    ll_union = unary_union(I['ll']).buffer(0)
    land = unary_union([Polygon(q.exterior) for q in big + small])
    for lk in LAKES:
        if not lk.intersects(ll_union):
            continue
        lk2 = mv(sc(tf(lk if ll_union.bounds[2] <= 180 or lk.centroid.x > 0 else shapely.affinity.translate(lk, 360, 0), mercator)))
        piece = lk2.intersection(land)
        for qq in polys_of(piece):
            if qq.area >= 2.5:
                lakes.append(clean_ring(list(qq.simplify(0.3).exterior.coords)))
    def bounds_of(rings):  # まるめた りんかくは ねじれる ことが あるので 点から じかに はかる
        xs = [x for r in rings for x, _ in r]
        ys = [y for r in rings for _, y in r]
        return min(xs), min(ys), max(xs), max(ys)
    bb = bounds_of(draw)
    pb = bounds_of(parts)
    pad = max(3, math.ceil(max(pb[0] - bb[0], pb[1] - bb[1], bb[2] - pb[2], bb[3] - pb[3]) + 2.5))
    out[cid] = dict(group=I['group'], pad=pad, draw=draw, parts=parts, lakes=lakes,
                    w=round(b[2] - b[0], 1), h=round(b[3] - b[1], 1), shrink=round(shrink, 2),
                    npts=sum(len(r) for r in draw), nparts=len(parts), true=round(I['true']))
json.dump(out, open(sys.argv[4], 'w'))
for cid in COUNTRIES:
    o = out[cid]
    print(f"{cid:12s} {o['group']:13s} area{o['true']:9d} w{o['w']:5.1f} h{o['h']:5.1f} pts{o['npts']:4d} parts{o['nparts']:3d} rings{len(o['draw'])} lakes{len(o['lakes'])} pad{o['pad']}" + (f" SHRINK{o['shrink']}" if o['shrink'] < 1 else ''))
