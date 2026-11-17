from decimal import Decimal
import uuid
import psycopg
import pytest
from psycopg.types.json import Jsonb
from test_cloud_jobs import enqueue,worker
from test_ai_consent import change
from test_membership import denied,simultaneous

@pytest.fixture(autouse=True)
def reset_accounting(state):
    yield
    # This fixture is confined to conftest's disposable loopback database.
    with psycopg.connect(state.dsn) as conn:
        conn.execute('delete from companion_private.ai_usage_attempts')
        conn.execute('delete from companion_private.ai_prices')
        conn.execute('delete from companion_private.ai_usage_rollups')
        conn.execute('update companion_private.ai_budget_config set live_enabled=false,monthly_eur=20')
        conn.execute('update companion_private.ai_provider_catalog set enabled=false,review_revision=null,policy_url=null,reviewed_at=null')


def meter(state,action,**args):
    with psycopg.connect(state.dsn) as conn:
        conn.execute('set local role companion_meter')
        return conn.execute('select companion_private.ai_meter(%s,%s)',(action,Jsonb(args))).fetchone()[0]


def setup(state,person='A',capability='chat',unit='tokens',currency='EUR',fx=1,free=False):
    with psycopg.connect(state.dsn) as conn:
        conn.execute('update companion_private.ai_budget_config set live_enabled=true')
        conn.execute("update companion_private.ai_provider_catalog set enabled=true,review_revision='fixture-v1',policy_url='https://example.invalid/policy',reviewed_at=now() where provider='deepseek' and capability='chat'")
        if capability!='chat':
            conn.execute("insert into companion_private.ai_provider_catalog(provider,capability,enabled,review_revision,policy_url,reviewed_at) values('deepseek',%s,true,'fixture-v1','https://example.invalid/policy',now()) on conflict do nothing",(capability,))
        price=conn.execute('''insert into companion_private.ai_prices(provider,capability,model,version,currency,eur_fx,fx_asof,input_rate,cached_rate,output_rate,unit,unit_rate,max_input,max_output,max_units,reviewed_at,valid_until,enabled)
          values('deepseek',%s,'fixture-model',%s,%s,%s,now(),%s,0,0,%s,%s,%s,%s,%s,now(),now()+interval '1 day',true) returning id''',
          (capability,str(uuid.uuid4()),currency,fx,1000000 if unit=='tokens' and not free else 0,unit,0 if unit=='tokens' or free else 1,100 if unit=='tokens' else 0,100 if unit=='tokens' else 0,0 if unit=='tokens' else 100)).fetchone()[0]
    change(state,'provider',person=person,provider='deepseek',capability=capability,approved=True,allow_fallback=False,review_revision='fixture-v1')
    enqueue(state,person);job=worker(state,'claim_cloud_job')
    return dict(job_id=job['id'],lease=job['lease'],price_id=str(price),attempt_no=1,kind='checkin' if capability=='chat' else capability,bounds=dict(input=1,cached=0,output=0,units=0) if unit=='tokens' else dict(input=0,cached=0,output=0,units=1))


def attempt(state,args):return meter(state,'reserve',**args)['id']
def begin(state,args):
    aid=attempt(state,args);meter(state,'begin',id=aid,lease=args['lease']);return aid

def row(state,aid):
    with psycopg.connect(state.dsn) as conn:return conn.execute('select state,reserved_eur,estimated_eur,actual_eur from companion_private.ai_usage_attempts where id=%s',(aid,)).fetchone()


def test_atomic_project_cap_and_private_meter_access(state):
    a=setup(state);b=setup(state,'B')
    a['bounds']['input']=10;b['bounds']['input']=10
    calls=simultaneous(lambda:meter(state,'reserve',**a),lambda:meter(state,'reserve',**b))
    assert sum(status=='ok' for status,_ in calls)==1
    assert any('budget_exhausted' in str(value) for _,value in calls)
    for who in ('A','B'):
        with state.client(who) as conn:denied(lambda:conn.execute("select companion_private.ai_meter('reserve','{}')"),'permission denied')
    with psycopg.connect(state.dsn) as conn:
        conn.execute('set local role companion_worker')
        denied(lambda:conn.execute('select * from companion_private.ai_usage_attempts'),'permission denied')


def test_live_off_missing_price_consent_and_stale_lease(state):
    a=setup(state)
    with psycopg.connect(state.dsn) as conn:conn.execute('update companion_private.ai_budget_config set live_enabled=false')
    denied(lambda:attempt(state,a),'live_ai_disabled')
    with psycopg.connect(state.dsn) as conn:conn.execute('update companion_private.ai_budget_config set live_enabled=true')
    denied(lambda:attempt(state,a|dict(price_id=str(uuid.uuid4()))),'price_unavailable')
    denied(lambda:attempt(state,a|dict(lease=str(uuid.uuid4()))),'job_unavailable')
    change(state,'provider',provider='deepseek',capability='chat',approved=False,allow_fallback=False)
    denied(lambda:attempt(state,a),'processor_not_approved')


def test_idempotent_attempts_unknown_holds_and_retries(state):
    a=setup(state);a['bounds']['input']=10;aid=attempt(state,a)
    assert attempt(state,a)==aid
    denied(lambda:attempt(state,a|dict(bounds=dict(input=9,cached=0,output=0,units=0))),'attempt_conflict')
    meter(state,'begin',id=aid,lease=a['lease']);meter(state,'unknown',id=aid)
    denied(lambda:meter(state,'release',id=aid),'cannot_release_dispatched_charge')
    denied(lambda:attempt(state,a|dict(attempt_no=2)),'budget_exhausted')
    with psycopg.connect(state.dsn) as conn:conn.execute("update companion_private.ai_usage_attempts set budget_month=(date_trunc('month',now() at time zone 'UTC')-interval '1 month')::date where id=%s",(aid,))
    denied(lambda:attempt(state,a|dict(attempt_no=2)),'budget_exhausted')
    meter(state,'reconcile',id=aid,provider_request_id='fixture-no-charge',actual_native='0',actual_fx='1')
    assert row(state,aid)[3]==0
    assert attempt(state,a|dict(attempt_no=2))!=aid


