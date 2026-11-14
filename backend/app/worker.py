"""Local demo worker; separate process, durable SQLite test adapter, no network AI."""
import argparse
import os
import time
from pathlib import Path

from .repository import ROOT, Repository, work_once


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    if os.environ.get("ALLOW_LOCAL_DEMO") != "1" or os.environ.get("APP_ENV") != "development":
        raise SystemExit("Local demo worker needs APP_ENV=development and ALLOW_LOCAL_DEMO=1.")
    repo = Repository(Path(os.environ.get("DEMO_DATABASE_PATH", str(ROOT / ".local" / "demo.sqlite"))))
    last_dispatch = 0.0
    while True:
        if time.monotonic()-last_dispatch >= 60:
            repo.dispatch_due()
            last_dispatch=time.monotonic()
        work_once(repo)
        if args.once:
            return
        time.sleep(1)


if __name__ == "__main__":
    main()
