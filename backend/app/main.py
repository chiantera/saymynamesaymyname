"""FastAPI local-demo request layer. Live auth/processors deliberately unconfigured."""
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import Depends, FastAPI, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .repository import DomainError, Repository, ROOT

Locale = Literal["en", "it", "es", "ko", "zh-Hans", "yue-Hant", "de"]
ALLOWED_ORIGINS = {"http://127.0.0.1:5174", "http://localhost:5174", "http://127.0.0.1:4173", "http://localhost:4173", "http://127.0.0.1:5175"}


class Preferences(BaseModel):
    model_config = ConfigDict(extra="forbid")
    locale: Locale
    timezone: str = Field(min_length=1, max_length=80)

    @field_validator("timezone")
    @classmethod
    def timezone_exists(cls, value):
        try:
            ZoneInfo(value)
        except (ValueError, ZoneInfoNotFoundError):
            raise ValueError("invalid_timezone")
        return value


class Relationship(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    label: str = Field(min_length=1, max_length=80)


class Generate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    relationship_id: str | None = None


class Schedule(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool = False
    scope: str = ''
    cadence: int = Field(default=6, ge=3, le=12)
    paused: bool = False
    paused_until: datetime | None = None
    quiet_start: str = '22:00'
    quiet_end: str = '08:00'
    cap: int = Field(default=3, ge=1, le=20)

    @field_validator('paused_until')
    @classmethod
    def aware(cls,value):
        if value and value.tzinfo is None: raise ValueError('timezone_required')
        return value.astimezone(timezone.utc) if value else None


class Decision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["approve", "skip", "snooze"]
    version: int = Field(ge=0)
    text: str = Field(default="", max_length=5000)


def create_app(path: Path | None = None, *, demo=False, environment="development"):
    enabled = demo and environment in {"development", "test"}
    app = FastAPI(title="Companion local preview", docs_url="/api/docs" if enabled else None)
    if enabled:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "testserver"])
    app.state.demo = enabled
    app.state.token = secrets.token_urlsafe(32)
    app.state.repo = Repository(path or ROOT / ".local" / "demo.sqlite") if enabled else None

    @app.exception_handler(DomainError)
    async def domain_error(_request, error):
        return JSONResponse(status_code=error.status, content={"detail": error.code})

    def local_only(request: Request):
        if not enabled:
            raise DomainError("live_not_configured", 503)
        if not request.client or request.client.host not in {"127.0.0.1", "::1", "testclient"}:
            raise DomainError("local_only", 403)
        if request.headers.get("origin") and request.headers["origin"] not in ALLOWED_ORIGINS:
            raise DomainError("origin_denied", 403)

    def actor(request: Request, authorization: str = Header(default="")):
        local_only(request)
        if not secrets.compare_digest(authorization, f"Bearer {app.state.token}"):
            raise DomainError("unauthorized", 401)
        return "fictional-local-user"

    @app.get("/api/health")
    def health():
        return {"mode": "local_demo" if enabled else "unconfigured", "live_auth": False,
                "live_ai": False, "cloud_sync": False, "native_push": False}

    @app.get("/api/demo/session", dependencies=[Depends(local_only)])
    def demo_session():
        return {"token": app.state.token, "mode": "local_demo"}

    @app.get("/api/preferences")
    def preferences(owner=Depends(actor)):
        return app.state.repo.preferences(owner)

    @app.patch("/api/preferences")
    def update_preferences(data: Preferences, owner=Depends(actor)):
        return app.state.repo.set_preferences(owner, data.locale, data.timezone)

    @app.patch('/api/schedule')
    def schedule(data: Schedule,owner=Depends(actor)):
        values=data.model_dump()
        if values['paused_until']: values['paused_until']=values['paused_until'].isoformat()
        app.state.repo.configure_schedule(owner,**values)
        return values

    @app.get("/api/relationships")
    def relationships(owner=Depends(actor)):
        return app.state.repo.relationships(owner)

    @app.post("/api/relationships", status_code=201)
    def add_relationship(data: Relationship, owner=Depends(actor)):
        return app.state.repo.add_relationship(owner, data.label)

    @app.get("/api/checkins")
    def checkins(owner=Depends(actor)):
        return app.state.repo.snapshot(owner)

    @app.post("/api/checkins", status_code=202)
    def generate(data: Generate, owner=Depends(actor)):
        return app.state.repo.enqueue(owner, data.relationship_id)

    @app.post("/api/checkins/{identity}/decision")
    def decide(identity: str, data: Decision, owner=Depends(actor)):
        return app.state.repo.decide(owner, identity, data.action, data.version, data.text)

    @app.get("/api/entries")
    def entries(owner=Depends(actor)):
        return app.state.repo.entries(owner)

    return app


app = create_app(
    Path(os.environ["DEMO_DATABASE_PATH"]) if os.environ.get("DEMO_DATABASE_PATH") else None,
    demo=os.environ.get("ALLOW_LOCAL_DEMO") == "1",
    environment=os.environ.get("APP_ENV", "unconfigured"),
)
