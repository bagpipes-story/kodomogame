"""Natural Earth (public domain) から 47都道府県の つみきデータを作る。
出力: JSON（id → {region, draw: [rings], parts: [convex pts], lake?}）
"""
import json, math, sys
import shapely
from shapely.geometry import shape, Polygon, MultiPolygon, LineString
from shapely.ops import unary_union

P_EXP = float(sys.argv[3]) if len(sys.argv) > 3 else 0.3  # 見た目の大きさ ∝ 面積^P_EXP（ほんとうは 0.5）

IDS = ['hokkaido', 'aomori', 'iwate', 'miyagi', 'akita', 'yamagata', 'fukushima', 'ibaraki', 'tochigi', 'gunma',
       'saitama', 'chiba', 'tokyo', 'kanagawa', 'niigata', 'toyama', 'ishikawa', 'fukui', 'yamanashi', 'nagano',
       'gifu', 'shizuoka', 'aichi', 'mie', 'shiga', 'kyoto', 'osaka', 'hyogo', 'nara', 'wakayama', 'tottori',
       'shimane', 'okayama', 'hiroshima', 'yamaguchi', 'tokushima', 'kagawa', 'ehime', 'kochi', 'fukuoka', 'saga',
       'nagasaki', 'kumamoto', 'oita', 'miyazaki', 'kagoshima', 'okinawa']
REGION = {}
for i, rid in enumerate(IDS, 1):
    REGION[rid] = ('hokkaido' if i == 1 else 'tohoku' if i <= 7 else 'kanto' if i <= 14 else 'chubu' if i <= 23
                   else 'kinki' if i <= 30 else 'chugoku' if i <= 35 else 'shikoku' if i <= 39 else 'kyushu')

D = json.load(open(sys.argv[1]))
LAKES = json.load(open(sys.argv[2]))
biwa = next(shape(f['geometry']) for f in LAKES['features'] if f['properties'].get('name_ja') == '琵琶湖')

def polys_of(g):
    if hasattr(g, 'geoms'):
        return [q for q in g.geoms if q.geom_type == 'Polygon']
    return [g] if g.geom_type == 'Polygon' else []

feat = {}
for f in D['features']:
    code = int(f['properties']['iso_3166_2'].split('-')[1])
    feat[IDS[code - 1]] = shape(f['geometry'])

def projector(main):
    lat0, lon0 = main.centroid.y, main.centroid.x
    k = math.cos(math.radians(lat0))
    return lambda xy: [((x - lon0) * k * 111.32, -(y - lat0) * 110.57) for x, y in xy]

def tf(g, fn):
    return shapely.transform(g, lambda a: __import__('numpy').array(fn(a.tolist())))

# 1) km に なおして、つみきに 入れる 島を えらぶ
info = {}
for pid, g in feat.items():
    polys = polys_of(g)
    main_ll = max(polys, key=lambda q: q.area)
    fn = projector(main_ll)
    P = [tf(q, fn) for q in polys]
    M = max(P, key=lambda q: q.area)
    size = max(M.bounds[2] - M.bounds[0], M.bounds[3] - M.bounds[1])
    big = [q for q in P if q is M or (q.area >= 0.03 * M.area and q.distance(M) <= 0.6 * size)]
    if pid == 'shimane':  # おきの島じまは ひとまとまりで（大きい 島だけだと 中途はんぱ）
        dogo = [q for q in big if q is not M]
        big = [M] + [q for q in P if q is not M and q.area >= 20 and dogo and q.distance(dogo[0]) < 25] + dogo
        big = list({id(q): q for q in big}.values())
    core = unary_union(big)
    small = [q for q in P if q not in big and q.distance(core) <= 0.06 * size]  # 絵だけの ちいさい 島（近い ものだけ）
    info[pid] = dict(fn=fn, big=big, small=small, area=sum(q.area for q in big))

AH = info['hokkaido']['area']
hb = unary_union(info['hokkaido']['big']).bounds
sH = min(100 / (hb[2] - hb[0]), 80 / (hb[3] - hb[1])) * 0.985

def clean_ring(coords):
    out = []
    for x, y in coords:
        p = (round(x, 1), round(y, 1))
        if not out or abs(p[0] - out[-1][0]) + abs(p[1] - out[-1][1]) > 0.05:
            out.append(p)
    if len(out) > 1 and out[0] == out[-1]:
        out.pop()
    return out

