import Link from "next/link";
import { LEGAL_UPDATED_AT } from "@/lib/legal";
import { Brand } from "./Brand";
import { Icon } from "./Icon";
import { SiteFooter } from "./SiteFooter";
import { DayNight } from "./ui";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <header className="legal-top">
        <div className="legal-top-in">
          <Brand href="/" />
          <div className="legal-top-end">
            <Link href="/" className="crumb" style={{ margin: 0 }}><Icon name="arrowLeft" size={14} />Retour à l&apos;accueil</Link>
            <DayNight />
          </div>
        </div>
      </header>
      <main>
        <article className="legal page-in">
          <h1>{title}</h1>
          <p className="updated">Dernière mise à jour : {LEGAL_UPDATED_AT}</p>
          {children}
        </article>
      </main>
      <div style={{ marginTop: 64 }}><SiteFooter /></div>
    </>
  );
}
