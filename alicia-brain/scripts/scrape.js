#!/usr/bin/env node
// scrape.js — White Rabbit local scraper
// Runs on the Mac (needs browser), pushes data to alicia-brain API
//
// Usage:
//   node scripts/scrape.js              — todo (nexo + urbania + banks)
//   node scripts/scrape.js nexo         — solo Nexo (proyectos)
//   node scripts/scrape.js urbania      — solo Urbania (venta)
//   node scripts/scrape.js banks        — solo SBS (tasas)
//   node scripts/scrape.js all --dry-run — scrapea y muestra, sin pushear (prueba segura)
//
// Setup (one-time):
//   npm install && npx playwright install chromium

import { chromium } from "playwright";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { extractDetailUrls, parseDetail } from "../src/scrapers/urbania.js";
import { scrapeNexoLima } from "../src/scrapers/nexo.js";
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BRAIN_URL   = process.env.BRAIN_URL || "http://localhost:3001";
const AUTH_TOKEN  = process.env.MARKET_REFRESH_TOKEN || "white-rabbit";
const DRY         = process.argv.includes("--dry-run");   // scrapea pero NO pushea (prueba segura, no toca prod)
const TARGET      = (process.argv[2] && !process.argv[2].startsWith("--")) ? process.argv[2] : "all";

