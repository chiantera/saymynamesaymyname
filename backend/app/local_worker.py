"""Operator launcher for running the restricted cloud worker on a trusted machine.

Decision 0005: during testing the operator's own computer may run the AI branch of
`cloud_worker` against the Frankfurt database. The Postgres free tick keeps serving
mock jobs; this launcher only starts the AI (`deepseek`) consumer, which claims
nothing but explicitly AI-tagged jobs, so the two never compete.

Configuration comes from the git-ignored `.local/worker.env`. The provider key is
deliberately NOT accepted from that file: it must be supplied in the process
environment at run time, so nothing loads it automatically.

Output is fixed status codes only. Never print a DSN, password, key or job content.
"""
import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT / '.local' / 'worker.env'

# Keys an operator may set in the file. Anything else is refused, including the
# test-only escape hatches (APP_ENV, WORKER_ALLOW_LOCAL_TEST) and the provider key.
FILE_KEYS = frozenset({
    'WORKER_DATABASE_URL',
    'WORKER_REGION',
    'PGSSLROOTCERT',
    'AI_LIVE_ENABLED',
    'AI_TERMS_REVIEWED',
    'AI_SAFETY_EVALUATED',
    'AI_NETWORK_ENABLED',
    'AI_PRICE_ID',
})
FORBIDDEN_IN_FILE = frozenset({'DEEPSEEK_API_KEY', 'APP_ENV', 'WORKER_ALLOW_LOCAL_TEST', 'AI_WORKER_MODE'})


class LauncherError(Exception):
    """Carries a fixed, non-sensitive status code."""


def parse_env(text):
    values = {}
    for number, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        if '=' not in line:
            raise LauncherError(f'env_line_invalid:{number}')
        key, value = line.split('=', 1)
        key = key.strip()
        if key in FORBIDDEN_IN_FILE:
            raise LauncherError(f'env_key_forbidden:{key}')
        if key not in FILE_KEYS:
            raise LauncherError(f'env_key_unknown:{number}')
        if key in values:
            raise LauncherError(f'env_key_duplicate:{key}')
        values[key] = value.strip()
    return values


def ensure_private(path, root=ROOT):
    """The file must live under .local/ and be ignored by git."""
    resolved = path.resolve()
    if not resolved.is_relative_to((root / '.local').resolve()):
        raise LauncherError('env_file_outside_local')
    ignored = subprocess.run(['git', 'check-ignore', '-q', str(resolved)], cwd=root,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if ignored.returncode != 0:
        raise LauncherError('env_file_not_ignored')
    tracked = subprocess.run(['git', 'ls-files', '--error-unmatch', str(resolved)], cwd=root,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if tracked.returncode == 0:
        raise LauncherError('env_file_tracked')


def load_config(path=ENV_FILE, root=ROOT):
    if not path.is_file():
        raise LauncherError('env_file_missing')
    ensure_private(path, root)
    values = parse_env(path.read_text(encoding='utf-8'))
    cert = values.get('PGSSLROOTCERT')
    if cert:
        cert_path = (root / cert).resolve() if not Path(cert).is_absolute() else Path(cert).resolve()
        if not cert_path.is_relative_to((root / '.local').resolve()) or not cert_path.is_file():
            raise LauncherError('ssl_root_cert_invalid')
        values['PGSSLROOTCERT'] = str(cert_path)
    return values


def build_environment(values, base=None):
    env = dict(os.environ if base is None else base)
    for key in ('APP_ENV', 'WORKER_ALLOW_LOCAL_TEST'):
        env.pop(key, None)
    env.update(values)
    env['APP_ENV'] = 'production'
    env['AI_WORKER_MODE'] = 'deepseek'
    return env


def check(env):
    """Connect as the restricted login and assume the metering role. Claims nothing."""
    import psycopg
    from .cloud_worker import connection_options
    try:
        dsn, options = connection_options(env)
    except (ValueError, TypeError, psycopg.Error):
        return 'worker_configuration_required'
    old = os.environ.get('PGSSLROOTCERT')
    if env.get('PGSSLROOTCERT'):
        os.environ['PGSSLROOTCERT'] = env['PGSSLROOTCERT']
    try:
        with psycopg.connect(dsn, autocommit=True, connect_timeout=10, **options) as conn:
            conn.execute('set role companion_meter')
            if conn.execute('select current_user').fetchone()[0] != 'companion_meter':
                return 'role_unavailable'
    except psycopg.Error:
        return 'connection_or_role_unavailable'
    finally:
        if old is None:
            os.environ.pop('PGSSLROOTCERT', None)
        else:
            os.environ['PGSSLROOTCERT'] = old
    return 'connection_ok'


def gate_report(env):
    """Report which deployment switches are still off, without reading any secret value."""
    missing = [name for name in ('AI_LIVE_ENABLED', 'AI_TERMS_REVIEWED', 'AI_SAFETY_EVALUATED', 'AI_NETWORK_ENABLED')
               if env.get(name) != '1']
    if not env.get('AI_PRICE_ID'):
        missing.append('AI_PRICE_ID')
    if not env.get('DEEPSEEK_API_KEY'):
        missing.append('DEEPSEEK_API_KEY(process environment)')
    missing.append('reviewed_local_safety_assessor')  # none is shipped; see SAFETY-WORKER.md
    return missing


def main(argv=None):
    parser = argparse.ArgumentParser(description='Run the restricted AI worker on this machine.')
    parser.add_argument('--check', action='store_true', help='validate configuration and connection only')
    parser.add_argument('--once', action='store_true', help='process at most one job, then exit')
    args = parser.parse_args(argv)
    try:
        env = build_environment(load_config())
    except LauncherError as error:
        print(str(error), flush=True)
        return 2
    if args.check:
        status = check(env)
        print(status, flush=True)
        print('ai_gates_open: ' + ', '.join(gate_report(env)), flush=True)
        return 0 if status == 'connection_ok' else 1
    command = [sys.executable, '-m', 'app.cloud_worker'] + (['--once'] if args.once else [])
    return subprocess.run(command, cwd=ROOT / 'backend', env=env).returncode


if __name__ == '__main__':
    raise SystemExit(main())
