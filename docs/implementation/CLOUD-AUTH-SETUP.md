# Cloud auth activation

## Verified state

- Web preview: https://saymynamesaymyname.vercel.app. Pushes to main automatically
  deploy the frontend; GitHub CI runs the local behavioral checks/build.
- Dedicated Supabase project: `chxlkmmkoadgcaomkznd`, Frankfurt (`eu-central-1`).
- Client configuration contains only the project URL and publishable key. No service
  role key is needed for browser sign-in or private synchronization.
- Private records require both operator beta admission and a current verified Auth
  email. Owner RLS and guarded RPCs enforce this independently of the UI.
- Web client supports signup, email/password login, PKCE confirmation/recovery,
  password update, Google OAuth start and sign-out. Live web Google sign-in passed;
  the user also confirmed recovery/password update and email/password sign-in for
  the admitted account, with the existing cloud reflection preserved.
- User completed Supabase dashboard login on 2026-11-15; Site URL and four exact
  callbacks below were visibly verified saved. Dedicated Google project/client,
  three basic scopes and Supabase Google provider are configured; secret entered
  directly by the user. One explicitly authorized verified tester is admitted.
- Live transactional SQL tests cover approved/duplicate decisions, owner isolation,
  unadmitted users and admitted users whose email is still unverified. All synthetic
  data is rolled back. These tests do not certify actual email delivery. Separate
  live Google/PKCE acceptance and owned reflection save/reload passed on 2026-11-15.

## Current external boundary

Connected Supabase tools can manage database migrations but do not expose Auth
configuration here. The local CLI has no management login. The user has now signed
into the dashboard in the built-in browser. Google configuration and the first
verified tester admission are complete. The user confirmed the reflection in a second
independent browser/device. The fresh-link email recovery/password sign-in retry also
passed after deployment of e02c062, completing this core web walkthrough.
No sibling credentials were copied.

## Dashboard walkthrough and exact values

1. In this project's Auth URL configuration, set Site URL to
   `https://saymynamesaymyname.vercel.app`. Save these four Redirect URLs:

   ```text
   https://saymynamesaymyname.vercel.app/auth/callback
   https://saymynamesaymyname.vercel.app/auth/recovery
   http://127.0.0.1:5174/auth/callback
   http://127.0.0.1:5174/auth/recovery
   ```

   No wildcard previews. These values are saved and verified.
2. Keep email confirmation enabled. Verify email delivery configuration, rate limits
   and recovery templates using current dashboard settings before promising signup.
3. In Google Cloud, select the dedicated `saymynamesaymyname` project. Under Google
   Auth Platform → Overview → Get started, use the temporary app name, the operator's
   support/contact emails and External audience. The user reviews/accepts Google's
   policy. Keep Testing while setting up; add explicitly authorized test users when
   the Test users section is offered. Do not add people to Supabase organization
   membership just to make auth email delivery work.
4. Under Google Auth Platform → Data Access, select only `openid`,
   `https://www.googleapis.com/auth/userinfo.email` and
   `https://www.googleapis.com/auth/userinfo.profile`. No Drive/Calendar scopes.
5. Under Clients → Create client, choose **Web application**, name it `Web beta`.
   Leave **Use this client for an AI-powered agent** unchecked. This client serves
   human Google sign-in. Future Google MCP/agent actions require a separate client;
   the app having an AI bartender does not make this identity client an agent client.
   Authorized JavaScript origins:

   ```text
   https://saymynamesaymyname.vercel.app
   http://127.0.0.1:5174
   ```

   Authorized redirect URI (Google returns to Supabase, not directly to Vercel):

   ```text
   https://chxlkmmkoadgcaomkznd.supabase.co/auth/v1/callback
   ```

6. Create the client, then transfer Client ID and Client Secret directly into this
   project's Supabase Authentication → Sign In / Providers → Google settings. Enable
   the provider and save. The secret belongs only there: never in GitHub, Vercel
   frontend variables, screenshots, app code or chat. Do not skip nonce checks or
   enable users without an email. Keep the Google secret securely; it may only be
   displayed once. Save before leaving Google's creation dialog.
