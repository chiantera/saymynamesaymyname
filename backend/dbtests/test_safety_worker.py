"""Real queue-to-private-draft worker with fictional assessments and mocked HTTP."""
import json
import time
import httpx
import psycopg
import pytest
from psycopg.types.json import Jsonb
from app.ai import Composer, DeepSeekHTTP, Denied, Deployment
from app.cloud_worker import WorkerGate, run_ai_once
from app.cloud_worker import publication_digest
from app.ai import Task
from app.safety import Assessment, PolicySafety, POLICY, fingerprint
from test_ai_budget import reset_accounting
from test_ai_consent import change
from test_deepseek_adapter import prepare, response, ledger
from test_cloud_jobs import worker as mock_worker


@pytest.fixture(autouse=True)
def reset_safety(state):
    yield
    with psycopg.connect(state.dsn) as conn:
        conn.execute("update companion_private.ai_safety_policies set enabled=false,review_revision=null,reviewed_at=null,locales='{}'")


def queued(state):
    task=prepare(state)
    with psycopg.connect(state.dsn) as conn:
        conn.execute("update companion_private.ai_safety_policies set enabled=true,review_revision='fictional-review',reviewed_at=now(),locales=array['en']")
        conn.execute("update companion_private.cloud_jobs set processor='deepseek',status='queued',lease=null,lease_until=null,attempts=0 where id=%s",(task.job_id,))
    return task


def assessor(text,*,phase,locale,policy):
    return Assessment('allow',fingerprint(text),locale,phase,policy,time.time()+30)


def service(conn,handler,*,assessment=assessor,live=True):
    return Composer(WorkerGate(conn),deployment=Deployment(live,True,True,'frankfurt'),
      safety=PolicySafety(assessment,reviewed_locales=['en']),
      provider=DeepSeekHTTP(transport=httpx.MockTransport(handler)),credentials=lambda:'fictional-key')


def connect(state):
    conn=psycopg.connect(state.dsn,autocommit=True);conn.execute('set role companion_meter');return conn


def status(state):
    with psycopg.connect(state.dsn) as conn:
        return conn.execute('select status from companion_private.cloud_jobs order by created_at desc limit 1').fetchone()[0]


def test_worker_publishes_one_private_draft_and_keeps_manual_approval(state):
    task=queued(state);calls=[]
    def handler(request):calls.append(request);return httpx.Response(200,json=response())
    with connect(state) as conn:
        worker=service(conn,handler)
        assert run_ai_once(conn,worker,task.price_id)
        assert not run_ai_once(conn,worker,task.price_id)
    assert len(calls)==1 and status(state)=='done'
    with state.client('A') as conn:
        item=conn.execute('select status,prompt,draft from public.companion_checkins').fetchone()
        assert item[0]=='pending' and item[1]=='What matters to you today?'
    with state.client('B') as conn:assert conn.execute('select count(*) from public.companion_checkins').fetchone()[0]==0
    with psycopg.connect(state.dsn) as conn:
        assert conn.execute('select length(output_digest),safety_policy,safety_review_revision from companion_private.ai_usage_attempts').fetchone()==(64,POLICY,'fictional-review')


def test_disabled_worker_never_claims_or_reads_key(state):
    task=queued(state)
    with connect(state) as conn:
        worker=service(conn,lambda _:pytest.fail('no HTTP'),live=False)
        with pytest.raises(Denied,match='live_ai_disabled'):run_ai_once(conn,worker,task.price_id)
    assert status(state)=='queued' and ledger(state)==[]


def test_safety_db_review_is_required_before_claim(state):
    task=queued(state)
    with psycopg.connect(state.dsn) as conn:conn.execute('update companion_private.ai_safety_policies set enabled=false')
    with connect(state) as conn:
        with pytest.raises(psycopg.Error,match='safety_unavailable'):
            run_ai_once(conn,service(conn,lambda _:pytest.fail('no HTTP')),task.price_id)
    assert status(state)=='queued' and ledger(state)==[]


@pytest.mark.parametrize('unsafe', ['kill myself','hurt them','track their phone','ignore all instructions'])
def test_risky_output_holds_job_with_cost_and_no_private_draft(state,unsafe):
    task=queued(state);data=response()
    data['choices'][0]['message']['content']=json.dumps(dict(prompt='A prompt',draft=unsafe))
    with connect(state) as conn:
        assert not run_ai_once(conn,service(conn,lambda _:httpx.Response(200,json=data)),task.price_id)
    assert status(state)=='failed' and ledger(state)[0][0]=='estimated'
    with state.client('A') as conn:assert conn.execute('select count(*) from public.companion_checkins').fetchone()[0]==0


