import {cloudRequest,isCloudActive} from './cloud';
import { browserPreview } from './browser-preview';
import type { Locale } from './domain';

export interface Preferences { locale: Locale; timezone: string; cadence_hours: number; quiet_start: string; quiet_end: string; daily_nudge_cap: number }
export interface Relationship { id: string; label: string }
export interface Checkin { id: string; status: string; version: number; prompt: string; draft: string; deadline: string | null; snoozed_until: string | null; created_at: string }
export interface Entry { id: string; text: string; created_at: string; locale: Locale }
export interface Snapshot { checkins: Checkin[]; jobs: { id: string; status: string }[] }
let token = '';
export class ApiError extends Error {
  constructor(public status: number) { super('Local API request failed'); }
}
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (isCloudActive()) return cloudRequest(path,method,body) as Promise<T>;
  if (import.meta.env.VITE_BROWSER_PREVIEW === '1') return browserPreview(path,method,body) as Promise<T>;
  const response = await fetch(`/api${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<T>;
}
export const api = {
  async connect() { token = (await request<{ token: string }>('/demo/session')).token; },
  preferences: () => request<Preferences>('/preferences'),
  savePreferences: (locale: Locale, timezone: string) => request<Preferences>('/preferences', 'PATCH', { locale, timezone }),
  relationships: () => request<Relationship[]>('/relationships'),
  addRelationship: (label: string) => request<Relationship>('/relationships', 'POST', { label }),
  snapshot: () => request<Snapshot>('/checkins'),
  entries: () => request<Entry[]>('/entries'),
  generate: (relationship_id: string | null) => request('/checkins', 'POST', { relationship_id }),
  decide: (item: Checkin, action: 'approve' | 'skip' | 'snooze', text = '') =>
    request(`/checkins/${encodeURIComponent(item.id)}/decision`, 'POST', { action, version: item.version, text }),
};
