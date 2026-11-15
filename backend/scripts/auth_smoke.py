"""Isolated production-build UI test; every auth/data request is intercepted.

No real users, emails, OAuth credentials, Supabase data or paid services are used.
This proves client behavior, not live provider configuration or server RLS.
"""
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from urllib.request import urlopen
import base64, json, os, shutil, socket, subprocess, time
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[2]
(root/'.local').mkdir(exist_ok=True)
print('Preparing isolated auth fixture.',flush=True)
en = json.loads((root/'shared/locales/en.json').read_text(encoding='utf-8'))
origin = 'http://127.0.0.1:5176'
fake = 'https://auth.example.invalid'
actor_a = '10000000-0000-0000-0000-000000000001'
actor_b = '10000000-0000-0000-0000-000000000002'
flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
node = Path(shutil.which('node'))
npm = os.environ.get('npm_execpath') or str(node.parent/'node_modules/npm/bin/npm-cli.js')
env = {**os.environ, 'VITE_SUPABASE_URL': fake,
       'VITE_SUPABASE_PUBLISHABLE_KEY':'sb_publishable_test_fixture_only', 'VITE_BROWSER_PREVIEW':'1'}
with socket.socket() as probe:
    probe.settimeout(1)
    if probe.connect_ex(('127.0.0.1',5176)) == 0:
        raise SystemExit('Test port 5176 is busy; no process was changed.')
print('Building production frontend with simulated endpoints.',flush=True)
subprocess.run([str(node),npm,'--prefix','frontend','run','build'],cwd=root,env=env,check=True,creationflags=flags,timeout=120)
log=(root/'.local/auth-preview.log').open('w',encoding='utf-8')
server = subprocess.Popen([str(node),str(root/'frontend/node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5176','--strictPort'],
                          cwd=root/'frontend',env=env,stdout=log,stderr=log,creationflags=flags)
records = {actor_a:[],actor_b:[]}
checkins = {actor_a:[],actor_b:[]}
profiles = {}
requests = []
admitted = True

def user(actor):
    return {'id':actor,'aud':'authenticated','role':'authenticated',
            'email':('a' if actor == actor_a else 'b')+'@example.invalid',
            'email_confirmed_at':'2026-11-15T00:00:00Z','app_metadata':{},'user_metadata':{},
            'identities':[],'created_at':'2026-11-15T00:00:00Z'}

def session(actor):
    def part(value):
        return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
    jwt = part({'alg':'HS256'})+'.'+part({'sub':actor,'exp':int(time.time())+3600,'role':'authenticated'})+'.fixture'
    return {'access_token':jwt,'refresh_token':'fixture-refresh','token_type':'bearer',
            'expires_in':3600,'user':user(actor)}

def handle(route):
    req=route.request
    url=urlparse(req.url)
    path=url.path
    body=json.loads(req.post_data or '{}')
    requests.append((path,url.query,body))
    auth=req.headers.get('authorization','')
    actor=actor_a
    if auth.startswith('Bearer ey'):
        payload=auth.split('.')[1]
        actor=json.loads(base64.urlsafe_b64decode(payload+'='*(-len(payload)%4)))['sub']
    def reply(value,status=200):
        route.fulfill(status=status,content_type='application/json',body=json.dumps(value),
                      headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'*'})
    if req.method=='OPTIONS': return reply({})
    if path=='/auth/v1/token':
        actor=actor_b if body.get('email','').startswith('b@') else actor_a
        if body.get('password')=='incorrect-password': return reply({'error':'invalid_grant','error_description':'invalid credentials'},400)
        return reply(session(actor))
    if path=='/auth/v1/user': return reply(user(actor))
    if path=='/auth/v1/logout': return reply({})
    if path=='/auth/v1/signup': return reply({'user':user(actor_a),'session':None})
    if path=='/auth/v1/recover': return reply({})
    if path=='/auth/v1/authorize':
        return route.fulfill(content_type='text/html',body='<h1>Simulated Google redirect</h1>')
    if path=='/rest/v1/rpc/has_beta_access': return reply(admitted)
    if path=='/rest/v1/rpc/refresh_private_checkins': return reply(None)
    if path=='/rest/v1/companion_profiles':
        if req.method=='POST':
            assert body['owner']==actor
            assert 'resolution=ignore-duplicates' in req.headers.get('prefer','')
            profiles.setdefault(actor,body)
            return reply(None,201)
        return reply([profiles[actor]] if actor in profiles else [])
    if path=='/rest/v1/companion_relationships': return reply([])
    if path=='/rest/v1/companion_entries': return reply(records[actor])
    if path=='/rest/v1/companion_checkins': return reply(checkins[actor])
    if path=='/rest/v1/rpc/create_private_checkin':
        item={'id':'20000000-0000-0000-0000-000000000001','status':'pending','version':0,
              'prompt':body['p_prompt'],'draft':body['p_draft'],'created_at':'2026-11-15T00:00:00Z',
              'deadline':'2099-01-01T00:00:00Z','snoozed_until':None}
        checkins[actor].append(item)
        return reply(item)
    if path=='/rest/v1/rpc/decide_private_checkin':
        checkins[actor][0]['status']='fulfilled'
        records[actor].append({'id':'fixture-entry','text':body['p_text'],'locale':'en','created_at':'2026-11-15T00:00:00Z'})
        return reply({'status':'fulfilled'})
    raise AssertionError('Unexpected mocked endpoint: '+path)

