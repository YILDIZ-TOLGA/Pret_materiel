import Link from "next/link";
import { Brand } from "./Brand";

const LINKS = [
  ["/mentions-legales", "Mentions légales"],
  ["/cgu", "CGU et CGV"],
  ["/confidentialite", "Confidentialité"],
  ["/cookies", "Cookies"],
] as const;

/** Liens vers les pages légales, accessibles depuis toutes les pages (LCEN, RGPD). */
export function LegalLinks() {
  return (
    <nav className="legal-links" aria-label="Informations légales">
      {LINKS.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="site-foot-in">
        <Brand href="/" />
        <span className="copy">© {new Date().getFullYear()} Prêt Matériel</span>
        <LegalLinks />
      </div>
    </footer>
  );
}
