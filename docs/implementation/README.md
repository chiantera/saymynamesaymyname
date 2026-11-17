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

- [Frontend overhaul](FRONTEND-OVERHAUL.md): recovered design/copy, responsive and
  accessibility coverage, cloud regression boundaries and remaining release gates.

- [Dormant DeepSeek adapter](DEEPSEEK-ADAPTER.md): execution-time authorization,
  safety hooks, committed budget accounting and explicit activation boundaries.

- [Safety policy and worker](SAFETY-WORKER.md): fixed input, risk indicators,
  bound local assessments, disabled AI consumer and private publication fences.

- [Crisis support](CRISIS-SUPPORT.md): ephemeral country selection, expiring source-verified emergency contacts, review-gated topic paths and owner-only safety notices. Live AI remains disabled.
