/**
 * Tests de bout en bout du mode du site : site testeur (tout gratuit) et passage au site payant
 * (annonce, bascule à la date, rien de supprimé, retour en site testeur).
 *
 * À lancer contre un serveur de dev qui tourne, avec la même base (paiement de démo actif) :
 *   DATABASE_URL=… TEST_BASE_URL=http://localhost:3001 npx tsx scripts/test-mode-site.ts
 * Les comptes de test (…@mode-test.local) sont supprimés à la fin, et le mode du site est remis comme avant.
 */
import { PrismaClient } from "@prisma/client";
import { BETA_LIMITS } from "../src/lib/limits";
import { PLANS } from "../src/lib/plans";
import { earliestPaidDay, runSiteMode } from "../src/lib/sitemode";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3001";
const DOMAIN = "mode-test.local";
const PW = "Motdepasse1";
const DAY = 86400000;
const prisma = new PrismaClient();
const startedAt = new Date();
let siteBefore: { mode: "BETA" | "PAID"; paidFrom: Date | null } | null = null;
const scheduled: Date[] = [];

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
    return { status: res.status, data };
  }
  get = (p: string) => this.req("GET", p);
  post = (p: string, b: unknown = {}) => this.req("POST", p, b);
  patch = (p: string, b: unknown) => this.req("PATCH", p, b);
}

const email = (name: string) => `${name}@${DOMAIN}`;
async function register(name: string, admin = false) {
  const c = new Client();
  const r = await c.post("/api/auth/register", { name, organization: `Structure ${name}`, email: email(name), password: PW, acceptTerms: true });
  if (r.status !== 201) throw new Error(`Inscription ${name} impossible : ${JSON.stringify(r.data)}`);
  await prisma.user.update({ where: { email: email(name) }, data: { emailVerifiedAt: new Date(), ...(admin ? { role: "ADMIN" as const } : {}) } });
  return c;
}
// signature du prêteur (tracé valable) pour les reçus de remboursement et les attestations de retour
const SIG = { signerName: "Prêteur Test", signature: { w: 600, h: 200, strokes: [[40, 120, 120, 60, 200, 140, 280, 70, 360, 130, 440, 80, 520, 120, 560, 100]] }, accept: true };
const loanTo = (c: Client, i: number) =>
  c.post("/api/loans", { item: `Objet ${i}`, borrowerName: "Ami", borrowerEmail: email(`ami${i}`), dueAt: new Date(Date.now() + 7 * DAY).toISOString() });