def convex_parts(poly):
    """凸の 部品に わける: 三角に わけてから、となりどうしを 凸の ままなら つなぐ（Hertel-Mehlhorn ふう）"""
    tris = [t for t in polys_of(shapely.constrained_delaunay_triangles(poly)) if t.area > 1e-6]
    pieces = [t for t in tris]
    changed = True
    while changed:
        changed = False
        best = None
        for i in range(len(pieces)):
            for j in range(i + 1, len(pieces)):
                a, b = pieces[i], pieces[j]
                inter = a.intersection(b)
                if inter.length < 1e-6:
                    continue
                u = unary_union([a, b])
                if u.geom_type != 'Polygon':
                    continue
                if u.convex_hull.area - u.area < 0.002 * u.area + 1e-6:
                    if best is None or u.area > best[2].area:
                        best = (i, j, u)
        if best:
            i, j, u = best
            pieces = [p for k, p in enumerate(pieces) if k not in (i, j)] + [u.convex_hull]
            changed = True
    return pieces

def pts_of(poly):
    ring = clean_ring(list(poly.exterior.coords))
    # まるめた あとで 凸に もどす（まるめで ほんの すこし へこむ ことが あるため）
    hull = Polygon(ring).convex_hull
    ring = clean_ring(list(hull.exterior.coords))
    # ほぼ 一直線の 点を のぞく
    changed = True
    while changed and len(ring) > 3:
        changed = False
        for i in range(len(ring)):
            a, b, c = ring[i - 1], ring[i], ring[(i + 1) % len(ring)]
            cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
            if abs(cross) < 0.05 or math.hypot(b[0] - a[0], b[1] - a[1]) < 0.6:
                ring.pop(i)
                changed = True
                break
    return ring

out = {}
for pid in IDS:
    I = info[pid]
    s = sH * (I['area'] / AH) ** (P_EXP - 0.5)
    sc = lambda g: shapely.affinity.scale(g, s, s, origin=(0, 0))
    big = [sc(q) for q in I['big']]
    small = [sc(q) for q in I['small']]
    core = unary_union(big)
    b = core.bounds
    cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
    mv = lambda g: shapely.affinity.translate(g, -cx, -cy)
    big = [mv(q) for q in big]
    small = [mv(q) for q in small if q.area >= 1.2]
    # 絵: すこし だけ かんたんに（0.3px）
    draw = []
    for q in big + small:
        q2 = q.simplify(0.3, preserve_topology=True)
        for qq in polys_of(q2):
            if qq.area < 0.8:
                continue
            draw.append(clean_ring(list(qq.exterior.coords)))
    # 当たり判定: もっと かんたんに（1.1px）して 凸に わける。小さな 部品は すてる
    parts = []
    for q in big:
        q2 = q.simplify(1.1, preserve_topology=True).buffer(0)
        for qq in polys_of(q2):
            if qq.area < 6:
                continue
            for cp in convex_parts(Polygon(qq.exterior)):
                if cp.area < 2.5:
                    continue
                r = pts_of(cp)
                if len(r) >= 3 and Polygon(r).area > 2:
                    parts.append(r)
    lake = None
    if pid == 'shiga':
        lk = tf(biwa, I['fn'])
        lk = mv(sc(lk)).simplify(0.3)
        lake = clean_ring(list(lk.exterior.coords))
    bb = unary_union([Polygon(r) for r in draw]).bounds
    pb = unary_union([Polygon(r) for r in parts]).bounds
    pad = max(3, math.ceil(max(pb[0] - bb[0], pb[1] - bb[1], bb[2] - pb[2], bb[3] - pb[3]) + 2.5))
    out[pid] = dict(region=REGION[pid], pad=pad, draw=draw, parts=parts, lake=lake, scale=round(s, 4),
                    w=round(b[2] - b[0], 1), h=round(b[3] - b[1], 1), npts=sum(len(r) for r in draw), nparts=len(parts))
json.dump(out, open(sys.argv[4] if len(sys.argv) > 4 else 'pref.json', 'w'))
for pid in IDS:
    o = out[pid]
    print(f"{pid:10s} w{o['w']:5.1f} h{o['h']:5.1f} pts{o['npts']:4d} parts{o['nparts']:3d} rings{len(o['draw'])} pad{o['pad']}")
