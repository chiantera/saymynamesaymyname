# Private recovery of displaced edits

When a pending check-in changes or closes while its owner has an unsent edit,
the client retains the exact edit, including an intentionally empty edit. An
normally confirmed approval in this tab does not create a recovery copy. If a
background refresh races the approval response, the app may conservatively keep an
extra private copy; the user can dismiss it.

In cloud mode, each displaced edit gets a new client UUID and is saved as an
immutable owner-only copy. The UI reports saving, confirmed private cloud storage,
or a failure with retry/copy options. A save is not described as durable until the
server acknowledges it. Other devices retrieve the owner's saved copies at sign-in,
on return to a visible tab and on the bounded idle polling cycle. No edit is sent,
shared, added to a journal, or made AI context by this operation. Local fictional
preview uses in-memory recovery only.

## Authority and deletion

The private table has RLS and no client/worker/meter table privileges. A narrow
security-definer helper uses `auth.uid()` plus current verified beta admission;
the public wrapper is security-invoker. Source check-in ownership and version are
checked on save and dismiss. A composite foreign key prevents recovery from being
attached to another owner's source. Each id is an idempotency key: the same exact
copy can be retried, but different content/version cannot overwrite it.

Dismissal writes a content-free tombstone, even if a save has not arrived yet.
A delayed or concurrent retry cannot recreate a dismissed copy. Tombstones contain
no edit text and remain until the source check-in or account is deleted. Source/
account deletion cascades to saved copies and tombstones; a deleted source cannot
be silently resurrected. Clients retain failed or unacknowledged copies in memory
and do not hide a dismissal until the server confirms it. A failed deletion is
retryable. Client account-generation checks apply before and after every operation.

## Limits

This protects an edit **after displacement is detected and the server acknowledges
the save**. The currently open editor is not continuously checkpointed. A tab crash,
offline period, page change or authentication remount before acknowledgement can
still lose an unsaved active edit. The interface tells users to copy an unconfirmed
edit; retry requires a working signed-in connection. Full offline drafting, durable
active-edit checkpointing, explicit version resolution and their account/deletion
semantics remain Phase 0/1 work. No end-to-end encryption is claimed.

The SQL fixtures cover owner isolation, verified admission, immutable idempotency,
source deletion, tombstones, delayed and concurrent writes. Browser fixtures cover
remote displacement, empty edits, save/delete failure and retry, second-device
retrieval, reload, account separation and no false recovery after local approval.
Browser transport is simulated; local PostgreSQL fixtures refuse hosted DSNs.
Live AI, provider permissions, schedules and outbound sending stay unchanged.
