# Crisis Travel — Frontend Redesign Brief for Claude Design

> **Phase :** préparation design (PHASE-DESIGN-001). **PAS** d'implémentation.
> **Baseline gelée :** `main` = `origin/main` = `7f80d2b`.
> **Cadre :** refonte frontend **complète** via Claude Design — **pas** de polish incrémental.
> **Ordre :** Claude Design d'abord (direction + écrans + design system), Claude Code ensuite (implémentation gate-based).
> **⚠ Direction artistique non figée :** ce brief pose le cadre, les contraintes, les écrans à refondre et la méthode d'exploitation des références. La DA définitive sera arrêtée **après réception des références visuelles de l'utilisateur** (voir §11).

---

## 1. Résumé produit

**Crisis Travel** est un produit d'**intelligence voyage en contexte de crise**. Il combine opportunité de prix, signaux de sécurité/risque et préparation pratique pour aider l'utilisateur à identifier des destinations **sûres, malines et moins chères** — y compris dans des contextes instables.

- **Utilisateur cible** : voyageur français autonome (solo / couple / famille / nomade) qui veut décider *où* partir intelligemment, pas seulement comparer des prix.
- **Pourquoi le produit existe** : l'instabilité mondiale crée des **fenêtres d'opportunité** (devises faibles, sous-fréquentation, prix bas) que les comparateurs classiques ignorent et que l'anxiété médiatique masque.
- **Ce qui le différencie** : un **CrisisScore** explicable (Sécurité 40 % · Géopolitique 30 % · Budget 20 % · Praticité 10 %), une posture éditoriale crédible (sources officielles MEAE/State Dept/ACLED), une aide à la **décision** + à l'**action** (préparation, réservation).

## 2. Problème actuel

