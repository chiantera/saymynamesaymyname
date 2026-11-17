"""Real disposable SQL/RLS plus mocked HTTP. Never loads the saved real key."""
import json
import uuid
import httpx
import psycopg
import pytest
from psycopg.types.json import Jsonb
from app.ai import Composer, DeepSeekHTTP, Denied, Deployment, PostgresGate, Task
from test_ai_budget import setup, reset_accounting
from test_ai_consent import change
from test_membership import denied


class Safety:
    def check(self,*args,**kwargs):return 'allow'


def prepare(state):
    base=setup(state)
    with psycopg.connect(state.dsn) as conn:
        price=conn.execute('''insert into companion_private.ai_prices
          (provider,capability,model,version,currency,eur_fx,fx_asof,input_rate,cached_rate,
           output_rate,unit,unit_rate,max_input,max_output,max_units,reviewed_at,valid_until,enabled)
          values('deepseek','chat','deepseek-flash',%s,'EUR',1,now(),1,0.1,2,'tokens',0,
                 100000,512,0,now(),now()+interval '1 day',true) returning id''',(str(uuid.uuid4()),)).fetchone()[0]
    return Task(base['job_id'],base['lease'],str(price))


def response():
    return dict(id='fixture-'+str(uuid.uuid4()),model='deepseek-flash',
      choices=[dict(finish_reason='stop',message=dict(role='assistant',content=json.dumps(
        dict(prompt='What matters to you today?',draft='I will make time for a pause.'))))],
      usage=dict(prompt_tokens=100,completion_tokens=20,prompt_cache_hit_tokens=0,
                 prompt_cache_miss_tokens=100,total_tokens=120))


def compose(state,task,handler):
    with psycopg.connect(state.dsn,autocommit=True) as conn:
        conn.execute('set role companion_meter')
        return Composer(PostgresGate(conn),deployment=Deployment(True,True,True,'frankfurt'),
          safety=Safety(),provider=DeepSeekHTTP(transport=httpx.MockTransport(handler)),
          credentials=lambda:'fictional-only').compose(task)


def ledger(state):
    with psycopg.connect(state.dsn) as conn:
        return conn.execute('select state,estimated_eur,reserved_eur from companion_private.ai_usage_attempts').fetchall()


def test_real_reservation_usage_and_idempotent_dispatch(state):
    task=prepare(state);calls=[]
    def handler(request):calls.append(request);return httpx.Response(200,json=response())
    assert compose(state,task,handler)['draft']=='I will make time for a pause.'
    assert len(calls)==1 and ledger(state)[0][0]=='estimated'
    with pytest.raises(Denied):compose(state,task,handler)
    assert len(calls)==1 and len(ledger(state))==1


def test_database_kill_switch_and_cap_prevent_even_mock_dispatch(state):
    task=prepare(state)
    def forbidden(request):raise AssertionError('no dispatch')
    with psycopg.connect(state.dsn) as conn:conn.execute('update companion_private.ai_budget_config set live_enabled=false')
    with pytest.raises(Denied):compose(state,task,forbidden)
    assert ledger(state)==[]
    with psycopg.connect(state.dsn) as conn:conn.execute('update companion_private.ai_budget_config set live_enabled=true,monthly_eur=0')
    with pytest.raises(Denied):compose(state,task,forbidden)
    assert ledger(state)==[]


def test_revocation_during_http_keeps_cost_and_withholds_content(state):
    task=prepare(state)
    def revoke(_):
        change(state,'provider',provider='deepseek',capability='chat',approved=False,allow_fallback=False)
        return httpx.Response(200,json=response())
    with pytest.raises(Denied):compose(state,task,revoke)
    assert ledger(state)[0][0]=='estimated'


def test_timeout_preserves_real_unknown_charge(state):
    task=prepare(state)
    def timeout(request):raise httpx.ReadTimeout('fixture only',request=request)
    with pytest.raises(Denied,match='provider_unavailable'):compose(state,task,timeout)
    assert ledger(state)[0][0]=='unknown' and ledger(state)[0][2]>0


def test_guard_is_metadata_only_solo_only_and_denies_other_roles(state):
    task=prepare(state)
    with psycopg.connect(state.dsn,autocommit=True) as conn:
        conn.execute('set role companion_meter')
        metadata=PostgresGate(conn).authorize(task)
        assert set(metadata)=={'locale','model','review_revision'}
        with pytest.raises(psycopg.Error):conn.execute('select * from public.companion_entries')
        conn.execute('reset role');conn.execute('set role companion_worker')
        with pytest.raises(psycopg.Error):conn.execute('select companion_private.deepseek_authorize(%s)',(Jsonb(task.args()),))
    with state.client('A') as conn:
        denied(lambda:conn.execute('select companion_private.deepseek_authorize(%s)',(Jsonb(task.args()),)),'permission denied')
    rid=state.group();generation=state.relationship('A',rid)['mine']['generation']
    with psycopg.connect(state.dsn) as conn:
        conn.execute('update companion_private.cloud_jobs set relationship_id=%s,member_generation=%s where id=%s',(rid,generation,task.job_id))
    with pytest.raises(Denied):compose(state,task,lambda _:httpx.Response(200,json=response()))
    assert ledger(state)==[]


def test_transaction_cannot_rollback_after_external_dispatch(state):
    with psycopg.connect(state.dsn) as conn:
        with pytest.raises(Denied,match='autocommit_required'):PostgresGate(conn)
    with psycopg.connect(state.dsn,autocommit=True) as conn:
        with pytest.raises(Denied,match='restricted_meter_role_required'):PostgresGate(conn)
