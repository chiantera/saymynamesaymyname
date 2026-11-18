# Accepted pre-build decisions and delegated defaults

Accepted product specification, not a claim of completed implementation.
[Plan index](../../PLAN.md) · [Current status](../../CURRENT-TASK.md).
Section numbers remain stable; §27 in DECISIONS.md resolves superseded proposals.
Source paths in backticks are relative to the repository root.

<a id="section-14"></a>

## 14. Decisions before building vs. before release

Planning baseline is agreed. The latest ten choices (§26) are approved; remaining
routine defaults are delegated (§27). This historical walkthrough is not a fresh
proposal queue. The current action is documentation only; implementation/deployment
requires a separate build instruction. Preserve the agreed phased scope.

**Agreed baseline for the first implementation slice**

| Decision | Why it affects the build | Proposed starting point |
|---|---|---|
| Backend boundary — FastAPI reuse DECIDED | Determines API contracts, secrets, and job ownership | Reuse/adapt SchedaPRO FastAPI alongside Supabase Auth/Postgres/Storage. Vercel is selected for web/suitable request handlers; Frankfurt worker executes durable Supabase jobs; Supabase dispatch owns scheduling. |
| Data home — dedicated European Supabase project DECIDED | Determines sync, access controls, and migrations | Frankfurt (`eu-central-1`) is selected. Private cloud sync is the default (decided). AI-context permissions remain separate. Shared data, synced private records and scheduling use server authority; local storage is a cache. |
| Relationship permissions | Determines the first schema and authorization rules | Distinguish a private relationship record about someone from invited app membership. Invitation unanimity, recipient-specific sharing, personal archive, immediate leave and pairwise blocking are decided; enforce them in permissions and queued-send cancellation. Never treat tracking someone as their consent to receive messages. |
| First target — web + Android DECIDED | Makes completion testable | Web development and Android validation first; iOS testing/release follows later, with compatibility considered throughout. Solo onboarding, optional relationship, one AI check-in, approve/edit/skip, in-app result; add native push to complete Phase 1. No outward autopilot without explicit recipient/channel authorization. |
| Launch languages — Italian, Spanish, Korean, Mandarin, Cantonese, English and German DECIDED | Affects all UI copy and safety resources | Worldwide intended access is decided (§15). Build i18n from the first screen; review UI, fallback and safety copy in all seven languages. |
| Retention and provider data rules — DECIDED baseline | Affects storage, logs, exports, deletion, and failover | Apply §14/§19/§21/§23 retention and consent. Verify actual provider/backup configuration; reserve owner choices in §27. |

**Resolve while building, before the affected feature is enabled**
- Initial authentication methods are decided: email/password and Google sign-in
  on web and Android. Implement email verification, recovery and invite/deep-link
  continuation before onboarding is complete; invitation validity is decided below.
- Concrete AI models, task budgets and spending limits; provider keys stay server-side.
- Retry policy and provider capability tests; assess reused code before selecting exact versions.
- Safety implementation: server-enforced tool permissions and send gates, classification
  approach, crisis-path tests, and reviewed localized responses before advisor/autopilot use.
- Native push provider setup, delivery receipts, quiet-hour behavior and timezone tests.
- Accessibility, notification privacy and device-lock behavior on actual devices.

**Can wait until release or later phases**
- Store accounts/signing, production domains, support address and incident ownership.
- T&S reviewer and regional-resource verification ownership before public availability.
- Additional channels and their billing/accounts, Google Drive import, cloud TTS,
  translation-management vendor, additional locales/RTL rollout and monetization.
  Google Drive import means explicit user-selected files, private by default, using
  the same ingestion and untrusted-content rules as local uploads; OAuth scopes and
  one-time selected-file import is already decided; validate exact OAuth scopes
  before that integration.

**First-slice acceptance criteria**
- A solo user can complete onboarding and a check-in without adding a relationship.
- Two accounts cannot access each other's private entries, prompts or uploaded context.
- User action and a concurrent worker cannot cause duplicate fulfillment; delivery
  retries account for provider ambiguity rather than claiming universal exactly-once delivery.
- Leaving/blocking/archiving is enforced by the send path, including queued work.
- AI failure produces the agreed localized fallback; no secrets ship to the client.

