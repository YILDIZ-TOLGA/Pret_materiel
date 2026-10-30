/**
 * Tests de bout en bout des documents signés : accusé de réception signé par l'emprunteur (lien personnel,
 * sans compte), somme écrite en lettres et en chiffres pour un prêt d'argent, contestation, nouvelle signature
 * après modification, reçus de remboursement et attestation de restitution signés par le prêteur, PDF,
 * accès aux documents, relance de signature, nouvelles conditions à accepter, identité de l'emprunteur
 * (prénom, nom, date de naissance, majeur).
 *
 * À lancer contre un serveur de dev qui tourne, avec la même base :
 *   DATABASE_URL=… JWT_SECRET=… TEST_BASE_URL=http://localhost:3001 npx tsx scripts/test-signatures.ts
 * (JWT_SECRET doit être celui du serveur : il chiffre les liens de signature.)
 * Les comptes de test (…@sign-test.local) sont supprimés au début et à la fin.
 */
import { PrismaClient } from "@prisma/client";
import { receiptHash } from "../src/lib/receipts";
import { signToken } from "../src/lib/signlink";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3001";
const DOMAIN = "sign-test.local";
const PW = "Motdepasse1";
const DAY = 86400000;
const prisma = new PrismaClient();

// Ces tests se font en site payant (abonnement Entreprise), puis le site revient à son mode
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
  else { failures.push(name); console.log(`  ✗ ${name}${detail !== undefined ? ` → ${JSON.stringify(detail).slice(0, 400)}` : ""}`); }
}
const section = (t: string) => console.log(`\n${t}`);