try:
    for _ in range(80):
        if server.poll() is not None:
            log.flush()
            raise RuntimeError('Preview exited: '+(root/'.local/auth-preview.log').read_text(encoding='utf-8'))
        try:
            if urlopen(origin,timeout=1).status==200: break
        except Exception: time.sleep(.25)
    else: raise RuntimeError('Preview did not start')
    with sync_playwright() as p:
        paths=sorted((Path(os.environ.get('LOCALAPPDATA',''))/'ms-playwright').glob('chromium-*/chrome-win64/chrome.exe'))
        browser=p.chromium.launch(executable_path=str(paths[-1]) if paths else None)
        errors=[]
        def new_page():
            context=browser.new_context(locale='en-US')
            context.route(fake+'/**',handle)
            page=context.new_page()
            page.on('pageerror',lambda e: errors.append(str(e)))
            return context,page
        def login(page,email='a@example.invalid'):
            page.get_by_role('button',name=en['cloudAccount'],exact=True).click()
            page.get_by_label(en['email'],exact=True).fill(email)
            page.get_by_label(en['password'],exact=True).fill('fictional-test-password')
            page.get_by_role('button',name=en['signIn'],exact=True).click()
        context,page=new_page()
        page.goto(origin)
        page.get_by_role('button',name=en['cloudAccount'],exact=True).click()
        page.get_by_role('button',name=en['createAccount'],exact=True).click()
        page.get_by_label(en['email'],exact=True).fill('new@example.invalid')
        page.get_by_label(en['password'],exact=True).fill('fictional-test-password')
        page.get_by_role('button',name=en['createAccount'],exact=True).click()
        expect(page.get_by_role('status')).to_have_text(en['confirmationSent'])
        signup=next(r for r in requests if r[0]=='/auth/v1/signup')
        assert parse_qs(signup[1])['redirect_to']==[origin+'/auth/callback']
        page.get_by_role('button',name=en['backSignIn']).click()
        page.get_by_role('button',name=en['forgotPassword']).click()
        page.get_by_role('button',name=en['sendRecovery']).click()
        expect(page.get_by_role('status')).to_have_text(en['recoverySent'])
        reset=next(r for r in requests if r[0]=='/auth/v1/recover')
        assert parse_qs(reset[1])['redirect_to']==[origin+'/auth/recovery']
        page.goto(origin+'/auth/recovery?code=fixture-recovery-code&next=https://evil.invalid')
        expect(page.get_by_role('heading',name=en['setPassword'])).to_be_visible()
        assert page.url==origin+'/'
        page.get_by_label(en['newPassword'],exact=True).fill('new-fictional-password')
        page.get_by_label(en['confirmPassword'],exact=True).fill('different-fictional-password')
        page.get_by_role('button',name=en['setPassword'],exact=True).click()
        expect(page.get_by_role('status')).to_have_text(en['passwordMismatch'])
        page.get_by_label(en['newPassword'],exact=True).fill('new-fictional-password')
        page.get_by_label(en['confirmPassword'],exact=True).fill('new-fictional-password')
        page.get_by_role('button',name=en['setPassword'],exact=True).click()
        expect(page.get_by_role('heading',name=en['signIn'],exact=True)).to_be_visible()
        expect(page.get_by_role('status')).to_have_text(en['passwordUpdated'])
        page.get_by_role('button',name=en['localPreview'],exact=True).click()
        admitted=False
        login(page)
        expect(page.get_by_text(en['betaExplanation'])).to_be_visible()
        expect(page.locator('.app-shell')).to_have_count(0)
        page.get_by_role('button',name=en['signOut'],exact=True).click()
        admitted=True
        login(page)
        page.get_by_role('button',name=en['generate']).click()
        page.get_by_role('textbox',name=en['review']).fill('Private fictional reflection for actor A')
        page.get_by_role('button',name=en['approve'],exact=True).click()
        expect(page.locator('.entry')).to_have_text(__import__('re').compile('Private fictional reflection for actor A'))
        other,second=new_page()
        second.goto(origin)
        login(second)
        expect(second.locator('.entry')).to_contain_text('Private fictional reflection for actor A')
        page.get_by_role('button',name=en['signOut'],exact=True).click()
        expect(page.locator('.entry')).to_have_count(0)
        login(page,'b@example.invalid')
        expect(page.get_by_role('button',name=en['signOut'],exact=True)).to_be_visible()
        expect(page.locator('.entry')).to_have_count(0)
        page.get_by_role('button',name=en['signOut'],exact=True).click()
        page.get_by_role('button',name=en['cloudAccount'],exact=True).click()
        page.get_by_role('button',name=en['continueGoogle']).click()
        expect(page.get_by_role('heading',name='Simulated Google redirect')).to_be_visible()
        google=parse_qs(urlparse(page.url).query)
        assert google['redirect_to']==[origin+'/auth/callback']
        assert set(google['scopes'][0].split())=={'openid','email','profile'}
        assert google.get('code_challenge_method')==['s256']
        page.goto(origin+'/auth/callback?error=access_denied&error_description=private-info')
        expect(page.get_by_role('status')).to_have_text(en['authLinkError'])
        assert page.url==origin+'/'
        expect(page.get_by_text('private-info')).to_have_count(0)
        assert not errors, errors
        context.close();other.close();browser.close()
finally:
    if server.poll() is None:
        if os.name=='nt': subprocess.run(['taskkill','/pid',str(server.pid),'/t','/f'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=flags)
        else: server.terminate()
    server.wait(timeout=10)
    log.close()
print('Auth client smoke passed: signup, PKCE recovery, pending admission, two-client sync, account isolation, Google request and rejected callback; all endpoints simulated.')
