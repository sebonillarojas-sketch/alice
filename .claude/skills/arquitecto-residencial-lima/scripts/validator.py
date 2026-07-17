#!/usr/bin/env python3
"""Validador geométrico de layouts residenciales ALICE.
Uso: python3 validator.py layout.json  → imprime OK o lista de errores; exit 1 si hay errores.

Formato esperado del layout (metros, origen abajo-izquierda, y+ hacia el fondo):
{
  "id": "T01", "nombre": "...", "area_techada": 41.2,
  "ambientes": [{"nombre":"sala-comedor","poligono":[[x,y],...],"zona":"social|intima|servicio","luz":true}],
  "muros": [{"a":[x,y],"b":[x,y],"espesor":0.15,"portante":false}],
  "puertas": [{"de":"exterior|<ambiente>","a":"<ambiente>","ancho":0.80}],
  "ventanas": [{"ambiente":"<nombre>","ancho":1.5,"alto":1.2}],
  "muro_humedo": {"a":[x,y],"b":[x,y]}
}
"""
import json, sys
from collections import defaultdict, deque

GRID = 0.05  # rasterización a 5 cm

AREA_MIN = {  # m2 — RNE A.020 + reglas.js
    "sala": 11, "comedor": 8, "sala-comedor": 16,
    "cocina": 4.5, "lavanderia": 2.0, "lavandería": 2.0,
    "dormitorio principal": 9.5, "dormitorio ppal": 9.5, "dormitorio": 6.5,
    "estudio": 5, "baño": 2.5, "bano": 2.5, "baño visita": 1.5,
    "hall": 1.0, "pasillo": 0.8, "terraza": 1.5, "balcon": 1.5, "balcón": 1.5,
}
ANCHO_PUERTA_MIN = {"exterior": 0.90, "baño": 0.70, "bano": 0.70, "default": 0.80}
HUMEDOS = ("baño", "bano", "cocina", "lavander")


def area_poly(pts):
    s = 0
    for i in range(len(pts)):
        x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % len(pts)]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


def raster(pts):
    """celdas (i,j) cuyo centro cae dentro del polígono (ray casting)."""
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    cells = set()
    i0, i1 = int(min(xs) / GRID), int(max(xs) / GRID) + 1
    j0, j1 = int(min(ys) / GRID), int(max(ys) / GRID) + 1
    for i in range(i0, i1):
        cx = (i + 0.5) * GRID
        for j in range(j0, j1):
            cy = (j + 0.5) * GRID
            inside = False
            for k in range(len(pts)):
                x1, y1 = pts[k]; x2, y2 = pts[(k + 1) % len(pts)]
                if (y1 > cy) != (y2 > cy) and cx < (x2 - x1) * (cy - y1) / (y2 - y1) + x1:
                    inside = not inside
            if inside:
                cells.add((i, j))
    return cells


def canon(n):
    n = n.lower().strip()
    for k in AREA_MIN:
        if n.startswith(k):
            return k
    return n


def dist_seg(p, a, b):
    ax, ay = a; bx, by = b; px, py = p
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    t = 0 if L2 == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L2))
    qx, qy = ax + t * dx, ay + t * dy
    return ((px - qx) ** 2 + (py - qy) ** 2) ** 0.5


def validar(L):
    errs, warns = [], []
    ambs = L.get("ambientes", [])
    if not ambs:
        return ["sin ambientes"], []
    rasters, areas = {}, {}
    for a in ambs:
        n = a["nombre"]
        if len(a.get("poligono", [])) < 3:
            errs.append(f"{n}: polígono inválido"); continue
        areas[n] = area_poly(a["poligono"])
        rasters[n] = raster(a["poligono"])
    # 1. áreas mínimas
    for n, ar in areas.items():
        mn = AREA_MIN.get(canon(n))
        if mn and ar < mn - 0.05:
            errs.append(f"{n}: área {ar:.2f} m² < mínimo {mn} m²")
    # 2. solapes
    names = list(rasters)
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            ov = len(rasters[names[i]] & rasters[names[j]]) * GRID * GRID
            if ov > 0.02:
                errs.append(f"solape {names[i]} ∩ {names[j]} = {ov:.2f} m²")
    # 3. suma de áreas vs area_techada
    tot = sum(areas.values())
    at = L.get("area_techada")
    if at:
        if tot > at * 1.02:
            errs.append(f"suma ambientes {tot:.1f} m² > área techada {at} m²")
        if tot < at * 0.75:
            warns.append(f"suma ambientes {tot:.1f} m² muy por debajo de {at} m² (muros/desperdicio > 25%)")
    # 4. conectividad por puertas desde exterior
    g = defaultdict(set)
    for p in L.get("puertas", []):
        g[p["de"]].add(p["a"]); g[p["a"]].add(p["de"])
        # ancho mínimo
        key = "exterior" if "exterior" in (p["de"], p["a"]) else (
            "baño" if any(canon(x).startswith("bañ") or canon(x).startswith("ban") for x in (p["de"], p["a"])) else "default")
        if p.get("ancho", 0) < ANCHO_PUERTA_MIN[key] - 1e-6:
            errs.append(f"puerta {p['de']}→{p['a']}: ancho {p.get('ancho')} < {ANCHO_PUERTA_MIN[key]}")
        # adyacencia geométrica de los dos ambientes
        for x in (p["de"], p["a"]):
            if x != "exterior" and x not in rasters:
                errs.append(f"puerta referencia ambiente inexistente: {x}")
    vis, q = {"exterior"}, deque(["exterior"])
    while q:
        u = q.popleft()
        for v in g[u]:
            if v not in vis:
                vis.add(v); q.append(v)
    transitables = [n for n in areas if not canon(n).startswith(("terraza", "balc"))]
    for n in transitables:
        if n not in vis:
            errs.append(f"{n}: inaccesible desde el ingreso (grafo de puertas)")
    # 5. iluminación 1/8 en ambientes con luz:true
    vent = defaultdict(float)
    for v in L.get("ventanas", []):
        vent[v["ambiente"]] += v.get("ancho", 0) * v.get("alto", 0)
    for a in ambs:
        if a.get("luz"):
            n = a["nombre"]
            req = areas.get(n, 0) / 8
            if vent[n] + 1e-6 < req:
                errs.append(f"{n}: ventanas {vent[n]:.2f} m² < 1/8 del área ({req:.2f} m²)")
    # 6. húmedos cerca del muro húmedo
    mh = L.get("muro_humedo")
    if mh:
        for a in ambs:
            if canon(a["nombre"]).startswith(HUMEDOS) or any(h in a["nombre"].lower() for h in HUMEDOS):
                dmin = min(dist_seg(p, mh["a"], mh["b"]) for p in a["poligono"])
                if dmin > 0.6:
                    errs.append(f"{a['nombre']}: a {dmin:.2f} m del muro húmedo (>0.60)")
    else:
        warns.append("layout sin muro_humedo declarado")
    return errs, warns


if __name__ == "__main__":
    data = json.load(open(sys.argv[1]))
    layouts = data if isinstance(data, list) else [data]
    bad = 0
    for L in layouts:
        errs, warns = validar(L)
        tag = L.get("id", L.get("nombre", "?"))
        if errs:
            bad += 1
            print(f"✗ {tag}:")
            for e in errs: print(f"   ERROR {e}")
        else:
            print(f"✓ {tag} OK")
        for w in warns: print(f"   warn  {w}")
    sys.exit(1 if bad else 0)
