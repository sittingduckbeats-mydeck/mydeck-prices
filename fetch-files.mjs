// Lädt Bilder von URLs nach assets/<name>.  FILES="name1=url1|name2=url2"
import fs from "node:fs";
fs.mkdirSync("assets", { recursive: true });
for (const pair of (process.env.FILES || "").split("|").filter(Boolean)) {
  const i = pair.indexOf("="), name = pair.slice(0, i), url = pair.slice(i + 1);
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!r.ok) { console.log(name, "Fehler", r.status); continue; }
  const b = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync("assets/" + name, b); console.log(name, b.length, "Bytes");
}
