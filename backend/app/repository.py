"""Durable, fictional-data adapter. Not the production Supabase repository."""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo

LOCALES = ("en", "it", "es", "ko", "zh-Hans", "yue-Hant", "de")
ROOT = Path(__file__).resolve().parents[2]


def utcnow():
    return datetime.now(timezone.utc)


def stamp(value):
    return value.isoformat()


class DomainError(Exception):
    def __init__(self, code, status=409):
        self.code, self.status = code, status


class Repository:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.transaction() as db:
            db.executescript("""
              CREATE TABLE IF NOT EXISTS profiles (
                owner TEXT PRIMARY KEY, locale TEXT NOT NULL, timezone TEXT NOT NULL);
              CREATE TABLE IF NOT EXISTS relationships (
                id TEXT PRIMARY KEY, owner TEXT NOT NULL, label TEXT NOT NULL);
              CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY, owner TEXT NOT NULL, locale TEXT NOT NULL,
                relationship_id TEXT, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
                lease TEXT, lease_until TEXT, created_at TEXT NOT NULL);
              CREATE TABLE IF NOT EXISTS checkins (
                id TEXT PRIMARY KEY, job_id TEXT NOT NULL UNIQUE, owner TEXT NOT NULL,
                relationship_id TEXT, locale TEXT NOT NULL, status TEXT NOT NULL,
                version INTEGER NOT NULL, prompt TEXT NOT NULL, draft TEXT NOT NULL,
                created_at TEXT NOT NULL, deadline TEXT, snoozed_until TEXT);
              CREATE TABLE IF NOT EXISTS entries (
                id TEXT PRIMARY KEY, checkin_id TEXT NOT NULL UNIQUE,
                owner TEXT NOT NULL, text TEXT NOT NULL, locale TEXT NOT NULL,
                created_at TEXT NOT NULL);
              CREATE TABLE IF NOT EXISTS schedules (
                owner TEXT NOT NULL, scope TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0,
                cadence INTEGER NOT NULL DEFAULT 6, last_at TEXT,
                PRIMARY KEY(owner,scope));
              CREATE TABLE IF NOT EXISTS schedule_settings (
                owner TEXT PRIMARY KEY, paused INTEGER NOT NULL DEFAULT 0,
                paused_until TEXT, quiet_start TEXT NOT NULL DEFAULT '22:00',
                quiet_end TEXT NOT NULL DEFAULT '08:00', cap INTEGER NOT NULL DEFAULT 3);
              CREATE TABLE IF NOT EXISTS nudge_receipts (
                job_id TEXT PRIMARY KEY, owner TEXT NOT NULL, presented_at TEXT NOT NULL);
            """)
            columns = {r['name'] for r in db.execute('PRAGMA table_info(jobs)')}
            if 'scheduled' not in columns:
                db.execute('ALTER TABLE jobs ADD COLUMN scheduled INTEGER NOT NULL DEFAULT 0')

    @contextmanager
    def transaction(self):
        db = sqlite3.connect(self.path, timeout=10, isolation_level=None)
        db.row_factory = sqlite3.Row
        try:
            db.execute("BEGIN IMMEDIATE")
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def preferences(self, owner):
        with self.transaction() as db:
            db.execute("INSERT OR IGNORE INTO profiles VALUES (?, 'en', 'Europe/Berlin')", (owner,))
            data = dict(db.execute("SELECT * FROM profiles WHERE owner=?", (owner,)).fetchone())
        return {**data, "cadence_hours": 6, "quiet_start": "22:00", "quiet_end": "08:00",
                "daily_nudge_cap": 3, "default_action": "skip", "window_minutes": 30,
                "saved_context_enabled": False, "analytics_enabled": False}

    def set_preferences(self, owner, locale, timezone_name):
        self.preferences(owner)
        with self.transaction() as db:
            db.execute("UPDATE profiles SET locale=?, timezone=? WHERE owner=?", (locale, timezone_name, owner))
        return self.preferences(owner)

    def relationships(self, owner):
        with self.transaction() as db:
            return [dict(r) for r in db.execute("SELECT id,label FROM relationships WHERE owner=? ORDER BY rowid", (owner,))]

    def add_relationship(self, owner, label):
        identity = str(uuid4())
        with self.transaction() as db:
            db.execute("INSERT INTO relationships VALUES (?,?,?)", (identity, owner, label))
        return {"id": identity, "label": label}

    def configure_schedule(self, owner, *, enabled=True, scope='', cadence=6,
                           paused=False, paused_until=None, quiet_start='22:00', quiet_end='08:00', cap=3):
        self.preferences(owner)
        if not 3 <= cadence <= 12 or not 1 <= cap <= 20:
            raise DomainError('invalid_schedule', 422)
        if any(len(v) != 5 or v[2] != ':' or not v.replace(':','').isdigit()
               or not 0 <= int(v[:2]) < 24 or not 0 <= int(v[3:]) < 60 for v in [quiet_start,quiet_end]):
            raise DomainError('invalid_schedule', 422)
        with self.transaction() as db:
            if scope and not db.execute('SELECT id FROM relationships WHERE id=? AND owner=?',(scope,owner)).fetchone():
                raise DomainError('not_found',404)
            db.execute('INSERT INTO schedules(owner,scope,enabled,cadence) VALUES (?,?,?,?) ON CONFLICT(owner,scope) DO UPDATE SET enabled=excluded.enabled,cadence=excluded.cadence',(owner,scope,int(enabled),cadence))
            db.execute('INSERT INTO schedule_settings VALUES (?,?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET paused=excluded.paused,paused_until=excluded.paused_until,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,cap=excluded.cap',(owner,int(paused),paused_until,quiet_start,quiet_end,cap))
            if paused or not enabled or (paused_until and datetime.fromisoformat(paused_until)>utcnow()):
                if paused or paused_until:
                    db.execute("UPDATE jobs SET status='cancelled',lease=NULL WHERE owner=? AND scheduled=1 AND status IN ('queued','processing')",(owner,))
                else:
                    db.execute("UPDATE jobs SET status='cancelled',lease=NULL WHERE owner=? AND coalesce(relationship_id,'')=? AND scheduled=1 AND status IN ('queued','processing')",(owner,scope))
                db.execute("UPDATE checkins SET status='cancelled',version=version+1,deadline=NULL,snoozed_until=NULL WHERE owner=? AND status IN ('pending','deferred') AND job_id IN (SELECT id FROM jobs WHERE scheduled=1 AND owner=? AND (? OR coalesce(relationship_id,'')=?))",(owner,owner,int(paused or bool(paused_until)),scope))

    def _eligible(self, db, owner, now, *, new_nudge=False):
        profile=db.execute('SELECT timezone FROM profiles WHERE owner=?',(owner,)).fetchone()
        settings=db.execute('SELECT * FROM schedule_settings WHERE owner=?',(owner,)).fetchone()
        if not profile or not settings or settings['paused']:
            return False
        if settings['paused_until'] and settings['paused_until'] > stamp(now):
            return False
        if new_nudge:
            latest=db.execute('SELECT max(presented_at) FROM nudge_receipts WHERE owner=?',(owner,)).fetchone()[0]
            gap=db.execute('SELECT min(cadence) FROM schedules WHERE owner=? AND enabled=1',(owner,)).fetchone()[0] or 6
            if latest and now-datetime.fromisoformat(latest)<timedelta(hours=gap): return False
        local=now.astimezone(ZoneInfo(profile['timezone']))
        clock=local.strftime('%H:%M'); start=settings['quiet_start']; end=settings['quiet_end']
        if start != end and ((start < end and start <= clock < end) or (start > end and (clock >= start or clock < end))):
            return False
        day_start=local.replace(hour=0,minute=0,second=0,microsecond=0)
        day_end=day_start+timedelta(days=1)
        count=db.execute('SELECT count(*) FROM nudge_receipts WHERE owner=? AND presented_at>=? AND presented_at<?',(owner,stamp(day_start.astimezone(timezone.utc)),stamp(day_end.astimezone(timezone.utc)))).fetchone()[0]
        return count < settings['cap']

    def dispatch_due(self, now=None):
        now=now or utcnow(); created=0
        with self.transaction() as db:
            scopes=db.execute("SELECT s.*,p.locale FROM schedules s JOIN profiles p ON p.owner=s.owner WHERE enabled=1 ORDER BY coalesce(last_at,''),scope").fetchall()
            seen=set()
            for scope in scopes:
                owner=scope['owner']
                if owner in seen or not self._eligible(db,owner,now,new_nudge=True): continue
                if scope['last_at'] and now-datetime.fromisoformat(scope['last_at']) < timedelta(hours=scope['cadence']): continue
                if db.execute("SELECT 1 FROM jobs WHERE owner=? AND status IN ('queued','processing')",(owner,)).fetchone(): continue
                if db.execute("SELECT 1 FROM checkins WHERE owner=? AND status IN ('pending','deferred')",(owner,)).fetchone(): continue
                db.execute("INSERT INTO jobs(id,owner,locale,relationship_id,status,created_at,scheduled) VALUES (?,?,?,?,'queued',?,1)",(str(uuid4()),owner,scope['locale'],scope['scope'] or None,stamp(now)))
                seen.add(owner);created+=1
        return created

    def enqueue(self, owner, relationship_id=None, now=None):
        now = now or utcnow()
        prefs = self.preferences(owner)
        with self.transaction() as db:
            if relationship_id and not db.execute("SELECT id FROM relationships WHERE id=? AND owner=?", (relationship_id, owner)).fetchone():
                raise DomainError("not_found", 404)
            # Manual demo requests still cannot multiply pending approvals/jobs.
            if db.execute("SELECT id FROM jobs WHERE owner=? AND status IN ('queued','processing')", (owner,)).fetchone():
                raise DomainError("already_pending")
            if db.execute("SELECT id FROM checkins WHERE owner=? AND status IN ('pending','deferred')", (owner,)).fetchone():
                raise DomainError("already_pending")
            identity = str(uuid4())
            db.execute("INSERT INTO jobs (id,owner,locale,relationship_id,status,created_at) VALUES (?,?,?,?,'queued',?)",
                       (identity, owner, prefs["locale"], relationship_id, stamp(now)))
        return {"id": identity, "status": "queued"}

    def claim(self, now=None):
        now = now or utcnow()
        with self.transaction() as db:
            db.execute("UPDATE jobs SET status='failed' WHERE status='processing' AND lease_until<=? AND attempts>=3", (stamp(now),))
            row = db.execute("SELECT * FROM jobs WHERE (status='queued' OR (status='processing' AND lease_until<=?)) AND attempts<3 ORDER BY created_at LIMIT 1", (stamp(now),)).fetchone()
            if not row:
                return None
            lease = str(uuid4())
            db.execute("UPDATE jobs SET status='processing', attempts=attempts+1, lease=?, lease_until=? WHERE id=?",
                       (lease, stamp(now + timedelta(seconds=30)), row["id"]))
            return {**dict(row), "lease": lease}

    def finish(self, job, prompt, draft, now=None):
        now = now or utcnow()
        with self.transaction() as db:
            row = db.execute("SELECT * FROM jobs WHERE id=? AND status='processing' AND lease=? AND lease_until>?",
                             (job["id"], job["lease"], stamp(now))).fetchone()
            if not row:
                return False
            if row['scheduled'] and (not self._eligible(db,row['owner'],now,new_nudge=True) or not db.execute('SELECT 1 FROM schedules WHERE owner=? AND scope=? AND enabled=1',(row['owner'],row['relationship_id'] or '')).fetchone()):
                db.execute("UPDATE jobs SET status='cancelled', lease=NULL WHERE id=?",(row['id'],))
                return False
            db.execute("INSERT OR IGNORE INTO checkins VALUES (?,?,?,?,?,'pending',0,?,?,?,?,NULL)",
                       (str(uuid4()), row["id"], row["owner"], row["relationship_id"], row["locale"],
                        prompt, draft, stamp(now), stamp(now + timedelta(minutes=30))))
            if row['scheduled']:
                db.execute('INSERT OR IGNORE INTO nudge_receipts VALUES (?,?,?)',(row['id'],row['owner'],stamp(now)))
                db.execute('UPDATE schedules SET last_at=? WHERE owner=? AND scope=?',(stamp(now),row['owner'],row['relationship_id'] or ''))
            db.execute("UPDATE jobs SET status='succeeded', lease=NULL, lease_until=NULL WHERE id=?", (row["id"],))
        return True

    def advance(self, now=None):
        """Local demo deadlines only; not the production timezone/due dispatcher."""
        now = now or utcnow()
        with self.transaction() as db:
            db.execute("UPDATE checkins SET status='skipped', version=version+1 WHERE status='pending' AND deadline<=?", (stamp(now),))
            deferred=db.execute("SELECT c.*,j.scheduled FROM checkins c JOIN jobs j ON j.id=c.job_id WHERE c.status='deferred' AND c.snoozed_until<=?",(stamp(now),)).fetchall()
            for row in deferred:
                if not row['scheduled'] or self._eligible(db,row['owner'],now):
                    db.execute("UPDATE checkins SET status='pending',version=version+1,deadline=?,snoozed_until=NULL WHERE id=?",(stamp(now+timedelta(minutes=30)),row['id']))

    def snapshot(self, owner):
        with self.transaction() as db:
            checkins = [dict(r) for r in db.execute("SELECT * FROM checkins WHERE owner=? ORDER BY created_at DESC", (owner,))]
            jobs = [dict(r) for r in db.execute("SELECT id,status FROM jobs WHERE owner=? AND status IN ('queued','processing','failed')", (owner,))]
        return {"checkins": checkins, "jobs": jobs}

    def decide(self, owner, identity, action, version, text="", now=None):
        now = now or utcnow()
        with self.transaction() as db:
            row = db.execute("SELECT * FROM checkins WHERE id=? AND owner=?", (identity, owner)).fetchone()
            if not row:
                raise DomainError("not_found", 404)
            if row["status"] != "pending" or row["version"] != version:
                raise DomainError("stale_decision")
            if row["deadline"] <= stamp(now):
                db.execute("UPDATE checkins SET status='skipped', version=version+1 WHERE id=?", (identity,))
                # Commit expiry independently of the rejected action.
                db.commit()
                raise DomainError("expired")
            status = {"approve": "fulfilled", "skip": "skipped", "snooze": "deferred"}.get(action)
            if not status:
                raise DomainError("invalid_action", 422)
            if action == "approve" and not text.strip():
                raise DomainError("empty_text", 422)
            db.execute("UPDATE checkins SET status=?, version=version+1, deadline=NULL, snoozed_until=? WHERE id=?",
                       (status, stamp(now + timedelta(hours=1)) if action == "snooze" else None, identity))
            if action == "approve":
                db.execute("INSERT INTO entries VALUES (?,?,?,?,?,?)", (str(uuid4()), identity, owner, text.strip(), row["locale"], stamp(now)))
        return {"status": status}

    def entries(self, owner):
        with self.transaction() as db:
            return [dict(r) for r in db.execute("SELECT * FROM entries WHERE owner=? ORDER BY created_at DESC", (owner,))]


def compose_mock(locale):
    # No network clients, API keys, private saved context or paid calls in this adapter.
    data = json.loads((ROOT / "shared" / "locales" / f"{locale}.json").read_text(encoding="utf-8"))
    return data["mockPrompt"], data["mockDraft"]


def work_once(repo, now=None):
    now = now or utcnow()
    repo.advance(now)
    job = repo.claim(now)
    if not job:
        return False
    prompt, draft = compose_mock(job["locale"])
    return repo.finish(job, prompt, draft, now)
