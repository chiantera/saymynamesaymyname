import test from 'node:test';
import assert from 'node:assert/strict';
import deployment from '../../vercel.json' with {type:'json'};
import { previewHeaders } from '../security-headers.mjs';

test('production policy covers all routes, scripts, framing, sensitive features and transport', () => {
  assert.equal(deployment.headers.length,1);
  assert.equal(deployment.headers[0].source,'/(.*)');
  const headers=previewHeaders();
  const csp=Object.fromEntries(headers['Content-Security-Policy'].split('; ').map(line => {
    const [key,...value]=line.split(' '); return [key,value.join(' ')];
  }));
  assert.equal(csp['default-src'],"'none'");
  assert.equal(csp['script-src'],"'self'");
  for (const directive of ['script-src-attr','object-src','frame-src','frame-ancestors','base-uri']) assert.equal(csp[directive],"'none'");
  assert.equal(csp['style-src-elem'],"'self'");
  assert.equal(csp['font-src'],"'self'");
  assert.equal(csp['connect-src'],"'self' https://chxlkmmkoadgcaomkznd.supabase.co wss://chxlkmmkoadgcaomkznd.supabase.co");
  assert.equal(headers['Referrer-Policy'],'no-referrer');
  assert.equal(headers['Strict-Transport-Security'],'max-age=31536000');
  assert.equal(headers['X-Content-Type-Options'],'nosniff');
  assert.equal(headers['X-Frame-Options'],'DENY');
  for (const name of ['camera','microphone','geolocation','payment']) assert.ok(headers['Permissions-Policy'].includes(`${name}=()`));
});

test('local security fixtures change only the exact isolated connection origin', () => {
  const original=previewHeaders();
  const fixture=previewHeaders({VITE_BROWSER_PREVIEW:'1',VITE_SUPABASE_URL:'https://auth.example.invalid'});
  assert.equal(fixture['Content-Security-Policy'].replaceAll('auth.example.invalid','chxlkmmkoadgcaomkznd.supabase.co'),original['Content-Security-Policy']);
  for (const key of Object.keys(original).filter(key=>key!=='Content-Security-Policy')) assert.equal(fixture[key],original[key]);
  assert.deepEqual(previewHeaders(),original);
  for (const url of ['https://evil.invalid','https://auth.example.invalid/extra','https://auth.example.invalid?x=1','http://auth.example.invalid','https://auth.example.invalid:444']) {
    assert.throws(()=>previewHeaders({VITE_BROWSER_PREVIEW:'1',VITE_SUPABASE_URL:url}),/Isolated/);
  }
});