**Decision walkthrough (one at a time)**
- Confirmed 2026-11-14: reuse FastAPI; dedicated Supabase project in Europe;
  initially Italian and English; expanded to seven languages below. No services have been provisioned.
- **Private cloud sync — DECIDED (2026-11-14):** journals, advisor chats, personal
  goals and uploaded/extracted context sync under the user's account by default,
  available across their devices. Account-private access is enforced server-side;
  syncing never makes records visible to relationship members. Sharing stays explicit
  and opt-in. Provider access remains a separate permission/policy decision; syncing
  does not itself authorize sending content to an AI provider. Original retention is
  specified below; backup purge and concrete encryption/key settings require verification (§21).
- **Invite visibility — DECIDED (2026-11-14):** accepting an invite grants access
  only to content explicitly shared with that person. Existing private notes, chats,
  goals and uploads remain private. Adding a member does not expand any existing
  content's audience or expose previously shared history automatically; its owner
  chooses what to share with the new member.
- **Schema consequence:** shared/private is a UI summary, not sufficient authorization.
  Persist explicit per-item recipient grants (e.g. `content_shares` with content owner,
  item and recipient IDs). Enforce those grants server-side for reads, media URLs,
  search, AI context and exports. Relationship membership alone is never a grant to
  historical content. This refines earlier references to "shared with relationship".
- **Invitation approval — DECIDED (2026-11-14):** any current member may propose
  an invitation, but every current member must explicitly approve before it is sent.
  The proposer's explicit proposal counts as their approval. Missing approval is
  pending, never implied consent; any rejection prevents sending. The recipient
  separately accepts to join. For a solo record, the sole member's proposal satisfies
  unanimity. Approval applies to the named recipient and current membership version;
  membership changes invalidate pending approvals and require a fresh approval round.
  Final approval checks and send authorization are enforced server-side. The bartender
  cannot approve on another member's behalf. Joining does not expand past audiences.
- **Personal archiving — DECIDED (2026-11-14):** archive applies only to the user
  choosing it. Hide from their active list, pause their relationship check-ins and
  automated sends, and preserve their history. Other members' settings remain theirs.
  Maintain the existing reachability safeguard: suppress sends to the archived user
  in that relationship. Cancel affected queued work; unarchiving never replays missed
  messages. Archive is independent of membership, leave and block.
- **Leaving — DECIDED:** any member may leave immediately without approval.
  Stop future sharing, relationship check-ins and app-mediated relationship messages
  to/from that membership; cancel affected queued sends. The user retains their own
  content and previously received history, subject to deletion/retention rules. This
  is historical access only: later edits, uploads and shared items remain inaccessible.
  Model retained history using received versions or equivalent cutoff-aware grants,
  not unrestricted access to live shared records. Departure is enforced server-side
  for content, AI context, search, exports and delivery. Other members cannot undo it.
  Rejoining requires a fresh invitation, unanimous approval by current members and
  acceptance by the returning user; it grants no automatic access to missed history.
  Membership changes invalidate pending invitation approvals as already specified.
- **User-to-user blocking — DECIDED:** blocking affects only the two users involved.
  If A blocks B, stop app-mediated contact between A and B, including automated
  messages, direct invitations and new sharing; cancel queued affected deliveries.
  B and C remain free to communicate, share and make plans together. A cannot use
  blocking to suspend B's account, remove B from the group, or veto B/C interactions.
  No automatic leave/archive or membership changes result from blocking.
  For group sends and plans, evaluate actual recipients individually: B/C-only plans
  remain allowed, while group fan-out must not deliver blocked-pair contact to A.
  No AI tool may relay blocked contact through another member to bypass the block.
  Existing unanimous approval still governs adding members to the shared relationship;
  it does not govern ordinary B/C conversations or plans. Previously received history
  follows retention/deletion rules. Implement pairwise authorization, never a global
  "blocked member" flag. Exact group-content presentation can be refined in the UX.
- **First platforms — DECIDED:** web and Android first. iOS is a later validation/
  release target; retain portability in the client design.
- **Expanded launch localization — DECIDED:** Italian, Spanish, Korean, Mandarin, Cantonese, English and German.
  See §10 for separate UI/script and AI-language preferences and review requirements.
- **Chinese defaults and location — DECIDED:** Mandarin/Simplified and Cantonese/
  Traditional, with known-region refinements for unset preferences (§10). Saved
  choices override suggestions; script and conversation language remain independent.
