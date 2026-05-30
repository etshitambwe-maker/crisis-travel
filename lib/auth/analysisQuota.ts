import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const FREE_LIMIT = 3; // analyses gratuites par mois

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

function getAdminClient(): AnySupabaseClient | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export interface QuotaResult {
  allowed: boolean;
  isPremium: boolean;
  remaining: number;
  used: number;
  limit: number;
}

export async function checkAndIncrementQuota(userId: string | null): Promise<QuotaResult> {
  // Pas de Supabase configuré → laisser passer (dev local)
  const supabase = getAdminClient();
  if (!supabase) {
    return { allowed: true, isPremium: false, remaining: FREE_LIMIT, used: 0, limit: FREE_LIMIT };
  }

  // Utilisateur non connecté → quota IP géré par rate limiter uniquement
  if (!userId) {
    return { allowed: true, isPremium: false, remaining: FREE_LIMIT, used: 0, limit: FREE_LIMIT };
  }

  // Récupérer le profil
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('subscription_tier, subscription_end_date, analyses_count_month, analyses_reset_date')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    // Profil inexistant (race condition trigger) → créer et laisser passer
    await supabase.from('user_profiles').upsert({ id: userId }, { onConflict: 'id' });
    return { allowed: true, isPremium: false, remaining: FREE_LIMIT, used: 0, limit: FREE_LIMIT };
  }

  // Vérifier si Premium actif
  const isPremium = profile.subscription_tier === 'premium'
    && (!profile.subscription_end_date || new Date(profile.subscription_end_date) > new Date());

  if (isPremium) {
    await incrementCount(supabase, userId, profile);
    return { allowed: true, isPremium: true, remaining: 999, used: profile.analyses_count_month, limit: 999 };
  }

  // Reset mensuel si nécessaire
  const resetDate = new Date(profile.analyses_reset_date);
  const now = new Date();
  const needsReset = now.getFullYear() > resetDate.getFullYear()
    || now.getMonth() > resetDate.getMonth();

  if (needsReset) {
    await supabase
      .from('user_profiles')
      .update({ analyses_count_month: 0, analyses_reset_date: now.toISOString() })
      .eq('id', userId);
    profile.analyses_count_month = 0;
  }

  const used = profile.analyses_count_month;
  const remaining = Math.max(0, FREE_LIMIT - used);

  if (used >= FREE_LIMIT) {
    return { allowed: false, isPremium: false, remaining: 0, used, limit: FREE_LIMIT };
  }

  // Incrémenter
  await incrementCount(supabase, userId, { ...profile, analyses_count_month: used });
  return { allowed: true, isPremium: false, remaining: remaining - 1, used: used + 1, limit: FREE_LIMIT };
}

async function incrementCount(
  supabase: AnySupabaseClient,
  userId: string,
  profile: { analyses_count_month: number }
) {
  await supabase
    .from('user_profiles')
    .update({ analyses_count_month: (profile.analyses_count_month ?? 0) + 1 })
    .eq('id', userId);
}
