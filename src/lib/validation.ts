import { z } from "zod";
import { signatureProblem, type SignatureData } from "./signature";

/**
 * Mot de passe conforme à la recommandation CNIL (délibération 2022-100) avec limitation des essais :
 * 8 caractères minimum et au moins 3 types parmi minuscules, majuscules, chiffres, caractères spéciaux.
 */
export const passwordSchema = z
  .string()
  .min(8, "Mot de passe : 8 caractères minimum")
  .max(200)
  .refine(
    (pw) => [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(pw)).length >= 3,
    "Mot de passe : utilise au moins 3 types de caractères parmi minuscules, majuscules, chiffres et caractères spéciaux",
  );

/**
 * Anti-hameçonnage : le nom du prêteur, l'objet et le nom de l'emprunteur sont repris dans les e-mails
 * envoyés à des tiers. On y refuse les adresses web (« www. », « http:// », « site.com »…).
 */
const LINK = /(https?:\/\/|www\.|[a-z0-9-]\.(com|fr|net|org|io|co|me|ly|xyz|info|biz|ru|app|link|site|online|shop|top|click)\b)/i;
export const noLink = (s: string) => !LINK.test(s);
export const NO_LINK = "Pas d'adresse de site internet dans ce champ";

/** « 1985-03-12 » → ce jour à minuit UTC (une date du calendrier, sans heure), ou null s'il n'existe pas (31 février…). */
export function calendarDay(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? d : null;
}

// Identité de l'emprunteur, reprise sur l'accusé de réception et les reçus (le nom affiché en est tiré)
const personName = (label: string) => z.string({ message: `${label} de l'emprunteur requis` })
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1, `${label} de l'emprunteur requis`).max(60, `${label} de l'emprunteur : 60 caractères maximum`).refine(noLink, NO_LINK));
const birthDateSchema = z.string({ message: "Date de naissance de l'emprunteur requise" }).trim()
  .refine((s) => !!calendarDay(s), "Date de naissance de l'emprunteur invalide")
  .transform((s) => calendarDay(s)!);

export const loanSchema = z.object({
  kind: z.enum(["OBJECT", "MONEY"]).optional(),
  // objet prêté, ou motif pour un prêt d'argent
  item: z.string().trim().max(120).refine(noLink, NO_LINK).optional(),
  amountCents: z.number().int().positive("Montant invalide").max(100_000_000, "Montant trop élevé").optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  borrowerFirstName: personName("Prénom"),
  borrowerLastName: personName("Nom"),
  borrowerBirthDate: birthDateSchema,
  borrowerEmail: z.string().trim().toLowerCase().email("E-mail de l'emprunteur invalide"),
  borrowerPhone: z.string().trim().max(30).optional().nullable(),
  lentAt: z.coerce.date().optional(),
  dueAt: z.coerce.date({ message: "Date de retour invalide" }),
  autoReminder: z.boolean().optional(),
  remindBefore: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

/** Signature tracée (voir src/lib/signature.ts) ou au clavier. La qualité du tracé se vérifie avec checkSignature. */
export const signatureSchema = z.union([
  z.object({
    w: z.number().int().min(100).max(2000),
    h: z.number().int().min(40).max(1000),
    strokes: z.array(z.array(z.number().int().min(0).max(2000)).min(2).max(4000)).min(1).max(80),
  }),
  z.object({ typed: z.literal(true) }),
], { error: "Signature manquante ou invalide" });

/** Problème du tracé (trop court, hors cadre…), ou null. */
export const checkSignature = (s: SignatureData) => ("strokes" in s ? signatureProblem(s) : null);

export const signerNameSchema = z.string().trim().min(2, "Nom et prénom du signataire requis").max(120).refine(noLink, NO_LINK);

/** Signature d'un reçu par le prêteur (remboursement, retour), depuis son compte. */
const lenderSign = {
  signerName: signerNameSchema,
  signature: signatureSchema,
  accept: z.literal(true, { message: "Coche la case pour signer le document" }),
};

/** Remboursement reçu, avec le reçu signé par le prêteur. `note` (espèces, virement…) figure sur le reçu. */
export const repaySchema = z.object({
  amountCents: z.number().int().positive("Montant invalide"),
  note: z.string().trim().max(200).refine(noLink, NO_LINK).optional().nullable(),
  ...lenderSign,
});

/** Retour de l'objet (ou solde d'un prêt d'argent), avec l'attestation signée par le prêteur. */
export const returnSchema = z.object({
  // observations sur l'état du bien au retour, reprises dans l'attestation
  note: z.string().trim().max(500).refine(noLink, NO_LINK).optional().nullable(),
  ...lenderSign,
});

/** Page de signature de l'emprunteur : signer l'accusé de réception, ou contester le prêt. */
export const borrowerSignSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sign"),
    t: z.string().min(20).max(400),
    signerName: signerNameSchema,
    signature: signatureSchema,
    // prêt d'argent : somme recopiée en lettres et en chiffres (art. 1376 C. civ.)
    amountWords: z.string().trim().max(300).optional(),
    amountFigures: z.string().trim().max(40).optional(),
    accept: z.literal(true, { message: "Cochez la case pour signer l'accusé de réception" }),
  }),
  z.object({
    action: z.literal("refuse"),
    t: z.string().min(20).max(400),
    reason: z.string().trim().max(500).refine(noLink, NO_LINK).optional().nullable(),
  }),
]);

