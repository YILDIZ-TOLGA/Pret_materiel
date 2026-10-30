import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL, RETENTION } from "@/lib/legal";
import { MAIL_LIMITS } from "@/lib/limits";

export const metadata: Metadata = { title: "Politique de confidentialité · Prêt Matériel" };

export default function Page() {
  const { editor } = LEGAL;
  return (
    <LegalPage title="Politique de confidentialité">
      <p>Cette politique explique quelles données personnelles {LEGAL.siteName} traite, pourquoi, combien de temps, et comment exercer vos droits. Elle s&apos;applique aux utilisateurs inscrits, qui agissent pour une structure cliente (entreprise, association…), et aux personnes enregistrées comme emprunteurs par une structure, qu&apos;elles aient un compte ou non. Elle est établie conformément au règlement (UE) 2016/679 (RGPD) et à la loi n° 78-17 du 6 janvier 1978 « Informatique et Libertés ».</p>
      <div className="box">
        <p><strong>En bref</strong> : nous collectons le strict nécessaire pour faire fonctionner le service. Pas de publicité, pas de revente de données, pas de cookie tiers. Quand un emprunteur ou un prêteur signe un document, son nom, sa signature, la date, son adresse IP et son navigateur sont enregistrés comme preuve et figurent sur le document envoyé aux deux parties. Vous pouvez télécharger ou supprimer vos données à tout moment depuis la page <Link href="/compte">Mon compte</Link>, et un emprunteur peut bloquer tous nos e-mails en un clic.</p>
      </div>

      <h2>1. Responsable du traitement</h2>
      <p><strong>Comptes des utilisateurs</strong> (données des personnes qui utilisent le service pour leur structure) : {editor.name}{editor.siret ? `, ${editor.address}` : ", éditeur non professionnel"}. Contact pour toute question ou demande relative à vos données : <strong>{editor.email}</strong>.</p>
      <p><strong>Données des emprunteurs</strong> : le service est réservé aux structures (entreprises, associations, collectivités…). C&apos;est la structure qui prête qui est responsable du traitement des données de ses emprunteurs, y compris des éléments de signature des documents. {LEGAL.siteName} agit comme son sous-traitant, dans les conditions de l&apos;<Link href="/cgu#sous-traitance">accord de sous-traitance</Link> (CGV, article 17). Les e-mails et les documents reçus par les emprunteurs nomment cette structure ; ils peuvent exercer leurs droits auprès d&apos;elle, ou nous écrire : nous transmettrons. Seules exceptions, dont {LEGAL.siteName} reste responsable pour protéger les emprunteurs (intérêt légitime) : la liste des adresses désinscrites et le plafond d&apos;e-mails par destinataire, communs à tous les utilisateurs du service.</p>

      <h2>2. Données traitées</h2>
      <h3>Utilisateurs inscrits</h3>
      <ul>
        <li><strong>Compte</strong> : prénom et nom, nom de la structure, adresse e-mail, mot de passe (stocké uniquement sous forme chiffrée irréversible, bcrypt), date d&apos;inscription, date de dernière activité, date et version des conditions acceptées, date de confirmation de l&apos;adresse e-mail et, le cas échéant, la nouvelle adresse en attente de confirmation.</li>
        <li><strong>Sécurité du compte</strong> : sessions de connexion (date d&apos;ouverture et d&apos;expiration, sans information sur l&apos;appareil) et liens de confirmation ou de réinitialisation du mot de passe envoyés par e-mail (seule une empreinte du lien est conservée).</li>
        <li><strong>Prêts</strong> : matériel ou montants prêtés, dates, remboursements, notes privées, options de rappel, état de l&apos;accusé de réception.</li>
        <li><strong>Documents que vous signez</strong> (reçus de remboursement, attestations de restitution) : le nom que vous saisissez, le tracé de votre signature, la date et l&apos;heure, l&apos;adresse IP et le navigateur utilisés, l&apos;empreinte numérique du document, et la date de votre premier téléchargement.</li>
        <li><strong>Abonnement</strong> : offre choisie, date de souscription (point de départ du délai de rétractation), dates de renouvellement, remboursements, historique des paiements (montant, date). Vos coordonnées bancaires sont saisies directement chez notre prestataire de paiement Stripe : nous n&apos;y avons jamais accès. Le nom, l&apos;adresse et, le cas échéant, le numéro de TVA de la structure sont saisis chez Stripe et repris sur les factures.</li>
        <li><strong>Notifications</strong> affichées dans l&apos;application.</li>
      </ul>
      <h3>Personnes enregistrées comme emprunteurs</h3>
      <ul>
        <li>Prénom, nom et date de naissance (ils figurent sur les documents signés et permettent d&apos;identifier l&apos;emprunteur sans ambiguïté, par exemple entre deux homonymes ; l&apos;emprunteur doit être majeur), adresse e-mail et, si la structure le renseigne, numéro de téléphone ; ce qui a été prêté, les dates et les remboursements. Ces données ne sont pas collectées auprès de vous mais auprès de la structure qui vous a prêté quelque chose (voir la section 9).</li>
        <li>Si vous signez l&apos;accusé de réception : le nom que vous saisissez, le tracé de votre signature (ou la mention d&apos;une signature au clavier), pour un prêt d&apos;argent la somme que vous écrivez en lettres et en chiffres, la date et l&apos;heure, l&apos;adresse IP et le navigateur utilisés, et l&apos;empreinte numérique du document. Si vous contestez le prêt : la date et le motif que vous indiquez.</li>
      </ul>
      <h3>Tous les visiteurs</h3>
      <ul>
        <li><strong>Mesure d&apos;audience</strong> : page consultée, site d&apos;origine, type d&apos;appareil, navigateur, pays, et un identifiant aléatoire stocké sur votre appareil. Aucun lien n&apos;est fait avec votre compte. Détails et opposition sur la page <Link href="/cookies">Cookies</Link>.</li>
        <li><strong>Sécurité</strong> : l&apos;adresse IP est utilisée quelques minutes, en mémoire, pour bloquer les tentatives en série (connexion, inscription, mot de passe oublié, signature) et les envois abusifs. Elle n&apos;est enregistrée en base qu&apos;au moment d&apos;une signature, comme élément de preuve du document signé (voir ci-dessus).</li>
        <li><strong>Journal des e-mails</strong> : destinataire, objet, type et résultat de chaque e-mail envoyé et, pour un e-mail adressé à un emprunteur, le compte du prêteur à l&apos;origine de l&apos;envoi. Il sert à vérifier la bonne délivrance, à traiter les réclamations et à limiter les envois abusifs (nombre d&apos;e-mails par jour vers une même adresse et par compte).</li>
      </ul>

      <h2>3. Finalités et bases légales</h2>
      <div className="scroll-x"><table className="tbl"><thead><tr><th>Finalité</th><th>Base légale (art. 6 RGPD)</th></tr></thead><tbody>
        <tr><td>Créer et gérer votre compte, enregistrer vos prêts, afficher votre bilan</td><td>Exécution du contrat (CGU)</td></tr>
        <tr><td>Confirmer votre adresse e-mail, réinitialiser votre mot de passe, vous prévenir d&apos;un changement de mot de passe ou d&apos;adresse</td><td>Exécution du contrat (CGU) et sécurité du compte (art. 32 RGPD)</td></tr>
        <tr><td>Envoyer aux emprunteurs les e-mails liés à un prêt (demande de signature, copies des documents signés, rappel la veille, relances)</td><td>Pour le compte de la structure qui prête : son intérêt légitime à récupérer son bien ou son argent ; l&apos;emprunteur peut s&apos;y opposer à tout moment en un clic</td></tr>
        <tr><td>Faire signer l&apos;accusé de réception par l&apos;emprunteur, faire signer les reçus et attestations par le prêteur, établir ces documents, qui portent l&apos;identité de l&apos;emprunteur (prénom, nom, date de naissance), avec leurs éléments de preuve (nom, signature, date, adresse IP, navigateur, empreinte) et les envoyer aux deux parties</td><td>Pour le compte de la structure qui prête : exécution du contrat de prêt et intérêt légitime de chaque partie à disposer d&apos;une preuve du prêt, des remboursements et de la restitution</td></tr>
        <tr><td>Gérer les abonnements et les paiements, y compris la facture au nom de la structure</td><td>Exécution du contrat (CGV)</td></tr>
        <tr><td>Conserver les factures et justificatifs de paiement</td><td>Obligation légale (art. L123-22 du Code de commerce)</td></tr>
        <tr><td>Prévenir de la reconduction d&apos;un abonnement annuel, confirmer une résiliation</td><td>Obligation légale (art. L215-1 et L215-1-1 du Code de la consommation)</td></tr>
        <tr><td>Mesure d&apos;audience anonyme</td><td>Intérêt légitime à améliorer le site (traceur exempté de consentement, délibération CNIL 2020-091)</td></tr>
        <tr><td>Sécurité du service et prévention des abus</td><td>Intérêt légitime</td></tr>
        <tr><td>Répondre à vos demandes et réclamations</td><td>Intérêt légitime, ou obligation légale pour les demandes d&apos;exercice de droits</td></tr>
      </tbody></table></div>
      <p>Aucune décision automatisée produisant des effets juridiques ne vous concerne, et aucun profilage n&apos;est réalisé. Vos données ne sont ni vendues, ni louées, ni utilisées à des fins publicitaires.</p>

      <h2>4. Durées de conservation</h2>
      <div className="scroll-x"><table className="tbl"><thead><tr><th>Données</th><th>Durée</th></tr></thead><tbody>
        <tr><td>Compte et prêts en cours</td><td>Jusqu&apos;à la suppression du compte. Un compte sans aucune activité pendant {RETENTION.inactiveAccountYears} ans est supprimé, après un e-mail de préavis 30 jours avant.</td></tr>
        <tr><td>Prêts clôturés (matériel rendu ou argent remboursé)</td><td>{RETENTION.returnedLoanYears} ans après la clôture, durée pendant laquelle un litige sur le prêt reste possible (prescription de droit commun, art. 2224 du Code civil), puis suppression automatique</td></tr>
        <tr><td>Données d&apos;un emprunteur</td><td>Celle du prêt qui le concerne. Supprimées avec le compte du prêteur.</td></tr>
        <tr><td>Documents signés et leurs éléments de preuve (nom saisi, signature, adresse IP, navigateur, empreinte)</td><td>Ceux du prêt : supprimés avec lui (par le prêteur, avec son compte, ou automatiquement {RETENTION.returnedLoanYears} ans après la clôture). {LEGAL.siteName} n&apos;archive pas ces documents : chaque partie en reçoit une copie PDF à conserver.</td></tr>
        <tr><td>Factures et paiements</td><td>10 ans (obligation comptable), même après la suppression du compte, sans lien avec le compte supprimé</td></tr>
        <tr><td>Liste des adresses désinscrites</td><td>Tant que nécessaire pour respecter la désinscription (seule l&apos;adresse e-mail est conservée)</td></tr>
        <tr><td>Sessions de connexion</td><td>{RETENTION.sessionDays} jours au plus ; supprimées à la déconnexion, au changement de mot de passe ou avec le compte</td></tr>
        <tr><td>Liens envoyés par e-mail</td><td>Confirmation d&apos;adresse : {RETENTION.verifyEmailLinkHours} heures ; réinitialisation du mot de passe : {RETENTION.resetPasswordLinkHours} heure. Supprimés dès leur utilisation.</td></tr>
        <tr><td>Notifications lues</td><td>{RETENTION.readNotificationMonths} mois</td></tr>
        <tr><td>Journal des e-mails envoyés</td><td>{RETENTION.emailLogMonths} mois</td></tr>
        <tr><td>Sauvegardes de sécurité de la base</td><td>{RETENTION.backupDays} jours : une donnée supprimée disparaît aussi des sauvegardes au plus tard {RETENTION.backupDays} jours après. Elles ne servent qu&apos;à restaurer le service en cas d&apos;incident.</td></tr>
        <tr><td>Statistiques de fréquentation</td><td>{RETENTION.pageViewMonths} mois ; identifiant de mesure d&apos;audience renouvelé tous les {RETENTION.visitorIdMonths} mois</td></tr>
      </tbody></table></div>

      <h2>5. Destinataires</h2>
      <ul>
        <li><strong>L&apos;éditeur</strong> du site, pour l&apos;administration du service et le support, dans la limite de ce qui est nécessaire.</li>
        <li><strong>Les parties au prêt</strong> : l&apos;emprunteur reçoit le nom de la structure, le nom et l&apos;adresse e-mail du prêteur, pour pouvoir le contacter ; s&apos;il a un compte, il voit le prêt dans son espace « Emprunts ». Chaque document signé est envoyé en PDF aux deux parties, avec ses éléments de preuve : le prêteur reçoit donc le nom saisi, la signature, l&apos;adresse IP et le navigateur de l&apos;emprunteur qui a signé l&apos;accusé de réception, et inversement pour les reçus signés par le prêteur. Les notes privées du prêteur ne sont jamais montrées à l&apos;emprunteur.</li>
        <li><strong>Nos sous-traitants</strong>, qui agissent uniquement sur nos instructions et sont tenus contractuellement à la confidentialité et à la sécurité (art. 28 RGPD) :</li>
      </ul>
      <div className="scroll-x"><table className="tbl"><thead><tr><th>Prestataire</th><th>Rôle</th><th>Localisation</th></tr></thead><tbody>
        {LEGAL.processors.map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.role}</td><td>{p.location}</td></tr>)}
      </tbody></table></div>
      <p>Les données peuvent aussi être communiquées aux autorités lorsque la loi l&apos;exige.</p>

      <h2>6. Transferts hors de l&apos;Union européenne</h2>
      <p>Les données sont hébergées dans l&apos;Union européenne lorsque c&apos;est possible. Si un prestataire transfère des données hors de l&apos;UE (par exemple Stripe vers les États-Unis), le transfert est encadré par une décision d&apos;adéquation (Data Privacy Framework) ou par les clauses contractuelles types de la Commission européenne.</p>

      <h2>7. Sécurité</h2>
      <p>Connexion chiffrée (HTTPS), liens de signature chiffrés et propres à chaque prêt (jamais communiqués au prêteur, ils deviennent caducs quand le prêt est modifié), empreinte numérique de chaque document signé, mots de passe chiffrés de manière irréversible, adresse e-mail confirmée avant tout rattachement d&apos;emprunts ou envoi d&apos;e-mail à un emprunteur, sessions révocables (déconnexion de tous les appareils depuis Mon compte), exigences de robustesse des mots de passe et limitation des tentatives de connexion conformes aux recommandations de la CNIL, cookie de session protégé (HttpOnly), accès à l&apos;administration réservé aux administrateurs. En cas de violation de données présentant un risque, la CNIL est notifiée sous 72 heures et les personnes concernées sont prévenues lorsque la loi l&apos;impose.</p>

      <h2>8. Vos droits</h2>
      <p>Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement, de limitation, de portabilité et d&apos;opposition (articles 15 à 21 du RGPD), ainsi que du droit de définir des directives sur le sort de vos données après votre décès (art. 85 de la loi Informatique et Libertés).</p>
      <ul>
        <li><strong>Depuis votre compte</strong>, page <Link href="/compte">Mon compte</Link> : modifier votre nom, celui de votre structure, votre adresse e-mail et votre mot de passe, déconnecter vos autres appareils, télécharger toutes vos données (format JSON, lisible par machine), supprimer définitivement votre compte.</li>
        <li><strong>Emprunteur</strong> : lien « Ne plus recevoir ces e-mails » en bas de chaque e-mail ; possibilité de contester un prêt depuis la page de signature ; pour le reste, demande à la structure qui vous a prêté, responsable de vos données, ou à nous.</li>
        <li><strong>Pour tout le reste</strong> (effacement de données d&apos;emprunteur, question) : écrivez à <strong>{editor.email}</strong>. Nous pourrons vous demander de justifier de votre identité en cas de doute raisonnable. Réponse sous un mois maximum.</li>
      </ul>
      <p>Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la CNIL (3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07 — <a href="https://www.cnil.fr/fr/plaintes" rel="noopener noreferrer" target="_blank">cnil.fr/fr/plaintes</a>).</p>

      <h2>9. Vous avez reçu un e-mail sans avoir de compte ?</h2>
      <p>Une structure cliente de {LEGAL.siteName} (entreprise, association…) a enregistré un prêt à votre nom (du matériel ou une somme d&apos;argent qu&apos;elle vous a prêté) et a indiqué votre identité (prénom, nom, date de naissance) et votre adresse e-mail. Votre identité figure sur les documents signés pour vous identifier sans ambiguïté : vérifiez-la avant de signer ; si elle est inexacte, contestez le prêt en le signalant, la structure pourra la corriger. Ces données servent uniquement à vous demander de signer l&apos;accusé de réception du prêt, à vous envoyer les copies des documents signés (accusé de réception, reçus de remboursement, attestation de restitution), un rappel la veille de la date prévue, puis, en cas de retard et si le prêteur l&apos;a choisi, une relance au plus tous les trois jours ({MAIL_LIMITS.remindersPerLoan} rappels au maximum par prêt, et jamais plus de {MAIL_LIMITS.perRecipientPerDay} e-mails par jour). Elles ne servent à rien d&apos;autre et ne sont jamais utilisées pour de la prospection.</p>
      <p>Si vous signez l&apos;accusé de réception, le nom que vous saisissez, votre signature, la date et l&apos;heure, votre adresse IP et votre navigateur sont enregistrés comme preuve et figurent sur le document PDF envoyé à la structure et à vous-même. Ils sont conservés avec le prêt (au plus {RETENTION.returnedLoanYears} ans après sa clôture).</p>
      <p>Vous pouvez à tout moment : contester le prêt depuis la page de signature s&apos;il ne vous concerne pas ou comporte une erreur ; bloquer tous les e-mails en un clic avec le lien en bas de chaque e-mail ; demander la suppression de vos données à la structure qui vous a prêté, ou à {editor.email} ; créer un compte pour voir vos emprunts. Si vous pensez qu&apos;on vous a enregistré à tort, signalez-le-nous à la même adresse.</p>

      <h2>10. Mineurs</h2>
      <p>Le service est réservé aux professionnels : les comptes sont ouverts par des personnes âgées d&apos;au moins {LEGAL.minAge} ans, qui agissent pour une structure. Les emprunteurs doivent eux aussi être majeurs : pour un mineur, c&apos;est son représentant légal (parent ou tuteur) qui emprunte et signe, et le service refuse une date de naissance de mineur.</p>

      <h2>11. Modifications</h2>
      <p>Cette politique peut évoluer. La date de dernière mise à jour figure en haut de la page. En cas de changement important, les utilisateurs inscrits sont prévenus par e-mail ou dans l&apos;application.</p>
    </LegalPage>
  );
}