- **Free-tier context-original retention — DECIDED:** retain uploaded source originals
  privately for **30 days** by default; offer **extract text and discard original**
  per upload. Discard mode removes the app's original after successful extraction;
  never delete the user's source on their device or Drive. Explain any temporary
  upload/OCR processing before extraction. A failed extraction must not silently
  destroy the only app copy before a user can retry or choose discard.
- **Free-tier original-storage cap — DECIDED:** **50 MB per user**, whichever limit is
  reached first (30-day age or total retained-original bytes). Cap scope is the
  user's uploaded context originals, not each relationship separately.
  At capacity, remove the **oldest retained originals first**, ordered by upload
  time, until the new retained original fits. **Keep extracted text and source
  metadata**; capacity eviction never deletes them. Show affected originals before
  accepting the upload, with an option to extract text and discard the new original.
  Evict only sources with successfully persisted extracted text; failed/pending
  extractions require retry or an explicit discard choice, not silent data loss.
  Complete extraction successfully before committing evictions. Serialize quota
  updates per user so concurrent uploads do not exceed the retained-original cap.
  A single original larger than 50 MB cannot be retained under this quota; offer
  text-only extraction within processing limits rather than evicting unrelated files
  for an original that cannot fit. Temporary processing limits are separate.
- Track upload time, original byte size, retention mode, expiry and deletion status.
  Expiry removes original objects and app-generated source previews/cached copies;
  revoke source access links. Keep a source metadata record and extracted text so
  citations can state that the original expired. Backup purge lag and any OCR-provider retention are separate decisions; do not
  describe primary-storage expiry as instant deletion from every backup/provider.
  Schedule expiry on the server even if the user never reopens the app.
- This retention applies to **context sources**; intentionally saved memory/gallery
  photos are a separate class and must not expire by accident under this policy.
  Sharing an original does not silently extend its retention. Existing grants govern
  visibility while the original exists.
- **Extracted-text retention — DECIDED:** retain privately in the user's account
  until the user deletes it, on free and paid tiers. Original expiry, quota eviction,
  or text-only extraction must not delete extracted text. Users may review/correct/
  delete it; granting AI access remains separate. Deletion must also remove derived
  chunks/search indexes and exclude deleted text from future AI context; backup
  deletion lag and treatment of already generated chat content require explicit rules.
- **Free and paid versions — DECIDED:** free offers limited original cloud storage
  (the 50 MB / 30-day policy above); paid offers substantially more cloud space.
  Paid allowance is 5 GB per user (§19); price remains open. Full-quota and downgrade handling are decided below.
  Text retention is not a promise of unlimited ingestion: text-volume, per-file OCR,
  AI request and abuse limits must be budgeted separately. Exhausting a future
  ingestion allowance must not silently evict retained extracted text.
  Expose original-storage usage and expiry clearly; design entitlements now, defer
  payment integration until its phase. The initial paid original-storage quota is 5 GB (§19).
- **Paid original retention — DECIDED:** originals retained under an active paid
  allowance have no automatic time-based expiry; keep them until the user deletes
  them, within that allowance. The free-tier 30-day expiry and oldest-first quota
  eviction do not apply to paid originals. Preserve private access and the per-upload
  extract-and-discard option. Account deletion remains a separate action; subscription
  expiry follows the 30-day grace policy below. Cancellation while paid access is
  still active must not trigger the free cleanup job.
  Cleanup jobs must check current server-side entitlements before deleting an original.
  An upgrade cannot recover originals already deleted under the free policy.
- **Paid full-quota behavior — DECIDED:** preserve every existing original; pause
  retention of new originals when an upload would exceed the user's paid allowance.
  Do not apply oldest-first eviction. Offer user-directed deletion, an increased
  allowance when available, or extract-text-and-discard for the new source within
  separate processing limits. Reading, downloading and deleting existing originals
  remain available. Keep extracted text untouched. Enforce quota and reservations
  server-side for concurrent uploads; temporary extraction files are processing data,
  not retained originals, and require their own cleanup limits. Resume original
  storage when enough space becomes available.
