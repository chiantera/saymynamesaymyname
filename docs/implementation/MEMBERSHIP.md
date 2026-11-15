# Membership, unanimous invitations and pairwise blocking

The membership foundation is a separate authorization layer from private ownership.
A shared relationship never grants access to journals, check-ins, profiles or past
content. Explicit item-recipient grants remain a later feature.

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

The migration and tests are ready for frontend integration. Apply to the dedicated
Frankfurt project with that integration; the current hosted UI still tracks private
labels. Actual outward messages, content sharing and queued-send cancellation are
not implemented by this milestone. Future delivery paths must use the same group,
generation, archive/mute and pair gates immediately before acting.
