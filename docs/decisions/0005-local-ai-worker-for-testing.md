# 0005 — Operator machine as the AI worker during testing

Accepted 2026-11-18. Extends [0001](0001-free-interim-executor.md); does not replace it.

## Context

Network AI must not run inside Postgres, and no free host fits a continuously
running Frankfurt worker: Render Free has no background workers, Koyeb's free
service sleeps and is not eligible for workers, Cloud Run needs billing and charges
a minimum per job execution, and Oracle needs card verification, regional capacity
and VM maintenance. See the [research](../implementation/FREE-CLOUD-RESEARCH.md).
A scheduled GitHub Actions run was also rejected: its cron is coarse and often late,
it runs outside the EU, and this repository's workflow logs are public.

## Decision

While testing with fictional data, the operator's own computer runs the existing
Python worker in its AI (`deepseek`) mode against the Frankfurt database, through
a dedicated restricted login that can only assume the metering role. Supabase stays
the scheduler and queue authority; the Postgres free tick keeps serving mock jobs.
The two consumers never compete because mock consumers cannot claim AI-tagged jobs
and the AI consumer claims nothing else. No new host, vendor, scheduler or bill.

When the machine is off, AI-tagged jobs wait and expire under the existing leases
and limits; nothing silently falls back to mock text. The operator starts the
worker deliberately. The provider key is supplied in the process environment at run
time and is never read from a file by the launcher, preserving the rule that the
key is not loaded automatically.

## Before beta

Choose one, recording the choice as a new decision:

- **Render background worker in Frankfurt** (`render.yaml`, already validated):
  no code change; the quoted starter plan is paid and needs the infrastructure
  budget gate.
- **Supabase Edge Function, invoked in Frankfurt**, triggered by the existing cron
  through an asynchronous HTTP request: no extra vendor and covered by the free
  plan's allowances, but the adapter, safety policy and worker must be ported from
  Python to TypeScript with equivalent tests. Verify current limits first.

## Consequences

- Availability depends on the operator's machine; acceptable for one tester and
  fictional data, not for real users.
- Every existing gate still applies: live/network switches, processor terms,
  reviewed price, provider consent, enabled safety review, an evaluated local safety
  assessor, budget reservations and an authorized producer of AI-tagged jobs.
  This decision opens none of them.
- The restricted login is a credential: it lives only in the git-ignored
  `.local/worker.env`, is never pasted into chat, Vercel, Render or Git, and is
  rotated if the machine is lost.

Runbook: [local AI worker](../implementation/LOCAL-WORKER.md).