def test_report_reconcile_receipt_dedup_and_overrun(state):
    a=setup(state);a['bounds']['input']=10;aid=begin(state,a)
    receipt=dict(id=aid,provider_request_id='fixture-receipt',usage=dict(input=8,cached=0,output=0,units=0))
    meter(state,'report',**receipt);meter(state,'report',**receipt)
    assert row(state,aid)[2]==8
    reconciled=dict(id=aid,provider_request_id='fixture-receipt',actual_native='14',actual_fx='1')
    meter(state,'reconcile',**reconciled);meter(state,'reconcile',**reconciled)
    assert row(state,aid)[3]==14
    denied(lambda:attempt(state,a|dict(attempt_no=2,bounds=dict(input=6,cached=0,output=0,units=0))),'budget_exhausted')
    denied(lambda:meter(state,'reconcile',**(reconciled|dict(actual_native='13'))),'receipt_conflict')
    aid2=begin(state,a|dict(attempt_no=2,bounds=dict(input=1,cached=0,output=0,units=0)))
    denied(lambda:meter(state,'report',**(receipt|dict(id=aid2))),'duplicate_provider_receipt')


def test_expiry_cancel_and_dispatch_rechecks(state):
    a=setup(state);aid=attempt(state,a)
    change(state,'provider',provider='deepseek',capability='chat',approved=False,allow_fallback=False)
    denied(lambda:meter(state,'begin',id=aid,lease=a['lease']),'processor_not_approved')
    with psycopg.connect(state.dsn) as conn:conn.execute("update companion_private.ai_usage_attempts set expires_at=now()-interval '1 second' where id=%s",(aid,))
    meter(state,'release',id=aid)
    assert row(state,aid)[0]=='cancelled'
    denied(lambda:meter(state,'report',id=aid,provider_request_id='never-sent',usage=dict(input=1,cached=0,output=0,units=0)),'attempt_unavailable')


def test_fx_units_bounds_and_worst_case_cache(state):
    a=setup(state,capability='transcription',unit='seconds',currency='USD',fx='0.9')
    a['bounds']['units']='0.25';aid=begin(state,a)
    assert row(state,aid)[1]==Decimal('0.247500')
    meter(state,'report',id=aid,provider_request_id='audio-fixture',usage=dict(input=0,cached=0,output=0,units='0.2'))
    assert row(state,aid)[2]==Decimal('0.180000')
    denied(lambda:attempt(state,a|dict(attempt_no=2,bounds=dict(input=0,cached=0,output=0,units=-1))),'invalid_usage')
    denied(lambda:attempt(state,a|dict(attempt_no=2,bounds=dict(input=0,cached=0,output=0,units=101))),'usage_bounds_exceeded')


def test_free_price_explicit_and_owner_deletion_preserves_global_charge(state):
    a=setup(state);aid=begin(state,a)
    meter(state,'reconcile',id=aid,provider_request_id='deleted-user-charge',actual_native='3',actual_fx='1')
    with psycopg.connect(state.dsn) as conn:
        conn.execute('delete from auth.users where id=%s',(state.people['A'],))
        assert conn.execute('select owner,actual_eur from companion_private.ai_usage_attempts where id=%s',(aid,)).fetchone()==(None,Decimal('3'))
        denied(lambda:conn.execute('update companion_private.ai_prices set input_rate=0 where id=%s',(a['price_id'],)),'price_versions_are_immutable')


def test_verified_free_usage_and_cache_hit_are_not_missing_prices(state):
    a=setup(state,free=True);aid=begin(state,a)
    assert row(state,aid)[1]==0
    meter(state,'report',id=aid,provider_request_id='verified-free',usage=dict(input=1,cached=0,output=0,units=0))
    assert row(state,aid)[0]=='estimated' and row(state,aid)[2]==0
    # Another price version can have cache discounts, but the bound assumes a miss.
    with psycopg.connect(state.dsn) as conn:
        p=conn.execute("insert into companion_private.ai_prices(provider,capability,model,version,currency,eur_fx,fx_asof,input_rate,cached_rate,output_rate,unit,unit_rate,max_input,max_output,max_units,reviewed_at,valid_until,enabled) values('deepseek','chat','cache-fixture','v1','EUR',1,now(),1000000,0,0,'tokens',0,100,100,0,now(),now()+interval '1 day',true) returning id").fetchone()[0]
    aid2=begin(state,a|dict(attempt_no=2,price_id=str(p),bounds=dict(input=2,cached=2,output=0,units=0)))
    assert row(state,aid2)[1]==Decimal('2.2')
    meter(state,'report',id=aid2,provider_request_id='verified-cache-hit',usage=dict(input=2,cached=2,output=0,units=0))
    assert row(state,aid2)[2]==0


def test_budget_lowered_before_dispatch_blocks_existing_reservation(state):
    a=setup(state);aid=attempt(state,a)
    with psycopg.connect(state.dsn) as conn:conn.execute('update companion_private.ai_budget_config set monthly_eur=1')
    denied(lambda:meter(state,'begin',id=aid,lease=a['lease']),'budget_exhausted')
    assert row(state,aid)[0]=='reserved'
