# Hosted smoke scripts

These are operator checks, separate from loopback-only npm database fixtures.
Membership/sharing/worker transactional smokes create synthetic actors and roll
back; read each guard before execution. A hosted admin smoke does not prove a
running restricted worker, native auth or external delivery.

`deepseek_adapter.sql`, `safety_worker.sql`, `crisis_support.sql` and `edit_recovery.sql` check dormant
runtime/ACL boundaries without creating real provider calls or activating reviews.
Other scripts document their own state/active-job guards. Never retarget local
fixture commands at a hosted database or relax guards to obtain a passing result.

[Testing boundaries](../../docs/TESTING.md) · [Worker runbook](../../docs/implementation/CLOUD-SCHEDULING.md).
