// Lädt die Set-Logos von TCGdex und packt sie in Sprites: logos/l<k>.webp + logos/map.json { "<r>:<set>": index }
import fs from "node:fs";
import sharp from "sharp";
const API = "https://api.tcgdex.net/v2", W = 240, H = 110, COLS = 8, PER = 200;
const sets = JSON.parse(fs.readFileSync("sets.json", "utf8"));
async function get(url, type = "json", tries = 3) {
  for (let i = 0; i < tries; i++) { try { const r = await fetch(url); if (r.status === 404) return null; if (!r.ok) throw new Error(r.status);
    return type === "json" ? await r.json() : Buffer.from(await r.arrayBuffer()); } catch (e) { if (i === tries - 1) return null; await new Promise(s => setTimeout(s, 700 * (i + 1))); } }
}
const out = new Array(sets.length); let i = 0;
await Promise.all(Array.from({ length: 8 }, async () => { while (i < sets.length) { const k = i++, s = sets[k];
  const langs = s.r === "j" ? ["ja", "zh-tw", "ko", "th", "id", "zh-cn"] : ["de", "en", "fr", "it", "es", "pt"];
  for (const l of langs) { const d = await get(`${API}/${l}/sets/${encodeURIComponent(s.id)}`); if (!d || !d.logo) continue;
    let b = await get(d.logo + ".webp", "buf"); if (!b) b = await get(d.logo + ".png", "buf"); if (!b) continue;
    try { out[k] = await sharp(b).trim().resize(W - 12, H - 12, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).extend({ top: 6, bottom: 6, left: 6, right: 6, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(); break; } catch {} } } }));
fs.mkdirSync("logos", { recursive: true });
const map = {}, ok = sets.map((s, k) => [s.k, out[k]]).filter(x => x[1]);
for (let sh = 0; sh * PER < ok.length; sh++) { const part = ok.slice(sh * PER, sh * PER + PER), rows = Math.ceil(part.length / COLS);
  await sharp({ create: { width: COLS * W, height: rows * H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(part.map((x, j) => ({ input: x[1], left: (j % COLS) * W, top: Math.floor(j / COLS) * H }))).webp({ quality: 80, alphaQuality: 90 }).toFile(`logos/l${sh}.webp`);
  part.forEach((x, j) => map[x[0]] = [sh, j, rows]); }
fs.writeFileSync("logos/map.json", JSON.stringify({ v: Date.now(), w: W, h: H, cols: COLS, map }));
console.log("Logos:", ok.length, "/", sets.length);
