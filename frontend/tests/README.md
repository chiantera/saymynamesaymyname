# Pure client tests

`npm test` checks catalog/source contracts and runs Node tests with TypeScript
stripping. Tests cover locale/decision rules, invitation/auth links, wall-clock
rendering, polling serialization/backoff/visibility, curated support resources and
security policy/fixture isolation. Counts are printed by the test runner.

No real account or processor is used. Production browser fixtures additionally
exercise auth/sharing and CSP enforcement; native/device behavior requires its
own checks. [Commands and prerequisites](../../docs/TESTING.md).
