/**
 * Tests de bout en bout des garde-fous anti-abus : limite d'offre à la réouverture, plafonds d'e-mails
 * envoyés aux emprunteurs, plafond de relances, refus des liens dans les noms et objets, en-têtes de sécurité.
 *
 * À lancer contre un serveur de dev qui tourne, avec la même base :
 *   DATABASE_URL=… TEST_BASE_URL=http://localhost:3001 npx tsx scripts/test-anti-abus.ts
 * Les comptes de test (…@abus-test.local) sont supprimés au début et à la fin.
 */
import { PrismaClient } from "@prisma/client";
import { MAIL_LIMITS } from "../src/lib/limits";
import { PLANS } from "../src/lib/plans";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3001";
const DOMAIN = "abus-test.local";
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

// Chaque client a sa propre « adresse IP » (en-tête X-Forwarded-For) pour ne pas partager les limites
const randIp = () => `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
type Res = { status: number; data: any; headers: Headers };
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
    return { status: res.status, data, headers: res.headers };
  }
  post = (p: string, b: unknown = {}) => this.req("POST", p, b);
  patch = (p: string, b: unknown) => this.req("PATCH", p, b);
  del = (p: string) => this.req("DELETE", p);
}

const email = (name: string) => `${name}@${DOMAIN}`;
async function register(name: string, plan?: "ENTREPRISE_YEARLY") {
  const c = new Client();
  const r = await c.post("/api/auth/register", { name, organization: `Structure ${name}`, email: email(name), password: PW, acceptTerms: true });
  if (r.status !== 201) throw new Error(`Inscription ${name} impossible : ${JSON.stringify(r.data)}`);
  await prisma.user.update({
    where: { email: email(name) },
    data: { emailVerifiedAt: new Date(), ...(plan ? { plan, planExpiresAt: new Date(Date.now() + 30 * DAY) } : {}) },
  });
  return c;
}
// signature du prêteur (tracé valable) pour les reçus de remboursement et les attestations de retour
const SIG = { signerName: "Prêteur Test", signature: { w: 600, h: 200, strokes: [[40, 120, 120, 60, 200, 140, 280, 70, 360, 130, 440, 80, 520, 120, 560, 100]] }, accept: true };
const loanTo = (c: Client, to: string, item = "Perceuse") =>
  c.post("/api/loans", { item, borrowerFirstName: "Test", borrowerLastName: "Emprunteur", borrowerBirthDate: "1990-05-14", borrowerEmail: to, dueAt: new Date(Date.now() + 7 * DAY).toISOString() });

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
  await prisma.emailLog.deleteMany({ where: { to: { endsWith: `@${DOMAIN}` } } });
}

async function main() {
  await cleanup();
  await sitePaid();

  section("1. Limite de l'offre, à la création et à la réouverture d'un prêt");
  let r: Res = { status: 0, data: null, headers: new Headers() };
  const free = await register("gratuit");
  r = await loanTo(free, email("ami0"));
  check("sans abonnement (site payant) → 402 avec un message clair", r.status === 402 && r.data.code === "LIMIT_REACHED" && /abonnement/.test(r.data.error), r.data);
  const full = await register("limite", "ENTREPRISE_YEARLY");
  const fullId = (await prisma.user.findUniqueOrThrow({ where: { email: email("limite") } })).id;
  const max = PLANS.ENTREPRISE_YEARLY.maxLoans;
  // prêts en cours ajoutés directement en base, jusqu'à un de moins que la limite
  await prisma.loan.createMany({ data: Array.from({ length: max - 1 }, (_, i) => ({ lenderId: fullId, item: `Lot ${i}`, borrowerName: "Lot", borrowerEmail: email(`lot${i}`), dueAt: new Date(Date.now() + 7 * DAY), ackStatus: "NONE" as const })) });
  r = await loanTo(full, email("ami1"));
  check(`${max}e prêt en cours (limite de l'offre) → 201`, r.status === 201, r.data);
  const first = r.data.loan.id;
  r = await loanTo(full, email("ami2"));
  check("au-delà de la limite → 402 LIMIT_REACHED", r.status === 402 && r.data.code === "LIMIT_REACHED", r.data);
  r = await full.patch(`/api/loans/${first}`, { action: "return", ...SIG });
  check("clôture avec attestation signée → 200", r.status === 200 && r.data.loan.status === "RETURNED", r.data);
  r = await loanTo(full, email("ami-bis"));
  check("nouveau prêt une fois le 1er clôturé → 201", r.status === 201, r.data);
  const second = r.data.loan.id;
  // ancien prêt clôturé sans document signé : il peut être rouvert, dans la limite de l'offre
  const old = await prisma.loan.create({ data: { lenderId: fullId, item: "Ancien", borrowerName: "Ancien", borrowerEmail: email("ancien"), dueAt: new Date(Date.now() + 7 * DAY), status: "RETURNED", returnedAt: new Date(), ackStatus: "NONE" } });
  r = await full.patch(`/api/loans/${old.id}`, { action: "reopen" });
  check("rouvrir alors que la limite est atteinte → 402 LIMIT_REACHED", r.status === 402 && r.data.code === "LIMIT_REACHED", r.data);
  check("le prêt reste clôturé", (await prisma.loan.findUnique({ where: { id: old.id } }))?.status === "RETURNED");
  await prisma.loan.update({ where: { id: second }, data: { status: "RETURNED", returnedAt: new Date() } });
  r = await full.patch(`/api/loans/${old.id}`, { action: "reopen" });
  check("rouvrir une fois de la place libérée → 200", r.status === 200 && r.data.loan.status === "ACTIVE", r.data);
  r = await full.patch(`/api/loans/${first}`, { action: "reopen" });
  check("rouvrir un prêt dont le retour est attesté par un document signé → 409", r.status === 409, r.data);

  section("2. Supprimer puis recréer un prêt ne permet pas d'envoyer des e-mails sans limite");
  const spammer = await register("boucle", "ENTREPRISE_YEARLY");
  const spammerId = (await prisma.user.findUniqueOrThrow({ where: { email: email("boucle") } })).id;
  const perDay = PLANS.ENTREPRISE_YEARLY.maxNewLoansPerDay;
  // le compte a déjà écrit à presque autant de nouveaux emprunteurs que son offre le permet sur 24 h
  await prisma.emailLog.createMany({ data: Array.from({ length: perDay - 2 }, () => ({ to: email("deja"), subject: "test", kind: "loan_created", ok: true, thirdParty: true, senderId: spammerId })) });
  let created = 0;
  for (let i = 0; i < 4; i++) {
    r = await loanTo(spammer, email(`cible${i}`));
    if (r.status !== 201) break;
    created++;
    await spammer.del(`/api/loans/${r.data.loan.id}`);
  }
  check(`${perDay} nouveaux emprunteurs sur 24 h, puis refus (supprimer et recréer ne remet rien à zéro)`, created === 2, created);
  check("le refus est un 429 DAILY_LIMIT avec un message clair", r.status === 429 && r.data.code === "DAILY_LIMIT" && /demain/i.test(r.data.error), r.data);
  const log = await prisma.emailLog.findFirst({ where: { to: email("cible0") } });
  check("l'e-mail au tiers est journalisé avec son expéditeur", log?.thirdParty === true && !!log.senderId, log);

  section("3. Plafond d'e-mails par destinataire, tous prêteurs confondus");
  const pro = await register("abonne", "ENTREPRISE_YEARLY");
  const victim = email("victime");
  let sent = 0;
  for (let i = 0; i < MAIL_LIMITS.perRecipientPerDay + 1; i++) {
    r = await loanTo(pro, victim, `Objet ${i}`);
    if (r.status !== 201) break;
    sent++;
  }
  check(`${MAIL_LIMITS.perRecipientPerDay} e-mails vers la même adresse, puis refus`, sent === MAIL_LIMITS.perRecipientPerDay, sent);
  check("refus → 429 qui nomme l'emprunteur", r.status === 429 && /Test/.test(r.data.error), r.data);
  const other = await register("autre", "ENTREPRISE_YEARLY");
  r = await loanTo(other, victim);
  check("un autre prêteur est aussi bloqué vers cette adresse", r.status === 429, r.data);
  r = await loanTo(other, email("quelquun"));
  check("…mais peut prêter à quelqu'un d'autre", r.status === 201, r.data);

  section("4. Plafond de relances par prêt");
  const loan = await prisma.loan.create({
    data: { lenderId: (await prisma.user.findUniqueOrThrow({ where: { email: email("autre") } })).id, item: "Vélo", borrowerName: "Lent", borrowerEmail: email("lent"), dueAt: new Date(Date.now() - 10 * DAY), lentAt: new Date(Date.now() - 20 * DAY), reminderCount: MAIL_LIMITS.remindersPerLoan },
  });
  r = await other.post(`/api/loans/${loan.id}/remind`);
  check(`relance manuelle refusée après ${MAIL_LIMITS.remindersPerLoan} rappels → 429`, r.status === 429 && /contacte/.test(r.data.error), r.data);
  await prisma.loan.update({ where: { id: loan.id }, data: { reminderCount: MAIL_LIMITS.remindersPerLoan - 1 } });
  r = await other.post(`/api/loans/${loan.id}/remind`);
  check("relance manuelle acceptée juste avant le plafond → 200", r.status === 200, r.data);
  check("compteur de rappels au plafond", (await prisma.loan.findUnique({ where: { id: loan.id } }))?.reminderCount === MAIL_LIMITS.remindersPerLoan);

  {
    const { runReminders } = await import("../src/lib/loans");
    // les relances ne partent qu'entre 9 h et 21 h (heure de Paris) : on simule le passage de midi
    const parisHour = (d: Date) => Number(d.toLocaleString("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }));
    let noon = new Date();
    while (parisHour(noon) !== 12) noon = new Date(noon.getTime() + 3600000);
    // relance automatique : 3 jours après la dernière, un rappel avant le plafond
    await prisma.loan.update({ where: { id: loan.id }, data: { reminderCount: MAIL_LIMITS.remindersPerLoan - 1, lastReminderAt: new Date(Date.now() - 4 * DAY) } });
    await runReminders(noon);
    const after = await prisma.loan.findUnique({ where: { id: loan.id } });
    check("relance automatique envoyée jusqu'au plafond", after?.reminderCount === MAIL_LIMITS.remindersPerLoan, after?.reminderCount);
    check("le prêteur est prévenu de la fin des relances", (await prisma.notification.count({ where: { userId: loan.lenderId, title: "Fin des relances automatiques" } })) === 1);
    const mails = await prisma.emailLog.count({ where: { to: email("lent"), kind: "loan_overdue" } });
    await prisma.loan.update({ where: { id: loan.id }, data: { lastReminderAt: new Date(Date.now() - 4 * DAY) } });
    await runReminders(noon);
    check("plus aucune relance automatique au-delà du plafond", (await prisma.emailLog.count({ where: { to: email("lent"), kind: "loan_overdue" } })) === mails);
  }

  section("5. Pas de lien internet dans les textes repris dans les e-mails");
  const fresh = await register("liens", "ENTREPRISE_YEARLY");
  r = await loanTo(fresh, email("ami3"), "Ta banque : www.faux-site.com");
  check("objet avec une adresse web → 400", r.status === 400 && /site internet/.test(r.data.error), r.data);
  r = await fresh.post("/api/loans", { item: "Livre", borrowerFirstName: "Paul", borrowerLastName: "http://piege.example", borrowerBirthDate: "1990-05-14", borrowerEmail: email("ami3"), dueAt: new Date(Date.now() + 7 * DAY).toISOString() });
  check("nom d'emprunteur avec un lien → 400", r.status === 400, r.data);
  r = await new Client().post("/api/auth/register", { name: "promo-impots.fr", organization: "Structure", email: email("pirate"), password: PW, acceptTerms: true });
  check("nom avec une adresse web à l'inscription → 400", r.status === 400, r.data);
  r = await new Client().post("/api/auth/register", { name: "Pirate", organization: "Votre banque www.faux.com", email: email("pirate2"), password: PW, acceptTerms: true });
  check("structure avec une adresse web à l'inscription → 400", r.status === 400, r.data);
  r = await new Client().post("/api/auth/register", { name: "Sans structure", email: email("sansstructure"), password: PW, acceptTerms: true });
  check("inscription sans nom de structure → 400 (service réservé aux professionnels)", r.status === 400, r.data);
  r = await fresh.patch("/api/account", { name: "Va sur bit.ly" });
  check("prénom avec un lien dans Mon compte → 400", r.status === 400, r.data);
  r = await loanTo(fresh, email("ami3"), "Objectif 50mm f/1.8");
  check("un objet ordinaire reste accepté", r.status === 201, r.data);
  r = await new Client().post("/api/auth/register", { email: email("x"), password: PW, acceptTerms: true });
  check("messages de validation par défaut en français", r.status === 400 && !/invalid input|expected/i.test(r.data.error), r.data);

  section("6. Suppression du compte");
  const sender = (await prisma.user.findUniqueOrThrow({ where: { email: email("abonne") } })).id;
  await prisma.user.delete({ where: { id: sender } });
  check("le journal des e-mails n'est plus relié au compte supprimé", (await prisma.emailLog.count({ where: { senderId: sender } })) === 0);

  section("7. En-têtes de sécurité");
  r = await new Client().req("GET", "/");
  check("Content-Security-Policy avec frame-ancestors 'none'", /frame-ancestors 'none'/.test(r.headers.get("content-security-policy") || ""));
  check("X-Frame-Options: DENY", r.headers.get("x-frame-options") === "DENY");
  check("X-Content-Type-Options: nosniff", r.headers.get("x-content-type-options") === "nosniff");
  check("Referrer-Policy", !!r.headers.get("referrer-policy"));
  check("pas d'en-tête X-Powered-By", !r.headers.get("x-powered-by"));
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
