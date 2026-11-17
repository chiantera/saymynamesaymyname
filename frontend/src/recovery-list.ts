export interface RecoveryRecord { id: string; checkin_id: string; base_version: number; text: string }

/** Fail closed before an untrusted response reaches a React state updater. */
export function parseRecoveryList(value: unknown): RecoveryRecord[] {
  if (!Array.isArray(value)) throw new Error('Recovery list unavailable');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ids = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !uuid.test(item.id)
        || ids.has(item.id.toLowerCase()) || typeof item.checkin_id !== 'string' || !uuid.test(item.checkin_id)
        || !Number.isSafeInteger(item.base_version) || item.base_version < 0
        || typeof item.text !== 'string' || item.text.length > 10000) {
      throw new Error('Recovery list unavailable');
    }
    ids.add(item.id.toLowerCase());
  }
  return value as RecoveryRecord[];
}
