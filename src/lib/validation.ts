import { z } from "zod";

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

export const loanSchema = z.object({
  kind: z.enum(["OBJECT", "MONEY"]).optional(),
  // objet prêté, ou motif pour un prêt d'argent
  item: z.string().trim().max(120).optional(),
  amountCents: z.number().int().positive("Montant invalide").max(100_000_000, "Montant trop élevé").optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  borrowerName: z.string().trim().min(1, "Nom de l'emprunteur requis").max(80),
  borrowerEmail: z.string().trim().toLowerCase().email("E-mail de l'emprunteur invalide"),
  borrowerPhone: z.string().trim().max(30).optional().nullable(),
  lentAt: z.coerce.date().optional(),
  dueAt: z.coerce.date({ message: "Date de retour invalide" }),
  autoReminder: z.boolean().optional(),
  remindBefore: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const repaySchema = z.object({
  amountCents: z.number().int().positive("Montant invalide"),
  note: z.string().trim().max(200).optional().nullable(),
});

/** Règles propres au type de prêt ; renvoie un message d'erreur ou null. */
export function checkLoanKind(data: { kind?: "OBJECT" | "MONEY"; item?: string; amountCents?: number | null }) {
  if (data.kind === "MONEY") {
    if (!data.amountCents) return "Montant requis pour un prêt d'argent";
    return null;
  }
  if (!data.item) return "Objet requis";
  return null;
}
