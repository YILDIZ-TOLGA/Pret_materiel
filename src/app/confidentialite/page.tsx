import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL, RETENTION } from "@/lib/legal";

export const metadata: Metadata = { title: "Politique de confidentialité · Prêt Matériel" };

export default function Page() {
  const { editor } = LEGAL;
  return (
    <LegalPage title="Politique de confidentialité">
      <p>Cette politique explique quelles données personnelles {LEGAL.siteName} traite, pourquoi, combien de temps, et comment exercer vos droits. Elle s&apos;applique aux utilisateurs inscrits et aux personnes enregistrées comme emprunteurs par un utilisateur, qu&apos;elles aient un compte ou non. Elle est établie conformément au règlement (UE) 2016/679 (RGPD) et à la loi n° 78-17 du 6 janvier 1978 « Informatique et Libertés ».</p>
      <div className="box">
        <p><strong>En bref</strong> : nous collectons le strict nécessaire pour faire fonctionner le service. Pas de publicité, pas de revente de données, pas de cookie tiers. Vous pouvez télécharger ou supprimer vos données à tout moment depuis la page <Link href="/compte">Mon compte</Link>, et un emprunteur peut bloquer tous nos e-mails en un clic.</p>
      </div>

      <h2>1. Responsable du traitement</h2>
      <p>{editor.name}, {editor.address}. Contact pour toute question ou demande relative à vos données : <strong>{editor.email}</strong>.</p>
      <p>Pour les informations que vous saisissez sur vos emprunteurs (nom, e-mail, téléphone, notes), vous en êtes vous-même responsable au sens où vous choisissez de les enregistrer ; {LEGAL.siteName} les traite pour vous fournir le service de rappel. Ces données ne doivent servir qu&apos;au suivi de vos prêts (voir les <Link href="/cgu">conditions générales</Link>).</p>

      <h2>2. Données traitées</h2>
      <h3>Utilisateurs inscrits</h3>
      <ul>
        <li><strong>Compte</strong> : prénom, adresse e-mail, mot de passe (stocké uniquement sous forme chiffrée irréversible, bcrypt), date d&apos;inscription, date de dernière activité, date et version des conditions acceptées, date de confirmation de l&apos;adresse e-mail et, le cas échéant, la nouvelle adresse en attente de confirmation.</li>
        <li><strong>Sécurité du compte</strong> : sessions de connexion (date d&apos;ouverture et d&apos;expiration, sans information sur l&apos;appareil) et liens de confirmation ou de réinitialisation du mot de passe envoyés par e-mail (seule une empreinte du lien est conservée).</li>
        <li><strong>Prêts</strong> : objets ou montants prêtés, dates, remboursements, notes personnelles, options de rappel.</li>
        <li><strong>Abonnement</strong> : offre choisie, dates de renouvellement, historique des paiements (montant, date). Vos coordonnées bancaires sont saisies directement chez notre prestataire de paiement Stripe : nous n&apos;y avons jamais accès.</li>
        <li><strong>Notifications</strong> affichées dans l&apos;application.</li>
      </ul>
      <h3>Personnes enregistrées comme emprunteurs</h3>
      <ul>
        <li>Nom, adresse e-mail et, si l&apos;utilisateur le renseigne, numéro de téléphone ; ce qui a été prêté, les dates et les remboursements.</li>
        <li>Ces données ne sont pas collectées auprès de vous mais auprès de l&apos;utilisateur qui vous a prêté quelque chose (voir la section 9).</li>
      </ul>
      <h3>Tous les visiteurs</h3>
      <ul>
        <li><strong>Mesure d&apos;audience</strong> : page consultée, site d&apos;origine, type d&apos;appareil, navigateur, pays, et un identifiant aléatoire stocké sur votre appareil. Aucun lien n&apos;est fait avec votre compte. Détails et opposition sur la page <Link href="/cookies">Cookies</Link>.</li>
        <li><strong>Sécurité</strong> : l&apos;adresse IP est utilisée quelques minutes, en mémoire, pour bloquer les tentatives en série (connexion, inscription, mot de passe oublié) et les envois abusifs. Elle n&apos;est pas enregistrée en base.</li>
        <li><strong>Journal des e-mails</strong> : destinataire, objet, type et résultat de chaque e-mail envoyé, pour vérifier la bonne délivrance et traiter les réclamations.</li>
      </ul>

      <h2>3. Finalités et bases légales</h2>
      <div className="scroll-x"><table className="tbl"><thead><tr><th>Finalité</th><th>Base légale (art. 6 RGPD)</th></tr></thead><tbody>
        <tr><td>Créer et gérer votre compte, enregistrer vos prêts, afficher votre bilan</td><td>Exécution du contrat (CGU)</td></tr>
        <tr><td>Confirmer votre adresse e-mail, réinitialiser votre mot de passe, vous prévenir d&apos;un changement de mot de passe ou d&apos;adresse</td><td>Exécution du contrat (CGU) et sécurité du compte (art. 32 RGPD)</td></tr>
        <tr><td>Envoyer aux emprunteurs les e-mails liés à un prêt (confirmation, rappel la veille, relances)</td><td>Intérêt légitime de l&apos;utilisateur à récupérer son bien ou son argent ; l&apos;emprunteur peut s&apos;y opposer à tout moment en un clic</td></tr>
        <tr><td>Gérer les abonnements et les paiements</td><td>Exécution du contrat (CGV)</td></tr>
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
        <tr><td>Prêts clôturés (objet rendu ou argent remboursé)</td><td>{RETENTION.returnedLoanYears} ans après la clôture, durée pendant laquelle un litige sur le prêt reste possible (prescription de droit commun, art. 2224 du Code civil), puis suppression automatique</td></tr>
        <tr><td>Données d&apos;un emprunteur</td><td>Celle du prêt qui le concerne. Supprimées avec le compte du prêteur.</td></tr>
        <tr><td>Factures et paiements</td><td>10 ans (obligation comptable), même après la suppression du compte, sans lien avec le compte supprimé</td></tr>
        <tr><td>Liste des adresses désinscrites</td><td>Tant que nécessaire pour respecter la désinscription (seule l&apos;adresse e-mail est conservée)</td></tr>
        <tr><td>Sessions de connexion</td><td>{RETENTION.sessionDays} jours au plus ; supprimées à la déconnexion, au changement de mot de passe ou avec le compte</td></tr>
        <tr><td>Liens envoyés par e-mail</td><td>Confirmation d&apos;adresse : {RETENTION.verifyEmailLinkHours} heures ; réinitialisation du mot de passe : {RETENTION.resetPasswordLinkHours} heure. Supprimés dès leur utilisation.</td></tr>
        <tr><td>Notifications lues</td><td>{RETENTION.readNotificationMonths} mois</td></tr>
        <tr><td>Journal des e-mails envoyés</td><td>{RETENTION.emailLogMonths} mois</td></tr>
        <tr><td>Statistiques de fréquentation</td><td>{RETENTION.pageViewMonths} mois ; identifiant de mesure d&apos;audience renouvelé tous les {RETENTION.visitorIdMonths} mois</td></tr>
      </tbody></table></div>

      <h2>5. Destinataires</h2>
      <ul>
        <li><strong>L&apos;éditeur</strong> du site, pour l&apos;administration du service et le support, dans la limite de ce qui est nécessaire.</li>
        <li><strong>Les autres utilisateurs, dans le cadre d&apos;un prêt</strong> : l&apos;emprunteur reçoit le prénom et l&apos;adresse e-mail du prêteur dans les e-mails de rappel, pour pouvoir le contacter ; si l&apos;emprunteur a un compte, il voit le prêt dans son espace « Emprunts ». Les notes privées du prêteur ne sont jamais montrées à l&apos;emprunteur.</li>
        <li><strong>Nos sous-traitants</strong>, qui agissent uniquement sur nos instructions et sont tenus contractuellement à la confidentialité et à la sécurité (art. 28 RGPD) :</li>
      </ul>
      <div className="scroll-x"><table className="tbl"><thead><tr><th>Prestataire</th><th>Rôle</th><th>Localisation</th></tr></thead><tbody>
        {LEGAL.processors.map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.role}</td><td>{p.location}</td></tr>)}
      </tbody></table></div>
      <p>Les données peuvent aussi être communiquées aux autorités lorsque la loi l&apos;exige.</p>

      <h2>6. Transferts hors de l&apos;Union européenne</h2>
      <p>Les données sont hébergées dans l&apos;Union européenne lorsque c&apos;est possible. Si un prestataire transfère des données hors de l&apos;UE (par exemple Stripe vers les États-Unis), le transfert est encadré par une décision d&apos;adéquation (Data Privacy Framework) ou par les clauses contractuelles types de la Commission européenne.</p>

      <h2>7. Sécurité</h2>
      <p>Connexion chiffrée (HTTPS), mots de passe chiffrés de manière irréversible, adresse e-mail confirmée avant tout rattachement d&apos;emprunts ou envoi d&apos;e-mail à un emprunteur, sessions révocables (déconnexion de tous les appareils depuis Mon compte), exigences de robustesse des mots de passe et limitation des tentatives de connexion conformes aux recommandations de la CNIL, cookie de session protégé (HttpOnly), accès à l&apos;administration réservé aux administrateurs. En cas de violation de données présentant un risque, la CNIL est notifiée sous 72 heures et les personnes concernées sont prévenues lorsque la loi l&apos;impose.</p>

      <h2>8. Vos droits</h2>
      <p>Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement, de limitation, de portabilité et d&apos;opposition (articles 15 à 21 du RGPD), ainsi que du droit de définir des directives sur le sort de vos données après votre décès (art. 85 de la loi Informatique et Libertés).</p>
      <ul>
        <li><strong>Depuis votre compte</strong>, page <Link href="/compte">Mon compte</Link> : modifier votre prénom, votre adresse e-mail et votre mot de passe, déconnecter vos autres appareils, télécharger toutes vos données (format JSON, lisible par machine), supprimer définitivement votre compte.</li>
        <li><strong>Emprunteur</strong> : lien « Ne plus recevoir ces e-mails » en bas de chaque e-mail.</li>
        <li><strong>Pour tout le reste</strong> (effacement de données d&apos;emprunteur, question) : écrivez à <strong>{editor.email}</strong>. Nous pourrons vous demander de justifier de votre identité en cas de doute raisonnable. Réponse sous un mois maximum.</li>
      </ul>
      <p>Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la CNIL (3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07 — <a href="https://www.cnil.fr/fr/plaintes" rel="noopener noreferrer" target="_blank">cnil.fr/fr/plaintes</a>).</p>

      <h2>9. Vous avez reçu un e-mail sans avoir de compte ?</h2>
      <p>Un utilisateur de {LEGAL.siteName} a enregistré un prêt à votre nom (un objet ou une somme d&apos;argent qu&apos;il vous a prêté) et a indiqué votre nom et votre adresse e-mail. Ces données servent uniquement à vous envoyer la confirmation du prêt, un rappel la veille de la date prévue, puis, en cas de retard et si le prêteur l&apos;a choisi, une relance au plus tous les trois jours. Elles ne servent à rien d&apos;autre et ne sont jamais utilisées pour de la prospection.</p>
      <p>Vous pouvez à tout moment : bloquer tous les e-mails en un clic avec le lien en bas de chaque e-mail ; demander la suppression de vos données à {editor.email} ; créer un compte pour voir vos emprunts. Si vous pensez qu&apos;on vous a enregistré à tort, signalez-le-nous à la même adresse.</p>

      <h2>10. Mineurs</h2>
      <p>Le service est réservé aux personnes âgées d&apos;au moins {LEGAL.minAge} ans. La souscription d&apos;un abonnement payant est réservée aux personnes majeures ou autorisées par leur représentant légal.</p>

      <h2>11. Modifications</h2>
      <p>Cette politique peut évoluer. La date de dernière mise à jour figure en haut de la page. En cas de changement important, les utilisateurs inscrits sont prévenus par e-mail ou dans l&apos;application.</p>
    </LegalPage>
  );
}
