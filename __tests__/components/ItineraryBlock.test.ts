import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { isFallbackItinerary } from '@/components/crisis/ItineraryBlock';
import type { ItineraryResult } from '@/types/crisis.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function readSource(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf-8');
}

const BLOCK_PATH = 'components/crisis/ItineraryBlock.tsx';
const GUIDE_PATH = 'components/crisis/GuideItinerarySection.tsx';
const RESULTS_PATH = 'app/results/ResultsContent.tsx';
const ROUTE_PATH = 'app/api/itinerary/route.ts';
const SERVICE_PATH = 'lib/claude/claude.service.ts';

// GUIDE-V1 NO CARDS : le rendu premium (états succès/échec, narrative, PDF, disclaimers)
// vit désormais dans GuideItinerarySection ; ItineraryBlock orchestre statuts + appel.
// Pour les assertions qui portent sur le RENDU premium, on lit les deux fichiers ensemble.
function readPremiumRender(): string {
  return readSource(BLOCK_PATH) + '\n' + readSource(GUIDE_PATH);
}

// ── 1. Présence et structure du composant ─────────────────────────────────────

describe('ItineraryBlock — présence et structure', () => {
  it('le fichier ItineraryBlock.tsx existe', () => {
    expect(existsSync(resolve(process.cwd(), BLOCK_PATH))).toBe(true);
  });

  it('ItineraryBlock est exporté', () => {
    const src = readPremiumRender();
    expect(src).toContain('export function ItineraryBlock');
  });

  it('le composant déclare "use client"', () => {
    const src = readPremiumRender();
    expect(src.trimStart()).toMatch(/^['"]use client['"]/);
  });

  it('le bouton de génération existe avec data-testid', () => {
    const src = readPremiumRender();
    expect(src).toContain('data-testid="itinerary-generate-btn"');
  });

  it('le bloc principal a un data-testid', () => {
    const src = readPremiumRender();
    expect(src).toContain('data-testid="itinerary-block"');
  });

  it('le conteneur racine porte un marqueur de build (preuve in-DOM du code servi)', () => {
    const src = readPremiumRender();
    // Permet de vérifier sur l'écran réel (DevTools / Playwright) quel code est déployé,
    // pour distinguer un bug de rendu d'un build périmé (PREMIUM-GUIDE-001B stabilisation).
    expect(src).toMatch(/data-itinerary-build="guide-v1-no-cards"/);
  });

  it('le résultat a un data-testid', () => {
    const src = readPremiumRender();
    expect(src).toContain('data-testid="itinerary-result"');
  });

  it('safetyDisclaimer a un data-testid', () => {
    const src = readPremiumRender();
    expect(src).toContain('data-testid="itinerary-safety-disclaimer"');
  });

  it('officialSourceReminder a un data-testid', () => {
    const src = readPremiumRender();
    expect(src).toContain('data-testid="itinerary-official-reminder"');
  });

  it('error-401 a un data-testid', () => {
    const src = readPremiumRender();
    expect(src).toContain('data-testid="itinerary-error-401"');
  });

  it('error-402 a un data-testid', () => {
    const src = readPremiumRender();
    expect(src).toContain('data-testid="itinerary-error-402"');
  });

  it('error-generic a un data-testid pour 400/500', () => {
    const src = readPremiumRender();
    expect(src).toContain('data-testid="itinerary-error-generic"');
  });
});

// ── 2. Comportement premium / auth dans le code source ───────────────────────

describe('ItineraryBlock — gestion auth et premium', () => {
  it('la génération ne se déclenche qu\'au clic (pas au montage)', () => {
    const src = readPremiumRender();
    // useEffect ne doit pas appeler generate()
    // Stratégie : si useEffect est absent → OK. Si présent, il ne doit pas contenir generate()
    if (!src.includes('useEffect')) return; // pas de useEffect du tout = OK
    const afterUseEffect = src.slice(src.indexOf('useEffect'));
    // Le premier useEffect ne doit pas contenir generate()
    const firstBlock = afterUseEffect.slice(0, afterUseEffect.indexOf('}, ['));
    expect(firstBlock).not.toContain('generate()');
  });

  it('aucun appel automatique à /api/itinerary sans clic', () => {
    const src = readPremiumRender();
    // La seule façon d'appeler /api/itinerary est via la fonction generate()
    // qui est déclenchée uniquement par un onClick — pas par useEffect
    // On vérifie simplement qu'il n'y a pas de useEffect dans le composant
    // (le composant n'en a pas besoin et ne doit pas en avoir)
    expect(src).not.toContain('useEffect');
  });

  it('le statut initial est "idle"', () => {
    const src = readPremiumRender();
    expect(src).toContain("useState<ItineraryStatus>('idle')");
  });

  it('le message 402 pointe vers /pricing', () => {
    const src = readPremiumRender();
    expect(src).toContain('href="/pricing"');
    expect(src).toContain('error_402');
  });

  it('le message 401 mentionne la connexion', () => {
    const src = readPremiumRender();
    expect(src).toContain('error_401');
    expect(src).toContain('Connexion requise');
  });

  it('le bouton 401 ouvre AuthModal (pas de lien mort /login) et ne rappelle pas generate()', () => {
    const src = readPremiumRender();
    // PREMIUM-FLOW-001A : plus aucun lien mort vers /login (page inexistante).
    expect(src).not.toContain('href="/login"');
    // Le CTA 401 ouvre la modale d'auth locale, qui ramène l'utilisateur ici après login.
    expect(src).toContain('data-testid="itinerary-login-btn"');
    expect(src).toContain('setShowAuth(true)');
    expect(src).toContain("import { AuthModal }");
    // Dans le bloc error_401, il ne doit pas y avoir onClick={generate}
    const block401Start = src.indexOf('data-testid="itinerary-error-401"');
    const block401End = src.indexOf('{/* ── Error 402', block401Start);
    const block401 = src.slice(block401Start, block401End);
    expect(block401).not.toContain('onClick={generate}');
    expect(block401).toContain('AuthModal');
  });

  it('le message 500/400 permet de réessayer', () => {
    const src = readPremiumRender();
    expect(src).toContain('data-testid="itinerary-retry-btn"');
  });

  it('le skeleton affiche un texte de progression', () => {
    const src = readPremiumRender();
    expect(src).toContain('cela peut prendre quelques secondes');
  });

  it('le skeleton ne contient pas de wording trompeur', () => {
    const src = readPremiumRender();
    // Chercher dans la zone skeleton (entre ItinerarySkeleton et la fin de la fonction)
    const skeletonStart = src.indexOf('function ItinerarySkeleton');
    const skeletonEnd = src.indexOf('// ── Main component', skeletonStart);
    const skeleton = src.slice(skeletonStart, skeletonEnd);
    expect(skeleton).not.toContain('secondes exactes');
    expect(skeleton).not.toContain('temps réel');
    expect(skeleton).not.toContain('live');
  });
});

// ── 3. Sécurité discours — wording obligatoire ────────────────────────────────

describe('ItineraryBlock — wording sécurité et confiance', () => {
  it('ne contient pas "sûr garanti"', () => {
    const src = readPremiumRender();
    expect(src).not.toContain('sûr garanti');
    expect(src).not.toContain('garantit la sécurité');
    expect(src).not.toContain('sécurité absolue');
  });

  it('ne prétend pas à des données en temps réel', () => {
    const src = readPremiumRender();
    expect(src).not.toContain('en temps réel');
    expect(src).not.toContain('données live');
  });

  it('contient le wording "indicatif"', () => {
    const src = readPremiumRender();
    expect(src).toContain('indicatif');
  });

  it('contient le wording "sources officielles"', () => {
    const src = readPremiumRender();
    expect(src).toContain('sources officielles');
  });

  it('contient "Données officielles statiques intégrées"', () => {
    const src = readPremiumRender();
    expect(src).toContain('Données officielles statiques intégrées');
  });

  it('le footer note mentionne de vérifier les recommandations locales', () => {
    const src = readPremiumRender();
    expect(src).toContain('recommandations locales');
  });
});

// ── 4. Intégration dans ResultsContent ───────────────────────────────────────

describe('ResultsContent — intégration ItineraryBlock', () => {
  it('ItineraryBlock est importé dans ResultsContent', () => {
    const src = readSource(RESULTS_PATH);
    expect(src).toContain("import { ItineraryBlock }");
    expect(src).toContain('ItineraryBlock');
  });

  it('ItineraryBlock est rendu dans ResultsContent', () => {
    const src = readSource(RESULTS_PATH);
    expect(src).toContain('<ItineraryBlock');
  });

  it('ItineraryBlock est conditionnel sur ranked[0]', () => {
    const src = readSource(RESULTS_PATH);
    expect(src).toContain('ranked[0]');
    // Le bloc itinéraire doit être dans le contexte du data disponible
    const dataBlock = src.slice(src.indexOf('{data && ('), src.lastIndexOf('</>\n        )}'));
    expect(dataBlock).toContain('ItineraryBlock');
  });

  it('countryCode est passé depuis ranked[0].countryCode', () => {
    const src = readSource(RESULTS_PATH);
    expect(src).toContain('ranked[0].countryCode');
  });

  it('countryName est passé depuis ranked[0].country', () => {
    const src = readSource(RESULTS_PATH);
    expect(src).toContain('ranked[0].country');
  });

  it('aucun appel automatique à /api/analyze depuis ItineraryBlock', () => {
    const src = readPremiumRender();
    expect(src).not.toContain('/api/analyze');
  });
});

// ── 5. Isolation backend ──────────────────────────────────────────────────────

describe('ItineraryBlock — isolation backend', () => {
  it('ItineraryBlock n\'importe pas calculateCrisisScore', () => {
    const src = readPremiumRender();
    expect(src).not.toContain('calculateCrisisScore');
    expect(src).not.toContain('crisisScore.service');
  });

  it('ItineraryBlock n\'importe pas checkAndIncrementQuota', () => {
    const src = readPremiumRender();
    expect(src).not.toContain('checkAndIncrementQuota');
    expect(src).not.toContain('analysisQuota');
  });

  it('la route /api/itinerary n\'a pas été modifiée par ITINERARY-003', () => {
    const src = readSource(ROUTE_PATH);
    // La route doit toujours contenir les éléments ITINERARY-002
    expect(src).toContain('getUserWithSubscription');
    expect(src).toContain('status: 401');
    expect(src).toContain('status: 402');
    expect(src).toContain('premiumOnly: true');
    expect(src).toContain("officialDataMode: 'static'");
  });

  it('generateItinerary dans le service n\'a pas été modifié — signature préservée', () => {
    const src = readSource(SERVICE_PATH);
    expect(src).toContain('export async function generateItinerary');
    expect(src).not.toContain('calculateCrisisScore');
  });
});

// ── 6. Non-régression fichiers critiques ─────────────────────────────────────

describe('non-régression ITINERARY-003 — fichiers non touchés', () => {
  const UNTOUCHED = [
    'lib/services/scoring/crisisScore.service.ts',
    'lib/auth/analysisQuota.ts',
    'app/api/analyze/route.ts',
    'app/destination/[country]/page.tsx',
  ];

  for (const f of UNTOUCHED) {
    it(`${f} n'importe pas ItineraryBlock`, () => {
      const path = resolve(process.cwd(), f);
      if (!existsSync(path)) return;
      expect(readFileSync(path, 'utf-8')).not.toContain('ItineraryBlock');
    });
  }

  it('TARGET_COUNTRIES absent de ItineraryBlock', () => {
    expect(readPremiumRender()).not.toContain('TARGET_COUNTRIES');
  });

  it('CANDIDATE_CAP absent de ItineraryBlock', () => {
    expect(readPremiumRender()).not.toContain('CANDIDATE_CAP');
  });
});

// ── 7. PDF export button — PDF-UX-003 ────────────────────────────────────────

const PDF_BTN_PATH = 'components/crisis/PdfExportButton.tsx';

describe('ItineraryBlock — bouton export PDF (PDF-UX-003)', () => {
  it('PdfExportButton est importé dans la section de rendu premium', () => {
    const src = readPremiumRender();
    expect(src).toContain("import { PdfExportButton }");
    expect(src).toContain('PdfExportButton');
  });

  it('le bouton PDF n\'est rendu que dans l\'état succès (data-testid="itinerary-pdf-export")', () => {
    const src = readSource(GUIDE_PATH);
    expect(src).toContain('data-testid="itinerary-pdf-export"');
    // Le PDF est rendu dans l'état SUCCÈS (après l'early-return du repli).
    const successStart = src.indexOf('État SUCCÈS');
    const pdfIdx = src.indexOf('data-testid="itinerary-pdf-export"');
    expect(pdfIdx).toBeGreaterThan(successStart);
  });

  it('le bouton PDF est absent de l\'état repli', () => {
    const src = readSource(GUIDE_PATH);
    const start = src.indexOf('data-testid="itinerary-result-fallback"');
    const end = src.indexOf('État SUCCÈS');
    const fallbackBlock = src.slice(start, end);
    expect(fallbackBlock).not.toContain('itinerary-pdf-export');
  });

  it('PdfExportButton reçoit l\'itinéraire généré', () => {
    const src = readSource(GUIDE_PATH);
    expect(src).toContain('itinerary={itinerary}');
  });

  it('PdfExportButton reçoit countryCode (via les props pdf)', () => {
    const src = readSource(GUIDE_PATH);
    expect(src).toContain('countryCode={pdf.countryCode}');
  });

  it('PdfExportButton reçoit un profile avec budget/travelType/from/to', () => {
    const src = readSource(BLOCK_PATH);
    // ItineraryBlock construit l'objet profile passé à GuideItinerarySection.
    const pdfBlock = src.slice(src.indexOf('<GuideItinerarySection'));
    expect(pdfBlock).toContain('budget');
    expect(pdfBlock).toContain('travelType');
    expect(pdfBlock).toContain('from');
    expect(pdfBlock).toContain('to');
  });

  it('le bouton PDF n\'appelle pas /api/itinerary', () => {
    const src = readSource(PDF_BTN_PATH);
    expect(src).not.toContain('/api/itinerary');
  });

  it('le bouton PDF n\'appelle pas /api/analyze', () => {
    const src = readSource(PDF_BTN_PATH);
    expect(src).not.toContain('/api/analyze');
  });

  it('le bouton PDF appelle /api/export-pdf/[countryCode]', () => {
    const src = readSource(PDF_BTN_PATH);
    expect(src).toContain('/api/export-pdf/${countryCode}');
  });

  it('le payload inclut itinerary quand fourni', () => {
    const src = readSource(PDF_BTN_PATH);
    // Vérifie la présence du guard conditionnel, indépendamment de l'alignement
    expect(src).toContain('if (itinerary)');
    expect(src).toContain('body.itinerary');
  });

  it('le bouton PDF affiche un état loading pendant l\'export', () => {
    const src = readSource(PDF_BTN_PATH);
    expect(src).toContain("status === 'loading'");
    expect(src).toContain('Génération…');
  });

  it('le bouton PDF gère l\'erreur 401', () => {
    const src = readSource(PDF_BTN_PATH);
    expect(src).toContain('res.status === 401');
    expect(src).toContain('error_401');
    expect(src).toContain('data-testid="pdf-export-error-401"');
  });

  it('le bouton PDF gère l\'erreur 402 avec CTA /pricing', () => {
    const src = readSource(PDF_BTN_PATH);
    expect(src).toContain('res.status === 402');
    expect(src).toContain('error_402');
    expect(src).toContain('data-testid="pdf-export-error-402"');
    expect(src).toContain('href="/pricing"');
  });

  it('le bouton PDF gère l\'erreur générique (400/500)', () => {
    const src = readSource(PDF_BTN_PATH);
    expect(src).toContain("!res.ok");
    expect(src).toContain("status === 'error'");
  });

  it('le bouton PDF ne relance pas generate() et n\'importe pas generateItinerary', () => {
    const src = readSource(PDF_BTN_PATH);
    expect(src).not.toContain('generateItinerary');
    expect(src).not.toContain('generate()');
  });

  it('le wording du bouton PDF ne contient pas "PDF officiel"', () => {
    const src = readSource(PDF_BTN_PATH);
    expect(src).not.toContain('PDF officiel');
    expect(src).not.toContain('temps réel');
    expect(src).not.toContain('live');
    expect(src).not.toContain('sécurité garantie');
  });
});

// ── 7b. Non-régression backend PDF-UX-003 ────────────────────────────────────

describe('non-régression PDF-UX-003 — backend non modifié', () => {
  const PDF_ROUTE_PATH = 'app/api/export-pdf/[code]/route.ts';

  it('la route export-pdf existe', () => {
    expect(existsSync(resolve(process.cwd(), PDF_ROUTE_PATH))).toBe(true);
  });

  it('la route export-pdf contient getUserWithSubscription (auth)', () => {
    const src = readSource(PDF_ROUTE_PATH);
    expect(src).toContain('getUserWithSubscription');
  });

  it('la route export-pdf contient les statuts 401 et 402', () => {
    const src = readSource(PDF_ROUTE_PATH);
    expect(src).toContain('401');
    expect(src).toContain('402');
  });

  it('la route export-pdf accepte un payload itinerary optionnel', () => {
    const src = readSource(PDF_ROUTE_PATH);
    expect(src).toContain('itinerarySchema');
    expect(src).toMatch(/itinerary:\s+itinerarySchema/);
  });

  it('la route /api/itinerary n\'a pas été touchée par PDF-UX-003', () => {
    const src = readSource(ROUTE_PATH);
    expect(src).toContain('getUserWithSubscription');
    expect(src).toContain("premiumOnly: true");
    expect(src).not.toContain('export-pdf');
  });
});

// ── 8. Structure données transmises à /api/itinerary ─────────────────────────

describe('ItineraryBlock — données transmises à /api/itinerary', () => {
  it('buildRequest est défini et utilise countryCode', () => {
    const src = readPremiumRender();
    expect(src).toContain('function buildRequest');
    expect(src).toContain('countryCode: props.countryCode');
  });

  it('buildRequest utilise countryName', () => {
    const src = readPremiumRender();
    expect(src).toContain('countryName: props.countryName');
  });

  it('buildRequest n\'invente pas de données manquantes', () => {
    const src = readPremiumRender();
    // Le budget est optionnel — on ne lui donne pas de valeur par défaut inventée
    expect(src).toContain('if (props.budget && props.budget > 0) req.budget = props.budget');
  });

  it('riskContext est passé en mode static uniquement', () => {
    const src = readPremiumRender();
    expect(src).toContain("source: 'static'");
    expect(src).not.toContain("source: 'live'");
  });
});

// ── 9. PREMIUM-GUIDE-001B — itinéraire narratif (rendu guide) ────────────────

describe('ItineraryBlock — rendu narratif prioritaire (PREMIUM-GUIDE-001B)', () => {
  it('importe NarrativeRenderer pour rendre le texte de guide en paragraphes aérés', () => {
    const src = readPremiumRender();
    expect(src).toContain("import { NarrativeRenderer }");
  });

  it('rend narrativeText via NarrativeRenderer (data-testid="itinerary-narrative")', () => {
    const src = readPremiumRender();
    expect(src).toContain('data-testid="itinerary-narrative"');
    expect(src).toContain('<NarrativeRenderer narrative={itinerary.narrativeText');
  });

  it('GUIDE-V1 NO CARDS : aucune carte jour/jour dans le rendu premium', () => {
    const src = readPremiumRender();
    // Plus de DayCard, plus de bloc <details> jour/jour, plus de rendu itinerary-days.
    expect(src).not.toContain('<DayCard');
    expect(src).not.toContain('function DayCard');
    expect(src).not.toContain('data-testid="itinerary-days-details"');
    expect(src).not.toContain('data-testid="itinerary-days"');
    expect(src).not.toContain('Voir le détail jour par jour');
  });

  it('GUIDE-V1 NO CARDS : aucun rendu de slot Matin/Après-midi/Soir', () => {
    const src = readPremiumRender();
    // Ces labels de slots n'existaient que dans DayCard (supprimé). On vérifie qu'aucun
    // n'est rendu (objet { label: 'Matin'... } ou JSX). La détection legacy peut mentionner
    // les marqueurs textuels, mais pas de slot rendu.
    expect(src).not.toMatch(/label: 'Matin'/);
    expect(src).not.toMatch(/label: 'Après-midi'/);
    expect(src).not.toContain("day.morning");
    expect(src).not.toContain("day.afternoon");
    expect(src).not.toContain("day.evening");
  });

  it('GUIDE-V1 : le rendu narratif est gardé par la présence de narrativeText', () => {
    const src = readPremiumRender();
    // La section ne s'atteint qu'en succès (isFallbackItinerary=false ⇒ narrativeText non vide).
    expect(src).toContain('isFallbackItinerary');
    expect(src).toContain('NarrativeRenderer');
  });

  it('les disclaimers restent rendus dans le rendu succès (toujours visibles)', () => {
    const src = readPremiumRender();
    const narrativeIdx = src.indexOf('data-testid="itinerary-narrative"');
    const safetyIdx = src.lastIndexOf('data-testid="itinerary-safety-disclaimer"');
    const officialIdx = src.lastIndexOf('data-testid="itinerary-official-reminder"');
    expect(narrativeIdx).toBeGreaterThan(-1);
    expect(safetyIdx).toBeGreaterThan(-1);
    expect(officialIdx).toBeGreaterThan(-1);
  });

  it('aucune redirection vers /results n\'est réintroduite', () => {
    const src = readPremiumRender();
    expect(src).not.toContain('/results');
    expect(src).not.toContain('router.push');
  });

  it('countryCode et countryName restent transmis (pas de perte de contexte pays)', () => {
    const src = readPremiumRender();
    expect(src).toContain('countryCode: props.countryCode');
    expect(src).toContain('countryName: props.countryName');
  });

  it('le wording sécurité du narratif ne promet pas de sécurité absolue', () => {
    const src = readPremiumRender();
    expect(src).not.toContain('sécurité garantie');
    expect(src).not.toContain('sécurité absolue');
  });
});

// ── 9b. PREMIUM-GUIDE-001B-timeout — repli honnête (pas de fausses cartes) ────────

describe('ItineraryBlock — repli honnête quand la génération échoue (PREMIUM-GUIDE-001B-timeout)', () => {
  it('un bloc de repli dédié existe (data-testid="itinerary-result-fallback")', () => {
    const src = readPremiumRender();
    expect(src).toContain('data-testid="itinerary-result-fallback"');
  });

  it('le repli est décidé par isFallbackItinerary (flag OU narrativeText absent OU legacy)', () => {
    const src = readSource(GUIDE_PATH);
    // GuideItinerarySection branche sur isFallbackItinerary(itinerary) en tout début de rendu.
    expect(src).toMatch(/if \(isFallbackItinerary\(itinerary\)\)/);
  });

  it('les deux états sont exclusifs : early-return du repli avant le rendu succès', () => {
    const src = readSource(GUIDE_PATH);
    const fallbackIdx = src.indexOf('data-testid="itinerary-result-fallback"');
    const successIdx = src.indexOf('data-testid="itinerary-result"', src.indexOf('État SUCCÈS'));
    // Le repli (early return) apparaît avant le rendu succès dans le fichier.
    expect(fallbackIdx).toBeGreaterThan(-1);
    expect(successIdx).toBeGreaterThan(fallbackIdx);
  });

  it('le repli affiche un message honnête (pas un faux itinéraire)', () => {
    const src = readSource(GUIDE_PATH);
    const start = src.indexOf('data-testid="itinerary-result-fallback"');
    const end = src.indexOf('État SUCCÈS');
    const fallbackBlock = src.slice(start, end > start ? end : start + 2000);
    expect(fallbackBlock).toMatch(/trop de temps|n['’]a pas (pu|abouti)/i);
    expect(fallbackBlock).not.toContain('<DayCard');
    expect(fallbackBlock).not.toContain('itinerary-narrative');
  });

  it('le repli offre un bouton Réessayer qui relance onRetry', () => {
    const src = readSource(GUIDE_PATH);
    const start = src.indexOf('data-testid="itinerary-result-fallback"');
    const end = src.indexOf('État SUCCÈS');
    const fallbackBlock = src.slice(start, end > start ? end : start + 2000);
    expect(fallbackBlock).toContain('data-testid="itinerary-fallback-retry"');
    expect(fallbackBlock).toContain('onClick={onRetry}');
  });

  it('les disclaimers restent visibles dans le repli (safety + official)', () => {
    const src = readSource(GUIDE_PATH);
    const start = src.indexOf('data-testid="itinerary-result-fallback"');
    const end = src.indexOf('État SUCCÈS');
    const fallbackBlock = src.slice(start, end > start ? end : start + 2000);
    // Le repli rend <Disclaimers/>, qui contient les deux testids.
    expect(fallbackBlock).toContain('<Disclaimers');
  });

  it('le rendu (JSX) ne contient jamais le wording trompeur "À planifier selon vos préférences"', () => {
    const src = readSource(GUIDE_PATH);
    // Ce texte n'apparaît QUE dans LEGACY_FALLBACK_MARKERS (constante de détection),
    // jamais dans le JSX rendu. On vérifie qu'il n'apparaît pas après la fin de la constante.
    const afterMarkers = src.slice(src.indexOf('] as const;'));
    expect(afterMarkers).not.toContain('À planifier selon vos préférences');
  });
});

// ── 10. PREMIUM-GUIDE-001B — PremiumActions toujours in-place et ciblé pays ──

describe('PremiumActions — itinéraire toujours in-place ciblé pays (non-régression 001B)', () => {
  const PREMIUM_ACTIONS_PATH = 'components/crisis/PremiumActions.tsx';

  it('PremiumActions monte ItineraryBlock in-place avec le pays de la fiche', () => {
    const src = readSource(PREMIUM_ACTIONS_PATH);
    expect(src).toContain('<ItineraryBlock');
    expect(src).toContain('countryCode={countryCode}');
    expect(src).toContain('countryName={countryName}');
  });

  it('PremiumActions ne redirige pas vers /results', () => {
    const src = readSource(PREMIUM_ACTIONS_PATH);
    expect(src).not.toContain('/results');
    expect(src).not.toContain('router.push');
  });
});

// ── 11. PREMIUM-GUIDE-001B stabilisation — détection legacy fallback (helper PUR) ──

function makeDay(over: Partial<ItineraryResult['days'][number]> = {}): ItineraryResult['days'][number] {
  return {
    day: 1, title: 'Jour 1', summary: 's', morning: 'm', afternoon: 'a',
    evening: 'e', estimatedBudget: '~80€', safetyNote: 'ok', ...over,
  };
}

function makeItinerary(over: Partial<ItineraryResult> = {}): ItineraryResult {
  return {
    countryCode: 'JP', countryName: 'Japon', durationDays: 3,
    budget: { amount: 1500, currency: 'EUR', level: 'medium' },
    // GUIDE-V1 : un vrai parcours = un narrativeText non vide. days reste vide par défaut.
    narrativeText: '**Le fil conducteur**\n\nPour 3 jours, je te conseille de rester centré sur une base.',
    days: [],
    globalAdvice: [],
    safetyDisclaimer: 'disclaimer', officialSourceReminder: 'rappel',
    generatedAt: new Date().toISOString(), ...over,
  };
}

describe('isFallbackItinerary — détection échec (GUIDE-V1 NO CARDS)', () => {
  it('vrai parcours (narrativeText présent, flag absent) → false', () => {
    expect(isFallbackItinerary(makeItinerary())).toBe(false);
  });

  it('flag isFallback=true → true', () => {
    expect(isFallbackItinerary(makeItinerary({ isFallback: true }))).toBe(true);
  });

  it('narrativeText absent → true (rien de premium à montrer)', () => {
    expect(isFallbackItinerary(makeItinerary({ narrativeText: undefined }))).toBe(true);
  });

  it('narrativeText vide/whitespace → true', () => {
    expect(isFallbackItinerary(makeItinerary({ narrativeText: '   ' }))).toBe(true);
  });

  it('legacy avec days "À planifier" mais narrativeText présent → true (défense en profondeur)', () => {
    const legacy = makeItinerary({
      days: [makeDay({ morning: 'À planifier selon vos préférences.' })],
    });
    expect(isFallbackItinerary(legacy)).toBe(true);
  });

  it('legacy "Itinéraire temporairement indisponible" dans summary → true', () => {
    const legacy = makeItinerary({
      days: [makeDay({ summary: 'Itinéraire temporairement indisponible. Consultez un guide.' })],
    });
    expect(isFallbackItinerary(legacy)).toBe(true);
  });

  it('legacy "Estimation non disponible" → true', () => {
    const legacy = makeItinerary({
      days: [makeDay({ estimatedBudget: 'Estimation non disponible.' })],
    });
    expect(isFallbackItinerary(legacy)).toBe(true);
  });

  it('null/undefined → true (pas de crash, traité comme échec)', () => {
    expect(isFallbackItinerary(null)).toBe(true);
    expect(isFallbackItinerary(undefined)).toBe(true);
  });
});
