import os,subprocess,sys
import psycopg
import pytest
from app.cloud_worker import connection_options
from test_cloud_jobs import enqueue,queue


def test_worker_process_restart_and_all_locales(state):
    for locale in ('en','it','es','ko','zh-Hans','yue-Hant','de'):
        queue(state,action='list')
        with psycopg.connect(state.dsn) as conn:conn.execute('update public.companion_profiles set locale=%s where owner=%s',(locale,state.people['A']))
        enqueue(state)
        env={**os.environ,'WORKER_DATABASE_URL':state.dsn,'APP_ENV':'test','WORKER_ALLOW_LOCAL_TEST':'1'}
        for _ in range(2):
            result=subprocess.run([sys.executable,'-m','app.cloud_worker','--once'],env=env,capture_output=True,text=True,timeout=30)
            assert result.returncode==0,result.stdout
            assert state.dsn not in result.stdout+result.stderr
        with state.client('A') as conn:
            item=conn.execute("select id,locale,version from public.companion_checkins where status='pending'").fetchone();assert item[1]==locale
            conn.execute("select public.decide_private_checkin(%s,'skip',%s)",(item[0],item[2]))
            assert conn.execute('select public.cloud_worker_status()').fetchone()[0]['ready']
    with psycopg.connect(state.dsn) as conn:
        assert conn.execute('select count(*) from public.companion_checkins where owner=%s',(state.people['A'],)).fetchone()[0]==7


def test_worker_configuration_fails_closed():
    for env in ({},{'WORKER_DATABASE_URL':'postgresql://postgres:secret@127.0.0.1/db'},
                {'WORKER_DATABASE_URL':'postgresql://worker:secret@evil.invalid/db','WORKER_REGION':'frankfurt'}):
        with pytest.raises(ValueError):connection_options(env)
    assert connection_options({'WORKER_DATABASE_URL':'postgresql://worker:secret@db.chxlkmmkoadgcaomkznd.supabase.co/postgres','WORKER_REGION':'frankfurt'})[1]['sslmode']=='verify-full'
