# Membership, unanimous invitations and pairwise blocking

The membership foundation is a separate authorization layer from private ownership.
A shared relationship never grants access to journals, check-ins, profiles or past
content. Explicit item-recipient grants are implemented separately; see [sharing](SHARING.md).

## Server contract

- Each relationship has 1..N current members; a user can have 0..N relationships.
  Current members choose their own shared alias. Private profile/email data is not
  a roster. Personal archive/mute preferences are not exposed to other members.
- Any current member can propose an immutable recipient email. That explicit proposal
  counts as their own approval. Every other current member must approve as themselves.
  Nobody can supply another member's identity or generation to cast a vote for them.
- Link issuance rechecks the current membership revision and every approval. A 32-byte
  random secret is returned once; only its SHA-256 digest is stored. Reissue requires
  a current invitation version, revalidates approval and replaces the previous secret.
- Links expire seven days after issuance. This slice creates a link for deliberate
  user sharing; it does not send emails or claim that external delivery occurred.
- Preview/redemption require a verified, beta-admitted account whose current email
  matches the intended recipient. A forwarded link reveals no group details to the
  wrong account. Acceptance is explicit and atomic; the recipient can also decline.
- Joining/leaving changes the group revision and revokes pending/issued invitations.
  Remaining invitations need a new proposal/approval round with the new group.
  Rejoining increases the member's generation; stale membership commands are rejected.
- Every member, including the original creator, can leave without approval. Leaving
  does not delete anyone else's membership or the user's privately owned reflections.
- Archive/mute are personal. They suppress contact eligibility in that relationship;
  unarchive/unmute do not replay work or revive cancelled invitations.
- A blocks B is an edge between those two accounts. It does not suspend B, remove
  membership, or block B/C contact eligibility. Each recipient is checked separately.
  Unblocking never revives a revoked token. Members can stop a group invitation through
  the normal unanimity rules; blocking is not a veto over unrelated B/C spaces.
  Block-list labels are private snapshots of currently accessible aliases, not live
  lookups that could disclose later edits after departure or historical member names
  to someone who joined later.

Writes use `public.relationship_action`, an invoker wrapper around guarded private
commands. Workspace/recipient preview are similarly scoped wrappers. Private tables
have RLS, no client grants, and no direct API exposure. Helper execution is revoked
except for the scoped entry points and the current-member RLS predicate. Public
relationship rows expose shared metadata to current members; direct writes are denied.

All membership/invitation/block mutations take one transaction advisory lock in this
prototype. This supplies one ordering across group and pair changes, avoiding stale
approval reads and lock-order deadlocks. It is a deliberate throughput limit; replace
it with ordered group/pair locks before scaling, while retaining the same guarantees.

## Tests

`npm run test:database` uses PostgreSQL 17.12, not SQLite or a mocked repository. It
creates a new disposable database, applies all migrations, and models authenticated
SQL roles with a minimal local Auth fixture. Concurrent clients exercise real locks.
Hosted JWT/email/OAuth behavior is covered by separate acceptance evidence.
integration tests passed, including true concurrent client transactions.
`supabase/tests/membership.sql` also passed in the hosted project; it rolls back all
synthetic users, memberships, approvals and tokens, leaving no test accounts behind.

`npm run test:membership` builds the production client and drives three separate
browser contexts against the real SQL/RLS functions. Auth and HTTP transport are
local fixtures. It tests proposal → unanimous approval → explicit join through login,
private-history isolation, A/B/C blocking, archive and creator leave. Mobile 390px
layout and confirmation dialogs are included. No real invitations/emails are sent.

The test DSN must use loopback and the `companion_test` base database. The generated
`membership_fixture_*` database is the only database dropped. No hosted target is
accepted. CI supplies an isolated Postgres service; the developer fixture reads
`.local/membership-db.env` (ignored, never commit its password). Start the local
`companion-membership-tests` container before running the command.

Coverage includes unanimous votes, wrong recipient, declined/revoked/expired/replaced
links, simultaneous redemption, competing joins invalidating approval rounds,
concurrent approvals/issuance, A/B/C blocking, personal archive/mute, creator leave,
fresh-generation rejoin, direct-write/helper bypass denial, and private history RLS.

## Current implementation boundary

The migration is applied to the dedicated Frankfurt project; the cloud UI is wired
to its RPCs and deployed. A live authenticated smoke test created an owner-only
fictional relationship and personally archived it; no invitation was created/sent.
That space is retained under Show archived relationships. The three-person flow is
the isolated SQL-backed browser test described above, not three live OAuth accounts.

Links use `/join#invite=...`; their fragments are removed from history
and kept temporarily in sessionStorage in the same tab through login. This avoids
putting invitation secrets in server URLs or persistent cross-account local storage.
If registration/email verification opens another tab, reopen the original link after
verification. Beta admission remains separate. Fictional local previews keep their
existing private-label flow; shared memberships require a cloud account.

Actual outward messages, content sharing and queued-send cancellation are not
implemented by this milestone. Future delivery paths must use the same group,
generation, archive/mute and pair gates immediately before acting.

## Scheduling integration

Private relationship-scoped jobs bind to current membership generations and recheck
archive/mute/leave before publication. They never create recipient content grants.
Cloud infrastructure and live Render activation status: [CLOUD-SCHEDULING](CLOUD-SCHEDULING.md).

Current hosting update: the included Frankfurt Postgres mock consumer is live,
with the same durable authorization/lease checks. Render remains a later option.
See [cloud scheduling](CLOUD-SCHEDULING.md) for scope and evidence; no real AI or
external messages are enabled by this interim adapter.
