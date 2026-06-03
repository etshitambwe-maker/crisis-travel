/**
 * FRONT-001 — CountryFlag
 * Real flag image (flagcdn via getFlagUrl). Plain <img> by design:
 * next.config has no images config, so next/image is intentionally avoided.
 */
import { getFlagUrl } from '@/lib/utils/countryPhoto';

export interface CountryFlagProps {
  /** ISO-2 country code (case-insensitive). */
  code: string;
  /** Rendered width in px. Height is derived from a 3:2 flag ratio. */
  width?: number;
  /** Optional explicit height (px); overrides the derived ratio. */
  height?: number;
  /** Hairline border + soft shadow (default on). */
  border?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const FLAG_RATIO = 3 / 2;

export function CountryFlag({
  code,
  width = 32,
  height,
  border = true,
  className,
  style,
}: CountryFlagProps) {
  const h = height ?? Math.round(width / FLAG_RATIO);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getFlagUrl(code)}
      alt={`Drapeau ${code.toUpperCase()}`}
      width={width}
      height={h}
      loading="lazy"
      className={className}
      style={{
        display: 'block',
        width,
        height: h,
        objectFit: 'cover',
        border: border ? '1px solid rgba(255,255,255,0.12)' : 'none',
        boxShadow: border ? '0 1px 6px rgba(0,0,0,0.4)' : 'none',
        ...style,
      }}
    />
  );
}

export default CountryFlag;
