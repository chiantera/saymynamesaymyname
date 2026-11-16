# Frontend

React 19, TypeScript, Vite and a provisional Capacitor 8 configuration. `src/App.tsx`
contains the five-tab shell; AuthGate isolates authenticated accounts from fictional
preview. `cloud.ts` uses the publishable Supabase key with owner/generation checks
before and after requests. Secrets never belong in VITE variables.

Home offers private reflections and explicit named-recipient snapshot sharing.
Relationships offers unanimous invitations and personal membership controls.
Settings offers opt-in cloud schedules, fresh worker readiness and queue status.
The immediate preview action remains a mock; queue execution is a separate action
and is disabled when the worker heartbeat is stale. No live AI or outward messaging.

Commands from root: `npm run build`, `npm test`, `npm run test:auth`,
`npm run test:membership`. Browser suites rebuild dist and must run sequentially.
Catalog translations are drafts; Android/device/push verification remains pending.

Current mock execution: the same hosted cron now calls a bounded Postgres consumer
inside the existing Frankfurt project. It uses private static catalogs and the
existing leased queue. Render/Python remain available for later; no paid service
or external AI is needed for this interim mode.

AI consent foundation: Settings and guarded SQL persist private source preferences,
reflection exclusions and versioned provider/capability/fallback approval. Real
provider controls remain unavailable pending review. Details: docs/implementation/AI-CONSENT.md
at repository root. No mock-worker journal access or external AI activation.
