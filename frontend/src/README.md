# Client source

`App.tsx` owns data, versioned decisions, navigation state and guarded refreshes.
`Shell.tsx` renders one responsive navigation/account layout. `AuthGate.tsx` owns
cloud admission, account-keyed remounts and recovery screens.

`api.ts` selects local, fictional-browser or cloud transport. `cloud.ts` maps guarded
operations to Supabase and checks account generation around every result. The main
and sharing refreshes each verify the user once. `polling.ts` serializes periodic
reads, backs off and pauses while hidden; it never schedules sends/AI calls.

`Relationships.tsx`, `Sharing.tsx`, `Scheduling.tsx`, `Budget.tsx` and `AIConsent.tsx`
are cloud controls. `Support.tsx` provides independent static help plus private
explicit-reveal notices. `support-resources.ts` resolves curated country facts and
review gates; UI language never determines the emergency number.

[Screen modules](screens/README.md) · [Styles](styles/README.md) ·
[Design contract](../DESIGN.md) · [Testing](../../docs/TESTING.md).
Preserve recipient/version/generation arguments and fail-closed UI state. Render
untrusted text as text; do not introduce raw HTML or provider credentials.

`request-errors.ts` maps only an exact stale check-in decision to a safe conflict
message. Other cloud errors stay generic; server details are never rendered.

Displaced edits use private, immutable cloud recovery copies after acknowledgement;
failed/offline saves remain temporary in memory with retry/copy instructions.
Active editor checkpointing is still pending. [Recovery contract](../../docs/implementation/EDIT-RECOVERY.md).
