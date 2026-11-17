import pytest
import psycopg
from psycopg.types.json import Jsonb
from test_membership import denied
from test_sharing import entry,share


@pytest.fixture(autouse=True)
def reset_providers(state):
    with psycopg.connect(state.dsn) as conn:conn.execute('update companion_private.ai_provider_catalog set enabled=false,review_revision=null,policy_url=null,reviewed_at=null')
    yield
    with psycopg.connect(state.dsn) as conn:conn.execute('update companion_private.ai_provider_catalog set enabled=false,review_revision=null,policy_url=null,reviewed_at=null')


def consent(state,person='A',action='get',**args):
    with state.client(person) as conn:return conn.execute('select public.ai_consent(%s,%s)',(action,Jsonb(args))).fetchone()[0]


def change(state,action,person='A',**args):
    revision=consent(state,person)['revision']
    return consent(state,person,action,**(dict(revision=revision)|args))


def reviewed(state):
    with psycopg.connect(state.dsn) as conn:conn.execute("update companion_private.ai_provider_catalog set enabled=true,review_revision='fictional-v1',policy_url='https://example.invalid/test-policy',reviewed_at=now() where provider='deepseek' and capability='chat'")


def grant(state,**args):return change(state,'provider',provider='deepseek',capability='chat',approved=True,allow_fallback=False,review_revision='fictional-v1',**args)


def eligible(state,person='A',**args):return consent(state,person,'eligible',**(dict(provider='deepseek',capability='chat')|args))


def test_default_denial_and_unreviewed_provider(state):
    current=consent(state)
    assert current['revision']==0 and not current['journals'] and not current['documents'] and not current['chats']
    assert all(not p['can_approve'] and not p['approved'] and not p['allow_fallback'] for p in current['providers'])
    denied(lambda:grant(state),'provider_unavailable')
    denied(lambda:change(state,'context',journals=True,documents=True,chats=False),'source_unavailable')
    assert eligible(state)==[]
    assert consent(state,'B',owner=state.people['A'])['revision']==0


def test_exact_capability_consent_fallback_and_terms_revision(state):
    eid=entry(state);reviewed(state)
    change(state,'context',journals=True,documents=False,chats=False)
    assert eligible(state)==[]
    grant(state);assert eligible(state)==[eid]
    assert eligible(state,fallback=True)==[]
    change(state,'provider',provider='deepseek',capability='chat',approved=True,allow_fallback=True,review_revision='fictional-v1')
    assert eligible(state,fallback=True)==[eid]
    assert eligible(state,capability='ocr')==[]
    with psycopg.connect(state.dsn) as conn:conn.execute("update companion_private.ai_provider_catalog set review_revision='fictional-v2' where provider='deepseek' and capability='chat'")
    assert eligible(state)==[]
    assert not next(p for p in consent(state)['providers'] if p['provider']=='deepseek' and p['capability']=='chat')['approved']
    denied(lambda:grant(state),'provider_unavailable')


def test_per_item_exclusion_and_cross_member_privacy(state):
    rid=state.group();eid=entry(state);share(state,rid,eid)
    reviewed(state);grant(state);change(state,'context',journals=True,documents=False,chats=False)
    change(state,'exclusion',entry_id=eid,excluded=True)
    assert eligible(state)==[]
    assert consent(state)['exclusions']==[eid]
    denied(lambda:change(state,'exclusion',person='B',entry_id=eid,excluded=True),'source_unavailable')
    assert consent(state,'B')['exclusions']==[]
    change(state,'context',journals=False,documents=False,chats=False)
    change(state,'context',journals=True,documents=False,chats=False)
    assert eligible(state)==[]  # Category toggles never erase an individual exclusion.
    change(state,'exclusion',entry_id=eid,excluded=False)
    assert eligible(state)==[eid]
    with state.client('A') as conn:denied(lambda:conn.execute('select * from companion_private.ai_preferences'),'permission denied')
    with psycopg.connect(state.dsn) as conn:
        conn.execute('set local role companion_worker')
        denied(lambda:conn.execute('select * from public.companion_entries'),'permission denied')


def test_revocation_stale_requests_runtime_off_and_event_cleanup(state):
    eid=entry(state);reviewed(state);grant(state);change(state,'context',journals=True,documents=False,chats=False)
    denied(lambda:change(state,'context',revision=0,journals=False,documents=False,chats=False),'stale_consent')
    with psycopg.connect(state.dsn) as conn:conn.execute("update companion_private.ai_provider_catalog set enabled=false where provider='deepseek' and capability='chat'")
    assert eligible(state)==[]
    change(state,'provider',provider='deepseek',capability='chat',approved=False,allow_fallback=False)
    with psycopg.connect(state.dsn) as conn:conn.execute("update companion_private.ai_provider_catalog set enabled=true where provider='deepseek' and capability='chat'")
    assert eligible(state)==[]
    with psycopg.connect(state.dsn) as conn:
        conn.execute("update companion_private.ai_consent_events set created_at=now()-interval '91 days' where owner=%s",(state.people['A'],))
        assert conn.execute('select companion_private.cleanup_ai_consents()').fetchone()[0]>=1
        assert conn.execute('select count(*) from companion_private.ai_consent_events where owner=%s',(state.people['A'],)).fetchone()[0]==0
        conn.execute('delete from public.companion_entries where id=%s',(eid,))
        assert conn.execute('select count(*) from companion_private.ai_entry_exclusions where owner=%s',(state.people['A'],)).fetchone()[0]==0


def test_incomplete_review_cannot_enable_and_url_changes_revoke(state):
    with psycopg.connect(state.dsn) as conn:
        try:
            with conn.transaction():
                conn.execute("update companion_private.ai_provider_catalog set enabled=true,review_revision='fixture',reviewed_at=now(),policy_url=null where provider='deepseek' and capability='chat'")
        except psycopg.errors.CheckViolation:pass
        else:raise AssertionError('Missing policy URL enabled processing')
    eid=entry(state);reviewed(state);grant(state);change(state,'context',journals=True,documents=False,chats=False)
    assert eligible(state)==[eid]
    with psycopg.connect(state.dsn) as conn:conn.execute("update companion_private.ai_provider_catalog set policy_url='https://example.invalid/revised-policy' where provider='deepseek' and capability='chat'")
    assert eligible(state)==[]
    with psycopg.connect(state.dsn) as conn:conn.execute("update companion_private.ai_provider_catalog set policy_url='https://example.invalid/test-policy' where provider='deepseek' and capability='chat'")
    assert eligible(state)==[]
