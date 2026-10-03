# Brief : motion design de Prêt Matériel

> **Comment l'utiliser** : ouvre une session Claude Code dans ce projet et écris :
> « Lis `docs/BRIEF-MOTION-DESIGN.md` et applique-le. »

## 1. Ta mission

Tu es motion designer produit et développeur front. Tu ajoutes, harmonises et peaufines les animations de Prêt Matériel pour que l'application paraisse plus vivante et plus soignée, sans jamais devenir tape-à-l'œil ni gêner l'utilisateur.

Le mouvement doit **expliquer ce qui se passe** : d'où vient un élément, où il va, ce qui a changé, si l'action a réussi. Une animation qui n'explique rien est retirée.

## 2. À lire avant de toucher au code

1. `.claude/CLAUDE.md` : règles légales du projet. Elles s'appliquent aussi aux animations (voir §8).
2. `.claude/agents/design-expert.md` : direction artistique et règle « Animations » déjà en place. Ce brief la complète ; en cas de doute, la solution la plus sobre l'emporte.
3. `src/app/globals.css` : tokens de mouvement (`--ease`, `--ease-spring`, `--ease-io`, `--t-fast` 140 ms, `--t` 220 ms, `--t-slow` 420 ms), section « Animations » (keyframes) et bloc `prefers-reduced-motion` en fin de fichier.
4. `src/components/ui.tsx` (`CountUp`, `Reveal` / `useInView`, `Segmented`, `Stamp`, `Meter`, bascule jour/nuit en View Transition), `Toast.tsx`, `Dialog.tsx`, `CommandPalette.tsx`, `AppShell.tsx`, `src/app/template.tsx` (entrée de page).
5. `git status` et `git diff` : une autre session travaille peut-être déjà sur le design. Pars de l'état actuel des fichiers et n'écrase jamais un travail en cours.

## 3. Direction : un mouvement « papier »

L'identité, c'est le carnet de prêt : fiches en forme de ticket à encoches, tampons, papier chaud. Le mouvement évoque des objets physiques, légers et précis :

- une fiche **glisse** et se pose (léger dépassement amorti avec `--ease-spring`, jamais de rebond mou) ;
- un tampon **tombe** et la fiche encaisse le choc (`stamp-in` + `thump`, déjà en place) ;
- une ligne terminée **s'en va** sur le côté, puis la liste se referme ;
- les chiffres **défilent** jusqu'à leur valeur ; les jauges se remplissent depuis la gauche.

| Type d'animation | Durée | Courbe | Amplitude |
|---|---|---|---|
| Retour d'interaction (survol, appui, bascule) | 140–220 ms | `--ease` | 0–2 px, échelle ≥ 0,97 |
| Apparition / disparition (menu, toast, dialogue, ligne) | 200–420 ms | `--ease` ou `--ease-spring` | 4–10 px |
| Moment narratif (tampon, création de prêt, accueil) | 420–650 ms, 1 s max pour un enchaînement | `--ease-spring` | court |
| Décalage en cascade dans une liste | 25–55 ms par élément | — | plafond existant : 12 éléments |

- La sortie est plus rapide que l'entrée (environ 70 % de sa durée).
- Un seul moment narratif à la fois à l'écran.
- **À bannir** : fondus « fade-up » de 30 px partout, objets qui flottent en boucle, parallaxe, particules, halos, dégradés animés, curseurs décoratifs, scintillements.

## 4. Ce qui existe déjà (à garder et harmoniser, pas à refaire)

- Entrée de page (`.page-in` via `template.tsx`), apparitions en cascade (`.rise`, `row-in`).
- Tampons « Rendu / Soldé / En retard » (`stamp-in`, `stamp-out`, `thump` sur la fiche).
- Sortie d'une ligne marquée rendue (`row-out`), barre de période et jauges (`grow-x`, `pop`).
- Compteurs (`CountUp`), graphiques du Bilan (`bar-grow`, `draw`).
- Toasts (`toast-in` / `toast-out`, barre de temps `shrink-x`), dialogues et palette (`pop-in` / `pop-out`), menus (`menu-in`), squelettes (`skel`).
- Indicateur glissant des onglets (`Segmented`), interrupteurs, critères du mot de passe.
- Bascule jour/nuit en cercle (View Transitions).
- Accueil : titre qui monte ligne par ligne, saisie au clavier simulée, mini-graphique, illustration e-mail + tampon, apparitions au défilement (`.reveal`).

**À harmoniser** : plusieurs durées et courbes sont écrites en dur :
- `.reveal` : 0,9 s / 1 s ;
- titre de l'accueil : 1,1 s avec une courbe à part ;
- barre de période : 1,1 s ;
- `.rise` : 0,55 s ;
- `toast-in` : 0,5 s…

