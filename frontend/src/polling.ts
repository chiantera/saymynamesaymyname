/** Completion-driven reads only. Never schedules an outward action or AI call. */
export interface PollHost {
  visible(): boolean;
  schedule(callback: () => void, milliseconds: number): unknown;
  cancel(timer: unknown): void;
  subscribe(callback: () => void): () => void;
}

export function pollDelay(cloud: boolean, active: boolean, failures = 0): number {
  const base = cloud ? (active ? 5000 : 30000) : 1500;
  return failures ? Math.min(60000, Math.max(30000, base) * 2 ** Math.min(failures - 1, 4)) : base;
}

const browserHost: PollHost = {
  visible: () => !document.hidden,
  schedule: (callback, delay) => window.setTimeout(callback, delay),
  cancel: timer => window.clearTimeout(timer as number),
  subscribe(callback) {
    document.addEventListener('visibilitychange', callback);
    return () => document.removeEventListener('visibilitychange', callback);
  },
};

export function startPolling(task: () => Promise<unknown>, options: {
  delay: (failures: number) => number;
  immediate?: boolean;
  onError?: () => void;
  host?: PollHost;
}) {
  const host = options.host ?? browserHost;
  let disposed = false;
  let pending = false;
  let resume = false;
  let failures = 0;
  let timer: unknown;
  function cancel() { if (timer !== undefined) host.cancel(timer); timer = undefined; }
  function schedule(delay: number) {
    cancel();
    if (!disposed && host.visible()) timer = host.schedule(() => void run(), delay);
  }
  async function run() {
    timer = undefined;
    if (disposed || !host.visible() || pending) return;
    pending = true;
    try { await task(); failures = 0; }
    catch { ++failures; if (!disposed) options.onError?.(); }
    finally {
      pending = false;
      if (!disposed) schedule(resume ? 0 : options.delay(failures));
      resume = false;
    }
  }
  const unsubscribe = host.subscribe(() => {
    cancel();
    if (!host.visible() || disposed) return;
    if (pending) resume = true;
    else void run();
  });
  if (options.immediate !== false && host.visible()) void run();
  else schedule(options.delay(failures));
  return () => { disposed = true; cancel(); unsubscribe(); };
}
