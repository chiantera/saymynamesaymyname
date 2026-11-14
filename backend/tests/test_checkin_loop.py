from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.repository import DomainError, LOCALES, Repository, compose_mock, utcnow, work_once


@pytest.fixture
def repo(tmp_path):
    return Repository(tmp_path / 'demo.sqlite')


def pending(repo, owner='a', now=None):
    repo.enqueue(owner, now=now)
    assert work_once(repo, now)
    return repo.snapshot(owner)['checkins'][0]


def test_approval_records_exact_reviewed_text_once(repo):
    item = pending(repo)
    repo.decide('a', item['id'], 'approve', 0, 'My own edited reflection.')
    assert repo.entries('a')[0]['text'] == 'My own edited reflection.'
    with pytest.raises(DomainError):
        repo.decide('a', item['id'], 'approve', 0, 'Duplicate')
    assert len(repo.entries('a')) == 1


def test_skip_is_not_fulfillment_and_has_no_artifact(repo):
    item = pending(repo)
    assert repo.decide('a', item['id'], 'skip', 0)['status'] == 'skipped'
    assert repo.entries('a') == []


def test_expiry_and_snooze_have_distinct_lifecycles(repo):
    now = utcnow()
    item = pending(repo, now=now)
    repo.decide('a', item['id'], 'snooze', 0, now=now)
    repo.advance(now + timedelta(minutes=31))
    assert repo.snapshot('a')['checkins'][0]['status'] == 'deferred'
    repo.advance(now + timedelta(hours=1, seconds=1))
    resurfaced = repo.snapshot('a')['checkins'][0]
    assert resurfaced['status'] == 'pending'
    assert resurfaced['version'] == 2
    repo.advance(now + timedelta(hours=2))
    assert repo.snapshot('a')['checkins'][0]['status'] == 'skipped'
    assert not repo.entries('a')


def test_late_approval_cannot_beat_expired_default(repo):
    now = utcnow()
    item = pending(repo, now=now)
    with pytest.raises(DomainError, match='expired'):
        repo.decide('a', item['id'], 'approve', 0, 'Too late', now + timedelta(minutes=31))
    assert repo.snapshot('a')['checkins'][0]['status'] == 'skipped'
    assert not repo.entries('a')


def test_atomic_competing_decisions(repo):
    item = pending(repo)
    def decide(action):
        try:
            return repo.decide('a', item['id'], action, 0, 'Approved text')['status']
        except DomainError:
            return 'lost-race'
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(decide, ['approve', 'skip']))
    assert outcomes.count('lost-race') == 1
    assert len(repo.entries('a')) == (1 if 'fulfilled' in outcomes else 0)


def test_actor_cannot_read_or_mutate_another_actors_content(repo):
    item = pending(repo, 'a')
    assert repo.snapshot('b')['checkins'] == []
    with pytest.raises(DomainError) as error:
        repo.decide('b', item['id'], 'approve', 0, 'Stolen')
    assert error.value.status == 404
    relationship = repo.add_relationship('a', 'Private label')
    assert repo.relationships('b') == []
    with pytest.raises(DomainError):
        repo.enqueue('b', relationship['id'])


def test_restart_preserves_job_and_entry(tmp_path):
    path = tmp_path / 'restart.sqlite'
    first = Repository(path)
    first.enqueue('a')
    second = Repository(path)
    assert work_once(second)
    item = second.snapshot('a')['checkins'][0]
    second.decide('a', item['id'], 'approve', 0, 'Survives restart')
    assert Repository(path).entries('a')[0]['text'] == 'Survives restart'


def test_lease_recovery_rejects_stale_worker(repo):
    now = utcnow()
    repo.enqueue('a', now=now)
    old = repo.claim(now)
    assert repo.claim(now) is None
    new = repo.claim(now + timedelta(seconds=31))
    prompt, draft = compose_mock('en')
    assert not repo.finish(old, prompt, draft, now + timedelta(seconds=32))
    assert repo.finish(new, prompt, draft, now + timedelta(seconds=32))
    assert not repo.finish(new, prompt, draft, now + timedelta(seconds=33))
    assert len(repo.snapshot('a')['checkins']) == 1


@pytest.mark.parametrize('locale', LOCALES)
def test_mock_composer_supports_each_locale(locale):
    prompt, draft = compose_mock(locale)
    assert prompt and draft


def test_api_session_validation_and_explicit_unconfigured_mode(tmp_path):
    app = create_app(tmp_path / 'api.sqlite', demo=True, environment='test')
    with TestClient(app) as client:
        assert client.get('/api/health').json()['live_ai'] is False
        assert client.get('/api/entries').status_code == 401
        assert client.get('/api/demo/session', headers={'Host':'untrusted.example'}).status_code == 400
        assert client.get('/api/demo/session', headers={'Origin':'https://untrusted.example'}).status_code == 403
        token = client.get('/api/demo/session').json()['token']
        headers = {'Authorization':f'Bearer {token}'}
        assert client.post('/api/checkins', json={}, headers=headers).status_code == 202
        assert client.post('/api/checkins', json={}, headers=headers).status_code == 409
        assert client.patch('/api/preferences', json={'locale':'en','timezone':'not/a-zone'}, headers=headers).status_code == 422
        assert client.post('/api/relationships', json={'label':'','owner':'other'}, headers=headers).status_code == 422
    with TestClient(create_app(demo=True, environment='production')) as client:
        assert client.get('/api/health').json()['mode'] == 'unconfigured'
        assert client.get('/api/demo/session').status_code == 503


def test_remote_clients_cannot_open_demo(tmp_path):
    app = create_app(tmp_path/'remote.sqlite', demo=True, environment='test')
    with TestClient(app, client=('203.0.113.12', 12345)) as client:
        assert client.get('/api/demo/session').status_code == 403
