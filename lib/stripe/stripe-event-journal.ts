import type { SupabaseClient } from '@supabase/supabase-js';

export type EventProcessingStatus =
  | 'received'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'ignored'
  | 'duplicate';

export interface JournalEntry {
  stripeEventId: string;
  eventType: string;
  livemode: boolean;
  customerId?: string | null;
  subscriptionId?: string | null;
  userId?: string | null;
}

export interface JournalHandle {
  /** null si Supabase non configuré (dev local sans DB) */
  rowId: string | null;
  /** true si l'événement était déjà traité (duplicate) */
  isDuplicate: boolean;
}

/**
 * Insère ou détecte un événement Stripe dans le journal.
 * Retourne isDuplicate=true si stripe_event_id existe déjà en statut processed.
 * Retourne rowId=null si Supabase n'est pas configuré (dev local).
 */
export async function journalReceive(
  supabase: SupabaseClient,
  entry: JournalEntry,
): Promise<JournalHandle> {
  // Vérifier si déjà traité (idempotency)
  const { data: existing } = await supabase
    .from('stripe_events')
    .select('id, processing_status')
    .eq('stripe_event_id', entry.stripeEventId)
    .maybeSingle();

  if (existing) {
    if (existing.processing_status === 'processed') {
      // Marquer duplicate pour traçabilité
      await supabase
        .from('stripe_events')
        .update({ processing_status: 'duplicate' })
        .eq('id', existing.id);
      console.info('[Stripe/journal] duplicate ignoré', {
        stripeEventId: entry.stripeEventId,
        eventType: entry.eventType,
      });
      return { rowId: existing.id as string, isDuplicate: true };
    }
    // Existe mais pas encore processed (ex: crash précédent) → retraiter
    return { rowId: existing.id as string, isDuplicate: false };
  }

  // Insérer nouveau
  const { data: inserted, error } = await supabase
    .from('stripe_events')
    .insert({
      stripe_event_id: entry.stripeEventId,
      event_type: entry.eventType,
      livemode: entry.livemode,
      customer_id: entry.customerId ?? null,
      subscription_id: entry.subscriptionId ?? null,
      user_id: entry.userId ?? null,
      processing_status: 'processing',
    })
    .select('id')
    .single();

  if (error || !inserted) {
    console.error('[Stripe/journal] journalReceive insert failed', {
      stripeEventId: entry.stripeEventId,
      error: error?.message,
    });
    return { rowId: null, isDuplicate: false };
  }

  return { rowId: inserted.id as string, isDuplicate: false };
}

/** Marque l'événement comme traité avec succès. */
export async function journalProcessed(
  supabase: SupabaseClient,
  rowId: string,
): Promise<void> {
  await supabase
    .from('stripe_events')
    .update({ processing_status: 'processed', processed_at: new Date().toISOString() })
    .eq('id', rowId);
}

/** Marque l'événement comme échoué avec un message d'erreur limité. */
export async function journalFailed(
  supabase: SupabaseClient,
  rowId: string,
  errorMessage: string,
): Promise<void> {
  await supabase
    .from('stripe_events')
    .update({ processing_status: 'failed', error_message: errorMessage.slice(0, 500) })
    .eq('id', rowId);
}

/** Marque l'événement comme ignoré (type non géré). */
export async function journalIgnored(
  supabase: SupabaseClient,
  rowId: string,
): Promise<void> {
  await supabase
    .from('stripe_events')
    .update({ processing_status: 'ignored', processed_at: new Date().toISOString() })
    .eq('id', rowId);
}
