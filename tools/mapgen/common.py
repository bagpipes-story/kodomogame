"""地図の つみき（とどうふけん・せかいのくに）の 共通の 道具: りんかくの せいり・凸の 部品わけ"""
import math
import numpy
import shapely
from shapely.geometry import Polygon
from shapely.ops import unary_union


def polys_of(g):
    if hasattr(g, 'geoms'):
        return [q for q in g.geoms if q.geom_type == 'Polygon']
    return [g] if g.geom_type == 'Polygon' else []

def tf(g, fn):
    return shapely.transform(g, lambda a: numpy.array(fn(a.tolist())))

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

