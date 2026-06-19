import { describe, it, expect } from 'vitest';
import { isPremiumFromStatus } from '@/app/api/stripe/webhook/route';

const FUTURE = Math.floor(Date.now() / 1000) + 86400;   // +1 jour
const PAST   = Math.floor(Date.now() / 1000) - 86400;   // -1 jour

describe('isPremiumFromStatus — logique accès premium par statut Stripe', () => {
  // ── Statuts actifs ────────────────────────────────────────────────────────

  it('active + future periodEnd → premium true', () => {
    expect(isPremiumFromStatus('active', FUTURE)).toBe(true);
  });

  it('trialing + future periodEnd → premium true', () => {
    expect(isPremiumFromStatus('trialing', FUTURE)).toBe(true);
  });

  it('past_due + future periodEnd → premium true (retry Stripe en cours)', () => {
    expect(isPremiumFromStatus('past_due', FUTURE)).toBe(true);
  });

  // ── Statuts actifs mais date passée ou absente ────────────────────────────

  it('past_due + past periodEnd → premium false (période expirée)', () => {
    expect(isPremiumFromStatus('past_due', PAST)).toBe(false);
  });

  it('active + periodEnd = 0 → premium false (pas de date fournie)', () => {
    expect(isPremiumFromStatus('active', 0)).toBe(false);
  });

  it('trialing + periodEnd = 0 → premium false', () => {
    expect(isPremiumFromStatus('trialing', 0)).toBe(false);
  });

  // ── Statuts inactifs — peu importe la date ────────────────────────────────

  it('unpaid + future periodEnd → premium false', () => {
    expect(isPremiumFromStatus('unpaid', FUTURE)).toBe(false);
  });

  it('canceled + future periodEnd → premium false', () => {
    expect(isPremiumFromStatus('canceled', FUTURE)).toBe(false);
  });

  it('incomplete + future periodEnd → premium false', () => {
    expect(isPremiumFromStatus('incomplete', FUTURE)).toBe(false);
  });

  it('incomplete_expired + future periodEnd → premium false', () => {
    expect(isPremiumFromStatus('incomplete_expired', FUTURE)).toBe(false);
  });

  it('canceled + periodEnd = 0 → premium false', () => {
    expect(isPremiumFromStatus('canceled', 0)).toBe(false);
  });

  it('unpaid + past periodEnd → premium false', () => {
    expect(isPremiumFromStatus('unpaid', PAST)).toBe(false);
  });
});
