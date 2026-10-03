import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Mentions légales · Prêt Matériel" };

export default function Page() {
  const { editor, host } = LEGAL;
  return (
    <LegalPage title="Mentions légales">
      <p>Conformément à l&apos;article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie numérique (LCEN), voici l&apos;identité des intervenants du site {LEGAL.siteName} ({LEGAL.siteUrl}).</p>

      <h2>Éditeur</h2>
      <table className="tbl kv"><tbody>
        <tr><td>Nom ou raison sociale</td><td>{editor.name}</td></tr>
        <tr><td>Forme juridique</td><td>{editor.legalForm}</td></tr>
        <tr><td>Adresse</td><td>{editor.address}</td></tr>
        <tr><td>SIRET</td><td>{editor.siret}</td></tr>
        {editor.vatNumber && <tr><td>N° TVA intracommunautaire</td><td>{editor.vatNumber}</td></tr>}
        <tr><td>E-mail</td><td>{editor.email}</td></tr>
        <tr><td>Téléphone</td><td>{editor.phone}</td></tr>
        <tr><td>Directeur de la publication</td><td>{editor.publicationDirector}</td></tr>
      </tbody></table>

      <h2>Hébergeur</h2>
      <table className="tbl kv"><tbody>
        <tr><td>Nom</td><td>{host.name}</td></tr>
        <tr><td>Adresse</td><td>{host.address}</td></tr>
        <tr><td>Téléphone</td><td>{host.phone}</td></tr>
      </tbody></table>

      <h2>Propriété intellectuelle</h2>
      <p>La structure du site, ses textes, son logo et son code sont la propriété de l&apos;éditeur. Toute reproduction ou réutilisation, totale ou partielle, sans autorisation écrite est interdite (articles L335-2 et suivants du Code de la propriété intellectuelle). Les contenus saisis par les utilisateurs restent leur propriété.</p>

      <h2>Données personnelles et cookies</h2>
      <p>Le traitement des données personnelles est décrit dans la <Link href="/confidentialite">politique de confidentialité</Link>, et l&apos;usage des cookies et traceurs dans la page <Link href="/cookies">Cookies</Link>.</p>

      <h2>Signaler un contenu</h2>
      <p>Pour signaler un contenu illicite ou un abus (par exemple des e-mails de rappel envoyés à tort), écrivez à {editor.email} en précisant l&apos;adresse e-mail concernée et la nature du problème.</p>

      <h2>Médiation de la consommation</h2>
      <p>En cas de litige non résolu avec le service client, le consommateur peut recourir gratuitement au médiateur de la consommation : {LEGAL.mediator.name} ({LEGAL.mediator.url}). Les conditions sont détaillées dans les <Link href="/cgu#litiges">conditions générales</Link>.</p>
    </LegalPage>
  );
}
