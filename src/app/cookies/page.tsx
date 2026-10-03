import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { TrackingToggle } from "@/components/TrackingToggle";
import { RETENTION } from "@/lib/legal";

export const metadata: Metadata = { title: "Cookies · Prêt Matériel" };

export default function Page() {
  return (
    <LegalPage title="Cookies et traceurs">
      <p>Prêt Matériel n&apos;utilise <strong>aucun cookie publicitaire, aucun réseau social et aucun service de statistiques tiers</strong>. Les quelques traceurs utilisés sont soit indispensables au fonctionnement du site, soit une mesure d&apos;audience anonyme exemptée de consentement par la CNIL. C&apos;est pourquoi aucun bandeau de consentement ne vous est présenté (article 82 de la loi Informatique et Libertés).</p>

      <h2>Traceurs utilisés</h2>
      <div className="scroll-x"><table className="tbl"><thead><tr><th>Nom</th><th>Type</th><th>Rôle</th><th>Durée</th></tr></thead><tbody>
        <tr><td><code>session</code></td><td>Cookie</td><td>Vous garder connecté. Indispensable.</td><td>30 jours</td></tr>
        <tr><td><code>token</code></td><td>Stockage local</td><td>Même rôle, pour l&apos;application installée sur mobile. Indispensable.</td><td>Jusqu&apos;à la déconnexion</td></tr>
        <tr><td><code>vid</code></td><td>Stockage local</td><td>Identifiant aléatoire de mesure d&apos;audience, pour compter les visiteurs uniques.</td><td>{RETENTION.visitorIdMonths} mois</td></tr>
        <tr><td><code>no-track</code></td><td>Stockage local</td><td>Mémoriser votre opposition à la mesure d&apos;audience.</td><td>Jusqu&apos;à ce que vous la retiriez</td></tr>
        <tr><td><code>theme</code></td><td>Stockage local</td><td>Mémoriser le mode d&apos;affichage (jour ou nuit) que vous avez choisi sur cet appareil. Créé seulement si vous changez le thème.</td><td>Jusqu&apos;à ce que vous reveniez au thème du système</td></tr>
      </tbody></table></div>
      <p>Le paiement se fait sur la page de Stripe, qui dépose ses propres cookies, nécessaires à la sécurité du paiement et à la lutte contre la fraude. Ils sont décrits dans la <a href="https://stripe.com/fr/legal/cookies-policy" rel="noopener noreferrer" target="_blank">politique cookies de Stripe</a>.</p>

      <h2>Mesure d&apos;audience</h2>
      <p>Elle sert uniquement à produire des statistiques anonymes de fréquentation (pages vues, sources de trafic, types d&apos;appareils) consultables par l&apos;éditeur. Elle n&apos;est pas reliée à votre compte, ne vous suit pas sur d&apos;autres sites, et les données sont supprimées au bout de {RETENTION.pageViewMonths} mois. Elle est automatiquement désactivée si votre navigateur envoie le signal « Do Not Track » ou « Global Privacy Control ».</p>
      <p>Vous pouvez vous y opposer ici :</p>
      <TrackingToggle />

      <h2>En savoir plus</h2>
      <p>Voir la <Link href="/confidentialite">politique de confidentialité</Link> et les fiches de la CNIL sur les <a href="https://www.cnil.fr/fr/cookies-et-autres-traceurs" rel="noopener noreferrer" target="_blank">cookies et autres traceurs</a>.</p>
    </LegalPage>
  );
}
