"""Real SQL, fictional text; fixtures refuse hosted databases."""
import uuid
import psycopg
import pytest
from psycopg.types.json import Jsonb
from test_membership import simultaneous

def invoke(state, person, action, **args):
    with state.client(person) as conn:
        return conn.execute('select public.edit_recovery(%s,%s)',(action,Jsonb(args))).fetchone()[0]

def setup_checkin(state):
    with state.client('A') as conn:
        return conn.execute("select public.create_private_checkin('en','Fictional prompt','Draft')").fetchone()[0]

def test_private_idempotent_copies_cannot_be_overwritten_or_resurrected(state):
    checkin=setup_checkin(state);rid=str(uuid.uuid4())
    args=dict(id=rid,checkin_id=checkin['id'],base_version=checkin['version'],text='Private fictional edit')
    assert invoke(state,'A','save',**args)=={'id':rid}
    assert invoke(state,'A','save',**args)=={'id':rid}
    assert invoke(state,'B','list')==[]
    with pytest.raises(psycopg.Error):invoke(state,'B','dismiss',id=rid,checkin_id=checkin['id'],base_version=0)
    with pytest.raises(psycopg.Error):invoke(state,'B','save',**args)
    with pytest.raises(psycopg.Error):invoke(state,'A','save',**{**args,'text':'Changed'})
    assert invoke(state,'A','list')[0]['text']=='Private fictional edit'
    assert invoke(state,'A','dismiss',id=rid,checkin_id=checkin['id'],base_version=0)=={'dismissed':True}
    assert invoke(state,'A','list')==[]
    with pytest.raises(psycopg.Error):invoke(state,'A','save',**args)
    with psycopg.connect(state.dsn) as conn:
        assert conn.execute('select text,deleted_at is not null from companion_private.edit_recoveries where id=%s',(rid,)).fetchone()==(None,True)
        conn.execute('delete from public.companion_checkins where id=%s',(checkin['id'],))
        assert conn.execute('select count(*) from companion_private.edit_recoveries where id=%s',(rid,)).fetchone()[0]==0

def test_access_limits_and_independent_versions(state):
    checkin=setup_checkin(state)
    def args(text,version=0):return dict(id=str(uuid.uuid4()),checkin_id=checkin['id'],base_version=version,text=text)
    invoke(state,'A','save',**args(''))
    invoke(state,'A','save',**args('Another private edit'))
    assert len(invoke(state,'A','list'))==2
    with pytest.raises(psycopg.Error):invoke(state,'A','save',**args('x'*5001))
    with pytest.raises(psycopg.Error):invoke(state,'A','save',**args('Future',999))
    with pytest.raises(psycopg.Error):invoke(state,'E','list')
    with pytest.raises(psycopg.Error):
        with state.client('A') as conn:conn.execute('select * from companion_private.edit_recoveries')

def test_dismiss_before_delayed_save_creates_tombstone(state):
    item=setup_checkin(state);rid=str(uuid.uuid4())
    args=dict(id=rid,checkin_id=item['id'],base_version=0)
    assert invoke(state,'A','dismiss',**args)=={'dismissed':True}
    assert invoke(state,'A','dismiss',**args)=={'dismissed':True}
    with pytest.raises(psycopg.Error):invoke(state,'A','save',**args,text='Late write')
    assert invoke(state,'A','list')==[]

def test_concurrent_save_and_dismiss_never_resurrect(state):
    item=setup_checkin(state);rid=str(uuid.uuid4())
    args=dict(id=rid,checkin_id=item['id'],base_version=0)
    outcomes=simultaneous(lambda:invoke(state,'A','save',**args,text='Concurrent edit'),
                          lambda:invoke(state,'A','dismiss',**args))
    assert outcomes[1]==('ok',{'dismissed':True})
    assert invoke(state,'A','list')==[]
    with pytest.raises(psycopg.Error):invoke(state,'A','save',**args,text='Concurrent edit')


def checkpoint(state, person, action, **args):
    with state.client(person) as conn:
        return conn.execute('select public.active_edit_checkpoint(%s,%s)',(action,Jsonb(args))).fetchone()[0]


def test_active_checkpoints_are_revisioned_private_and_fenced(state):
    source=setup_checkin(state); rid=str(uuid.uuid4())
    args=dict(id=rid,checkin_id=source['id'],base_version=source['version'])
    assert checkpoint(state,'A','save',**args,revision=1,text='First')=={'id':rid,'revision':1}
    assert checkpoint(state,'A','save',**args,revision=2,text='Second')=={'id':rid,'revision':2}
    assert checkpoint(state,'A','save',**args,revision=2,text='Second')=={'id':rid,'revision':2}
    with pytest.raises(psycopg.Error):checkpoint(state,'A','save',**args,revision=1,text='First')
    with pytest.raises(psycopg.Error):checkpoint(state,'A','save',**args,revision=2,text='Other')
    assert checkpoint(state,'B','list')==[]
    with pytest.raises(psycopg.Error):checkpoint(state,'B','save',**args,revision=3,text='Other')
    assert checkpoint(state,'A','list')[0]['text']=='Second'
    assert checkpoint(state,'A','dismiss',**args)=={'dismissed':True}
    with pytest.raises(psycopg.Error):checkpoint(state,'A','save',**args,revision=3,text='Late')
    assert checkpoint(state,'A','list')==[]
    with psycopg.connect(state.dsn) as conn:
        assert conn.execute('select text,deleted_at is not null from companion_private.active_edit_checkpoints where id=%s',(rid,)).fetchone()==(None,True)
        conn.execute('delete from public.companion_checkins where id=%s',(source['id'],))
        assert conn.execute('select count(*) from companion_private.active_edit_checkpoints where id=%s',(rid,)).fetchone()[0]==0


def test_active_checkpoint_concurrent_dismiss_and_save(state):
    source=setup_checkin(state)
    args=dict(id=str(uuid.uuid4()),checkin_id=source['id'],base_version=source['version'])
    outcomes=simultaneous(lambda:checkpoint(state,'A','save',**args,revision=1,text='Private'),
                          lambda:checkpoint(state,'A','dismiss',**args))
    assert outcomes[1]==('ok',{'dismissed':True})
    assert checkpoint(state,'A','list')==[]
    with pytest.raises(psycopg.Error):checkpoint(state,'A','save',**args,revision=2,text='Late')


def test_active_checkpoint_concurrent_revisions_keep_newest(state):
    source=setup_checkin(state)
    args=dict(id=str(uuid.uuid4()),checkin_id=source['id'],base_version=source['version'])
    simultaneous(lambda:checkpoint(state,'A','save',**args,revision=1,text='Earlier'),
                 lambda:checkpoint(state,'A','save',**args,revision=2,text='Latest'))
    item=checkpoint(state,'A','list')[0]
    assert item['revision']==2 and item['text']=='Latest'
    with pytest.raises(psycopg.Error):checkpoint(state,'E','list')
    with pytest.raises(psycopg.Error):
        with state.client('A') as conn:conn.execute('select * from companion_private.active_edit_checkpoints')
