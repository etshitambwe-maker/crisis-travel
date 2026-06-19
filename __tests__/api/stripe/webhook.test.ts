import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks déclarés AVANT les imports qui les utilisent ────────────────────────

vi.mock('@/lib/stripe/stripe.service', () => ({
  constructWebhookEvent: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/stripe/stripe-event-journal', () => ({
  journalReceive: vi.fn(),
  journalProcessed: vi.fn(),
  journalFailed: vi.fn(),
  journalIgnored: vi.fn(),
}));

import { constructWebhookEvent } from '@/lib/stripe/stripe.service';
import { createClient } from '@supabase/supabase-js';
import {
  journalReceive,
  journalProcessed,
  journalFailed,
  journalIgnored,
} from '@/lib/stripe/stripe-event-journal';
import { POST } from '@/app/api/stripe/webhook/route';

// ── Typed mocks ───────────────────────────────────────────────────────────────

const mockConstructWebhookEvent = vi.mocked(constructWebhookEvent);
const mockCreateClient = vi.mocked(createClient);
const mockJournalReceive = vi.mocked(journalReceive);
const mockJournalProcessed = vi.mocked(journalProcessed);
const mockJournalFailed = vi.mocked(journalFailed);
const mockJournalIgnored = vi.mocked(journalIgnored);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body = '{}', sig = 'valid-sig'): Request {
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body,
    headers: { 'stripe-signature': sig },
  });
}

import type Stripe from 'stripe';

function makeEvent(type: string, overrides: Record<string, unknown> = {}): Stripe.Event {
  return {
    id: 'evt_test_001',
    type,
    livemode: false,
    data: { object: {} },
    ...overrides,
  } as unknown as Stripe.Event;
}

/** Construit un faux client Supabase dont toutes les opérations réussissent */
function makeOkSupabaseClient() {
  const mockEqUpdate = vi.fn().mockResolvedValue({ error: null });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqUpdate });
  const mockFrom = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'user-uuid-123' }, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: mockUpdate,
    upsert: vi.fn().mockResolvedValue({ error: null }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'row-uuid-001' }, error: null }),
    }),
  });
  return { from: mockFrom };
}

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-test';

  mockJournalReceive.mockResolvedValue({ rowId: 'row-uuid-001', isDuplicate: false });
  mockJournalProcessed.mockResolvedValue(undefined);
  mockJournalFailed.mockResolvedValue(undefined);
  mockJournalIgnored.mockResolvedValue(undefined);

  mockCreateClient.mockReturnValue(
    makeOkSupabaseClient() as unknown as ReturnType<typeof createClient>
  );
});

// ── Signature invalide ────────────────────────────────────────────────────────

describe('Signature invalide', () => {
  it('retourne 400 si la signature est invalide', async () => {
    mockConstructWebhookEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload');
    });

    const res = await POST(makeRequest('{}', 'bad-sig'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Signature invalide');
  });

  it('ne crée aucun journal si la signature est invalide', async () => {
    mockConstructWebhookEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    await POST(makeRequest('{}', 'bad-sig'));

    expect(mockJournalReceive).not.toHaveBeenCalled();
  });

  it('retourne 400 si le header stripe-signature est absent', async () => {
    const req = new Request('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body: '{}',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ── Idempotency ───────────────────────────────────────────────────────────────

describe('Idempotency — double delivery', () => {
  it('retourne 200 avec duplicate:true si déjà processed', async () => {
    mockConstructWebhookEvent.mockReturnValue(makeEvent('customer.subscription.updated'));
    mockJournalReceive.mockResolvedValue({ rowId: 'row-uuid-001', isDuplicate: true });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.duplicate).toBe(true);
    expect(mockJournalProcessed).not.toHaveBeenCalled();
  });

  it('ne mute pas user_profiles si duplicate', async () => {
    mockConstructWebhookEvent.mockReturnValue(makeEvent('customer.subscription.updated'));
    mockJournalReceive.mockResolvedValue({ rowId: 'row-uuid-001', isDuplicate: true });

    await POST(makeRequest());

    expect(mockJournalProcessed).not.toHaveBeenCalled();
  });
});

// ── Supabase failure ──────────────────────────────────────────────────────────

describe('Erreur Supabase critique — subscription.updated', () => {
  it('retourne 500 et appelle journalFailed si update user_profiles échoue', async () => {
    const sub = {
      id: 'sub_001',
      customer: 'cus_001',
      status: 'active',
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400 }] },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('customer.subscription.updated', { data: { object: sub } })
    );

    // find user → OK, update → erreur
    const mockEqUpdate = vi.fn().mockResolvedValue({ error: { message: 'DB unavailable' } });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqUpdate });
    mockCreateClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'user-uuid-123' }, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: mockUpdate,
        upsert: vi.fn().mockResolvedValue({ error: null }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'row-uuid-001' }, error: null }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    expect(mockJournalFailed).toHaveBeenCalledWith(
      expect.anything(),
      'row-uuid-001',
      expect.stringContaining('upsertSubscription failed'),
    );
  });
});

