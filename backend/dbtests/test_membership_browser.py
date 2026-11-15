"""Production client + real SQL/RLS. Auth and HTTP transport are simulated locally.

No live accounts, invitation emails, hosted tokens or private beta data are used.
"""
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import build_opener, ProxyHandler
import base64, datetime, json, os, shutil, socket, subprocess, time
from psycopg import sql
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
import psycopg
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[2]
ORIGIN='http://127.0.0.1:5177'
FAKE='https://membership.example.invalid'

def test_membership_browser(state):
    en=json.loads((ROOT/'shared/locales/en.json').read_text(encoding='utf-8'))
    with socket.socket() as probe:
        probe.settimeout(1)
        assert probe.connect_ex(('127.0.0.1',5177))!=0,'Test port 5177 is busy; no process was changed.'
    node=Path(shutil.which('node'))
    npm=os.environ.get('npm_execpath') or str(node.parent/'node_modules/npm/bin/npm-cli.js')
    env={**os.environ,'VITE_SUPABASE_URL':FAKE,'VITE_SUPABASE_PUBLISHABLE_KEY':'sb_publishable_fixture_only','VITE_BROWSER_PREVIEW':'1'}
    flags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0
    subprocess.run([str(node),npm,'--prefix','frontend','run','build'],cwd=ROOT,env=env,check=True,creationflags=flags,timeout=120)
    (ROOT/'.local/screenshots').mkdir(parents=True,exist_ok=True)
    log=(ROOT/'.local/membership-preview.log').open('w',encoding='utf-8')
    server=subprocess.Popen([str(node),str(ROOT/'frontend/node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5177','--strictPort'],cwd=ROOT/'frontend',env=env,stdout=log,stderr=log,creationflags=flags)
    tokens={}
    errors=[]
    def user(letter):
        return {'id':state.people[letter],'email':state.emails[letter],'aud':'authenticated','role':'authenticated',
                'email_confirmed_at':'2026-11-15T00:00:00Z','app_metadata':{},'user_metadata':{},'identities':[],'created_at':'2026-11-15T00:00:00Z'}
    def session(letter):
        part=lambda value:base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
        token=part({'alg':'HS256'})+'.'+part({'sub':state.people[letter],'exp':int(time.time())+3600})+'.fixture'
        tokens[token]=letter
        return {'access_token':token,'refresh_token':'fixture-refresh','token_type':'bearer','expires_in':3600,'user':user(letter)}
    def handle(route):
        request=route.request
        path=urlparse(request.url).path
        body=json.loads(request.post_data or '{}')
        def reply(value,status=200):
            route.fulfill(status=status,content_type='application/json',body=json.dumps(value,default=lambda value:value.isoformat() if isinstance(value,(datetime.datetime,datetime.date)) else str(value)),headers={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS'})
        if request.method=='OPTIONS': return reply({})
        if path=='/auth/v1/token':
            letter=next(k for k,v in state.emails.items() if v==body['email'])
            return reply(session(letter))
        actor=tokens.get(request.headers.get('authorization','').removeprefix('Bearer '))
        if not actor:return reply({'message':'Unauthorized fixture'},401)
        if path=='/auth/v1/user':return reply(user(actor))
        if path=='/auth/v1/logout':return reply({})
        try:
            with state.client(actor) as conn:
                if path=='/rest/v1/rpc/has_beta_access':return reply(conn.execute('select public.has_beta_access()').fetchone()[0])
                if path=='/rest/v1/rpc/relationship_workspace':return reply(conn.execute('select public.relationship_workspace()').fetchone()[0])
                if path=='/rest/v1/rpc/relationship_action':return reply(conn.execute('select public.relationship_action(%s,%s)',(body['p_action'],Jsonb(body['p_args']))).fetchone()[0])
                if path=='/rest/v1/rpc/relationship_invite_preview':return reply(conn.execute('select public.relationship_invite_preview(%s)',(body['p_token'],)).fetchone()[0])
                if path=='/rest/v1/rpc/refresh_private_checkins':return reply(conn.execute('select public.refresh_private_checkins()').fetchone()[0])
                table=path.removeprefix('/rest/v1/')
                if table in ('companion_profiles','companion_relationships','companion_entries','companion_checkins'):
                    if request.method=='POST' and table=='companion_profiles':
                        conn.execute('insert into public.companion_profiles(owner,locale,timezone) values(%s,%s,%s) on conflict(owner) do nothing',(body['owner'],body['locale'],body['timezone']))
                        return reply(None,201)
                    assert request.method=='GET',f'Unexpected table write: {table}'
                    return reply(conn.cursor(row_factory=dict_row).execute(sql.SQL('select * from public.{}').format(sql.Identifier(table))).fetchall())
        except psycopg.Error:
            return reply({'code':'P0001','message':'Unavailable fixture action'},400)
        raise AssertionError('Unexpected fixture endpoint: '+path)

    try:
        opener=build_opener(ProxyHandler({}))
        for _ in range(60):
            if server.poll() is not None:raise AssertionError('Vite preview exited')
            try:
                if opener.open(ORIGIN,timeout=1).status==200:break
            except Exception:time.sleep(.2)
        else:raise AssertionError('Preview startup timeout')
        with state.client('A') as conn:
            item=conn.execute("select public.create_private_checkin('en','Private','Private draft')").fetchone()[0]
            conn.execute("select public.decide_private_checkin(%s,'approve',0,'Private fictional A history')",(item['id'],))
        with sync_playwright() as p:
            paths=sorted((Path(os.environ.get('LOCALAPPDATA',''))/'ms-playwright').glob('chromium-*/chrome-win64/chrome.exe'))
            browser=p.chromium.launch(executable_path=str(paths[-1]) if paths else None)
            contexts=[]
            def page():
                context=browser.new_context(locale='en-US',viewport={'width':1280,'height':1000})
                context.route(FAKE+'/**',handle)
                result=context.new_page();result.on('pageerror',lambda error:errors.append(str(error)))
                contexts.append(context);return result
            def login(page,letter):
                page.get_by_label(en['email'],exact=True).fill(state.emails[letter])
                page.get_by_label(en['password'],exact=True).fill('fixture-only-password')
                page.get_by_role('button',name=en['signIn'],exact=True).click()
            def refresh(page):page.get_by_role('button',name=en['refreshMemberships'],exact=True).click()
            def space(page):return page.get_by_role('article',name='Fictional membership space',exact=True)
            def propose(page,letter):
                space(page).get_by_label(en['inviteEmail'],exact=True).fill(state.emails[letter])
                space(page).get_by_role('button',name=en['proposeInvitation'],exact=True).click()
            def join(page,link,letter,alias):
                page.goto(link)
                expect(page.get_by_role('heading',name=en['signIn'],exact=True)).to_be_visible()
                login(page,letter)
                review=page.get_by_role('region',name=en['invitationReview'])
                expect(review.get_by_role('heading',name='Fictional membership space')).to_be_visible()
                assert page.url==ORIGIN+'/join'
                assert not page.evaluate('(token) => Object.values(localStorage).some(value=>value.includes(token))',link.split('invite=')[1])
                review.get_by_label(en['memberAlias'],exact=True).fill(alias)
                review.get_by_label(en['joinConsent'],exact=True).check()
                review.get_by_role('button',name=en['joinRelationship'],exact=True).click()
                expect(space(page)).to_be_visible()
                assert page.url==ORIGIN+'/'
            a,b,c=page(),page(),page()
            a.goto(ORIGIN)
            a.get_by_role('button',name=en['cloudAccount'],exact=True).click();login(a,'A')
            expect(a.locator('.entry')).to_contain_text('Private fictional A history')
            a.get_by_role('button',name=en['relationships'],exact=True).click()
            a.get_by_label(en['relationshipLabel'],exact=True).fill('Fictional membership space')
            a.get_by_label(en['memberAlias'],exact=True).fill('Alex')
            a.get_by_role('button',name=en['createRelationship'],exact=True).click()
            expect(space(a)).to_be_visible()
            propose(a,'B')
            space(a).get_by_role('button',name=en['createInviteLink'],exact=True).click()
            link_b=space(a).get_by_label(en['inviteLink'],exact=True).input_value()
            join(b,link_b,'B','Blair')
            b.get_by_role('button',name=en['home'],exact=True).click()
            expect(b.locator('.entry')).to_have_count(0)
            b.get_by_role('button',name=en['relationships'],exact=True).click()
            refresh(a);propose(a,'C')
            expect(space(a).get_by_role('button',name=en['createInviteLink'],exact=True)).to_be_disabled()
            refresh(b)
            space(b).get_by_role('button',name=en['approveInvitation'],exact=True).click()
            refresh(a)
            expect(space(a).get_by_role('button',name=en['createInviteLink'],exact=True)).to_be_enabled()
            space(a).get_by_role('button',name=en['createInviteLink'],exact=True).click()
            link_c=space(a).get_by_label(en['inviteLink'],exact=True).input_value()
            join(c,link_c,'C','Casey')
            refresh(a)
            space(a).get_by_role('button',name=en['blockPerson'].replace('{{name}}','Blair'),exact=True).click()
            dialog=a.get_by_role('dialog')
            expect(dialog).to_be_visible();dialog.get_by_role('button',name=en['confirmBlock'],exact=True).click()
            expect(space(a).get_by_role('button',name=en['unblockPerson'].replace('{{name}}','Blair'),exact=True)).to_be_visible()
            refresh(b)
            expect(space(b).locator('.member-row').filter(has_text='Casey')).to_contain_text(en['contactAvailable'])
            expect(space(b).locator('.member-row').filter(has_text='Alex')).to_contain_text(en['contactUnavailable'])
            refresh(c)
            expect(space(c).locator('.member-row').filter(has_text='Blair')).to_contain_text(en['contactAvailable'])
            a.set_viewport_size({'width':390,'height':844})
            a.screenshot(path=str(ROOT/'.local/screenshots/membership-mobile.png'),full_page=True)
            overflow=a.evaluate('''() => [...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).filter(e=>e.right>innerWidth+1)''')
            assert a.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'Membership mobile overflow: {overflow}'
            a.set_viewport_size({'width':1280,'height':1000})
            a.screenshot(path=str(ROOT/'.local/screenshots/membership-desktop.png'),full_page=True)
            space(a).get_by_role('button',name=en['archiveRelationship'],exact=True).click()
            expect(space(a)).to_have_count(0)
            a.get_by_label(en['showArchived'],exact=True).check()
            space(a).get_by_role('button',name=en['unarchiveRelationship'],exact=True).click()
            space(a).get_by_role('button',name=en['leaveRelationship'],exact=True).click()
            a.get_by_role('dialog').get_by_role('button',name=en['confirmLeave'],exact=True).click()
            expect(space(a)).to_have_count(0)
            a.get_by_role('button',name=en['home'],exact=True).click()
            expect(a.locator('.entry')).to_contain_text('Private fictional A history')
            refresh(b)
            expect(space(b).locator('.member-row').filter(has_text='Casey')).to_contain_text(en['contactAvailable'])
            assert not errors,errors
            for context in contexts:context.close()
            browser.close()
    finally:
        if server.poll() is None:
            if os.name=='nt':subprocess.run(['taskkill','/pid',str(server.pid),'/t','/f'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=flags)
            else:server.terminate()
        server.wait(timeout=10);log.close()
