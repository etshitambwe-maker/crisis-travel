'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { searchCountries } from '@/lib/utils/countries';

type Country = ReturnType<typeof searchCountries>[number];

export function CountrySearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Country[]>([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Recherche en temps réel
  useEffect(() => {
    const matches = searchCountries(query);
    setResults(matches);
    setOpen(matches.length > 0 && query.length >= 1);
    setFocused(-1);
  }, [query]);

  // Fermer si clic extérieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navigate = useCallback((country: Country) => {
    setOpen(false);
    setQuery('');
    router.push(`/destination/${country.code}`);
  }, [router]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocused((f) => Math.min(f + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocused((f) => Math.max(f - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focused >= 0 && results[focused]) {
        navigate(results[focused]);
      } else if (results[0]) {
        navigate(results[0]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  const continentLabel: Record<string, string> = {
    Europe: '🌍 Europe',
    Africa: '🌍 Afrique',
    Asia: '🌏 Asie',
    Americas: '🌎 Amériques',
    MiddleEast: '🕌 Moyen-Orient',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: '#0d0d14', border: `1px solid ${open ? '#ff4d2e' : '#2a2a3e'}`,
        borderRadius: open && results.length > 0 ? '12px 12px 0 0' : 12,
        padding: '12px 16px', transition: 'border-color 0.2s',
      }}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 1 && results.length > 0 && setOpen(true)}
          placeholder="Rechercher un pays... (ex: Congo, Thaïlande, Dubai...)"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#e8e8e8', fontSize: '0.95rem', fontFamily: 'var(--font-dm-sans)',
          }}
          autoComplete="off"
          spellCheck={false}
          aria-label="Rechercher un pays"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false); inputRef.current?.focus(); }}
            style={{
              background: 'none', border: 'none', color: '#6b7280',
              cursor: 'pointer', fontSize: '1rem', padding: 0, lineHeight: 1,
            }}
            aria-label="Effacer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: '#0d0d14', border: '1px solid #ff4d2e', borderTop: 'none',
          borderRadius: '0 0 12px 12px', overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          {results.map((country, i) => (
            <button
              key={country.code}
              onClick={() => navigate(country)}
              onMouseEnter={() => setFocused(i)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '10px 16px', background: focused === i ? 'rgba(255,77,46,0.08)' : 'transparent',
                border: 'none', borderBottom: i < results.length - 1 ? '1px solid #1e1e2e' : 'none',
                cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  fontSize: '0.65rem', fontFamily: 'var(--font-space-mono)',
                  background: '#1e1e2e', color: '#6b7280', padding: '2px 6px', borderRadius: 4,
                  letterSpacing: '0.06em',
                }}>
                  {country.code}
                </span>
                <span style={{ color: focused === i ? '#fff' : '#e8e8e8', fontSize: '0.9rem', fontWeight: 500 }}>
                  {country.name}
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                {continentLabel[country.continent] ?? country.continent}
              </span>
            </button>
          ))}

          {/* Hint clavier */}
          <div style={{
            padding: '6px 16px', background: '#080810',
            fontSize: '0.65rem', color: '#3f3f5a', fontFamily: 'var(--font-space-mono)',
            display: 'flex', gap: 12,
          }}>
            <span>↑↓ naviguer</span>
            <span>↵ sélectionner</span>
            <span>Esc fermer</span>
          </div>
        </div>
      )}
    </div>
  );
}
