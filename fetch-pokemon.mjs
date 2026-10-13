// Lädt alle Pokémon (Name DE/EN, Generation) von PokeAPI und das offizielle Artwork,
// verkleinert es und packt je 100 Bilder in ein Sprite: dex/s<k>.webp + dex/pokemon.json
import fs from "node:fs";
import sharp from "sharp";
const RAW = "https://raw.githubusercontent.com/PokeAPI";
const C = 128, COLS = 10, PER = 100, Q = 72;
async function get(url, type = "text", tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.status === 404) return null; if (!r.ok) throw new Error(r.status);
      return type === "text" ? await r.text() : Buffer.from(await r.arrayBuffer()); }
    catch (e) { if (i === tries - 1) return null; await new Promise(s => setTimeout(s, 700 * (i + 1))); }
  }
}
function csv(t) { const L = t.trim().split(/\r?\n/), h = L[0].split(","); return L.slice(1).map(l => { const v = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(x => x.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')); const o = {}; h.forEach((k, i) => o[k] = v[i]); return o; }); }
const sp = csv(await get(`${RAW}/pokeapi/master/data/v2/csv/pokemon_species.csv`));
const nm = csv(await get(`${RAW}/pokeapi/master/data/v2/csv/pokemon_species_names.csv`));
const de = {}, en = {}, ko = {}, ja = {};
for (const r of nm) { if (r.local_language_id === "6") de[r.pokemon_species_id] = r.name; if (r.local_language_id === "9") en[r.pokemon_species_id] = r.name; if (r.local_language_id === "3") ko[r.pokemon_species_id] = r.name; if (r.local_language_id === "1") ja[r.pokemon_species_id] = r.name; }
const list = sp.map(s => [+s.id, de[s.id] || en[s.id] || s.identifier, en[s.id] || s.identifier, +s.generation_id, ko[s.id] || "", ja[s.id] || ""]).sort((a, b) => a[0] - b[0]);
console.log("Pokémon:", list.length);
fs.mkdirSync("dex", { recursive: true });
const bufs = new Array(list.length);
let i = 0;
await Promise.all(Array.from({ length: 12 }, async () => { while (i < list.length) { const k = i++, id = list[k][0];
  const b = await get(`${RAW}/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`, "buf");
  if (b) try { bufs[k] = await sharp(b).resize(C, C, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(); } catch {} } }));
const miss = list.filter((x, k) => !bufs[k]).map(x => x[0]); console.log("ohne Bild:", miss.length, miss.slice(0, 30));
for (let s = 0; s * PER < list.length; s++) {
  const part = list.slice(s * PER, s * PER + PER), rows = Math.ceil(part.length / COLS);
  const comp = part.map((x, j) => bufs[s * PER + j] ? { input: bufs[s * PER + j], left: (j % COLS) * C, top: Math.floor(j / COLS) * C } : null).filter(Boolean);
  await sharp({ create: { width: COLS * C, height: rows * C, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(comp).webp({ quality: Q, alphaQuality: 80 }).toFile(`dex/s${s}.webp`);
}
fs.writeFileSync("dex/pokemon.json", JSON.stringify({ v: Date.now(), cell: C, cols: COLS, per: PER, noimg: miss, list }));
