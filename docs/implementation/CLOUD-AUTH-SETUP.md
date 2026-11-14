# Cloud auth activation

## Verified state

- Web preview: https://saymynamesaymyname.vercel.app. Pushes to main automatically
  deploy the frontend; GitHub CI runs the local behavioral checks/build.
- Dedicated Supabase project: `chxlkmmkoadgcaomkznd`, Frankfurt (`eu-central-1`).
- Client configuration contains only the project URL and publishable key. No service
  role key is needed for browser sign-in or private synchronization.
- Private records require both operator beta admission and a current verified Auth
  email. Owner RLS and guarded RPCs enforce this independently of the UI.
- Email/password sign-in and sign-out clients exist. Registration, recovery and
  Google sign-in are not yet exposed as working flows.
- Live transactional SQL tests cover approved/duplicate decisions, owner isolation,
  unadmitted users and admitted users whose email is still unverified. All synthetic
  data is rolled back. These tests do not certify actual email delivery or OAuth.

## Current external boundary

Connected Supabase tools can manage database migrations but do not expose Auth
configuration here. The local CLI has no management login. The built-in browser
reaches Supabase's sign-in page. Vercel authorization does not authorize that dashboard.
No existing project credentials were copied, and no real tester account was created.

## Resume after authenticated dashboard access exists

1. In this project's Auth URL configuration, set Site URL to
   `https://saymynamesaymyname.vercel.app`. Allow the exact production callback URL
   and `http://127.0.0.1:5174` for local development. Match the eventual callback
   path explicitly when implementing it; do not broadly allow arbitrary previews.
2. Keep email confirmation enabled. Verify email delivery configuration, rate limits
   and recovery templates using current dashboard settings before promising signup.
3. Implement the email signup/confirmation and recovery screens, exact callback
   handling and session cleanup. Show admission-pending state after verification;
   signing up must never grant beta admission automatically.
4. Configure a dedicated Google OAuth client in the appropriate Google project and
   Supabase provider settings. Keep its secret server-side. Google sign-in consent
   is separate from Drive access. Add web/Android callback handling and test each.
5. Admit only a verified, explicitly selected tester by their Auth user UUID through
   an operator-only database action. Never derive admission from client metadata or
   self-service profile fields; the beta table has no client access policy.
6. Run real browser acceptance checks with approved test accounts: confirmation,
   login/logout, reload, two-device private sync, unadmitted rejection, recovery,
   token expiration and account switching. Then test native Android callbacks.

## Cloud sync scope

The current cloud client synchronizes private profile preferences, relationship
labels, manual mock check-ins and approved reflection entries. It does not yet
provide sharing, relationship membership, full account deletion/export, offline
conflict resolution, live AI, automatic cloud scheduling or remote notifications.
Those remain explicit Phase 0/1 milestones; do not use sensitive real content yet.

The local scheduling engine is a tested SQLite adapter. Its worker must be ported
to leased Supabase jobs and deployed in Frankfurt before claiming hosted scheduling.
