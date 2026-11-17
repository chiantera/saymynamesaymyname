"""HTTP policy and actual browser enforcement. Local fictional fixtures only."""
import json
from pathlib import Path
from playwright.sync_api import expect

ROOT=Path(__file__).resolve().parents[2]
PRODUCTION='https://chxlkmmkoadgcaomkznd.supabase.co'

def assert_headers(response, fixture_origin):
    actual=response.all_headers()
    for header in json.loads((ROOT/'vercel.json').read_text())['headers'][0]['headers']:
        value=header['value'].replace(PRODUCTION,fixture_origin).replace(PRODUCTION.replace('https:','wss:'),fixture_origin.replace('https:','wss:'))
        assert actual.get(header['key'].lower())==value,(header['key'],actual.get(header['key'].lower()))

def check_browser_policy(page, origin):
    reached=[]
    def forbidden(route):
        reached.append(route.request.url)
        route.fulfill(content_type='text/plain',body='This must never be requested',headers={'Access-Control-Allow-Origin':'*'})
    page.route('https://not-allowed.example.invalid/**',forbidden)
    result=page.evaluate('''async () => {
      window.__policyProbeRan = false;
      const probe = document.createElement('script');
      probe.textContent = 'window.__policyProbeRan = true';
      document.head.append(probe); probe.remove();
      let blocked = false;
      try { await fetch('https://not-allowed.example.invalid/probe'); }
      catch { blocked = true; }
      return {inlineRan:window.__policyProbeRan,blocked};
    }''')
    assert result=={'inlineRan':False,'blocked':True},result
    assert not reached,reached
    assert page.evaluate("document.featurePolicy.allowsFeature('geolocation')")==False
    assert page.evaluate("document.featurePolicy.allowsFeature('microphone')")==False
    # An unprotected local parent tries to embed the protected app. Both pages
    # are local; the child must be rejected by frame-ancestors/X-Frame-Options.
    parent=page.context.new_page()
    parent.route(origin+'/header-frame-fixture',lambda route:route.fulfill(content_type='text/html',body='<iframe src="/"></iframe>'))
    parent.goto(origin+'/header-frame-fixture')
    expect(parent.locator('iframe')).to_be_visible()
    expect(parent.frame_locator('iframe').locator('#root')).to_have_count(0)
    parent.close()
