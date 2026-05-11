'use client';
import { ScoreTooltip } from './ScoreTooltip';
import { CrisisScoreGauge } from './CrisisScoreGauge';
import type { CrisisScore } from '@/types/crisis.types';

export function GaugeWithTooltip({ score }: { score: CrisisScore }) {
  return (
    <ScoreTooltip
      security={score.security.value}
      geopolitical={score.geopolitical.value}
      budget={score.budget.value}
      practicality={score.practicality.value}
      total={score.total}
    >
      <CrisisScoreGauge score={score.total} size="lg" showLabel={false} animate />
    </ScoreTooltip>
  );
}
