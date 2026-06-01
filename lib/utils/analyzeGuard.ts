// Module-level singleton — one flag shared across all client components in the same page.
// Prevents concurrent analysis triggers from RegionTab, DiscoveryTab, or any future entry point.
let _locked = false;

export function acquireAnalyzeLock(): boolean {
  if (_locked) return false;
  _locked = true;
  return true;
}

export function releaseAnalyzeLock(): void {
  _locked = false;
}

export function isAnalyzeLocked(): boolean {
  return _locked;
}
