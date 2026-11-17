# Bartender tools and user experience

Accepted product specification, not a claim of completed implementation.
[Plan index](../../PLAN.md) · [Current status](../../CURRENT-TASK.md).
Section numbers remain stable; §27 in DECISIONS.md resolves superseded proposals.
Source paths in backticks are relative to the repository root.

<a id="section-11"></a>

## 11. Bartender tools — conversational configuration (DECIDED: yes, with guardrails)

The bartender gets **tools (Claude tool use / function calling)** so the user can
configure the app **by talking**: *"check in with me less often"*, *"be more direct
with me"*, *"send reminders to Telegram instead"*, *"add an anniversary on June 3"*,
*"what are my goals?"*. This makes a deep, settings-heavy app discoverable through
conversation, and lets the bartender **tune itself** (the personalization loop).

**Tool catalog (all scoped to the current user; same validated app logic as the UI)**
- *Read*: get check-in prefs, channels, goals, profile, upcoming dates, personalization.
- *Write*: set cadence / quiet hours; enable/disable a channel & its default action+window
  (§2b); update AI personalization (tone/directness/humor); create/update goals &
  progress (§3c); add/edit important dates; update profile fields; set locale (§10).
- *Relationship*: create a relationship, invite a member, adjust a relationship's
  settings, **archive a relationship** — **higher-sensitivity**, see confirmation rules.
  The invite tool creates a proposal, not an immediate invitation. It cannot approve
  for other members or send before unanimous approval (§14).
  - **Personal archive — DECIDED:** reversible and scoped to the requesting user.
    Hides the relationship from their active list, pauses their related check-ins and
    automated sends, and suppresses app-mediated sends to them in that relationship.
    Preserves history subject to existing access grants and retention rules. Other
    members retain their own settings. It does not leave the relationship or change
    membership. Unarchiving restores the active view without replaying missed nudges
    or cancelled messages; subsequent scheduling respects current preferences.

**Control & confirmation model (consistent with the per-check-in consent stance)**
- **Reads**: free, no confirmation.
- **Routine writes** (cadence, tone, channel toggle, add a date): apply, then **show
  a clear "here's what I changed" with one-tap undo**. Optional "always apply changes
  like this without asking" so power users can go faster.
- **Sensitive but reversible** (archive a relationship, delete a goal): **confirm
  before acting**, but recovery is easy (unarchive / restore from `change_log`).
- **Sensitive / irreversible** (delete owned relationship records/content, invite
  someone, disconnect a channel, change locale): **always confirm before acting**.
  Deleting one's private record/owned artifacts cannot delete another member's own
  content or membership. Inviting still requires unanimous approval, not one confirmation.
- Every AI-initiated change is **logged/auditable** so the user can see and revert what
  the bartender did. Nothing the bartender can do is unrecoverable without a confirm.

**Hard boundaries (NOT given to the bartender)**
- Account deletion, auth/password changes, billing/payments, anything legal/financial.
- It can never **read another member's private data** to satisfy a request (privacy
  model §2/§3c) or act on another user's account — tools are single-user-scoped and
  RLS-enforced server-side.

**Implementation notes**
- Tools execute through the **FastAPI/worker server-side action layer** against
  Supabase with authenticated user authorization and RLS where applicable. Privileged
  worker operations must revalidate ownership, grants and consent, not assume RLS
  applies to a service credential. The model proposes a call; the backend validates
  inputs and executes;
  the model never touches the DB directly. Validate/whitelist every argument.
- Tool definitions + the confirmation policy live alongside the centralized system
  prompt (§9), so safety/inclusivity invariants always wrap tool use too.

**Phasing**: introduce after the advisor exists (Phase 2) — start with a few
**read** tools + low-risk **writes** (cadence, personalization), then expand. Tools
also keep working in the user's language (§10).

---

<a id="section-17"></a>

## 17. Offline use, nudge limits, device lock and account deletion — DECIDED

1. **Offline use:** allow reading cached content and drafting/editing personal notes
   offline. Sync through an explicit conflict-aware outbox on reconnection. Require
   a live authorization check for sharing, invitations and message sending; do not
   silently send offline drafts when connectivity returns. Never cache another
   member's private data. Cache limits/local protection follow the privacy model.
