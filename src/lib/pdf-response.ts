import { clientIp } from "./ratelimit";

/** Réponse PDF à télécharger (jamais mise en cache : le document contient des données personnelles). */
export const pdfResponse = (pdf: Uint8Array, filename: string) =>
  new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });

/** Éléments de preuve d'une signature : adresse IP et navigateur du signataire. */
export async function signatureProof(req: Request) {
  const ip = await clientIp();
  return { ip: ip === "local" ? null : ip, userAgent: req.headers.get("user-agent")?.slice(0, 300) || null };
}
