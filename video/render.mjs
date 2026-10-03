// Rendu de la vidéo : Chrome (sans fenêtre) affiche scenes.html image par image, puis encode en H.264 (WebCodecs).
//   npm run render                 -> out/pret-materiel.mp4 (1920×1080, 30 i/s)
//   npm run stills -- 2 9.5 22     -> images PNG aux secondes indiquées, dans out/stills/
// Chrome ou Edge doit être installé (ou son chemin indiqué dans la variable CHROME_PATH).
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";
import { appendFile, mkdir, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { serve } from "./serve.mjs";

const W = 1920, H = 1080, FPS = 30, BITRATE = 8_000_000;
const out = (name) => fileURLToPath(new URL(`./out/${name}`, import.meta.url));

const executablePath = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => p && existsSync(p));
if (!executablePath) throw new Error("Chrome ou Edge introuvable : indique son chemin dans la variable CHROME_PATH");

const [mode, ...rest] = process.argv.slice(2);
const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--force-color-profile=srgb", "--hide-scrollbars", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("Erreur dans la page :", e.message));
  await page.goto(`${base}/scenes.html?render`);
  await page.waitForFunction("window.__ready === true", { timeout: 30_000 });
  const duration = await page.evaluate("window.__duration");

  if (mode === "--stills") {
    await mkdir(out("stills"), { recursive: true });
    for (const s of rest.map(Number).filter((n) => !Number.isNaN(n))) {
      await page.evaluate((t) => window.__seek(t), s * 1000);
      const path = out(`stills/t-${s.toFixed(2).padStart(5, "0")}.png`);
      await page.screenshot({ path });
      console.log(path);
    }
  } else {
    await mkdir(out(""), { recursive: true });
    const file = out("pret-materiel.mp4");
    await rm(file, { force: true });
    // L'encodeur tourne dans la même page : un onglet en arrière-plan n'est plus dessiné et bloquerait les captures.
    await page.exposeFunction("__saveChunk", (b64) => appendFile(file, Buffer.from(b64, "base64")));
    await page.addScriptTag({ url: `${base}/node_modules/mp4-muxer/build/mp4-muxer.js` });
    await page.addScriptTag({ url: `${base}/encoder.js` });
    const codec = await page.evaluate((c) => window.__start(c), { width: W, height: H, frameRate: FPS, bitrate: BITRATE });
    const frames = Math.min(Math.round((duration / 1000) * FPS), Number(process.env.FRAMES) || Infinity); // FRAMES=60 : essai rapide
    const t0 = Date.now();
    console.log(`Rendu de ${frames} images (${duration / 1000} s, ${codec})…`);
    for (let i = 0; i < frames; i++) {
      await page.evaluate((t) => window.__seek(t), (i * 1000) / FPS);
      const b64 = await page.screenshot({ encoding: "base64", type: "png", optimizeForSpeed: true });
      await page.evaluate((b, n) => window.__addFrame(b, n), b64, i);
      if (i % 60 === 0 || i === frames - 1) console.log(`  ${i + 1}/${frames} images · ${Math.round((Date.now() - t0) / 1000)} s`);
    }
    await page.evaluate(() => window.__finish());
    const { size } = await stat(file);
    console.log(`\nVidéo prête : ${file} (${(size / 1e6).toFixed(1)} Mo)`);
  }
} finally {
  await browser.close();
  server.close();
}
