# Documentation

[PLAN](../PLAN.md) records product decisions. [SOUL](../SOUL.md) records product
principles. [AGENTS](../AGENTS.md) and [CLAUDE](../CLAUDE.md) guide coding agents.
[CURRENT-TASK](../CURRENT-TASK.md) records tested milestones and outstanding gates.

Implementation guides:

- [Phase 0/1](implementation/PHASE-0-1.md): scope, milestones and completion checklist.
- [Cloud auth](implementation/CLOUD-AUTH-SETUP.md): OAuth and recovery evidence.
- [Membership](implementation/MEMBERSHIP.md): unanimous invitations and pairwise blocks.
- [Sharing](implementation/SHARING.md): named read-only grants and revocation.
- [Cloud scheduling](implementation/CLOUD-SCHEDULING.md): durable jobs, worker and operations.

Historical verification remains historical; do not rewrite old evidence as though
later capabilities were already deployed. Plans are not proof of live activation.

Current mock execution: the same hosted cron now calls a bounded Postgres consumer
inside the existing Frankfurt project. It uses private static catalogs and the
existing leased queue. Render/Python remain available for later; no paid service
or external AI is needed for this interim mode.