Ramène-les aux tokens, ou crée un token dédié (ex. `--t-story: 650ms`) plutôt que de multiplier les valeurs.

## 5. Chantiers, par priorité

Ne fais pas tout : propose un plan (§9) et commence par ce qui apporte le plus.

**P1 : retour immédiat sur les actions principales**
- **Créer un prêt** : après « Enregistrer le prêt », continuité entre l'aperçu de la fiche et la page du prêt (la fiche « se pose »). Au retour sur la liste, la nouvelle ligne est brièvement mise en évidence.
- **Remboursement partiel** : la jauge passe de l'ancienne à la nouvelle valeur, « Reste dû » décompte, la nouvelle entrée d'historique glisse en place. Si le prêt est soldé, le tampon « Soldé » tombe.
- **Relancer** : petit envol de l'icône d'envoi, puis nouvelle ligne dans l'historique.
  - L'animation de succès ne se joue **qu'après la réponse du serveur** : le toast « Annuler » actuel s'affiche avant l'envoi réel.
  - En cas d'erreur (emprunteur désinscrit, envoi impossible), aucune animation de succès.
- **Erreurs de formulaire** : le message apparaît sous le champ avec un léger décalage (une seule fois, 4 px max), et le focus va au premier champ en erreur. Pas de tremblement répété.
- **Compteur d'offre** (« 1/10 » dans la barre latérale) et sa jauge : animer le changement quand on crée ou clôture un prêt.

**P2 : continuité dans la navigation**
- **Liste → fiche** : transition d'élément partagé (la ligne devient la fiche) avec l'API View Transitions, en amélioration progressive : rien ne casse si le navigateur ne la gère pas. Vérifie dans la documentation de la version installée (Next 15.5, React 19.1) ce qui est stable avant d'utiliser une API expérimentale.
- **Onglets « En cours / En retard / Clôturés »** : fondu court du contenu et réorganisation fluide des lignes (technique FLIP) au lieu d'un remplacement sec.
- **Mobile** : appui visible sur les onglets et le « + » central ; le formulaire « Nouveau prêt » peut entrer par le bas.
- **Palette Ctrl/⌘ K** : résultats en cascade très courte (120 ms au total maximum).

**P3 : Bilan**
- Au changement de période (7 j / 30 j / 90 j / 12 mois), les barres, la courbe et les chiffres passent de l'ancienne à la nouvelle valeur au lieu de repartir de zéro.

**P4 : page d'accueil**
- Raconter le cycle d'un prêt sur la fiche du haut de page (prêté → rappel la veille → rendu) au défilement.
- En amélioration progressive : `animation-timeline` uniquement sous `@supports`, sinon état final statique.
- Rester sobre.

**P5 : finitions**
- États « appuyé » (`:active`) sur boutons, puces et lignes, pour le tactile.
- Passage squelette → contenu en fondu, sans décalage de mise en page.
- Empilement des toasts : les toasts déjà affichés se décalent en douceur quand un nouveau arrive.
- Alertes : le point « non lu » apparaît et disparaît en douceur ; « tout marquer comme lu » en cascade.

## 6. Règles techniques

- **Pas de librairie d'animation** par défaut. Utilise :
  - CSS (transitions, keyframes) ;
  - la Web Animations API (`element.animate`) pour les enchaînements ;
  - View Transitions pour la continuité entre écrans.

  Si une librairie te semble indispensable, demande d'abord. Elle doit être installée par npm et embarquée dans le build (jamais chargée depuis un CDN), avec un poids justifié.
- Anime **`transform` et `opacity`** (à la rigueur `clip-path` ou un `filter` léger). Évite `width`, `height`, `top`, `left` et `margin`, sauf pour refermer une liste après une suppression.
- Tous les temps et courbes passent par les tokens CSS. Les nouveaux keyframes vont dans la section « Animations » de `globals.css`, avec des noms anglais courts comme les existants.
- Pas de GIF, de vidéo ni de Lottie pour l'interface : SVG + CSS.
- Une animation ne bloque jamais l'utilisateur :
  - boutons utilisables tout de suite ;
  - aucune attente de fin d'animation pour naviguer ou valider ;
  - aucun décalage de mise en page (CLS).
- `will-change` seulement pendant l'animation, jamais en permanence.
- Le rendu serveur montre l'état final : le contenu doit rester lisible sans JavaScript (c'est déjà le principe de `.reveal`).
- **Piège connu** : `requestAnimationFrame` est suspendu quand l'onglet est caché, y compris quand le panneau navigateur de Claude est masqué. Un `CountUp` peut alors sembler bloqué sur sa valeur de départ.
  - Ne conclus pas à un bug sans vérifier la valeur finale dans le DOM.
  - Prévois d'afficher directement la valeur finale si `document.hidden`.
