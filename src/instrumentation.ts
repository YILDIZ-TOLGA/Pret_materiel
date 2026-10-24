/** Exécuté une fois au démarrage du serveur Next.js. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { checkProductionConfig } = await import("./lib/config-check");
  await checkProductionConfig();
}
