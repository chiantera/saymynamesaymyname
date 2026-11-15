"""Real PostgreSQL tests in a newly created, disposable local database only."""
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urlparse
import os, uuid
import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb
import pytest

ROOT = Path(__file__).resolve().parents[2]

@pytest.fixture(scope='session')
def database_url():
    dsn = os.environ.get('MEMBERSHIP_TEST_DSN')
    if not dsn:
        path = ROOT/'.local/membership-db.env'
        if path.exists(): dsn = path.read_text(encoding='utf-8-sig').strip().split('=',1)[1]
    if not dsn: pytest.fail('Set MEMBERSHIP_TEST_DSN to the isolated local PostgreSQL test service.')
    parsed = urlparse(dsn)
    if parsed.hostname not in ('127.0.0.1','localhost') or parsed.path != '/companion_test':
        pytest.fail('Database tests only accept a loopback companion_test fixture; hosted targets are refused.')
    name = 'membership_fixture_'+uuid.uuid4().hex
    fixture_dsn = psycopg.conninfo.make_conninfo(dsn,dbname=name)
    with psycopg.connect(dsn,autocommit=True) as admin:
        for role in ('anon','authenticated','service_role'):
            if not admin.execute('select 1 from pg_roles where rolname=%s',(role,)).fetchone():
                admin.execute(sql.SQL('create role {} nologin').format(sql.Identifier(role)))
        admin.execute(sql.SQL('create database {}').format(sql.Identifier(name)))
    try:
        with psycopg.connect(fixture_dsn,autocommit=True) as conn:
            conn.execute('''create schema auth; create schema extensions;
              create extension pgcrypto with schema extensions;
              create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz,
                deleted_at timestamptz,raw_app_meta_data jsonb default '{}');
              create function auth.uid() returns uuid language sql stable as
                $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
              grant usage on schema auth to authenticated;''')
            for migration in sorted((ROOT/'supabase/migrations').glob('*.sql')):
                conn.execute(migration.read_text(encoding='utf-8'))
        yield fixture_dsn
    finally:
        # Only this run's generated database is dropped; no application data exists here.
        assert name.startswith('membership_fixture_') and len(name)==51
        with psycopg.connect(dsn,autocommit=True) as admin:
            admin.execute(sql.SQL('drop database {} with (force)').format(sql.Identifier(name)))

class State:
    def __init__(self,dsn):
        self.dsn=dsn
        self.people={letter:str(uuid.uuid4()) for letter in 'ABCDE'}
        self.emails={letter:f'{self.people[letter]}@example.invalid' for letter in self.people}
        with psycopg.connect(dsn) as conn:
            for letter,identifier in self.people.items():
                conn.execute('insert into auth.users(id,email,email_confirmed_at) values(%s,%s,now())',(identifier,self.emails[letter]))
                if letter!='E': conn.execute('insert into public.beta_access values(%s)',(identifier,))

    @contextmanager
    def client(self,person):
        with psycopg.connect(self.dsn) as conn:
            conn.execute("set local statement_timeout='10s'")
            conn.execute('set local role authenticated')
            conn.execute("select set_config('request.jwt.claim.sub',%s,true)",(self.people[person],))
            yield conn

    def act(self,person,action,**args):
        with self.client(person) as conn:
            return conn.execute('select public.relationship_action(%s,%s)',(action,Jsonb(args))).fetchone()[0]

    def workspace(self,person):
        with self.client(person) as conn: return conn.execute('select public.relationship_workspace()').fetchone()[0]

    def relationship(self,person,rid):
        return next(r for r in self.workspace(person)['relationships'] if r['id']==rid)

    def propose(self,person,rid,target):
        current=self.relationship(person,rid)
        return self.act(person,'propose',relationship_id=rid,email=self.emails[target],membership_version=current['membership_version'])['id']

    def issue(self,person,iid,version=0):
        return self.act(person,'issue',invitation_id=iid,version=version)['token']

    def preview(self,person,token):
        with self.client(person) as conn: return conn.execute('select public.relationship_invite_preview(%s)',(token,)).fetchone()[0]

    def create(self,person='A'):
        return self.act(person,'create',label='Fictional space',alias=person)['id']

    def group(self):
        rid=self.create()
        iid=self.propose('A',rid,'B')
        self.act('B','accept',token=self.issue('A',iid),alias='B')
        iid=self.propose('A',rid,'C')
        self.act('B','approve',invitation_id=iid)
        self.act('C','accept',token=self.issue('A',iid),alias='C')
        return rid

@pytest.fixture
def state(database_url): return State(database_url)