// ── Push to alicia-brain ──────────────────────────────────────────────────────
async function pushToAPI(endpoint, data) {
  const res = await fetch(`${BRAIN_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`API ${endpoint} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

// ── Nexo Inmobiliario ─────────────────────────────────────────────────────────
async function scrapeNexo(page) {
  console.log("🐰 Nexo: iniciando scrape...");
  const projects = [];
  let pageNum = 1;
  let hasMore = true;

  while (hasMore && pageNum <= 30) {
    const url = `https://nexoinmobiliario.pe/busqueda?tipoInmueble=departamento&pagina=${pageNum}`;
    console.log(`  → página ${pageNum}: ${url}`);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000 + Math.random() * 1000);

    // Extract project cards
    const cards = await page.evaluate(() => {
      const results = [];
      // Nexo uses various selectors - try common ones
      const selectors = [
        ".proyecto-item",
        "[data-proyecto]",
        ".card-proyecto",
        ".proyecto-card",
        ".result-item",
        "[class*='proyecto']",
      ];

      let items = [];
      for (const sel of selectors) {
        items = document.querySelectorAll(sel);
        if (items.length > 0) break;
      }

      // If no specific cards found, try extracting from JSON-LD or meta
      if (items.length === 0) {
        // Try to find structured data
        const lds = document.querySelectorAll('script[type="application/ld+json"]');
        for (const ld of lds) {
          try {
            const d = JSON.parse(ld.textContent);
            if (Array.isArray(d)) results.push(...d);
            else if (d["@graph"]) results.push(...d["@graph"]);
            else results.push(d);
          } catch (e) {}
        }
        if (results.length > 0) return { type: "ld+json", items: results };

        // Try extracting data from visible elements
        const allCards = document.querySelectorAll("article, .item, li[class*='result']");
        items = allCards;
      }

      const extracted = [];
      for (const item of items) {
        const text = item.textContent;
        const link = item.querySelector("a");
        const priceEl = item.querySelector("[class*='precio'], [class*='price']");
        const nameEl = item.querySelector("h2, h3, [class*='nombre'], [class*='name'], [class*='titulo']");
        const distEl = item.querySelector("[class*='distrito'], [class*='ubicacion'], [class*='location']");

        if (!nameEl && !link) continue;

        extracted.push({
          name:     nameEl?.textContent?.trim() || "",
          url:      link?.href || "",
          price:    priceEl?.textContent?.trim() || "",
          district: distEl?.textContent?.trim() || "",
          raw:      text.slice(0, 200),
        });
      }
      return { type: "cards", items: extracted };
    });

    if (cards.items.length === 0) {
      console.log(`  → página ${pageNum}: sin resultados, terminando`);
      hasMore = false;
      break;
    }

    console.log(`  → página ${pageNum}: ${cards.items.length} items (${cards.type})`);
    projects.push(...cards.items.map(c => ({
      source: "nexo",
      ...c,
      page: pageNum,
    })));

    // Check if there's a next page
    const nextPage = await page.$("[rel='next'], .pagination-next:not(.disabled), [class*='next']:not(.disabled)");
    if (!nextPage) hasMore = false;
    pageNum++;
  }

  console.log(`✅ Nexo: ${projects.length} proyectos scraped`);
  return projects;
}

// ── SBS Bank Rates ────────────────────────────────────────────────────────────
async function scrapeSBSRates(page) {
  console.log("🐰 SBS: scrapeando tasas hipotecarias por banco...");

  // SBS comparison tool - mortgage rates
  await page.goto("https://www.sbs.gob.pe/app/pp/modtasa/index.htm", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(3000);

  // Try to select "Hipotecario" product
  const rates = [];

  try {
    // Look for product selector and choose hipotecario
    const productSel = await page.$(
      "select[name*='producto'], select[id*='producto'], select[id*='tip'], #ddlTipo"
    );
    if (productSel) {
      await productSel.selectOption({ label: /[Hh]ipotecari/ });
      await page.waitForTimeout(2000);
    }

    // Scrape the rates table
    const tableData = await page.evaluate(() => {
      const rows = document.querySelectorAll("table tr, .rates-table tr");
      const data = [];
      for (const row of rows) {
        const cells = row.querySelectorAll("td, th");
        if (cells.length >= 2) {
          data.push(Array.from(cells).map(c => c.textContent.trim()));
        }
      }
      return data;
    });

    console.log("  SBS table rows:", tableData.length);

    // Parse bank names and rates
    const bankKeywords = ["BCP", "BBVA", "Scotiabank", "Interbank", "Pichincha", "Continental", "GNB", "MiBanco", "Crediscotia", "Banbif"];
    for (const row of tableData) {
      const rowText = row.join(" ");
      const bank = bankKeywords.find(b => rowText.includes(b));
      if (bank) {
        const rateMatch = rowText.match(/(\d+[.,]\d+)/g);
        if (rateMatch) {
          rates.push({
            bank,
            rate_pen: parseFloat(rateMatch[0]?.replace(",", ".")),
            rate_usd: rateMatch[1] ? parseFloat(rateMatch[1].replace(",", ".")) : null,
            currency: "PEN",
            plazo: 20,
            source: "sbs",
            product: "hipotecario",
          });
        }
      }
    }
  } catch (e) {
    console.warn("  SBS table parse error:", e.message);
  }

  // If SBS didn't work, try individual bank pages
  if (rates.length < 3) {
    console.log("  SBS table empty, trying individual bank pages...");
    const bankPages = [
      {
        bank: "BCP",
        url: "https://www.viabcp.com/prestamos/hipotecario/tasas",
        ratePattern: /(\d+[.,]\d+)\s*%/g,
      },
      {
        bank: "BBVA",
        url: "https://www.bbva.pe/personas/prestamos/credito-hipotecario/tasas-y-comisiones.html",
        ratePattern: /(\d+[.,]\d+)\s*%/g,
      },
      {
        bank: "Scotiabank",
        url: "https://www.scotiabank.com.pe/Personas/Prestamos/Hipotecario/Tasas-y-Comisiones",
        ratePattern: /(\d+[.,]\d+)\s*%/g,
      },
      {
        bank: "Interbank",
        url: "https://interbank.pe/prestamos/hipotecario/tasas",
        ratePattern: /(\d+[.,]\d+)\s*%/g,
      },
    ];

    for (const b of bankPages) {
      try {
        await page.goto(b.url, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(2000);

        const text = await page.evaluate(() => document.body.innerText);
        const rateMatches = [...text.matchAll(/(\d+[.,]\d+)\s*%/g)]
          .map(m => parseFloat(m[1].replace(",", ".")))
          .filter(r => r > 3 && r < 25); // plausible mortgage rates

        if (rateMatches.length > 0) {
          rates.push({
            bank: b.bank,
            rate_pen: rateMatches[0],
            rate_usd: rateMatches.find(r => r < 8 && r !== rateMatches[0]) || null,
            currency: "PEN",
            plazo: 20,
            source: "bank_page",
            product: "hipotecario",
          });
          console.log(`  ✅ ${b.bank}: ${rateMatches[0]}%`);
        }
      } catch (e) {
        console.warn(`  ⚠️ ${b.bank}: ${e.message.slice(0, 60)}`);
      }
    }
  }

  console.log(`✅ Tasas por banco: ${rates.length} entidades`);
  return rates;
}

// ── Main ──────────────────────────────────────────────────────────────────────
// ── Urbania (venta) ───────────────────────────────────────────────────────────
// Urbania está tras Cloudflare managed challenge → el browser real de la bestia +
// la IP residencial de Lima lo pasan sin proxy pago. Reusa los parsers PUROS de
// src/scrapers/urbania.js (extractDetailUrls/parseDetail), solo cambia el transporte
// (renderFetch/ScrapingBee → este page de Playwright).
const URBANIA_DISTRICTS = [
  "lima", "miraflores", "san-isidro", "barranco", "surco",
  "san-borja", "jesus-maria", "magdalena-del-mar", "san-miguel", "pueblo-libre",
];
async function scrapeUrbania(page, maxDetails = 40) {
  console.log("🐰 Urbania: iniciando scrape (browser real + IP residencial)...");
  const detailUrls = new Set();
  for (const d of URBANIA_DISTRICTS) {
    if (detailUrls.size >= maxDetails) break;
    const slug = d === "lima" ? "venta-de-departamentos-en-lima" : `venta-de-departamentos-en-${d}-lima`;
    try {
      await page.goto(`https://urbania.pe/buscar/${slug}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2500 + Math.random() * 1000);
      for (const u of extractDetailUrls(await page.content())) detailUrls.add(u);
    } catch (e) { console.warn(`  Urbania búsqueda ${d}: ${e.message}`); }
  }
  const urls = [...detailUrls].slice(0, maxDetails);
  const projects = [];
  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2000);
      const rec = parseDetail(await page.content(), url, 3.4);
      if (rec && rec.district) projects.push({ source: "urbania", ...rec });
    } catch (e) { console.warn(`  Urbania detalle: ${e.message}`); }
  }
  console.log(`✅ Urbania: ${projects.length} proyectos de ${urls.length} detalles`);
  return projects;
}

async function main() {
  console.log(`\n🐰 White Rabbit Scraper · target: ${TARGET}\n`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    locale: "es-PE",
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { "Accept-Language": "es-PE,es;q=0.9,en;q=0.8" },
  });
  const page = await context.newPage();

  try {
    if (TARGET === "nexo" || TARGET === "all") {
      const projects = await scrapeNexoLima();   // fetch directo + search_data (IP Lima); reemplaza el scraper viejo por selectores
      if (projects.length > 0) {
        if (DRY) console.log(`  [dry-run] ${projects.length} proyectos Nexo — NO se pushea`);
        else { const result = await pushToAPI("/api/market-import", { type: "projects", source: "nexo", projects }); console.log("API response:", result); }
      }
    }

    if (TARGET === "urbania" || TARGET === "all") {
      const projects = await scrapeUrbania(page);
      if (projects.length > 0) {
        if (DRY) console.log(`  [dry-run] ${projects.length} proyectos Urbania — NO se pushea · muestra: ${JSON.stringify(projects[0]).slice(0, 200)}`);
        else { const result = await pushToAPI("/api/market-import", { type: "projects", source: "urbania", projects }); console.log("API response:", result); }
      }
    }

    if (TARGET === "banks" || TARGET === "all") {
      const rates = await scrapeSBSRates(page);
      if (rates.length > 0) {
        if (DRY) console.log(`  [dry-run] ${rates.length} tasas SBS — NO se pushea`);
        else { const result = await pushToAPI("/api/market-import", { type: "bank_rates", rates }); console.log("API response:", result); }
      }
    }
  } finally {
    await browser.close();
  }

  console.log("\n✅ Scraper terminado\n");
}

main().catch(e => {
  console.error("❌ Scraper error:", e.message);
  process.exit(1);
});