/** La date de retour ne peut pas précéder la date du prêt ; renvoie un message d'erreur ou null. */
export function checkDates(lentAt: Date, dueAt: Date) {
  return dueAt.getTime() < lentAt.getTime() ? "La date de retour doit être après la date du prêt" : null;
}

/** « Prénom Nom », le nom de l'emprunteur affiché dans les listes, les e-mails et les documents. */
export const borrowerFullName = (first: string, last: string) => `${first} ${last}`;

const parisToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
/**
 * Un mineur ne peut pas s'engager seul (art. 1146 C. civ.) : l'emprunteur doit être majeur à la date du prêt
 * et le jour où il signe. Pour un mineur, c'est son représentant légal qui emprunte et signe.
 * Renvoie un message d'erreur ou null.
 */
export function checkBorrowerAge(birthDate: Date, lentAt: Date) {
  const birth = birthDate.toISOString().slice(0, 10);
  if (birth > parisToday()) return "La date de naissance de l'emprunteur est dans le futur";
  if (birth < "1900-01-01") return "Date de naissance de l'emprunteur invalide";
  // 18e anniversaire, comparé aux dates du calendrier (AAAA-MM-JJ)
  const adultOn = `${Number(birth.slice(0, 4)) + 18}${birth.slice(4)}`;
  const minor = "Pour un mineur, indique son représentant légal (parent ou tuteur) : c'est lui qui empruntera et signera.";
  if (adultOn > lentAt.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" })) return `L'emprunteur doit être majeur à la date du prêt. ${minor}`;
  if (adultOn > parisToday()) return `L'emprunteur doit être majeur pour signer l'accusé de réception. ${minor}`;
  return null;
}

/** Identité complète de l'emprunteur, exigée pour tout document qu'il signe ; renvoie un message d'erreur ou null. */
export function identityMissing(l: { borrowerFirstName: string | null; borrowerLastName: string | null; borrowerBirthDate: Date | null }) {
  return l.borrowerFirstName && l.borrowerLastName && l.borrowerBirthDate
    ? null
    : "Prénom, nom et date de naissance de l'emprunteur requis : ils figurent sur l'accusé de réception qu'il signe.";
}

/** Règles propres au type de prêt ; renvoie un message d'erreur ou null. */
export function checkLoanKind(data: { kind?: "OBJECT" | "MONEY"; item?: string; amountCents?: number | null }) {
  if (data.kind === "MONEY") {
    if (!data.amountCents) return "Montant requis pour un prêt d'argent";
    return null;
  }
  if (!data.item) return "Objet requis";
  return null;
}