- **Paid expiry/downgrade — DECIDED:** provide a **30-day grace period from the
  actual end of paid access**, not from a cancellation request. Preserve existing
  originals during grace, with read/download/export/delete available. Pause new
  original storage if it would exceed the free allowance. Extracted text remains.
  Show the exact grace deadline and upcoming cleanup in-app, with permitted reminder
  notifications; offer export or renewal before cleanup. Do not expose sensitive
  source details in reminder notifications.
  After grace ends, apply the free policy: remove originals older than 30 days,
  then evict oldest remaining originals as needed to fit 50 MB. Age is measured
  from original upload, not reset at downgrade, so older paid originals may all
  expire at the grace deadline. Preserve extracted text and source metadata.
  Renewal before cleanup restores paid retention; recheck current entitlements
  before deletion so a stale job cannot delete a renewed user's originals.
  Original deletion is not reversible by renewing afterward. Backup purge lag is
  documented separately. Explicit user deletion can still occur during grace.
- **Chat-history retention — DECIDED:** keep bartender conversations privately in
  the user's cloud account until the user deletes them, on both free and paid tiers.
  Offer deletion of an individual conversation or all history. Other members cannot
  access private chats; storage alone does not authorize use in later AI calls.
  Deleting history removes its messages and derived chat summaries/search indexes
  from active storage and future retrieval. Already shared artifacts are separate
  records and must be identified clearly rather than silently deleted or claimed
  erased. Backup purge timing and provider-side retention remain separate policies.
- **Saved AI context — DECIDED:** an opt-in **Use my saved context** setting with
  independent switches for **journals**, **extracted documents** and **previous chats**.
  Default off until the user opts in. Allow exclusions for individual entries, sources
  and conversations; a category switch never overrides an item's exclusion. Exclusion
  does not delete content or change sharing grants. These controls apply to all saved
  context retrieval, including advisor chat, scheduled check-ins, digests and recaps.
  With no opt-in, use the current conversation and explicitly attached material only;
  attaching material authorizes that task, not future automatic reuse. An excluded
  item can only be used through a new explicit task-specific attachment/action.
  Persist settings and item exclusions privately with the user's account, enforce
  them server-side, and recheck before queued generation/retries. Derived summaries,
  embeddings/retrieval results and cached prompts inherit source restrictions; invalidate
  affected reusable context when consent changes. Do not claim this erases information
  already delivered to providers or present in old replies. Cross-member access and
  provider approval remain separate requirements; these switches never expand either.
- **Provider approval — DECIDED:** obtain separate approval for each external AI
  processor and the capability/data involved: chat/generation, OCR/vision, speech-to-
  text, and cloud voice output. Let users separately enable automatic fallback, which
  may use only already approved providers. Present provider identity and the data
  sent before approval; private cloud sync is not processor approval. Revoking approval
  blocks future calls, including queued tasks, retries and fallback, without claiming
  to recall data already transmitted. Persist consent versions and enabled capability
  scopes per user; enforce routing server-side and record the processor used without
  logging raw private content. No approval via inferred location or another member.
  If approvals leave no usable provider, use honest static fallback/typed input.
- **Voice-input provider — DECIDED direction:** include a dedicated speech-to-text
  adapter, initially evaluate **Groq** from the sibling integration. Actual enablement
  requires language/capability, cost and data-policy checks plus user approval (§9a).
- **Recorded-audio retention — DECIDED:** discard original audio after successful
  transcription by default. Preserve the editable transcript in the current draft;
  sending/saving it creates the usual private chat/context record, retained until
  user deletion. Do not auto-send the transcript or silently save an abandoned draft.
  Remove app-held temporary audio after processing; this does not claim immediate
  deletion from provider systems, whose retention must be disclosed separately.
  Failed transcription follows bounded temporary-processing cleanup with retry/discard
  options, not indefinite storage or a false success notice.
  Offer a per-recording **Keep original audio** option, private by default. Retained
  recordings count toward the same per-user context-original quota: free 30-day /
  50 MB oldest-first policy; paid no time expiry within allowance; full paid storage
  pauses retention with an explicit text-only option. Apply downgrade grace rules.
  Deleting/expiring audio leaves saved transcript text intact. An expired or discarded
  recording cannot be recovered by later selecting keep or upgrading.
