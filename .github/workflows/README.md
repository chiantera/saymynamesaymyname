# Workflows

check.yml runs the validation pipeline. Keep database tests pointed only at the
local CI Postgres service. Browser suites rebuild the same frontend output and must
stay sequential. Vercel Git deployment is external; a green CI job alone is not
proof that the production alias serves the commit.
