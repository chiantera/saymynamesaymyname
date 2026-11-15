from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import psycopg
from psycopg.types.json import Jsonb
import pytest

def denied(call,reason):
    with pytest.raises(psycopg.Error,match=reason): call()

def simultaneous(*calls):
    barrier=Barrier(len(calls))
    def run(call):
        barrier.wait(timeout=5)
        try: return ('ok',call())
        except psycopg.Error as error: return ('denied',str(error).splitlines()[0])
    with ThreadPoolExecutor(max_workers=len(calls)) as pool: return list(pool.map(run,calls))

def test_unanimity_and_recipient_binding(state):
    rid=state.group()
    iid=state.propose('A',rid,'D')
    item=state.relationship('A',rid)['invitations'][0]
    assert item['approval_count']==1 and item['member_count']==3 and not item['approved']
    denied(lambda:state.issue('A',iid),'invite_not_ready')
    denied(lambda:state.act('D','approve',invitation_id=iid),'member_unavailable')
    state.act('A','approve',invitation_id=iid,member_id=state.people['B'])
    assert state.relationship('A',rid)['invitations'][0]['approval_count']==1
    state.act('B','approve',invitation_id=iid)
    denied(lambda:state.issue('A',iid),'invite_not_ready')
    state.act('C','approve',invitation_id=iid)
    token=state.issue('B',iid)
    assert len(token)==64 and state.preview('D',token)['label']=='Fictional space'
    denied(lambda:state.preview('A',token),'invite_unavailable')
    denied(lambda:state.act('B','accept',token=token,alias='forwarded'),'invite_unavailable')
    denied(lambda:state.preview('E',token),'beta_access_required')

def test_join_adds_no_private_history_grant(state):
    rid=state.create()
    with state.client('A') as conn:
        item=conn.execute("select public.create_private_checkin('en','private prompt','private draft')").fetchone()[0]
        conn.execute("select public.decide_private_checkin(%s,'approve',0,'Private A history')",(item['id'],))
    iid=state.propose('A',rid,'B')
    state.act('B','accept',token=state.issue('A',iid),alias='B')
    with state.client('B') as conn:
        assert conn.execute('select count(*) from public.companion_entries').fetchone()[0]==0
        assert conn.execute('select count(*) from public.companion_checkins').fetchone()[0]==0
        assert conn.execute('select count(*) from public.companion_relationships').fetchone()[0]==1

def test_forwarded_token_and_recipient_decline(state):
    rid=state.create(); token=state.issue('A',state.propose('A',rid,'B'))
    denied(lambda:state.preview('C',token),'invite_unavailable')
    denied(lambda:state.act('C','accept',token=token,alias='C'),'invite_unavailable')
    state.act('B','decline',token=token)
    denied(lambda:state.preview('B',token),'invite_unavailable')
    assert not state.workspace('B')['relationships']

def test_existing_private_sync_regressions(database_url):
    from pathlib import Path
    query=(Path(__file__).resolve().parents[2]/'supabase/tests/private_sync.sql').read_text(encoding='utf-8')
    with psycopg.connect(database_url,autocommit=True) as conn: conn.execute(query)

def test_simultaneous_redemption_is_single_use(state):
    rid=state.create(); iid=state.propose('A',rid,'B'); token=state.issue('A',iid)
    results=simultaneous(lambda:state.act('B','accept',token=token,alias='B'),lambda:state.act('B','accept',token=token,alias='B'))
    assert sorted(r[0] for r in results)==['denied','ok']
    assert len(state.relationship('A',rid)['members'])==2
    assert state.relationship('B',rid)['mine']['generation']==1

def test_simultaneous_joins_cannot_reuse_the_old_approval_round(state):
    rid=state.create()
    token_b=state.issue('A',state.propose('A',rid,'B'))
    token_c=state.issue('A',state.propose('A',rid,'C'))
    results=simultaneous(lambda:state.act('B','accept',token=token_b,alias='B'),lambda:state.act('C','accept',token=token_c,alias='C'))
    assert sorted(r[0] for r in results)==['denied','ok']
    assert len(state.relationship('A',rid)['members'])==2

def test_concurrent_approvals_survive_and_concurrent_issue_has_one_winner(state):
    rid=state.group(); iid=state.propose('A',rid,'D')
    assert all(r[0]=='ok' for r in simultaneous(lambda:state.act('B','approve',invitation_id=iid),lambda:state.act('C','approve',invitation_id=iid)))
    assert state.relationship('A',rid)['invitations'][0]['approval_count']==3
    results=simultaneous(lambda:state.issue('A',iid),lambda:state.issue('B',iid))
    assert sorted(r[0] for r in results)==['denied','ok']
    token=next(r[1] for r in results if r[0]=='ok')
    assert state.preview('D',token)

def test_reissue_rotates_secret_and_revoke_cannot_be_undone_by_old_link(state):
    rid=state.create(); iid=state.propose('A',rid,'B')
    original=state.issue('A',iid); replacement=state.issue('A',iid,version=1)
    assert original!=replacement
    denied(lambda:state.preview('B',original),'invite_unavailable')
    assert state.preview('B',replacement)
    state.act('A','revoke',invitation_id=iid)
    denied(lambda:state.act('B','accept',token=replacement,alias='B'),'invite_unavailable')

