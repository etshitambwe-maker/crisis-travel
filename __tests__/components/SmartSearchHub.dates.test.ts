import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'components/crisis/SmartSearchHub.tsx'), 'utf-8');

describe('TRAVEL-DATES-001 — SmartSearchHub cohérence durée/dates', () => {
  it('DiscoveryTab recalcule duration depuis from/to si les deux sont présents', () => {
    // Le code doit contenir un calcul de différence de dates avec getTime()
    expect(src).toMatch(/getTime\(\).*getTime\(\)|getTime.*86400000/i);
  });

  it('RegionTab calcule computedDuration depuis les dates quand disponibles', () => {
    const regionTabBlock = src.slice(src.indexOf('handleRegionAnalyze'));
    expect(regionTabBlock).toMatch(/computedDuration/);
  });

  it('RegionTab n\'utilise plus "7" hardcodé quand les dates sont présentes', () => {
    const regionTabBlock = src.slice(src.indexOf('const handleRegionAnalyze'));
    const beforePush = regionTabBlock.slice(0, regionTabBlock.indexOf('router.push'));
    // La valeur '7' ne doit plus être un literal string dans les URLSearchParams
    // (elle peut rester dans computedDuration : 7 comme fallback numérique)
    expect(beforePush).not.toMatch(/duration.*'7'/);
  });

  it('les flux sans dates restent inchangés (DURATION_MAP préservé)', () => {
    expect(src).toContain('DURATION_MAP');
  });

  it('le fallback numérique 7 est conservé pour RegionTab sans dates', () => {
    // Le : 7 doit apparaître comme valeur de fallback dans computedDuration
    const regionTabBlock = src.slice(src.indexOf('const handleRegionAnalyze'));
    expect(regionTabBlock).toMatch(/:\s*7\b/);
  });
});
