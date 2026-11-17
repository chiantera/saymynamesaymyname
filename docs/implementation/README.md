# Implementation guides

PHASE-0-1.md is the acceptance checklist. CLOUD-AUTH-SETUP.md covers verified login
and remaining account work. MEMBERSHIP.md and SHARING.md explain their authorization
boundaries. CLOUD-SCHEDULING.md covers durable jobs, one-minute cron, restricted
worker deployment and operational recovery. CURRENT-TASK.md at root records evidence.
Keep planned, locally tested, hosted-schema tested and live-service verified distinct.

Current mock execution: the same hosted cron now calls a bounded Postgres consumer
inside the existing Frankfurt project. It uses private static catalogs and the
existing leased queue. Render/Python remain available for later; no paid service
or external AI is needed for this interim mode.

AI-CONSENT.md documents private source preferences, per-item exclusions, provider
review/version gates and separate fallback approval. Live processing stays disabled.

AI-BUDGET.md covers exact cost reservations, unknown holds, user controls and the
operator-only aggregate report. Live AI stays off until the remaining activation gates.