Le frontend **fonctionne** mais ne porte pas l'ambition produit :
- Crédibilité insuffisante : look « dashboard de trading / terminal géopolitique » qui penche vers l'anxiogène plutôt que vers l'intelligence éditoriale premium.
- Hiérarchie peu claire : sections numérotées uniformes, tout au même niveau ; pas de gradation *comprendre › décider › agir*.
- Positionnement « travel intelligence » pas assez affirmé visuellement.
- Densité excessive (micro-texte 8–10px, murs de données) ; rouge omniprésent.
- Flux de conversion à mieux structurer (CTA, hiérarchie d'action).
- **Crédibilité chiffrée** : la home affiche des chiffres qui **surpromettent / contredisent la réalité** (voir §4, point crédibilité).

## 3. Objectifs de la refonte

1. **Crédibilité premium** : un outil sérieux d'aide à la décision, pas un blog voyage ni une ferme à liens.
2. **Clarté** : alléger la densité, hiérarchiser, rendre les scores lisibles d'un coup d'œil.
3. **Mobile-first** : conçu pour le pouce, pas rattrapé par breakpoints.
4. **Récit produit fort** : répondre visuellement à *Quoi ? / Pourquoi une crise = opportunité ? / C'est quoi le CrisisScore ? / Que faire du résultat ? / Comment réserver sûr ?*
5. **Lisibilité du score** : gauge + sous-scores comme pièce maîtresse.
6. **Flux de décision destination** clair (du classement à la fiche à l'action).
7. **CTA affiliés intégrés comme outils utiles** de préparation, pas comme encarts pub.
8. **Préserver tous les contrats backend** (voir §10).

## 4. Direction de marque (cadre, non figée)

Ambiance visée (à confirmer/affiner avec les références §11) :
- **Dark premium** ; identité **noir / rouge** ; **haut contraste**.
- **Urgence maîtrisée** (pas d'alertes rouges partout).
- **Intelligence éditoriale** ; hybride **SaaS moderne × travel-risk**.
- **Clarté dans l'incertitude** ; aide à la décision.

À éviter (explicite) : clutter, trop de cartes, look agence de voyage amateur, rouge-alerte généralisé, look « AI startup » générique, design trop ludique, layout saturé d'affiliation, murs de texte, blocs de données minuscules illisibles, overflow mobile.

> **Crédibilité produit (obligatoire)** : la home **ne doit pas afficher de chiffres qui surpromettent ou contredisent la réalité actuelle**. Exemple constaté : « **196 pays** », « 47 alertes », « 134 destinations stables » alors que la **couverture réelle est N=18** destinations analysées. La refonte doit afficher des chiffres **honnêtes et cohérents** avec le périmètre réel (ou les retirer). ⚠ Ceci concerne **l'affichage front uniquement** — le moteur de scoring, N=18 et TARGET_COUNTRIES **ne doivent pas être touchés**.

## 5. Ambiance / mood

Dark premium · noir/rouge · urgence contrôlée · haut contraste · intelligence éditoriale · SaaS travel-risk moderne. *(Tons exacts, dégradés, grain, typographies : à arrêter après références §11.)*

## 6. Brief de refonte page par page

- **Homepage** : hero à forte proposition de valeur (dire *ce que fait* le produit) ; module de recherche/opportunité ; explication du CrisisScore ; cadrage confiance & sécurité ; **chiffres honnêtes (cf. §4)** ; monétisation discrète à ce stade.
- **Page résultats / opportunités** : opportunités classées ; cartes de score lisibles ; « pourquoi cette destination » clair ; équilibre risque vs opportunité ; actions concises. ⚠ **`/results` n'a pas pu être capturée en état rempli** lors de l'audit (les query params testés ont été rejetés → « Paramètres invalides »). La refonte de cette page devra donc être **validée plus tard avec un vrai scénario de recherche fonctionnel** ; la direction proposée s'appuie sur le code de `ResultsContent`, pas sur une capture.
- **Page détail destination** : résumé crise/opportunité ; décomposition du score ; conseils pratiques ; Travel Pack ; hiérarchie CTA → **primaire : comprendre/sélectionner la destination** ; **secondaire : réserver vol/hôtel/assurance/transfert/activité/eSIM**.
- **Travel Pack** : doit ressembler à un **kit de préparation utile**, pas à un bloc d'affiliation. Groupement clair : **Réservation essentielle** (vol/hôtel) · **Préparation** (transfert/activités/eSIM) · **Protection** (assurance). CTA visibles mais non agressifs.
- **Pricing** : aligné premium/crédibilité (cohérent avec Stripe, intouché).
- **Pages légales** (`/privacy`, `/terms`) : à **préserver**, non prioritaires pour le design.

## 7. Refonte au niveau composant

- **Hero** : promesse claire + sous-titre explicatif + entrée de recherche.
- **Module recherche/input** (`SmartSearchHub`, `CountrySearchBar`) : simple, guidé, mobile-first.
- **Carte CrisisScore** (`CrisisScoreGauge`, `GaugeWithTooltip`, `SubscoreBar`) : pièce maîtresse, lisible, hiérarchisée.
- **Carte destination** (`CountryCard`, `OpportunityBadge`) : score + « pourquoi » + action, sans surcharge.
- **Bloc explication risque/opportunité** (`CrisisScoreExplainer`, `SecurityAlert`) : pédagogique, éditorial.
- **Travel Pack** (`TravelPackBlock`, `TravelPackMiniBlock`) : kit groupé (cf. §6) ; MiniBlock peut rester compact.
- **Boutons CTA** : hiérarchie primaire/secondaire nette.
- **Bloc confiance/sécurité** : sources, méthode, crédibilité.
- **Header/Footer** : épurés, premium.

## 8. Exigences mobile

- Pas de cartes serrées ; hiérarchie de score lisible.
- CTA sticky/clair **seulement si justifié**.
- Les CTA affiliés **ne doivent pas dominer**.
- **Pas d'overflow horizontal**.
- Toutes les actions clés accessibles dans une zone « pouce ».

## 9. Règles de monétisation

- **Stripe reste séparé et intouché.**
- Les CTA affiliés doivent ressembler à des **outils de préparation utiles**.
- **Aucune URL d'affiliation en dur** dans le front (résolution serveur).
- **Préserver les patterns `/api/affiliate/click`** : `?category=…&partner=…&url=…&country=…&countryName=…&total=…`.
- **Préserver le mapping partenaire** : flight/skyscanner · hotel/booking · insurance/chapka · transfer/welcome-pickups · activity/tiqets · esim/airalo.
- Booking & Chapka restent en **fallback public** jusqu'à intégration ultérieure.
- **GetTransfer non exposé** (sauf décision d'un GOAL ultérieur).

## 10. Règles de préservation backend / API

- Ne pas changer le contrat de **`/api/analyze`**.
- Ne pas changer le contrat de **`/api/affiliate/click`**.
- Ne pas changer le **schéma Supabase**.
- Ne pas toucher aux **routes Stripe**.
- Ne pas casser les **routes SEO/légales** (`/privacy`, `/terms`, `robots.txt`, `sitemap.xml`, OpenGraph).
- Ne pas casser les **tests existants**.
- Ne pas toucher **scoring / N=18 / TARGET_COUNTRIES / cache**.

## 11. Références visuelles à fournir par l'utilisateur

> **Section déterminante.** La direction artistique **n'est pas figée** par ce brief : elle sera arrêtée après réception des références ci-dessous. Ce brief prépare le cadre, les contraintes, les écrans et la **méthode d'exploitation** des références.

L'utilisateur fournira :
- **Captures ou photos d'interfaces qu'il aime** (inspirations générales).
- **Exemples de hero sections**.
- **Exemples de cartes destination**.
- **Exemples de dashboards / scores** (jauges, sous-scores, data-viz).
- **Exemples de CTA** (boutons, hiérarchie, états).
- **Exemples mobile**.
- **Couleurs, typographies, ambiance** souhaitées.
- **Éléments précis à reproduire**.
- **Éléments à éviter**.

**Méthode d'exploitation des références (côté Claude Design) :**
1. Classer chaque référence par intention (hero / carte / score / CTA / mobile / ambiance).
2. En extraire des **principes** (palette, contraste, densité, rythme typographique, traitement des données) plutôt que copier pixel à pixel.
3. Confronter chaque principe aux **contraintes** (§4 « éviter », §8 mobile, §9 monétisation, crédibilité chiffres) → écarter ce qui entre en conflit.
4. Produire un **moodboard de synthèse** + palette/typo arrêtées, soumis pour validation.
5. **Seulement ensuite** : maquettes finales des 4 écrans (desktop + mobile) + specs composants.

## 12. Prompt Claude Design (auto-suffisant)

> *(À coller dans Claude Design. Auto-suffisant : ne suppose aucun contexte externe. À utiliser avec les références visuelles §11 jointes.)*

```
Tu es directeur artistique / designer produit. Conçois la direction visuelle complète
et le système d'écrans d'un produit web nommé « Crisis Travel ».

PRODUIT
Crisis Travel est un outil d'intelligence voyage en contexte de crise. Il aide un
voyageur français à identifier des destinations sûres, malines et moins chères, y
compris dans des contextes instables, en combinant : opportunité de prix, signaux de
sécurité/risque, et préparation pratique. Cœur du produit : le « CrisisScore » (0–100),
pondéré Sécurité 40 % · Géopolitique 30 % · Budget 20 % · Praticité 10 %, basé sur des
sources officielles (MEAE, State Dept, ACLED). Le produit analyse actuellement un
nombre LIMITÉ de destinations soigneusement sélectionnées — n'invente jamais de chiffres
de couverture ; n'affiche un nombre que s'il m'est confirmé, sinon reste qualitatif.

POSITIONNEMENT
Premium, crédible, éditorial, aide à la décision. PAS un blog voyage, PAS une ferme à
liens d'affiliation, PAS un dashboard géopolitique anxiogène, PAS une AI startup générique.

AMBIANCE (à affiner avec les références que je te fournis)
Dark premium, identité noir/rouge, haut contraste, urgence maîtrisée, intelligence
éditoriale, hybride SaaS moderne × travel-risk. Typographies actuelles : Space Mono pour
les titres/données et DM Sans pour le corps. Tu peux proposer de les conserver, de les
ajuster ou de les remplacer si cela améliore la crédibilité et la lisibilité.

ÉVITER
Clutter, trop de cartes, look agence amateur, rouge-alerte partout, look AI startup
générique, design trop ludique, layout saturé d'affiliation, murs de texte, blocs de
données minuscules, overflow mobile.

ÉCRANS À CONCEVOIR
1. Homepage : hero (promesse claire de ce que fait le produit) + module de recherche
   d'opportunité + explication pédagogique du CrisisScore + cadrage confiance/sécurité +
   monétisation discrète. Chiffres honnêtes uniquement.
2. Page résultats / opportunités : destinations classées, cartes de score lisibles,
   « pourquoi cette destination », équilibre risque/opportunité, actions concises.
3. Page détail destination : résumé crise/opportunité, décomposition du score (gauge +
   sous-scores), conseils pratiques, « Travel Pack ». Hiérarchie CTA : primaire =
   comprendre/choisir la destination ; secondaire = réserver vol/hôtel/assurance/
   transfert/activité/eSIM.
4. Travel Pack : un KIT DE PRÉPARATION (pas un bloc pub), groupé en Réservation
   essentielle / Préparation / Protection. CTA visibles mais non agressifs.

NARRATION À RENDRE VISIBLE
Quoi → Pourquoi une crise crée une opportunité → C'est quoi le CrisisScore →
Que faire du résultat → Comment réserver sûr et pratique.

LIVRABLES ATTENDUS
- Direction visuelle (moodboard, palette précise, typographies, principes de contraste).
- Design system : tokens (couleurs, espacements, rayons, ombres), échelle typographique,
  états, composants clés (hero, recherche, carte CrisisScore, carte destination, bloc
  explication risque, Travel Pack groupé, boutons CTA primaire/secondaire, bloc confiance,
  header/footer).
- Maquettes des 4 écrans en DESKTOP et MOBILE (mobile-first).
- Spécification composant par composant, prête à être implémentée par un dev.

CONTRAINTES STRICTES
- Mobile-first, zéro overflow horizontal, actions clés en zone pouce.
- Les CTA affiliés ne doivent pas dominer et doivent ressembler à des outils utiles.
- Tu produis du DESIGN (direction, maquettes, specs), pas du code de production.
- Tu ne définis pas de logique backend ; tu respectes des contrats existants (routes
  d'analyse, route de clic affilié, paiement, SEO) qui ne changeront pas.

MÉTHODE
Utilise les références visuelles fournies avec ce brief. Commence par en extraire les
principes de design, puis propose une direction visuelle et un moodboard. Attends
validation avant de produire les maquettes finales.
```

## 13. Handoff vers Claude Code (implémentation ultérieure)

Quand la direction Claude Design sera validée, l'implémentation par Claude Code devra :
- avancer **un écran / un groupe de composants à la fois** (gate-based) ;
- **préserver les contrats backend** (§10) ;
- **tester chaque route** après modification (tsc, vitest, build, et 302 affiliés par catégorie) ;
- **pas de réécriture massive incontrôlée** ;
- chaque étape sous le framework gates (contrat → inventaire → vérif réelle → handoff), **pas de push/merge sans GO**.

---

*Brief de préparation design. Étape suivante : fournir les références visuelles (§11), puis lancer Claude Design avec le prompt (§12). L'implémentation (Claude Code) ne commence qu'après validation de la direction.*
