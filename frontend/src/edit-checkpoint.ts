/** Local browser recovery. Storage is account-scoped, not encrypted. */
export type EditCheckpoint = {id:string; checkin_id:string; base_version:number; revision:number; text:string};
const prefix = (owner:string) => `companion:edit:${owner}:`;

export function saveLocalCheckpoint(owner:string, item:EditCheckpoint):boolean {
  try { localStorage.setItem(prefix(owner)+item.id, JSON.stringify(item)); return true; }
  catch { return false; }
}

export function removeLocalCheckpoint(owner:string, id:string):boolean {
  try { localStorage.removeItem(prefix(owner)+id); return true; }
  catch { return false; }
}

export function validCheckpoint(value:unknown):value is EditCheckpoint {
  if (!value || typeof value !== 'object') return false;
  const v=value as Record<string,unknown>;
  const uuid=(x:unknown) => typeof x==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
  return uuid(v.id) && uuid(v.checkin_id) && Number.isSafeInteger(v.base_version) && (v.base_version as number)>=0 &&
    Number.isSafeInteger(v.revision) && (v.revision as number)>0 && typeof v.text==='string' && v.text.length<=10000;
}

export function readLocalCheckpoints(owner:string):EditCheckpoint[] {
  const items:EditCheckpoint[]=[];
  try {
    for (let i=0;i<localStorage.length;i++) {
      const key=localStorage.key(i);
      if (!key?.startsWith(prefix(owner))) continue;
      try {
        const value:unknown=JSON.parse(localStorage.getItem(key) ?? 'null');
        if (validCheckpoint(value) && key===prefix(owner)+value.id) items.push(value);
      } catch { /* Leave malformed data untouched. */ }
    }
  } catch { /* Storage unavailable; live editing reports failed writes. */ }
  return items;
}
