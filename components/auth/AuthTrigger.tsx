'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthModal } from './AuthModal';

/**
 * Listens for two auth-open signals and renders the AuthModal when triggered:
 *   1. CustomEvent 'ct:open-auth' — dispatched by AlertButton (unauthenticated tap)
 *   2. URL query param ?auth=required — set by pricing page on Stripe 401 redirect
 *
 * Mount this once in layout.tsx so it is active on every page.
 */
export function AuthTrigger() {
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();

  // Listen for CustomEvent from AlertButton
  useEffect(() => {
    function handleOpen() { setOpen(true); }
    window.addEventListener('ct:open-auth', handleOpen);
    return () => window.removeEventListener('ct:open-auth', handleOpen);
  }, []);

  // Open modal when redirected back with ?auth=required
  useEffect(() => {
    if (searchParams.get('auth') === 'required') {
      setOpen(true);
    }
  }, [searchParams]);

  return <AuthModal isOpen={open} onClose={() => setOpen(false)} />;
}