2. **Nudge fatigue limit:** start with **3 proactive nudges per user per local day**
   across all relationships and solo growth, editable. A multi-channel delivery of
   one nudge counts once. Coalesce/defer low-priority reminders instead of multiplying
   them per relationship. Apply this to proactive prompts, not user-requested replies,
   ordinary incoming member messages, security notices or user-opened help resources.
3. **Device lock:** offer an **optional app PIN/biometric lock** during onboarding,
   with a **5-minute idle timeout when enabled**. Use supported platform
   security and validate the sibling module on web/Android. Login and local app lock
   are separate. Lock previews remain discreet regardless of whether app lock is on.
4. **Account deletion:** offer delete-account in Settings, with clear final confirmation
   and export beforehand. Stop jobs/delivery and revoke sessions on deletion, then
   remove owned live records, originals and derived context; document actual backup
   purge lag. Other members' accounts and unrelated B/C activity remain intact.
   Previously shared/received records follow explicit source-aware revocation (§18);
   never promise recall of another person's downloaded copy. The bartender may open
   the settings/help flow, but cannot delete an account through its tools.

All four above were approved. Apply these defaults to the first relevant phase;
implementation must preserve the previously agreed privacy and consent controls.

<a id="section-20"></a>

## 20. Navigation, cross-relationship advice, translations and support retention — DECIDED

1. **Navigation:** start with **Home, Relationships, Growth, Bartender and Settings**.
   Home shows the check-in inbox and upcoming items. Relationship pages hold their
   shared timeline, memories and dates; solo/private content stays accessible without
   adding a relationship. This is a first screen map, not a final visual design.
2. **Cross-relationship advice:** default each relationship conversation to its own
   eligible context. An explicitly requested personal overview can draw from more
   than one relationship only after the user selects which to include, subject to
   all existing item/category/provider permissions. Never reuse one relationship's
   private material in another relationship's shared output. This adds a selection
   flow for private overviews, not a relaxation of the existing context boundary.
3. **Translation workflow:** keep the seven launch-language catalogs versioned in Git,
   use AI-assisted drafts plus native-speaker review, and defer buying a translation
   management service until needed. Safety copy retains the already required
   professional verification before release. This revises the earlier assumption
   that an external TMS is required for launch; it does not reduce review standards.
4. **RTL timing:** ship the seven current left-to-right locales first, using direction-
   aware layouts and logical spacing from the beginning. Add fully tested RTL
   interface locales when an RTL language is added. Preserve correct mixed-script
   rendering for user text now, without claiming full Arabic/Hebrew UI support.
5. **Support-report content retention:** delete user-selected messages/files copied
   into support cases **30 days after closure** by default; deleting the user's source
   or revoking support access earlier must stop future reviewer access. Keep only
   minimal non-content incident metadata under a separately stated retention rule.
   Reopening before purge updates closure timing; reopening after purge cannot restore
   deleted attachments. Do not alter the user's original journal/chat retention.
   Document any exceptional preservation policy explicitly rather than silently
   keeping support content indefinitely.

All five above were approved. **German is also a launch locale**, bringing the total
to seven: Italian, Spanish, Korean, Mandarin, Cantonese, English and German. Apply the
same UI, fallback, safety-copy, OCR/STT and model-quality review requirements to German.
These changes do not authorize scaffolding; planning continues.

<a id="section-24"></a>

## 24. Onboarding, pause/snooze, channels, audiences and streaks — DECIDED

Core architecture, storage and analytics choices are settled. These are bounded
interaction defaults, not a requirement to invent six more features before building.

1. **Progressive onboarding:** collect sign-in, display name, language and timezone
   first; offer a correctable country for local help. Relationship creation is optional.
   Ask for push/microphone/Drive and provider permissions when the user first invokes
   the relevant feature, not as a mandatory wall of setup questions. Optional context,
   analytics and personal-profile answers stay skippable.
2. **Pause reminders:** let users pause their proactive prompts for **today, one week
   or until resumed**, globally or for a selected relationship. This is distinct from
   archive/leave/block and does not silence ordinary member messages. Stop affected
   pending scheduled work, including sends on their behalf; resume without replaying
   missed prompts. Never pause another member's preferences or interfere with static help.
