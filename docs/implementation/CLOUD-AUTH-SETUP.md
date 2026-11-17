# Cloud authentication setup

## Current scope and evidence

Web email/password and Google identity, verified beta admission, PKCE recovery and
private reflection sync are implemented. Bounded live acceptance previously verified
core login/recovery and a second browser/device; current automated fixtures intercept
Auth transport and do not re-prove live email/OAuth configuration. See
[current status](../../CURRENT-TASK.md) and [milestones](../CHANGELOG.md).

Beta admission is operator-controlled and separate from relationship invitation.
Owner RLS and guarded RPCs require current verified identity/admission. A Google
identity grants no Drive or Calendar access. Native Android return paths, broader
signup/email delivery, MFA/session recovery and lifecycle release testing remain open.

## Client and callback configuration

The client receives only `VITE_SUPABASE_URL` and a publishable key. No service-role
or provider secret belongs in the browser. Keep CSP's project connection origin in
`vercel.json` aligned with the configured Supabase project; do not loosen it to a
wildcard. [Header contract](SECURITY-HEADERS.md).

For this web deployment, set Site URL to `https://saymynamesaymyname.vercel.app` and
allow these exact redirects, without wildcards:

```text
https://saymynamesaymyname.vercel.app/auth/callback
https://saymynamesaymyname.vercel.app/auth/recovery
http://127.0.0.1:5174/auth/callback
http://127.0.0.1:5174/auth/recovery
```

Keep email confirmation enabled. Verify actual SMTP delivery, templates, rate limits
and recipient restrictions before admitting a wider cohort. Local/CI tests do not
send mail or modify hosted auth configuration.

## Google identity setup

Use the dedicated Google Cloud project and an External consent audience. The
operator reviews Google's policy and supplies support/contact emails directly in
the dashboard. Keep the appropriate testing audience/test users during setup.
Select only `openid`, `https://www.googleapis.com/auth/userinfo.email` and
`https://www.googleapis.com/auth/userinfo.profile`.

Create a **Web application** client. Leave **Use this client for an AI-powered
agent** unchecked; human identity and future Google MCP/agent actions use separate
clients. Authorized JavaScript origins are the production origin and local
`http://127.0.0.1:5174`. Google returns to Supabase at:

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

Replace the placeholder from the actual project dashboard. Transfer the matching
Client ID and full Client Secret directly into Supabase's Google provider form.
Enable Google sign-in, leave Skip nonce checks and Allow users without an email
off, then save. Never place the secret in Git, chat, logs, screenshots or `VITE_*`.

## Recovery and identity guards

Use Supabase-supported confirmation/recovery templates with the intended redirect.
The web PKCE flow must open the newest recovery link in the browser/profile that
requested it. Preserve `sb_flow_id` before URL cleanup and pass it explicitly when
exchanging the code; a missing/expired flow cannot borrow another tab's verifier.
Do not disable PKCE/nonce checks to make a test pass.

The app's password update is separate from the Google password. Confirm recovery,
email/password sign-in and preservation of owned reflections with an authorized
test account. Never record passwords or recovery links in the evidence log.
For `invalid_client`, correct the matching full Google secret in Supabase, then
start a fresh sign-in flow rather than replaying an old callback URL.

AuthGate keys cloud/preview instances by account. Cloud operations verify identity
and account generation before/after results; batches do not replace server RLS or
sensitive-action authorization. Sign-out/account changes must not retain another
account's visible private content or reveal an old safety notice.

[Supabase Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google),
[password auth](https://supabase.com/docs/guides/auth/passwords),
[PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow),
[Google consent](https://developers.google.com/workspace/guides/configure-oauth-consent).
