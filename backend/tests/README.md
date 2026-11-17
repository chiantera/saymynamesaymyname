# Backend unit tests

Run `npm run test:backend` at the root. These tests use fictional local state and
mocked processor/assessment interfaces. They cover API guards, check-in decisions,
scheduling, committed accounting, disabled worker configuration and fail-closed
safety/crisis routing. Starlette TestClient uses the retained `httpx2` dependency.

They prove code mechanics, not provider terms, clinical quality, hosted email,
real-device behavior or live AI activation. Real SQL/RLS fixtures are separate in
[dbtests](../dbtests/README.md). [Commands and evidence limits](../../docs/TESTING.md).