3. **Snooze an individual check-in:** offer **1 hour, 3 hours or tomorrow**, with a
   custom time option. Snooze suspends the current approval timer and automatic send;
   on resurfacing create a fresh decision window using current consent/preferences,
   not an expired deadline. Respect quiet hours, pause state and the user-level cap.
   Do not blindly send an old time-sensitive draft without revalidation.
4. **Multi-channel reminders:** choose one primary channel per reminder type, with
   only explicitly enabled delivery fallbacks. Do not broadcast the same nudge to
   every connected channel by default. The in-app inbox remains the canonical view;
   cross-channel duplicates must not consume multiple approvals or cause double sends.
   Transport fallback still requires recipient/channel authorization and quiet-hour rules;
   it is separate from AI-provider fallback.
5. **Group sharing audience:** preview the exact eligible recipients before sharing,
   including shared plans. Respect pairwise blocks and item exclusions per recipient;
   never silently expand to all members or disclose another user's block settings.
   If the chosen audience cannot be delivered as requested, ask the sender to revise
   it instead of silently pretending everyone received the same item. B/C-only plans
   remain available when A blocks B. Store recipients with the resulting artifact.
6. **Streak experience:** private, optional and encouraging. Show personal consistency
   and completed actions, with pause/rest days; avoid guilt, partner comparisons or
   punishment for missed days. A skipped prompt is not evidence of neglect or poor
   relationship health. The user can hide streak displays without disabling goals
   or useful reminders. Product analytics never exposes individual streaks to members.

All six above were approved. These are defaults for their relevant phases; they do
not pull later channels, shared plans or richer growth features into Phase 1.
The first implementation plan remains bounded by Phase 0/1; construction still
requires user approval of that implementation plan.

<a id="section-25"></a>

## 25. Context formats, limits, extraction, plans and test data — DECIDED

1. **Initial context file types:** PDF, DOCX and plain text for documents; JPEG, PNG
   and WebP for screenshots/images. Voice uses the separate recording/transcription
   path. Reject unsupported formats clearly before processing rather than claiming
   successful extraction. Image-only PDFs go through OCR. Uploaded gallery media can
   have a separate supported-type list; video transcription and HEIC conversion are
   later capabilities, not implicitly included in this first extraction list.
2. **Ingestion limits:** begin with **20 MB per file and 10 files per batch**, enforced
   server-side and configurable. Processing limits are distinct from free 50 MB/paid
   5 GB retained storage and the AI budget. Use direct authorized storage uploads;
   validate actual file type, extraction page/text bounds and available budget before
   processing. Stage work within bounded temporary storage, not unlimited batch
   concurrency. Larger-file support can follow measured demand and provider tests.
3. **Voice-note duration:** **5 minutes per recording** initially, with a visible
   countdown, stop/cancel controls and an explicit microphone permission. Stop at the
   limit; no background/ambient recording. Preview/edit the transcript before send or
   save. Default audio discard and tier-based keep-original rules remain unchanged.
4. **Extraction review:** show the extracted text and source reference before it is
   accepted into saved AI context, with correction and retry controls. Save user
   corrections as a separate text revision linked to the source, not a fabricated
   alteration of the original document. OCR output remains untrusted data. Retaining
   a source or reviewing text never overrides saved-context/provider permissions.
5. **Shared-plan responses:** each invited participant controls their own **accept /
   decline / tentative** response. Silence stays pending. Neither the organizer nor
   the bartender can accept for someone else. Changes to time/participants require
   notifying eligible affected participants and reconfirming material changes; preserve
   the pairwise block/audience rules. This is a later shared-plan feature, not a
   requirement to introduce messaging/calendar scope in the first loop prototype.
6. **Notification denial:** keep the app fully usable through its in-app inbox if
   push permission is declined. Show a settings link when relevant, not repeated OS
   permission prompts. Never silently substitute SMS/email/another channel; fallback
   must already be explicitly enabled. Do not characterize missing push permission
   as failure to care for a relationship or penalize goals/streaks.
7. **Test and preview data:** use fictional seed data and mocked providers by default
   in local development/preview deployments, with explicit opt-in for bounded live
   provider smoke tests. Isolate preview credentials/state from real beta accounts;
   previews must not dispatch real messages or spend from a production key by default.
   Before beta, validate web + a real Android device and meaningful tests for private
   access, block/unshare gates, duplicate delivery, worker recovery and budget limits.
   Test the seven locales; this is a verification plan, not a claim tests exist yet.

