import { createClient } from '@supabase/supabase-js';

export interface UserAnalysisPayload {
  countryCode: string;
  countryName: string;
  crisisScore: number;
  securityScore?: number;
  geopoliticalScore?: number;
  budgetScore?: number;
  travelType?: string;
  duration?: number;
  budget?: number;
  mode?: string;
  status?: string;
  confidence?: string;
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Persiste une analyse utilisateur dans user_analyses.
 * Best-effort : ne throw jamais, ne bloque jamais /api/analyze.
 * Timeout 3s via Promise.race pour éviter de bloquer le runtime serverless.
 */
export async function persistUserAnalysisBestEffort(
  userId: string | null | undefined,
  payload: UserAnalysisPayload
): Promise<void> {
  if (!userId) return;

  const supabase = getAdminClient();
  if (!supabase) return;

  const insert = supabase.from('user_analyses').insert({
    user_id:            userId,
    country_code:       payload.countryCode,
    country_name:       payload.countryName,
    crisis_score:       payload.crisisScore,
    security_score:     payload.securityScore ?? null,
    geopolitical_score: payload.geopoliticalScore ?? null,
    budget_score:       payload.budgetScore ?? null,
    travel_type:        payload.travelType ?? null,
    duration:           payload.duration ?? null,
    budget:             payload.budget ?? null,
    mode:               payload.mode ?? null,
    status:             payload.status ?? null,
    confidence:         payload.confidence ?? null,
  });

  const timeout = new Promise<{ error: unknown }>(
    (resolve) => setTimeout(() => resolve({ error: new Error('timeout') }), 3000)
  );

  try {
    const { error } = await Promise.race([insert, timeout]);
    if (error) {
      console.warn('[userAnalyses] persist error', error);
    }
  } catch (err) {
    console.warn('[userAnalyses] persist failed', err);
  }
}