// ── subscription.deleted ──────────────────────────────────────────────────────

describe('customer.subscription.deleted', () => {
  it('traite l\'événement et marque processed', async () => {
    const sub = {
      id: 'sub_deleted_001',
      customer: 'cus_001',
      status: 'canceled',
      items: { data: [] },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('customer.subscription.deleted', { data: { object: sub } })
    );

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(mockJournalProcessed).toHaveBeenCalledWith(
      expect.anything(),
      'row-uuid-001',
    );
  });

  it('ne logue pas de PII dans les logs console', async () => {
    const sub = {
      id: 'sub_deleted_002',
      customer: 'cus_002',
      status: 'canceled',
      items: { data: [] },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('customer.subscription.deleted', { data: { object: sub } })
    );

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await POST(makeRequest());

    const allArgs = consoleSpy.mock.calls.flat();
    const objectArgs = allArgs.filter(a => typeof a === 'object') as Record<string, unknown>[];
    for (const obj of objectArgs) {
      const str = JSON.stringify(obj);
      expect(str).not.toMatch(/email|card|billing|address/i);
    }
    consoleSpy.mockRestore();
  });
});

// ── invoice.payment_failed ────────────────────────────────────────────────────

describe('invoice.payment_failed', () => {
  it('retourne 200 et journalise processed', async () => {
    const inv = {
      id: 'in_failed_001',
      customer: 'cus_001',
      attempt_count: 2,
      next_payment_attempt: Math.floor(Date.now() / 1000) + 86400,
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('invoice.payment_failed', { data: { object: inv } })
    );

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(mockJournalProcessed).toHaveBeenCalled();
  });

  it('ne logue pas l\'email du customer', async () => {
    const inv = {
      id: 'in_failed_002',
      customer: 'cus_002',
      customer_email: 'user@example.com',
      attempt_count: 1,
      next_payment_attempt: null,
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('invoice.payment_failed', { data: { object: inv } })
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await POST(makeRequest());

    const allArgs = warnSpy.mock.calls.flat();
    const objectArgs = allArgs.filter(a => typeof a === 'object') as Record<string, unknown>[];
    for (const obj of objectArgs) {
      const str = JSON.stringify(obj);
      expect(str).not.toContain('user@example.com');
      expect(str).not.toMatch(/card|billing_details|address/i);
    }
    warnSpy.mockRestore();
  });
});

// ── Événement inconnu ─────────────────────────────────────────────────────────

describe('Événement inconnu / ignoré', () => {
  it('retourne 200 avec ignored:true et appelle journalIgnored', async () => {
    mockConstructWebhookEvent.mockReturnValue(makeEvent('payment_intent.created'));

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ignored).toBe(true);
    expect(mockJournalIgnored).toHaveBeenCalledWith(
      expect.anything(),
      'row-uuid-001',
    );
  });

  it('ne appelle pas journalProcessed sur un événement ignoré', async () => {
    mockConstructWebhookEvent.mockReturnValue(makeEvent('radar.early_fraud_warning.created'));

    await POST(makeRequest());

    expect(mockJournalIgnored).toHaveBeenCalled();
    expect(mockJournalProcessed).not.toHaveBeenCalled();
  });
});