- Ne change ni la logique métier, ni les appels API, ni les textes (hors micro-copie liée à une animation, à faire valider).

## 7. Accessibilité (RGAA / WCAG AA, obligatoire)

- **`prefers-reduced-motion: reduce`** :
  - le bloc global de `globals.css` neutralise les animations CSS ;
  - **chaque animation en JavaScript** (Web Animations, View Transitions, compteurs, saisie simulée) doit vérifier cette préférence et afficher directement l'état final ;
  - garde un retour discret (couleur, fondu très court) plutôt que rien.
- **Rien ne bouge ni ne clignote automatiquement plus de 5 secondes** sans moyen de l'arrêter (WCAG 2.2.2, RGAA critère 13.8). Deux cas existants à corriger, en limitant le nombre de répétitions ou en arrêtant après la séquence :
  - le point qui pulse en boucle sur les badges « En retard » (`.due.late::before`, `ping … infinite`) ;
  - le curseur qui clignote sans fin sur l'accueil (`.art-field .caret`, `blink … infinite`).

  Les indicateurs de chargement (`.spin`, `.skel`) restent acceptables.
- Pas plus de 3 flashs par seconde (WCAG 2.3.1).
- Les chiffres animés exposent leur valeur finale aux lecteurs d'écran (valeur réelle dans un texte masqué visuellement, chiffres animés en `aria-hidden`).
- Le focus clavier reste visible et à sa place pendant et après une animation. Un élément pas encore « révélé » ne doit pas recevoir le focus en restant invisible.
- Les changements d'état importants (succès, erreur) sont toujours annoncés en texte (toasts, messages), jamais uniquement par le mouvement.

## 8. Conformité (rappel de `.claude/CLAUDE.md`)

- **Aucune ressource tierce** : ni script, ni police, ni iframe, ni fichier chargé depuis un autre serveur (CDN, Google Fonts, Lottie hébergé ailleurs…). Le site n'a pas de bandeau cookies parce qu'il n'a aucun traceur ; une ressource externe peut casser cette exemption.
- Toute préférence stockée sur l'appareil (ex. « réduire les animations ») doit être déclarée dans `src/app/cookies/page.tsx`.
- **Pas de dark patterns animés** :
  - pas de pulsation ni de tremblement pour pousser vers une offre payante ;
  - pas de faux compte à rebours ni de faux « en direct ».
- **Ne touche pas** :
  - au parcours de résiliation : « Résilier votre contrat » reste visible et cliquable immédiatement, sans animation qui le retarde ou le cache ;
  - à la case d'acceptation des CGV : jamais cochée par une animation ;
  - aux pages légales : texte statique ;
  - aux e-mails (`src/lib/mail.ts`).
- Commence ton résumé final par la ligne `[Expert Legal] …`, comme l'exige `CLAUDE.md`.

## 9. Méthode

1. **Audit, sans coder.** Tableau des animations existantes par écran (déclencheur, durée, courbe), avec les incohérences, les manques et les problèmes d'accessibilité.
2. **Plan.** 5 à 10 propositions classées de P1 à P5, une ligne chacune : écran, déclencheur, ce que l'animation raconte. Attends le feu vert de l'utilisateur, sauf s'il t'a demandé de tout faire d'une traite.
3. **Implémentation par lots** (un lot = un chantier), en réutilisant les composants et keyframes existants.
4. **Vérification** après chaque lot (§10).
5. **Pas de commit ni de push** sans demande explicite.

## 10. Vérification, à chaque lot

- [ ] `npx tsc --noEmit` passe sans erreur.
- [ ] L'application tourne : `docker compose up -d --build app` (http://localhost:3000) ou un serveur de dev de `.claude/launch.json`.
- [ ] Contrôle dans le navigateur :
  - bureau et mobile (375 px) ;
  - mode jour et mode nuit ;
  - `prefers-reduced-motion: reduce` émulé (DevTools → Rendering) ;
  - navigation au clavier seul.
- [ ] Fluidité : pas d'à-coups (60 images/s visées dans l'onglet Performance), pas de décalage de mise en page.
- [ ] Les parcours critiques fonctionnent toujours : inscription, création de prêt, marquer rendu, remboursement, résiliation en 3 clics, suppression de compte.

## 11. Livrable

Un résumé court, dans cet ordre :

1. `[Expert Legal] …` : le verdict en une ligne.
2. Un tableau des animations ajoutées ou modifiées : écran, déclencheur, durée, courbe.
3. Les corrections d'accessibilité faites.
4. Des captures avant/après des moments clés.
5. Ce qui reste à faire ou à arbitrer.
