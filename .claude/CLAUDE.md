# Prêt Matériel — règles du projet

## Conformité légale : à vérifier pour CHAQUE fonctionnalité

Le site vend des abonnements à des particuliers en France et envoie des e-mails à des tiers (les emprunteurs). Toute nouvelle fonctionnalité, modification de données ou de parcours doit rester conforme au droit **français et européen**. Avant de coder, pose-toi les questions ci-dessous ; si une réponse demande un changement, fais-le dans la même tâche (code + pages légales), ou signale-le clairement à l'utilisateur.

**Signalement visible** : chaque fois que tu fais cette vérification légale (ou que tu appelles l'agent `legal-expert`), commence le paragraphe correspondant de ta réponse par `[Expert Legal]`, suivi du verdict en une ligne (ex. `[Expert Legal] OK — aucune nouvelle donnée personnelle` ou `[Expert Legal] À corriger — …`).

Référence de ce qui existe déjà : `docs/CONFORMITE.md` (checklist + registre des traitements). Pour une revue approfondie, utilise l'agent `legal-expert`.

### 1. Données personnelles (RGPD, loi Informatique et Libertés)
- **Nouvelle donnée collectée ou nouvel usage ?** Elle doit être nécessaire (minimisation), avoir une base légale (contrat, intérêt légitime, obligation légale, ou consentement) et une durée de conservation.
  → Mettre à jour `src/app/confidentialite/page.tsx` (données, finalités/bases légales, durées), le registre dans `docs/CONFORMITE.md`, et si besoin `RETENTION` dans `src/lib/legal.ts` + la purge dans `src/lib/retention.ts`.
- **Nouveau champ en base sur un utilisateur ?** L'ajouter à l'export `src/app/api/account/export/route.ts` (droit d'accès/portabilité) et vérifier qu'il est supprimé avec le compte (cascade Prisma) ou anonymisé.
- **Données de tiers (emprunteurs)** : uniquement ce qui sert au rappel. Tout e-mail envoyé à un tiers passe par `sendMail({ thirdParty })` (info art. 14 + lien de désinscription + respect de `EmailOptOut`). Jamais de prospection vers eux.
- **Pas de données sensibles** (santé, opinions, religion, infractions, situation financière détaillée…) sauf justification forte et analyse préalable.
- **Nouveau prestataire / service tiers** (API, SDK, analytics, IA, hébergement de fichiers…) : c'est un sous-traitant → l'ajouter à `LEGAL.processors` dans `src/lib/legal.ts`, vérifier la localisation des données et l'encadrement des transferts hors UE (DPF, clauses contractuelles types), et prévenir l'utilisateur qu'il faut un contrat (DPA).
- **Sécurité (art. 32)** : contrôle d'accès sur chaque route API (`withUser` / `withAdmin`, vérifier que la ressource appartient à l'utilisateur), validation zod, pas de donnée personnelle dans les URL, logs ou messages d'erreur, mots de passe via `passwordSchema`.
- **Pas de décision automatisée** ni de profilage ayant des effets sur les personnes sans en informer et sans base légale.

### 2. Cookies et traceurs (art. 82 loi I&L, directive ePrivacy, lignes directrices CNIL)
- Aujourd'hui le site n'a **aucun bandeau** car tous les traceurs sont exemptés. Tout nouveau cookie, `localStorage`, pixel, script ou iframe tiers (Google Analytics, Facebook, YouTube, Google Fonts chargé depuis Google, Hotjar, chat, etc.) **casse cette exemption** et impose un bandeau de consentement avec refus aussi simple que l'acceptation.
  → Préférer une solution sans traceur ou hébergée en local. Sinon : bandeau de consentement + mise à jour de `src/app/cookies/page.tsx`.
- La mesure d'audience ne doit jamais être reliée au compte utilisateur (`/api/track`).

### 3. Vente aux consommateurs (Code de la consommation)
- **Prix ou offre modifiés** (`src/lib/plans.ts`) : prix TTC + mention TVA (`LEGAL.vatMention`), mettre à jour les CGV si les conditions changent, jamais d'augmentation sur une période déjà payée, prévenir les abonnés 30 jours avant. Changer `TERMS_VERSION` et `LEGAL_UPDATED_AT`.
- **Parcours d'achat** : informations précontractuelles visibles avant paiement, case d'acceptation des CGV (non pré-cochée), bouton de commande sans ambiguïté sur l'obligation de payer, confirmation par e-mail.
- **Droit de rétractation 14 jours** et **résiliation en 3 clics** (L215-1-1, décret 2023-417) : ne jamais rendre la résiliation plus difficile que la souscription ; toute nouvelle formule payante doit être résiliable depuis la page Offre avec e-mail de confirmation.
- **Reconduction tacite** (loi Chatel, L215-1) : tout abonnement à durée déterminée reconduit automatiquement doit déclencher l'e-mail de préavis (voir `src/lib/retention.ts`).
- **Pas de dark patterns** : pas de case pré-cochée, de faux compte à rebours, de faux stock, d'option payante ajoutée par défaut, de désabonnement caché (DSA art. 25, pratiques commerciales trompeuses L121-1 s.).
- **Avis clients, parrainage, codes promo** : règles spécifiques (L111-7-2 pour les avis, prix de référence pour les réductions L112-1-1).

### 4. E-mails et communications
- E-mail **transactionnel** (lié au service) : OK sans consentement.
- E-mail **commercial / newsletter** vers des utilisateurs : consentement préalable (case non pré-cochée) ou exception « produits analogues » pour les clients, avec lien de désinscription dans chaque message (L34-5 CPCE). **Jamais** de prospection vers les emprunteurs.
- SMS : mêmes règles, plus horaires et mention STOP.

### 5. Contenus et responsabilité
- Tout nouveau champ libre visible par un autre utilisateur ou envoyé à un tiers : risque de propos illicites → prévoir un moyen de signalement (LCEN, DSA) et le mentionner dans les CGU.
- Le service ne doit jamais devenir intermédiaire financier : aucune somme ne transite entre prêteur et emprunteur via le site (sinon agrément ACPR requis). Pas de crypto sans agrément PSAN/MiCA.
- Fonctionnalités visant les mineurs : âge minimum 15 ans (`LEGAL.minAge`).

### 6. Accessibilité et langue
- Interface en français (loi Toubon pour l'offre commerciale). Viser le RGAA/WCAG AA : labels sur les champs, contrastes, navigation clavier. L'European Accessibility Act s'applique aux services de commerce en ligne depuis le 28 juin 2025 (exemption possible pour les microentreprises de moins de 10 salariés et moins de 2 M€ de chiffre d'affaires : le vérifier si l'activité grandit).

### Règles de rédaction
- Après toute modification des CGU/CGV ou de la politique de confidentialité : changer `TERMS_VERSION` / `LEGAL_UPDATED_AT` dans `src/lib/legal.ts`.
- Ne jamais inventer une référence légale. En cas de doute sur un texte ou un seuil, le dire et recommander de vérifier sur Légifrance / cnil.fr ou auprès d'un avocat.
- À la fin d'une tâche, si un point légal reste à la charge de l'utilisateur (contrat, déclaration, adhésion…), le lister explicitement dans le résumé.
