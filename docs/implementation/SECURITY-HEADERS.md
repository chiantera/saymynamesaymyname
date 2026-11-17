# Browser security headers

`vercel.json` applies an enforced policy to every path, including SPA callbacks and
static assets. Browser preview fixtures serve the same headers over HTTP; Vite's
development server retains its normal development behavior.

- CSP defaults to no sources. Scripts and stylesheets/fonts load from this origin;
  inline scripts, script attributes, eval, objects, frames, embedded parents and
  base URL injection are blocked. Forms submit only to this origin. Supabase
  connections are restricted to the configured project HTTPS/WebSocket origin.
  Provider APIs are not browser connection targets.
- React's dynamic style attributes (including the day band) remain allowed.
  `style-src-elem` still restricts stylesheets/style elements to this origin;
  `style-src-attr` permits inline attributes. The broader inline-style fallback is
  for older CSP implementations, not an inline-script exception.
- HSTS uses a one-year max age, without preload or a new subdomain commitment.
  `X-Frame-Options: DENY` backs up `frame-ancestors 'none'`.
- `Referrer-Policy: no-referrer` extends the existing document meta policy to the
  response. `X-Content-Type-Options: nosniff` prevents MIME sniffing.
- Permissions Policy disables unused camera, microphone, location, payment, USB,
  MIDI and motion features. Future voice/native capabilities need an explicit
  reviewed policy/permission change; they are not enabled by this milestone.

No CSP reports or new telemetry endpoints receive URLs or private context. These
headers are defense in depth, not a replacement for authorization, RLS, consent,
output escaping or the server's safety/lease/budget gates. Live AI stays disabled.
Google sign-in is a top-level redirect, so no Google script/iframe source is added.
Self-hosted fonts, local resources and the neutral quick exit continue to work.

## Tests and deployment checks

Unit checks validate the production policy and fixture isolation. The Vite preview
helper changes only the connection origin for the two explicitly allowlisted
`.example.invalid` auth fixtures; it never changes the published policy. An
unrecognized fixture origin is refused. No test uses `bypass_csp`.

The production-build auth browser checks actual response headers, attempts a DOM
inline script and an intercepted forbidden fetch, verifies blocked sensitive
permissions and tries to frame the app from a local unprotected parent. Auth,
recovery, Google redirect, account isolation and polling run with CSP enforced.
The SQL-backed membership/sharing/revocation suite also runs under that policy.
Accessibility instrumentation runs through the test DevTools channel rather than
loosening CSP or injecting an allowed inline script into the app.

After each push, check CI and the exact production commit, then fetch the root,
callback and asset responses to confirm actual hosted headers and HTTP success.
Do not infer hosted header behavior from configuration alone. An auth-protection
interstitial is not the application response; use authenticated Vercel access and
keep any temporary bypass URL/cookie out of docs and logs.

References: [Vercel security headers](https://vercel.com/docs/cdn-security/security-headers),
[CSP directives](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy).
