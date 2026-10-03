import puppeteer from "puppeteer-core";
import { writeFile } from "node:fs/promises";
import { serve } from "./serve.mjs";
const TIMES = [1.5, 6.9, 10, 14.5, 19.2, 22.8, 26.3, 30.5];
const server = await serve();
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540 });
await page.goto(`http://127.0.0.1:${server.address().port}/scenes.html?render`);
const r = await page.evaluate(async (TIMES) => {
  document.body.innerHTML = '<video id="v" muted playsinline style="position:fixed;inset:0;width:100%;height:100%"></video>';
  const v = document.getElementById("v");
  v.src = "out/pret-materiel.mp4";
  await new Promise((ok) => (v.onloadeddata = ok));
  const sheet = document.createElement("canvas"); sheet.width = 1920; sheet.height = 540;
  const g = sheet.getContext("2d");
  const got = [], trace = [];
  let i = 0;
  v.playbackRate = 2;
  await v.play();
  const t0 = performance.now();
  while (i < TIMES.length && !v.ended && performance.now() - t0 < 40000) {
    if (v.currentTime >= TIMES[i]) {
      got.push(+v.currentTime.toFixed(2));
      g.drawImage(v, (i % 4) * 480, Math.floor(i / 4) * 270, 480, 270);
      i++;
    }
    if (trace.length === 0 || performance.now() - trace[trace.length - 1][0] > 2000) trace.push([performance.now() - t0, +v.currentTime.toFixed(2)]);
    await new Promise((r) => setTimeout(r, 15));
  }
  return { got, ended: v.ended, trace: trace.map(([a, b]) => `${(a / 1000).toFixed(1)}s→${b}`), png: sheet.toDataURL("image/png").split(",")[1] };
}, TIMES);
await writeFile("out/planche.png", Buffer.from(r.png, "base64"));
console.log({ instants: r.got, fin: r.ended, deroulement: r.trace.join("  ") });
await browser.close(); server.close();
