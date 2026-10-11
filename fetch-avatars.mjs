// Lädt die Kanalbilder der Spotlight-Creator von YouTube (og:image) nach avatars/<handle>.jpg
import fs from "node:fs";
const handles = (process.env.HANDLES || "Leonhart,PokeRev,TwicebakedJake").split(",");
fs.mkdirSync("avatars", { recursive: true });
for (const h of handles) {
  const r = await fetch(`https://www.youtube.com/@${h}`, { headers: { "accept-language": "de-DE,de;q=0.9", "user-agent": "Mozilla/5.0" } });
  const html = await r.text();
  const m = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (!m) { console.log(h, "kein Bild gefunden"); continue; }
  const url = m[1].replace(/=s\d+-/, "=s240-");
  const img = Buffer.from(await (await fetch(url)).arrayBuffer());
  fs.writeFileSync(`avatars/${h}.jpg`, img);
  console.log(h, url, img.length, "Bytes");
}
