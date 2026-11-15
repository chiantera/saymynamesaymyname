from datetime import datetime,timezone
import psycopg
from psycopg.types.json import Jsonb
from test_cloud_jobs import queue,worker
from test_membership import denied,simultaneous


def schedule(state,person='A',action='save',**overrides):
    queue(state,person,action='list')
    with state.client(person) as conn:
        current=conn.execute("select public.cloud_schedule('get')").fetchone()[0]
        args=dict(revision=current['revision'],scope='',enabled=True,cadence_hours=6,paused=False,paused_until=None,quiet_start='22:00',quiet_end='08:00',daily_cap=3)|overrides
        return conn.execute('select public.cloud_schedule(%s,%s)',(action,Jsonb(args))).fetchone()[0]


def dispatch(state,instant):
    with psycopg.connect(state.dsn) as conn:return conn.execute('select companion_private.dispatch_cloud_due(%s)',(instant,)).fetchone()[0]


def test_dispatch_dedupe_quiet_dst_and_pause(state):
    assert schedule(state,action='get')['scopes']==[]
    schedule(state)
    for instant in ('2026-10-25T00:30Z','2026-10-25T01:30Z','2026-03-29T01:30Z'):
        assert dispatch(state,instant)==0
    assert dispatch(state,'2026-11-15T06:59Z')==0
    calls=simultaneous(lambda:dispatch(state,'2026-11-15T07:00Z'),lambda:dispatch(state,'2026-11-15T07:00Z'))
    assert sorted(v for _,v in calls)==[0,1]
    schedule(state,paused=True)
    assert queue(state,action='list')[0]['status']=='cancelled'
    assert dispatch(state,'2026-11-16T07:00Z')==0
    denied(lambda:schedule(state,revision=0),'stale_schedule')


def test_pause_after_claim_fences_completion(state):
    schedule(state,quiet_start='00:00',quiet_end='00:00')
    assert dispatch(state,datetime.now(timezone.utc))==1
    claim=worker(state,'claim_cloud_job');assert claim
    schedule(state,paused=True)
    assert not worker(state,'finish_cloud_job',claim['id'],claim['lease'],'Prompt','Draft')
    with state.client('A') as conn:assert conn.execute('select count(*) from public.companion_checkins').fetchone()[0]==0


def test_cap_gap_fair_scopes_and_no_backlog(state):
    rid=state.group();schedule(state,quiet_start='00:00',quiet_end='00:00',daily_cap=1)
    schedule(state,scope=rid,quiet_start='00:00',quiet_end='00:00',daily_cap=1)
    now=datetime.now(timezone.utc);assert dispatch(state,now)==1
    claim=worker(state,'claim_cloud_job');assert worker(state,'finish_cloud_job',claim['id'],claim['lease'],'Prompt','Draft')
    with state.client('A') as conn:
        item=conn.execute('select id from public.companion_checkins').fetchone()[0]
        conn.execute("select public.decide_private_checkin(%s,'skip',0)",(item,))
    assert dispatch(state,now)==0
    with psycopg.connect(state.dsn) as conn:
        assert conn.execute('select companion_private.schedule_eligible(%s,%s)',(state.people['A'],now)).fetchone()[0] is False
        conn.execute("update companion_private.cloud_jobs set finished_at=now()-interval '2 days' where owner=%s",(state.people['A'],))
    assert dispatch(state,now)==1
    with psycopg.connect(state.dsn) as conn:
        rows=conn.execute('select relationship_id,status from companion_private.cloud_jobs where owner=%s order by created_at,id',(state.people['A'],)).fetchall()
        assert rows[0][0]!=rows[1][0]


def test_timezone_validation_and_schedule_privacy(state):
    schedule(state)
    assert schedule(state,'B',action='get')['scopes']==[]
    with state.client('A') as conn:
        denied(lambda:conn.execute("update public.companion_profiles set timezone='invalid'"),'invalid_timezone')
    with state.client('B') as conn:
        denied(lambda:conn.execute('select companion_private.dispatch_cloud_due()'),'permission denied')
    rid=state.group();state.act('A','archive',relationship_id=rid,generation=1,value=True)
    denied(lambda:schedule(state,scope=rid),'member_unavailable')


def test_tick_stale_worker_expiry_and_snooze_revocation(state):
    schedule(state,quiet_start='00:00',quiet_end='00:00')
    with psycopg.connect(state.dsn) as conn:
        conn.execute('delete from companion_private.worker_health')
        assert conn.execute('select companion_private.cloud_tick()').fetchone()[0]==0
    assert queue(state,action='list')==[]
    assert dispatch(state,datetime.now(timezone.utc))==1
    claim=worker(state,'claim_cloud_job');assert worker(state,'finish_cloud_job',claim['id'],claim['lease'],'Prompt','Draft')
    with state.client('A') as conn:
        item=conn.execute('select id from public.companion_checkins').fetchone()[0]
        conn.execute("select public.decide_private_checkin(%s,'snooze',0)",(item,))
    schedule(state,paused=True)
    with psycopg.connect(state.dsn) as conn:
        conn.execute("update public.companion_checkins set snoozed_until=now()-interval '2 hours' where id=%s",(item,))
        conn.execute('select companion_private.cloud_tick()')
        assert conn.execute('select status from public.companion_checkins where id=%s',(item,)).fetchone()[0]=='cancelled'
    with state.client('A') as conn:
        conn.execute('select public.refresh_private_checkins()')
        assert conn.execute('select status from public.companion_checkins where id=%s',(item,)).fetchone()[0]=='cancelled'


def test_tick_terminal_failure_and_owner_delete_cleanup(state):
    from test_cloud_jobs import enqueue
    job=enqueue(state);worker(state,'claim_cloud_job')
    with psycopg.connect(state.dsn) as conn:
        conn.execute("update companion_private.cloud_jobs set attempts=3,lease_until=now()-interval '1 second' where id=%s",(job['id'],))
        conn.execute('select companion_private.cloud_tick()')
        assert conn.execute('select status from companion_private.cloud_jobs where id=%s',(job['id'],)).fetchone()[0]=='failed'
        conn.execute('delete from auth.users where id=%s',(state.people['A'],))
        assert conn.execute('select count(*) from companion_private.cloud_jobs where id=%s',(job['id'],)).fetchone()[0]==0