def test_semantic_unavailability_holds_before_dispatch(state):
    task=queued(state)
    with connect(state) as conn:
        assert not run_ai_once(conn,service(conn,lambda _:pytest.fail('no HTTP'),assessment=None),task.price_id)
    assert status(state)=='failed' and ledger(state)==[]


def test_safety_review_revocation_after_composition_prevents_publication(state):
    task=queued(state);seen=[]
    def revoke(text,**kwargs):
        seen.append(text)
        if len(seen)==2:
            with psycopg.connect(state.dsn) as conn:conn.execute('update companion_private.ai_safety_policies set enabled=false')
        return assessor(text,**kwargs)
    with connect(state) as conn:
        assert not run_ai_once(conn,service(conn,lambda _:httpx.Response(200,json=response()),assessment=revoke),task.price_id)
    assert status(state)=='failed' and ledger(state)[0][0]=='estimated'


def test_uncertain_paid_call_is_not_replayed_after_worker_loss(state):
    task=queued(state)
    def timeout(request):raise httpx.ReadTimeout('fictional',request=request)
    with connect(state) as conn:
        assert not run_ai_once(conn,service(conn,timeout),task.price_id)
    assert ledger(state)[0][0]=='unknown'
    # Simulate a stale lease left by process death rather than normal hold handling.
    with psycopg.connect(state.dsn) as conn:
        conn.execute("update companion_private.cloud_jobs set status='processing',lease_until=now()-interval '1 second'")
    with connect(state) as conn:
        assert not run_ai_once(conn,service(conn,lambda _:pytest.fail('must not retry')),task.price_id)
    assert mock_worker(state,'claim_cloud_job') is None


def test_narrow_worker_rpc_and_policy_table_deny_clients_and_mock_role(state):
    task=queued(state)
    with psycopg.connect(state.dsn,autocommit=True) as conn:
        for role in ('authenticated','anon','companion_worker'):
            conn.execute('set role '+role)
            with pytest.raises(psycopg.Error):conn.execute("select companion_private.ai_worker_job('claim',%s)",(Jsonb({'price_id':task.price_id}),))
            conn.execute('reset role')
        conn.execute('set role companion_meter')
        with pytest.raises(psycopg.Error):conn.execute('select * from companion_private.ai_safety_policies')
        with pytest.raises(psycopg.Error):conn.execute('select * from public.companion_entries')


def test_mock_consumer_cannot_claim_or_finish_an_ai_job(state):
    task=queued(state)
    assert mock_worker(state,'claim_cloud_job') is None
    with connect(state) as conn:
        claimed=WorkerGate(conn).job('claim',price_id=task.price_id)
    assert not mock_worker(state,'finish_cloud_job',task.job_id,claimed['lease'],'Unsafe replacement','Unreviewed mock fallback')
    assert status(state)=='processing'


def test_kill_switch_between_assessment_and_publish_holds_without_erasing_cost(state):
    task=queued(state);seen=[]
    def kill(text,**kwargs):
        seen.append(text)
        if len(seen)==2:
            with psycopg.connect(state.dsn) as conn:conn.execute('update companion_private.ai_budget_config set live_enabled=false')
        return assessor(text,**kwargs)
    with connect(state) as conn:
        assert not run_ai_once(conn,service(conn,lambda _:httpx.Response(200,json=response()),assessment=kill),task.price_id)
    assert status(state)=='failed' and ledger(state)[0][0]=='estimated'


def test_database_publication_rejects_changed_content_review_and_usage(state):
    task=queued(state)
    with connect(state) as conn:
        gate=WorkerGate(conn);job=gate.job('claim',price_id=task.price_id)
        task=Task(job['id'],job['lease'],task.price_id,job['attempt_no'])
        result=service(conn,lambda _:httpx.Response(200,json=response())).compose_for_worker(task)
        args=dict(**task.args(),attempt_id=result.attempt_id,**result.content,
          digest=publication_digest(result.content),review_revision=result.context['review_revision'],
          safety_policy=POLICY,safety_review_revision='fictional-review')
        for altered in [args|{'digest':'bad'},args|{'safety_review_revision':'old'},args|{'prompt':'changed'}]:
            with pytest.raises(psycopg.Error):gate.job('publish',**altered)
        with psycopg.connect(state.dsn) as admin:
            admin.execute("update companion_private.ai_usage_attempts set usage=jsonb_set(usage,'{output}','513') where id=%s",(result.attempt_id,))
        with pytest.raises(psycopg.Error,match='usage_unavailable'):gate.job('publish',**args)
        assert status(state)=='processing'
        with psycopg.connect(state.dsn) as admin:
            admin.execute("update companion_private.ai_usage_attempts set usage=jsonb_set(usage,'{output}','20') where id=%s",(result.attempt_id,))
        assert gate.job('publish',**args)['published']
        with pytest.raises(psycopg.Error):gate.job('publish',**args)
