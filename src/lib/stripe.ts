import Stripe from "stripe";

export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

/** Sans clé Stripe et hors production, les abonnements s'activent directement (pour tester). */
export const demoBilling = !stripe && process.env.NODE_ENV !== "production";