- **Saved profile memories — DECIDED:** require explicit approval for each memory
  before it becomes active. The bartender can propose "Remember this?" with the exact
  wording and intended scope; silence, category context opt-in or chat retention is
  never approval. Existing memories cannot be silently revised with inferred facts:
  substantive AI-proposed updates require fresh approval. A user directly creating or
  editing a memory is an explicit action. Store approved memories privately and sync
  across devices; offer a visible **Saved memories** list with edit/delete controls.
  No automatic sharing with relationship members. Memory approval authorizes future
  use of that fact in the user's permitted AI tasks, subject to approved providers and
  audience/privacy rules. It never authorizes reuse of the entire source conversation.
  Per-item exclusions/revocation also apply to memories and their derived context.
  Deletion must invalidate active memory/context caches and prevent silent recreation
  from retained chat; a later proposal needs fresh explicit approval. Keep source links
  so deleting/excluding a source can identify derived memories for removal or explicit
  independent reapproval, rather than bypassing the source restriction through memory.
- **Initial authentication — DECIDED:** **email/password and Google sign-in** for
  web and Android, using Supabase Auth alongside FastAPI. Include email verification
  for password sign-up and password recovery. Validate sessions server-side for
  private API operations; authentication does not substitute for item/member access
  checks. Keep credentials and sessions isolated from AI context and logs.
  Preserve pending invite intent through sign-up/sign-in and return to an explicit
  acceptance screen; signing in alone must not join a relationship. Google sign-in
  requests identity access only, not Google Drive/Calendar permissions. Those are
  separate optional integrations with their own authorization. Final callback/deep-link
  URLs and account-linking behavior require validation during implementation.
- **Invitation validity — DECIDED:** an invitation expires **7 days after sending**,
  not 7 days after proposal. It is single-use and bound to the intended recipient's
  verified email. Require authenticated matching-email redemption and explicit join
  acceptance; a forwarded link cannot authorize a different user. Redeem atomically
  to prevent concurrent duplicate joins. Recheck unanimous approval, current membership
  version, expiry, revocation and pairwise block rules server-side at redemption.
  Store a token digest, not a reusable plaintext secret; avoid tokens in logs.
  Expired/revoked invitations cannot be redeemed. Resend/reissue must revalidate the
  approval rules and invalidate the previous link; no silent change of recipient.
- **Initial no-response preset — DECIDED:** **skip after 30 minutes**. Initialize
  each channel with this action/window, retaining per-channel settings and per-check-in
  overrides for both. No response never opts a user into auto-send. On expiry, close
  the pending approval without sending the drafted message; keep private decision
  history subject to its retention rules. A prompt already delivered to the user is
  distinct from delivery of its drafted message to another person.

**Scheduling, previews and beta access — DECIDED**
1. **Initial cadence:** every **6 waking hours**, configurable per relationship
   and for solo growth. Multiple relationships need a user-level fatigue limit rather
   than multiplying nudges without bound; detailed cap can be refined during design.
2. **Initial quiet hours:** **22:00–08:00 in the user's timezone**, editable.
   Defer scheduled nudges; do not burst-deliver overnight backlog in the morning.
   The approval window for a nudge should start when presented, not while it is
   deferred during quiet hours. No automatic outgoing send should bypass quiet hours.
3. **Notification preview:** discreet lock-screen content by default, such as
   "You have a check-in", without names, message text, relationships or sensitive
   details. Users may opt into richer previews. This turns the agreed discreet-
   notification requirement into a specific default.
