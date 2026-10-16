#!/bin/sh
# Container entrypoint: fix a common mount mistake, hand data folders to the unprivileged "node" user, then drop root.
set -e

DB="${DB_PATH:-/app/quotes.db}"

# Docker turns a missing bind-mounted FILE into an empty DIRECTORY. Say so clearly instead of crashing later.
if [ -d "$DB" ]; then
  echo "ERROR: $DB is a directory. Docker created it because the host file did not exist." >&2
  echo "Fix: stop the container, remove that directory on the host, create an empty file (touch quotes.db) or" >&2
  echo "mount a data folder and set DB_PATH=/app/data/quotes.db (see docker-compose.yml)." >&2
  exit 1
fi

if [ "$(id -u)" = "0" ]; then
  # Existing installs often have root-owned bind mounts; make the data writable for the app user, then drop privileges.
  mkdir -p /app/uploads /app/backups "$(dirname "$DB")"
  for p in "$DB" "$DB-wal" "$DB-shm" /app/uploads /app/backups /app/error.log; do
    [ -e "$p" ] && chown -R node:node "$p" 2>/dev/null || true
  done
  chown node:node "$(dirname "$DB")" /app 2>/dev/null || true
  exec runuser -u node -- "$@"
fi

exec "$@"
