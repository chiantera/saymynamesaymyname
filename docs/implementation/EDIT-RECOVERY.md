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

## Active edits

Each editing session has its own random checkpoint id. Each input change synchronously
updates that verified account's browser-local checkpoint, including empty text. The
client reports whether the latest change was stored on this device, acknowledged by
the cloud, or could not be stored locally. It sends a private cloud checkpoint after
a two-second pause and retries a failed save while the editor remains open. Recovered
copies offer an explicit cloud retry; a reload does not automatically publish, approve,
share, or use the text as AI context. Other devices see acknowledged checkpoints as
separate copies, not as replacements for their own active editors. A conservative extra
copy may remain after approval or displacement until the owner discards it.
For an unchanged matching editor, a recovered copy can be restored with a button;
otherwise its text remains available to copy. Device-only removal leaves any cloud
copy intact, so that copy may appear again on a later refresh.

The checkpoint RPC requires the same verified admission and source ownership as edit
recovery. Server-side revisions prevent an older response from replacing a newer edit;
each editing session is independent. A content-free tombstone prevents a delayed save
or retry from reviving a discarded cloud copy. Source/account deletion cascades on the
server. Discard is acknowledged before the current browser removes its local copy.

## Limits

Browser storage is account-scoped in the app but is **not encrypted**: anyone with
access to the same browser profile or device may be able to inspect it. Browser
eviction, storage denial or device loss can defeat local recovery. Until cloud
acknowledgement, another device cannot recover the newest edit. A remote discard does
not erase a copy already cached in another browser; discard it there too. If storage
and the cloud both fail, copy the text before closing the editor. Offline startup and
sign-in, full offline reading, conflict-resolution UX and a way to purge cached data
on account deletion remain release work. No end-to-end encryption is claimed.

The SQL fixtures cover owner isolation, verified admission, immutable idempotency,
source deletion, tombstones, delayed and concurrent writes. Browser fixtures cover
remote displacement, empty edits, save/delete failure and retry, second-device
retrieval, reload, account separation and no false recovery after local approval.
The active checkpoint tests cover revision ordering, concurrent deletion, local reload,
cross-device retrieval and failed cloud saves. Browser transport is simulated; local
PostgreSQL fixtures refuse hosted DSNs.
Live AI, provider permissions, schedules and outbound sending stay unchanged.
