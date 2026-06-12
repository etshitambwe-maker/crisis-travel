import { describe, it, expect } from 'vitest';
import { calculatePracticalityScore } from './practicality.service';

// ANALYZE-PROFILE-001 — tests unitaires purs du modificateur de profil.
// Aucun mock : on lit les vraies données VISA_REQUIREMENTS / FLIGHT_CONNECTIONS.

describe('calculatePracticalityScore — modificateur profil (ANALYZE-PROFILE-001)', () => {
  it('sans profil, comportement historique préservé (rétro-compat)', () => {
    const base   = calculatePracticalityScore('CM');
    const solo   = calculatePracticalityScore('CM', { travelType: 'solo' });
    // solo/absent → modificateur 0 → même valeur de base
    expect(solo.value).toBe(base.value);
  });

  it('family < solo sur une destination à friction (Cameroun, visa embassy_simple)', () => {
    const solo   = calculatePracticalityScore('CM', { travelType: 'solo' });
    const family = calculatePracticalityScore('CM', { travelType: 'family' });
    expect(family.value).toBeLessThan(solo.value);
  });

  it('couple = moitié de la pénalité family', () => {
    const solo   = calculatePracticalityScore('CM', { travelType: 'solo' });
    const couple = calculatePracticalityScore('CM', { travelType: 'couple' });
    const family = calculatePracticalityScore('CM', { travelType: 'family' });
    const penaltyCouple = solo.value - couple.value;
    const penaltyFamily = solo.value - family.value;
    expect(penaltyCouple).toBeGreaterThan(0);
    // couple ≈ family / 2 (à l'arrondi entier près)
    expect(Math.abs(penaltyCouple - penaltyFamily / 2)).toBeLessThanOrEqual(1);
  });

  it('nomad = solo (neutre)', () => {
    const solo  = calculatePracticalityScore('CM', { travelType: 'solo' });
    const nomad = calculatePracticalityScore('CM', { travelType: 'nomad' });
    expect(nomad.value).toBe(solo.value);
  });

  it('aucune pénalité quand pas de friction (Portugal : visa 100 + vol direct)', () => {
    const solo   = calculatePracticalityScore('PT', { travelType: 'solo' });
    const family = calculatePracticalityScore('PT', { travelType: 'family' });
    expect(family.value).toBe(solo.value);
  });

  it('le malus family est borné (≤ 12 points)', () => {
    const solo   = calculatePracticalityScore('CM', { travelType: 'solo' });
    const family = calculatePracticalityScore('CM', { travelType: 'family' });
    expect(solo.value - family.value).toBeLessThanOrEqual(12);
  });

  it('expose le travelType et le modifier dans details (traçabilité)', () => {
    const family = calculatePracticalityScore('CM', { travelType: 'family' });
    expect(family.details.travelType).toBe('family');
    expect(Number(family.details.profileModifier)).toBeLessThan(0);
  });
});
