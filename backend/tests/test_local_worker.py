import subprocess
from pathlib import Path

import pytest

from app import local_worker
from app.local_worker import LauncherError, build_environment, gate_report, load_config, parse_env

SECRET = 'postgresql://login.ref:fictional-secret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'


def test_parse_accepts_only_allowlisted_keys():
    values = parse_env(f'# comment\n\nWORKER_DATABASE_URL={SECRET}\nWORKER_REGION=frankfurt\n')
    assert values == {'WORKER_DATABASE_URL': SECRET, 'WORKER_REGION': 'frankfurt'}


@pytest.mark.parametrize('line,code', [
    ('DEEPSEEK_API_KEY=sk-fictional', 'env_key_forbidden:DEEPSEEK_API_KEY'),
    ('APP_ENV=test', 'env_key_forbidden:APP_ENV'),
    ('WORKER_ALLOW_LOCAL_TEST=1', 'env_key_forbidden:WORKER_ALLOW_LOCAL_TEST'),
    ('AI_WORKER_MODE=mock', 'env_key_forbidden:AI_WORKER_MODE'),
    ('SOMETHING=1', 'env_key_unknown:1'),
    ('no equals sign', 'env_line_invalid:1'),
])
def test_parse_refuses_unsafe_lines(line, code):
    with pytest.raises(LauncherError) as error:
        parse_env(line)
    assert str(error.value) == code
    assert 'sk-fictional' not in str(error.value)


def test_duplicate_key_refused():
    with pytest.raises(LauncherError, match='env_key_duplicate'):
        parse_env('WORKER_REGION=frankfurt\nWORKER_REGION=elsewhere')


def test_environment_forces_ai_mode_and_strips_test_hatches():
    env = build_environment({'WORKER_REGION': 'frankfurt'},
                            base={'APP_ENV': 'test', 'WORKER_ALLOW_LOCAL_TEST': '1', 'PATH': 'x'})
    assert env['APP_ENV'] == 'production'
    assert env['AI_WORKER_MODE'] == 'deepseek'
    assert 'WORKER_ALLOW_LOCAL_TEST' not in env
    assert env['PATH'] == 'x'


def test_gate_report_lists_closed_gates_without_values():
    report = gate_report({'AI_LIVE_ENABLED': '1', 'DEEPSEEK_API_KEY': 'sk-fictional'})
    assert 'AI_LIVE_ENABLED' not in report
    assert 'AI_NETWORK_ENABLED' in report
    assert 'reviewed_local_safety_assessor' in report
    assert not any('sk-fictional' in item for item in report)


def _repo(tmp_path):
    subprocess.run(['git', 'init', '-q', str(tmp_path)], check=True)
    (tmp_path / '.gitignore').write_text('.local/\n', encoding='utf-8')
    (tmp_path / '.local').mkdir()
    return tmp_path


def test_missing_file(tmp_path):
    root = _repo(tmp_path)
    with pytest.raises(LauncherError, match='env_file_missing'):
        load_config(root / '.local' / 'worker.env', root)


def test_file_outside_local_refused(tmp_path):
    root = _repo(tmp_path)
    path = root / 'worker.env'
    path.write_text('WORKER_REGION=frankfurt\n', encoding='utf-8')
    with pytest.raises(LauncherError, match='env_file_outside_local'):
        load_config(path, root)


def test_unignored_file_refused(tmp_path):
    root = _repo(tmp_path)
    (root / '.gitignore').write_text('', encoding='utf-8')
    path = root / '.local' / 'worker.env'
    path.write_text('WORKER_REGION=frankfurt\n', encoding='utf-8')
    with pytest.raises(LauncherError, match='env_file_not_ignored'):
        load_config(path, root)


def test_cert_must_live_under_local(tmp_path):
    root = _repo(tmp_path)
    outside = root / 'ca.crt'
    outside.write_text('fictional', encoding='utf-8')
    path = root / '.local' / 'worker.env'
    path.write_text('PGSSLROOTCERT=ca.crt\n', encoding='utf-8')
    with pytest.raises(LauncherError, match='ssl_root_cert_invalid'):
        load_config(path, root)
    inside = root / '.local' / 'ca.crt'
    inside.write_text('fictional', encoding='utf-8')
    path.write_text('PGSSLROOTCERT=.local/ca.crt\n', encoding='utf-8')
    assert Path(load_config(path, root)['PGSSLROOTCERT']) == inside.resolve()


def test_main_reports_code_not_secret(tmp_path, monkeypatch, capsys):
    root = _repo(tmp_path)
    path = root / '.local' / 'worker.env'
    path.write_text(f'WORKER_DATABASE_URL={SECRET}\nDEEPSEEK_API_KEY=sk-fictional\n', encoding='utf-8')
    monkeypatch.setattr(local_worker, 'ROOT', root)
    monkeypatch.setattr(local_worker, 'ENV_FILE', path)
    monkeypatch.setattr(local_worker, 'load_config', lambda: load_config(path, root))
    assert local_worker.main(['--check']) == 2
    out = capsys.readouterr().out
    assert 'env_key_forbidden:DEEPSEEK_API_KEY' in out
    assert 'fictional-secret' not in out and 'sk-fictional' not in out
