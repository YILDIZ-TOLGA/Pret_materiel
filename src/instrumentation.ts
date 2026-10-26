/** Exécuté une fois au démarrage du serveur Next.js. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // clé de signature générée et gardée en base si l'hébergeur ne la fournit pas
  const { ensureAppSecret } = await import("./lib/app-secret");
  await ensureAppSecret();
  const { checkProductionConfig } = await import("./lib/config-check");
  await checkProductionConfig();
}