4. **Initial access:** an **invite-only beta**, with explicitly admitted
   testers before public signup. Accepting a relationship invitation also admits the
   verified recipient (owner decision 2026-11-18, superseding the earlier "separate
   admission" rule); every invitation still follows unanimous approval and recipient consent.

**Hosting, region, worldwide access and budget — updated decisions**
1. **Vercel — DECIDED direction:** use Vercel rather than Netlify for the web app,
   and deploy suitable FastAPI request handlers there. Reference inspected locally:
   `C:/projects/plt/vercel.json`, `alpha-pwa/README.md`, and the showcase deployment
   chat `01a1b1f3-08dc-7993-bbe2-d06c003f4f29`. PLT uses Vercel Services for Vite plus
   FastAPI, with same-origin `/api`; it forwards AI/OCR/transcription/background routes
   to Render. Reuse configuration patterns, not PLT's live API URLs or credentials.
   **Hybrid — DECIDED:** a Frankfurt processing worker using the PLT Render pattern
   handles durable AI/OCR/transcription and delivery work; Vercel hosts the web UI and
   stateless FastAPI request layer. Reuse code after adapting persistence and guards.
   Durable queue/job state belongs in Supabase, not process memory. Supabase dispatch
   creates due jobs; the worker claims bounded tasks with leases, heartbeats and
   recoverable retries. Vercel creates/reads jobs but does not own a duplicate scheduler.
   Recheck consent, reachability, tier and budget before each attempt. A worker crash,
   refresh or deployment must not lose jobs or cause uncontrolled duplicate sends.
   Use direct authorized uploads to private Supabase Storage, not large file bodies
   routed through a function; handlers receive scoped object references.
2. **Frankfurt — DECIDED:** dedicated Supabase in `eu-central-1`; Vercel request
   compute in Frankfurt (`fra1`) and any separately hosted worker in Frankfurt where
   supported. Static frontend assets can use the global CDN; private user records
   never become static assets/build outputs. AI/OCR/STT provider processing, logs and
   backup locations need separate checks; Frankfurt primary data is not an all-data-
   stays-in-Europe promise.
3. **Worldwide — DECIDED product scope:** replace Italy-only rollout with worldwide
   intended access, retaining invite-only beta admission and seven initial languages.
   Implement the worldwide plan in §15. Actual availability depends on service and
   regional constraints; do not advertise untested universal provider coverage.
4. **AI test budget — DECIDED:** EUR 20/month aggregate target ceiling across text,
   OCR, transcription and cloud speech for development/beta, separate from hosting
   and storage. Implement usage accounting and conservative reservations (§16).
   This is a budget target, not an estimate that it can support unlimited testers.

<a id="section-27"></a>

## 27. Decision closeout — delegated defaults and the finite owner review list

**Authority:** the user approved every decision in §26 and authorized choosing the
remaining routine defaults. This section supersedes stale "open/proposed" labels in
the earlier planning walkthrough. Already approved privacy, inclusion, safety, storage,
blocking, localization and phasing rules are not reopened. User instructions take
precedence over defaults. This closes the rolling decision questionnaire.

**Historical closeout scope:** §27 originally covered planning only. The later
explicit implementation instruction in §28 supersedes that restriction for local
scaffolding/development; paid provisioning and real-data activation still have gates. The next concrete engineering
artifact is the bounded Phase 0/1 implementation plan, rather than more invented
batches of feature questions. Later feature design stays in its assigned phase.

### A. Routine defaults — APPROVED BY DELEGATION

These are selected engineering defaults, not claims that the user named each detail.
Change them autonomously when evidence requires, provided behavior, privacy, cost
permissions and the owner's material choices are preserved; document the reason.

| Area | Adopted default |
|---|---|
| Reuse baseline | Copy/adapt bounded files from SchedaPRO main; take reviewed settings/theme work from nightshift and routing patterns from PLT. Preserve source repos and never point this app at their live APIs or data. |
| Project layout | React/Vite/TS client, FastAPI request layer and reusable worker modules with explicit shared domain contracts. Do not migrate to a different framework just for convenience. |
| Dependency/tooling | Reuse compatible sibling manifests/lockfiles, pin reviewed versions, use its package-manager/test conventions. Verify platform APIs before implementation; no blind SDK upgrades or downloads during planning. |
| Localization | i18next/react-i18next, seven Git catalogs, English source keys, Intl date/number formatting, native review plus professional safety-copy review. Provider quality must be tested per language. |
| State and access | Supabase is authoritative. Separate private ownership, explicit item-recipient grants, membership, pairwise blocks, archived_at, and capability-scoped provider/context consent. Avoid redundant flags as authorization. |
| Durable jobs | Start with a Postgres jobs table and transactional lease/claim functions, not an extra queue service. Supabase dispatch creates due work; Frankfurt worker executes it; Vercel handlers create/read jobs. |
| Tick/cadence semantics | Tick every minute for due/expiry work, not per-second precision. Default cadence is six elapsed hours with presentation confined to waking windows; defer/coalesce missed slots rather than accumulate a catch-up backlog. Keep cadence/quiet hours/cap configurable. |
| Lifecycle | Versioned decisions with pending/deferred/queued/fulfilled/skipped/cancelled/failed/uncertain outcomes. Skip is not success. Single artifact per check-in, separate recipient delivery attempts. |
| Safe retries | Initially up to three attempts for demonstrably safe retryable work with backoff and jitter. Each paid attempt reserves budget. Unknown outbound acceptance is held for reconciliation; it is never an excuse for an automatic duplicate. |
| Batching/concurrency | Small bounded worker batches initially; one active claim per job. Rate-limit by task/user/provider and tune from measurements, keeping the accepted per-user reminder cap separate. |
| Honest degradation | Use the localized bar-closed outage notice only for an actual provider outage. Distinguish budget exhaustion, missing approval and unsupported capability with accurate static wording/actions; do not falsely report that the API is down. Static help remains accessible. |
| Model/OCR configuration | Keep concrete model IDs and prices in server configuration; select the least-cost capable approved route that passes language/tool/safety evaluations. Prefer existing provider adapters; activate no extra processor implicitly. No hardcoded "Flash/Pro" product-name promises. |
| Reminder presentation | Approval starts when eligible content becomes available in the inbox/presentation path, not when generation starts and not based on an unobservable claim that a notification was read. Quiet hours, snooze and pause control when the window starts/resumes. |
| UI defaults | Existing five-tab navigation, system theme/manual override, responsive layouts, accessible controls, plain status copy and content-free push previews. No new social feed, ranking or surveillance features. |
| Local cache | User-scoped IndexedDB/cache for eligible data and offline drafts; minimal private thumbnails; protected platform session storage where supported. Clear accessible account cache on logout/revocation and reapply tombstones at sync. Disclose that offline copies cannot be remotely recalled instantly. |
| Storage accounting | Decimal MB/GB displayed consistently; server-authoritative reservations for originals/gallery. Context expiry cannot remove gallery memories or extracted text. Temporary processing and export files have their own bounded cleanup. |
| Temporary/export cleanup | Stage processing audio/files only as long as needed, with a 24-hour maximum orphan-cleanup target; user cancel/deletion removes earlier where possible. Private generated export bundles expire after 24 hours. These app-side targets are not provider backup-purge guarantees. |
| Account safety | Current authorization and revocation checks for sensitive operations, explicit reauthentication where required, tested recovery flow, no AI access to auth/session secrets. Never silently merge separate accounts or consume an invite on sign-in alone. Validate actual auth-provider linking behavior before enablement. |
| Destructive actions | Delete only content/records the actor owns or has explicit authority to delete. A relationship creator cannot wipe other members' accounts, private records or unrelated B/C activity. Group deletion is not an AI shortcut. |
| Audit minimization | Keep user-visible action/source revision history privately under its own retention, without auth secrets or duplicated whole-document bodies. Do not use it to bypass original/text deletion. Diagnostic logs retain 14 days; consent receipts and cost ledgers have separate purposes. |
| Operational record lifetime | Keep current consent state while the account exists and minimal superseded consent/access events for 90 days; detailed app cost reconciliation records for 90 days, then non-identifying monthly totals for 12 months. Do not overwrite the separately agreed product analytics periods. Payment/invoice retention is specified before future billing, not inferred from these app defaults. |
| Backups and restores | Maintain separate recovery plans for database records and original file objects. Replay deletion/revocation records before reopening a restored system; never resurrect sent jobs or re-enable revoked provider consent. Verify actual plan-level backup retention/location and file backup coverage before storing real beta data. No paid backup upgrade is purchased by this planning decision. |
| Testing | Reuse existing lightweight frontend/backend test patterns; add meaningful contract/access/state-machine/worker tests, browser checks and real Android checks. Fictional seeds/mocked providers by default; live smoke tests bounded and explicitly enabled. |
| Release hygiene | Separate preview and beta secrets/state, reversible migrations and measured rollout. Verify backup/restore, access controls and seven-language critical flows before beta. Never interpret a successful build as a tested live deployment. |
| Integration rollout | Push/in-app first; uploads/advisor/Drive/voice/growth and later channels remain in their feature phases. No channel registration, automated external send, paid vendor plan or new cloud processor is enabled by default. |
| Scope/limits | Implement exactly the agreed first slice before expanding. Enforce ingestion, cost and abuse controls without deleting retained user text to solve a budget problem. Storage space and model/processing quotas remain separate concepts. |

### B. Owner-sensitive choices — the complete current review list

These can materially change identity, outward behavior, spending or data exposure.
They are not automatically converted to consent by the blanket approval of routine
choices. No repeated numbered decision batches are needed; keep these six on one list.
Defaults below allow planning/prototyping to proceed without inventing a final answer.

| ID | Choice the owner may want to change | Safe planning position / recommendation | When needed |
|---|---|---|---|
| O1 | Public app name, bartender name and final visual identity | Keep `saymynamesaymyname` as a working repo title, a nameless friendly bartender and an accessible warm light/dark draft. No personal photo as a public brand asset without instruction. | Before public/store identity; not before a prototype. |
| O2 | Recipient-facing AI attribution | Recommend an AI/app-assisted label on messages sent automatically; reviewed drafts may be sent as the user's approved content. Do not expose private prompt history, skips or edits. Exact recipient wording remains owner review. Never impersonate another person's account or imply a human approved an automatic message. | Before outward automatic sending. |
| O3 | Multilingual outward-message behavior | Recommend showing/approving the exact translated variants per recipient, preserving access to the original and labeling translations. Until chosen, send only explicitly approved wording; no silent post-approval rewriting. This is distinct from native-language advisor text. | Before multilingual member messaging. |
| O4 | Total ongoing infrastructure/storage budget | EUR 20/month remains AI-only. Present a concrete hosting/storage/backup quote and total limit before starting paid services. Small beta size and free allowances do not establish an overall hosting budget. | Before paid provisioning or increasing allowances. |
| O5 | Public paid price and included AI/processing allowances | Keep beta free/no real billing. Maintain 50 MB free / 5 GB paid storage entitlements and agreed retention. Use measured usage to propose price, AI allowances and additional storage tiers; do not promise unlimited AI. | Before accepting payments, not before beta development. |
| O6 | Approval of actual cloud-processor data terms | Verify each chosen processor's processing regions, retention/training settings and capabilities; present the material facts before activation. Frankfurt storage is not a promise of EU-only AI processing. Until verified/approved, use mocks or already authorized processing only. | Before sending real content to that processor. |

The user subsequently adopted O2/O3 recommendations for now (§28), preserving the
recipient-content privacy model; branding and pricing stay deferred. O4/O6 need real facts/amounts; a generic "yes" is
not substituted for an actual quote or provider data review.

### C. Setup facts and release evidence — not product preference questions

- Select the owner's actual Vercel/Supabase/Render accounts/projects and configure
  scoped keys/secrets directly in secure setup; never invent or request pasted keys.
- Supply a real monitored support address and assign support/security ownership;
  choose actual native-language/safety-resource reviewers before publishing their work.
  No person or response time is represented as staffed until confirmed.
- Configure Android package/signing, OAuth/deep-link domains, email delivery and
  native push credentials; verify the registered identities/redirects before release.
- Verify actual model availability/prices, OCR/STT coverage for all seven languages,
  selected plan limits, budget-control behavior and backup/file recovery coverage.
- Obtain evidence from safety/access tests, restore/delete drills and real-device
  behavior. Resource entries have checked sources/review dates; no invented hotlines.
- These tasks cannot be "approved into existence". They are completed when facts and
  test evidence exist. Missing public contact/reviewer assignments need not stop a
  local fictional-data prototype, but do block claiming those services are available.

### D. Approved scope for drafting the implementation plan

Phase 0/1 only: client shell and locale plumbing, auth, solo onboarding, optional
relationships/approved invites, permission schema, preferences, one durable AI
check-in, approve/edit/skip/snooze, resulting private/shared artifact, in-app inbox,
Android push, minimal job/cost/status views and the necessary settings/access controls.
Start with mocks/fictional data; validate live processing only after its prerequisites.
Uploads, full bartender chat/tools, richer goals, plans, media and external channels
remain later phases; initial navigation can expose clear placeholders, not fake features.
No live provider, billing, backend project or native package is created in this update.

Documentation references checked 2026-11-14:
- React i18n binding: https://react.i18next.com/
- Database/object recovery distinction and plan-specific retention:
  https://supabase.com/docs/guides/platform/backups
- Infrastructure metering/budget controls: https://vercel.com/docs/spend-management
