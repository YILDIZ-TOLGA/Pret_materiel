import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL, REQUIRED_TERMS_VERSION, RETENTION, TERMS_VERSION } from "@/lib/legal";
import { BETA_LIMITS, MAIL_LIMITS, PAID_NOTICE_DAYS } from "@/lib/limits";
import { MAIN_PLAN } from "@/lib/plans";

export const metadata: Metadata = { title: "Conditions générales · Prêt Matériel" };

// passage au service réservé aux professionnels, avec accusés de réception signés
const B2B_SINCE = new Date(`${REQUIRED_TERMS_VERSION}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function Page() {
  const { editor } = LEGAL;
  return (
    <LegalPage title="Conditions générales d'utilisation et de vente">
      <nav className="toc">
        <a href="#utilisation">Partie 1 — Conditions générales d&apos;utilisation (CGU)</a>
        <a href="#vente">Partie 2 — Conditions générales de vente (CGV)</a>
        <a href="#litiges">Partie 3 — Droit applicable et litiges</a>
      </nav>
      <p className="hint">Version {TERMS_VERSION}. Éditeur : {[editor.name, editor.siret && `SIRET ${editor.siret}`, editor.rcs, editor.email, editor.phone].filter(Boolean).join(", ")}.</p>

      <h2 id="utilisation">Partie 1 — Conditions générales d&apos;utilisation</h2>

      <h3>1. Objet</h3>
      <p>{LEGAL.siteName} est un service en ligne réservé aux professionnels : entreprises, associations, collectivités et autres organismes (ci-après « structure » ou « client »). Il leur permet de suivre le matériel et les sommes d&apos;argent qu&apos;ils prêtent dans le cadre de leur activité (à leurs salariés, membres, élèves, clients ou partenaires), de faire signer en ligne par l&apos;emprunteur un accusé de réception, de signer eux-mêmes un reçu pour chaque remboursement et une attestation pour chaque restitution, et d&apos;envoyer automatiquement des rappels par e-mail aux emprunteurs. Les présentes conditions encadrent l&apos;utilisation du service. La création d&apos;un compte vaut acceptation des présentes conditions, dont la date et la version d&apos;acceptation sont enregistrées.</p>

      <h3 id="phase-de-test">1 bis. Phase de test</h3>
      <p>Pendant la phase de test, signalée sur le site, le service est entièrement gratuit, accusés de réception et documents signés compris, dans la limite de {BETA_LIMITS.maxLoans} prêts en cours et de {BETA_LIMITS.maxNewLoansPerDay} nouveaux prêts par 24 heures ; rien n&apos;est vendu. La fin de la phase de test et l&apos;ouverture de l&apos;offre payante sont annoncées par e-mail et sur le site au moins {PAID_NOTICE_DAYS} jours à l&apos;avance. À cette date, les conditions générales de vente (partie 2) s&apos;appliquent : l&apos;abonnement {MAIN_PLAN.name} est nécessaire pour enregistrer de nouveaux prêts. <strong>Aucune donnée n&apos;est supprimée</strong> : sans abonnement, les prêts existants restent consultables, modifiables et clôturables, et leurs rappels, signatures et reçus continuent ; seule la création ou la réouverture d&apos;un prêt est bloquée.</p>

      <h3>2. Compte</h3>
      <ul>
        <li><strong>Le service est réservé aux professionnels.</strong> Un compte est ouvert au nom d&apos;une structure, pour les besoins de son activité, par une personne âgée d&apos;au moins {LEGAL.minAge} ans habilitée à agir pour elle. Il n&apos;est pas destiné aux particuliers pour leurs prêts personnels. En créant un compte, vous déclarez agir pour le compte de la structure indiquée.</li>
        <li>Le nom de la structure est obligatoire : il figure dans les e-mails et les documents envoyés aux emprunteurs, car la structure est responsable du traitement de leurs données (article 17).</li>
        <li>Ouvrir ou utiliser plusieurs comptes pour contourner les limites du service est interdit et peut entraîner la suspension prévue à l&apos;article 7.</li>
        <li>Vous vous engagez à fournir une adresse e-mail exacte et à garder votre mot de passe confidentiel. Toute action réalisée depuis votre compte, y compris la signature d&apos;un reçu ou d&apos;une attestation, est réputée faite par vous, pour le compte de votre structure.</li>
        <li>Vous pouvez supprimer votre compte à tout moment depuis la page <Link href="/compte">Mon compte</Link>. La suppression est définitive et entraîne celle de vos prêts et de leurs documents signés : téléchargez-les et imprimez-les avant (article 3 bis). Un abonnement en cours est alors résilié sans remboursement de la période entamée, sauf exercice du droit de rétractation (article 13).</li>
        <li>Les comptes ouverts avant le {B2B_SINCE} conservent leurs prêts ; pour en enregistrer de nouveaux, leur titulaire accepte les présentes conditions depuis l&apos;application et indique le nom de sa structure.</li>
      </ul>

      <h3>3. Vos engagements envers les emprunteurs</h3>
      <p>Le service envoie des e-mails à des personnes que vous désignez. Vous vous engagez à :</p>
      <ul>
        <li>n&apos;enregistrer que des prêts réels, consentis dans le cadre de l&apos;activité de votre structure, à des personnes qui s&apos;attendent à être contactées à ce sujet ;</li>
        <li>prévenir l&apos;emprunteur que vous utilisez {LEGAL.siteName}, qu&apos;il recevra un accusé de réception à signer en ligne puis des rappels par e-mail ;</li>
        <li>saisir des informations exactes, les corriger si l&apos;emprunteur conteste le prêt ou vous le demande, et les supprimer quand elles ne sont plus nécessaires ;</li>
        <li>vous assurer que les prêts que vous consentez sont licites. En particulier, une entreprise qui prête de l&apos;argent à titre habituel peut relever du monopole des établissements de crédit (article L511-5 du Code monétaire et financier) et, si l&apos;emprunteur est un consommateur, des règles du crédit à la consommation (articles L312-1 et suivants du Code de la consommation). Le service ne vérifie pas ce point et ne fournit aucun conseil juridique ;</li>
        <li>ne jamais utiliser le service pour harceler, menacer, faire pression ou envoyer des messages à des inconnus, ni pour recouvrer des créances autres que les prêts enregistrés (factures impayées, dettes de tiers…) ;</li>
        <li>ne pas inscrire dans les champs libres (description, notes, observations, précisions d&apos;un reçu) d&apos;informations sensibles sur l&apos;emprunteur (santé, opinions, religion, situation financière, infractions…) ni de propos injurieux ou diffamatoires.</li>
      </ul>
      <p>Pour éviter les envois abusifs, le nombre de nouveaux prêts qu&apos;un compte peut créer sur 24 heures est limité selon l&apos;offre (voir le tableau de l&apos;article 11).</p>
      <p>Vous êtes seul responsable des informations que vous saisissez sur les tiers et de l&apos;usage que vous faites du service. Tout emprunteur peut bloquer définitivement les e-mails de {LEGAL.siteName} : les relances vers son adresse sont alors désactivées.</p>
      <p>Pour protéger les emprunteurs, le service applique des limites : les noms et les objets ne peuvent pas contenir d&apos;adresse de site internet ; une même adresse reçoit au plus {MAIL_LIMITS.perRecipientPerDay} e-mails de {LEGAL.siteName} par 24 heures, tous prêteurs confondus ; un prêt donne lieu à {MAIL_LIMITS.remindersPerLoan} rappels au maximum. Au-delà, contactez l&apos;emprunteur directement.</p>

      <h3 id="documents">3 bis. Accusés de réception, reçus et signature électronique</h3>
      <ul>
        <li><strong>Accusé de réception.</strong> À l&apos;enregistrement d&apos;un prêt, l&apos;emprunteur reçoit par e-mail un lien personnel vers une page qui présente le récapitulatif complet du prêt. Il peut y signer l&apos;accusé de réception (signature tracée, ou nom saisi s&apos;il ne peut pas tracer, et case à cocher) ou contester le prêt. Pour un prêt d&apos;argent, il écrit lui-même la somme en toutes lettres et en chiffres (articles 1376 et 1174 du Code civil). L&apos;emprunteur qui a un compte retrouve aussi la demande dans son espace « Emprunts ».</li>
        <li><strong>Reçus et attestations.</strong> Le client signe depuis son compte un reçu pour chaque remboursement reçu et une attestation de restitution quand le matériel lui est rendu ; un prêt d&apos;argent est soldé par le reçu du dernier remboursement.</li>
        <li><strong>Documents figés.</strong> Chaque document signé enregistre son contenu, la signature, le nom saisi, la date et l&apos;heure, l&apos;adresse IP et le navigateur du signataire, et une empreinte numérique (SHA-256) de l&apos;ensemble. Il n&apos;est jamais modifié : modifier ce qui figure sur un accusé de réception (bien ou somme, dates, emprunteur) entraîne une nouvelle demande de signature, et les documents déjà signés restent dans l&apos;historique du prêt. Chaque document est envoyé en PDF par e-mail au client et à l&apos;emprunteur, et reste téléchargeable depuis le prêt tant que celui-ci existe.</li>
        <li><strong>Valeur de la signature.</strong> Il s&apos;agit d&apos;une signature électronique simple au sens du règlement (UE) n° 910/2014 (dit eIDAS). Ses effets juridiques et sa recevabilité comme preuve en justice ne peuvent être refusés au seul motif qu&apos;elle est électronique (article 25 de ce règlement), mais elle ne bénéficie pas de la présomption de fiabilité réservée par l&apos;article 1367 du Code civil à la signature électronique qualifiée : en cas de contestation, il appartient à celui qui s&apos;en prévaut d&apos;en établir la fiabilité, et le juge en apprécie librement la valeur. L&apos;emprunteur est identifié par la possession du lien envoyé à son adresse e-mail, le client par les identifiants de son compte : l&apos;éditeur ne vérifie pas l&apos;identité des signataires. Pour un prêt important, vérifiez l&apos;identité de l&apos;emprunteur par vos propres moyens et, au besoin, faites établir un acte adapté.</li>
        <li><strong>Imprimer et conserver : une obligation du client.</strong> Le client s&apos;engage à télécharger et imprimer (ou enregistrer sur ses propres supports) chaque document signé dès qu&apos;il le reçoit, et à le conserver aussi longtemps qu&apos;il en a besoin. {LEGAL.siteName} n&apos;est pas un service d&apos;archivage électronique : il ne garantit ni la conservation, ni la disponibilité des documents dans la durée. Ils sont supprimés avec le prêt (par le client, ou automatiquement {RETENTION.returnedLoanYears} ans après sa clôture), avec le compte, et peuvent être perdus en cas d&apos;incident (article 5). L&apos;éditeur n&apos;est pas responsable de l&apos;impossibilité de produire un document que le client n&apos;a pas conservé lui-même.</li>
        <li><strong>Contestation et désinscription.</strong> Si l&apos;emprunteur conteste le prêt, le client en est prévenu et aucun rappel n&apos;est plus envoyé à l&apos;emprunteur pour ce prêt ; le service n&apos;intervient pas dans le différend. Un emprunteur qui a bloqué les e-mails de {LEGAL.siteName} ne reçoit plus ni demande de signature ni copie de ses documents : le client les lui remet alors par ses propres moyens.</li>
      </ul>

      <h3>4. Ce que le service n&apos;est pas</h3>
      <ul>
        <li>{LEGAL.siteName} n&apos;est pas partie aux prêts conclus entre ses clients et leurs emprunteurs. Il ne garantit ni la restitution du matériel, ni le remboursement des sommes, et n&apos;intervient pas dans les litiges entre prêteur et emprunteur.</li>
        <li>Seuls les documents signés (article 3 bis) ont vocation à servir de preuve ; les autres informations enregistrées (prêt non signé, notes, historique) sont de simples déclarations du client. Pour un prêt d&apos;argent de plus de 1 500 €, la preuve doit en principe être apportée par un écrit (article 1359 du Code civil) : l&apos;accusé de réception signé électroniquement est un écrit électronique (article 1366 du Code civil), sous les réserves de l&apos;article 3 bis.</li>
        <li>Le service n&apos;est ni un service d&apos;archivage électronique, ni un prestataire de services de confiance qualifié au sens du règlement eIDAS.</li>
        <li>Le service n&apos;est pas un établissement de crédit ou de paiement : aucune somme ne transite par {LEGAL.siteName} entre prêteurs et emprunteurs.</li>
      </ul>

      <h3>5. Disponibilité</h3>
      <p>L&apos;éditeur s&apos;efforce de rendre le service accessible en permanence mais ne peut le garantir : des interruptions peuvent survenir pour maintenance, mise à jour ou incident. Les e-mails peuvent ne pas être délivrés (adresse erronée, filtre anti-spam, désinscription du destinataire) : l&apos;historique d&apos;envoi visible dans l&apos;application ne garantit pas leur lecture. Exportez régulièrement vos données si elles sont importantes pour vous (bouton « Export CSV » du bilan et « Télécharger mes données » de la page Mon compte).</p>
      <p>Pendant la phase de test, le service est fourni gratuitement et « en l&apos;état » : il peut évoluer, être interrompu ou arrêté à tout moment, sans garantie de disponibilité, de délivrance des e-mails ni de résultat. En cas d&apos;arrêt définitif, les utilisateurs sont prévenus au moins 30 jours à l&apos;avance pour pouvoir exporter leurs données.</p>
      <p><strong>Risque de perte de données.</strong> Malgré des sauvegardes régulières, une perte partielle ou totale des données reste possible, pendant la phase de test comme avec l&apos;abonnement : panne, incident chez l&apos;hébergeur, erreur technique ou humaine, attaque informatique. {LEGAL.siteName} est un outil de suivi, de signature et de rappel, pas un service d&apos;archivage. Gardez vos propres copies : imprimez chaque document signé dès sa réception (article 3 bis) et exportez régulièrement vos données.</p>

      <h3>6. Responsabilité</h3>
      <p>{LEGAL.siteName} est un simple outil de suivi : l&apos;éditeur n&apos;est pas partie aux prêts et n&apos;intervient jamais entre prêteurs et emprunteurs. Dans toute la mesure permise par la loi, l&apos;éditeur n&apos;est pas responsable :</p>
      <ul>
        <li>de la non-restitution, de la perte, du vol ou de la dégradation d&apos;un objet prêté, ni du non-remboursement d&apos;une somme ;</li>
        <li>des litiges entre prêteurs et emprunteurs, ni de leurs relations ;</li>
        <li>des informations saisies par les utilisateurs (exactitude, licéité) ni des conséquences de leur envoi aux emprunteurs ;</li>
        <li>d&apos;un rappel ou d&apos;un e-mail non envoyé, envoyé en retard, non reçu ou classé en indésirable ;</li>
        <li>d&apos;une interruption, d&apos;une erreur ou d&apos;une indisponibilité du service, ni d&apos;une perte de données ;</li>
        <li>de la perte d&apos;un document signé que le client n&apos;a pas lui-même conservé, de l&apos;identité réelle d&apos;un signataire, ni de la valeur probante qu&apos;un juge reconnaît à une signature électronique simple (article 3 bis) ;</li>
        <li>des dommages indirects, tels qu&apos;une perte de chance ou un préjudice financier ou commercial ;</li>
        <li>des dommages résultant d&apos;une utilisation non conforme aux présentes conditions, du fait d&apos;un tiers (notamment d&apos;un emprunteur) ou d&apos;un cas de force majeure.</li>
      </ul>
      <p>L&apos;éditeur est tenu d&apos;une simple obligation de moyens. Ces limites ne s&apos;appliquent pas en cas de faute lourde ou intentionnelle de l&apos;éditeur, ni aux dommages corporels, ni dans les cas où la loi interdit de limiter sa responsabilité. Elles ne privent pas l&apos;utilisateur des droits que la loi lui reconnaît, notamment sur ses données personnelles. Avec l&apos;abonnement, la responsabilité de l&apos;éditeur est en outre plafonnée dans les conditions de l&apos;<a href="#pro">article 16</a>.</p>
      <p>Si votre utilisation du service, contraire aux présentes conditions, conduit un tiers à réclamer quoi que ce soit à l&apos;éditeur, vous vous engagez à l&apos;indemniser des conséquences de cette réclamation.</p>

      <h3>7. Suspension</h3>
      <p>En cas de manquement aux présentes conditions (notamment à l&apos;article 3), de signalement d&apos;abus ou d&apos;usage frauduleux, l&apos;éditeur peut suspendre l&apos;envoi d&apos;e-mails ou le compte, après vous en avoir informé par e-mail sauf urgence. En cas de suspension définitive d&apos;un compte payant sans faute de votre part, la part non consommée de l&apos;abonnement est remboursée.</p>

      <h3>8. Propriété intellectuelle</h3>
      <p>Le service, son code, sa marque et ses contenus appartiennent à l&apos;éditeur. Vous bénéficiez d&apos;un droit d&apos;utilisation non exclusif, limité aux besoins de votre structure, pour la durée de votre compte. Vos données restent les vôtres : vous pouvez les exporter à tout moment.</p>

      <h3>9. Données personnelles</h3>
      <p>Voir la <Link href="/confidentialite">politique de confidentialité</Link>. L&apos;accord de sous-traitance des données des emprunteurs, accepté avec les présentes conditions, figure à l&apos;<a href="#sous-traitance">article 17</a>.</p>

      <h3>10. Modification des conditions</h3>
      <p>L&apos;éditeur peut faire évoluer les présentes conditions. Les utilisateurs sont informés de toute modification importante au moins 30 jours avant son entrée en vigueur. Si vous refusez les nouvelles conditions, vous pouvez supprimer votre compte et résilier votre abonnement sans frais avant cette date ; les modifications de prix ne s&apos;appliquent jamais à une période d&apos;abonnement déjà payée.</p>

      <h2 id="vente">Partie 2 — Conditions générales de vente</h2>
      {!editor.siret && (
        <div className="box"><p><strong>Pas encore applicable</strong>, sauf l&apos;article 17 (accord de sous-traitance des données), accepté dès la création du compte. Pendant la phase de test, le service est entièrement gratuit et rien n&apos;est vendu. Les conditions de vente ci-dessous ne s&apos;appliqueront qu&apos;à l&apos;ouverture de l&apos;offre payante, qui sera alors proposée par un professionnel identifié dans ces conditions et dans les mentions légales, avec un préavis d&apos;au moins 30 jours.</p></div>
      )}
      <p>Ces conditions s&apos;appliquent à la souscription de l&apos;abonnement {MAIN_PLAN.name} par une structure, pour les besoins de son activité. Le service n&apos;est pas vendu aux consommateurs. L&apos;éditeur accorde néanmoins à tous ses clients les droits prévus aux articles 13 et 14 : rétractation avec remboursement intégral, résiliation en ligne et préavis avant la reconduction.</p>

      <h3>11. Offre et prix</h3>
      <div className="scroll-x"><table className="tbl"><thead><tr><th>Offre</th><th>Prix</th><th>Durée</th><th>Prêts en cours</th><th>Nouveaux prêts par 24 h</th></tr></thead><tbody>
        <tr><td>{MAIN_PLAN.name}</td><td className="num nowrap">{MAIN_PLAN.priceLabel}</td><td>1 an, reconduit chaque année</td><td className="num">{MAIN_PLAN.maxLoans.toLocaleString("fr-FR")}</td><td className="num">{MAIN_PLAN.maxNewLoansPerDay}</td></tr>
        <tr><td>Sans abonnement</td><td className="num">—</td><td>—</td><td>Prêts existants consultables et modifiables, aucun nouveau prêt</td><td className="num">0</td></tr>
      </tbody></table></div>
      <p>L&apos;abonnement comprend toutes les fonctions du service : accusés de réception signés en ligne, reçus de remboursement et attestations de restitution signés, documents PDF, rappels et relances par e-mail, bilan et export. Prix en euros, hors taxes ({LEGAL.vatMention} ; voir l&apos;<a href="#pro">article 16</a>). Les prix applicables sont ceux affichés au moment de la commande.</p>

      <h3>12. Commande et paiement</h3>
      <p>La commande se fait depuis la page Offre : acceptation des présentes CGV et de l&apos;accord de sous-traitance (article 17), puis paiement sur la page sécurisée de notre prestataire Stripe (carte bancaire, prélèvement SEPA ou autre moyen proposé). Le nom, l&apos;adresse et, le cas échéant, le numéro de TVA de la structure sont demandés lors du paiement et figurent sur la facture. Le contrat est conclu à la validation du paiement. Une confirmation de commande est aussitôt envoyée par e-mail : elle reprend les caractéristiques de l&apos;offre, le prix, la durée, les conditions de résiliation et de rétractation, et contient en pièce jointe les présentes conditions dans la version acceptée. La facture est envoyée séparément par notre prestataire de paiement. Le paiement est ensuite prélevé automatiquement à chaque échéance annuelle.</p>
      <p>En cas d&apos;échec de paiement ou à la fin de l&apos;abonnement, aucune donnée n&apos;est supprimée : les prêts existants restent consultables et modifiables, et leurs rappels, signatures et reçus continuent ; seule la création de nouveaux prêts est bloquée.</p>

      <h3>13. Droit de rétractation</h3>
      <p>Le droit de rétractation du Code de la consommation est réservé aux consommateurs. L&apos;éditeur l&apos;accorde néanmoins à tous ses clients : vous disposez d&apos;un délai de <strong>14 jours</strong> à compter de la souscription pour vous rétracter, sans avoir à vous justifier. En cochant la case prévue lors de la commande, vous demandez que l&apos;abonnement commence immédiatement, avant la fin de ce délai. Si vous vous rétractez, <strong>nous vous remboursons l&apos;intégralité du montant payé</strong>, au plus tard 14 jours après votre demande, avec le moyen de paiement utilisé.</p>
      <p>Pour vous rétracter, le plus simple est d&apos;utiliser le bouton <strong>« Se rétracter du contrat ici »</strong> de la page <Link href="/abonnement">Offre</Link>, affiché pendant tout le délai, puis « Confirmer la rétractation » : l&apos;abonnement s&apos;arrête immédiatement, le remboursement est lancé et un accusé de réception indiquant la date et l&apos;heure de votre demande vous est envoyé par e-mail. Vous pouvez aussi envoyer une déclaration dénuée d&apos;ambiguïté à {editor.email}, par exemple à l&apos;aide du formulaire ci-dessous :</p>
      <div className="box">
        <p><em>Formulaire de rétractation (à compléter et renvoyer uniquement si vous souhaitez vous rétracter du contrat)</em></p>
        <p>À l&apos;attention de {editor.name}, {editor.address}, {editor.email} :</p>
        <p>Je vous notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessous : abonnement {LEGAL.siteName}, offre ……………</p>
        <p>Commandé le : …………… · Nom de la structure et du signataire : …………… · Adresse e-mail du compte : …………… · Adresse : ……………</p>
        <p>Signature (uniquement en cas de notification du présent formulaire sur papier) : …………… · Date : ……………</p>
      </div>

      <h3>14. Durée, renouvellement et résiliation</h3>
      <ul>
        <li><strong>Durée</strong> : l&apos;abonnement est conclu pour un an et reconduit tacitement pour un an. Entre trois mois et un mois avant chaque échéance, nous vous envoyons un e-mail dédié vous rappelant la possibilité de ne pas reconduire votre abonnement et la date limite pour le faire. Vous pouvez résilier à tout moment avant l&apos;échéance ; l&apos;abonnement reste actif jusqu&apos;à celle-ci, sans nouveau prélèvement.</li>
        <li><strong>Comment résilier</strong> : page <Link href="/abonnement">Offre</Link>, bouton « Résilier votre contrat », puis « Confirmer la résiliation ». Un e-mail de confirmation précisant la date de fin de l&apos;abonnement vous est envoyé immédiatement. Vous pouvez aussi résilier par e-mail à {editor.email}.</li>
        <li>À la fin de l&apos;abonnement, rien n&apos;est supprimé : les prêts et leurs documents restent consultables (article 12).</li>
      </ul>
      <p>Ces règles de reconduction s&apos;imposent envers les consommateurs et les non-professionnels (article L215-3 du Code de la consommation) ; l&apos;éditeur les applique à tous ses clients. Les dispositions applicables sont reproduites ci-dessous (article L215-4).</p>
      <div className="box small">
        <p><strong>Article L215-1</strong> — Pour les contrats de prestations de services conclus pour une durée déterminée avec une clause de reconduction tacite, le professionnel prestataire de services informe le consommateur par écrit, par lettre nominative ou courrier électronique dédiés, au plus tôt trois mois et au plus tard un mois avant le terme de la période autorisant le rejet de la reconduction, de la possibilité de ne pas reconduire le contrat qu&apos;il a conclu avec une clause de reconduction tacite. Cette information, délivrée dans des termes clairs et compréhensibles, mentionne, dans un encadré apparent, la date limite de non-reconduction.</p>
        <p>Lorsque cette information ne lui a pas été adressée conformément aux dispositions du premier alinéa, le consommateur peut mettre gratuitement un terme au contrat, à tout moment à compter de la date de reconduction.</p>
        <p>Les avances effectuées après la dernière date de reconduction ou, s&apos;agissant des contrats à durée indéterminée, après la date de transformation du contrat initial à durée déterminée, sont dans ce cas remboursées dans un délai de trente jours à compter de la date de résiliation, déduction faite des sommes correspondant, jusqu&apos;à celle-ci, à l&apos;exécution du contrat.</p>
        <p>Les dispositions du présent article s&apos;appliquent sans préjudice de celles qui soumettent légalement certains contrats à des règles particulières en ce qui concerne l&apos;information du consommateur.</p>
        <p><strong>Article L215-2</strong> — Les dispositions du présent chapitre ne sont pas applicables aux exploitants des services d&apos;eau potable et d&apos;assainissement.</p>
        <p><strong>Article L215-3</strong> — Les dispositions du présent chapitre sont également applicables aux contrats conclus entre des professionnels et des non-professionnels.</p>
        <p><strong>Article L241-3</strong> — Lorsque le professionnel n&apos;a pas procédé au remboursement dans les conditions prévues à l&apos;article L. 215-1, les sommes dues sont productives d&apos;intérêts au taux légal.</p>
      </div>

      <h3>15. Conformité du service</h3>
      <p>L&apos;éditeur fournit le service conformément à sa description et corrige dans un délai raisonnable les anomalies qui lui sont signalées par écrit à {editor.email}. Si une anomalie bloquante n&apos;est pas corrigée dans les 30 jours suivant son signalement, le client peut résilier son abonnement et obtenir le remboursement de la part non consommée de la période payée.</p>

      <h3 id="pro">16. Dispositions entre professionnels</h3>
      <ul>
        <li>La personne qui souscrit l&apos;abonnement déclare être habilitée à engager la structure.</li>
        <li>Les prix s&apos;entendent hors taxes. {LEGAL.editor.vatNumber
          ? "La TVA est facturée en sus, au taux en vigueur."
          : "L'éditeur bénéficie aujourd'hui de la franchise en base de TVA : aucune TVA n'est facturée. Si elle devient applicable, elle s'ajoutera au prix au taux en vigueur, après information du client au moins 30 jours avant ; le client peut résilier sans frais avant cette date."}</li>
        <li>Les abonnements sont payables d&apos;avance. Tout retard de paiement d&apos;un client professionnel entraîne de plein droit des pénalités de retard au taux appliqué par la Banque centrale européenne à son opération de refinancement la plus récente, majoré de 10 points, ainsi qu&apos;une indemnité forfaitaire pour frais de recouvrement de 40 € (articles L441-10 et D441-5 du Code de commerce).</li>
        <li>Sauf faute lourde ou intentionnelle, la responsabilité de l&apos;éditeur, toutes causes confondues (y compris une perte de données ou de documents signés), est limitée aux dommages directs et plafonnée au montant payé par le client au cours des douze mois précédant le fait qui l&apos;engage. Le client reste responsable de la conservation de ses propres données et de ses documents signés (article 3 bis).</li>
      </ul>

      <h3 id="sous-traitance">17. Accord de sous-traitance des données</h3>
      <p>La structure qui utilise le service pour suivre ce qu&apos;elle prête est responsable du traitement des données de ses emprunteurs, et l&apos;éditeur agit comme son sous-traitant. Le présent article constitue le contrat prévu à l&apos;article 28 du RGPD ; il est accepté avec les conditions générales à la création du compte, de nouveau à la souscription de l&apos;abonnement, et s&apos;applique tant que la structure utilise son compte.</p>
      <div className="scroll-x"><table className="tbl kv"><tbody>
        <tr><td>Objet et finalité</td><td>Enregistrer les prêts de la structure, recueillir la signature électronique des accusés de réception par les emprunteurs, établir et envoyer les documents signés (accusés de réception, reçus de remboursement, attestations de restitution), envoyer les e-mails de rappel et de relance, afficher le suivi et le bilan.</td></tr>
        <tr><td>Opérations</td><td>Hébergement, enregistrement, consultation, modification, établissement de documents PDF, envoi d&apos;e-mails, export et suppression.</td></tr>
        <tr><td>Données</td><td>Nom, adresse e-mail et, si la structure le renseigne, téléphone des emprunteurs ; matériel ou sommes prêtés, dates, remboursements, notes ; éléments de signature (nom saisi, tracé de la signature, somme écrite par l&apos;emprunteur, date et heure, adresse IP, navigateur, empreinte du document) ; date et motif d&apos;une contestation.</td></tr>
        <tr><td>Personnes concernées</td><td>Les emprunteurs enregistrés par la structure (salariés, membres, élèves, clients…).</td></tr>
        <tr><td>Durée</td><td>Celle de l&apos;utilisation du compte, dans le respect des durées de conservation de la <Link href="/confidentialite">politique de confidentialité</Link>.</td></tr>
      </tbody></table></div>
      <p>L&apos;éditeur s&apos;engage à :</p>
      <ul>
        <li>ne traiter ces données que sur instruction documentée de la structure, constituée par l&apos;utilisation des fonctions du service et par les présentes conditions, et l&apos;informer si une instruction lui paraît contraire à la réglementation ;</li>
        <li>veiller à ce que les personnes autorisées à traiter ces données soient tenues à la confidentialité ;</li>
        <li>appliquer les mesures de sécurité décrites dans la politique de confidentialité (article 32 du RGPD) ;</li>
        <li>ne faire appel qu&apos;aux sous-traitants ultérieurs listés dans la politique de confidentialité, en leur imposant les mêmes obligations, et prévenir la structure de tout ajout ou remplacement envisagé ; la structure peut s&apos;y opposer en résiliant son abonnement ;</li>
        <li>aider la structure à répondre aux demandes des emprunteurs qui exercent leurs droits (les données se modifient, s&apos;exportent et se suppriment depuis le compte ; chaque emprunteur peut bloquer les e-mails en un clic) et à respecter ses obligations des articles 32 à 36 du RGPD ;</li>
        <li>notifier à la structure toute violation de données la concernant, sans retard injustifié après en avoir pris connaissance, avec les informations utiles à sa propre notification ;</li>
        <li>supprimer les données à la suppression du compte, après que la structure a pu les exporter, sauf obligation légale de conservation ;</li>
        <li>mettre à la disposition de la structure les informations nécessaires pour démontrer le respect du présent article et permettre des audits, sur demande écrite raisonnable avec un préavis de 30 jours, les frais d&apos;audit restant à la charge de la structure.</li>
      </ul>
      <p>La structure est nommée dès la création du compte : son nom figure dans chaque e-mail et chaque document envoyés à ses emprunteurs, qui savent ainsi qui est responsable de leurs données. La liste des adresses désinscrites et le plafond d&apos;e-mails par destinataire sont communs à tous les utilisateurs du service : pour ces deux traitements, destinés à protéger les emprunteurs contre les envois abusifs, l&apos;éditeur agit comme responsable de traitement et non comme sous-traitant.</p>
      <p>La structure s&apos;engage à disposer d&apos;une base légale pour ces traitements, à informer ses emprunteurs, et à ne saisir que les données nécessaires au suivi des prêts, sans aucune donnée sensible.</p>

      <h2 id="litiges">Partie 3 — Droit applicable et litiges</h2>
      <p>Les présentes conditions sont soumises au droit français. En cas de difficulté, contactez d&apos;abord le service client à {editor.email} : nous nous engageons à répondre sous 15 jours.</p>
      {LEGAL.mediator.name && <p>À défaut d&apos;accord, vous pouvez recourir au médiateur <strong>{LEGAL.mediator.name}</strong> ({LEGAL.mediator.url}).</p>}
      <p>Le service étant réservé aux professionnels, la médiation de la consommation ne s&apos;applique pas. Faute de résolution amiable, le litige relève des tribunaux compétents selon les règles de droit commun.</p>
    </LegalPage>
  );
}
