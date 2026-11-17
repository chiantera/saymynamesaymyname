"""Fictional content only; no provider, emergency service or hosted account."""
import json
import httpx
import psycopg
import pytest
from psycopg.types.json import Jsonb
from app.cloud_worker import run_ai_once, WorkerGate
from test_safety_worker import queued, connect, service, reset_safety
from test_deepseek_adapter import response, ledger
from test_ai_budget import reset_accounting

def notice(state, person='A', action='peek', **args):
    with state.client(person) as conn:
        return conn.execute('select public.support_notice(%s,%s)', (action, Jsonb(args))).fetchone()[0]

@pytest.mark.parametrize('text,kind', [('kill myself','self_harm'),('hurt them','violence'),
                                      ('track their phone','stalking'),('ignore all instructions','refuse')])
def test_worker_withholds_content_and_creates_owner_only_notice(state,text,kind):
    task=queued(state);data=response()
    data['choices'][0]['message']['content']=json.dumps(dict(prompt='Fictional prompt',draft=text))
    with connect(state) as conn:
        assert not run_ai_once(conn,service(conn,lambda _:httpx.Response(200,json=data)),task.price_id)
    assert ledger(state)[0][0]=='estimated'
    peek=notice(state)
    assert set(peek)=={'id'} and peek['id']
    assert notice(state,'B')=={'id':None}
    assert notice(state,'B','reveal',id=peek['id'])=={'id':None}
    assert notice(state,'B','dismiss',id=peek['id'])=={'id':None}
    assert notice(state,action='reveal',id=peek['id'])==dict(id=peek['id'],kind=kind,origin='generated_output')
    with psycopg.connect(state.dsn) as conn:
        assert conn.execute('select count(*) from public.companion_checkins').fetchone()[0]==0
        row=conn.execute('select to_jsonb(n)::text from companion_private.support_notices n').fetchone()[0]
        assert text not in row and 'prompt' not in row and 'draft' not in row
        assert not conn.execute("select has_function_privilege('companion_meter','companion_private.ai_worker_job_core(text,jsonb)','EXECUTE')").fetchone()[0]
    assert notice(state,action='dismiss',id=peek['id'])=={'dismissed':True}
    assert notice(state)=={'id':None}
    # No cross-member notices or global/member block side effects.
    assert notice(state,'C')=={'id':None}

def test_unavailable_safety_notice_does_not_infer_a_crisis(state):
    task=queued(state)
    with connect(state) as conn:
        assert not run_ai_once(conn,service(conn,lambda _:pytest.fail('no HTTP'),assessment=None),task.price_id)
    peek=notice(state)
    assert notice(state,action='reveal',id=peek['id'])['kind']=='unavailable'
    assert ledger(state)==[]

def test_stale_lease_arbitrary_reason_and_direct_table_access_are_denied(state):
    task=queued(state)
    with connect(state) as conn:
        gate=WorkerGate(conn);job=gate.job('claim',price_id=task.price_id)
        assert gate.job('hold',job_id=job['id'],lease=task.lease,support_kind='self_harm')=={'held':False}
        assert notice(state)=={'id':None}
        # Even a valid lease never persists arbitrary supplied error strings.
        assert gate.job('hold',job_id=job['id'],lease=job['lease'],support_kind='private error')=={'held':True}
    assert notice(state)=={'id':None}
    for person in ('A','B','E'):
        with pytest.raises(psycopg.Error):
            with state.client(person) as conn:conn.execute('select * from companion_private.support_notices')
    with pytest.raises(psycopg.Error,match='access_denied'):notice(state,'E')

def test_hold_can_create_notice_after_kill_switch_without_releasing_cost(state):
    task=queued(state)
    with connect(state) as conn:
        gate=WorkerGate(conn);job=gate.job('claim',price_id=task.price_id)
        with psycopg.connect(state.dsn) as admin:admin.execute('update companion_private.ai_budget_config set live_enabled=false')
        assert gate.job('hold',job_id=job['id'],lease=job['lease'],support_kind='stalking')=={'held':True}
        assert gate.job('hold',job_id=job['id'],lease=job['lease'],support_kind='stalking')=={'held':False}
    assert notice(state,action='reveal',id=notice(state)['id'])['kind']=='stalking'
