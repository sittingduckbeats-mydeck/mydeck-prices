// Lädt alle Illustratoren von TCGdex und ordnet sie den Karten im Archiv zu: illus/map.json
import fs from "node:fs";
const API = "https://api.tcgdex.net/v2";
const sets = JSON.parse(fs.readFileSync("sets.json", "utf8")), known = new Set(sets.map(s => s.k));
async function get(url, tries = 4) { for (let i = 0; i < tries; i++) { try { const r = await fetch(url); if (r.status === 404) return null; if (!r.ok) throw new Error(r.status); return await r.json(); } catch (e) { if (i === tries - 1) return null; await new Promise(s => setTimeout(s, 800 * (i + 1))); } } }
const norm = s => s.normalize("NFKC").toLowerCase().replace(/[^a-z0-9぀-ヿ一-鿿]/g, "");
const lid = s => /^0*\d+$/.test(s) ? String(parseInt(s, 10)) : s;
const groups = {}; // norm -> {variants:{name:count}, cards:Set}
let calls = 0, miss = 0;
for (const [lang, r] of [["en", "i"], ["ja", "j"]]) {
  const names = (await get(`${API}/${lang}/illustrators`)) || [];
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => { while (i < names.length) { const name = names[i++]; calls++;
    const d = await get(`${API}/${lang}/illustrators/${encodeURIComponent(name)}`); if (!d || !Array.isArray(d.cards)) { miss++; continue; }
    const key = norm(name); if (!key) continue; const g = groups[key] || (groups[key] = { v: {}, cards: new Set() });
    let n = 0; for (const c of d.cards) { const id = String(c.id || ""), l = String(c.localId || ""); if (!id || !l || !id.endsWith("-" + l)) continue;
      const set = id.slice(0, id.length - l.length - 1), k = r + ":" + set; if (!known.has(k)) continue; g.cards.add(k + "|" + lid(l)); n++; }
    g.v[name] = (g.v[name] || 0) + n; } }));
}
const clean = s => s.replace(/^"([^"]+)"\s*(\S.*?)"?$/, '"$1" $2').trim();
const list = Object.values(groups).filter(g => g.cards.size).map(g => { const best = Object.entries(g.v).sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0]; return { n: clean(best), cards: [...g.cards] }; })
  .sort((a, b) => b.cards.length - a.cards.length || a.n.localeCompare(b.n));
const m = {}; list.forEach((x, idx) => x.cards.forEach(ck => { const [k, l] = ck.split("|"); (m[k] || (m[k] = {}))[l] = idx; }));
fs.mkdirSync("illus", { recursive: true });
fs.writeFileSync("illus/map.json", JSON.stringify({ v: Date.now(), n: list.map(x => x.n), c: list.map(x => x.cards.length), m }));
console.log("Illustratoren:", list.length, "Karten:", list.reduce((a, x) => a + x.cards.length, 0), "Abrufe:", calls, "fehlgeschlagen:", miss);
