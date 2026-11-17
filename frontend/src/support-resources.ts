import catalog from '../../shared/crisis-resources.json' with { type: 'json' };

export const supportKinds = ['manual', 'self_harm', 'violence', 'stalking', 'refuse', 'unavailable'] as const;
export type SupportKind = typeof supportKinds[number];
export function validSupportKind(value: unknown): SupportKind {
  return typeof value === 'string' && supportKinds.some(kind => kind === value)
    ? value as SupportKind : 'unavailable';
}
export const countries = catalog.regions.flatMap(region => region.countries).sort();
export const directories = catalog.directories;
// Topic-specific counseling and automatic responses await professional locale review.
export function supportPathKey(kind: SupportKind, locale: string) {
  const reviewed: readonly string[] = catalog.reviewed_locales;
  return `supportPath_${catalog.professional_copy_reviewed === true && reviewed.includes(locale) ? kind : 'manual'}`;
}
// Country is explicit and ephemeral. Language, timezone and IP are not inputs.
export function emergencyResources(country: string, now = new Date()) {
  const region = catalog.regions.find(item => item.countries.includes(country));
  if (!region) return { services: [], source: null, verified: null, stale: false };
  const time = now.getTime();
  const current = Number.isFinite(time) && time >= Date.parse(region.verified_on + 'T00:00:00Z')
    && time < Date.parse(region.valid_until + 'T00:00:00Z');
  return { services: current ? region.services : [], source: region.source,
    verified: region.verified_on, stale: !current };
}
export const quickExitURL = 'https://www.wikipedia.org/';
