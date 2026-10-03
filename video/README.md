# Vidéo de présentation

Vidéo promotionnelle de Prêt Matériel en motion design : 31,5 s, 1920×1080, 30 images/s, MP4 (H.264), sans son.

La vidéo est une page web animée (`scenes.html`) : mêmes couleurs, police et fiche-ticket que l'application. Chrome la « filme » image par image et l'encode lui-même, sans ffmpeg ni logiciel de montage.

## Commandes (dans ce dossier)

```bash
npm install              # une seule fois
npm run preview          # aperçu en boucle sur http://127.0.0.1:4321/scenes.html
npm run render           # fabrique out/pret-materiel.mp4 (2 à 5 minutes)
npm run stills -- 2 9.5  # images PNG aux secondes indiquées, dans out/stills/
```

Dans l'aperçu : Espace = pause, ←/→ = ±1 s, `?t=12.5` dans l'adresse pour figer un instant.

Il faut Chrome ou Edge installé. S'il n'est pas trouvé, indique son chemin dans la variable `CHROME_PATH`.

## Scénario

| Temps | Scène |
|---|---|
| 0 – 3,9 s | « Tu me la rends quand ? » |
| 3,9 – 8,2 s | Les prêts s'accumulent : qui a quoi, depuis quand ? |
| 8,1 – 11,7 s | Les fiches se fondent dans le logo, puis le nom apparaît |
| 11,6 – 16 s | 01 · Noter : la fiche se remplit, « Enregistrer le prêt » |
| 16 – 20,6 s | 02 · Prévenir : rappel la veille, relance tous les 3 jours |
| 20,7 – 24 s | 03 · Récupérer : le tampon « Rendu » |
| 24,1 – 27,6 s | Bilan : on te doit 120 €, 3 objets, 92 % rendus à l'heure |
| 27,5 – 31,5 s | Logo, « Gratuit pour un prêt en cours », « Créer mon carnet » |

## Modifier

- **Textes** : directement dans le HTML de `scenes.html`.
- **Minutage et mouvements** : la fonction `build()`. Chaque ligne pose des clés `[temps en ms, valeur, courbe]` sur un élément (`x`, `y`, `s` pour l'échelle, `r` pour la rotation, `o` pour l'opacité).
- **Durée totale** : la constante `DURATION`.
- **Adresse du site** : à ajouter sur l'écran de fin (bloc `#cta`) une fois le nom de domaine acheté.

## Droits et conformité

- Police : Schibsted Grotesk, sous licence SIL Open Font License 1.1 (utilisation commerciale autorisée).
- Prénoms et chiffres fictifs (illustration). Les promesses affichées correspondent à l'offre réelle : gratuit pour un prêt en cours, sans carte bancaire, résiliable à tout moment, rappel la veille, relance tous les 3 jours en cas de retard.
- Pas de musique : si tu en ajoutes une, prends une musique libre de droits avec licence d'usage commercial (publicité, réseaux sociaux).
- Si tu changes les offres ou les prix dans l'application, vérifie que la vidéo dit toujours vrai (pratiques commerciales trompeuses, art. L121-1 du Code de la consommation).
