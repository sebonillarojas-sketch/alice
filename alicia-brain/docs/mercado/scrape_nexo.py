#!/usr/bin/env python3
"""Scraper de tipologías de Nexo Inmobiliario.
Por proyecto: distrito, y por cada modelo (flat/duplex/triplex):
dorms, baños, área, precio, unidades disponibles, URL del plano."""
import json, re, subprocess, sys, time

BASE = "https://nexoinmobiliario.pe/proyecto/"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

def fetch(url, tries=3):
    for t in range(tries):
        r = subprocess.run(["curl", "-sL", "--max-time", "30", "-A", UA, url],
                           capture_output=True)
        if r.returncode == 0 and len(r.stdout) > 10000:
            return r.stdout.decode("utf-8", errors="ignore")
        time.sleep(1.5 * (t + 1))
    return None

RX_TAB = re.compile(r'id="nav-(flat|duplex|triplex)"')
RX_MODEL = re.compile(
    r'(?:(\d+)\s*unidad(?:es)?\s*disponible)?.*?'
    r'S/\s*([\d,\.]+)\s*.*?'
    r'Modelo\s*([^|<]{1,40}?)\s*\|.*?'
    r'([\d\.]+)\s*m².*?'
    r'(\d+)\s*dorms?\..*?'
    r'(\d+(?:\.\d)?)\s*baño', re.S)

def parse_project(html, slug):
    out = {"slug": slug, "models": []}
    m = re.search(r'<h1>\s*(.*?)\s*-\s*Departamentos en venta en\s*(.*?)\s*</h1>', html, re.S)
    if m:
        out["name"] = re.sub(r"\s+", " ", m.group(1)).strip()
        out["distrito"] = re.sub(r"\s+", " ", m.group(2)).strip()
    # fase y datos del propio proyecto desde el JSON embebido (primer bloque con su propio slug)
    pm = re.search(r'"min_price":"([\d\.]+)"', html)
    if pm: out["min_price_proj"] = float(pm.group(1))
    # panes por tipo
    for tab in ("flat", "duplex", "triplex"):
        i = html.find(f'id="nav-{tab}"')
        if i < 0: continue
        j = html.find('id="nav-', i + 10)
        seg = html[i:j if j > 0 else i + 400000]
        seg = re.sub(r'<svg.*?</svg>', '', seg, flags=re.S)
        seg = re.sub(r'<style.*?</style>', '', seg, flags=re.S)
        seg = re.sub(r'<script.*?</script>', '', seg, flags=re.S)
        planos = re.findall(r'data-links="([^"]+\.(?:png|jpe?g|webp))"', seg)
        txt = re.sub(r'<[^>]+>', '|', seg)
        txt = re.sub(r'\s+', ' ', txt)
        blocks = re.split(r'Ver Plano', txt)
        k = 0
        for b in blocks[1:]:
            av = re.search(r'(\d+)\s*unidad(?:es)?\s*disponible', b)
            mm = re.search(
                r'S/\s*([\d,]+).*?'
                r'Modelo\s*\|?\s*([^|]{1,50}?)\s*\|.*?([\d\.]+)\s*m².*?'
                r'(\d+)\s*dorms?\..*?([\d\.]+)\s*baño', b, re.S)
            if not mm:
                mm2 = re.search(r'Modelo\s*\|?\s*([^|]{1,50}?)\s*\|.*?([\d\.]+)\s*m²', b, re.S)
                if mm2:
                    out["models"].append({"type": tab, "model": mm2.group(1).strip(),
                                          "area": float(mm2.group(2)), "partial": True,
                                          "plano": planos[k] if k < len(planos) else None})
                    k += 1
                continue
            price, name, area, dorms, banos = mm.groups()
            out["models"].append({
                "type": tab, "model": name.strip(),
                "area": float(area), "dorms": int(dorms), "banos": float(banos),
                "price": float(price.replace(",", "")),
                "units_avail": int(av.group(1)) if av else None,
                "plano": planos[k] if k < len(planos) else None,
            })
            k += 1
    return out

def main():
    projects = json.load(open("nexo_urls.json"))
    done = set()
    try:
        for line in open("nexo_models.jsonl"):
            done.add(json.loads(line)["slug"])
    except FileNotFoundError:
        pass
    out = open("nexo_models.jsonl", "a")
    for n, p in enumerate(projects):
        if p["slug"] in done: continue
        html = fetch(p["url"])
        if html is None:
            rec = {"slug": p["slug"], "error": True}
        else:
            try:
                rec = parse_project(html, p["slug"])
                rec["cat"] = p["cat"]
                rec["distrito_slug"] = p["distrito_slug"]
            except Exception as e:
                rec = {"slug": p["slug"], "error": str(e)}
        out.write(json.dumps(rec, ensure_ascii=False) + "\n")
        out.flush()
        if n % 25 == 0:
            print(f"{n}/{len(projects)} {p['slug']}", file=sys.stderr)
        time.sleep(0.25)
    print("DONE", file=sys.stderr)

if __name__ == "__main__":
    main()
