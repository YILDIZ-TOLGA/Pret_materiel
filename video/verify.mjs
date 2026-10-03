// Vérification temporaire du MP4 : on l'affiche plein écran dans Chrome et on capture ce qu'un spectateur verrait.
import puppeteer from "puppeteer-core";
import { serve } from "./serve.mjs";

const TIMES = process.argv.slice(2).map(Number);
const server = await serve();
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--hide-scrollbars"] });
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540 });
await page.goto(`http://127.0.0.1:${server.address().port}/scenes.html?render`);
const meta = await page.evaluate(async () => {
  document.body.innerHTML = '<video id="v" muted playsinline style="position:fixed;inset:0;width:100%;height:100%;background:#000"></video>';
  const v = document.getElementById("v");
  v.src = "out/pret-materiel.mp4";
  await new Promise((ok, ko) => { v.onloadeddata = ok; v.onerror = () => ko(new Error("lecture impossible : " + v.error?.message)); });
  return { duration: v.duration, width: v.videoWidth, height: v.videoHeight };
});
console.log(meta);
for (const t of TIMES) {
  await page.evaluate((t) => new Promise((ok) => {
    const v = document.getElementById("v");
    v.onseeked = () => (v.requestVideoFrameCallback ? v.requestVideoFrameCallback(() => ok()) : requestAnimationFrame(() => ok()));
    v.currentTime = t;
  }), t);
  await new Promise((r) => setTimeout(r, 150));
  await page.screenshot({ path: `out/verif-${t}.png` });
}
await browser.close();
server.close();