async function cleanup() {
  await prisma.payment.deleteMany({ where: { user: { email: { endsWith: `@${DOMAIN}` } } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
  await prisma.emailLog.deleteMany({ where: { to: { endsWith: `@${DOMAIN}` } } });
}
/** L'annonce part à tous les comptes de la base : on efface ses traces chez les comptes qui ne sont pas de test. */
async function cleanupNotices() {
  await prisma.notification.deleteMany({ where: { createdAt: { gte: startedAt }, OR: [{ title: { startsWith: "Passage au mode payant" } }, { title: "Le site est passé en mode payant" }] } });
  await prisma.emailLog.deleteMany({ where: { createdAt: { gte: startedAt }, kind: "paid_mode_notice" } });
  if (scheduled.length) await prisma.user.updateMany({ where: { paidModeNoticeFor: { in: scheduled } }, data: { paidModeNoticeFor: null } });
}

async function main() {
  await cleanup();
  const s = await prisma.siteSetting.findUnique({ where: { id: 1 } });
  siteBefore = s && { mode: s.mode, paidFrom: s.paidFrom };
  await prisma.siteSetting.upsert({ where: { id: 1 }, update: { mode: "BETA", paidFrom: null }, create: { id: 1, mode: "BETA" } });

  section("1. Site testeur : tout est gratuit");
  const user = await register("utilisateur");
  let r = await new Client().get("/api/site");
  check("la route publique annonce la phase de test", r.status === 200 && r.data.mode === "BETA" && r.data.betaLimits.maxLoans === BETA_LIMITS.maxLoans, r.data);
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    r = await loanTo(user, i);
    if (r.status === 201) ids.push(r.data.loan.id);
  }
  check("3 prêts en cours sans abonnement ni paiement", ids.length === 3, r.data);
  r = await user.get("/api/auth/me");
  check("profil : limite de la phase de test, nom « Phase de test »", r.data.site?.mode === "BETA" && r.data.plan.maxLoans === BETA_LIMITS.maxLoans && r.data.plan.name === "Phase de test", { site: r.data.site, plan: r.data.plan });
  r = await user.post("/api/billing/checkout", { plan: "ENTREPRISE_YEARLY", acceptSalesTerms: true });
  check("aucune offre en vente → 403 SITE_IN_BETA", r.status === 403 && r.data.code === "SITE_IN_BETA", r.data);

  section("2. Programmer le passage au payant (admin)");
  r = await user.get("/api/admin/site");
  check("réservé aux admins → 403", r.status === 403);
  const admin = await register("chef", true);
  r = await admin.get("/api/admin/site");
  check("état du mode du site", r.status === 200 && r.data.mode === "BETA" && r.data.stats.overFreeCap >= 1, r.data.stats);
  const tooSoon = new Date(Date.now() + 10 * DAY).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  r = await admin.post("/api/admin/site", { action: "schedule", day: tooSoon });
  check("moins de 30 jours de préavis → refusé", r.status === 400 && /30 jours/.test(r.data.error), r.data);
  const day = earliestPaidDay();
  r = await admin.post("/api/admin/site", { action: "schedule", day });
  check(`passage programmé le ${day}`, r.status === 200 && !!r.data.paidFrom && r.data.mode === "BETA", r.data);
  const paidFrom = new Date(r.data.paidFrom);
  scheduled.push(paidFrom);
  r = await user.get("/api/auth/me");
  check("les utilisateurs voient la date annoncée", r.data.site?.paidFrom === paidFrom.toISOString(), r.data.site);
  let job = await runSiteMode();
  check("annonce envoyée par e-mail à l'utilisateur", (await prisma.emailLog.count({ where: { to: email("utilisateur"), kind: "paid_mode_notice", ok: true } })) === 1, job);
  check("…et dans l'appli", (await prisma.notification.count({ where: { user: { email: email("utilisateur") }, title: { startsWith: "Passage au mode payant" } } })) === 1);
  await runSiteMode();
  check("pas de doublon à la tâche suivante", (await prisma.emailLog.count({ where: { to: email("utilisateur"), kind: "paid_mode_notice" } })) === 1);
  r = await user.post("/api/billing/checkout", { plan: "ENTREPRISE_YEARLY", acceptSalesTerms: true });
  check("avant la date, toujours rien en vente", r.status === 403);

  section("3. À la date : site payant, rien n'est supprimé");
  job = await runSiteMode(new Date(paidFrom.getTime() + 3600000));
  check("le site bascule en payant", job.switched && (await prisma.siteSetting.findUniqueOrThrow({ where: { id: 1 } })).mode === "PAID", job);
  check("tous les prêts sont conservés", (await prisma.loan.count({ where: { lender: { email: email("utilisateur") }, status: "ACTIVE" } })) === ids.length);
  check("l'utilisateur sans abonnement qui a des prêts en cours est prévenu", (await prisma.notification.count({ where: { user: { email: email("utilisateur") }, title: "Le site est passé en mode payant" } })) === 1);
  r = await user.get("/api/auth/me");
  check("profil : sans abonnement, aucun nouveau prêt possible", r.data.site?.mode === "PAID" && r.data.plan.maxLoans === PLANS.FREE.maxLoans && PLANS.FREE.maxLoans === 0, r.data.plan);
  r = await loanTo(user, 99);
  check("créer un prêt sans abonnement → 402 LIMIT_REACHED", r.status === 402 && r.data.code === "LIMIT_REACHED", r.data);
  r = await user.patch(`/api/loans/${ids[0]}`, { item: "Objet renommé" });
  check("les prêts existants restent modifiables", r.status === 200 && r.data.loan.item === "Objet renommé", r.data);
  r = await user.patch(`/api/loans/${ids[0]}`, { action: "return", ...SIG });
  check("…et clôturables (attestation signée)", r.status === 200 && r.data.loan.status === "RETURNED", r.data);
  // ancien prêt clôturé sans document signé : sa réouverture compte comme une création
  await prisma.loan.update({ where: { id: ids[1] }, data: { status: "RETURNED", returnedAt: new Date(), ackStatus: "NONE" } });
  r = await user.patch(`/api/loans/${ids[1]}`, { action: "reopen" });
  check("rouvrir sans abonnement → 402", r.status === 402, r.data);
  r = await user.post("/api/billing/checkout", { plan: "ENTREPRISE_YEARLY", acceptSalesTerms: true });
  check("l'offre Entreprise est en vente (paiement de démo)", r.status === 200, r.data);
  r = await loanTo(user, 100);
  check("une fois abonné, créer redevient possible", r.status === 201, r.data);
  await prisma.user.update({ where: { email: email("utilisateur") }, data: { plan: "FREE", planExpiresAt: null, subscriptionStartedAt: null } });

  section("4. Retour en site testeur et annulation");
  r = await admin.post("/api/admin/site", { action: "beta" });
  check("retour immédiat en site testeur", r.status === 200 && r.data.mode === "BETA", r.data);
  r = await loanTo(user, 101);
  check("créer redevient gratuit, sans abonnement", r.status === 201, r.data);
  r = await admin.post("/api/admin/site", { action: "schedule", day });
  r = await admin.post("/api/admin/site", { action: "cancel" });
  check("annuler un passage programmé", r.status === 200 && r.data.paidFrom === null && r.data.mode === "BETA", r.data);
}

main()
  .catch((e) => { failures.push(`exception : ${e instanceof Error ? e.stack : e}`); console.error(e); })
  .finally(async () => {
    await cleanup();
    await cleanupNotices();
    if (siteBefore) await prisma.siteSetting.update({ where: { id: 1 }, data: siteBefore });
    await prisma.$disconnect();
    console.log(`\n${passed} réussis, ${failures.length} échoués`);
    if (failures.length) { console.log(failures.map((f) => `  - ${f}`).join("\n")); process.exit(1); }
  });
