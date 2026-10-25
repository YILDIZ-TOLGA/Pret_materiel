/**
 * Tests de bout en bout de la vente : confirmation de commande, rétractation en ligne, référencement.
 * Utilise le paiement de démo (serveur de dev sans clé Stripe) : le parcours Stripe réel reste à tester
 * en mode test Stripe.
 *
 * À lancer contre un serveur de dev qui tourne, avec la même base :
 *   DATABASE_URL=… TEST_BASE_URL=http://localhost:3001 npx tsx scripts/test-vente.ts
 * Les comptes de test (…@vente-test.local) sont supprimés au début et à la fin.
 */
import { PrismaClient } from "@prisma/client";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3001";
const DOMAIN = "vente-test.local";
const PW = "Motdepasse1";
const DAY = 86400000;
const prisma = new PrismaClient();

// Ces tests portent sur les limites du mode payant : le site y passe le temps du test, puis revient à son mode
let siteBefore: { mode: "BETA" | "PAID"; paidFrom: Date | null } | null = null;
async function sitePaid() {
  const s = await prisma.siteSetting.findUnique({ where: { id: 1 } });
  siteBefore = s && { mode: s.mode, paidFrom: s.paidFrom };
  await prisma.siteSetting.upsert({ where: { id: 1 }, update: { mode: "PAID", paidFrom: null }, create: { id: 1, mode: "PAID" } });
}
const siteRestore = async () => { if (siteBefore) await prisma.siteSetting.update({ where: { id: 1 }, data: siteBefore }); };

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failures.push(name); console.log(`  ✗ ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`); }
}
const section = (t: string) => console.log(`\n${t}`);

