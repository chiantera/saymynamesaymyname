# CI

workflows/check.yml validates on push/PR using Node 24, Python 3.12 and a disposable
Postgres service. It runs catalogs/unit/build checks, real SQL tests and sequential
Auth/membership/sharing/schedule browser tests. No production credentials or real
provider calls are used. Main pushes also trigger Vercel Git deployment separately.