const randIp = () => `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
type Res = { status: number; data: any; type: string; bytes: Buffer };
class Client {
  token: string | null = null;
  ip = randIp();
  async req(method: string, path: string, body?: unknown): Promise<Res> {
    const headers: Record<string, string> = { "X-Forwarded-For": this.ip, "User-Agent": "test-signatures" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    const bytes = Buffer.from(await res.arrayBuffer());
    let data: any = null;
    try { data = JSON.parse(bytes.toString("utf8")); } catch { data = null; }
    if (data?.token) this.token = data.token;
    return { status: res.status, data, type: res.headers.get("content-type") || "", bytes };
  }
  get = (p: string) => this.req("GET", p);
  post = (p: string, b: unknown = {}) => this.req("POST", p, b);
  patch = (p: string, b: unknown) => this.req("PATCH", p, b);
}

const email = (name: string) => `${name}@${DOMAIN}`;
async function register(name: string, opts: { plan?: boolean; organization?: string; fullName?: string } = {}) {
  const c = new Client();
  const r = await c.post("/api/auth/register", { name: opts.fullName ?? name, organization: opts.organization ?? `Structure ${name}`, email: email(name), password: PW, acceptTerms: true });
  if (r.status !== 201) throw new Error(`Inscription ${name} impossible : ${JSON.stringify(r.data)}`);
  await prisma.user.update({
    where: { email: email(name) },
    data: { emailVerifiedAt: new Date(), ...(opts.plan ? { plan: "ENTREPRISE_YEARLY" as const, planExpiresAt: new Date(Date.now() + 365 * DAY) } : {}) },
  });
  return c;
}
const due = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const SIGNATURE = { w: 600, h: 200, strokes: [[40, 120, 120, 60, 200, 140, 280, 70, 360, 130, 440, 80, 520, 120, 560, 100]] };
const LENDER_SIG = { signerName: "Claire Martin", signature: SIGNATURE, accept: true };
const mails = (to: string, kind: string) => prisma.emailLog.count({ where: { to, kind } });
const tokenOf = async (loanId: string) => signToken(await prisma.loan.findUniqueOrThrow({ where: { id: loanId }, select: { id: true, ackVersion: true } }));
/** Midi, heure de Paris : les rappels ne partent qu'entre 9 h et 21 h. */
function noon() {
  const parisHour = (d: Date) => Number(d.toLocaleString("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }));
  let d = new Date();
  while (parisHour(d) !== 12) d = new Date(d.getTime() + 3600000);
  return d;
}

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
  await prisma.emailLog.deleteMany({ where: { to: { endsWith: `@${DOMAIN}` } } });
  await prisma.emailOptOut.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
}

async function main() {
  await cleanup();
  await sitePaid();
  const anon = new Client();

  section("1. Nouveau prêt : demande de signature à l'emprunteur");
  const lender = await register("atelier", { plan: true, organization: "Atelier Martin", fullName: "Claire Martin" });
  let r = await lender.post("/api/loans", { item: "Perforateur Hilti", description: "Avec coffret", borrowerFirstName: "Léa", borrowerLastName: "Martin", borrowerBirthDate: "1990-05-14", borrowerEmail: email("lea"), dueAt: due(10), notes: "NOTE-SECRETE" });
  check("prêt créé, demande envoyée", r.status === 201 && r.data.signRequest === "sent" && r.data.loan.ackStatus === "PENDING" && !!r.data.loan.ackRequestedAt, r.data);
  const objectId = r.data.loan.id;
  check("e-mail de demande de signature journalisé (compte dans le plafond de nouveaux prêts)", (await mails(email("lea"), "loan_created")) === 1);
  const t1 = await tokenOf(objectId);
  r = await anon.get(`/api/sign?t=${encodeURIComponent(t1)}`);
  check("la page de signature s'ouvre sans compte", r.status === 200 && r.data.canSign === true && r.data.ackStatus === "PENDING", r.data);
  check("…avec le récapitulatif complet et la structure du prêteur", r.data.loan.item === "Perforateur Hilti" && r.data.loan.description === "Avec coffret" && r.data.lender.organization === "Atelier Martin" && !!r.data.loan.dueAt, r.data);
  check("…sans la note privée du prêteur ni l'adresse de l'emprunteur en clair", !JSON.stringify(r.data).includes("NOTE-SECRETE") && r.data.borrower.email === `l•••@${DOMAIN}`, r.data.borrower);
  check("…et la déclaration à signer, nom à compléter", r.data.statement.length === 2 && r.data.statement[0].includes("[nom et prénom]") && r.data.statement[0].includes("reçu d'Atelier Martin (Claire Martin)"), r.data.statement);
  check("…avec la date de naissance de l'emprunteur, à vérifier avant de signer", r.data.borrower.name === "Léa Martin" && r.data.borrower.birthDate === "1990-05-14" && r.data.statement[0].includes("[nom et prénom], né(e) le 14 mai 1990, reconnais"), { b: r.data.borrower, s: r.data.statement[0] });
  r = await anon.get(`/api/sign?t=${encodeURIComponent(t1.slice(0, -3) + (t1.endsWith("AAA") ? "BBB" : "AAA"))}`);
  check("lien modifié → 400", r.status === 400, r.data);
  const lenderDetail = await lender.get(`/api/loans/${objectId}`);
  check("le prêteur ne reçoit jamais le lien de signature", !JSON.stringify(lenderDetail.data).includes("/signer?t="), Object.keys(lenderDetail.data.loan));

  section("2. Signature de l'accusé de réception (matériel)");
  const borrowerTab = new Client();
  r = await borrowerTab.post("/api/sign", { t: t1, action: "sign", signerName: "Léa Martin", accept: true });
  check("sans signature → 400", r.status === 400, r.data);
  r = await borrowerTab.post("/api/sign", { t: t1, action: "sign", signerName: "Léa Martin", signature: { w: 600, h: 200, strokes: [[300, 100, 302, 101]] }, accept: true });
  check("simple point → 400 « signature trop courte »", r.status === 400 && /trop courte/.test(r.data.error), r.data);
  r = await borrowerTab.post("/api/sign", { t: t1, action: "sign", signerName: "Léa Martin", signature: SIGNATURE });
  check("case non cochée → 400", r.status === 400, r.data);
  r = await borrowerTab.post("/api/sign", { t: t1, action: "sign", signerName: "Léa Martin", signature: SIGNATURE, accept: true });
  check("signature → 200 avec un numéro AR-", r.status === 200 && /^AR-[A-Z0-9]{8}$/.test(r.data.receipt?.number), r.data);
  const ar = await prisma.receipt.findUniqueOrThrow({ where: { id: r.data.receipt.id } });
  const loanAfter = await prisma.loan.findUniqueOrThrow({ where: { id: objectId } });
  check("le prêt est signé", loanAfter.ackStatus === "SIGNED" && !!loanAfter.ackAt);
  check("document : signataire, adresse du lien, IP et navigateur enregistrés", ar.kind === "LOAN" && ar.signerName === "Léa Martin" && ar.signerEmail === email("lea") && ar.ip === borrowerTab.ip && ar.userAgent === "test-signatures", { ip: ar.ip, ua: ar.userAgent });
  check("la déclaration enregistrée contient le nom saisi et la date de naissance", JSON.stringify(ar.content).includes("Je soussigné(e) Léa Martin, né(e) le 14 mai 1990, reconnais avoir reçu d'Atelier Martin (Claire Martin)"), (ar.content as any).statement);
  check("…et l'identité de l'emprunteur figure dans les parties du document", (ar.content as any).borrower?.name === "Léa Martin" && (ar.content as any).borrower?.birthDate === "1990-05-14", (ar.content as any).borrower);
  check("l'empreinte SHA-256 se recalcule à l'identique depuis la base", ar.hash === receiptHash(ar) && /^[0-9a-f]{64}$/.test(ar.hash), ar.hash);
  check("PDF envoyé au prêteur (à imprimer)", (await mails(email("atelier"), "receipt_lender")) === 1);
  check("copie envoyée à l'emprunteur", (await mails(email("lea"), "receipt_loan")) === 1);
  check("le prêteur est prévenu dans l'appli", (await prisma.notification.count({ where: { user: { email: email("atelier") }, title: "Accusé de réception signé" } })) === 1);
  r = await borrowerTab.post("/api/sign", { t: t1, action: "sign", signerName: "Léa Martin", signature: SIGNATURE, accept: true });
  check("signer une deuxième fois → 409", r.status === 409, r.data);

  section("3. Documents PDF et accès");
  r = await lender.get(`/api/receipts/${ar.id}`);
  check("le prêteur télécharge le PDF", r.status === 200 && r.type === "application/pdf" && r.bytes.subarray(0, 5).toString() === "%PDF-" && r.bytes.length > 5000, { status: r.status, type: r.type, size: r.bytes.length });
  check("le premier téléchargement est noté (rappel d'impression levé)", !!(await prisma.receipt.findUniqueOrThrow({ where: { id: ar.id } })).downloadedAt);
  const stranger = await register("intrus", { plan: true });
  r = await stranger.get(`/api/receipts/${ar.id}`);
  check("un autre compte → 404", r.status === 404, r.data);
  r = await anon.get(`/api/receipts/${ar.id}`);
  check("sans être connecté → 401", r.status === 401, r.data);
  r = await anon.get(`/api/sign/pdf?t=${encodeURIComponent(t1)}&r=${ar.id}`);
  check("l'emprunteur télécharge sa copie depuis son lien", r.status === 200 && r.bytes.subarray(0, 5).toString() === "%PDF-", { status: r.status, type: r.type });

  section("4. Prêt d'argent : somme écrite par l'emprunteur, reçus signés par le prêteur");
  r = await lender.post("/api/loans", { kind: "MONEY", amountCents: 5000, item: "Avance sur frais", borrowerFirstName: "Julien", borrowerLastName: "Petit", borrowerBirthDate: "1990-05-14", borrowerEmail: email("julien"), dueAt: due(20) });
  const moneyId = r.data.loan.id;
  const t2 = await tokenOf(moneyId);
  r = await anon.get(`/api/sign?t=${encodeURIComponent(t2)}`);
  check("la page donne la somme en lettres à recopier", r.data.amountWords === "cinquante euros", r.data.amountWords);
  const julien = new Client();
  const base = { t: t2, action: "sign", signerName: "Julien Petit", signature: SIGNATURE, accept: true };
  r = await julien.post("/api/sign", { ...base, amountWords: "cinq euros", amountFigures: "50" });
  check("somme en lettres fausse → 400", r.status === 400 && /toutes lettres/.test(r.data.error), r.data);
  r = await julien.post("/api/sign", { ...base, amountWords: "Cinquante €", amountFigures: "5" });
  check("somme en chiffres fausse → 400", r.status === 400 && /chiffres/.test(r.data.error), r.data);
  r = await julien.post("/api/sign", { ...base, amountWords: "Cinquante euros", amountFigures: "50,00 €" });
  check("somme correcte (majuscule, format libre) → signé", r.status === 200, r.data);
  const arMoney = await prisma.receipt.findUniqueOrThrow({ where: { id: r.data.receipt.id } });
  check("la mention recopiée figure au document", (arMoney.content as any).mention?.words === "Cinquante euros" && (arMoney.content as any).mention?.figures === "50,00 €", (arMoney.content as any).mention);
  r = await lender.patch(`/api/loans/${moneyId}`, { action: "repay", amountCents: 2600 });
  check("remboursement sans signature du prêteur → 400", r.status === 400, r.data);
  r = await lender.patch(`/api/loans/${moneyId}`, { action: "repay", amountCents: 2600, note: "espèces", ...LENDER_SIG });
  check("26 € sur 50 € : reçu signé RR-", r.status === 200 && /^RR-/.test(r.data.receipt?.number) && r.data.loan.repaidCents === 2600, r.data);
  const rr = await prisma.receipt.findUniqueOrThrow({ where: { id: r.data.receipt.id } });
  const pay = (rr.content as any).payment;
  check("le reçu dit 26 € reçus, reste dû 24 €", pay.amountCents === 2600 && pay.remainingCents === 2400 && JSON.stringify(rr.content).includes("vingt-six euros"), pay);
  check("…signé par le prêteur, avec l'accusé de réception en référence", rr.signerName === "Claire Martin" && rr.signerEmail === email("atelier") && (rr.content as any).ackNumber === arMoney.number && !!rr.repaymentId);
  check("l'emprunteur reçoit sa copie du reçu", (await mails(email("julien"), "receipt_repayment")) === 1);
  r = await lender.patch(`/api/loans/${moneyId}`, { action: "return", ...LENDER_SIG });
  check("solder : reçu signé des 24 € restants, prêt clôturé", r.status === 200 && r.data.loan.status === "RETURNED" && r.data.loan.repaidCents === 5000, r.data.loan);
  const last = await prisma.receipt.findUniqueOrThrow({ where: { id: r.data.receipt.id } });
  check("…« intégralement remboursé »", (last.content as any).payment.amountCents === 2400 && JSON.stringify(last.content).includes("intégralement remboursé"));

  section("5. Contestation par l'emprunteur");
  r = await lender.post("/api/loans", { item: "Échelle", borrowerFirstName: "Karim", borrowerLastName: "Benali", borrowerBirthDate: "1990-05-14", borrowerEmail: email("karim"), lentAt: due(-20), dueAt: due(-5) });
  const disputedId = r.data.loan.id;
  const t3 = await tokenOf(disputedId);
  r = await anon.post("/api/sign", { t: t3, action: "refuse", reason: "Je n'ai jamais emprunté d'échelle" });
  check("contester → 200", r.status === 200, r.data);
  let disputed = await prisma.loan.findUniqueOrThrow({ where: { id: disputedId } });
  check("prêt marqué contesté, avec le motif", disputed.ackStatus === "REFUSED" && disputed.ackRefusalReason === "Je n'ai jamais emprunté d'échelle");
  check("le prêteur est prévenu (appli et e-mail)", (await prisma.notification.count({ where: { user: { email: email("atelier") }, title: "Prêt contesté" } })) === 1 && (await mails(email("atelier"), "loan_refused")) === 1);
  const { runReminders } = await import("../src/lib/loans");
  await runReminders(noon());
  check("plus aucun rappel à l'emprunteur qui conteste (même en retard)", (await mails(email("karim"), "loan_overdue")) === 0);
  r = await lender.post(`/api/loans/${disputedId}/remind`);
  check("relance manuelle refusée → 409", r.status === 409, r.data);
  r = await lender.patch(`/api/loans/${disputedId}`, { item: "Échelle télescopique" });
  disputed = await prisma.loan.findUniqueOrThrow({ where: { id: disputedId } });
  check("corriger le prêt → nouvelle demande, nouvelle version", r.status === 200 && r.data.signRequest === "sent" && disputed.ackStatus === "PENDING" && disputed.ackVersion === 2, { sr: r.data.signRequest, v: disputed.ackVersion });
  r = await anon.get(`/api/sign?t=${encodeURIComponent(t3)}`);
  check("l'ancien lien n'est plus valable → 410", r.status === 410, r.data);
  r = await anon.get(`/api/sign?t=${encodeURIComponent(await tokenOf(disputedId))}`);
  check("le nouveau lien permet de signer", r.status === 200 && r.data.canSign && r.data.loan.item === "Échelle télescopique", r.data);

  section("6. Modifier un prêt signé");
  r = await lender.patch(`/api/loans/${objectId}`, { notes: "rangé au dépôt" });
  check("changer la note privée ne redemande pas de signature", r.status === 200 && r.data.loan.ackStatus === "SIGNED" && r.data.signRequest === null, r.data);
  r = await lender.patch(`/api/loans/${objectId}`, { item: "Perforateur Hilti", dueAt: (await prisma.loan.findUniqueOrThrow({ where: { id: objectId } })).dueAt.toISOString() });
  check("renvoyer les mêmes valeurs ne redemande pas de signature", r.status === 200 && r.data.loan.ackStatus === "SIGNED", r.data.loan?.ackStatus);
  r = await lender.patch(`/api/loans/${objectId}`, { dueAt: due(30) });
  check("reporter l'échéance → nouvel accusé à signer", r.status === 200 && r.data.loan.ackStatus === "PENDING" && r.data.signRequest === "sent", r.data);
  check("…l'accusé déjà signé reste dans l'historique", (await prisma.receipt.count({ where: { loanId: objectId, kind: "LOAN" } })) === 1);
  check("…l'emprunteur reçoit la demande de signature de la nouvelle version", (await mails(email("lea"), "loan_sign_request")) === 1);

  section("7. Retour de l'objet : attestation signée par le prêteur");
  r = await lender.patch(`/api/loans/${objectId}`, { action: "return" });
  check("retour sans signature → 400", r.status === 400, r.data);
  r = await lender.patch(`/api/loans/${objectId}`, { action: "return", note: "Rendu complet, rayure sur le carter", ...LENDER_SIG });
  check("attestation de restitution signée AT-", r.status === 200 && r.data.loan.status === "RETURNED" && /^AT-/.test(r.data.receipt?.number), r.data);
  const at = await prisma.receipt.findUniqueOrThrow({ where: { id: r.data.receipt.id } });
  check("les observations figurent au document", (at.content as any).returned?.note === "Rendu complet, rayure sur le carter");
  check("l'emprunteur reçoit sa copie", (await mails(email("lea"), "receipt_return")) === 1);
  r = await lender.patch(`/api/loans/${objectId}`, { action: "reopen" });
  check("rouvrir après une attestation signée → 409", r.status === 409, r.data);
  r = await lender.patch(`/api/loans/${objectId}`, { item: "Autre chose" });
  check("prêt clôturé et signé : objet non modifiable → 409", r.status === 409, r.data);
  r = await lender.patch(`/api/loans/${objectId}`, { notes: "dossier rangé" });
  check("…mais la note privée reste modifiable", r.status === 200, r.data);

  section("8. Relance de signature et demande manuelle");
  r = await lender.post("/api/loans", { item: "Vidéoprojecteur", borrowerFirstName: "Emma", borrowerLastName: "Richard", borrowerBirthDate: "1990-05-14", borrowerEmail: email("emma"), dueAt: due(30) });
  const slowId = r.data.loan.id;
  r = await lender.post(`/api/loans/${slowId}/sign-request`);
  check("renvoyer la demande moins de 24 h après → 429", r.status === 429, r.data);
  await prisma.loan.update({ where: { id: slowId }, data: { ackRequestedAt: new Date(Date.now() - 3 * DAY) } });
  await runReminders(noon());
  let slow = await prisma.loan.findUniqueOrThrow({ where: { id: slowId } });
  check("pas signé après 48 h : une relance automatique", (await mails(email("emma"), "loan_sign_request")) === 1 && !!slow.ackRemindedAt && slow.reminderCount === 1, slow);
  check("…et le prêteur est prévenu", (await prisma.notification.count({ where: { user: { email: email("atelier") }, title: "Accusé de réception pas encore signé" } })) >= 1);
  await runReminders(noon());
  check("une seule relance automatique", (await mails(email("emma"), "loan_sign_request")) === 1);
  r = await lender.post(`/api/loans/${slowId}/sign-request`);
  slow = await prisma.loan.findUniqueOrThrow({ where: { id: slowId } });
  check("renvoi manuel après 24 h → 200, compté dans les rappels", r.status === 200 && slow.reminderCount === 2 && (await mails(email("emma"), "loan_sign_request")) === 2, r.data);
  const lenderId = (await prisma.user.findUniqueOrThrow({ where: { email: email("atelier") } })).id;
  const old = await prisma.loan.create({ data: { lenderId, item: "Ancien prêt", borrowerName: "Ancien", borrowerEmail: email("ancien"), dueAt: new Date(Date.now() + 9 * DAY), ackStatus: "NONE" } });
  r = await lender.post(`/api/loans/${old.id}/sign-request`);
  check("prêt enregistré avant les accusés, sans identité : demande refusée tant qu'elle manque", r.status === 400 && /date de naissance/.test(r.data.error) && (await prisma.loan.findUniqueOrThrow({ where: { id: old.id } })).ackStatus === "NONE", r.data);
  r = await lender.patch(`/api/loans/${old.id}`, { notes: "à compléter" });
  check("…une note privée reste modifiable sans l'identité", r.status === 200, r.data);
  r = await lender.patch(`/api/loans/${old.id}`, { remindBefore: false });
  check("…tout comme les rappels", r.status === 200 && r.data.loan.remindBefore === false, r.data);
  r = await lender.patch(`/api/loans/${old.id}`, { borrowerFirstName: "Jeanne", borrowerLastName: "Ancien", borrowerBirthDate: "1975-11-02" });
  check("…identité complétée : nom affiché « Prénom Nom », pas de demande envoyée d'office", r.status === 200 && r.data.loan.borrowerName === "Jeanne Ancien" && r.data.loan.ackStatus === "NONE" && r.data.signRequest === null, r.data);
  r = await lender.post(`/api/loans/${old.id}/sign-request`);
  check("…puis la signature peut être demandée", r.status === 200 && (await prisma.loan.findUniqueOrThrow({ where: { id: old.id } })).ackStatus === "PENDING", r.data);

  section("9. Comptes créés avant : nouvelles conditions à accepter");
  const former = await register("ancien-client", { plan: true });
  await prisma.user.update({ where: { email: email("ancien-client") }, data: { termsVersion: "2026-10-28", organization: null } });
  r = await former.get("/api/auth/me");
  check("profil : conditions à accepter", r.data.termsUpToDate === false, r.data.termsUpToDate);
  r = await former.post("/api/loans", { item: "Tente", borrowerFirstName: "Ami", borrowerLastName: "Emprunteur", borrowerBirthDate: "1990-05-14", borrowerEmail: email("ami"), dueAt: due(7) });
  check("créer un prêt → 403 TERMS_UPDATE_REQUIRED", r.status === 403 && r.data.code === "TERMS_UPDATE_REQUIRED", r.data);
  r = await former.post("/api/account/terms", { acceptTerms: true });
  check("accepter sans nom de structure → 400", r.status === 400, r.data);
  r = await former.post("/api/account/terms", { acceptTerms: true, organization: "Club de voile" });
  check("accepter avec la structure → 200, version enregistrée", r.status === 200 && r.data.user.organization === "Club de voile" && !!r.data.user.termsVersion, r.data);
  r = await former.post("/api/loans", { item: "Tente", borrowerFirstName: "Ami", borrowerLastName: "Emprunteur", borrowerBirthDate: "1990-05-14", borrowerEmail: email("ami"), dueAt: due(7) });
  check("ensuite, créer un prêt → 201", r.status === 201, r.data);
  // compte qui a accepté les conditions réservées aux professionnels, mais pas l'ajout de l'identité de l'emprunteur
  await prisma.user.update({ where: { email: email("ancien-client") }, data: { termsVersion: "2026-10-30" } });
  r = await former.get("/api/auth/me");
  check("conditions du 30 octobre sans l'identité de l'emprunteur : nouvel accord demandé", r.data.termsUpToDate === false, r.data.termsUpToDate);
  r = await former.post("/api/loans", { item: "Pagaie", borrowerFirstName: "Ami", borrowerLastName: "Emprunteur", borrowerBirthDate: "1990-05-14", borrowerEmail: email("ami"), dueAt: due(7) });
  check("…créer un prêt → 403 TERMS_UPDATE_REQUIRED", r.status === 403 && r.data.code === "TERMS_UPDATE_REQUIRED", r.data);
  r = await former.post("/api/account/terms", { acceptTerms: true });
  check("…accepter (structure déjà connue) → 200", r.status === 200 && r.data.user.termsVersion > "2026-10-30", r.data.user?.termsVersion);

  section("10. Emprunteur inscrit et export des données");
  const leaAccount = await register("lea", { organization: "Bureau d'études Martin" });
  r = await leaAccount.get("/api/borrowed");
  const borrowed = r.data.loans?.find((l: any) => l.id === objectId);
  check("l'emprunt apparaît, avec sa page personnelle et ses documents", !!borrowed?.url?.startsWith("/signer?t=") && borrowed.receipts.length === 2, borrowed);
  check("…sans la note privée du prêteur", !JSON.stringify(r.data).includes("NOTE-SECRETE") && !JSON.stringify(r.data).includes("dossier rangé"));
  r = await leaAccount.get(`/api/receipts/${at.id}`);
  check("l'emprunteur inscrit télécharge l'attestation", r.status === 200 && r.type === "application/pdf", r.status);
  r = await lender.get("/api/account/export");
  check("l'export du prêteur contient les documents signés", JSON.stringify(r.data).includes(ar.number) && JSON.stringify(r.data).includes(at.number));
  r = await leaAccount.get("/api/account/export");
  const received = r.data.loansReceived?.find((l: any) => l.id === objectId);
  check("l'export de l'emprunteur contient l'identité saisie par le prêteur", received?.borrowerName === "Léa Martin" && received?.borrowerFirstName === "Léa" && received?.borrowerBirthDate?.startsWith("1990-05-14"), received);

  section("11. Identité de l'emprunteur : prénom, nom et date de naissance");
  const idBase = { item: "Niveau laser", borrowerEmail: email("id1"), dueAt: due(15) };
  r = await lender.post("/api/loans", idBase);
  check("sans identité → 400", r.status === 400 && /Prénom de l'emprunteur requis/.test(r.data.error), r.data);
  r = await lender.post("/api/loans", { ...idBase, borrowerFirstName: "Inès", borrowerLastName: "Moreau" });
  check("sans date de naissance → 400", r.status === 400 && /Date de naissance de l'emprunteur requise/.test(r.data.error), r.data);
  r = await lender.post("/api/loans", { ...idBase, borrowerFirstName: "Inès", borrowerLastName: "Moreau", borrowerBirthDate: "1990-02-30" });
  check("date qui n'existe pas → 400", r.status === 400 && /invalide/.test(r.data.error), r.data);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  // dates de naissance relatives au jour de Paris, celui que l'API utilise pour l'âge
  const parisToday = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  const yearsAgo = (y: number, days = 0) => { const d = new Date(`${parisToday}T12:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() - y); return ymd(new Date(d.getTime() + days * DAY)); };
  r = await lender.post("/api/loans", { ...idBase, borrowerFirstName: "Inès", borrowerLastName: "Moreau", borrowerBirthDate: yearsAgo(17) });
  check("emprunteur mineur → 400, représentant légal à indiquer", r.status === 400 && /majeur/.test(r.data.error) && /représentant légal/.test(r.data.error), r.data);
  r = await lender.post("/api/loans", { ...idBase, borrowerFirstName: "Inès", borrowerLastName: "Moreau", borrowerBirthDate: yearsAgo(18, -100), lentAt: due(-200) });
  check("majeur aujourd'hui mais mineur à la date du prêt → 400", r.status === 400 && /majeur à la date du prêt/.test(r.data.error), r.data);
  r = await lender.post("/api/loans", { ...idBase, borrowerFirstName: "Inès", borrowerLastName: "http://faux-site.example", borrowerBirthDate: "1992-07-01" });
  check("adresse web dans le nom → 400", r.status === 400 && /site internet/.test(r.data.error), r.data);
  check("aucun e-mail envoyé pour ces refus", (await mails(email("id1"), "loan_created")) === 0);
  r = await lender.post("/api/loans", { ...idBase, borrowerFirstName: "  Inès  Claire ", borrowerLastName: " Moreau ", borrowerBirthDate: yearsAgo(18) });
  check("18 ans aujourd'hui → 201, nom affiché « Prénom Nom » sans espaces en trop", r.status === 201 && r.data.loan.borrowerName === "Inès Claire Moreau" && r.data.loan.borrowerFirstName === "Inès Claire" && r.data.loan.borrowerBirthDate.startsWith(yearsAgo(18)), r.data.loan);
  const idLoan = r.data.loan.id;
  const tId = await tokenOf(idLoan);
  r = await new Client().post("/api/sign", { t: tId, action: "sign", signerName: "Inès Claire Moreau", signature: SIGNATURE, accept: true });
  check("l'emprunteur signe", r.status === 200, r.data);
  r = await lender.patch(`/api/loans/${idLoan}`, { borrowerBirthDate: "1991-03-08" });
  const reSigned = await prisma.loan.findUniqueOrThrow({ where: { id: idLoan } });
  check("corriger la date de naissance d'un prêt signé → nouvel accusé à signer", r.status === 200 && r.data.signRequest === "sent" && reSigned.ackStatus === "PENDING" && reSigned.ackVersion === 2, { status: r.status, sr: r.data.signRequest, ack: reSigned.ackStatus, v: reSigned.ackVersion });
  r = await anon.get(`/api/sign?t=${encodeURIComponent(tId)}`);
  check("…l'ancien lien n'est plus valable (410)", r.status === 410, r.data);
  r = await anon.get(`/api/sign?t=${encodeURIComponent(await tokenOf(idLoan))}`);
  check("…le nouveau montre la date corrigée", r.status === 200 && r.data.borrower.birthDate === "1991-03-08" && r.data.statement[0].includes("né(e) le 8 mars 1991"), r.data.borrower);
  r = await lender.patch(`/api/loans/${idLoan}`, { borrowerBirthDate: yearsAgo(16) });
  check("modifier pour une date de mineur → 400", r.status === 400 && /majeur/.test(r.data.error), r.data);
  r = await lender.patch(`/api/loans/${idLoan}`, { borrowerLastName: "" });
  check("vider le nom → 400", r.status === 400 && /Nom de l'emprunteur requis/.test(r.data.error), r.data);
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
