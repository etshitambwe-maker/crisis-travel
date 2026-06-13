/**
 * Sanitize a post-login `next` redirect target.
 *
 * Security model: a `next` value comes from an attacker-controllable query
 * param (`/auth/callback?next=...`). We must NEVER redirect to anything that
 * could leave our origin — that would be an open-redirect vector.
 *
 * Only internal, root-relative paths are allowed:
 *   accepted:  "/destination/FR", "/results?budget=medium&duration=7", "/pricing"
 *   rejected:  "https://evil.com", "//evil.com", "/\evil.com",
 *              "javascript:alert(1)", "", "  ", non-strings
 *
 * The fallback is always "/".
 */
export const DEFAULT_NEXT = '/';

// Leading URL scheme like "javascript:", "http:", "data:".
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
// Any ASCII control char (0x00-0x1F, 0x7F) or whitespace anywhere — used to
// smuggle newlines/tabs that break out of the path.
// eslint-disable-next-line no-control-regex
const CONTROL_OR_SPACE_RE = /[\x00-\x1f\x7f\s]/;

export function safeNext(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_NEXT;

  const value = raw.trim();

  // Must be a non-empty, root-relative path.
  if (value.length === 0) return DEFAULT_NEXT;
  if (value[0] !== '/') return DEFAULT_NEXT;

  // Reject protocol-relative ("//evil.com") and backslash-smuggling
  // ("/\evil.com") which browsers may normalize to "//".
  if (value[1] === '/' || value[1] === '\\') return DEFAULT_NEXT;

  // Reject control chars / whitespace and any scheme-like prefix.
  if (CONTROL_OR_SPACE_RE.test(value)) return DEFAULT_NEXT;
  if (SCHEME_RE.test(value)) return DEFAULT_NEXT;

  return value;
}
