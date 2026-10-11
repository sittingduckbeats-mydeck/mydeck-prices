// Holt für alle Karten der TCGdex-Datenbank die Marktpreise (Cardmarket EUR, TCGplayer USD)
// und schreibt sie kompakt nach data/prices.json. Läuft als GitHub Action, braucht keinen Schlüssel.
import { mkdir, writeFile, readFile } from "node:fs/promises";

const API = "https://api.tcgdex.net/v2";
const LANGS = ["en", "ja"];          // en: alle internationalen Karten, ja: japanische Sets
const CONCURRENCY = 6;               // freundlich zur kostenlosen API
const PAUSE_MS = 60;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJSON(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": "mydeck-prices (github action)" } });
      if (r.status === 404) return null;
      if (r.ok) return await r.json();
    } catch (e) {}
    await sleep(1000 * (i + 1) * (i + 1));
  }
  return null;
}
const r2 = (v) => (typeof v === "number" && isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null);

function compact(p) {
  if (!p) return null;
  const cm = p.cardmarket || null, tp = p.tcgplayer || null;
  let tpm = null;
  if (tp) for (const k of ["holofoil", "holo", "normal", "reverse", "reverseHolofoil", "1stEditionHolofoil", "1stEdition"]) {
    if (tp[k] && r2(tp[k].marketPrice)) { tpm = r2(tp[k].marketPrice); break; }
  }
  const out = [
    cm ? r2(cm.trend) ?? r2(cm["trend-holo"]) : null,   // 0 Cardmarket Trend
    cm ? r2(cm.avg30) ?? r2(cm["avg30-holo"]) : null,   // 1 Cardmarket Ø 30 Tage
    cm ? r2(cm.avg7) ?? r2(cm["avg7-holo"]) : null,     // 2 Cardmarket Ø 7 Tage
    cm ? r2(cm.low) ?? r2(cm["low-holo"]) : null,       // 3 Cardmarket Preis ab
    tpm,                                                 // 4 TCGplayer Market (USD)
  ];
  return out.some((v) => v != null) ? out : null;
}

const result = { updated: new Date().toISOString(), source: "TCGdex (Cardmarket EUR, TCGplayer USD)", fields: ["cmTrend", "cmAvg30", "cmAvg7", "cmLow", "tpMarketUsd"], cards: {} };
for (const lang of LANGS) {
  const list = (await getJSON(`${API}/${lang}/cards`)) || [];
  console.log(lang, "Karten:", list.length);
  let i = 0, done = 0, withPrice = 0;
  async function worker() {
    while (i < list.length) {
      const c = list[i++];
      const full = await getJSON(`${API}/${lang}/cards/${encodeURIComponent(c.id)}`);
      const row = compact(full && full.pricing);
      if (row) { result.cards[(lang === "ja" ? "ja:" : "") + c.id] = row; withPrice++; }
      done++;
      if (done % 1000 === 0) console.log(lang, done, "/", list.length, "mit Preis:", withPrice);
      await sleep(PAUSE_MS);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(lang, "fertig, mit Preis:", withPrice);
}

await mkdir("data", { recursive: true });
// Vorherige Woche als Vergleich aufheben
try { await writeFile("data/prices-prev.json", await readFile("data/prices.json")); } catch (e) {}
await writeFile("data/prices.json", JSON.stringify(result));
console.log("Gespeichert:", Object.keys(result.cards).length, "Karten mit Preis");
