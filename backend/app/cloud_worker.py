"""Restricted, mock-only Postgres worker. No user content retrieval or external AI."""
import argparse
import json
import os
import signal
import threading
from pathlib import Path
import psycopg

ROOT=Path(__file__).resolve().parents[2]
STOP=threading.Event()


def connection_options(env):
    dsn=env.get('WORKER_DATABASE_URL','')
    if not dsn:raise ValueError('worker_configuration_required')
    info=psycopg.conninfo.conninfo_to_dict(dsn)
    host=info.get('host','')
    local=host in ('localhost','127.0.0.1')
    if local and env.get('APP_ENV')=='test' and env.get('WORKER_ALLOW_LOCAL_TEST')=='1':
        return dsn,{}
    hosts={'db.chxlkmmkoadgcaomkznd.supabase.co','aws-0-eu-central-1.pooler.supabase.com','aws-1-eu-central-1.pooler.supabase.com'}
    if host not in hosts or env.get('WORKER_REGION')!='frankfurt' or not info.get('password') or not info.get('user'):
        raise ValueError('worker_configuration_required')
    if host.endswith('.pooler.supabase.com') and not info['user'].endswith('.chxlkmmkoadgcaomkznd'):
        raise ValueError('worker_project_mismatch')
    if info['user'].split('.')[0] in ('postgres','service_role','supabase_admin'):
        raise ValueError('restricted_worker_login_required')
    return dsn,{'sslmode':'verify-full'}


def run_once(conn):
    conn.execute('select companion_private.worker_heartbeat()')
    job=conn.execute('select companion_private.claim_cloud_job()').fetchone()[0]
    if not job:return False
    catalog=json.loads((ROOT/'shared/locales'/(job['locale']+'.json')).read_text(encoding='utf-8'))
    return conn.execute('select companion_private.finish_cloud_job(%s,%s,%s,%s)',
        (job['id'],job['lease'],catalog['mockPrompt'],catalog['mockDraft'])).fetchone()[0]


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--once',action='store_true');args=parser.parse_args()
    try:dsn,options=connection_options(os.environ)
    except (ValueError,TypeError,psycopg.Error):print('worker_configuration_required',flush=True);return 2
    for sig in (signal.SIGINT,signal.SIGTERM):signal.signal(sig,lambda *_:STOP.set())
    delay=1
    while not STOP.is_set():
        try:
            with psycopg.connect(dsn,autocommit=True,connect_timeout=10,**options) as conn:
                conn.execute('set role companion_worker')
                conn.execute("set statement_timeout='15s'")
                while not STOP.is_set():
                    run_once(conn);delay=1
                    if args.once:return 0
                    STOP.wait(5)
        except Exception:
            # Never emit DB exception text, DSNs, aliases, prompts or auth tokens.
            print('worker_attempt_unavailable',flush=True)
            if args.once:return 1
            STOP.wait(delay);delay=min(delay*2,60)
    return 0


if __name__=='__main__':raise SystemExit(main())
