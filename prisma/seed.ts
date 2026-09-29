/**
 * npm run db:seed          → crée/met à jour le compte admin (ADMIN_EMAIL / ADMIN_PASSWORD)
 * npm run db:seed -- --demo → ajoute aussi des données fictives pour tester le tableau de bord
 */
import { PrismaClient, type Plan } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PRICES: Record<Plan, number> = { FREE: 0, MONTHLY: 200, YEARLY_10: 1200, YEARLY_20: 2400 };
const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]) => a[rand(a.length)];
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000 - rand(86400000));

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@exemple.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "admin1234";
  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN" },
    create: { email, name: "Admin", role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`Admin : ${admin.email}`);

  if (!process.argv.includes("--demo")) return;
  const hash = await bcrypt.hash("demo1234", 10);
  const names = ["Léa", "Hugo", "Chloé", "Lucas", "Emma", "Nathan", "Inès", "Louis", "Jade", "Tom", "Manon", "Yanis", "Sarah", "Adam", "Camille"];
  const items = ["Perceuse", "Dune tome 1", "Tente 4 places", "Manette PS5", "Appareil à raclette", "Échelle", "Vélo", "Enceinte JBL", "Objectif 50mm", "Scie sauteuse"];
  const plans: Plan[] = ["FREE", "FREE", "FREE", "FREE", "MONTHLY", "YEARLY_10", "YEARLY_20"];

  for (let i = 0; i < 60; i++) {
    const created = daysAgo(rand(360));
    const plan = pick(plans);
    const u = await prisma.user.create({
      data: {
        email: `demo${i}_${Date.now()}@exemple.com`, name: pick(names), passwordHash: hash, createdAt: created, lastLoginAt: daysAgo(rand(60)),
        plan, planExpiresAt: plan === "FREE" ? null : new Date(Date.now() + (1 + rand(300)) * 86400000),
      },
    });
    if (plan !== "FREE") {
      const monthsPaid = plan === "MONTHLY" ? 1 + rand(8) : 1;
      for (let m = 0; m < monthsPaid; m++) {
        await prisma.payment.create({ data: { userId: u.id, plan, amountCents: PRICES[plan], provider: "demo", providerRef: `demo_${u.id}_${m}`, createdAt: daysAgo(m * 30 + rand(20)) } });
      }
    }
    for (let j = 0; j < 1 + rand(4); j++) {
      const lent = daysAgo(rand(120));
      const due = new Date(lent.getTime() + (7 + rand(30)) * 86400000);
      const returned = Math.random() < 0.6 && due < new Date() ? new Date(due.getTime() + (rand(10) - 5) * 86400000) : null;
      await prisma.loan.create({
        data: { lenderId: u.id, item: pick(items), borrowerName: pick(names), borrowerEmail: `ami${rand(100)}@exemple.com`, lentAt: lent, dueAt: due, createdAt: lent, status: returned ? "RETURNED" : "ACTIVE", returnedAt: returned },
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
