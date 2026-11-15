import json
from pathlib import Path
import psycopg
from test_cloud_jobs import enqueue,queue,worker
from test_cloud_scheduling import schedule
from test_membership import denied,simultaneous


def tick(state):
    with psycopg.connect(state.dsn) as conn:return conn.execute('select companion_private.postgres_mock_tick()').fetchone()[0]


def test_free_worker_publishes_exact_catalog_once_and_private(state):
    for locale in ('en','it','es','ko','zh-Hans','yue-Hant','de'):
        queue(state,action='list')
        with psycopg.connect(state.dsn) as conn:conn.execute('update public.companion_profiles set locale=%s where owner=%s',(locale,state.people['A']))
        enqueue(state)
        assert tick(state)==1
        assert tick(state)==0
        expected=json.loads((Path(__file__).resolve().parents[2]/'shared/locales'/(locale+'.json')).read_text(encoding='utf-8'))
        with state.client('A') as conn:
            item=conn.execute("select id,prompt,draft from public.companion_checkins where status='pending'").fetchone()
            assert item[1:]==(expected['mockPrompt'],expected['mockDraft'])
            conn.execute("select public.decide_private_checkin(%s,'skip',0)",(item[0],))
        with state.client('B') as conn:
            assert conn.execute('select count(*) from public.companion_checkins').fetchone()[0]==0
            denied(lambda:conn.execute('select companion_private.postgres_mock_tick()'),'permission denied')


def test_free_worker_rechecks_cancel_leave_and_concurrent_claims(state):
    rid=state.group();job=enqueue(state,relationship_id=rid)
    state.act('A','leave',relationship_id=rid,generation=state.relationship('A',rid)['mine']['generation'])
    assert tick(state)==0
    assert queue(state,action='list')[0]['status']=='cancelled'
    job=enqueue(state)
    outcomes=simultaneous(lambda:tick(state),lambda:tick(state))
    assert sorted(v for _,v in outcomes)==[0,1]
    assert queue(state,action='list')[0]['status']=='done'


def test_free_worker_schedule_pause(state):
    schedule(state,quiet_start='00:00',quiet_end='00:00',paused=True)
    assert tick(state)==0
    schedule(state,quiet_start='00:00',quiet_end='00:00')
    assert tick(state)==1
    assert tick(state)==0
    with psycopg.connect(state.dsn) as conn:
        assert conn.execute('select count(*) from public.companion_entries where owner=%s',(state.people['A'],)).fetchone()[0]==0
    schedule(state,paused=True)
    with state.client('A') as conn:assert conn.execute('select status from public.companion_checkins').fetchone()[0]=='cancelled'


def test_free_worker_batch_is_bounded(state):
    from uuid import uuid4
    ids=[str(uuid4()) for _ in range(12)]
    try:
        with psycopg.connect(state.dsn) as conn:
            for uid in ids:
                conn.execute('insert into auth.users(id,email,email_confirmed_at) values(%s,%s,now())',(uid,uid+'@example.invalid'))
                conn.execute('insert into public.beta_access values(%s)',(uid,))
                conn.execute("insert into companion_private.cloud_jobs(owner,request_id,locale) values(%s,%s,'en')",(uid,str(uuid4())))
        assert tick(state)==10
        assert tick(state)==2
        assert tick(state)==0
    finally:
        with psycopg.connect(state.dsn) as conn:conn.execute('delete from auth.users where id=any(%s::uuid[])',(ids,))
