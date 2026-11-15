import psycopg
import pytest
from psycopg.types.json import Jsonb
from test_membership import denied, simultaneous


def call(state, person, action, **args):
    with state.client(person) as conn:
        return conn.execute('select public.reflection_sharing(%s,%s)', (action, Jsonb(args))).fetchone()[0]


def entry(state, person='A', text='Fictional private reflection'):
    with state.client(person) as conn:
        item=conn.execute("select public.create_private_checkin('en','Private prompt','Private draft')").fetchone()[0]
        conn.execute("select public.decide_private_checkin(%s,'approve',0,%s)", (item['id'],text))
        return str(conn.execute('select id from public.companion_entries where checkin_id=%s',(item['id'],)).fetchone()[0])


def share(state,rid,eid,owner='A',recipients=('B',),**overrides):
    args=dict(entry_id=eid,relationship_id=rid,membership_version=state.relationship(owner,rid)['membership_version'],
              recipients=[state.people[p] for p in recipients])
    return call(state,owner,'share',**(args|overrides))['id']


def test_private_default_and_exact_read_only_recipients(state):
    rid=state.group(); eid=entry(state)
    assert call(state,'B','workspace')['received']==[]
    sid=share(state,rid,eid)
    assert call(state,'B','read',share_id=sid)['text']=='Fictional private reflection'
    assert len(call(state,'A','workspace')['sent'])==1
    for person in ('C','D','E'):
        denied(lambda:call(state,person,'read',share_id=sid),'beta_access_required' if person=='E' else 'sharing_unavailable')
    denied(lambda:share(state,rid,eid,owner='B',recipients=('C',)),'sharing_unavailable')
    denied(lambda:call(state,'B','revoke',share_id=sid,recipient=state.people['B']),'sharing_unavailable')
    with state.client('B') as conn:
        assert conn.execute('select count(*) from public.companion_entries').fetchone()[0]==0
    with state.client('B') as conn:
        with pytest.raises(psycopg.Error):conn.execute('select * from companion_private.reflection_shares')
    with psycopg.connect(state.dsn) as conn:
        conn.execute("update public.companion_entries set text='Later private edit' where id=%s",(eid,))
    assert call(state,'B','read',share_id=sid)['text']=='Fictional private reflection'
    denied(lambda:call(state,'B','edit',share_id=sid,text='Changed'),'invalid_action')


def test_atomic_audience_validation_and_stale_preview(state):
    rid=state.group(); eid=entry(state)
    for recipients in ((),('B','B'),('A',),('B','D')):
        denied(lambda:share(state,rid,eid,recipients=recipients),'sharing_unavailable')
    denied(lambda:share(state,rid,eid,membership_version=0),'sharing_unavailable')
    state.act('B','mute',relationship_id=rid,generation=state.relationship('B',rid)['mine']['generation'],value=True)
    denied(lambda:share(state,rid,eid,recipients=('B','C')),'sharing_unavailable')
    assert call(state,'C','workspace')['received']==[]
    assert call(state,'A','workspace')['sent']==[]


def test_pair_block_revokes_both_directions_without_affecting_c(state):
    rid=state.group(); ea=entry(state); eb=entry(state,'B')
    sa=share(state,rid,ea,recipients=('B','C')); sb=share(state,rid,eb,owner='B',recipients=('A','C'))
    state.act('A','block',user_id=state.people['B'],value=True)
    for person,sid in (('A',sb),('B',sa)):
        denied(lambda:call(state,person,'read',share_id=sid),'sharing_unavailable')
        assert call(state,person,'workspace')['received']==[]
    assert len(call(state,'C','workspace')['received'])==2
    share(state,rid,eb,owner='B',recipients=('C',))
    denied(lambda:share(state,rid,ea,recipients=('B',)),'sharing_unavailable')
    state.act('A','block',user_id=state.people['B'],value=False)
    denied(lambda:call(state,'B','read',share_id=sa),'sharing_unavailable')


def test_leave_retains_snapshot_but_owner_can_revoke_it(state):
    rid=state.group(); sid=share(state,rid,entry(state),recipients=('B','C'))
    state.act('B','leave',relationship_id=rid,generation=state.relationship('B',rid)['mine']['generation'])
    assert call(state,'B','read',share_id=sid)['text']
    call(state,'A','revoke',share_id=sid,recipient=state.people['B'])
    call(state,'A','revoke',share_id=sid,recipient=state.people['B'])
    denied(lambda:call(state,'B','read',share_id=sid),'sharing_unavailable')
    assert call(state,'C','read',share_id=sid)['text']


def test_source_deletion_and_owner_beta_revocation(state):
    rid=state.group(); eid=entry(state); sid=share(state,rid,eid)
    with psycopg.connect(state.dsn) as conn:conn.execute('delete from public.beta_access where user_id=%s',(state.people['A'],))
    denied(lambda:call(state,'B','read',share_id=sid),'sharing_unavailable')
    assert call(state,'B','workspace')['received']==[]
    with psycopg.connect(state.dsn) as conn:
        conn.execute('insert into public.beta_access values(%s)',(state.people['A'],))
        conn.execute('delete from public.companion_entries where id=%s',(eid,))
    denied(lambda:call(state,'B','read',share_id=sid),'sharing_unavailable')
    assert call(state,'A','workspace')['sent']==[]


def test_concurrent_block_cannot_leave_readable_grant(state):
    rid=state.group(); eid=entry(state)
    simultaneous(lambda:share(state,rid,eid), lambda:state.act('A','block',user_id=state.people['B'],value=True))
    assert call(state,'B','workspace')['received']==[]
    with psycopg.connect(state.dsn) as conn:
        assert conn.execute('select count(*) from companion_private.reflection_recipients g join companion_private.reflection_shares s on s.id=g.share_id where s.entry_id=%s and g.revoked_at is null',(eid,)).fetchone()[0]==0
