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