7. Web callback code is implemented. Confirm email templates use Supabase's
   `{{ .ConfirmationURL }}` links with the intended redirect, or adapt deliberately
   to a verified token-hash flow; do not change templates to unsupported routes.
   Email links in this PKCE browser flow must be opened in the initiating browser.
   The built-in SMTP service only sends to the project's authorized team addresses
   and is rate limited; configure dedicated SMTP before inviting other email testers.
   Google sign-in does not depend on our SMTP delivery. Keep email verification on.
8. Admit only a verified, explicitly selected tester by their Auth user UUID through
   an operator-only database action. Never derive admission from client metadata or
   self-service profile fields; the beta table has no client access policy.
9. Run real browser acceptance checks with approved test accounts: confirmation,
   login/logout, reload, two-device private sync, unadmitted rejection, recovery,
   token expiration and account switching. Then test native Android callbacks.

## Test evidence and remaining scope

Live browser acceptance passed for Google consent → PKCE return → admission denial
→ authorized admission → private app load → fictional reflection save → full reload.
A database count independently confirmed one matching owned reflection and fulfilled
check-in, with no duplicate artifact. No personal journal text was used in this test.
The user additionally confirmed that the same reflection appears after Google sign-in
in a second independent browser/device. The exact hardware/browser was not recorded;
this does not certify the native Android wrapper. The first recovery attempt expired
with `flow_state_expired`. After e02c062 deployed, the user confirmed that a fresh link
completed password setup, email/password sign-in worked, and the same reflection
remained visible. Credentials and recovery links stayed with the user throughout.

`npm run test:auth` builds the production frontend with a fictional auth host and
intercepts every auth/data request. It covers signup, PKCE recovery/password update,
pending admission, two-client reflection synchronization, account isolation, Google
basic scopes and failed callback cleanup. It creates no actual accounts or emails.
The live SQL suite separately verifies Supabase ownership/admission rules. Neither
test replaces real email acceptance or real two-device testing. Google, owner-account
email recovery/sign-in and independent-browser/device acceptance have now also been
performed separately as described above. Fresh signup for additional accounts and
broader SMTP delivery remain unverified.

### Email/password acceptance for a Google-first account

Use the same admitted email, not a new account. In a regular browser/profile where
the user can also open their email: sign out of the app, choose Forgot password,
request one recovery email, and open its link in that initiating browser/profile.
Complete this as one continuous test: do not pause between receipt and opening.
Supabase authorization codes are single-use and expire after five minutes. If a
flow expires, start a fresh request rather than revisiting the old callback/link.
The user enters and confirms a new app-specific password privately (12+ characters),
then signs in with email/password and checks that the existing reflection remains.
This changes the app password only; it does not change the Google password.
Never put a password, recovery link or code in chat, screenshots, logs or source.
An owner-address email test does not certify delivery to other testers; verify SMTP
configuration, recipient restrictions and rate limits before broader email signup.

Callbacks preserve `sb_flow_id` before cleaning the address bar and pass it explicitly
to `exchangeCodeForSession`. This retains the correct SDK verifier slot when multiple
flows/tabs exist. Never fall back to another flow's verifier or disable PKCE to recover.

For `invalid_client`, verify that Supabase holds the full Client Secret value from
the same Google client as its Client ID; a Secret ID or masked value is insufficient.
Correct it directly in the provider form, then start a fresh app sign-in flow.
Never reload or manually navigate to an old provider callback URL to test OAuth.

This is web auth. A native Android build/system-browser return path remains M5 work;
do not add unimplemented custom-scheme callbacks or claim Android OAuth is complete.

Sources checked: [Supabase Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google),
[password auth](https://supabase.com/docs/guides/auth/passwords),
[PKCE expiry/browser requirements](https://supabase.com/docs/guides/auth/sessions/pkce-flow),
[SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp), and
[Google consent setup](https://developers.google.com/workspace/guides/configure-oauth-consent).
Google's [OAuth client guidance](https://support.google.com/cloud/answer/15549257)
requires separating standard user features from Google agent/MCP workflows.

## Cloud sync scope

The current cloud client synchronizes private profile preferences, relationship
labels, manual mock check-ins and approved reflection entries. It does not yet
provide sharing, relationship membership, full account deletion/export, offline
conflict resolution, live AI, automatic cloud scheduling or remote notifications.
Those remain explicit Phase 0/1 milestones; do not use sensitive real content yet.

The local scheduling engine is a tested SQLite adapter. Its worker must be ported
to leased Supabase jobs and deployed in Frankfurt before claiming hosted scheduling.
