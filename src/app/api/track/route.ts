import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

function parseUA(ua: string) {
  const device = /ipad|tablet/i.test(ua) ? "Tablette" : /mobi|android|iphone/i.test(ua) ? "Mobile" : "Ordinateur";
  const browser = /edg\//i.test(ua) ? "Edge" : /opr\//i.test(ua) ? "Opera" : /firefox/i.test(ua) ? "Firefox" : /chrome|crios/i.test(ua) ? "Chrome" : /safari/i.test(ua) ? "Safari" : "Autre";
  return { device, browser };
}

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse/i;

/** Analytics maison, sans cookie tiers : une ligne par page vue. */
export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") || "";
  if (BOT.test(ua)) return new Response(null, { status: 204 });
  const body = await req.json().catch(() => null);
  if (!body?.path || !body?.visitorId) return new Response(null, { status: 204 });

  let referrer: string | null = null;
  try {
    const host = new URL(String(body.referrer)).hostname;
    if (host && host !== new URL(req.url).hostname) referrer = host.replace(/^www\./, "");
  } catch {}

  const user = await getCurrentUser();
  const country = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || req.headers.get("x-country") || null;
  await prisma.pageView.create({
    data: { path: String(body.path).slice(0, 200), referrer, visitorId: String(body.visitorId).slice(0, 64), userId: user?.id, country, ...parseUA(ua) },
  });
  return new Response(null, { status: 204 });
}
