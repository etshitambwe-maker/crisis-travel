import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { CrisisScore, ItineraryResult } from '@/types/crisis.types';

// Styles PDF
const styles = StyleSheet.create({
  page: {
    backgroundColor: '#0a0a0f',
    color: '#e8e8e8',
    fontFamily: 'Helvetica',
    padding: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2e',
  },
  brandName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#ff4d2e',
    letterSpacing: 2,
  },
  brandMeta: {
    fontSize: 8,
    color: '#6b7280',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 20,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2e',
  },
  countryHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#13131a',
    borderRadius: 8,
  },
  countryName: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: '#f0f0f5',
    letterSpacing: -0.5,
  },
  scoreCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  scoreLabel: {
    fontSize: 7,
    color: '#6b7280',
    textAlign: 'center',
    letterSpacing: 1,
  },
  subScoreGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  subScoreCard: {
    flex: 1,
    backgroundColor: '#13131a',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1e1e2e',
  },
  subScoreLabel: {
    fontSize: 7,
    color: '#6b7280',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  subScoreValue: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
  },
  subScoreWeight: {
    fontSize: 7,
    color: '#6b7280',
    marginTop: 2,
  },
  narrativeText: {
    fontSize: 11,
    color: '#c8c8da',
    lineHeight: 1.6,
    backgroundColor: '#13131a',
    padding: 14,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#ff4d2e',
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: '8 12',
    backgroundColor: '#13131a',
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1e1e2e',
  },
  budgetLabel: {
    flex: 1,
    fontSize: 10,
    color: '#9898b0',
  },
  budgetValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#f0f0f5',
  },
  // ── Itinerary section ───────────────────────────────────────────────────────
  dayCard: {
    backgroundColor: '#13131a',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e1e2e',
    borderLeftWidth: 3,
    borderLeftColor: '#5b8def',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 4,
  },
  dayNum: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#5b8def',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  dayTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#f0f0f5',
  },
  daySummary: {
    fontSize: 9,
    color: '#a1a1aa',
    lineHeight: 1.5,
    marginBottom: 6,
  },
  daySlotRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  daySlot: {
    flex: 1,
    backgroundColor: '#09090b',
    padding: 6,
    borderRadius: 4,
  },
  daySlotLabel: {
    fontSize: 7,
    color: '#6b7280',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  daySlotText: {
    fontSize: 8,
    color: '#a1a1aa',
    lineHeight: 1.4,
  },
  daySafetyNote: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 4,
  },
  dayBudget: {
    fontSize: 8,
    color: '#d8a83e',
    marginTop: 2,
  },
  globalAdviceItem: {
    fontSize: 9,
    color: '#a1a1aa',
    lineHeight: 1.5,
    marginBottom: 3,
  },
  itineraryMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  itineraryMetaText: {
    fontSize: 8,
    color: '#6b7280',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  // ── Disclaimer / footer ──────────────────────────────────────────────────────
  disclaimer: {
    marginTop: 28,
    padding: 12,
    backgroundColor: '#13131a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e1e2e',
  },
  disclaimerText: {
    fontSize: 8,
    color: '#6b7280',
    lineHeight: 1.5,
  },
  safetyBlock: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#13131a',
    borderRadius: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#d8a83e',
  },
  safetyText: {
    fontSize: 8,
    color: '#6b7280',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#1e1e2e',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: '#6b7280',
    letterSpacing: 0.5,
  },
});

function getScoreColor(score: number): string {
  if (score >= 80) return '#00e5a0';
  if (score >= 60) return '#ffd23f';
  if (score >= 40) return '#ff8c42';
  return '#ff4d2e';
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    ideal:       'IDEALE',
    recommended: 'RECOMMANDEE',
    possible:    'POSSIBLE',
    discouraged: 'DECONSEILEE',
  };
  return map[status] ?? 'ANALYSEE';
}

interface ReportProps {
  /** Optionnel en mode export-only (itinerary fourni sans scoring) */
  score?:      CrisisScore;
  /** Optionnel en mode export-only */
  narrative?:  string;
  generatedAt?: string;
  /** Nom du pays affiché en fallback si score absent */
  countryName?: string;
  profile?: {
    budget?:     number;
    duration?:   number;
    travelType?: string;
    from?:       string;
    to?:         string;
  };
  itinerary?: ItineraryResult;
}