def test_seven_day_expiry_and_digest_only_storage(state):
    rid=state.create(); iid=state.propose('A',rid,'B'); token=state.issue('A',iid)
    with psycopg.connect(state.dsn) as conn:
        days,digest=conn.execute("select extract(epoch from expires_at-issued_at)/86400,token_digest from companion_private.invitations where id=%s",(iid,)).fetchone()
        assert 6.99<float(days)<7.01 and digest!=token
        conn.execute("update companion_private.invitations set issued_at=now()-interval '8 days',expires_at=now()-interval '1 day' where id=%s",(iid,))
    denied(lambda:state.preview('B',token),'invite_unavailable')
    denied(lambda:state.issue('A',iid,version=1),'invite_not_ready')

def test_pairwise_block_never_suspends_b_or_b_c(state):
    rid=state.group()
    state.act('A','block',user_id=state.people['B'],value=True)
    def contacts(who): return {m['alias']:m['can_contact'] for m in state.relationship(who,rid)['members']}
    assert contacts('A')['B'] is False and contacts('B')['A'] is False
    assert contacts('B')['C'] is True and contacts('C')['B'] is True
    assert len(state.relationship('C',rid)['members'])==3
    with state.client('B') as conn:
        assert conn.execute("select public.create_private_checkin('en','own prompt','own draft')").fetchone()[0]['status']=='pending'
    state.act('B','block',user_id=state.people['A'],value=False)
    assert contacts('B')['A'] is False  # cannot remove A's block
    state.act('A','block',user_id=state.people['B'],value=False)
    assert contacts('B')['A'] is True

def test_blocked_target_invite_revoked_but_separate_b_c_space_allowed(state):
    rid=state.group()
    state.act('B','leave',relationship_id=rid,generation=1)
    iid=state.propose('C',rid,'B'); state.act('A','approve',invitation_id=iid)
    token=state.issue('C',iid)
    state.act('A','block',user_id=state.people['B'],value=True)
    denied(lambda:state.preview('B',token),'invite_unavailable')
    state.act('A','block',user_id=state.people['B'],value=False)
    denied(lambda:state.preview('B',token),'invite_unavailable')  # no resurrection
    state.act('A','block',user_id=state.people['B'],value=True)
    separate=state.create('C'); iid=state.propose('C',separate,'B')
    state.act('B','accept',token=state.issue('C',iid),alias='B')
    assert next(m for m in state.relationship('B',separate)['members'] if m['alias']=='C')['can_contact']

def test_archive_and_mute_are_personal(state):
    rid=state.group()
    state.act('A','archive',relationship_id=rid,generation=1,value=True)
    assert state.relationship('A',rid)['mine']['archived']
    assert not state.relationship('B',rid)['mine']['archived']
    assert next(m for m in state.relationship('B',rid)['members'] if m['alias']=='C')['can_contact']
    assert not next(m for m in state.relationship('B',rid)['members'] if m['alias']=='A')['can_contact']
    state.act('A','archive',relationship_id=rid,generation=1,value=False)
    state.act('A','mute',relationship_id=rid,generation=1,value=True)
    assert state.relationship('A',rid)['mine']['muted']
    assert not state.relationship('C',rid)['mine']['muted']

def test_creator_can_leave_and_rejoin_requires_fresh_generation(state):
    rid=state.group(); iid=state.propose('B',rid,'D')
    state.act('A','leave',relationship_id=rid,generation=1)
    assert not state.workspace('A')['relationships']
    denied(lambda:state.issue('B',iid),'invite_not_ready')
    with state.client('A') as conn:
        assert not conn.execute('select * from public.companion_relationships where id=%s',(rid,)).fetchall()
    iid=state.propose('B',rid,'A'); state.act('C','approve',invitation_id=iid)
    state.act('A','accept',token=state.issue('B',iid),alias='A returned')
    assert state.relationship('A',rid)['mine']['generation']==2
    denied(lambda:state.act('A','leave',relationship_id=rid,generation=1),'stale_membership')

def test_stale_proposal_and_client_privilege_bypasses_denied(state):
    rid=state.group()
    denied(lambda:state.act('A','propose',relationship_id=rid,email=state.emails['D'],membership_version=1),'stale_membership')
    denied(lambda:state.act('E','create',label='x',alias='E'),'beta_access_required')
    with state.client('A') as conn:
        with pytest.raises(psycopg.Error):
            with conn.transaction(): conn.execute('select * from companion_private.invitations')
        with pytest.raises(psycopg.Error):
            with conn.transaction(): conn.execute('select companion_private.pair_blocked(%s,%s)',(state.people['B'],state.people['C']))
        with pytest.raises(psycopg.Error):
            with conn.transaction(): conn.execute('insert into public.companion_relationships(owner,label) values(%s,\'bypass\')',(state.people['A'],))
