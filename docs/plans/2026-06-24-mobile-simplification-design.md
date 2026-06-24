# Design — Refonte mobile « assistant simple »

Date : 2026-06-24
Statut : validé par l'utilisateur

## Problème

L'interface mobile actuelle est trop chargée : chaque écran empile tout son
contenu (intro + 4 étapes + formulaire complet + tarifs longs). L'utilisateur
doit « lire, lire, lire » avant de comprendre quoi faire. Boutons / CTA peu
distincts, certains textes trop petits, pas assez aéré.

Objectif : expérience intuitive, simple, « 5 minutes », aérée, compréhensible
immédiatement sans lecture.

## Principe directeur (vaut pour tous les écrans)

- **1 écran = 1 idée.** Gros boutons tappables (min 56px de haut).
- Texte au strict minimum : titre court + choix. Plus de pavé explicatif
  au-dessus du formulaire.
- **On garde l'identité visuelle actuelle** (fond `#0a0a0f`, rouge `#e4332b`,
  typo mono/display). On change la **densité**, pas le style.
- Règle de validation : sur chaque écran, l'œil trouve quoi faire en < 2s sans
  lire un paragraphe.

## Écran 1 — Home

Avant : titre + sous-titre + « 65 destinations » + « Comment ça marche » (4
étapes) + encart Crisis Score, tout empilé.

Après : accueil minimal.
- ⚡ CRISIS TRAVEL
- Accroche courte (« Le bon endroit, au bon moment. »)
- 1 phrase de valeur max
- UN gros bouton plein écran « TROUVER MA DESTINATION → » → lance l'assistant
- « 3 analyses gratuites · sans engagement »
- Petit lien discret « Comment ça marche ? » → page/panneau dédié (les 4 étapes
  ne disparaissent pas, elles quittent juste l'écran principal).

## Écran 2 — Assistant (cœur)

Le formulaire `SmartSearchHub` devient un parcours **une question par écran**.

Ordre (basé sur l'état `DiscoveryState` existant) :
1. D'où pars-tu ? → aéroports (CDG défaut)
2. Qu'est-ce qui compte le plus ? → Sécurité / Budget / Découverte / Équilibre (`priority`)
3. Tu voyages comment ? → Solo / Couple / Famille / Nomade (`travelType`)
4. Combien de temps ? → Court / 2 semaines / Long (`duration`) — ou dates
5. Quel budget ? → Serré / Confortable / Sans compter (`budget`)
6. → Résultats

Interactions :
- **Avancement auto au tap** : un choix → écran suivant (0.3s). Pas de bouton
  « Suivant » à chercher.
- Barre de progression fine en haut (« 3/5 »).
- Bouton **« Passer »** sur les écrans non essentiels (le code exige seulement
  2 critères sur 4 pour lancer → on peut finir en 3 taps).
- Bouton **retour (←)** toujours présent.
- L'écran « mode » (Surprends-moi / Région) et le récap « Votre analyse »
  quittent la vue principale. Mode par défaut « Surprends-moi » conservé en
  coulisse. « Explorer une région » devient une option secondaire accessible
  depuis la home, pas un onglet qui charge l'écran.

**Contrainte forte : la logique de lancement ne change pas.** L'URL finale
`/results?budget=…&duration=…&travelType=…&mode=…&priority=…&airport=…` et la
construction des paramètres (`BUDGET_MAP`, `DURATION_MAP`, calcul depuis dates,
`acquireAnalyzeLock`/`releaseAnalyzeLock`) restent identiques. On ne redessine
QUE la couche de présentation.

## Écran 3 — Tarifs

Avant : 3 cartes longues (5 + 6 + 4 lignes).

Après : 3 offres conservées, **listes coupées à 3 bénéfices max** chacune, reste
en « voir tout » repliable. Premium reste « populaire ». Comprendre Gratuit vs
Premium en 3s.

## Vérification

Après implémentation : lancer l'app en local, **prendre des captures de chaque
écran en format mobile** et les inspecter visuellement avant de déclarer terminé.
Pas de « c'est fait » sans preuve visuelle.

## Hors périmètre (YAGNI)

- Pas de changement de la logique d'analyse, des appels API, du scoring.
- Pas de changement du design system (couleurs / typos).
- Pas de refonte des pages résultats / destination / dashboard (sauf si la home
  ou l'assistant y renvoie directement).
