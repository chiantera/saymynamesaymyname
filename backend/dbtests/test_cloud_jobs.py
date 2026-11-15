import uuid
import psycopg
from psycopg.types.json import Jsonb
from test_membership import denied, simultaneous


def queue(state,person='A',action='enqueue',**args):
    with state.client(person) as conn:
        conn.execute("insert into public.companion_profiles(owner,locale,timezone) values(auth.uid(),'en','Europe/Berlin') on conflict do nothing")
        return conn.execute('select public.cloud_queue(%s,%s)',(action,Jsonb(args))).fetchone()[0]


def worker(state,func,*args):
    with psycopg.connect(state.dsn) as conn:
        conn.execute('set local role companion_worker')
        return conn.execute('select companion_private.'+func+'('+','.join(['%s']*len(args))+')',args).fetchone()[0]


def enqueue(state,person='A',**args):return queue(state,person,request_id=str(uuid.uuid4()),**args)


def test_queue_claim_fence_and_idempotency(state):
    request=str(uuid.uuid4());a=queue(state,request_id=request)
    assert queue(state,request_id=request)==a
    assert queue(state,'B',action='list')==[]
    claims=simultaneous(lambda:worker(state,'claim_cloud_job'),lambda:worker(state,'claim_cloud_job'))
    claim=next(value for outcome,value in claims if value)
    assert sum(bool(v) for _,v in claims)==1
    assert worker(state,'finish_cloud_job',a['id'],str(uuid.uuid4()),'Prompt','Draft') is False
    assert worker(state,'finish_cloud_job',a['id'],claim['lease'],'Prompt','Draft') is True
    assert worker(state,'finish_cloud_job',a['id'],claim['lease'],'Prompt','Draft') is False
    with state.client('A') as conn:assert conn.execute('select count(*) from public.companion_checkins').fetchone()[0]==1
    with state.client('B') as conn:assert conn.execute('select count(*) from public.companion_checkins').fetchone()[0]==0


def test_cancel_and_membership_recheck(state):
    rid=state.group();job=enqueue(state,relationship_id=rid);claim=worker(state,'claim_cloud_job')
    state.act('A','leave',relationship_id=rid,generation=state.relationship('A',rid)['mine']['generation'])
    assert not worker(state,'finish_cloud_job',job['id'],claim['lease'],'Prompt','Draft')
    assert queue(state,action='list')[0]['status']=='cancelled'
    job=enqueue(state);claim=worker(state,'claim_cloud_job')
    queue(state,action='cancel',id=job['id'])
    assert not worker(state,'finish_cloud_job',job['id'],claim['lease'],'Prompt','Draft')


def test_lease_recovery_bounded_attempts_and_worker_no_table_access(state):
    enqueue(state);old=worker(state,'claim_cloud_job')
    with psycopg.connect(state.dsn) as conn:conn.execute("update companion_private.cloud_jobs set lease_until=now()-interval '1 second' where id=%s",(old['id'],))
    new=worker(state,'claim_cloud_job');assert old['lease']!=new['lease']
    assert not worker(state,'finish_cloud_job',old['id'],old['lease'],'Prompt','Draft')
    with state.client('A') as conn:
        denied(lambda:conn.execute('select companion_private.claim_cloud_job()'),'permission denied')
    with psycopg.connect(state.dsn) as conn:
        conn.execute('set local role companion_worker')
        denied(lambda:conn.execute('select * from public.companion_entries'),'permission denied')
    with psycopg.connect(state.dsn) as conn:conn.execute("update companion_private.cloud_jobs set attempts=3,lease_until=now()-interval '1 second' where id=%s",(old['id'],))
    assert worker(state,'claim_cloud_job') is None
    assert queue(state,action='list')[0]['status']=='failed'
