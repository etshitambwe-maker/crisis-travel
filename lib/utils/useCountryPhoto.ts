'use client';
import { getFlagUrl } from './countryPhoto';

// Synchrone — le drapeau est disponible immédiatement, pas d'async
export function useCountryPhoto(code: string, _width = 800, _height = 300): string {
  return getFlagUrl(code);
}
