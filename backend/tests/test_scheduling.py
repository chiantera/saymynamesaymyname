from datetime import datetime, timezone, timedelta
from app.repository import work_once
from test_checkin_loop import repo

def at(value): return datetime.fromisoformat(value).astimezone(timezone.utc)
def clear(repo,now):
    item=repo.snapshot('a')['checkins'][0]
    repo.decide('a',item['id'],'skip',item['version'],now=now)

def test_quiet_window_and_cadence(repo):
    repo.configure_schedule('a')
    assert repo.dispatch_due(at('2026-11-14T06:59:00+00:00'))==0
    now=at('2026-11-14T07:00:00+00:00')
    assert repo.dispatch_due(now)==1
    assert repo.dispatch_due(now)==0
    assert work_once(repo,now)
    clear(repo,now)
    assert repo.dispatch_due(now+timedelta(hours=5))==0
    assert repo.dispatch_due(now+timedelta(hours=6))==1

def test_pause_and_cap_across_relationships(repo):
    repo.configure_schedule('a',paused=True)
    now=at('2026-11-14T08:00:00+00:00')
    assert repo.dispatch_due(now)==0
    for n in range(4):
        scope=repo.add_relationship('a',str(n))['id']
        repo.configure_schedule('a',scope=scope,cap=1)
    assert repo.dispatch_due(now)==1
    assert work_once(repo,now)
    clear(repo,now)
    assert repo.dispatch_due(now+timedelta(hours=1))==0
    assert repo.dispatch_due(now+timedelta(days=1))==1

def test_pause_after_claim_prevents_presentation(repo):
    now=at('2026-11-14T08:00:00+00:00')
    repo.configure_schedule('a');repo.dispatch_due(now)
    job=repo.claim(now)
    repo.configure_schedule('a',paused=True)
    assert not repo.finish(job,'prompt','draft',now)
    assert repo.snapshot('a')['checkins']==[]

def test_dst_and_no_backlog_burst(repo):
    repo.configure_schedule('a')
    for instant in ['2026-10-25T00:30:00+00:00','2026-10-25T01:30:00+00:00','2026-03-29T01:30:00+00:00']:
        assert repo.dispatch_due(at(instant))==0
    now=at('2026-10-25T07:00:00+00:00')
    assert repo.dispatch_due(now)==1
    assert repo.dispatch_due(now)==0
    assert work_once(repo,now)
    clear(repo,now)
    assert repo.dispatch_due(now)==0

def test_timed_pause_and_fair_scopes(repo):
    now=at('2026-11-14T08:00:00+00:00')
    scope=repo.add_relationship('a','scope')['id']
    repo.configure_schedule('a',paused_until=(now+timedelta(hours=1)).isoformat())
    repo.configure_schedule('a',scope=scope,paused_until=(now+timedelta(hours=1)).isoformat())
    assert repo.dispatch_due(now)==0
    later=now+timedelta(hours=1)
    assert repo.dispatch_due(later)==1
    assert work_once(repo,later)
    first=repo.snapshot('a')['checkins'][0]['relationship_id']
    clear(repo,later)
    assert repo.dispatch_due(later+timedelta(hours=6))==1
    assert work_once(repo,later+timedelta(hours=6))
    assert repo.snapshot('a')['checkins'][0]['relationship_id'] != first

def test_no_cross_scope_burst_and_disable_revokes_claim(repo):
    now=at('2026-11-14T08:00:00+00:00')
    scope=repo.add_relationship('a','second')['id']
    repo.configure_schedule('a');repo.configure_schedule('a',scope=scope)
    repo.dispatch_due(now);work_once(repo,now);clear(repo,now)
    assert repo.dispatch_due(now+timedelta(minutes=1))==0
    later=now+timedelta(hours=6)
    assert repo.dispatch_due(later)==1
    job=repo.claim(later)
    repo.configure_schedule('a',scope=job['relationship_id'] or '',enabled=False)
    assert not repo.finish(job,'prompt','draft',later)

def test_pause_cancels_snoozed_scheduled_prompt(repo):
    now=at('2026-11-14T08:00:00+00:00')
    repo.configure_schedule('a');repo.dispatch_due(now);work_once(repo,now)
    item=repo.snapshot('a')['checkins'][0]
    repo.decide('a',item['id'],'snooze',0,now=now)
    repo.configure_schedule('a',paused=True)
    assert repo.snapshot('a')['checkins'][0]['status']=='cancelled'
    repo.advance(now+timedelta(hours=2))
    assert repo.snapshot('a')['checkins'][0]['status']=='cancelled'
