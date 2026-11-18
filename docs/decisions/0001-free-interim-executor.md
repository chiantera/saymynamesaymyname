# 0001 — Free interim executor

Accepted 2026-11-15; reaffirmed by the user 2026-11-16.

Use the existing Frankfurt Supabase Free project and its one-minute cron for the
current bounded static-mock queue consumer. Reuse the durable leases, idempotency,
privacy and scheduling checks. No new paid worker host or credentials are needed.

Keep the Python worker and render.yaml unchanged for later. Do not put external AI,
OCR or slow network processing inside Postgres. Before enabling those capabilities,
verify processor consent/terms, budget and a suitable execution runtime. User schedules
remain opt-in; the free plan has resource limits and no promise of continuous uptime.

The installed executor and hosted synthetic/browser tests are documented in
[the runbook](../implementation/CLOUD-SCHEDULING.md). This note does not approve a
future paid service, AI provider or external message.

[Free cloud research](../implementation/FREE-CLOUD-RESEARCH.md) compares possible
future worker hosts and storage; it does not supersede this interim decision.
