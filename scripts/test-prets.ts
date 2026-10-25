/**
 * Tests de bout en bout des prêts et de la protection des données : notes privées, prêt d'argent rouvert,
 * dates, remboursements simultanés, changement d'emprunteur, compteur de relances, structure Pro,
 * liens de désinscription, liens de confirmation consommés deux fois.
 *
 * À lancer contre un serveur de dev qui tourne, avec la même base :
 *   DATABASE_URL=… JWT_SECRET=… TEST_BASE_URL=http://localhost:3001 npx tsx scripts/test-prets.ts
 * (JWT_SECRET doit être celui du serveur : il chiffre les liens de désinscription.)
 * Les comptes de test (…@prets-test.local) sont supprimés au début et à la fin.
 */
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { MAIL_LIMITS } from "../src/lib/limits";
import { checkLegacyOptOutToken, optOutUrl } from "../src/lib/optout";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3001";
const DOMAIN = "prets-test.local";
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
type Res = { status: number; data: any };
class Client {
  token: string | null = null;
  ip = randIp();
  async req(method: string, path: string, body?: unknown): Promise<Res> {
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
async function register(name: string, plan?: "PERSO_MONTHLY" | "PRO50_MONTHLY") {
  const c = new Client();
  const r = await c.post("/api/auth/register", { name, email: email(name), password: PW, acceptTerms: true });
  if (r.status !== 201) throw new Error(`Inscription ${name} impossible : ${JSON.stringify(r.data)}`);
  await prisma.user.update({
    where: { email: email(name) },
    data: { emailVerifiedAt: new Date(), ...(plan ? { plan, planExpiresAt: new Date(Date.now() + 30 * DAY) } : {}) },
  });
  return c;
}
const due = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const loanTo = (c: Client, to: string, extra: Record<string, unknown> = {}) =>
  c.post("/api/loans", { item: "Perceuse", borrowerName: "Test", borrowerEmail: to, dueAt: due(7), ...extra });

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
  await prisma.emailLog.deleteMany({ where: { to: { endsWith: `@${DOMAIN}` } } });
  await prisma.emailOptOut.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
}

async function main() {
  await cleanup();
  await sitePaid();

  section("1. Les notes privées du prêteur ne sont jamais envoyées à l'emprunteur");
  const lender = await register("preteur", "PERSO_MONTHLY");
  const borrower = await register("emprunteur");
  await loanTo(lender, email("emprunteur"), { notes: "NOTE-SECRETE il ne rend jamais rien" });
  let r = await borrower.get("/api/borrowed");
  check("l'emprunteur voit le prêt", r.status === 200 && r.data.loans.length === 1, r.data);
  check("…sans la note privée", !JSON.stringify(r.data).includes("NOTE-SECRETE"));
  check("…ni l'état des relances ou l'identifiant du prêteur", ["notes", "reminderCount", "lastReminderAt", "lenderId", "autoReminder"].every((k) => !(k in r.data.loans[0])), Object.keys(r.data.loans[0]));
  check("…mais avec ce qu'il doit savoir (objet, échéance, prêteur)", !!r.data.loans[0].item && !!r.data.loans[0].dueAt && !!r.data.loans[0].lender?.name);

  section("2. Prêt d'argent clôturé puis rouvert");
  r = await loanTo(lender, email("ami1"), { kind: "MONEY", amountCents: 5000, item: "" });
  const money = r.data.loan.id;
  await lender.patch(`/api/loans/${money}`, { action: "repay", amountCents: 2000 });
  await lender.patch(`/api/loans/${money}`, { action: "return" });
  r = await lender.patch(`/api/loans/${money}`, { action: "reopen" });
  check("rouvert → le vrai reste dû revient (30 €)", r.status === 200 && r.data.loan.amountCents - r.data.loan.repaidCents === 3000, r.data.loan);
  check("le « solde à la clôture » est annulé, le vrai remboursement reste", r.data.loan.repayments.length === 1 && r.data.loan.repayments[0].amountCents === 2000, r.data.loan.repayments);
  await lender.patch(`/api/loans/${money}`, { action: "repay", amountCents: 3000 });
  r = await lender.patch(`/api/loans/${money}`, { action: "reopen" });
  check("rouvrir un prêt remboursé en entier → refusé", r.status === 400 && /entièrement remboursé/.test(r.data.error), r.data);
  r = await loanTo(lender, email("ami2"), { kind: "MONEY", amountCents: 4000, item: "" });
  const money2 = r.data.loan.id;
  await lender.patch(`/api/loans/${money2}`, { action: "repay", amountCents: 1000 });
  r = await lender.patch(`/api/loans/${money2}`, { amountCents: 1000 });
  check("montant ramené à ce qui est déjà remboursé → refusé (clôturer plutôt)", r.status === 400, r.data);

  section("3. Dates");
  r = await loanTo(lender, email("ami3"), { lentAt: due(0), dueAt: due(-30) });
  check("date de retour avant la date du prêt → 400", r.status === 400 && /après la date du prêt/.test(r.data.error), r.data);
  r = await loanTo(lender, email("ami3"), { lentAt: new Date(Date.now() - 3600000).toISOString(), dueAt: new Date(Date.now() + 3600000).toISOString() });
  check("retour le jour même → accepté", r.status === 201, r.data);
  r = await lender.patch(`/api/loans/${r.data.loan.id}`, { lentAt: due(10) });
  check("modifier la date du prêt après la date de retour → 400", r.status === 400, r.data);

  section("4. Deux remboursements envoyés en même temps");
  r = await loanTo(lender, email("ami4"), { kind: "MONEY", amountCents: 1000, item: "" });
  const race = r.data.loan.id;
  const both = await Promise.all([1, 2].map(() => lender.patch(`/api/loans/${race}`, { action: "repay", amountCents: 1000 })));
  const after = await prisma.loan.findUniqueOrThrow({ where: { id: race }, include: { repayments: true } });
  check("jamais plus que le montant prêté", after.repaidCents === 1000 && after.repayments.reduce((a, x) => a + x.amountCents, 0) === 1000, { repaid: after.repaidCents, n: after.repayments.length });
  check("le second reçoit une réponse claire (ou passe après le premier)", both.every((x) => [200, 400, 409].includes(x.status)), both.map((x) => x.status));

  section("5. Changer l'adresse de l'emprunteur d'un prêt en cours");
  const pro = await register("structure", "PRO50_MONTHLY");
  r = await loanTo(pro, email("x0"));
  check("offre Pro sans nom de structure → 403 ORGANIZATION_REQUIRED", r.status === 403 && r.data.code === "ORGANIZATION_REQUIRED", r.data);
  r = await pro.patch("/api/account", { organization: "Asso www.piege.com" });
  check("nom de structure avec une adresse web → 400", r.status === 400, r.data);
  r = await pro.patch("/api/account", { organization: "Club de rando des Alpes" });
  check("nom de structure enregistré", r.status === 200 && r.data.user.organization === "Club de rando des Alpes", r.data);
  r = await loanTo(pro, email("x0"), { lentAt: due(-20) });
  check("prêt créé une fois la structure nommée", r.status === 201, r.data);
  const moved = r.data.loan.id;
  r = await pro.patch(`/api/loans/${moved}`, { borrowerEmail: email("x1"), dueAt: due(-2) });
  check("changement d'adresse → 200", r.status === 200, r.data);
  check("le nouvel emprunteur reçoit l'e-mail de confirmation", (await prisma.emailLog.count({ where: { to: email("x1"), kind: "loan_created" } })) === 1);
  const victim = email("cible");
  for (let i = 0; i < MAIL_LIMITS.perRecipientPerDay; i++) {
    await prisma.emailLog.create({ data: { to: victim, subject: "test", kind: "loan_overdue", ok: true, thirdParty: true } });
  }
  r = await pro.patch(`/api/loans/${moved}`, { borrowerEmail: victim });
  check("vers une adresse qui a atteint son plafond du jour → 429", r.status === 429, r.data);
  await prisma.loan.update({ where: { id: moved }, data: { reminderCount: 3 } });
  r = await pro.patch(`/api/loans/${moved}`, { dueAt: due(-5) });
  check("changer la date ne remet plus le compteur de rappels à zéro", r.status === 200 && (await prisma.loan.findUniqueOrThrow({ where: { id: moved } })).reminderCount === 3, r.data);
  const free = await register("libre");
  r = await loanTo(free, email("y0"));
  const freeLoan = r.data.loan?.id;
  // le compte a déjà écrit à autant de nouveaux emprunteurs que son offre le permet sur 24 h
  const freeId = (await prisma.user.findUniqueOrThrow({ where: { email: email("libre") } })).id;
  await prisma.emailLog.createMany({ data: Array.from({ length: 30 }, () => ({ to: email("autre"), subject: "test", kind: "loan_created", ok: true, thirdParty: true, senderId: freeId })) });
  r = await free.patch(`/api/loans/${freeLoan}`, { borrowerEmail: email("y1") });
  check("changer d'adresse compte dans le plafond de nouveaux emprunteurs par jour → 429 DAILY_LIMIT", r.status === 429 && r.data.code === "DAILY_LIMIT", r.data);

  section("6. E-mails aux emprunteurs d'une structure (offre Pro)");
  const logs: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { logs.push(a.join(" ")); };
  const { sendMail } = await import("../src/lib/mail");
  const proUser = await prisma.user.findUniqueOrThrow({ where: { email: email("structure") } });
  await sendMail({ to: email("z0"), subject: "t", kind: "test", title: "t", paragraphs: [], thirdParty: { lenderName: proUser.name, lenderId: proUser.id, organization: proUser.organization } });
  console.log = orig;
  const out = logs.join("\n");
  check("le pied de l'e-mail nomme la structure responsable du traitement", /Club de rando des Alpes est responsable du traitement/.test(out), out.slice(0, 300));
  check("le lien de désinscription ne contient pas l'adresse en clair", /desinscription\?t=/.test(out) && !/desinscription\?[^\s]*@/.test(out) && !out.includes(encodeURIComponent(email("z0"))));
  const exp = await pro.get("/api/account/export");
  check("l'export de données contient le nom de la structure", exp.data?.account?.organization === "Club de rando des Alpes", exp.data?.account);

  section("7. Liens de désinscription");
  const url = new URL(optOutUrl(email("desinscrit")));
  check("pas d'adresse e-mail dans le lien", !url.search.includes("@") && !url.search.includes("desinscrit"), url.search);
  const t = url.searchParams.get("t")!;
  r = await new Client().get(`/api/optout?t=${encodeURIComponent(t)}`);
  check("la page affiche l'adresse masquée", r.status === 200 && r.data.email === `d•••@${DOMAIN}`, r.data);
  r = await new Client().post("/api/optout", { t: t.slice(0, -2) + (t.endsWith("AA") ? "BB" : "AA") });
  check("jeton modifié → 400", r.status === 400, r.data);
  r = await new Client().post("/api/optout", { t });
  check("désinscription → 200", r.status === 200 && !!(await prisma.emailOptOut.findUnique({ where: { email: email("desinscrit") } })), r.data);
  const legacyEmail = email("ancien-lien");
  const legacy = (await import("node:crypto")).createHmac("sha256", process.env.JWT_SECRET || "dev-secret-change-me").update(`optout:${legacyEmail}`).digest("base64url");
  check("(contrôle) ancien format de jeton bien formé", checkLegacyOptOutToken(legacyEmail, legacy));
  r = await new Client().post(`/api/optout?e=${encodeURIComponent(legacyEmail)}&t=${legacy}`);
  check("les liens à l'ancien format (déjà envoyés) marchent encore", r.status === 200, r.data);

  section("8. Lien de confirmation utilisé deux fois en même temps");
  const twice = await new Client().post("/api/auth/register", { name: "double", email: email("double"), password: PW, acceptTerms: true });
  check("(inscription)", twice.status === 201);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: email("double") } });
  const token = randomBytes(32).toString("base64url");
  await prisma.authToken.deleteMany({ where: { userId: user.id } });
  await prisma.authToken.create({ data: { userId: user.id, kind: "VERIFY_EMAIL", email: user.email, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3600000) } });
  const res = await Promise.all([1, 2].map(() => new Client().post("/api/auth/verify-email", { t: token })));
  check("aucune erreur 500, une seule confirmation", !res.some((x) => x.status >= 500) && res.filter((x) => x.status === 200).length === 1, res.map((x) => x.status));
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
