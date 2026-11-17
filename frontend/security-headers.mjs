// Preview uses the production policy. Only explicitly isolated auth fixtures may
// replace its single processor origin; this never changes vercel.json or production.
import deployment from '../vercel.json' with { type: 'json' };

export function previewHeaders(env = {}) {
  const headers = Object.fromEntries(deployment.headers.find(rule => rule.source === '/(.*)').headers.map(({key,value}) => [key,value]));
  const url = env.VITE_SUPABASE_URL;
  if (!url || env.VITE_BROWSER_PREVIEW !== '1') return headers;
  const origin = new URL(url);
  if (origin.origin === 'https://chxlkmmkoadgcaomkznd.supabase.co') return headers;
  if (origin.protocol !== 'https:' || !['auth.example.invalid','membership.example.invalid'].includes(origin.host)
      || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('Isolated preview origin required');
  }
  headers['Content-Security-Policy'] = headers['Content-Security-Policy']
    .replaceAll('https://chxlkmmkoadgcaomkznd.supabase.co', origin.origin)
    .replaceAll('wss://chxlkmmkoadgcaomkznd.supabase.co', origin.origin.replace('https:','wss:'));
  return headers;
}
