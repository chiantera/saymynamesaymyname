# Explicit reflection sharing

This slice supports saved private reflections only. Documents, uploads, chat,
exports, search and AI context are not wired to sharing yet. A share grants read
access to one fixed copy; it does not authorize AI processing or delegation.

## Access model

- Original `companion_entries` rows remain owner-only under existing RLS.
- Only the owner can choose an explicit list of 1–100 distinct recipients in one
  relationship. No recipient is preselected; future members receive nothing.
- The server checks the current relationship membership version and `can_reach`
  for every recipient, atomically. If any recipient is unavailable, nobody gets
  the proposed share. Muted, archived, left, blocked or unadmitted users are ineligible.
- Each successful operation stores an immutable text/locale snapshot and named
  recipient grants in the non-exposed private schema. Recipients cannot edit,
  forward through the app, add people or grant AI use. Private later edits do not
  update a received copy. Sharing a new revision requires another explicit share.
- Existing received snapshots remain available after leaving, muting or personal
  archiving, as agreed in PLAN §18. These actions do not authorize new deliveries.
- Either-direction pairwise blocking permanently revokes the pair's grants across
  spaces. It leaves other pairs untouched. Unblocking never revives these grants;
  a new share requires an explicit owner action and current reachability.
- An owner can revoke one named recipient immediately, including after departure.
  Reads and listings then deny access. Deleting the original cascades through
  snapshots and grants. Owner admission/verification is also checked on reads.
- Mutations and reads use the membership advisory lock, so sharing versus blocking
  cannot leave a readable grant after the block transaction commits.

## Client behavior and limitations

The Home screen has a separate sharing panel with a fixed-copy preview, exact
recipient list, explicit confirmation, sent-grant list, individual revocation and
received-copy viewer. The server, not the picker, authorizes each request.

Lists contain metadata only. Text is fetched only on an explicit Open action and
is held in component memory, never added to localStorage, a search index or AI
context. Refresh clears displayed received text; polling every 15 seconds and
visibility changes clear it too. Backend denial is immediate after revocation;
already-rendered text is not remotely erased instantaneously. Previously copied,
screenshotted, downloaded or externally delivered content cannot be recalled.
Offline caching and shared exports are not implemented in this slice.

Seven catalogs include draft translations. Native review remains pending.
The fictional local preview does not simulate cloud sharing.

## Validation

- `npm run test:database`: membership and sharing tests against a disposable real
  PostgreSQL database, including exact audiences, original privacy, read-only
  permissions, immutable snapshots, stale membership versions, atomic rejection,
  bilateral blocking, unrelated pairs, leave/history, revocation, source deletion,
  beta removal and a concurrent share/block race.
- `npm run test:membership`: production browser build, three independent accounts,
  real SQL/RLS, simulated Auth/HTTP transport; recipient preview, selected access,
  exclusion, revocation and mobile confirmation.
- `supabase/tests/sharing.sql`: hosted transactional smoke with synthetic users;
  all test data is rolled back. No real invitations or outward messages are sent.

Remaining work includes shared documents/media, deletion UI, source-aware derived
artifact cleanup before adding shared search/export/AI, outward delivery and native
Android verification. M2 and Phase 0/1 as a whole remain incomplete.

## Scheduling integration

Private relationship-scoped jobs bind to current membership generations and recheck
archive/mute/leave before publication. They never create recipient content grants.
Cloud infrastructure and live Render activation status: [CLOUD-SCHEDULING](CLOUD-SCHEDULING.md).

Current hosting update: the included Frankfurt Postgres mock consumer is live,
with the same durable authorization/lease checks. Render remains a later option.
See [cloud scheduling](CLOUD-SCHEDULING.md) for scope and evidence; no real AI or
external messages are enabled by this interim adapter.
