# Scheduling and reliability

Accepted product specification, not a claim of completed implementation.
[Plan index](../../PLAN.md) · [Current status](../../CURRENT-TASK.md).
Section numbers remain stable; §27 in DECISIONS.md resolves superseded proposals.
Source paths in backticks are relative to the repository root.

<a id="section-8"></a>

## 8. Scheduling & reliability architecture (the engine)

This is the riskiest part — the whole app's value depends on check-ins firing at the
right time, once, on the right channel. Design goals: **timezone-correct**,
**single-writer internal state**, **reconciles uncertain external delivery**,
**survives retries**, **respects quiet hours**, handles the
**autopilot decision-window**.

**Core pattern — frequent tick + due-scan (start here)**
- A bounded `pg_cron` dispatcher ticks every **minute** initially (§27 delegated default).
- Each run computes, in SQL, the set of users who are **due now**:
  `now() >= last_checkin_at + cadence` AND `now()` is inside their waking window
  (converted to the user's timezone) AND no `pending` check-in already open.
- For each due user it **inserts a `checkins` row in one atomic step** (unique
  constraint on `(user_id, due_slot)` → idempotency: a retry can't double-insert).
- The dispatcher records durable work; the Frankfurt worker composes through the
  approved-provider adapter and presents a draft or executes an explicitly permitted
  action. The default action is still skip after 30 minutes, not automatic sending.

**Autopilot decision-window**
- Start `decision_deadline = available_at + window` when the check-in is posted to
  the user's eligible in-app inbox/presentation path, not when background composition
  starts. This is not a claim that the user read a push notification. Quiet-hour,
  pause and snooze deferral suspend/reschedule presentation as specified.
- The same tick scans for `pending` check-ins whose deadline has passed and applies
  the channel default (auto-send or skip) via the **single-writer transition** (§2 —
  whoever closes it first wins, so user-tap and the expiry job never both fire).

**Delivery reliability**
- **Recipient-reachability gate (safety)**: before any outbound send to another member,
  check membership status, the relevant user's `archived_at` and sender/recipient
  `user_blocks`. Muted/left or personally archived recipient → do not send in that
  relationship. A block prohibits contact for that user pair only (§12-C).
  A blocking B never prevents B→C or C→B delivery, sharing or plans.
  Personal archive also stops that user's relationship check-ins and automated sends
  on their behalf. Other active members' interactions with each other are unaffected.
  Recheck at dispatch and retry; cancel queued affected sends. Enforced in code; no
  AI/autopilot path bypasses it.
- **Leaving gate:** leaving stops relationship check-ins and app-mediated messages
  both to and on behalf of the departed member. Cancel queued affected work and
  prevent new sharing grants to inactive membership. Previously received history is
  read-only as of departure, subject to retention/deletion; never expose later edits
  through an old grant. Rejoining uses a new membership version and fresh consent.
- Each send is an idempotent op keyed by `checkin_id + channel`; a send is only marked
  `fulfilled` only with the appropriate acceptance evidence. Safe retryable failures
  use bounded backoff; unknown acceptance is `uncertain` and held for reconciliation.
  The private inbox reports failures; it never claims an unsent message reached a member.
- Provider webhooks (delivery receipts, inbound replies) update status and can
  auto-close the loop.

**Timezones & quiet hours**
- Store IANA timezones; evaluate quiet hours locally and persist deadlines in UTC.
  Coalesce stale/missed nudges at the next eligible window rather than replay every
  missed slot. Date-specific time-sensitive work is revalidated before resurfacing.

**Resilient background jobs (from SchedaPRO `analysisManager.ts`)**
- Long AI work (composition, digests, recaps) runs as **background jobs that survive
  navigation, phone lock, and refresh**: kick off → poll → resume → merge, with a
  **non-blocking progress indicator** and abort. Reuse this proven client-side pattern
  so the app never freezes waiting on the model; pairs with provider failover (§9a).

**Queue baseline — approved by delegation**
- Start with a durable Postgres jobs table, transactional claims, leases and bounded
  retries. The tick creates jobs; the worker executes them. No extra queue vendor is
  needed initially. A future move to a dedicated queue requires measured need and
  preserves the same idempotency, consent, revocation and budget interfaces.

**Backend**: dedicated Frankfurt Supabase for Postgres/Auth/Storage and durable
scheduling state; FastAPI reuse is decided, with Vercel for suitable request handlers.
**PLT hybrid is decided:** Vercel web/stateless FastAPI, Frankfurt processing worker
using the Render pattern, durable jobs in Supabase. Supabase owns scheduling state;
the worker owns execution. No in-memory job source of truth.

---
