/**
 * Tests de bout en bout de la sécurité des comptes (confirmation d'e-mail, mot de passe oublié,
 * changement d'adresse et de mot de passe, sessions, limitation des tentatives).
 *
 * À lancer contre un serveur de dev qui tourne, avec la même base :
 *   DATABASE_URL=… JWT_SECRET=… TEST_BASE_URL=http://localhost:3001 npx tsx scripts/test-securite.ts
 * Les comptes de test (…@secu-test.local) sont supprimés au début et à la fin.
 */
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient, type AuthTokenKind } from "@prisma/client";
import { SignJWT } from "jose";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3001";
const DOMAIN = "secu-test.local";
const PW = "Motdepasse1";
const prisma = new PrismaClient();

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failures.push(name); console.log(`  ✗ ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`); }
}
const section = (t: string) => console.log(`\n${t}`);

// Chaque client a sa propre « adresse IP » (en-tête X-Forwarded-For) pour ne pas partager les limites
const randIp = () => `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
type Res = { status: number; data: any; setCookie: string | null };
class Client {
  token: string | null = null;
  cookie: string | null = null;
  constructor(public ip = randIp(), public mode: "bearer" | "cookie" = "bearer") {}
  async req(method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<Res> {
    const headers: Record<string, string> = { "X-Forwarded-For": this.ip, ...extra };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.mode === "bearer" && this.token) headers.Authorization = `Bearer ${this.token}`;
    if (this.mode === "cookie" && this.cookie) headers.Cookie = `session=${this.cookie}`;
    const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    const setCookie = res.headers.get("set-cookie");
    const m = setCookie?.match(/session=([^;]*)/);
    if (m) this.cookie = m[1] || null;
    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = text; }
    if (data?.token) this.token = data.token;
    return { status: res.status, data, setCookie };
  }
  get = (p: string) => this.req("GET", p);
  post = (p: string, b: unknown = {}) => this.req("POST", p, b);
  del = (p: string) => this.req("DELETE", p);
}

const email = (name: string) => `${name}@${DOMAIN}`;
const userBy = (e: string) => prisma.user.findUnique({ where: { email: e } });
const mailsTo = (to: string, kind: string) => prisma.emailLog.count({ where: { to, kind } });

/** Crée directement en base un lien valide (les e-mails ne sont pas lisibles depuis le script). */
async function linkFor(userId: string, kind: AuthTokenKind, to: string, ttlMs = 3600000) {
  const token = randomBytes(32).toString("base64url");
  await prisma.authToken.deleteMany({ where: { userId, kind } });
  await prisma.authToken.create({ data: { userId, kind, email: to, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + ttlMs) } });
  return token;
}

async function register(name: string, verified = false) {
  const c = new Client();
  const r = await c.post("/api/auth/register", { name, email: email(name), password: PW, acceptTerms: true });
  if (r.status !== 201) throw new Error(`Inscription ${name} impossible : ${JSON.stringify(r.data)}`);
  if (verified) await prisma.user.update({ where: { email: email(name) }, data: { emailVerifiedAt: new Date() } });
  return c;
}
const paid = (e: string) => prisma.user.update({ where: { email: e }, data: { plan: "PERSO_MONTHLY", planExpiresAt: new Date(Date.now() + 30 * 86400000) } });
const loanTo = (c: Client, to: string, item = "Perceuse") => c.post("/api/loans", { item, borrowerName: "Test", borrowerEmail: to, dueAt: new Date(Date.now() + 7 * 86400000).toISOString() });

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
  await prisma.emailLog.deleteMany({ where: { to: { endsWith: `@${DOMAIN}` } } });
  await prisma.emailOptOut.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
  await prisma.pageView.deleteMany({ where: { path: "/__secu-test" } });
}

async function main() {
  await cleanup();

  section("1. Inscription et confirmation de l'adresse");
  const alice = new Client();
  let r = await alice.post("/api/auth/register", { name: "alice", email: email("alice"), password: PW, acceptTerms: true });
  check("inscription → 201", r.status === 201, r.data);
  check("le mot de passe n'est jamais renvoyé", !JSON.stringify(r.data).includes("passwordHash"));
  check("adresse non confirmée à l'inscription", r.data.user?.emailVerifiedAt === null);
  check("e-mail de confirmation envoyé", (await mailsTo(email("alice"), "verify_email")) === 1);
  check("un lien de confirmation existe en base (empreinte seulement)", (await prisma.authToken.count({ where: { user: { email: email("alice") }, kind: "VERIFY_EMAIL" } })) === 1);
  r = await loanTo(alice, email("x1"));
  check("création de prêt refusée tant que l'adresse n'est pas confirmée → 403", r.status === 403 && r.data.code === "EMAIL_NOT_VERIFIED", r);
  check("aucun e-mail envoyé à l'emprunteur", (await prisma.emailLog.count({ where: { to: email("x1") } })) === 0);
  r = await alice.post("/api/auth/register", { name: "bis", email: email("alice"), password: PW, acceptTerms: true });
  check("double inscription avec la même adresse → 409", r.status === 409);

  for (let i = 1; i <= 3; i++) {
    r = await alice.post("/api/auth/resend-verification");
    check(`renvoi du lien n°${i} → 200`, r.status === 200, r.data);
  }
  r = await alice.post("/api/auth/resend-verification");
  check("4e renvoi dans l'heure → 429", r.status === 429, r.data);
  check("un seul lien valable à la fois (les précédents sont remplacés)", (await prisma.authToken.count({ where: { user: { email: email("alice") }, kind: "VERIFY_EMAIL" } })) === 1);

  const anon = new Client();
  r = await anon.post("/api/auth/verify-email", { t: "court" });
  check("jeton trop court → 400", r.status === 400);
  r = await anon.post("/api/auth/verify-email", { t: randomBytes(32).toString("base64url") });
  check("jeton inconnu → 410", r.status === 410);
  const aliceU = (await userBy(email("alice")))!;
  let t = await linkFor(aliceU.id, "RESET_PASSWORD", email("alice"));
  r = await anon.post("/api/auth/verify-email", { t });
  check("lien de réinitialisation utilisé pour confirmer l'adresse → 410", r.status === 410);
  t = await linkFor(aliceU.id, "VERIFY_EMAIL", email("alice"), -1000);
  r = await anon.post("/api/auth/verify-email", { t });
  check("lien expiré → 410", r.status === 410);
  t = await linkFor(aliceU.id, "VERIFY_EMAIL", email("alice"));
  r = await anon.post("/api/auth/verify-email", { t });
  check("lien valide → 200, sans être connecté", r.status === 200 && !!r.data.user?.emailVerifiedAt, r.data);
  r = await anon.post("/api/auth/verify-email", { t });
  check("même lien une 2e fois → 410", r.status === 410);
  r = await alice.post("/api/auth/resend-verification");
  check("renvoi alors que l'adresse est confirmée → 400", r.status === 400);
  r = await alice.get("/api/auth/me");
  check("/me indique l'adresse confirmée", !!r.data.user?.emailVerifiedAt);

  section("2. Usurpation d'adresse et rattachement des emprunts");
  await paid(email("alice"));
  r = await loanTo(alice, email("chloe"), "Tente");
  check("prêt créé une fois l'adresse confirmée → 201", r.status === 201, r.data);
  const chloeLoanId = r.data.loan?.id;
  check("prêt à une adresse sans compte : non rattaché", r.data.loan?.borrowerId === null);
  check("e-mail envoyé à l'emprunteur", (await mailsTo(email("chloe"), "loan_created")) === 1);
  const pirate = new Client();
  r = await pirate.post("/api/auth/register", { name: "Pirate", email: email("chloe"), password: PW, acceptTerms: true });
  check("un inconnu peut s'inscrire avec l'adresse de l'emprunteur…", r.status === 201);
  r = await pirate.get("/api/borrowed");
  check("… mais ne voit aucun de ses emprunts", Array.isArray(r.data.loans) && r.data.loans.length === 0, r.data);
  check("… et le prêt ne lui est pas rattaché", (await prisma.loan.findUnique({ where: { id: chloeLoanId } }))?.borrowerId === null);
  r = await pirate.get(`/api/loans/${chloeLoanId}`);
  check("… et ne peut pas ouvrir le prêt → 404", r.status === 404, r.status);
  // le vrai titulaire de l'adresse récupère son compte par « mot de passe oublié »
  const chloeU = (await userBy(email("chloe")))!;
  t = await linkFor(chloeU.id, "RESET_PASSWORD", email("chloe"));
  r = await anon.post("/api/auth/reset-password", { t, password: "Vraie2chloe" });
  check("le titulaire réinitialise le mot de passe depuis sa boîte → 200", r.status === 200, r.data);
  const pirateMe = await pirate.get("/api/auth/me");
  check("l'usurpateur est déconnecté", pirateMe.status === 401);
  check("la réinitialisation confirme l'adresse et rattache l'emprunt", (await prisma.loan.findUnique({ where: { id: chloeLoanId } }))?.borrowerId === chloeU.id);
  const chloe = new Client();
  await chloe.post("/api/auth/login", { email: email("chloe"), password: "Vraie2chloe" });
  r = await chloe.get("/api/borrowed");
  check("le titulaire voit son emprunt", r.data.loans?.length === 1 && r.data.loans[0].id === chloeLoanId, r.data);

  const dan = await register("dan");
  r = await loanTo(alice, email("dan"), "Vélo");
  check("prêt à un compte non confirmé : non rattaché", r.status === 201 && r.data.loan?.borrowerId === null, r.data);
  const danLoanId = r.data.loan.id;
  r = await dan.get("/api/borrowed");
  check("emprunts invisibles avant confirmation", r.data.loans?.length === 0);
  const danU = (await userBy(email("dan")))!;
  await anon.post("/api/auth/verify-email", { t: await linkFor(danU.id, "VERIFY_EMAIL", email("dan")) });
  r = await dan.get("/api/borrowed");
  check("confirmation → emprunt visible et rattaché", r.data.loans?.length === 1 && (await prisma.loan.findUnique({ where: { id: danLoanId } }))?.borrowerId === danU.id);
  r = await loanTo(alice, email("dan"), "Échelle");
  check("prêt à un compte confirmé : rattaché tout de suite", r.data.loan?.borrowerId === danU.id, r.data);
  const eveC = await register("eve");
  r = await alice.req("PATCH", `/api/loans/${danLoanId}`, { borrowerEmail: email("eve"), borrowerName: "Eve", item: "Vélo", dueAt: new Date(Date.now() + 86400000).toISOString() });
  check("modification vers un compte non confirmé : rattachement retiré", r.status === 200 && (await prisma.loan.findUnique({ where: { id: danLoanId } }))?.borrowerId === null, r.data);
  r = await alice.req("PATCH", `/api/loans/${danLoanId}`, { borrowerEmail: email("dan"), borrowerName: "Dan", item: "Vélo", dueAt: new Date(Date.now() + 86400000).toISOString() });
  check("modification vers un compte confirmé : rattaché", (await prisma.loan.findUnique({ where: { id: danLoanId } }))?.borrowerId === danU.id);
  r = await loanTo(alice, email("alice"));
  check("se prêter à soi-même reste interdit", r.status === 400);
  void eveC;

  section("3. Sessions");
  const a2 = new Client();
  await a2.post("/api/auth/login", { email: email("alice"), password: PW });
  r = await alice.get("/api/account/sessions");
  check("deux appareils connectés", r.data.count === 2, r.data);
  const a3 = new Client();
  await a3.post("/api/auth/login", { email: email("alice"), password: PW });
  const a3token = a3.token!;
  r = await a3.post("/api/auth/logout");
  check("déconnexion → 200", r.status === 200);
  const replay = new Client(); replay.token = a3token;
  r = await replay.get("/api/auth/me");
  check("jeton réutilisé après la déconnexion → 401", r.status === 401);
  const web = new Client(randIp(), "cookie");
  r = await web.post("/api/auth/login", { email: email("alice"), password: PW });
  const webCookie = web.cookie;
  check("cookie de session HttpOnly posé", !!r.setCookie?.includes("HttpOnly") && !!webCookie, r.setCookie);
  check("cookie valable 30 jours", !!r.setCookie?.includes(`Max-Age=${30 * 86400}`), r.setCookie);
  r = await web.post("/api/auth/logout");
  check("déconnexion web : cookie effacé", web.cookie === null, r.setCookie);
  const stolen = new Client(randIp(), "cookie"); stolen.cookie = webCookie;
  r = await stolen.get("/api/auth/me");
  check("cookie volé réutilisé après la déconnexion → 401", r.status === 401);
  r = await alice.del("/api/account/sessions");
  check("« Déconnecter les autres appareils » → 200", r.status === 200);
  check("l'autre appareil est déconnecté", (await a2.get("/api/auth/me")).status === 401);
  check("cet appareil reste connecté", (await alice.get("/api/auth/me")).status === 200);
  check("une seule session restante", (await alice.get("/api/account/sessions")).data.count === 1);

  const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");
  const oldJwt = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(aliceU.id).setIssuedAt().setExpirationTime("30d").sign(secret);
  const old = new Client(); old.token = oldJwt;
  check("ancien jeton sans session (avant la mise à jour) → 401", (await old.get("/api/auth/me")).status === 401);
  const danSession = await prisma.session.findFirst({ where: { userId: danU.id } });
  const mixed = await new SignJWT({ sid: danSession!.id }).setProtectedHeader({ alg: "HS256" }).setSubject(aliceU.id).setIssuedAt().setExpirationTime("30d").sign(secret);
  const mix = new Client(); mix.token = mixed;
  check("jeton qui pointe vers la session d'un autre compte → 401", (await mix.get("/api/auth/me")).status === 401);
  const forged = await new SignJWT({ sid: danSession!.id }).setProtectedHeader({ alg: "HS256" }).setSubject(danU.id).setIssuedAt().setExpirationTime("30d").sign(new TextEncoder().encode("mauvaise-cle"));
  const forge = new Client(); forge.token = forged;
  check("jeton signé avec une autre clé → 401", (await forge.get("/api/auth/me")).status === 401);
  const exp = new Client();
  await exp.post("/api/auth/login", { email: email("dan"), password: PW });
  await prisma.session.updateMany({ where: { userId: danU.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  check("session expirée en base → 401", (await exp.get("/api/auth/me")).status === 401);
  const dis = new Client();
  await dis.post("/api/auth/login", { email: email("eve"), password: PW });
  await prisma.user.update({ where: { email: email("eve") }, data: { disabled: true } });
  check("compte désactivé par l'admin → 401 même connecté", (await dis.get("/api/auth/me")).status === 401);
  r = await new Client().post("/api/auth/login", { email: email("eve"), password: PW });
  check("compte désactivé : connexion refusée → 403", r.status === 403);

  section("4. Mot de passe oublié et réinitialisation");
  const before = await mailsTo(email("nobody"), "reset_password");
  r = await new Client().post("/api/auth/forgot-password", { email: email("nobody") });
  check("adresse inconnue → 200 (même réponse)", r.status === 200 && r.data.ok === true);
  check("adresse inconnue → aucun e-mail", (await mailsTo(email("nobody"), "reset_password")) === before);
  r = await new Client().post("/api/auth/forgot-password", { email: "pas-un-email" });
  check("adresse invalide → 400", r.status === 400);
  r = await new Client().post("/api/auth/forgot-password", { email: email("eve") });
  check("compte désactivé → 200 mais aucun e-mail", r.status === 200 && (await mailsTo(email("eve"), "reset_password")) === 0);
  const bob = await register("bob", true);
  for (let i = 1; i <= 4; i++) await new Client().post("/api/auth/forgot-password", { email: email("bob").toUpperCase() });
  check("4 demandes depuis 4 IP : 3 e-mails au plus vers la même adresse (et majuscules ignorées)", (await mailsTo(email("bob"), "reset_password")) === 3, await mailsTo(email("bob"), "reset_password"));
  const bobU = (await userBy(email("bob")))!;
  const tOld = await linkFor(bobU.id, "RESET_PASSWORD", email("bob"));
  const tNew = await linkFor(bobU.id, "RESET_PASSWORD", email("bob"));
  r = await anon.post("/api/auth/reset-password", { t: tOld, password: "Nouveau2pass" });
  check("un nouveau lien annule le précédent → 410", r.status === 410);
  r = await anon.post("/api/auth/reset-password", { t: tNew, password: "faible" });
  check("mot de passe trop faible → 400", r.status === 400);
  r = await anon.post("/api/auth/reset-password", { t: tNew, password: "Nouveau2pass" });
  check("le lien reste utilisable après un refus de mot de passe → 200", r.status === 200, r.data);
  check("toutes les sessions sont fermées", (await bob.get("/api/auth/me")).status === 401 && (await prisma.session.count({ where: { userId: bobU.id } })) === 0);
  check("alerte e-mail envoyée au titulaire", (await mailsTo(email("bob"), "security_notice")) === 1);
  r = await anon.post("/api/auth/reset-password", { t: tNew, password: "Encore3pass" });
  check("même lien une 2e fois → 410", r.status === 410);
  check("ancien mot de passe refusé", (await new Client().post("/api/auth/login", { email: email("bob"), password: PW })).status === 401);
  check("nouveau mot de passe accepté", (await bob.post("/api/auth/login", { email: email("bob"), password: "Nouveau2pass" })).status === 200);
  t = await linkFor(bobU.id, "RESET_PASSWORD", email("bob"), -1000);
  check("lien expiré → 410", (await anon.post("/api/auth/reset-password", { t, password: "Encore3pass" })).status === 410);
  t = await linkFor(bobU.id, "VERIFY_EMAIL", email("bob"));
  check("lien de confirmation utilisé pour réinitialiser → 410", (await anon.post("/api/auth/reset-password", { t, password: "Encore3pass" })).status === 410);
  t = await linkFor(bobU.id, "RESET_PASSWORD", email("bob-ancienne"));
  check("lien envoyé à une ancienne adresse du compte → 410", (await anon.post("/api/auth/reset-password", { t, password: "Encore3pass" })).status === 410);

  section("5. Changement de mot de passe");
  const b2 = new Client();
  await b2.post("/api/auth/login", { email: email("bob"), password: "Nouveau2pass" });
  check("non connecté → 401", (await new Client().post("/api/account/password", { current: "x", password: "Encore3pass" })).status === 401);
  r = await bob.post("/api/account/password", { current: "faux", password: "Encore3pass" });
  check("mot de passe actuel faux → 403", r.status === 403);
  r = await bob.post("/api/account/password", { current: "Nouveau2pass", password: "faible" });
  check("nouveau mot de passe trop faible → 400", r.status === 400);
  r = await bob.post("/api/account/password", { current: "Nouveau2pass", password: "Encore3pass" });
  check("changement → 200", r.status === 200, r.data);
  check("cet appareil reste connecté", (await bob.get("/api/auth/me")).status === 200);
  check("l'autre appareil est déconnecté", (await b2.get("/api/auth/me")).status === 401);
  check("alerte e-mail envoyée", (await mailsTo(email("bob"), "security_notice")) === 2);
  check("nouveau mot de passe accepté à la connexion", (await new Client().post("/api/auth/login", { email: email("bob"), password: "Encore3pass" })).status === 200);

  section("6. Changement d'adresse e-mail");
  let last = 0;
  check("mauvais mot de passe → 403", (await bob.post("/api/account/email", { email: email("bob2"), password: "faux" })).status === 403);
  check("même adresse → 400", (await bob.post("/api/account/email", { email: email("bob"), password: "Encore3pass" })).status === 400);
  check("adresse déjà prise → 409", (await bob.post("/api/account/email", { email: email("alice"), password: "Encore3pass" })).status === 409);
  check("adresse invalide → 400", (await bob.post("/api/account/email", { email: "nope", password: "Encore3pass" })).status === 400);
  r = await bob.post("/api/account/email", { email: email("bob2"), password: "Encore3pass" });
  check("demande → 200, adresse en attente", r.status === 200 && r.data.user?.pendingEmail === email("bob2") && r.data.user?.email === email("bob"), r.data);
  check("lien envoyé à la nouvelle adresse", (await mailsTo(email("bob2"), "verify_email")) === 1);
  const pendingTok = await prisma.authToken.findFirst({ where: { userId: bobU.id, kind: "VERIFY_EMAIL" } });
  check("le lien vise la nouvelle adresse", pendingTok?.email === email("bob2"));
  r = await bob.del("/api/account/email");
  check("annulation → adresse en attente effacée", r.status === 200 && r.data.user?.pendingEmail === null);
  check("annulation → lien supprimé", (await prisma.authToken.count({ where: { userId: bobU.id, kind: "VERIFY_EMAIL" } })) === 0);
  await bob.post("/api/account/email", { email: email("bob2"), password: "Encore3pass" });
  const tB2 = await linkFor(bobU.id, "VERIFY_EMAIL", email("bob2"));
  await bob.post("/api/account/email", { email: email("bob3"), password: "Encore3pass" });
  check("une nouvelle demande remplace la précédente", (await prisma.user.findUnique({ where: { id: bobU.id } }))?.pendingEmail === email("bob3"));
  check("lien de l'ancienne demande → 410", (await anon.post("/api/auth/verify-email", { t: tB2 })).status === 410);
  const tB3 = await linkFor(bobU.id, "VERIFY_EMAIL", email("bob3"));
  r = await loanTo(alice, email("bob3"), "Raclette");
  check("prêt fait à la future adresse avant confirmation : non rattaché", r.data.loan?.borrowerId === null);
  const racletteId = r.data.loan.id;
  const noticesBefore = await mailsTo(email("bob"), "security_notice");
  r = await anon.post("/api/auth/verify-email", { t: tB3 });
  check("confirmation → nouvelle adresse active", r.status === 200 && r.data.user?.email === email("bob3") && r.data.user?.pendingEmail === null, r.data);
  check("l'ancienne adresse est prévenue", (await mailsTo(email("bob"), "security_notice")) === noticesBefore + 1);
  check("prêts faits à la nouvelle adresse rattachés", (await prisma.loan.findUnique({ where: { id: racletteId } }))?.borrowerId === bobU.id);
  check("connexion avec la nouvelle adresse", (await new Client().post("/api/auth/login", { email: email("bob3"), password: "Encore3pass" })).status === 200);
  check("connexion avec l'ancienne adresse refusée", (await new Client().post("/api/auth/login", { email: email("bob"), password: "Encore3pass" })).status === 401);
  // adresse prise par quelqu'un d'autre entre la demande et la confirmation
  await bob.post("/api/account/email", { email: email("bob4"), password: "Encore3pass" });
  const tB4 = await linkFor(bobU.id, "VERIFY_EMAIL", email("bob4"));
  await register("bob4");
  r = await anon.post("/api/auth/verify-email", { t: tB4 });
  check("adresse prise entre-temps → 409, adresse inchangée", r.status === 409 && (await prisma.user.findUnique({ where: { id: bobU.id } }))?.email === email("bob3"), r.data);
  // compte non confirmé qui corrige une faute de frappe
  const typo = await register("tyop");
  await typo.post("/api/account/email", { email: email("typo"), password: PW });
  r = await typo.post("/api/auth/resend-verification");
  check("renvoi du lien : part vers la nouvelle adresse", r.status === 200 && r.data.email === email("typo"), r.data);
  const typoU = (await userBy(email("tyop")))!;
  await anon.post("/api/auth/verify-email", { t: await linkFor(typoU.id, "VERIFY_EMAIL", email("typo")) });
  const typoAfter = await prisma.user.findUnique({ where: { id: typoU.id } });
  check("faute de frappe corrigée : nouvelle adresse confirmée", typoAfter?.email === email("typo") && !!typoAfter?.emailVerifiedAt);
  for (let i = 0; i < 10; i++) last = (await typo.post("/api/account/email", { email: email("typo"), password: "faux" })).status;
  check("essais de mot de passe via le changement d'adresse : bloqués après 10 par heure → 429", last === 429, last);

  section("7. Limitation des tentatives");
  const brute = new Client();
  for (let i = 0; i < 11; i++) last = (await brute.post("/api/auth/login", { email: email("alice"), password: "faux" })).status;
  check("11e tentative de connexion depuis la même IP → 429", last === 429, last);
  const spoof = new Client();
  for (let i = 0; i < 11; i++) last = (await spoof.req("POST", "/api/auth/login", { email: email("alice"), password: "faux" }, { "X-Forwarded-For": `${randIp()}, ${spoof.ip}` })).status;
  check("en-tête X-Forwarded-For falsifié par le client : la limite tient quand même", last === 429, last);
  const fp = new Client();
  for (let i = 0; i < 6; i++) last = (await fp.post("/api/auth/forgot-password", { email: email(`x${i}`) })).status;
  check("6e « mot de passe oublié » depuis la même IP → 429", last === 429, last);
  const vb = new Client();
  for (let i = 0; i < 21; i++) last = (await vb.post("/api/auth/verify-email", { t: randomBytes(32).toString("base64url") })).status;
  check("21e essai de lien depuis la même IP → 429", last === 429, last);
  const tr = new Client();
  for (let i = 0; i < 125; i++) await tr.post("/api/track", { path: "/__secu-test", visitorId: "v" });
  const views = await prisma.pageView.count({ where: { path: "/__secu-test" } });
  check("mesure d'audience : au plus 120 pages vues par IP en 10 min", views === 120, views);
  const remindLoan = await prisma.loan.create({ data: { item: "Retard", borrowerName: "R", borrowerEmail: email("retard"), dueAt: new Date(Date.now() - 2 * 86400000), lenderId: aliceU.id } });
  const statuses: number[] = [];
  for (let i = 0; i < 31; i++) statuses.push((await alice.post(`/api/loans/${remindLoan.id}/remind`)).status);
  check("1re relance manuelle → 200", statuses[0] === 200, statuses[0]);
  check("relances suivantes du même prêt → 429 (1 par heure)", statuses.slice(1, 30).every((s) => s === 429));
  const lastRemind = await alice.post(`/api/loans/${remindLoan.id}/remind`);
  check("au-delà de 30 relances par heure : limite par compte", lastRemind.status === 429 && /Trop de relances/.test(lastRemind.data.error), lastRemind.data);
  check("une seule relance réellement envoyée", (await mailsTo(email("retard"), "loan_overdue")) === 1);

  section("8. Export RGPD, suppression du compte, purge");
  r = await alice.get("/api/account/export");
  const exp2 = r.data;
  check("export : sessions incluses (dates seulement)", Array.isArray(exp2.sessions) && exp2.sessions.length >= 1 && Object.keys(exp2.sessions[0]).sort().join() === "createdAt,expiresAt", exp2.sessions);
  check("export : date de confirmation et adresse en attente incluses", "emailVerifiedAt" in exp2.account && "pendingEmail" in exp2.account);
  check("export : ni mot de passe ni empreinte de lien", !JSON.stringify(exp2).includes("passwordHash") && !JSON.stringify(exp2).includes("tokenHash"));
  const danSessions = await prisma.session.count({ where: { userId: danU.id } });
  await dan.post("/api/auth/login", { email: email("dan"), password: PW });
  await linkFor(danU.id, "RESET_PASSWORD", email("dan"));
  r = await dan.req("DELETE", "/api/account", { password: PW });
  check("suppression du compte → 200", r.status === 200, r.data);
  check("sessions et liens supprimés avec le compte", (await prisma.session.count({ where: { userId: danU.id } })) === 0 && (await prisma.authToken.count({ where: { userId: danU.id } })) === 0 && danSessions >= 0);
  const eveU = (await userBy(email("eve")))!;
  await prisma.session.create({ data: { userId: eveU.id, expiresAt: new Date(Date.now() - 1000) } });
  await linkFor(eveU.id, "VERIFY_EMAIL", email("eve"), -1000);
  const keep = await prisma.session.create({ data: { userId: eveU.id, expiresAt: new Date(Date.now() + 86400000) } });
  const { runRetention } = await import("../src/lib/retention");
  const ret = await runRetention();
  check("purge : sessions et liens expirés supprimés", ret.sessions >= 1 && ret.authTokens >= 1, ret);
  check("purge : session encore valable conservée", !!(await prisma.session.findUnique({ where: { id: keep.id } })));

  section("9. Rôle admin (ADMIN_EMAIL) et mode paiement démo");
  process.env.ADMIN_EMAIL = email("boss");
  const boss = await register("boss");
  r = await boss.get("/api/auth/me");
  check("inscription avec ADMIN_EMAIL : pas admin avant confirmation", r.data.user?.role === "USER");
  const bossU = (await userBy(email("boss")))!;
  const { confirmEmail } = await import("../src/lib/account");
  await confirmEmail(bossU, email("boss"));
  check("admin seulement une fois l'adresse confirmée", (await userBy(email("boss")))?.role === "ADMIN");
  const demo = async (env: Record<string, string>) => {
    const { execFileSync } = await import("node:child_process");
    const out = execFileSync(process.execPath, ["--import", "tsx", "-e", "import('./src/lib/stripe.ts').then(m => console.log(m.demoBilling))"], {
      env: { ...process.env, STRIPE_SECRET_KEY: "", ...env }, encoding: "utf8",
    });
    return out.trim() === "true";
  };
  check("paiement démo actif en local (http, DEMO_BILLING=true)", await demo({ NODE_ENV: "production", DEMO_BILLING: "true", APP_URL: "http://localhost:3000" }));
  check("paiement démo refusé sur un site en https, même avec DEMO_BILLING=true", !(await demo({ NODE_ENV: "production", DEMO_BILLING: "true", APP_URL: "https://pret-materiel.fr" })));
  check("paiement démo refusé en production sans DEMO_BILLING", !(await demo({ NODE_ENV: "production", DEMO_BILLING: "", APP_URL: "http://localhost:3000" })));
}

main()
  .catch((e) => { failures.push(`exception : ${e instanceof Error ? e.stack : e}`); console.error(e); })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    console.log(`\n${passed} réussis, ${failures.length} échoués`);
    if (failures.length) { console.log(failures.map((f) => `  - ${f}`).join("\n")); process.exit(1); }
  });