export function TravelReport({ score, narrative, generatedAt, countryName, profile, itinerary }: ReportProps) {
  const color = score ? getScoreColor(score.total) : '#5b8def';
  const date  = generatedAt ?? new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const subScores = score ? [
    { label: 'SECURITE',     value: score.security.value,     weight: 'x40%' },
    { label: 'GEOPOLITIQUE', value: score.geopolitical.value, weight: 'x30%' },
    { label: 'BUDGET',       value: score.budget.value,       weight: 'x20%' },
    { label: 'PRATICITE',    value: score.practicality.value, weight: 'x10%' },
  ] : [];

  const budgetRows = score ? [
    score.budget.details.mealCheap && {
      label: 'Repas bon marche (x3/j)',
      value: `${score.budget.details.mealCheap}EUR`,
    },
    score.budget.details.hotelAvg && {
      label: 'Hotel moyen / nuit',
      value: `${score.budget.details.hotelAvg}EUR`,
    },
    score.budget.details.currencyVariation !== undefined && {
      label: 'Impact change EUR',
      value: `${Number(score.budget.details.currencyVariation) > 0 ? '+' : ''}${score.budget.details.currencyVariation}%`,
    },
  ].filter(Boolean) as Array<{ label: string; value: string }> : [];

  // Section numéros dynamiques selon contenu
  let sectionNum = 1;
  const nextSection = () => String(sectionNum++).padStart(2, '0');

  return (
    <Document
      title={`Crisis Travel - Rapport ${score?.country ?? itinerary?.countryName ?? countryName ?? ''}`}
      author="Crisis Travel"
      subject={`Analyse CrisisScore ${score?.country ?? itinerary?.countryName ?? countryName ?? ''}`}
    >
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>CRISIS TRAVEL</Text>
            <Text style={styles.brandMeta}>RAPPORT D'ANALYSE DESTINATION</Text>
          </View>
          <View>
            <Text style={styles.brandMeta}>GENERE LE {date.toUpperCase()}</Text>
            <Text style={styles.brandMeta}>SOURCES : MEAE - STATE DEPT - ACLED - CLAUDE AI</Text>
            {profile?.travelType && (
              <Text style={styles.brandMeta}>
                PROFIL : {profile.travelType.toUpperCase()}
                {profile.budget ? ` - ${profile.budget}EUR` : ''}
                {profile.duration ? ` - ${profile.duration}J` : ''}
              </Text>
            )}
          </View>
        </View>

        {/* Hero pays + score */}
        <View style={styles.countryHero}>
          {score ? (
            <>
              <View style={[styles.scoreCircle, { borderColor: color }]}>
                <Text style={[styles.scoreValue, { color }]}>{score.total}</Text>
                <Text style={styles.scoreLabel}>/100</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.countryName}>{score.country.toUpperCase()}</Text>
                <Text style={{ fontSize: 10, color, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginTop: 4 }}>
                  {getStatusLabel(score.status)} - CONFIANCE {score.confidence.toUpperCase()}
                </Text>
                <Text style={{ fontSize: 8, color: '#6b7280', marginTop: 6, letterSpacing: 0.5 }}>
                  MAJ {new Date(score.calculatedAt).toLocaleDateString('fr-FR')} - CODE {score.countryCode}
                </Text>
              </View>
            </>
          ) : (
            <View style={{ flex: 1 }}>
              <Text style={styles.countryName}>
                {(itinerary?.countryName ?? countryName ?? '').toUpperCase()}
              </Text>
              <Text style={{ fontSize: 9, color: '#6b7280', marginTop: 6, letterSpacing: 0.5 }}>
                ITINERAIRE GENERE LE {date.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Sous-scores — uniquement si score disponible */}
        {subScores.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{nextSection()} / SOUS-SCORES CrisisScore</Text>
            <View style={styles.subScoreGrid}>
              {subScores.map((s) => (
                <View key={s.label} style={styles.subScoreCard}>
                  <Text style={styles.subScoreLabel}>{s.label}</Text>
                  <Text style={[styles.subScoreValue, { color: getScoreColor(s.value) }]}>{s.value}</Text>
                  <Text style={styles.subScoreWeight}>{s.weight}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Budget — uniquement si score disponible */}
        {budgetRows.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{nextSection()} / INDICATEURS BUDGET</Text>
            {budgetRows.map((row, i) => (
              <View key={i} style={styles.budgetRow}>
                <Text style={styles.budgetLabel}>{row.label}</Text>
                <Text style={styles.budgetValue}>{row.value}</Text>
              </View>
            ))}
          </>
        )}

        {/* Synthèse IA — uniquement si narrative disponible */}
        {narrative && (
          <>
            <Text style={styles.sectionTitle}>{nextSection()} / SYNTHESE CLAUDE AI</Text>
            <Text style={styles.narrativeText}>{narrative}</Text>
          </>
        )}

        {/* Itinéraire IA — section optionnelle, incluse uniquement si fourni dans le payload */}
        {itinerary && (
          <>
            <Text style={styles.sectionTitle}>{nextSection()} / SUGGESTION D'ITINERAIRE IA</Text>

            {/* Méta itinéraire */}
            <View style={styles.itineraryMeta}>
              <Text style={styles.itineraryMetaText}>{itinerary.durationDays} JOUR{itinerary.durationDays > 1 ? 'S' : ''}</Text>
              {itinerary.budget.amount > 0 && (
                <Text style={styles.itineraryMetaText}>
                  BUDGET : {itinerary.budget.amount} {itinerary.budget.currency}
                </Text>
              )}
              <Text style={styles.itineraryMetaText}>DONNEES OFFICIELLES STATIQUES</Text>
            </View>

            {/* GUIDE-V1 : l'itinéraire est un TEXTE de guide narratif. On l'exporte en
                priorité, paragraphe par paragraphe (les ** markdown sont retirés, react-pdf
                ne les interprète pas). Les anciennes cartes jour/matin/après-midi/soir ne
                sont rendues QUE si un ancien itinéraire en contient encore (days?.length) —
                rétro-compat, jamais pour une génération guide-v1. */}
            {itinerary.narrativeText
              ? itinerary.narrativeText
                  .split(/\n\s*\n/)
                  .map((para) => para.replace(/\*\*/g, '').trim())
                  .filter(Boolean)
                  .map((para, i) => (
                    <Text key={i} style={styles.narrativeText}>{para}</Text>
                  ))
              : null}

            {/* Jours — rétro-compat uniquement (anciens itinéraires), garde days?.length */}
            {itinerary.days && itinerary.days.length > 0
              ? itinerary.days.map((day) => (
                  <View key={day.day} style={styles.dayCard}>
                    <View style={styles.dayHeader}>
                      <Text style={styles.dayNum}>JOUR {day.day}</Text>
                      <Text style={styles.dayTitle}>{day.title}</Text>
                    </View>
                    {day.summary ? (
                      <Text style={styles.daySummary}>{day.summary}</Text>
                    ) : null}
                    <View style={styles.daySlotRow}>
                      {[
                        { label: 'MATIN',       text: day.morning },
                        { label: 'APRES-MIDI',  text: day.afternoon },
                        { label: 'SOIR',        text: day.evening },
                      ].map(({ label, text }) => (
                        <View key={label} style={styles.daySlot}>
                          <Text style={styles.daySlotLabel}>{label}</Text>
                          <Text style={styles.daySlotText}>{text}</Text>
                        </View>
                      ))}
                    </View>
                    {day.estimatedBudget ? (
                      <Text style={styles.dayBudget}>Budget estime : {day.estimatedBudget}</Text>
                    ) : null}
                    {day.safetyNote ? (
                      <Text style={styles.daySafetyNote}>! {day.safetyNote}</Text>
                    ) : null}
                  </View>
                ))
              : null}

            {/* Conseils généraux */}
            {itinerary.globalAdvice.length > 0 && (
              <>
                <Text style={{ fontSize: 8, color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase', marginTop: 10, marginBottom: 6 }}>
                  CONSEILS GENERAUX
                </Text>
                {itinerary.globalAdvice.map((advice, i) => (
                  <Text key={i} style={styles.globalAdviceItem}>. {advice}</Text>
                ))}
              </>
            )}

            {/* Safety disclaimer itinéraire — toujours visible si itinéraire inclus */}
            <View style={styles.safetyBlock}>
              <Text style={styles.safetyText}>! {itinerary.safetyDisclaimer}</Text>
            </View>
            <View style={[styles.safetyBlock, { marginTop: 6, borderLeftColor: '#6b7280' }]}>
              <Text style={styles.safetyText}>{itinerary.officialSourceReminder}</Text>
            </View>
          </>
        )}

        {/* Disclaimer général */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            AVERTISSEMENT : Crisis Travel est un outil d'aide a la decision. Les donnees sont issues de sources officielles
            (MEAE, State Department, ACLED) et d'APIs tierces. Consultez toujours diplomatie.gouv.fr et travel.state.gov
            avant tout voyage. Crisis Travel ne peut etre tenu responsable des decisions prises sur la base de ces informations.
            {itinerary ? " L'itineraire est genere par IA a titre indicatif uniquement. Adaptez toujours votre trajet selon les recommandations locales et officielles." : ''}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>CRISIS TRAVEL - RAPPORT CONFIDENTIEL</Text>
          <Text style={styles.footerText}>crisis-travel.fr</Text>
        </View>

      </Page>
    </Document>
  );
}
