import { z } from "zod";
import { prisma } from "@/lib/db";
import { createToken, hashPassword, publicUser, setSessionCookie } from "@/lib/auth";
import { error, json, zodError } from "@/lib/api";

const schema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80),
  email: z.string().trim().toLowerCase().email("E-mail invalide"),
  password: z.string().min(8, "Mot de passe : 8 caractères minimum").max(200),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);
  const { name, email, password } = parsed.data;
  if (await prisma.user.findUnique({ where: { email } })) return error("Un compte existe déjà avec cet e-mail", 409);

  const isAdmin = !!process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL.toLowerCase();
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password), role: isAdmin ? "ADMIN" : "USER", lastLoginAt: new Date() },
  });
  // Rattache les prêts déjà faits à cet e-mail : la personne voit ses emprunts dès l'inscription.
  await prisma.loan.updateMany({ where: { borrowerEmail: email, borrowerId: null }, data: { borrowerId: user.id } });

  const token = await createToken(user.id);
  await setSessionCookie(token);
  return json({ user: publicUser(user), token }, 201);
}