// ── checkout.session.completed ────────────────────────────────────────────────

describe('checkout.session.completed', () => {
  it('journalise processed si UPSERT réussit', async () => {
    const session = {
      id: 'cs_test_001',
      customer: 'cus_001',
      metadata: { supabase_user_id: 'user-uuid-123' },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('checkout.session.completed', { data: { object: session } })
    );

    mockCreateClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'user-uuid-123' }, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'row-uuid-001' }, error: null }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(mockJournalProcessed).toHaveBeenCalled();
  });

  it('retourne 500 et journalise failed si UPSERT échoue', async () => {
    const session = {
      id: 'cs_test_002',
      customer: 'cus_002',
      metadata: { supabase_user_id: 'user-uuid-456' },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('checkout.session.completed', { data: { object: session } })
    );

    mockCreateClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'user-uuid-456' }, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        upsert: vi.fn().mockResolvedValue({ error: { message: 'DB timeout' } }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'row-uuid-001' }, error: null }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    expect(mockJournalFailed).toHaveBeenCalled();
  });
});

// ── Helpers réutilisables pour les tests lifecycle ────────────────────────

function makeOkClientWithUpdateSpy() {
  const mockEqUpdate = vi.fn().mockResolvedValue({ error: null });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqUpdate });
  const mockClient = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'user-uuid-123' }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: mockUpdate,
      upsert: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'row-uuid-001' }, error: null }),
      }),
    }),
  };
  return { mockClient, mockUpdate };
}

// ── Lifecycle — past_due ──────────────────────────────────────────────────

describe('customer.subscription.updated — past_due', () => {
  it('past_due + future periodEnd → sync OK (200), journal processed', async () => {
    const FUTURE = Math.floor(Date.now() / 1000) + 86400;
    const sub = {
      id: 'sub_pastdue_001',
      customer: 'cus_001',
      status: 'past_due',
      items: { data: [{ current_period_end: FUTURE }] },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('customer.subscription.updated', { data: { object: sub } })
    );

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(mockJournalProcessed).toHaveBeenCalledWith(expect.anything(), 'row-uuid-001');
  });

  it('past_due + future periodEnd → subscription_tier=premium écrit dans Supabase', async () => {
    const FUTURE = Math.floor(Date.now() / 1000) + 86400;
    const sub = {
      id: 'sub_pastdue_002',
      customer: 'cus_001',
      status: 'past_due',
      items: { data: [{ current_period_end: FUTURE }] },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('customer.subscription.updated', { data: { object: sub } })
    );

    const { mockClient, mockUpdate } = makeOkClientWithUpdateSpy();
    mockCreateClient.mockReturnValue(mockClient as unknown as ReturnType<typeof createClient>);

    await POST(makeRequest());

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_tier: 'premium' })
    );
  });

  it('past_due + past periodEnd → subscription_tier=free écrit dans Supabase', async () => {
    const PAST = Math.floor(Date.now() / 1000) - 86400;
    const sub = {
      id: 'sub_pastdue_003',
      customer: 'cus_001',
      status: 'past_due',
      items: { data: [{ current_period_end: PAST }] },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('customer.subscription.updated', { data: { object: sub } })
    );

    const { mockClient, mockUpdate } = makeOkClientWithUpdateSpy();
    mockCreateClient.mockReturnValue(mockClient as unknown as ReturnType<typeof createClient>);

    await POST(makeRequest());

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_tier: 'free' })
    );
  });
});

// ── Lifecycle — cancel_at_period_end ─────────────────────────────────────

