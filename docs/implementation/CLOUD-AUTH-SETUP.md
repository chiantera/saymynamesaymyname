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
  password update, Google OAuth start and sign-out. Live provider acceptance is pending.
- User completed Supabase dashboard login on 2026-11-15; Site URL and four exact
  callbacks below were visibly verified saved. Dedicated Google project selected.
- Live transactional SQL tests cover approved/duplicate decisions, owner isolation,
  unadmitted users and admitted users whose email is still unverified. All synthetic
  data is rolled back. These tests do not certify actual email delivery or OAuth.

## Current external boundary

Connected Supabase tools can manage database migrations but do not expose Auth
configuration here. The local CLI has no management login. The user has now signed
into the dashboard in the built-in browser. Google consent/client configuration and
real test-account admission are still in progress. No sibling credentials were copied.

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

`npm run test:auth` builds the production frontend with a fictional auth host and
intercepts every auth/data request. It covers signup, PKCE recovery/password update,
pending admission, two-client reflection synchronization, account isolation, Google
basic scopes and failed callback cleanup. It creates no actual accounts or emails.
The live SQL suite separately verifies Supabase ownership/admission rules. Neither
test replaces real email/Google acceptance or real two-device testing.

This is web auth. A native Android build/system-browser return path remains M5 work;
do not add unimplemented custom-scheme callbacks or claim Android OAuth is complete.

Sources checked: [Supabase Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google),
[password auth](https://supabase.com/docs/guides/auth/passwords),
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
