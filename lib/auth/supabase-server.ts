import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Peut être appelé depuis un Server Component read-only — on ignore
          }
        },
      },
    }
  );
}

export async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}

export async function getUserWithSubscription() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, isPremium: false };

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('subscription_tier, subscription_end_date')
    .eq('id', user.id)
    .single();

  if (profileError) {
    // Erreur Supabase lors de la lecture du profil : l'utilisateur sera traité comme free.
    // Un premium dégradé silencieusement ici est un P1 — on log pour détecter les pannes.
    console.error('[auth/supabase] getUserWithSubscription — profil illisible, fallback free', {
      userId: user.id,
      error: profileError.message,
    });
  }

  const isPremium = profile?.subscription_tier === 'premium'
    && (!profile.subscription_end_date || new Date(profile.subscription_end_date) > new Date());

  return { user, isPremium };
}
