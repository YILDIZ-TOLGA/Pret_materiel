import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL, TERMS_VERSION } from "@/lib/legal";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Conditions générales · Prêt Matériel" };

export default function Page() {
  const { editor } = LEGAL;
  return (
    <LegalPage title="Conditions générales d'utilisation et de vente">
      <nav className="toc">
        <a href="#utilisation">Partie 1 — Conditions générales d&apos;utilisation (CGU)</a>
        <a href="#vente">Partie 2 — Conditions générales de vente (CGV)</a>
        <a href="#litiges">Partie 3 — Droit applicable et litiges</a>
      </nav>
      <p className="hint">Version {TERMS_VERSION}. Éditeur : {editor.name}, {editor.address}, SIRET {editor.siret}, {editor.email}, {editor.phone}.</p>

      <h2 id="utilisation">Partie 1 — Conditions générales d&apos;utilisation</h2>

      <h3>1. Objet</h3>
      <p>{LEGAL.siteName} est un outil qui permet de garder une trace des objets et des sommes d&apos;argent que l&apos;on prête à des proches, et d&apos;envoyer automatiquement des rappels par e-mail aux emprunteurs. Les présentes conditions encadrent l&apos;utilisation du service. La création d&apos;un compte vaut acceptation des présentes conditions, dont la date et la version d&apos;acceptation sont enregistrées.</p>

      <h3>2. Compte</h3>
      <ul>
        <li>Le service est réservé aux personnes physiques âgées d&apos;au moins {LEGAL.minAge} ans, agissant à titre personnel.</li>
        <li>Vous vous engagez à fournir une adresse e-mail exacte et à garder votre mot de passe confidentiel. Toute action réalisée depuis votre compte est réputée faite par vous.</li>
        <li>Vous pouvez supprimer votre compte à tout moment depuis la page <Link href="/compte">Mon compte</Link>. La suppression est définitive et entraîne celle de vos prêts. Un abonnement en cours est alors résilié sans remboursement de la période entamée, sauf exercice du droit de rétractation (article 13).</li>
      </ul>

      <h3>3. Vos engagements envers les emprunteurs</h3>
      <p>Le service envoie des e-mails à des personnes que vous désignez. Vous vous engagez à :</p>
      <ul>
        <li>n&apos;enregistrer que des prêts réels, à des personnes que vous connaissez et qui s&apos;attendent à être contactées à ce sujet ;</li>
        <li>prévenir l&apos;emprunteur que vous utilisez {LEGAL.siteName} et qu&apos;il recevra des rappels par e-mail ;</li>
        <li>saisir des informations exactes et les corriger ou supprimer si l&apos;emprunteur vous le demande ;</li>
        <li>ne jamais utiliser le service pour harceler, menacer, faire pression ou envoyer des messages à des inconnus, ni comme outil de recouvrement de créances professionnelles ;</li>
        <li>ne pas inscrire dans les champs libres (description, notes) d&apos;informations sensibles sur l&apos;emprunteur (santé, opinions, religion, situation financière, infractions…) ni de propos injurieux ou diffamatoires.</li>
      </ul>
      <p>Vous êtes seul responsable des informations que vous saisissez sur les tiers et de l&apos;usage que vous faites du service. Tout emprunteur peut bloquer définitivement les e-mails de {LEGAL.siteName} : les relances vers son adresse sont alors désactivées.</p>

      <h3>4. Ce que le service n&apos;est pas</h3>
      <ul>
        <li>{LEGAL.siteName} n&apos;est pas partie aux prêts conclus entre ses utilisateurs et leurs emprunteurs. Il ne garantit ni la restitution des objets, ni le remboursement des sommes, et n&apos;intervient pas dans les litiges entre prêteur et emprunteur.</li>
        <li>Les informations enregistrées sont déclaratives : elles ne constituent pas une reconnaissance de dette. Pour un prêt d&apos;argent de plus de 1 500 €, la loi exige un écrit signé par l&apos;emprunteur (article 1359 du Code civil).</li>
        <li>Le service n&apos;est pas un établissement de crédit ou de paiement : aucune somme ne transite par {LEGAL.siteName} entre prêteurs et emprunteurs.</li>
      </ul>

      <h3>5. Disponibilité</h3>
      <p>L&apos;éditeur s&apos;efforce de rendre le service accessible en permanence mais ne peut le garantir : des interruptions peuvent survenir pour maintenance, mise à jour ou incident. Les e-mails peuvent ne pas être délivrés (adresse erronée, filtre anti-spam, désinscription du destinataire) : l&apos;historique d&apos;envoi visible dans l&apos;application ne garantit pas leur lecture. Exportez régulièrement vos données si elles sont importantes pour vous (bouton « Export CSV » du bilan et « Télécharger mes données » de la page Mon compte).</p>

      <h3>6. Responsabilité</h3>
      <p>L&apos;éditeur est tenu d&apos;une obligation de moyens. Il n&apos;est pas responsable des dommages résultant d&apos;une utilisation du service non conforme aux présentes conditions, du fait d&apos;un tiers (notamment d&apos;un emprunteur), d&apos;informations inexactes saisies par l&apos;utilisateur ou d&apos;un cas de force majeure. Ces limites ne s&apos;appliquent pas en cas de faute lourde ou intentionnelle de l&apos;éditeur, ni dans les cas où la loi interdit de limiter sa responsabilité ; elles ne privent pas le consommateur de ses droits légaux, notamment de la garantie légale de conformité des contenus et services numériques (articles L224-25-12 et suivants du Code de la consommation).</p>
      <p>Si votre utilisation du service, contraire aux présentes conditions, conduit un tiers à réclamer quoi que ce soit à l&apos;éditeur, vous vous engagez à l&apos;indemniser des conséquences de cette réclamation.</p>

      <h3>7. Suspension</h3>
      <p>En cas de manquement aux présentes conditions (notamment à l&apos;article 3), de signalement d&apos;abus ou d&apos;usage frauduleux, l&apos;éditeur peut suspendre l&apos;envoi d&apos;e-mails ou le compte, après vous en avoir informé par e-mail sauf urgence. En cas de suspension définitive d&apos;un compte payant sans faute de votre part, la part non consommée de l&apos;abonnement est remboursée.</p>

      <h3>8. Propriété intellectuelle</h3>
      <p>Le service, son code, sa marque et ses contenus appartiennent à l&apos;éditeur. Vous bénéficiez d&apos;un droit d&apos;utilisation personnel et non exclusif, pour la durée de votre compte. Vos données restent les vôtres : vous pouvez les exporter à tout moment.</p>

      <h3>9. Données personnelles</h3>
      <p>Voir la <Link href="/confidentialite">politique de confidentialité</Link>.</p>

      <h3>10. Modification des conditions</h3>
      <p>L&apos;éditeur peut faire évoluer les présentes conditions. Les utilisateurs sont informés de toute modification importante au moins 30 jours avant son entrée en vigueur. Si vous refusez les nouvelles conditions, vous pouvez supprimer votre compte et résilier votre abonnement sans frais avant cette date ; les modifications de prix ne s&apos;appliquent jamais à une période d&apos;abonnement déjà payée.</p>

      <h2 id="vente">Partie 2 — Conditions générales de vente</h2>
      <p>Ces conditions s&apos;appliquent à la souscription d&apos;un abonnement payant par un consommateur.</p>

      <h3>11. Offres et prix</h3>
      <div className="scroll-x"><table className="tbl"><thead><tr><th>Offre</th><th>Prix</th><th>Durée</th><th>Prêts en cours</th></tr></thead><tbody>
        {Object.values(PLANS).map((p) => (
          <tr key={p.id}><td>{p.name}</td><td className="num">{p.priceLabel}</td><td>{p.interval === "month" ? "1 mois, renouvelé chaque mois, sans engagement" : p.interval === "year" ? "1 an, renouvelé chaque année" : "Illimitée"}</td><td className="num">{p.maxLoans}</td></tr>
        ))}
      </tbody></table></div>
      <p>Prix en euros, toutes taxes comprises. {LEGAL.vatMention}. Les prix applicables sont ceux affichés au moment de la commande.</p>

      <h3>12. Commande et paiement</h3>
      <p>La commande se fait depuis la page Offre : choix de l&apos;offre, acceptation des présentes CGV, puis paiement sur la page sécurisée de notre prestataire Stripe (carte bancaire, PayPal, Apple Pay, Google Pay ou autre moyen proposé). Le contrat est conclu à la validation du paiement ; une confirmation et une facture sont envoyées par e-mail. Le paiement est ensuite prélevé automatiquement au début de chaque nouvelle période. En cas d&apos;échec de paiement, le compte repasse à l&apos;offre gratuite à la fin de la période payée ; aucune donnée n&apos;est supprimée.</p>
      <p>Si le nombre de prêts en cours dépasse la limite de l&apos;offre gratuite, les prêts existants restent consultables et modifiables, seule la création de nouveaux prêts est bloquée.</p>

      <h3>13. Droit de rétractation</h3>
      <p>Vous disposez d&apos;un délai de <strong>14 jours</strong> à compter de la souscription pour vous rétracter, sans avoir à vous justifier (article L221-18 du Code de la consommation). En cochant la case prévue lors de la commande, vous demandez expressément que l&apos;abonnement commence immédiatement, avant la fin de ce délai (article L221-25). Si vous vous rétractez, <strong>nous vous remboursons malgré tout l&apos;intégralité du montant payé</strong>, au plus tard 14 jours après votre demande, avec le moyen de paiement utilisé.</p>
      <p>Pour vous rétracter, envoyez une déclaration dénuée d&apos;ambiguïté à {editor.email}, par exemple à l&apos;aide du formulaire ci-dessous :</p>
      <div className="box">
        <p><em>Formulaire de rétractation (à compléter et renvoyer uniquement si vous souhaitez vous rétracter du contrat)</em></p>
        <p>À l&apos;attention de {editor.name}, {editor.address}, {editor.email} :</p>
        <p>Je vous notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessous : abonnement {LEGAL.siteName}, offre ……………</p>
        <p>Commandé le : …………… · Nom du consommateur : …………… · Adresse e-mail du compte : …………… · Adresse du consommateur : ……………</p>
        <p>Signature du consommateur (uniquement en cas de notification du présent formulaire sur papier) : …………… · Date : ……………</p>
      </div>

      <h3>14. Durée, renouvellement et résiliation</h3>
      <ul>
        <li><strong>Offre mensuelle</strong> : sans engagement, renouvelée chaque mois. Résiliable à tout moment ; elle prend fin à l&apos;issue du mois en cours, sans nouveau prélèvement.</li>
        <li><strong>Offres annuelles</strong> : conclues pour un an et reconduites tacitement pour un an. Entre trois mois et un mois avant chaque échéance, nous vous envoyons un e-mail dédié vous rappelant la possibilité de ne pas reconduire votre abonnement et la date limite pour le faire. Vous pouvez résilier à tout moment avant l&apos;échéance ; l&apos;abonnement reste actif jusqu&apos;à celle-ci, sans nouveau prélèvement.</li>
        <li><strong>Comment résilier</strong> : page <Link href="/abonnement">Offre</Link>, bouton « Résilier votre contrat », puis « Confirmer la résiliation ». Un e-mail de confirmation précisant la date de fin de l&apos;abonnement vous est envoyé immédiatement. Vous pouvez aussi résilier par e-mail à {editor.email}.</li>
        <li>À la fin de l&apos;abonnement, le compte repasse à l&apos;offre gratuite. Rien n&apos;est supprimé.</li>
      </ul>
      <p>Conformément à l&apos;article L215-4 du Code de la consommation, les dispositions applicables à la reconduction tacite sont reproduites ci-dessous.</p>
      <div className="box small">
        <p><strong>Article L215-1</strong> — Pour les contrats de prestations de services conclus pour une durée déterminée avec une clause de reconduction tacite, le professionnel prestataire de services informe le consommateur par écrit, par lettre nominative ou courrier électronique dédiés, au plus tôt trois mois et au plus tard un mois avant le terme de la période autorisant le rejet de la reconduction, de la possibilité de ne pas reconduire le contrat qu&apos;il a conclu avec une clause de reconduction tacite. Cette information, délivrée dans des termes clairs et compréhensibles, mentionne, dans un encadré apparent, la date limite de non-reconduction.</p>
        <p>Lorsque cette information ne lui a pas été adressée conformément aux dispositions du premier alinéa, le consommateur peut mettre gratuitement un terme au contrat, à tout moment à compter de la date de reconduction.</p>
        <p>Les avances effectuées après la dernière date de reconduction ou, s&apos;agissant des contrats à durée indéterminée, après la date de transformation du contrat initial à durée déterminée, sont dans ce cas remboursées dans un délai de trente jours à compter de la date de résiliation, déduction faite des sommes correspondant, jusqu&apos;à celle-ci, à l&apos;exécution du contrat.</p>
        <p>Les dispositions du présent article s&apos;appliquent sans préjudice de celles qui soumettent légalement certains contrats à des règles particulières en ce qui concerne l&apos;information du consommateur.</p>
        <p><strong>Article L215-2</strong> — Les dispositions du présent chapitre ne sont pas applicables aux exploitants des services d&apos;eau potable et d&apos;assainissement.</p>
        <p><strong>Article L215-3</strong> — Les dispositions du présent chapitre sont également applicables aux contrats conclus entre des professionnels et des non-professionnels.</p>
        <p><strong>Article L241-3</strong> — Lorsque le professionnel n&apos;a pas procédé au remboursement dans les conditions prévues à l&apos;article L. 215-1, les sommes dues sont productives d&apos;intérêts au taux légal.</p>
      </div>

      <h3>15. Garantie légale de conformité</h3>
      <p>Le service est soumis à la garantie légale de conformité des contenus et services numériques (articles L224-25-12 à L224-25-26 du Code de la consommation). En cas de défaut de conformité, vous pouvez demander la mise en conformité du service, ou à défaut une réduction du prix ou la résolution du contrat, en écrivant à {editor.email}.</p>

      <h2 id="litiges">Partie 3 — Droit applicable et litiges</h2>
      <p>Les présentes conditions sont soumises au droit français. En cas de difficulté, contactez d&apos;abord le service client à {editor.email} : nous nous engageons à répondre sous 15 jours.</p>
      <p>À défaut d&apos;accord, et après une réclamation écrite restée sans réponse satisfaisante, vous pouvez recourir gratuitement au médiateur de la consommation dont relève l&apos;éditeur : <strong>{LEGAL.mediator.name}</strong> ({LEGAL.mediator.url}), dans un délai d&apos;un an à compter de votre réclamation (articles L612-1 et suivants du Code de la consommation).</p>
      <p>Faute de résolution amiable, le litige relève des tribunaux compétents selon les règles de droit commun ; le consommateur peut saisir, à son choix, la juridiction du lieu où il demeurait au moment de la conclusion du contrat ou de la survenance du fait dommageable (article R631-3 du Code de la consommation).</p>
    </LegalPage>
  );
}
