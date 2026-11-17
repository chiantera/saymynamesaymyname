# Product plan

The accepted specification is split by topic under [docs/plan](docs/plan/README.md).
The check-in loop is the priority; solo growth is complete on its own. Relationships
are optional (0..N), each with 1..N members. Never infer gender, orientation or a
dyadic structure. Safety/privacy rules survive every code reuse.

Routine engineering defaults are delegated. Branding and public pricing are deferred.
The accepted closeout in §27 resolves older proposals; §28 authorizes Phase 0/1
implementation. Actual provider terms, safety evaluations, credentials and costs
are evidence gates, not another preference questionnaire.

[Current implementation status](CURRENT-TASK.md) · [Phase 0/1 checklist](docs/implementation/PHASE-0-1.md)
· [Historical milestones](docs/CHANGELOG.md) · [Decision records](docs/decisions/README.md).

## Specification index

| Section | Specification |
| --- | --- |
| §1 | [The idea in one sentence](docs/plan/PRODUCT.md#section-1) |
| §1a | [Core assumptions — inclusive by design (FOUNDATIONAL)](docs/plan/PRODUCT.md#section-1a) |
| §2 | [The check-in loop (the core — design in depth)](docs/plan/PRODUCT.md#section-2) |
| §2b | [The AI layer (the brain of the loop)](docs/plan/PRODUCT.md#section-2b) |
| §2c | [Context, chat & the advisor ("the bartender")](docs/plan/PRODUCT.md#section-2c) |
| §3c | [Goals & Growth (the second pillar)](docs/plan/PRODUCT.md#section-3c) |
| §3 | [Supporting features (serve the loop)](docs/plan/PRODUCT.md#section-3) |
| §4 | [Crons / scheduled jobs](docs/plan/PRODUCT.md#section-4) |
| §5 | [Data model (first sketch — will evolve)](docs/plan/DATA-STORAGE.md#section-5) |
| §6 | [Phased roadmap (plan-all, build-in-phases)](docs/plan/ROADMAP.md#section-6) |
| §7 | [Cross-cutting status (see §27 for remaining owner choices)](docs/plan/ROADMAP.md#section-7) |
| §8 | [Scheduling & reliability architecture (the engine)](docs/plan/SCHEDULING.md#section-8) |
| §9 | [AI usage & cost architecture (the brain)](docs/plan/AI.md#section-9) |
| §10 | [Localization & internationalization (i18n / l10n)](docs/plan/LOCALIZATION.md#section-10) |
| §11 | [Bartender tools — conversational configuration (DECIDED: yes, with guardrails)](docs/plan/EXPERIENCE.md#section-11) |
| §12 | [Guardrails & Trust/Safety (consolidated — the safety backbone)](docs/plan/SAFETY.md#section-12) |
| §13 | [Reuse from the SchedaPRO sibling](docs/plan/ARCHITECTURE.md#section-13) |
| §14 | [Decisions before building vs. before release](docs/plan/DECISIONS.md#section-14) |
| §15 | [Worldwide access implementation plan](docs/plan/LOCALIZATION.md#section-15) |
| §16 | [Usage accounting and the EUR 20 AI test budget](docs/plan/AI.md#section-16) |
| §17 | [Offline use, nudge limits, device lock and account deletion — DECIDED](docs/plan/EXPERIENCE.md#section-17) |
| §18 | [Conflicts, unsharing, safety gates and exports — DECIDED](docs/plan/SAFETY.md#section-18) |
| §19 | [Paid allowance, beta billing, diagnostics and support access — DECIDED](docs/plan/SAFETY.md#section-19) |
| §20 | [Navigation, cross-relationship advice, translations and support retention — DECIDED](docs/plan/EXPERIENCE.md#section-20) |
| §21 | [Encryption, 2FA, Drive import and gallery storage — DECIDED](docs/plan/DATA-STORAGE.md#section-21) |
| §22 | [Analytics — three separate areas (DECIDED scope)](docs/plan/ANALYTICS.md#section-22) |
| §23 | [Analytics consent, hosting, retention and personal insights — DECIDED](docs/plan/ANALYTICS.md#section-23) |
| §24 | [Onboarding, pause/snooze, channels, audiences and streaks — DECIDED](docs/plan/EXPERIENCE.md#section-24) |
| §25 | [Context formats, limits, extraction, plans and test data — DECIDED](docs/plan/EXPERIENCE.md#section-25) |
| §26 | [Sessions, delivery, dates, calendar, goals, accessibility and appearance — DECIDED](docs/plan/EXPERIENCE.md#section-26) |
| §27 | [Decision closeout — delegated defaults and the finite owner review list](docs/plan/DECISIONS.md#section-27) |
| §28 | [Phase 0/1 execution authorization](docs/plan/ROADMAP.md#section-28) |

## Reading and changes

Read the relevant topic before changing behavior. Keep the original section numbers
in references and update the topic itself rather than appending status to this file.
Current behavior belongs in CURRENT-TASK.md and implementation guides; dated evidence
belongs in the changelog or a private operational log. Plans are not release proof.
