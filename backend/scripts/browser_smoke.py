from pathlib import Path
import json, os, shutil, subprocess, tempfile, time, socket
from urllib.request import urlopen
from playwright.sync_api import sync_playwright, expect
from ui_checks import audit_ui

root = Path(__file__).resolve().parents[2]
catalog = lambda lang: json.loads((root/'shared'/'locales'/f'{lang}.json').read_text(encoding='utf-8'))
en = catalog('en')
artifacts = root/'.local'/'screenshots'
artifacts.mkdir(parents=True, exist_ok=True)
browsers = sorted((Path(os.environ.get('LOCALAPPDATA',''))/'ms-playwright').glob('chromium-*/chrome-win64/chrome.exe'))
# Dedicated test database and ports; never mutate a running developer workspace.
for port in (8003, 5175):
    with socket.socket() as probe:
        if probe.connect_ex(('127.0.0.1', port)) == 0:
            raise SystemExit(f'Test port {port} is busy; no existing process was changed.')
children=[]
flags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
with tempfile.TemporaryDirectory(prefix='browser-test-', dir=root/'.local') as tmp:
    assert Path(tmp).resolve().is_relative_to((root/'.local').resolve())
    env={**os.environ, 'APP_ENV':'development', 'ALLOW_LOCAL_DEMO':'1',
         'DEMO_DATABASE_PATH':str(Path(tmp)/'demo.sqlite'),
         'DEMO_API_TARGET':'http://127.0.0.1:8003'}
    node=Path(shutil.which('node'))
    npm_cli=os.environ.get('npm_execpath') or str(node.parent/'node_modules'/'npm'/'bin'/'npm-cli.js')
    commands=[
        ['uv','run','--directory','backend','uvicorn','app.main:app','--host','127.0.0.1','--port','8003'],
        ['uv','run','--directory','backend','python','-m','app.worker'],
        [str(node),npm_cli,'--prefix','frontend','run','dev','--','--port','5175'],
    ]
    try:
        for command in commands:
            children.append(subprocess.Popen(command,cwd=root,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=flags))
        for url in ['http://127.0.0.1:8003/api/health','http://127.0.0.1:5175']:
            ready=False
            for _ in range(60):
                try:
                    with urlopen(url,timeout=1) as response:
                        ready=response.status == 200
                    if ready: break
                except Exception: time.sleep(.25)
            if not ready: raise RuntimeError('Local test service did not start: '+url)
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=str(browsers[-1]) if browsers else None, headless=True)
            page = browser.new_page(viewport={'width':1440,'height':1050}, locale='en-US')
            errors=[]
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto('http://127.0.0.1:5175', wait_until='networkidle')
            expect(page.get_by_role('heading', name=en['welcome'])).to_be_visible()
            expect(page.locator('.brand-mark')).to_have_text('\u25d2')
            create = page.get_by_role('button', name=en['generate'])
            expect(create).to_be_enabled()
            create.click()
            expect(page.get_by_role('button', name=en['approve'], exact=True)).to_be_visible()
            page.get_by_role('textbox', name=en['review']).fill('Today I will make time for one small thing that matters to me.')
            page.screenshot(path=str(artifacts/'desktop.png'),full_page=True)
            page.get_by_role('button', name=en['approve'], exact=True).click()
            expect(page.locator('.entry')).to_have_count(1)
            expect(page.locator('.entry')).to_contain_text('Today I will make time')
            create.click()
            page.get_by_role('button', name=en['skip'], exact=True).click()
            expect(page.get_by_text(en['skipped'], exact=True)).to_be_visible()
            expect(page.locator('.entry')).to_have_count(1)
            page.reload(wait_until='networkidle')
            expect(page.locator('.entry')).to_have_count(1)
            for lang in ['it','es','ko','zh-Hans','yue-Hant','de','en']:
                page.get_by_role('combobox',name=catalog(page.locator('html').get_attribute('lang'))['language']).select_option(lang)
                expect(page.locator('html')).to_have_attribute('lang',lang)
                expect(page.get_by_role('heading',name=catalog(lang)['welcome'])).to_be_visible()
            page.get_by_role('button',name=en['relationships'],exact=True).click()
            page.get_by_role('textbox',name=en['relationshipLabel']).fill('Fictional shared space')
            page.get_by_role('button',name=en['addRelationship'],exact=True).click()
            expect(page.get_by_role('heading',name='Fictional shared space')).to_be_visible()
            page.get_by_role('button',name=en['home'],exact=True).click()
            create.click()
            page.get_by_role('button',name=en['snooze'],exact=True).click()
            expect(page.locator('.history-item').filter(has_text=en['deferred'])).to_be_visible()
            expect(create).to_be_disabled()
            page.set_viewport_size({'width':390,'height':844})
            expect(page.get_by_role('heading',name=en['welcome'])).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Horizontal overflow on mobile'
            page.screenshot(path=str(artifacts/'mobile.png'),full_page=True)
            page.get_by_role('button',name=en['settings'],exact=True).click()
            page.get_by_role('combobox',name=en['theme']).select_option('dark')
            expect(page.locator('html')).to_have_attribute('data-theme','dark')
            page.get_by_role('combobox',name=en['theme']).select_option('system')
            page.keyboard.press('Tab')
            assert page.evaluate('document.activeElement !== document.body')
            # Every destination, both layouts/themes, all seven draft catalogs.
            # No hosted data or external font/processor requests are needed.
            external=[]
            page.on('request', lambda request: external.append(request.url)
                    if not request.url.startswith(('http://127.0.0.1:', 'ws://127.0.0.1:', 'data:')) else None)
            for width in (360,1440):
                page.set_viewport_size({'width':width,'height':900})
                for theme in ('light','dark'):
                    for lang in ('en','it','es','ko','zh-Hans','yue-Hant','de'):
                        old=catalog(page.locator('html').get_attribute('lang'))
                        page.get_by_role('combobox',name=old['language'],exact=True).select_option(lang)
                        expect(page.locator('html')).to_have_attribute('lang',lang)
                        words=catalog(lang)
                        page.get_by_role('button',name=words['settings'],exact=True).click()
                        page.get_by_role('combobox',name=words['theme'],exact=True).select_option(theme)
                        for tab in ('home','relationships','growth','bartender','settings'):
                            page.get_by_role('button',name=words[tab],exact=True).click()
                            expect(page.locator('main h1')).to_have_count(1)
                            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), (width,theme,lang,tab)
                            if lang=='en':
                                audit_ui(page,(width,theme,lang,tab))
                            if lang in ('en','de','ko'):
                                page.screenshot(path=str(artifacts/f'overhaul-{tab}-{lang}-{theme}-{width}.png'),full_page=True)
            page.emulate_media(reduced_motion='reduce')
            assert page.locator('main h1').is_visible()
            assert not external,external
            assert not errors, errors
            browser.close()
    finally:
        for child in children:
            if child.poll() is None:
                if os.name == 'nt':
                    subprocess.run(['taskkill','/pid',str(child.pid),'/t','/f'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=flags)
                else: child.terminate()
        for child in children:
            child.wait(timeout=10)
print('Browser smoke passed: compose/edit/save, skip, persistence, seven locales, optional relationship, snooze, mobile layout, themes, keyboard focus.')
