// Holt echte eBay-Angebote (Browse API, EBAY_DE) für offers/queries.json und schreibt offers/feed.json + Vorschaubilder.
// Ohne die Secrets EBAY_CLIENT_ID / EBAY_CLIENT_SECRET wird nur {configured:false} geschrieben.
import fs from "node:fs";
import crypto from "node:crypto";
const ID = process.env.EBAY_CLIENT_ID, SECRET = process.env.EBAY_CLIENT_SECRET;
const PER = 8, MAXQ = 25, CAT = "183454";
fs.mkdirSync("offers/img", { recursive: true });
const write = o => fs.writeFileSync("offers/feed.json", JSON.stringify(Object.assign({ v: Date.now(), updated: new Date().toISOString(), market: "EBAY_DE" }, o)));
if (!ID || !SECRET) { write({ configured: false, queries: [], items: [] }); console.log("eBay-Zugang fehlt – Feed bleibt leer."); process.exit(0); }
const sharp = (await import("sharp")).default;
const tok = await fetch("https://api.ebay.com/identity/v1/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + Buffer.from(ID + ":" + SECRET).toString("base64") }, body: "grant_type=client_credentials&scope=" + encodeURIComponent("https://api.ebay.com/oauth/api_scope") }).then(r => r.json());
if (!tok.access_token) { write({ configured: true, error: "Anmeldung bei eBay fehlgeschlagen", queries: [], items: [] }); console.log("Token-Fehler", JSON.stringify(tok).slice(0, 300)); process.exit(0); }
const H = { Authorization: "Bearer " + tok.access_token, "X-EBAY-C-MARKETPLACE-ID": "EBAY_DE", "Accept-Language": "de-DE" };
const queries = JSON.parse(fs.readFileSync("offers/queries.json", "utf8")).slice(0, MAXQ);
const items = [], seen = new Set(), keep = new Set();
for (let qi = 0; qi < queries.length; qi++) {
  const q = queries[qi]; const url = "https://api.ebay.com/buy/browse/v1/item_summary/search?" + new URLSearchParams({ q: q.q, category_ids: CAT, limit: "30", filter: "deliveryCountry:DE,buyingOptions:{FIXED_PRICE|AUCTION}" });
  let d; try { d = await fetch(url, { headers: H }).then(r => r.json()); } catch { continue; }
  const list = (d.itemSummaries || []).filter(x => x.price && !/\b(lot|bundle|konvolut|sammlung von|proxy|fake|custom)\b/i.test(x.title)).slice(0, PER);
  for (const x of list) { if (seen.has(x.itemId)) continue; seen.add(x.itemId);
    const ship = (x.shippingOptions || [])[0], imgUrl = (x.image && x.image.imageUrl || (x.thumbnailImages || [])[0]?.imageUrl || "").replace(/s-l\d+\./, "s-l500.");
    let img = null; if (imgUrl) { const h = crypto.createHash("md5").update(x.itemId).digest("hex").slice(0, 12); try { const b = Buffer.from(await (await fetch(imgUrl)).arrayBuffer()); await sharp(b).resize(320, 320, { fit: "inside" }).webp({ quality: 72 }).toFile(`offers/img/${h}.webp`); img = `offers/img/${h}.webp`; keep.add(h + ".webp"); } catch {} }
    items.push({ id: x.itemId, q: qi, t: x.title, p: Number(x.price.value), cur: x.price.currency, bid: x.currentBidPrice ? Number(x.currentBidPrice.value) : null, ship: ship && ship.shippingCost ? Number(ship.shippingCost.value) : null, cond: x.condition || null, seller: x.seller ? x.seller.username : null, fb: x.seller ? Number(x.seller.feedbackPercentage) : null, fbs: x.seller ? x.seller.feedbackScore : null, loc: x.itemLocation ? x.itemLocation.country : null, url: x.itemWebUrl, img, opt: (x.buyingOptions || []).includes("AUCTION") ? "AUCTION" : "FIXED_PRICE", end: x.itemEndDate || null, at: x.itemCreationDate || null }); }
  await new Promise(r => setTimeout(r, 250));
}
for (const f of fs.readdirSync("offers/img")) if (!keep.has(f)) fs.unlinkSync("offers/img/" + f);
write({ configured: true, queries, items });
console.log("Angebote:", items.length, "für", queries.length, "Suchbegriffe");
