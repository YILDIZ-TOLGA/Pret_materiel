-- Nouvelle grille tarifaire : Gratuit, Perso, Pro 50 et Pro 200, chacune en mensuel ou en annuel.
-- Les anciennes valeurs sont renommées (pas supprimées) pour garder les abonnés et l'historique des paiements :
--   Mensuel → Perso mensuel, Annuel 10 → Perso annuel, Annuel 20 → Pro 50 annuel (plus de prêts, même prix payé).
ALTER TYPE "Plan" RENAME VALUE 'MONTHLY' TO 'PERSO_MONTHLY';
ALTER TYPE "Plan" RENAME VALUE 'YEARLY_10' TO 'PERSO_YEARLY';
ALTER TYPE "Plan" RENAME VALUE 'YEARLY_20' TO 'PRO50_YEARLY';
ALTER TYPE "Plan" ADD VALUE 'PRO50_MONTHLY' BEFORE 'PRO50_YEARLY';
ALTER TYPE "Plan" ADD VALUE 'PRO200_MONTHLY';
ALTER TYPE "Plan" ADD VALUE 'PRO200_YEARLY';
