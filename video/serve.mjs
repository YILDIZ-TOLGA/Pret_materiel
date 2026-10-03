// Petit serveur statique local (127.0.0.1 uniquement) : aperçu de la vidéo et page d'encodage.
// `npm run preview` puis ouvrir l'adresse affichée.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".mp4": "video/mp4" };

export function serve(port = 0) {
  const server = createServer(async (req, res) => {
    const path = normalize(join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)));
    if (!path.startsWith(root) || path.split(sep).includes("..")) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(path.endsWith(sep) ? join(path, "scenes.html") : path);
      res.writeHead(200, { "Content-Type": types[extname(path)] ?? "application/octet-stream", "Cache-Control": "no-store" }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const server = await serve(Number(process.env.PORT) || 4321);
  console.log(`Aperçu : http://127.0.0.1:${server.address().port}/scenes.html  (Ctrl+C pour arrêter)`);
}
