# Data model, encryption and storage

Accepted product specification, not a claim of completed implementation.
[Plan index](../../PLAN.md) · [Current status](../../CURRENT-TASK.md).
Section numbers remain stable; §27 in DECISIONS.md resolves superseded proposals.
Source paths in backticks are relative to the repository root.

<a id="section-5"></a>

## 5. Data model (first sketch — will evolve)

- **users** — auth identity, display name, timezone, **locale/language**. A user can
  exist with **zero** relationships (solo growth experience).
- **relationships** — a tracked connection the user defines: label, type (chosen by
  the user), created_by. Has **1..N member**s (not fixed at 2); a user has **0..N**.
  Archive is personal membership state, not global relationship status (§11/§14).
  (formerly "spaces")
- **relationship_members** — user ↔ relationship link, role/label, **status
  (active|muted|left)**, plus independent **archived_at** per user.
  Blocking is a separate user-to-user edge, never a membership-wide status.
  Archiving does not change membership or other members' archive preferences.
  N rows per relationship; supports non-dyadic
  (polyamorous) structures. Send tools/autopilot must check membership state and
  the specific sender/recipient block edge, no AI override (§12-C).
  Store `left_at` and membership version: departure ends future access but does not
  erase the user's own records or eligible previously received history (§14).
- **user_blocks** — blocker user ID, blocked user ID, created_at; enforce the block
  against the affected user pair, not against unrelated members. It never suspends
  the blocked user's account or removes their relationship membership (§14).
- **invites** — relationship, proposer, proposed recipient/verified email, expiry,
  status and membership version; single-use token digest, sent_at and redeemed_at. Any current member may propose; all current members must
  explicitly approve before an invitation is sent. Record approvals per member in
  **invite_approvals**. Issue the join token only after approval; the recipient must
  accept to join. Inviting others is optional; solo tracking does not create accounts
  or grant permissions on behalf of people outside the app.
- **checkin_prefs** — **per user per relationship**: cadence_hours, quiet_hours,
  enabled_channels. (Each relationship can have its own cadence; quiet hours may also
  be a user-global default.) Growth-only/solo users may have prefs with no relationship.
- **channels** — per user connected destinations: push tokens, phone, email,
  telegram_chat_id, whatsapp number, google_calendar auth. Also per-channel
  **default_action** (auto-send/skip) and **default_window** for the approval flow.
- **checkins** — scheduled/sent instances: **relationship_id (nullable — null = a
  solo/growth check-in)**, due_at, sent_at, channel, status, intent, generated_text,
  response, outcome (engaged/ignored), decision (pending/approved/edited/auto/skipped),
  decision_deadline. (idempotency, per-check-in approval flow, and the AI's feedback
  signal for reflect/adapt)
- **prompts** — small **fallback** library used only if the AI call fails.
  (Rich per-person context lives in `growth_profiles` / `ai_personalization` below.)
- **entries** — journal entries (text, mood, created_by, source: manual|checkin,
  **visibility: shared|private — default private, sharing is opt-in**). Check-in
  *activity* never lives here — only artifacts the user chose to surface.
- **important_dates** — title, date, recurrence, reminder offsets.
- **media** — storage refs, optional link to an entry.
- **context_sources** — source metadata and **extracted text in Supabase Postgres**
  in the dedicated European project: owner ID, optional relationship, type, original
  object ref (nullable after expiry/discard), extraction status, language, timestamps
  and original retention/byte metadata. Text persists until user deletion, independently
  of the original's expiry. Feeds the privacy-filtered context-builder. Split large
  extractions into owned, source-linked text chunks when needed; access grants apply
  to every chunk. Original binaries live separately in private Supabase Storage.
- **storage_entitlements / storage_usage** — server-controlled tier, original-storage
  allowance and measured usage per user; free/paid amounts and retention policies
  are configuration, never trusted client values. Billing integration comes later.
- **conversations** / **messages** — advisor ("bartender") chat threads and turns,
  stored privately under the owner's account in European Supabase Postgres; sync
  across their devices. Keep until user deletion on free and paid tiers (§14).
  Retention does not itself permit retrieval into future AI context.
- **goals** — relationship + personal-growth goals: scope (shared|private),
  owner, **relationship_id (nullable — null = solo/personal goal)**, type
  (relationship|growth), target, status, visibility. (§3c-A/B)
- **goal_progress** — milestones, habit ticks, streaks, progress events per goal.
- **growth_profiles** — per-person traits, love language, comm style, triggers,
  preferences; each field tagged shared|private. (§3c-C)
- **ai_personalization** — per-person voice/behavior settings for the bartender. (§3c-D)
- **saved_memories** — private, user-approved profile facts: owner, approved wording,
  source references, approval timestamp/version and update/delete state. A proposal
  is not an active memory; only approved versions may enter future AI context (§14).
  Editable/listable in the user's memory area; never a hidden extension of chat history.
- **crisis_resources** — per country/region: **emergency number**, crisis/suicide &
  DV hotlines, and links — source for the localized safety guardrail + persona-drop
  message (§10.6, §12). Professionally verified.
- **change_log** — audit of AI-initiated (bartender tool) changes: actor, tool, before/
  after, timestamp; powers "here's what I changed" + undo (§11).

---

<a id="section-21"></a>

## 21. Encryption, 2FA, Drive import and gallery storage — DECIDED

1. **Encryption model for the first version:** encrypted transport and managed
   encryption at rest, plus strict server-side access controls; authorized backend
   processing can read content to sync/search and perform approved AI tasks. Approved
   processors receive the minimum readable context needed. Do not claim end-to-end
   encryption: keys exclusively controlled by users would require a different AI,
   search and recovery architecture. Verify actual service/key/backup settings before
   launch. Local PIN lock and redaction do not themselves provide end-to-end encryption.
2. **Two-factor authentication:** offer optional authenticator-app 2FA for users,
   and require strong 2FA for administrative/support accounts. Plan recovery codes/
   recovery flow and device/session revocation; validate exact platform capabilities
   before implementation. App PIN/biometric lock remains a separate device feature.
3. **Google Drive import:** start with a one-time import of files explicitly selected
   by the user, using a picker and the narrowest workable permissions. No whole-Drive
   scan or continuing sync. Use the normal private ingestion, untrusted-data, OCR and
   source-retention paths; never delete or modify the original Drive file. Later edits
   in Drive do not update an imported snapshot until the user imports it again.
   Google sign-in alone does not authorize Drive access.
4. **Gallery-memory storage:** count deliberately saved photos/videos/audio memories
   in the same tier's original-file byte allowance (free 50 MB, paid 5 GB), but never
   apply the context-source 30-day expiry or oldest-first removal to these memories.
   When adding a memory, expired/eligible context originals may be reclaimed under
   the free policy; if remaining space is insufficient, pause new original storage
   and offer user-directed cleanup/upgrade. Existing memories stay intact.
   For downgrade, preserve memory originals and pause new storage if they alone exceed
   the free allowance; do not silently delete memories to fit. This is an explicit
   exception to context-original cleanup, not indefinite paid-feature entitlement.
   Account deletion and user deletion still remove owned memory originals. Clarify
   the exception in storage UI and measure its cost before broad commercial release.
**Approval status:** decisions 1–4 above are approved. Analytics was developed
separately: its scope (§22) and settings (§23) are now approved. Product analytics
still requires the end user's opt-in; project approval is not user consent to tracking.
