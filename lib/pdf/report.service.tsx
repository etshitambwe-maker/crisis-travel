import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { CrisisScore } from '@/types/crisis.types';

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
    ideal: 'IDÉALE',
    recommended: 'RECOMMANDÉE',
    possible: 'POSSIBLE',
    discouraged: 'DÉCONSEILLÉE',
  };
  return map[status] ?? 'ANALYSÉE';
}

interface ReportProps {
  score: CrisisScore;
  narrative: string;
  generatedAt?: string;
}

export function TravelReport({ score, narrative, generatedAt }: ReportProps) {
  const color = getScoreColor(score.total);
  const date = generatedAt ?? new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const subScores = [
    { label: 'SÉCURITÉ', value: score.security.value, weight: '×40%' },
    { label: 'GÉOPOLITIQUE', value: score.geopolitical.value, weight: '×30%' },
    { label: 'BUDGET', value: score.budget.value, weight: '×20%' },
    { label: 'PRATICITÉ', value: score.practicality.value, weight: '×10%' },
  ];

  const budgetRows = [
    score.budget.details.mealCheap && {
      label: 'Repas bon marché (×3/j)',
      value: `${score.budget.details.mealCheap}€`,
    },
    score.budget.details.hotelAvg && {
      label: 'Hôtel moyen / nuit',
      value: `${score.budget.details.hotelAvg}€`,
    },
    score.budget.details.currencyVariation !== undefined && {
      label: `Impact change EUR`,
      value: `${Number(score.budget.details.currencyVariation) > 0 ? '+' : ''}${score.budget.details.currencyVariation}%`,
    },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <Document
      title={`Crisis Travel — Rapport ${score.country}`}
      author="Crisis Travel"
      subject={`Analyse CrisisScore ${score.country}`}
    >
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>⚡ CRISIS TRAVEL</Text>
            <Text style={styles.brandMeta}>RAPPORT D'ANALYSE DESTINATION</Text>
          </View>
          <View>
            <Text style={styles.brandMeta}>GÉNÉRÉ LE {date.toUpperCase()}</Text>
            <Text style={styles.brandMeta}>SOURCES : MEAE · STATE DEPT · ACLED · CLAUDE AI</Text>
          </View>
        </View>

        {/* Hero pays + score */}
        <View style={styles.countryHero}>
          <View style={[styles.scoreCircle, { borderColor: color }]}>
            <Text style={[styles.scoreValue, { color }]}>{score.total}</Text>
            <Text style={styles.scoreLabel}>/100</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.countryName}>{score.country.toUpperCase()}</Text>
            <Text style={{ fontSize: 10, color, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginTop: 4 }}>
              {getStatusLabel(score.status)} · CONFIANCE {score.confidence.toUpperCase()}
            </Text>
            <Text style={{ fontSize: 8, color: '#6b7280', marginTop: 6, letterSpacing: 0.5 }}>
              MAJ {new Date(score.calculatedAt).toLocaleDateString('fr-FR')} · CODE {score.countryCode}
            </Text>
          </View>
        </View>

        {/* Sous-scores */}
        <Text style={styles.sectionTitle}>01 / SOUS-SCORES CrisisScore</Text>
        <View style={styles.subScoreGrid}>
          {subScores.map((s) => (
            <View key={s.label} style={styles.subScoreCard}>
              <Text style={styles.subScoreLabel}>{s.label}</Text>
              <Text style={[styles.subScoreValue, { color: getScoreColor(s.value) }]}>{s.value}</Text>
              <Text style={styles.subScoreWeight}>{s.weight}</Text>
            </View>
          ))}
        </View>

        {/* Budget */}
        {budgetRows.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>02 / INDICATEURS BUDGET</Text>
            {budgetRows.map((row, i) => (
              <View key={i} style={styles.budgetRow}>
                <Text style={styles.budgetLabel}>{row.label}</Text>
                <Text style={styles.budgetValue}>{row.value}</Text>
              </View>
            ))}
          </>
        )}

        {/* Synthèse IA */}
        <Text style={styles.sectionTitle}>03 / SYNTHÈSE CLAUDE AI</Text>
        <Text style={styles.narrativeText}>{narrative}</Text>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            AVERTISSEMENT : Crisis Travel est un outil d'aide à la décision. Les données sont issues de sources officielles
            (MEAE, State Department, ACLED) et d'APIs tierces. Consultez toujours diplomatie.gouv.fr et travel.state.gov
            avant tout voyage. Crisis Travel ne peut être tenu responsable des décisions prises sur la base de ces informations.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>CRISIS TRAVEL — RAPPORT CONFIDENTIEL</Text>
          <Text style={styles.footerText}>crisis-travel.app</Text>
        </View>

      </Page>
    </Document>
  );
}
