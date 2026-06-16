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
  // DIAG-001 — logs temporaires, à supprimer avant merge en main
  console.log('[userAnalyses][diag] user present:', !!userId);
  console.log('[userAnalyses][diag] env url present:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('[userAnalyses][diag] env srk present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!userId) return;

  const supabase = getAdminClient();
  console.log('[userAnalyses][diag] admin client created:', !!supabase);
  if (!supabase) return;

  console.log('[userAnalyses][diag] payload:', {
    countryCode:   payload.countryCode,
    countryName:   payload.countryName,
    crisisScore:   payload.crisisScore,
    travelType:    payload.travelType,
    duration:      payload.duration,
    budget:        payload.budget,
    mode:          payload.mode,
    status:        payload.status,
    confidence:    payload.confidence,
  });

  const t0 = Date.now();
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
    const ms = Date.now() - t0;
    if (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = error as any;
      console.warn('[userAnalyses] persist error', error);
      console.warn('[userAnalyses][diag] insert detail', {
        ms,
        message: e?.message,
        code:    e?.code,
        details: e?.details,
        hint:    e?.hint,
      });
    } else {
      console.log('[userAnalyses][diag] insert success in', ms, 'ms');
    }
  } catch (err) {
    console.warn('[userAnalyses] persist failed', err);
  }
}
