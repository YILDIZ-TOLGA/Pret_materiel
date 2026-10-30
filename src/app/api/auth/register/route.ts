import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/account";
import { createToken, hashPassword, publicUser, setSessionCookie } from "@/lib/auth";
import { error, json, zodError } from "@/lib/api";
import { TERMS_VERSION } from "@/lib/legal";
import { rateLimited } from "@/lib/ratelimit";
import { NO_LINK, noLink, passwordSchema } from "@/lib/validation";

const schema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80).refine(noLink, NO_LINK),
  // service réservé aux professionnels : la structure est responsable des données de ses emprunteurs (CGU art. 2)
  organization: z.string().trim().min(1, "Nom de la structure requis").max(120).refine(noLink, NO_LINK),
  email: z.string().trim().toLowerCase().email("E-mail invalide"),
  password: passwordSchema,
  // CGU acceptées et déclaration d'agir pour une structure, dans le cadre de son activité
  acceptTerms: z.literal(true, { message: "Tu dois accepter les conditions générales et confirmer que le compte est ouvert pour une structure" }),
});

export async function POST(req: Request) {
  if (await rateLimited("register", 10, 60 * 60 * 1000)) return error("Trop de tentatives, réessaie plus tard", 429);
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);
  const { name, organization, email, password } = parsed.data;
  if (await prisma.user.findUnique({ where: { email } })) return error("Un compte existe déjà avec cet e-mail", 409);

  const now = new Date();
  const user = await prisma.user.create({
    data: { name, organization, email, passwordHash: await hashPassword(password), lastLoginAt: now, termsAcceptedAt: now, termsVersion: TERMS_VERSION },
  });
  // Les emprunts faits à cette adresse (et le rôle admin pour ADMIN_EMAIL) ne sont rattachés
  // qu'une fois l'adresse confirmée par le lien : voir confirmEmail().
  await sendVerificationEmail(user, email);

  const token = await createToken(user.id);
  await setSessionCookie(token);
  return json({ user: publicUser(user), token }, 201);
}