describe('customer.subscription.updated — cancel_at_period_end=true', () => {
  it('active + cancel_at_period_end + future periodEnd → subscription_tier=premium maintenu', async () => {
    // Stripe maintient status='active' même avec cancel planifié.
    // Le webhook ne lit pas cancel_at_period_end (pas de colonne en base),
    // mais l'accès est maintenu via subscription_tier=premium + subscription_end_date future.
    const FUTURE = Math.floor(Date.now() / 1000) + 86400 * 14;
    const sub = {
      id: 'sub_cancel_scheduled_001',
      customer: 'cus_001',
      status: 'active',
      cancel_at_period_end: true,
      items: { data: [{ current_period_end: FUTURE }] },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('customer.subscription.updated', { data: { object: sub } })
    );

    const { mockClient, mockUpdate } = makeOkClientWithUpdateSpy();
    mockCreateClient.mockReturnValue(mockClient as unknown as ReturnType<typeof createClient>);

    await POST(makeRequest());

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_tier: 'premium' })
    );
  });
});

// ── Lifecycle — statuts inactifs ─────────────────────────────────────────

describe('customer.subscription.updated — statuts inactifs', () => {
  const FUTURE = Math.floor(Date.now() / 1000) + 86400;

  async function expectInactiveStatus(status: string) {
    const sub = {
      id: `sub_${status}_001`,
      customer: 'cus_001',
      status,
      items: { data: [{ current_period_end: FUTURE }] },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('customer.subscription.updated', { data: { object: sub } })
    );

    const { mockClient, mockUpdate } = makeOkClientWithUpdateSpy();
    mockCreateClient.mockReturnValue(mockClient as unknown as ReturnType<typeof createClient>);

    await POST(makeRequest());

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_tier: 'free' })
    );
  }

  it('unpaid → subscription_tier=free', () => expectInactiveStatus('unpaid'));
  it('incomplete → subscription_tier=free', () => expectInactiveStatus('incomplete'));
  it('incomplete_expired → subscription_tier=free', () => expectInactiveStatus('incomplete_expired'));
});

// ── Lifecycle — invoice.payment_failed ───────────────────────────────────

describe('invoice.payment_failed — ne mute pas directement user_profiles', () => {
  it('payment_failed ne déclenche aucun update subscription_tier (délégué à subscription.updated)', async () => {
    const inv = {
      id: 'in_failed_lifecycle_001',
      customer: 'cus_001',
      attempt_count: 1,
      next_payment_attempt: Math.floor(Date.now() / 1000) + 86400,
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('invoice.payment_failed', { data: { object: inv } })
    );

    const { mockClient, mockUpdate } = makeOkClientWithUpdateSpy();
    mockCreateClient.mockReturnValue(mockClient as unknown as ReturnType<typeof createClient>);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    // payment_failed ne mute pas subscription_tier — c'est subscription.updated qui suit
    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ subscription_tier: expect.anything() })
    );
  });
});

// ── Lifecycle — subscription.deleted ─────────────────────────────────────

describe('customer.subscription.deleted — nettoyage final', () => {
  it('deleted → subscription_tier=free écrit dans Supabase', async () => {
    const sub = {
      id: 'sub_deleted_lifecycle_001',
      customer: 'cus_001',
      status: 'canceled',
      items: { data: [] },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('customer.subscription.deleted', { data: { object: sub } })
    );

    const { mockClient, mockUpdate } = makeOkClientWithUpdateSpy();
    mockCreateClient.mockReturnValue(mockClient as unknown as ReturnType<typeof createClient>);

    await POST(makeRequest());

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_tier: 'free' })
    );
  });

  it('deleted → subscription_end_date=null (nettoyage)', async () => {
    const sub = {
      id: 'sub_deleted_lifecycle_002',
      customer: 'cus_001',
      status: 'canceled',
      items: { data: [] },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('customer.subscription.deleted', { data: { object: sub } })
    );

    const { mockClient, mockUpdate } = makeOkClientWithUpdateSpy();
    mockCreateClient.mockReturnValue(mockClient as unknown as ReturnType<typeof createClient>);

    await POST(makeRequest());

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_end_date: null })
    );
  });
});

