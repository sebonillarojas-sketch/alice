#!/usr/bin/env python3
"""Análisis de tipologías Nexo: distribución por tipo/dorms/metraje/segmento."""
import json, statistics as st
from collections import Counter, defaultdict

LIMA_TOP = {"Miraflores", "San Isidro", "Barranco", "San Borja", "Santiago De Surco", "La Molina"}
LIMA_MODERNA = {"Jesus Maria", "Jesús María", "Lince", "Magdalena Del Mar", "Pueblo Libre",
                "San Miguel", "Surquillo"}
LIMA_CENTRO = {"Cercado de lima", "Cercado de Lima", "Breña", "La Victoria", "Rimac", "Rímac", "Lima"}
LIMA_NORTE = {"Carabayllo", "Comas", "Independencia", "Los Olivos", "Puente Piedra",
              "San Martin De Porres", "San Martín De Porres", "Ancon", "Ancón"}
LIMA_ESTE = {"Ate", "San Juan De Lurigancho", "Santa Anita", "El Agustino", "Lurigancho", "Chaclacayo"}
LIMA_SUR = {"Chorrillos", "San Juan De Miraflores", "Villa El Salvador", "Villa Maria Del Triunfo",
            "Lurin", "Lurín", "Pachacamac", "Pachacámac", "Punta Hermosa", "San Bartolo", "Punta Negra"}
CALLAO = {"Callao", "Bellavista", "La Perla", "Carmen De La Legua Reynoso", "Ventanilla", "Mi Peru"}

def zona(d):
    if not d: return "otra"
    for z, s in [("Lima Top", LIMA_TOP), ("Lima Moderna", LIMA_MODERNA), ("Lima Centro", LIMA_CENTRO),
                 ("Lima Norte", LIMA_NORTE), ("Lima Este", LIMA_ESTE), ("Lima Sur", LIMA_SUR),
                 ("Callao", CALLAO)]:
        if d in s: return z
    return "Provincia/otra"

def bucket(a):
    for lo, hi in [(0,30),(30,40),(40,50),(50,60),(60,70),(70,80),(80,100),(100,140)]:
        if lo <= a < hi: return f"{lo}-{hi}"
    return "140+"

rows = []
proys = 0
for l in open("nexo_models.jsonl"):
    r = json.loads(l)
    if r.get("error") or not r.get("models"): continue
    proys += 1
    z = zona(r.get("distrito"))
    for m in r["models"]:
        if m.get("partial") or not m.get("dorms"): continue
        if not (18 <= m["area"] <= 400): continue
        rows.append({**m, "distrito": r.get("distrito"), "zona": z, "proy": r.get("name"),
                     "slug": r["slug"], "ppm2": (m["price"]/m["area"]) if m.get("price") else None})

print(f"proyectos con modelos: {proys} · modelos válidos: {len(rows)}\n")

print("== POR TIPO ==")
for t, c in Counter(x["type"] for x in rows).most_common():
    print(f"  {t:8s} {c:5d}  ({c/len(rows)*100:.1f}%)")

print("\n== POR DORMITORIOS (todos) ==")
for d, c in sorted(Counter(x["dorms"] for x in rows).items()):
    areas = [x["area"] for x in rows if x["dorms"] == d]
    print(f"  {d}D: {c:5d} ({c/len(rows)*100:4.1f}%)  área mediana {st.median(areas):.1f} m² · p25 {st.quantiles(areas, n=4)[0]:.1f} · p75 {st.quantiles(areas, n=4)[2]:.1f}")

print("\n== MATRIZ dorms × bucket m² (flats) ==")
flats = [x for x in rows if x["type"] == "flat"]
bks = ["0-30","30-40","40-50","50-60","60-70","70-80","80-100","100-140","140+"]
print("      " + "".join(f"{b:>9s}" for b in bks))
for d in sorted(set(x["dorms"] for x in flats)):
    cnt = Counter(bucket(x["area"]) for x in flats if x["dorms"] == d)
    print(f"  {d}D: " + "".join(f"{cnt.get(b,0):9d}" for b in bks))

print("\n== POR ZONA (modelos · área mediana · S/ por m² mediano) ==")
for z, c in Counter(x["zona"] for x in rows).most_common():
    zz = [x for x in rows if x["zona"] == z]
    pp = [x["ppm2"] for x in zz if x["ppm2"]]
    print(f"  {z:15s} {c:5d}  área med {st.median([x['area'] for x in zz]):5.1f} m²  S/{st.median(pp):,.0f}/m²")

print("\n== TIPOLOGÍA MODAL POR ZONA (dorms×bucket más frecuente, flats) ==")
for z in Counter(x["zona"] for x in flats):
    zz = [x for x in flats if x["zona"] == z]
    top = Counter((x["dorms"], bucket(x["area"])) for x in zz).most_common(3)
    s = " | ".join(f"{d}D {b} m² ×{c}" for (d, b), c in top)
    print(f"  {z:15s} {s}")

print("\n== DUPLEX: dorms y áreas ==")
dup = [x for x in rows if x["type"] in ("duplex", "triplex")]
for d, c in sorted(Counter(x["dorms"] for x in dup).items()):
    areas = [x["area"] for x in dup if x["dorms"] == d]
    print(f"  {d}D: {c:4d}  área mediana {st.median(areas):.1f} m²")

print("\n== BAÑOS por dorms (flats, moda) ==")
for d in sorted(set(x["dorms"] for x in flats)):
    bs = Counter(x["banos"] for x in flats if x["dorms"] == d).most_common(3)
    print(f"  {d}D: " + " | ".join(f"{b} baños ×{c}" for b, c in bs))

# ejemplos representativos con plano, por celda ganadora
print("\n== EJEMPLOS con plano (celdas top) ==")
target = [(1, "40-50"), (2, "50-60"), (2, "60-70"), (3, "60-70"), (3, "70-80"), (4, "80-100")]
for d, b in target:
    ex = [x for x in flats if x["dorms"] == d and bucket(x["area"]) == b and x.get("plano")]
    ex.sort(key=lambda x: x.get("units_avail") or 0, reverse=True)
    for x in ex[:2]:
        print(f"  {d}D {b}: {x['proy']} ({x['distrito']}) modelo {x['model']} {x['area']} m² "
              f"S/{x['price']:,.0f} · https://e.nexoinmobiliario.pe/customers/{x['plano']}")

json.dump(rows, open("nexo_rows.json", "w"), ensure_ascii=False)
print(f"\n{len(rows)} filas → nexo_rows.json")
