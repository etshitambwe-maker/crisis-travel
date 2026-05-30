import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateCrisisScore } from '@/lib/services/scoring/crisisScore.service';
import { findCountry } from '@/lib/utils/countries';
import { sendAlertEmail } from '@/lib/email/resend.service';

// Route appelée par Vercel Cron toutes les 6 heures
// Vercel Cron config dans vercel.json

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request): Promise<NextResponse> {
  // Vérification token cron (sécurité)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 503 });
  }

  const supabase = getAdminClient();
  const t0 = Date.now();

  // Récupérer toutes les alertes actives avec les pays uniques
  const { data: alerts, error } = await supabase
    .from('user_alerts')
    .select('user_id, country_code, country_name, threshold_score, last_score')
    .eq('active', true);

  if (error || !alerts) {
    return NextResponse.json({ error: 'Erreur lecture alertes' }, { status: 500 });
  }

  // Dédupliquer les pays à analyser
  const uniqueCountries = [...new Set(alerts.map((a) => a.country_code))];
  const defaultProfile = {
    departureCountry: 'FR', budget: 1500, duration: 7,
    period: 'flexible', travelType: 'solo' as const, mode: 'standard' as const,
  };

  const scoreMap: Record<string, number> = {};
  const notifications: Array<{ userId: string; countryCode: string; countryName: string; newScore: number; oldScore: number }> = [];

  // Calculer les scores en parallèle
  await Promise.allSettled(
    uniqueCountries.map(async (code) => {
      const country = findCountry(code);
      if (!country) return;
      try {
        const score = await calculateCrisisScore(country, defaultProfile);
        scoreMap[code] = score.total;

        // Stocker dans l'historique
        await supabase.from('crisis_score_history').insert({
          country_code: code,
          country_name: country.name,
          score: score.total,
          security_score: score.security.value,
          geopolitical_score: score.geopolitical.value,
          budget_score: score.budget.value,
          practicality_score: score.practicality.value,
          confidence: score.confidence,
        });
      } catch (err) {
        console.error(`[Cron/check-alerts] Erreur calcul ${code}:`, err);
      }
    })
  );

  // Vérifier si des alertes doivent être déclenchées
  for (const alert of alerts) {
    const newScore = scoreMap[alert.country_code];
    if (newScore === undefined) continue;

    const oldScore = alert.last_score ?? 0;
    const scoreImproved = newScore >= alert.threshold_score && oldScore < alert.threshold_score;
    const significantImprovement = newScore - oldScore >= 10;

    if (scoreImproved || significantImprovement) {
      notifications.push({
        userId: alert.user_id,
        countryCode: alert.country_code,
        countryName: alert.country_name,
        newScore,
        oldScore,
      });
    }

    // Mettre à jour le last_score
    await supabase
      .from('user_alerts')
      .update({ last_score: newScore, last_triggered_at: scoreImproved ? new Date().toISOString() : undefined })
      .eq('user_id', alert.user_id)
      .eq('country_code', alert.country_code);
  }

  // Envoyer les emails de notification via Resend
  if (notifications.length > 0) {
    const emailResults = await Promise.allSettled(
      notifications.map(async (n) => {
        // Récupérer l'email de l'utilisateur
        const { data: user } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('id', n.userId)
          .single();

        if (!user) return;

        // Récupérer l'email depuis auth.users (via service role)
        const { data: authUser } = await supabase.auth.admin.getUserById(n.userId);
        if (!authUser?.user?.email) return;

        await sendAlertEmail({
          toEmail: authUser.user.email,
          countryName: n.countryName,
          countryCode: n.countryCode,
          newScore: n.newScore,
          oldScore: n.oldScore,
          changeType: 'general',
        });
      })
    );

    const sent = emailResults.filter((r) => r.status === 'fulfilled').length;
    console.log(`[Cron/check-alerts] ${sent}/${notifications.length} emails envoyés`);
  }

  return NextResponse.json({
    success: true,
    countriesChecked: uniqueCountries.length,
    alertsChecked: alerts.length,
    notificationsTriggered: notifications.length,
    duration: Date.now() - t0,
  });
}
