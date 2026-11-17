# Supabase

Migrations define private ownership, verified beta admission, membership,
recipient grants, pairwise blocks, durable jobs, consent, accounting and support
notices. RLS and narrowly authorized RPCs enforce access independently of the UI.
Membership is not a content grant; privileged helpers are not general client APIs.

The existing Frankfurt cron executes a bounded static mock consumer. Restricted
Python worker roles have no journal/table authority. The AI consumer remains
explicitly gated/disabled; no key or reservation activates transport.

[Migrations](migrations/README.md) · [Hosted smoke scripts](tests/README.md) ·
[Local SQL fixture](../backend/dbtests/README.md) · [Cloud scheduling](../docs/implementation/CLOUD-SCHEDULING.md).

Use forward-only CLI-created migrations and verify permissions after changes.
Local test commands refuse hosted DSNs. Current runtime/review/price defaults must
remain disabled until their separate activation evidence exists.
