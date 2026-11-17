# Migrations

Apply in filename order. Published migrations are immutable; make a new forward
migration with the pinned Supabase CLI's `migration new` command. Never invent a
version or rewrite an already-applied migration to conceal a fix.

Every access change needs RLS/grant/function review, a pinned search_path for
privileged helpers and tests of owner isolation, stale versions/revocation and
restricted worker roles. Do not grant table access merely to bypass a failing RPC.

[Local fixture](../../backend/dbtests/README.md) applies all files to a generated
loopback database. Hosted deployment needs explicit scope/evidence and post-change
smoke/advisor checks. [Implementation guides](../../docs/implementation/README.md).
