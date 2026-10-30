/**
 * npm run db:seed          → crée/met à jour le compte admin (ADMIN_EMAIL / ADMIN_PASSWORD)
 * npm run db:seed -- --demo → ajoute aussi des données fictives pour tester le tableau de bord
 */
import { PrismaClient, type Plan } from "@prisma/client";
import bcrypt from "bcryptjs";
import { dropUnresolvedReferences } from "../src/lib/app-secret";
import { DEFAULT_ADMIN_PASSWORDS, isPublicSite } from "../src/lib/config-check";
import { PLANS } from "../src/lib/plans";
import { passwordSchema } from "../src/lib/validation";

const prisma = new PrismaClient();
const usesDefaultPassword = async (hash: string) => {
  for (const pw of DEFAULT_ADMIN_PASSWORDS) if (await bcrypt.compare(pw, hash)) return true;
  return false;
};
const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]) => a[rand(a.length)];
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000 - rand(86400000));

async function main() {
  dropUnresolvedReferences();
  const email = (process.env.ADMIN_EMAIL || "admin@exemple.com").toLowerCase();
  // Site public sans ADMIN_PASSWORD : pas de compte créé ici. L'admin s'inscrit sur le site avec ADMIN_EMAIL
  // et reçoit le rôle admin en confirmant son adresse (src/lib/account.ts, confirmEmail).
  if (isPublicSite() && !process.env.ADMIN_PASSWORD) {
    console.log(`Admin : inscris-toi sur le site avec ${process.env.ADMIN_EMAIL || "l'adresse ADMIN_EMAIL"} puis confirme l'adresse pour devenir admin.`);
    return;
  }
  const password = process.env.ADMIN_PASSWORD || "admin1234";
  const strong = !DEFAULT_ADMIN_PASSWORDS.includes(password) && passwordSchema.safeParse(password).success;
  const existing = await prisma.user.findUnique({ where: { email } });

  if (isPublicSite() && !strong && (!existing || (await usesDefaultPassword(existing.passwordHash)))) {
    console.error("✗ Site public : définis un ADMIN_PASSWORD fort dans .env (8 caractères minimum, 3 types parmi minuscules, majuscules, chiffres, caractères spéciaux).");
    process.exit(1);
  }
  // Le mot de passe d'un admin existant n'est jamais écrasé, sauf s'il s'agit encore du mot de passe d'exemple
  const replaceDefault = !!existing && strong && (await usesDefaultPassword(existing.passwordHash));
  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", emailVerifiedAt: new Date(), ...(replaceDefault ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
    create: { email, name: "Admin", role: "ADMIN", passwordHash: await bcrypt.hash(password, 10), emailVerifiedAt: new Date() },
  });
  console.log(`Admin : ${admin.email}${replaceDefault ? " (mot de passe d'exemple remplacé par ADMIN_PASSWORD)" : ""}`);

  if (!process.argv.includes("--demo")) return;
  const hash = await bcrypt.hash("demo1234", 10);
  const names = ["Léa Martin", "Hugo Bernard", "Chloé Petit", "Lucas Robert", "Emma Richard", "Nicolas Durand", "Margaux Leroy", "Louis Moreau", "Claire Simon", "Thomas Laurent", "Manon Michel", "Julien Garcia", "Pauline David", "Antoine Bertrand", "Camille Roux"];
  const orgs = ["Atelier Martin", "Club de rando des Alpes", "BTP Durand & Fils", "Médiathèque de Lyon 7", "École de voile Iroise", "Studio Lumen", "Association Les Jardins", "Garage Moreau"];
  const items = ["Perforateur Hilti", "Ordinateur portable n° 12", "Tente 4 places", "Vidéoprojecteur Epson", "Échafaudage roulant", "Vélo de service", "Enceinte JBL", "Objectif 50 mm", "Scie sauteuse", "Tablette iPad n° 3"];
  const plans: Plan[] = ["FREE", "FREE", "FREE", "ENTREPRISE_YEARLY", "ENTREPRISE_YEARLY"];

  for (let i = 0; i < 60; i++) {
    const created = daysAgo(rand(360));
    const plan = pick(plans);
    const u = await prisma.user.create({
      data: {
        email: `demo${i}_${Date.now()}@exemple.com`, name: pick(names), organization: pick(orgs), passwordHash: hash, createdAt: created, lastLoginAt: daysAgo(rand(60)),
        plan, planExpiresAt: plan === "FREE" ? null : new Date(Date.now() + (1 + rand(300)) * 86400000),
      },
    });
    if (plan !== "FREE") {
      await prisma.payment.create({ data: { userId: u.id, plan, amountCents: PLANS[plan].priceCents, provider: "demo", providerRef: `demo_${u.id}`, createdAt: daysAgo(rand(300)) } });
    }
    for (let j = 0; j < 1 + rand(4); j++) {
      const lent = daysAgo(rand(120));
      const due = new Date(lent.getTime() + (7 + rand(30)) * 86400000);
      const returned = Math.random() < 0.6 && due < new Date() ? new Date(due.getTime() + (rand(10) - 5) * 86400000) : null;
      const money = Math.random() < 0.3;
      const amountCents = money ? (1 + rand(20)) * 5000 : null;
      // identité fictive de l'emprunteur (majeur) : prénom, nom, date de naissance
      const [first, last] = pick(names).split(" ");
      const birth = new Date(Date.UTC(1960 + rand(45), rand(12), 1 + rand(28)));
      await prisma.loan.create({
        data: {
          lenderId: u.id, item: money ? pick(["Avance sur frais de mission", "Acompte sur salaire", "Prêt d'argent", "Dépannage"]) : pick(items),
          kind: money ? "MONEY" : "OBJECT", amountCents, repaidCents: money ? (returned ? amountCents! : rand(2) * Math.floor(amountCents! / 2)) : 0,
          borrowerName: `${first} ${last}`, borrowerFirstName: first, borrowerLastName: last, borrowerBirthDate: birth, borrowerEmail: `ami${rand(100)}@exemple.com`, lentAt: lent, dueAt: due, createdAt: lent, status: returned ? "RETURNED" : "ACTIVE", returnedAt: returned,
          // données de démonstration : pas de document signé (accusé de réception non demandé ou en attente)
          ackStatus: pick(["NONE", "NONE", "PENDING", "REFUSED"] as const), ackRequestedAt: lent },
      });
    }
  }
  const paths = ["/", "/", "/", "/inscription", "/connexion", "/prets", "/prets/nouveau", "/abonnement", "/emprunts"];
  const refs = [null, null, "google.com", "instagram.com", "facebook.com", "tiktok.com", "reddit.com"];
  const views = [];
  for (let i = 0; i < 4000; i++) {
    views.push({ path: pick(paths), referrer: pick(refs), visitorId: `v${rand(900)}`, device: pick(["Mobile", "Mobile", "Mobile", "Ordinateur", "Tablette"]), browser: pick(["Chrome", "Safari", "Safari", "Firefox", "Edge"]), country: pick(["FR", "FR", "FR", "BE", "CH", "CA"]), createdAt: daysAgo(rand(90)) });
  }
  await prisma.pageView.createMany({ data: views });
  console.log("Données de démo ajoutées.");
}

main().finally(() => prisma.$disconnect());