const randIp = () => `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
class Client {
  token: string | null = null;
  ip = randIp();
  async req(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = { "X-Forwarded-For": this.ip };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = text; }
    if (data?.token) this.token = data.token;
    return { status: res.status, data, type: res.headers.get("content-type") || "" };
  }
  get = (p: string) => this.req("GET", p);
  post = (p: string, b: unknown = {}) => this.req("POST", p, b);
}

const email = (name: string) => `${name}@${DOMAIN}`;
async function register(name: string) {
  const c = new Client();
  const r = await c.post("/api/auth/register", { name, email: email(name), password: PW, acceptTerms: true });
  if (r.status !== 201) throw new Error(`Inscription ${name} impossible : ${JSON.stringify(r.data)}`);
  await prisma.user.update({ where: { email: email(name) }, data: { emailVerifiedAt: new Date() } });
  return c;
}
const mails = (to: string, kind: string) => prisma.emailLog.count({ where: { to, kind, ok: true } });

async function cleanup() {
  // paiements de démo d'abord : supprimer le compte les garderait (sans lien) dans les revenus de l'admin
  await prisma.payment.deleteMany({ where: { user: { email: { endsWith: `@${DOMAIN}` } } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
  await prisma.emailLog.deleteMany({ where: { to: { endsWith: `@${DOMAIN}` } } });
}

async function main() {
  await cleanup();
  await sitePaid();

  section("1. Souscription et confirmation de commande");
  const client = await register("client");
  let r = await client.post("/api/billing/checkout", { plan: "PERSO_MONTHLY" });
  check("sans accepter les CGV → 400", r.status === 400, r.data);
  r = await client.post("/api/billing/checkout", { plan: "PERSO_MONTHLY", acceptSalesTerms: true });
  check("souscription (paiement de démo) → 200", r.status === 200 && /abonnement\?success=1/.test(r.data.url), r.data);
  let user = await prisma.user.findUniqueOrThrow({ where: { email: email("client") } });
  check("offre activée et date de souscription enregistrée", user.plan === "PERSO_MONTHLY" && !!user.subscriptionStartedAt, { plan: user.plan, start: user.subscriptionStartedAt });
  check("e-mail de confirmation de commande envoyé", (await mails(email("client"), "order_confirmation")) === 1);
  r = await client.get("/api/auth/me");
  check("la page Offre reçoit la date limite de rétractation (dans 14 jours)", !!r.data.withdrawalUntil && Math.abs(new Date(r.data.withdrawalUntil).getTime() - Date.now() - 14 * DAY) < 60000, r.data.withdrawalUntil);

  section("2. Rétractation en ligne");
  r = await client.post("/api/billing/withdraw");
  check("rétractation → 200", r.status === 200 && r.data.ok, r.data);
  check("montant payé remboursé en entier", r.data.refundedCents === 300, r.data);
  user = await prisma.user.findUniqueOrThrow({ where: { email: email("client") } });
  check("retour immédiat à l'offre gratuite", user.plan === "FREE" && !user.planExpiresAt && !user.subscriptionStartedAt, user.plan);
  const pays = await prisma.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  check("remboursement enregistré en négatif (revenus de l'admin justes)", pays.reduce((a, p) => a + p.amountCents, 0) === 0 && pays.some((p) => p.amountCents === -300), pays.map((p) => p.amountCents));
  check("accusé de réception envoyé par e-mail", (await mails(email("client"), "withdrawal_receipt")) === 1);
  r = await client.post("/api/billing/withdraw");
  check("deuxième demande → refusée", r.status === 400, r.data);
  r = await client.get("/api/auth/me");
  check("le bouton de rétractation disparaît", r.data.withdrawalUntil === null, r.data.withdrawalUntil);

  section("3. Délai de 14 jours");
  const late = await register("tardif");
  await late.post("/api/billing/checkout", { plan: "PERSO_YEARLY", acceptSalesTerms: true });
  await prisma.user.update({ where: { email: email("tardif") }, data: { subscriptionStartedAt: new Date(Date.now() - 13 * DAY) } });
  r = await late.get("/api/auth/me");
  check("13 jours après : rétractation encore possible", !!r.data.withdrawalUntil, r.data.withdrawalUntil);
  await prisma.user.update({ where: { email: email("tardif") }, data: { subscriptionStartedAt: new Date(Date.now() - 16 * DAY) } });
  r = await late.get("/api/auth/me");
  check("16 jours après : plus de bouton", r.data.withdrawalUntil === null, r.data.withdrawalUntil);
  r = await late.post("/api/billing/withdraw");
  check("16 jours après : rétractation refusée, l'abonnement continue", r.status === 400 && (await prisma.user.findUniqueOrThrow({ where: { email: email("tardif") } })).plan === "PERSO_YEARLY", r.data);
  const anon = new Client();
  r = await anon.post("/api/billing/withdraw");
  check("sans être connecté → 401", r.status === 401);

  section("4. Deux clics simultanés sur « Confirmer la rétractation »");
  const fast = await register("presse");
  await fast.post("/api/billing/checkout", { plan: "PRO50_MONTHLY", acceptSalesTerms: true });
  const both = await Promise.all([1, 2].map(() => fast.post("/api/billing/withdraw")));
  const fastUser = await prisma.user.findUniqueOrThrow({ where: { email: email("presse") } });
  const refunds = await prisma.payment.count({ where: { userId: fastUser.id, amountCents: { lt: 0 } } });
  check("un seul remboursement", refunds === 1 && both.filter((x) => x.status === 200).length === 1, both.map((x) => x.status));

  section("5. Référencement");
  r = await anon.get("/robots.txt");
  check("robots.txt : espace connecté et API exclus, sitemap annoncé", r.status === 200 && /Disallow: \/api\//.test(r.data) && /Disallow: \/prets/.test(r.data) && /Sitemap: .*\/sitemap\.xml/.test(r.data), r.data);
  r = await anon.get("/sitemap.xml");
  check("sitemap.xml : pages publiques seulement", r.status === 200 && /<loc>[^<]*\/cgu<\/loc>/.test(r.data) && !/\/prets/.test(r.data), String(r.data).slice(0, 200));
  r = await anon.get("/opengraph-image");
  check("image d'aperçu des liens (PNG)", r.status === 200 && r.type.startsWith("image/png"), r.type);
  const home = await (await fetch(BASE + "/")).text();
  check("balises d'aperçu sur la page d'accueil", /property="og:image"/.test(home) && /property="og:title"/.test(home) && /name="twitter:card" content="summary_large_image"/.test(home));
}

main()
  .catch((e) => { failures.push(`exception : ${e instanceof Error ? e.stack : e}`); console.error(e); })
  .finally(async () => {
    await cleanup();
    await siteRestore();
    await prisma.$disconnect();
    console.log(`\n${passed} réussis, ${failures.length} échoués`);
    if (failures.length) { console.log(failures.map((f) => `  - ${f}`).join("\n")); process.exit(1); }
  });
