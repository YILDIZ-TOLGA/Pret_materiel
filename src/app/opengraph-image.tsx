import { ImageResponse } from "next/og";

// Aperçu affiché quand on partage un lien du site (WhatsApp, Messenger, LinkedIn, X…). Généré au build.
export const alt = "Prêt Matériel : prêté, signé, rendu.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#f2f0ea", INK = "#17191c", INK_2 = "#4b4f56", BRAND = "#1e5b47", BRAND_INK = "#fbfaf6";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: BG, padding: 80, color: INK }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* même ticket que l'icône du site (public/icon.svg) */}
          <svg width="88" height="88" viewBox="0 0 512 512">
            <rect width="512" height="512" rx="112" fill={BRAND} />
            <path fill={BRAND_INK} d="M112 168a24 24 0 0 1 24-24h240a24 24 0 0 1 24 24v48a40 40 0 0 0 0 80v48a24 24 0 0 1-24 24H136a24 24 0 0 1-24-24v-48a40 40 0 0 0 0-80v-48Z" />
            <path stroke={BRAND} strokeWidth="22" strokeDasharray="26 24" d="M312 170v172" />
          </svg>
          <div style={{ fontSize: 44, fontWeight: 700 }}>Prêt Matériel</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>Prêté, signé, rendu.</div>
          <div style={{ fontSize: 34, color: INK_2, lineHeight: 1.3 }}>Matériel et argent prêtés par ta structure : accusé de réception signé en ligne, reçus PDF, rappels automatiques.</div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: BRAND, fontWeight: 600 }}>Pour les entreprises et les associations</div>
      </div>
    ),
    size,
  );
}