// ── Ops logs — invoice.payment_failed ────────────────────────────────────

describe('invoice.payment_failed — logs ops enrichis', () => {
  it('loggue attemptCount dans le warn ops', async () => {
    const inv = {
      id: 'in_ops_001',
      customer: 'cus_ops_001',
      subscription: 'sub_ops_001',
      attempt_count: 2,
      next_payment_attempt: Math.floor(Date.now() / 1000) + 86400,
      amount_due: 990,
      currency: 'eur',
      status: 'open',
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('invoice.payment_failed', { data: { object: inv } })
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await POST(makeRequest());

    const allArgs = warnSpy.mock.calls.flat();
    const objects = allArgs.filter(a => typeof a === 'object') as Record<string, unknown>[];
    const opsLog = objects.find(o => o['eventName'] === 'invoice_payment_failed');
    expect(opsLog).toBeDefined();
    expect(opsLog!['attemptCount']).toBe(2);
    warnSpy.mockRestore();
  });

  it('loggue nextPaymentAttempt comme ISO string quand présent', async () => {
    const FUTURE_SEC = Math.floor(Date.now() / 1000) + 86400;
    const inv = {
      id: 'in_ops_002',
      customer: 'cus_ops_002',
      attempt_count: 1,
      next_payment_attempt: FUTURE_SEC,
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('invoice.payment_failed', { data: { object: inv } })
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await POST(makeRequest());

    const objects = warnSpy.mock.calls.flat().filter(a => typeof a === 'object') as Record<string, unknown>[];
    const opsLog = objects.find(o => o['eventName'] === 'invoice_payment_failed');
    expect(opsLog).toBeDefined();
    expect(typeof opsLog!['nextPaymentAttempt']).toBe('string');
    expect(opsLog!['willRetry']).toBe(true);
    warnSpy.mockRestore();
  });

  it('loggue willRetry=false et nextPaymentAttempt=null quand dernier retry', async () => {
    const inv = {
      id: 'in_ops_003',
      customer: 'cus_ops_003',
      attempt_count: 3,
      next_payment_attempt: null,
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('invoice.payment_failed', { data: { object: inv } })
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await POST(makeRequest());

    const objects = warnSpy.mock.calls.flat().filter(a => typeof a === 'object') as Record<string, unknown>[];
    const opsLog = objects.find(o => o['eventName'] === 'invoice_payment_failed');
    expect(opsLog).toBeDefined();
    expect(opsLog!['willRetry']).toBe(false);
    expect(opsLog!['nextPaymentAttempt']).toBeNull();
    expect(opsLog!['attemptCount']).toBe(3);
    warnSpy.mockRestore();
  });

  it('loggue amountDue et currency', async () => {
    const inv = {
      id: 'in_ops_004',
      customer: 'cus_ops_004',
      attempt_count: 1,
      next_payment_attempt: Math.floor(Date.now() / 1000) + 3600,
      amount_due: 1990,
      currency: 'eur',
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('invoice.payment_failed', { data: { object: inv } })
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await POST(makeRequest());

    const objects = warnSpy.mock.calls.flat().filter(a => typeof a === 'object') as Record<string, unknown>[];
    const opsLog = objects.find(o => o['eventName'] === 'invoice_payment_failed');
    expect(opsLog!['amountDue']).toBe(1990);
    expect(opsLog!['currency']).toBe('eur');
    warnSpy.mockRestore();
  });

  it('loggue opsAction=monitor_retry', async () => {
    const inv = {
      id: 'in_ops_005',
      customer: 'cus_ops_005',
      attempt_count: 1,
      next_payment_attempt: Math.floor(Date.now() / 1000) + 3600,
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('invoice.payment_failed', { data: { object: inv } })
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await POST(makeRequest());

    const objects = warnSpy.mock.calls.flat().filter(a => typeof a === 'object') as Record<string, unknown>[];
    const opsLog = objects.find(o => o['eventName'] === 'invoice_payment_failed');
    expect(opsLog!['opsAction']).toBe('monitor_retry');
    warnSpy.mockRestore();
  });

  it('ne loggue pas email, card, billing_details, payload complet', async () => {
    const inv = {
      id: 'in_ops_006',
      customer: 'cus_ops_006',
      customer_email: 'secret@example.com',
      attempt_count: 1,
      next_payment_attempt: null,
      // Simule des champs sensibles qui ne doivent jamais apparaître dans les logs
      billing_details: { name: 'John Doe', address: { city: 'Paris' } },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('invoice.payment_failed', { data: { object: inv } })
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await POST(makeRequest());

    const allStr = JSON.stringify(warnSpy.mock.calls);
    expect(allStr).not.toContain('secret@example.com');
    expect(allStr).not.toMatch(/billing_details|card|address/i);
    warnSpy.mockRestore();
  });

  it('ne loggue pas l\'objet invoice complet', async () => {
    const inv = {
      id: 'in_ops_007',
      customer: 'cus_ops_007',
      attempt_count: 1,
      next_payment_attempt: null,
      lines: { data: [{ id: 'line_001', amount: 990 }] },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('invoice.payment_failed', { data: { object: inv } })
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await POST(makeRequest());

    const objects = warnSpy.mock.calls.flat().filter(a => typeof a === 'object') as Record<string, unknown>[];
    const opsLog = objects.find(o => o['eventName'] === 'invoice_payment_failed');
    // L'objet invoice complet (avec lines) ne doit pas être présent dans le log ops
    expect(opsLog).not.toHaveProperty('lines');
    expect(opsLog).not.toHaveProperty('id'); // invoice id n'est pas dans l'allowlist ops
    warnSpy.mockRestore();
  });
});

// ── Ops logs — invoice.payment_succeeded ─────────────────────────────────

describe('invoice.payment_succeeded — logs ops enrichis', () => {
  it('retourne 200 et appelle journalProcessed', async () => {
    const inv = {
      id: 'in_succ_001',
      customer: 'cus_succ_001',
      subscription: 'sub_succ_001',
      amount_paid: 990,
      currency: 'eur',
      billing_reason: 'subscription_cycle',
      status: 'paid',
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('invoice.payment_succeeded', { data: { object: inv } })
    );

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(mockJournalProcessed).toHaveBeenCalled();
  });

  it('loggue amountPaid et currency', async () => {
    const inv = {
      id: 'in_succ_002',
      customer: 'cus_succ_002',
      subscription: 'sub_succ_002',
      amount_paid: 7900,
      currency: 'eur',
      billing_reason: 'subscription_create',
      status: 'paid',
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('invoice.payment_succeeded', { data: { object: inv } })
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await POST(makeRequest());

    const objects = warnSpy.mock.calls.flat().filter(a => typeof a === 'object') as Record<string, unknown>[];
    const opsLog = objects.find(o => o['eventName'] === 'invoice_payment_succeeded');
    expect(opsLog).toBeDefined();
    expect(opsLog!['amountPaid']).toBe(7900);
    expect(opsLog!['currency']).toBe('eur');
    warnSpy.mockRestore();
  });

  it('loggue billingReason si disponible', async () => {
    const inv = {
      id: 'in_succ_003',
      customer: 'cus_succ_003',
      billing_reason: 'subscription_cycle',
      status: 'paid',
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('invoice.payment_succeeded', { data: { object: inv } })
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await POST(makeRequest());

    const objects = warnSpy.mock.calls.flat().filter(a => typeof a === 'object') as Record<string, unknown>[];
    const opsLog = objects.find(o => o['eventName'] === 'invoice_payment_succeeded');
    expect(opsLog!['billingReason']).toBe('subscription_cycle');
    warnSpy.mockRestore();
  });

  it('loggue opsAction=payment_recovered_or_renewed', async () => {
    const inv = {
      id: 'in_succ_004',
      customer: 'cus_succ_004',
      status: 'paid',
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('invoice.payment_succeeded', { data: { object: inv } })
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await POST(makeRequest());

    const objects = warnSpy.mock.calls.flat().filter(a => typeof a === 'object') as Record<string, unknown>[];
    const opsLog = objects.find(o => o['eventName'] === 'invoice_payment_succeeded');
    expect(opsLog!['opsAction']).toBe('payment_recovered_or_renewed');
    warnSpy.mockRestore();
  });

  it('ne loggue pas email ni objet invoice complet', async () => {
    const inv = {
      id: 'in_succ_005',
      customer: 'cus_succ_005',
      customer_email: 'secret@example.com',
      status: 'paid',
      lines: { data: [{ id: 'line_succ_001' }] },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('invoice.payment_succeeded', { data: { object: inv } })
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await POST(makeRequest());

    const allStr = JSON.stringify(warnSpy.mock.calls);
    expect(allStr).not.toContain('secret@example.com');

    const objects = warnSpy.mock.calls.flat().filter(a => typeof a === 'object') as Record<string, unknown>[];
    const opsLog = objects.find(o => o['eventName'] === 'invoice_payment_succeeded');
    expect(opsLog).not.toHaveProperty('lines');
    warnSpy.mockRestore();
  });
});

// ── Ops logs — transitions subscription.updated ───────────────────────────

describe('customer.subscription.updated — logs ops transitions', () => {
  it('active → past_due loggue opsAction=subscription_became_past_due', async () => {
    const FUTURE = Math.floor(Date.now() / 1000) + 86400;
    const sub = {
      id: 'sub_trans_001',
      customer: 'cus_trans_001',
      status: 'past_due',
      items: { data: [{ current_period_end: FUTURE }] },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('customer.subscription.updated', {
        data: {
          object: sub,
          previous_attributes: { status: 'active' },
        },
      })
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await POST(makeRequest());

    const objects = warnSpy.mock.calls.flat().filter(a => typeof a === 'object') as Record<string, unknown>[];
    const opsLog = objects.find(o => o['eventName'] === 'subscription_status_transition');
    expect(opsLog).toBeDefined();
    expect(opsLog!['opsAction']).toBe('subscription_became_past_due');
    expect(opsLog!['previousStatus']).toBe('active');
    expect(opsLog!['currentStatus']).toBe('past_due');
    warnSpy.mockRestore();
  });

  it('past_due → active loggue opsAction=subscription_recovered', async () => {
    const FUTURE = Math.floor(Date.now() / 1000) + 86400;
    const sub = {
      id: 'sub_trans_002',
      customer: 'cus_trans_002',
      status: 'active',
      items: { data: [{ current_period_end: FUTURE }] },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('customer.subscription.updated', {
        data: {
          object: sub,
          previous_attributes: { status: 'past_due' },
        },
      })
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await POST(makeRequest());

    const objects = warnSpy.mock.calls.flat().filter(a => typeof a === 'object') as Record<string, unknown>[];
    const opsLog = objects.find(o => o['eventName'] === 'subscription_status_transition');
    expect(opsLog).toBeDefined();
    expect(opsLog!['opsAction']).toBe('subscription_recovered');
    expect(opsLog!['previousStatus']).toBe('past_due');
    expect(opsLog!['currentStatus']).toBe('active');
    warnSpy.mockRestore();
  });

  it('past_due → unpaid loggue opsAction=subscription_became_unpaid', async () => {
    const FUTURE = Math.floor(Date.now() / 1000) + 86400;
    const sub = {
      id: 'sub_trans_003',
      customer: 'cus_trans_003',
      status: 'unpaid',
      items: { data: [{ current_period_end: FUTURE }] },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('customer.subscription.updated', {
        data: {
          object: sub,
          previous_attributes: { status: 'past_due' },
        },
      })
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await POST(makeRequest());

    const objects = warnSpy.mock.calls.flat().filter(a => typeof a === 'object') as Record<string, unknown>[];
    const opsLog = objects.find(o => o['eventName'] === 'subscription_status_transition');
    expect(opsLog).toBeDefined();
    expect(opsLog!['opsAction']).toBe('subscription_became_unpaid');
    expect(opsLog!['previousStatus']).toBe('past_due');
    expect(opsLog!['currentStatus']).toBe('unpaid');
    warnSpy.mockRestore();
  });

  it('sans previous_attributes loggue opsAction=subscription_updated (pas de transition)', async () => {
    const FUTURE = Math.floor(Date.now() / 1000) + 86400;
    const sub = {
      id: 'sub_trans_004',
      customer: 'cus_trans_004',
      status: 'active',
      items: { data: [{ current_period_end: FUTURE }] },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('customer.subscription.updated', { data: { object: sub } })
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await POST(makeRequest());

    const objects = warnSpy.mock.calls.flat().filter(a => typeof a === 'object') as Record<string, unknown>[];
    const opsLog = objects.find(o => o['eventName'] === 'subscription_status_transition');
    expect(opsLog).toBeDefined();
    expect(opsLog!['opsAction']).toBe('subscription_updated');
    expect(opsLog!['previousStatus']).toBeNull();
    warnSpy.mockRestore();
  });

  it('loggue computedTier correct lors de la transition', async () => {
    const FUTURE = Math.floor(Date.now() / 1000) + 86400;
    const sub = {
      id: 'sub_trans_005',
      customer: 'cus_trans_005',
      status: 'past_due',
      items: { data: [{ current_period_end: FUTURE }] },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('customer.subscription.updated', {
        data: {
          object: sub,
          previous_attributes: { status: 'active' },
        },
      })
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await POST(makeRequest());

    const objects = warnSpy.mock.calls.flat().filter(a => typeof a === 'object') as Record<string, unknown>[];
    const opsLog = objects.find(o => o['eventName'] === 'subscription_status_transition');
    // past_due + future periodEnd → computedTier=premium
    expect(opsLog!['computedTier']).toBe('premium');
    warnSpy.mockRestore();
  });

  it('ne loggue pas PII dans les logs de transition', async () => {
    const FUTURE = Math.floor(Date.now() / 1000) + 86400;
    const sub = {
      id: 'sub_trans_006',
      customer: 'cus_trans_006',
      status: 'past_due',
      // Champs sensibles qui ne doivent jamais apparaître
      metadata: { user_email: 'pii@example.com', full_name: 'Jane Doe' },
      items: { data: [{ current_period_end: FUTURE }] },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('customer.subscription.updated', {
        data: {
          object: sub,
          previous_attributes: { status: 'active' },
        },
      })
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await POST(makeRequest());

    const allStr = JSON.stringify(warnSpy.mock.calls);
    expect(allStr).not.toContain('pii@example.com');
    expect(allStr).not.toContain('Jane Doe');
    warnSpy.mockRestore();
  });

  it('la mutation premium reste conforme — past_due + future → tier=premium', async () => {
    const FUTURE = Math.floor(Date.now() / 1000) + 86400;
    const sub = {
      id: 'sub_trans_007',
      customer: 'cus_trans_007',
      status: 'past_due',
      items: { data: [{ current_period_end: FUTURE }] },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeEvent('customer.subscription.updated', {
        data: {
          object: sub,
          previous_attributes: { status: 'active' },
        },
      })
    );

    const { mockClient, mockUpdate } = makeOkClientWithUpdateSpy();
    mockCreateClient.mockReturnValue(mockClient as unknown as ReturnType<typeof createClient>);

    await POST(makeRequest());

    // La logique premium est inchangée — past_due + future = premium maintenu
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_tier: 'premium' })
    );
  });
});
