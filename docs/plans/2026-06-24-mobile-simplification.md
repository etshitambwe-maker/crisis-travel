# Refonte mobile « assistant simple » — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rendre l'expérience mobile de Crisis Travel intuitive et aérée — home minimale à un seul bouton, formulaire transformé en assistant « une question par écran » avec avancement auto au tap, et tarifs dégraissés — sans toucher la logique d'analyse.

**Architecture:** Refonte purement présentationnelle. On réécrit la couche d'UI de `SmartSearchHub.tsx` en machine à états d'écrans (un `step` courant, navigation auto au tap), tout en réutilisant à l'identique l'état `DiscoveryState`, `BUDGET_MAP`, `DURATION_MAP`, le calcul de durée depuis les dates, les locks `acquireAnalyzeLock`/`releaseAnalyzeLock` et la construction d'URL `/results?...`. La home (`app/page.tsx`) est allégée : hero court + un CTA, bloc premium réduit à 3 bénéfices repliables. Aucune route ni API modifiée.

**Tech Stack:** Next.js 14 App Router, React (client components), styles inline via variables CSS `--ctv3-*`, Vitest (tests source-assertion), vérification visuelle par captures Playwright en viewport mobile.

**Contraintes invariantes (ne JAMAIS casser) :**
- L'URL finale `/results?budget=&duration=&travelType=&mode=&priority=&airport=` + `from`/`to` optionnels reste identique.
- `BUDGET_MAP`, `DURATION_MAP`, le mapping `priority → mode` (`securite→bunker`, `budget→budget_crisis`, sinon `standard`), le calcul `duration` depuis les dates, et les locks restent inchangés.
- Seuil « minimum 2 critères sur 4 pour lancer » conservé.
- Design system inchangé (couleurs/typos `--ctv3-*`).
- Tests existants verts : `__tests__/components/SmartSearchHub.dates.test.ts` et `PricingPage.test.ts` ne doivent pas régresser.

---

## Notes pour l'exécutant

- **Style de test du projet :** source-assertion. Les tests lisent le fichier `.tsx` avec `readFileSync` et vérifient des motifs (`expect(src).toMatch(...)`). PAS de jsdom/render. Suivre ce style.
- **Commandes :**
  - Tests : `npm test` (vitest run). Un seul fichier : `npx vitest run __tests__/components/<file>.test.ts`.
  - Types : `npm run type-check`.
  - Build : `npm run build`.
  - Dev : `npm run dev` (port 3000).
- **Le projet n'est pas un dépôt git.** Les étapes « Commit » sont remplacées par un point de contrôle : lancer `npm test && npm run type-check` et confirmer le vert avant de passer à la tâche suivante. Ne PAS exécuter `git`.
- **Vérification visuelle** (skill `superpowers:verification-before-completion` + `webapp-testing`) : à la fin, lancer `npm run dev`, ouvrir en viewport 390×844 (mobile), capturer home + chaque écran de l'assistant + tarifs, et inspecter les images.

---

## Task 1 : Geler les invariants de la logique d'analyse (filet de sécurité)

But : écrire des tests source-assertion qui échoueront si la refonte casse la
construction d'URL ou les maps. On les écrit AVANT de toucher au composant.

**Files:**
- Create: `__tests__/components/SmartSearchHub.assistant.test.ts`

**Step 1 : Écrire le test des invariants**

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(
  resolve(process.cwd(), 'components/crisis/SmartSearchHub.tsx'),
  'utf-8',
);

