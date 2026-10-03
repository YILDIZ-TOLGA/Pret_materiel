import Stripe from "stripe";

export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

/**
 * Sans clé Stripe, les abonnements s'activent directement (pour tester) :
 * toujours en développement, et en production seulement si DEMO_BILLING=true.
 * Jamais sur un site public (APP_URL en https://), même si DEMO_BILLING est resté à true.
 */
const publicSite = (process.env.APP_URL || "").startsWith("https://");
export const demoBilling = !stripe && !publicSite && (process.env.NODE_ENV !== "production" || process.env.DEMO_BILLING === "true");
