# Separate personal, product and operational analytics

Accepted product specification, not a claim of completed implementation.
[Plan index](../../PLAN.md) · [Current status](../../CURRENT-TASK.md).
Section numbers remain stable; §27 in DECISIONS.md resolves superseded proposals.
Source paths in backticks are relative to the repository root.

<a id="section-22"></a>

## 22. Analytics — three separate areas (DECIDED scope)

**A. Personal insights — private to the user**
- Help the user reflect on their own goals/habits, self-reported mood and check-in
  helpfulness. Charts and summaries use only their authorized records; no member
  receives another person's activity dashboard, prompt outcomes or private source data.
- Optional AI interpretation is a separate user action/consent, respects saved-context
  switches, per-item exclusions and approved providers, and links to eligible sources.
  It must not diagnose, rank people or treat inferred emotions as reported facts.
- Users may deliberately share a resulting summary through the existing item/recipient
  model. Sharing that artifact does not grant access to the dashboard or underlying
  private inputs. Keep source restrictions and unsharing behavior intact.

**B. Product analytics — separate developer/admin view**
- Understand onboarding, feature usefulness and notification burden without collecting
  private content. Candidate events: onboarding complete, check-in answered/skipped,
  reminder frequency reduced, notifications disabled and optional helpfulness feedback.
- No message/document/transcript bodies, screenshots, names, relationship identifiers,
  mood values or saved memories in the product event stream. Do not scrape private
  records to reconstruct events or automatically export private personal charts.
- Prefer helpfulness and reduced reminder burden to raw time-in-app/message volume.
  Self-reported benefit is a signal, not proof of relationship improvement. Define
  analytics consent, identity granularity, retention and permitted properties explicitly.

**C. Operations and costs — service administration**
- Track delivery failures, latency, processing errors and AI cost by task/provider.
  Reuse minimized diagnostic events (§19) and the usage ledger (§16), not private text.
  Separate technical logs, cost reconciliation and product event stores/permissions.
- Keep the EUR 20 budget path reliable even when optional product analytics is off.
  The agreed 14-day diagnostic-log retention remains unchanged; it does not imply
  the same lifetime for billing records or optional product events.

**Architecture and phasing**
- Personal records/read models and product events are separate schemas/tables and
  authorization paths. Admin access to aggregate product metrics never grants access
  to private personal dashboards. Do not label pseudonymous event streams anonymous.
- Instrument minimal technical/cost events with the first loop; add private progress
  views as goals/moods are built and expand insights later. Optional product tracking
  follows §23's approved consent/event design and remains off until each user opts in.

<a id="section-23"></a>

## 23. Analytics consent, hosting, retention and personal insights — DECIDED

1. **Product analytics consent:** opt-in, off by default, independently from personal
   insights and AI-context consent. Core app/personal charts work without it. Withdrawal
   stops new optional events and clears unsent batches; do not backfill past private
   activity after opt-in. Existing attributable-event deletion needs an accessible
   control and follows account deletion, rather than silently continuing retention.
2. **Analytics hosting:** start inside our European Supabase project with separate
   event tables and restricted aggregate admin queries. No third-party analytics SDK
   or new processor initially. Use narrowly scoped pseudonymous analytics IDs only
   where funnel measurement needs them; no relationship IDs, content IDs or email.
   Aggregation should avoid exposing an individual tester's behavior through filters.
3. **Product event retention:** keep consented pseudonymous events for **90 days**,
   then delete them; keep only non-identifying daily/cohort totals for **12 months**.
   Suppress low-count slices and granular dimensions that could identify a tester;
   small-beta cohort views can be withheld rather than pretending they are anonymous.
   These periods do not change the 14-day technical logs or private until-deleted history.
4. **Personal insights default:** start with factual goal/habit progress, self-reported
   mood trends and the user's own check-in/helpfulness history. No automated diagnostic
   or relationship-health score. AI interpretation is requested/approved separately,
   with visible sources and all existing context/processor restrictions; opting into
   product analytics never opts into private-text analysis or vice versa.
5. **Interaction recording:** no session replay, screen recording or keystroke capture
   for analytics, including during beta. Use content-free events and user-submitted
   support reports to diagnose usability issues. Disable inherited automatic form/
   input collection and crash-report attachments that could capture sensitive screens.
   A future recording feature would require a separate explicit decision.

All five above are approved planning decisions; no analytics implementation exists
yet. Product analytics is opt-in and never a prerequisite for basic app access.
Provider configuration, backup purge verification, reviewer assignments and deployment
sizing remain implementation/release verification work.