describe('MOBILE-ASSISTANT-001 — invariants logique d\'analyse préservés', () => {
  it('construit toujours l\'URL /results avec les bons paramètres', () => {
    expect(src).toContain('/results?');
    expect(src).toMatch(/budget:\s*String/);
    expect(src).toMatch(/duration:\s*String/);
    expect(src).toContain('travelType');
    expect(src).toContain('priority');
    expect(src).toContain('airport');
  });

  it('conserve BUDGET_MAP et DURATION_MAP', () => {
    expect(src).toContain('BUDGET_MAP');
    expect(src).toContain('DURATION_MAP');
  });

  it('conserve le mapping priority → mode', () => {
    expect(src).toMatch(/securite'?\s*\?\s*'bunker'/);
    expect(src).toMatch(/budget'?\s*\?\s*'budget_crisis'/);
  });

  it('conserve les locks d\'analyse', () => {
    expect(src).toContain('acquireAnalyzeLock');
    expect(src).toContain('releaseAnalyzeLock');
  });

  it('conserve le calcul de durée depuis les dates', () => {
    expect(src).toMatch(/getTime\(\).*86400000|86400000/);
  });

  it('conserve le seuil minimum de 2 critères', () => {
    // Le lancement reste conditionné à completed >= 2
    expect(src).toMatch(/completed\s*[<>]=?\s*2|>=\s*2/);
  });
});
```

**Step 2 : Lancer pour vérifier que ça passe sur le code ACTUEL**

Run: `npx vitest run __tests__/components/SmartSearchHub.assistant.test.ts`
Expected: PASS (6 tests verts) — ces invariants existent déjà dans le code actuel.

> Si un test échoue ici, c'est que j'ai mal lu le code source : corriger le test
> pour matcher le code existant AVANT de continuer (le but est de geler l'existant,
> pas d'en inventer).

**Step 3 : Point de contrôle**

Run: `npm test`
Expected: toute la suite verte (les nouveaux tests inclus).

---

## Task 2 : Réécrire SmartSearchHub en assistant « une question par écran »

But : remplacer l'affichage monolithique (tout empilé) par une machine à états
d'écrans. Réutiliser l'état et la logique existants ; ne changer QUE le rendu.

**Files:**
- Modify: `components/crisis/SmartSearchHub.tsx`

**Step 1 : Définir la liste d'écrans et l'état de navigation**

Dans le composant principal (`SmartSearchHub` ou un nouveau `DiscoveryAssistant`),
introduire :

```typescript
type StepId = 'airport' | 'priority' | 'travelType' | 'duration' | 'budget';
const STEPS: StepId[] = ['airport', 'priority', 'travelType', 'duration', 'budget'];
const [stepIndex, setStepIndex] = useState(0);
```

Conserver tels quels : `state` (`DiscoveryState`), `airport`, `dateDepart`,
`dateRetour`, `dateError`, `handleGenerate`, `BUDGET_MAP`, `DURATION_MAP`.

**Step 2 : Avancement auto au tap**

Un helper qui enregistre le choix ET avance :

```typescript
function choose<K extends ChoiceKey>(key: K, val: string) {
  setState((s) => ({ ...s, [key]: val as never }));
  // avancement auto au tap (~300ms pour laisser voir la sélection)
  setTimeout(() => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1)), 300);
}
```

Pour l'écran `airport` (sélection d'aéroport), choisir un aéroport avance pareil.

**Step 3 : Rendu d'UN seul écran à la fois**

Le composant rend uniquement l'écran `STEPS[stepIndex]` :
- Un titre court par écran (question), gros boutons (min-height 56px), réutilisant
  `PRIORITY_OPTIONS`, `TRAVEL_TYPE_OPTIONS`, `DURATION_OPTIONS`, `BUDGET_OPTIONS`,
  `FRENCH_AIRPORTS` déjà définis.
- En-tête : barre de progression fine + libellé `{stepIndex+1}/{STEPS.length}`.
- Bouton retour `←` (désactivé sur le 1er écran) : `setStepIndex(i => Math.max(0, i-1))`.
- Bouton « Passer » sur les écrans non essentiels (`duration`, `budget`) qui avance
  sans rien sélectionner.

Questions (textes courts) :
- airport : « D'où pars-tu ? »
- priority : « Qu'est-ce qui compte le plus ? »
- travelType : « Tu voyages comment ? »
- duration : « Combien de temps ? »
- budget : « Quel budget ? »

**Step 4 : Écran de lancement**

Quand `stepIndex === STEPS.length - 1` ET qu'un choix est fait sur le dernier écran,
OU via un bouton « Voir mes destinations → » présent dès que `completed >= 2` :
appeler le `handleGenerate` existant **inchangé**. Le bouton garde ses états
(désactivé si `completed < 2 || loading || dateError`).

Conserver la microcopy « 3 analyses gratuites · sans engagement » sous le bouton.

**Step 5 : Mode « Explorer une région » en option secondaire**

Retirer la `TabBar` de la vue principale. Le mode par défaut est l'assistant
découverte. Exposer « Explorer une région » via un petit lien discret en bas de
l'assistant qui bascule vers `RegionTab` (conservé tel quel). Ne PAS supprimer
`RegionTab` ni `handleRegionAnalyze`.

**Step 6 : Retirer de la vue le bloc « microcopy positionnement » long et le récap
« Votre analyse »**

Le paragraphe « Pas toutes les destinations… » et le bloc « Votre analyse »
(lecture seule) sortent de l'assistant principal. La microcopy de positionnement
peut se réduire à une phrase sur l'écran d'accueil de l'assistant (premier écran)
ou être supprimée — décision : la réduire à une ligne sur le 1er écran.

**Step 7 : Vérifier les invariants + types**

Run: `npx vitest run __tests__/components/SmartSearchHub.assistant.test.ts __tests__/components/SmartSearchHub.dates.test.ts`
Expected: PASS (les deux fichiers verts — la logique est préservée).

Run: `npm run type-check`
Expected: aucune erreur.

**Step 8 : Point de contrôle**

Run: `npm test`
Expected: suite complète verte.

---

## Task 3 : Alléger la home (app/page.tsx)

But : la home n'empile plus hero long + HowItWorks + formulaire + premium long.
Elle présente un hero court avec UN CTA vers l'assistant.

**Files:**
- Modify: `app/page.tsx`

**Step 1 : Hero court**

Réduire le hero :
- Garder le titre « Le monde change. Vos destinations aussi. » (identité).
- Réduire le sous-paragraphe à UNE phrase courte.
- Sous le titre, ajouter UN gros CTA `<Link href="#analyse">` (ou ancre vers le
  formulaire) « TROUVER MA DESTINATION → » en bouton rouge plein largeur, style
  cohérent `--ctv3-red`, padding ~16px, min-height 56px.
- Sous le CTA : « 3 analyses gratuites · sans engagement ».
- La ligne « 65 destinations couvertes · jusqu'à 18 analysées… » devient discrète
  ou passe sous le pli (garder, mais petite).

**Step 2 : « Comment ça marche » sort de la vue principale**

Remplacer la section `<HowItWorks />` toujours visible par un lien discret
« Comment ça marche ? » qui mène à la section (repliée) ou à une ancre plus bas.
Ne PAS supprimer le composant `HowItWorks`. Décision : déplacer `HowItWorks` tout
en bas de la page (après les exemples), précédé d'un titre, et mettre un lien
d'ancre discret dans le hero.

**Step 3 : Vérifier le rendu serveur (pas d'erreur)**

Run: `npm run build`
Expected: build OK (page `/` compile sans erreur).

**Step 4 : Point de contrôle**

Run: `npm test && npm run type-check`
Expected: vert.

---

## Task 4 : Dégraisser le bloc tarifs

But : les 3 cartes d'offre passent de 4–6 lignes à 3 bénéfices visibles max, reste
repliable. Premium reste « populaire ».

**Files:**
- Modify: `app/page.tsx` (constante `HOME_PLANS` + rendu des features)
- Vérifier ensuite : `__tests__/components/PricingPage.test.ts` (ne pas régresser)

**Step 1 : Limiter les features visibles**

Dans le rendu des cartes (`plan.features.map`), n'afficher que les 3 premières par
défaut. Ajouter un `<details>`/`<summary>` natif « Voir tout » (style discret,
mono, couleur `--ctv3-faint`) qui révèle le reste. Garder TOUTES les features dans
la donnée `HOME_PLANS` (on ne supprime pas d'information, on la replie).

Implémentation simple sans état React (la home est un Server Component) : utiliser
`<details>` HTML natif.

```tsx
{plan.features.slice(0, 3).map(/* … rendu existant … */)}
{plan.features.length > 3 && (
  <details style={{ marginTop: 4 }}>
    <summary style={{
      cursor: 'pointer', fontFamily: 'var(--ctv3-mono)', fontSize: 11,
      letterSpacing: '0.08em', color: 'var(--ctv3-faint)', listStyle: 'none',
    }}>
      + {plan.features.length - 3} de plus
    </summary>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 7 }}>
      {plan.features.slice(3).map(/* … même rendu … */)}
    </div>
  </details>
)}
```

> Note : factoriser le rendu d'une feature (ligne avec puce `+`) dans un petit
> helper local pour éviter la duplication entre les 3 premières et le reste (DRY).

**Step 2 : Vérifier que le test pricing ne régresse pas**

Run: `npx vitest run __tests__/components/PricingPage.test.ts`
Expected: PASS. Si ce test asserte la présence d'un libellé d'offre déplacé dans
`<details>`, il reste vrai (le texte est toujours dans le DOM source). Si un test
casse, lire ce qu'il vérifie et ajuster le rendu pour conserver l'info, pas
contourner le test.

**Step 3 : Build + point de contrôle**

Run: `npm run build && npm test && npm run type-check`
Expected: tout vert.

---

## Task 5 : Vérification visuelle réelle (obligatoire avant de déclarer terminé)

> REQUIRED SUB-SKILL: superpowers:verification-before-completion + webapp-testing.
> Pas de « c'est fait » sans captures inspectées.

**Step 1 : Lancer le serveur**

Run (background): `npm run dev`
Attendre que le port 3000 réponde.

**Step 2 : Capturer en viewport mobile (390×844)**

Via le toolkit webapp-testing (Playwright), capturer :
1. `/` (home) — vérifier : hero court + 1 gros bouton visible sans scroll, pas de
   pavé de texte.
2. L'assistant écran 1 (après clic sur le CTA / ancre) — une seule question visible.
3. Avancer au tap : capturer 2–3 écrans suivants — confirmer qu'un seul écran
   s'affiche à la fois, gros boutons, barre de progression « n/5 ».
4. Le bloc tarifs — 3 bénéfices visibles, « voir tout » replié.

**Step 3 : Inspecter visuellement chaque capture**

Pour chaque image, vérifier explicitement :
- Aéré : pas plus d'un titre + des choix par écran.
- Boutons grands et distincts (le CTA principal saute aux yeux).
- Pas de texte minuscule illisible.
- L'avancement auto au tap fonctionne (l'écran change sans bouton « Suivant »).

**Step 4 : Rapport**

Présenter les captures à l'utilisateur avec un court compte-rendu de ce qui a
changé, AVANT de considérer la tâche terminée. Si un écran est encore chargé,
itérer.

---

## Definition of Done

- [ ] `npm test` vert (invariants logique + dates + pricing préservés).
- [ ] `npm run type-check` sans erreur.
- [ ] `npm run build` OK.
- [ ] Home : hero court + 1 CTA dominant, « comment ça marche » sorti de la vue principale.
- [ ] Assistant : une question par écran, avancement auto au tap, barre de progression, retour, « passer ».
- [ ] Logique d'analyse inchangée (URL `/results`, maps, locks, seuil 2/4).
- [ ] Tarifs : 3 bénéfices visibles + repliable, Premium « populaire ».
- [ ] Captures mobiles réelles prises et inspectées, présentées à l'utilisateur.