All seven above were approved. Upload/voice/shared-plan details belong to their
planned feature phases, not Phase 0/1 by default. The first build plan should name
its acceptance tests and stop at the agreed auth/check-in scope.

<a id="section-26"></a>

## 26. Sessions, delivery, dates, calendar, goals, accessibility and appearance — DECIDED

The core product and architecture choices are settled. These are remaining account
and interaction defaults for their feature phases, not ten additional prerequisites
for writing the first implementation plan.

1. **Device/session management:** show the user's active sessions with device/browser
   labels and last-used time, and offer revoke-this-session / sign-out-other-devices.
   Do not expose another member's devices, online status or location. Revocation must
   be enforced for sensitive server operations, not just clear one browser's UI.
2. **Travel/timezone changes:** detect a changed device timezone and offer a switch;
   preserve the saved timezone until confirmed. Show the timezone on scheduled items.
   Keep local quiet hours consistent across daylight-saving changes, without duplicate
   dispatch for repeated clock times. No location tracking is needed for this.
3. **Cancelling scheduled messages:** show the scheduled audience, channel, content
   and send time in a private pending list, with edit/cancel until dispatch is claimed.
   Cancel atomically against worker execution. Clearly distinguish a cancelled job
   from a provider request already accepted; do not promise recall after delivery.
   Existing skip-by-default, approval windows and per-item overrides remain unchanged.
4. **Delivery failures:** show pending/sent/failed (and delivered only with reliable
   provider evidence). Use bounded retries only for retryable failures; a provider
   timeout with unknown acceptance must not trigger an automatic duplicate send or
   cross-channel resend. Keep the failure in the private inbox and offer an informed
   retry. No silent promotion to a more expensive channel or unapproved provider.
5. **Important-date defaults:** support one-time and yearly dates, with an editable
   **7-day / 1-day / day-of** reminder preset. Dates are private
   until explicitly shared. Date nudges obey quiet hours, pause and the user-level
   proactive cap; group/coalesce rather than add unlimited alerts. Pick a local
   reminder time visibly rather than interpreting every date as a midnight notification.
   Calendar systems/complex recurrence beyond the initial date model can follow later.
6. **Google Calendar scope:** start with opt-in publishing of chosen app dates/plans
   into a dedicated app calendar, not reading/analyzing unrelated personal events.
   Authorization is separate from Google sign-in; use the narrowest workable scope
   and validate it during integration. Do not invite external attendees without an
   explicit recipient action. Updates/cancellations apply only to app-owned records;
   disconnect stops future sync without claiming recall of external copies. Later phase.
7. **Growth goal types:** initially support recurring daily/weekly habits and one-off
   milestone goals. AI can propose a goal/plan, but the user accepts its wording and
   schedule before activation. Participants update only their own progress; define
   shared milestones explicitly rather than letting the AI mark another person done.
   Personal goals stay private unless shared through recipient grants. Later phase.
8. **Accessibility baseline:** design keyboard navigation, screen-reader labels,
   visible focus, scalable text, adequate contrast and reduced-motion behavior from
   the first screens. Test these on web and Android; seven-locale layouts must not
   rely on fixed text heights or color alone. This is an engineering acceptance target,
   not a claim of certified conformance without an audit.
9. **Appearance:** start with system-following light/dark themes and a manual override,
   reusing/adapting SchedaPRO nightshift tokens. Contrast and focus visibility must
   work in both themes; visual design should suit this app rather than retain fitness
   copy. Theme selection must not change language, privacy settings or AI personality.
10. **Quick-exit behavior:** provide a visible fast exit from sensitive screens to a
    neutral app view and clear previews/sensitive screen state. If device app-lock is
    enabled, require unlock before reopening protected content. Do not claim to erase
    browser/OS history, notifications or screenshots outside the app's control. Preserve
    the user's data; quick-exit is not deletion or a notice to other members.

All ten above are approved. Routine remaining engineering choices are approved by
delegation under §27. Owner-sensitive choices and setup facts are distinguished there;
there is no requirement to keep producing additional numbered decision batches.
