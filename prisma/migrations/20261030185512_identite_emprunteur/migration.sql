-- Identité de l'emprunteur (prénom, nom, date de naissance), obligatoire pour les nouveaux prêts.
-- Les prêts antérieurs gardent leurs colonnes vides : le prêteur les complète en modifiant le prêt.
ALTER TABLE "Loan" ADD COLUMN     "borrowerBirthDate" DATE,
ADD COLUMN     "borrowerFirstName" TEXT,
ADD COLUMN     "borrowerLastName" TEXT;
