'use client';

/**
 * FRONT-001 — DestinationImage
 * ────────────────────────────────────────────────────────────────────────
 * Renders a destination's image slot with a guaranteed-visible result:
 *
 *   Layer 1 (always painted): premium duotone derived from country identity.
 *   Layer 2 (when a real photo exists): the curated local photograph on top.
 *
 * "No broken images" is guaranteed STRUCTURALLY, not via an onError race:
 * the photo <img> is only mounted when the caller explicitly opts in
 * (`hasPhoto` / explicit `src`). Until a curated photo is wired up, the
 * slot renders duotone ONLY — there is never a broken <img> in the DOM.
 * When a photo IS mounted, onError still hides it as a second safety net.
 * Adding a curated photo later = pass `hasPhoto` (or a manifest flag); no
 * structural change required.
 *
 * Plain <img> by design (next.config has no images config).
 */

import { useState } from 'react';
import {
  getDestinationImagery,
  duotoneBackground,
} from '@/lib/design/destinationImagery';

export type ImageSlot = 'hero' | 'card' | 'editorial';

export interface DestinationImageProps {
  /** ISO-2 country code. */
  code: string;
  /** Which curated asset to use + label semantics. */
  slot?: ImageSlot;
  /** Aspect ratio (CSS aspect-ratio string), ignored when `height` is set. */
  aspect?: string;
  /** Fixed height in px (overrides aspect). */
  height?: number;
  /**
   * Explicit photo src. When provided, this exact URL is used. When omitted,
   * a photo is only attempted if `hasPhoto` is true (then the registry's
   * curated local path for the slot is used). Otherwise: duotone only.
   */
  src?: string | null;
  /**
   * Opt in to mounting the curated local photo for this slot. Leave false
   * (default) until a real photo exists at the registry path — this is what
   * structurally guarantees no broken <img> appears in the DOM.
   */
  hasPhoto?: boolean;
  /** Accessible alt text (defaults to the country name). */
  alt?: string;
  /** Show the small slot label (IMG · NAME · SLOT). Default true. */
  showLabel?: boolean;
  /**
   * Bottom scrim for text legibility over photos. 'none' keeps the photo
   * fully unobscured; 'soft'/'strong' fan up only from the bottom — the
   * image slot is never fully darkened. Default 'soft'.
   */
  scrim?: 'none' | 'soft' | 'strong';
  className?: string;
  /** Overlay content positioned absolutely inside the slot. */
  children?: React.ReactNode;
}

const SCRIMS: Record<'none' | 'soft' | 'strong', string | undefined> = {
  none: undefined,
  soft: 'linear-gradient(180deg, transparent 40%, rgba(6,6,10,.45) 78%, rgba(6,6,10,.85))',
  strong:
    'linear-gradient(180deg, transparent 28%, rgba(6,6,10,.6) 70%, rgba(6,6,10,.95))',
};

export function DestinationImage({
  code,
  slot = 'hero',
  aspect = '16/9',
  height,
  src,
  hasPhoto = false,
  alt,
  showLabel = true,
  scrim = 'soft',
  className,
  children,
}: DestinationImageProps) {
  const ident = getDestinationImagery(code);
  const [photoFailed, setPhotoFailed] = useState(false);

  // A photo is only mounted when the caller explicitly provides a `src` or
  // opts in via `hasPhoto`. With neither, the slot is duotone-only and no
  // <img> ever enters the DOM → no broken images, structurally.
  const resolvedSrc =
    src != null
      ? src
      : hasPhoto
        ? slot === 'card'
          ? ident.cardImage
          : ident.heroImage
        : null;
  const showPhoto = Boolean(resolvedSrc) && !photoFailed;

  const sizeStyle: React.CSSProperties = height
    ? { height }
    : { aspectRatio: aspect };
  const scrimBg = SCRIMS[scrim];

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: '#0a0a0e',
        border: '1px solid var(--ctv3-line-soft, #1c1c22)',
        ...sizeStyle,
      }}
    >
      {/* Layer 1 — premium duotone (always visible) */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: duotoneBackground(ident.fallback),
        }}
      />

      {/* Layer 2 — curated local photograph (covers duotone when present) */}
      {showPhoto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedSrc as string}
          alt={alt ?? ident.imageAlt}
          loading="lazy"
          onError={() => setPhotoFailed(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'saturate(0.9) contrast(1.04) brightness(0.95)',
          }}
        />
      )}

      {/* Bottom-only scrim for text legibility (never fully darkens the slot) */}
      {scrimBg && (
        <div
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, background: scrimBg }}
        />
      )}

      {/* Corner crosshairs (v3 tactical accent) */}
      <Corner pos="tl" />
      <Corner pos="tr" />
      <Corner pos="bl" />
      <Corner pos="br" />

      {/* Slot label — shows the editorial logic and which layer is active */}
      {showLabel && (
        <div
          className="ctv3-mono"
          style={{
            position: 'absolute',
            left: 14,
            bottom: 12,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            fontSize: 9,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(245,245,247,.6)',
          }}
        >
          <span
            style={{
              width: 4,
              height: 4,
              background: ident.accent,
              borderRadius: '50%',
            }}
          />
          <span>
            IMG · {ident.name.toUpperCase()} · {slot.toUpperCase()}
            {!showPhoto && ' · DUOTONE'}
          </span>
        </div>
      )}

      {children}
    </div>
  );
}

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const red = 'var(--ctv3-red, #e4332b)';
  const base: React.CSSProperties = {
    position: 'absolute',
    width: 10,
    height: 10,
    pointerEvents: 'none',
  };
  const map: Record<typeof pos, React.CSSProperties> = {
    tl: { top: 8, left: 8, borderTop: `1px solid ${red}`, borderLeft: `1px solid ${red}` },
    tr: { top: 8, right: 8, borderTop: `1px solid ${red}`, borderRight: `1px solid ${red}` },
    bl: { bottom: 8, left: 8, borderBottom: `1px solid ${red}`, borderLeft: `1px solid ${red}` },
    br: { bottom: 8, right: 8, borderBottom: `1px solid ${red}`, borderRight: `1px solid ${red}` },
  };
  return <span aria-hidden="true" style={{ ...base, ...map[pos] }} />;
}

export default DestinationImage;
