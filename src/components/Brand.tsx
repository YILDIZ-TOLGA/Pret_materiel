import Link from "next/link";

/** Marque : un ticket de prêt (encoches + perforation), le motif qui structure toute l'interface. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8.5" fill="var(--brand)" />
      <path fill="var(--brand-ink)" d="M7 10.5A1.5 1.5 0 0 1 8.5 9h15a1.5 1.5 0 0 1 1.5 1.5v3a2.5 2.5 0 0 0 0 5v3a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 7 21.5v-3a2.5 2.5 0 0 0 0-5v-3Z" />
      <path stroke="var(--brand)" strokeWidth="1.5" strokeDasharray="1.7 1.6" d="M19.5 10.6v10.8" />
    </svg>
  );
}

export function Brand({ href = "/prets", compact }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="brand" aria-label={compact ? "Prêt Matériel" : undefined}>
      <LogoMark />
      {!compact && <span className="brand-word">Prêt Matériel</span>}
    </Link>
  );
}
