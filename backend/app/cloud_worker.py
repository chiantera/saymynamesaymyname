"""Restricted worker: mock by default, dormant explicitly gated solo AI path."""
import argparse
import json
import os
import signal
import threading
from uuid import UUID
from pathlib import Path
import psycopg
from psycopg.types.json import Jsonb
from .ai import Composer, DeepSeekHTTP, Denied, Deployment, PostgresGate, Task
from .safety import PolicySafety, POLICY, fingerprint

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


class WorkerGate(PostgresGate):
    def job(self, action, **args):
        self._idle()
        return self.connection.execute('select companion_private.ai_worker_job(%s,%s)',
                                       (action,Jsonb(args))).fetchone()[0]

    def authorize(self, task):
        return self.job('authorize', **task.args())


def publication_digest(content):
    prompt=content['prompt']
    return fingerprint(str(len(prompt.encode('utf-8')))+':'+prompt+content['draft'])


def run_ai_once(conn, composer, price_id):
    """Only injected offline fixtures can currently supply a reviewed assessor.

    No failed AI attempt falls back to mock text. Holds end this queue attempt;
    paid-call uncertainty survives in the ledger, not an automatic retry loop.
    """
    composer.deployment.check()  # before claim; disabled means no queue mutation
    composer.provider.check_ready()
    if getattr(composer.safety,'revision',None)!=POLICY:
        raise Denied('safety_unavailable')
    gate=WorkerGate(conn)
    if not isinstance(composer.gate,WorkerGate) or composer.gate.connection is not conn:
        raise Denied('worker_connection_mismatch')
    job=gate.job('claim',price_id=price_id)
    if not job:return False
    task=Task(job['id'],job['lease'],price_id,job['attempt_no'])
    try:
        result=composer.compose_for_worker(task)
        # Reassess the exact immutable fields immediately before publication.
        content=result.content
        composer._safe(json.dumps(content,ensure_ascii=False),'output',job['locale'])
        composer.deployment.check()
        if gate.authorize(task)!=result.context:
            raise Denied('authorization_changed')
        return gate.job('publish',**task.args(),attempt_id=result.attempt_id,
                        digest=publication_digest(content),**content,
                        review_revision=result.context['review_revision'],
                        safety_policy=result.context['safety_policy'],
                        safety_review_revision=result.context['safety_review_revision'])['published']
    except Exception:
        try:gate.job('hold',job_id=task.job_id,lease=task.lease)
        except Exception:pass  # lease recovery is fenced against recorded costs
        return False


def ai_deployment(env):
    return Deployment(env.get('AI_LIVE_ENABLED')=='1',
                      env.get('AI_TERMS_REVIEWED')=='1',
                      env.get('AI_SAFETY_EVALUATED')=='1',env.get('WORKER_REGION',''))


def build_ai_composer(conn, env, *, assessor=None, reviewed_locales=()):
    deployment=ai_deployment(env)
    deployment.check()
    if not callable(assessor) or not reviewed_locales:
        raise Denied('safety_unavailable')
    return Composer(WorkerGate(conn),deployment=deployment,
                    safety=PolicySafety(assessor,reviewed_locales=reviewed_locales),
                    provider=DeepSeekHTTP(network_enabled=env.get('AI_NETWORK_ENABLED')=='1'))


def main(*, assessor=None, reviewed_locales=()):
    parser=argparse.ArgumentParser();parser.add_argument('--once',action='store_true');args=parser.parse_args()
    mode=os.environ.get('AI_WORKER_MODE','mock')
    if mode not in ('mock','deepseek'):
        print('worker_configuration_required',flush=True);return 2
    deployment=ai_deployment(os.environ)
    if mode=='deepseek':
        try:deployment.check()
        except Denied:print('live_ai_disabled',flush=True);return 2
        # A production reviewed local assessor has not been installed. Environment
        # booleans cannot substitute for that component or its locale evaluations.
        if not callable(assessor) or not reviewed_locales:
            print('safety_unavailable',flush=True);return 2
        try:
            price_id=str(UUID(os.environ.get('AI_PRICE_ID','')))
        except ValueError:print('worker_configuration_required',flush=True);return 2
    try:dsn,options=connection_options(os.environ)
    except (ValueError,TypeError,psycopg.Error):print('worker_configuration_required',flush=True);return 2
    for sig in (signal.SIGINT,signal.SIGTERM):signal.signal(sig,lambda *_:STOP.set())
    delay=1
    while not STOP.is_set():
        try:
            with psycopg.connect(dsn,autocommit=True,connect_timeout=10,**options) as conn:
                conn.execute('set role companion_worker' if mode=='mock' else 'set role companion_meter')
                conn.execute("set statement_timeout='15s'")
                composer=build_ai_composer(conn,os.environ,assessor=assessor,
                                          reviewed_locales=reviewed_locales) if mode=='deepseek' else None
                while not STOP.is_set():
                    if mode=='mock':run_once(conn)
                    else:run_ai_once(conn,composer,price_id)
                    delay=1
                    if args.once:return 0
                    STOP.wait(5)
        except Exception:
            # Never emit DB exception text, DSNs, aliases, prompts or auth tokens.
            print('worker_attempt_unavailable',flush=True)
            if args.once:return 1
            STOP.wait(delay);delay=min(delay*2,60)
    return 0


if __name__=='__main__':raise SystemExit(main())
