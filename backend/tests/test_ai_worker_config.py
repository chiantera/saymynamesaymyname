import sys
import pytest
from app import cloud_worker


@pytest.mark.parametrize('mode,flags,expected',[
 ('deepseek',{},'live_ai_disabled'),
 ('deepseek',{'AI_LIVE_ENABLED':'1','AI_TERMS_REVIEWED':'1','AI_SAFETY_EVALUATED':'1','WORKER_REGION':'frankfurt'},'safety_unavailable'),
 ('misspelled',{},'worker_configuration_required'),
])
def test_cli_disabled_and_missing_assessor_stop_before_database_or_key(monkeypatch,capsys,mode,flags,expected):
    for key in ('AI_LIVE_ENABLED','AI_TERMS_REVIEWED','AI_SAFETY_EVALUATED','WORKER_REGION'):
        monkeypatch.delenv(key,raising=False)
    monkeypatch.setenv('AI_WORKER_MODE',mode)
    for key,value in flags.items():monkeypatch.setenv(key,value)
    monkeypatch.setattr(sys,'argv',['worker','--once'])
    monkeypatch.setattr(cloud_worker.psycopg,'connect',lambda *a,**k:pytest.fail('must not connect'))
    assert cloud_worker.main()==2
    assert capsys.readouterr().out.strip()==expected
