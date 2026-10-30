import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const aesKey = () => createHash("sha256").update(`sign-aes:${process.env.JWT_SECRET || "dev-secret-change-me"}`).digest();
const appUrl = () => process.env.APP_URL || "http://localhost:3000";

/**
 * Lien personnel de l'emprunteur (signature de l'accusé de réception, suivi du prêt, copies des documents) :
 * identifiant du prêt et version de la demande, chiffrés en AES-256-GCM (donc infalsifiables), comme les liens
 * de désinscription. Rien de lisible dans l'adresse ; quand le prêt est modifié, la version change et les liens
 * déjà envoyés ne permettent plus de signer l'ancienne version.
 * Ce lien n'est jamais montré au prêteur : il pourrait sinon signer à la place de l'emprunteur.
 */
export function signToken(loan: { id: string; ackVersion: number }) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(), iv);
  const data = Buffer.concat([cipher.update(`${loan.id}.${loan.ackVersion}`, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

/** Prêt et version désignés par un lien, ou null s'il est invalide ou falsifié. */
export function parseSignToken(token: string) {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 30 || raw.length > 200) return null;
    const decipher = createDecipheriv("aes-256-gcm", aesKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const [loanId, version] = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8").split(".");
    return loanId && Number(version) > 0 ? { loanId, version: Number(version) } : null;
  } catch {
    return null;
  }
}

/** Page de l'emprunteur : relative pour l'appli (Emprunts), absolue pour les e-mails. */
export const signPath = (loan: { id: string; ackVersion: number }) => `/signer?t=${signToken(loan)}`;
export const signUrl = (loan: { id: string; ackVersion: number }) => `${appUrl()}${signPath(loan)}`;
