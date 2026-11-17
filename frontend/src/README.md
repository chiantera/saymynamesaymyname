# Client source

App.tsx owns navigation; AuthGate owns sign-in/session boundaries; cloud.ts guards
account-scoped Supabase requests. Relationships, Sharing and Scheduling each expose
bounded cloud capabilities. The fictional browser adapter remains isolated from
private cloud accounts. Include every visible string in all locale catalogs and
avoid untrusted HTML. Read ../README.md and the implementation guides before editing.

AI consent foundation: Settings and guarded SQL persist private source preferences,
reflection exclusions and versioned provider/capability/fallback approval. Real
provider controls remain unavailable pending review. Details: docs/implementation/AI-CONSENT.md
at repository root. No mock-worker journal access or external AI activation.

Budget integration adds owner-only usage/ceiling/pause controls and a separate
restricted accounting role. Exact reservations and unresolved holds are tested with
fictional prices; live AI is disabled. See docs/implementation/AI-BUDGET.md at root.
