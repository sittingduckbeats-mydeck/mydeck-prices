// Lädt die Kartenbilder von TCGdex und packt sie je Set in ein Bild-Raster (Sprite).
// Ausgabe: img/<r>_<set>.webp und img/map.json  { "<r>:<set>": { f, c, w, h, ids:[localId…] } }
import fs from "node:fs";
import sharp from "sharp";

const W = +(process.env.CELL_W || 120), H = +(process.env.CELL_H || 166), COLS = 12;
const Q = +(process.env.QUALITY || 68), FORCE = process.env.FORCE === "1";
const API = "https://api.tcgdex.net/v2";
const sets = JSON.parse(fs.readFileSync("sets.json", "utf8"));
fs.mkdirSync("img", { recursive: true });
const mapPath = "img/map.json";
const map = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, "utf8")) : {};

async function get(url, type = "json", tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(r.status);
      return type === "json" ? await r.json() : Buffer.from(await r.arrayBuffer());
    } catch (e) { if (i === tries - 1) return null; await new Promise(s => setTimeout(s, 800 * (i + 1))); }
  }
}
async function pool(items, n, fn) {
  let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}
const safe = s => s.replace(/[^A-Za-z0-9._-]/g, "_");

let done = 0, imgs = 0;
for (const s of sets) {
  const file = `${s.r}_${safe(s.id)}.webp`;
  if (!FORCE && map[s.k] && fs.existsSync("img/" + file) && map[s.k].n === s.ids.length) { done++; continue; }
  const langs = s.r === "j" ? ["ja"] : ["de", "en", "fr", "it", "es"];
  const urls = {};
  for (const l of langs) {
    if (s.ids.every(id => urls[id])) break;
    const d = await get(`${API}/${l}/sets/${encodeURIComponent(s.id)}`);
    for (const c of d?.cards || []) if (c.image && !urls[c.localId]) urls[c.localId] = c.image + "/low.webp";
  }
  const ids = s.ids.filter(id => urls[id]);
  const bufs = new Array(ids.length);
  await pool(ids, 12, async (id, k) => {
    const b = await get(urls[id], "buf");
    if (b) try { bufs[k] = await sharp(b).resize(W, H, { fit: "fill" }).toBuffer(); } catch {}
  });
  const ok = ids.map((id, k) => [id, bufs[k]]).filter(x => x[1]);
  if (!ok.length) { delete map[s.k]; done++; console.log(s.k, "keine Bilder"); continue; }
  const rows = Math.ceil(ok.length / COLS);
  await sharp({ create: { width: COLS * W, height: rows * H, channels: 3, background: "#1b2240" } })
    .composite(ok.map(([, b], k) => ({ input: b, left: (k % COLS) * W, top: Math.floor(k / COLS) * H })))
    .webp({ quality: Q }).toFile("img/" + file);
  map[s.k] = { f: file, c: COLS, w: W, h: H, n: s.ids.length, ids: ok.map(x => x[0]) };
  imgs += ok.length; done++;
  console.log(`${done}/${sets.length} ${s.k}: ${ok.length}/${s.ids.length} Bilder`);
  fs.writeFileSync(mapPath, JSON.stringify(map));
}
fs.writeFileSync(mapPath, JSON.stringify(map));
console.log("Fertig, neue Bilder:", imgs);
