import { z } from "zod";

export const loanSchema = z.object({
  item: z.string().trim().min(1, "Objet requis").max(120),
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
