#!/usr/bin/env bash
#
# Dumps the Supabase database using pg_dump directly.
#
# `supabase db dump` runs pg_dump inside a Docker container to guarantee a
# version match. That means installing Docker Desktop just to take a backup,
# which is a lot of machinery for one command. Calling pg_dump ourselves needs
# only the Postgres client tools (~50 MB via `brew install libpq`).
#
set -euo pipefail

cd "$(dirname "$0")/.."

# Homebrew keeps libpq keg-only, so pg_dump is usually not on PATH.
if ! command -v pg_dump >/dev/null 2>&1; then
  for candidate in /opt/homebrew/opt/libpq/bin /usr/local/opt/libpq/bin; do
    [ -x "$candidate/pg_dump" ] && export PATH="$candidate:$PATH" && break
  done
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  cat <<'MSG' >&2
pg_dump not found.

Install the Postgres client tools (no Docker, no Postgres server needed):

    brew install libpq
    echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc
    source ~/.zshrc

MSG
  exit 1
fi

# The connection string lives in .env.local, which is git-ignored. It contains
# the database password, so it must never be committed or passed on the command
# line where it would land in shell history.
if [ -f .env.local ]; then
  set -a; . ./.env.local; set +a
fi

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  cat <<'MSG' >&2
SUPABASE_DB_URL is not set.

Click Connect at the top of the Supabase dashboard, choose the Session pooler tab,
then add this line to .env.local:

    SUPABASE_DB_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"

Use the SESSION POOLER on port 5432. Two traps:
  * The direct connection (db.<ref>.supabase.co) is IPv6-only on the free tier
    and will simply time out on most home networks.
  * The TRANSACTION pooler on port 6543 breaks pg_dump's COPY protocol — it
    hangs or fails with a protocol error rather than saying anything useful.

MSG
  exit 1
fi

case "$SUPABASE_DB_URL" in
  *:6543/*)
    echo "Refusing to run: that is the transaction pooler (port 6543)." >&2
    echo "pg_dump needs the session pooler on port 5432." >&2
    exit 1
    ;;
esac

mkdir -p backups
OUT="backups/asy-$(date +%Y%m%d-%H%M).sql"

echo "Dumping data to $OUT ..."

# --data-only: the schema lives in supabase/migrations and in git. Dumping both
#   would create two sources of truth for the structure.
# --no-owner / --no-privileges: role names differ between projects, and keeping
#   them makes the dump fail to restore anywhere else.
# Capture stderr so a failure can be explained rather than left as a raw
# Postgres message, which rarely names the actual cause.
ERRLOG=$(mktemp)
if ! pg_dump "$SUPABASE_DB_URL" \
  --data-only \
  --no-owner \
  --no-privileges \
  --exclude-schema='auth|storage|graphql|graphql_public|realtime|supabase_functions|extensions|vault|pgbouncer|net|cron' \
  --file "$OUT" 2>"$ERRLOG"
then
  ERR=$(cat "$ERRLOG")
  rm -f "$ERRLOG" "$OUT"
  echo "$ERR" >&2
  echo >&2

  case "$ERR" in
    *"Tenant or user not found"*|*"tenant/user"*|*ENOTFOUND*)
      cat >&2 <<'MSG'
--------------------------------------------------------------------
The pooler could not find your project on that host.

The project ref is embedded in the USERNAME (postgres.<ref>), and the
region is in the HOSTNAME. Both must match, and the region prefix
differs per project (aws-0 / aws-1 / etc).

Copy the string verbatim from the Supabase dashboard rather than
editing an example: click Connect at the top, choose Session pooler,
and change only [YOUR-PASSWORD].
--------------------------------------------------------------------
MSG
      ;;
    *"password authentication failed"*)
      cat >&2 <<'MSG'
--------------------------------------------------------------------
Wrong database password.

This is NOT your Supabase account password, nor any API key. It is the
database password set when the project was created. If you do not have
it: Project Settings -> Database -> Reset database password. Nothing in
the app uses it, so resetting is safe.

Special characters must be percent-encoded in a URL: @ becomes %40,
# becomes %23, / becomes %2F.
--------------------------------------------------------------------
MSG
      ;;
    *"timeout"*|*"could not connect"*|*"No route to host"*|*"Network is unreachable"*)
      cat >&2 <<'MSG'
--------------------------------------------------------------------
Could not reach the server.

The most likely cause is the DIRECT connection string, which is
IPv6-only on the free tier and simply times out on most home networks.
The host must contain "pooler.supabase.com", not "db.<ref>.supabase.co".
--------------------------------------------------------------------
MSG
      ;;
    *"server version"*|*"aborting because of server version mismatch"*)
      cat >&2 <<'MSG'
--------------------------------------------------------------------
pg_dump is older than the server.

    brew upgrade libpq

Then confirm the newer one is first on PATH: pg_dump --version
--------------------------------------------------------------------
MSG
      ;;
  esac
  exit 1
fi
rm -f "$ERRLOG"

SIZE=$(ls -lh "$OUT" | awk '{print $5}')

echo
echo "Wrote $OUT ($SIZE)"
echo

# pg_dump emits one COPY block per table with every row inside it, so counting
# statements says nothing about whether data actually came down. Count the rows
# between each COPY and its terminating backslash-dot instead — that is the
# number worth seeing.
awk '
  /^COPY /   { t=$2; sub(/^public\./, "", t); n=0; inblock=1; next }
  inblock && /^\\\.$/ { printf "  %-22s %6d\n", t, n; inblock=0; next }
  inblock    { n++ }
' "$OUT" | sort -k2 -rn

TOTAL=$(awk '/^COPY /{i=1;next} /^\\\.$/{i=0} i{n++} END{print n+0}' "$OUT")
echo
echo "  total rows: $TOTAL"

if [ "$TOTAL" -eq 0 ]; then
  echo
  echo "WARNING: the dump contains no rows. It connected, but nothing came back." >&2
  echo "Check you are pointed at the right project before relying on this file." >&2
  exit 1
fi

echo
echo "Reminder: keep a copy somewhere other than this MacBook."
echo "A backup that only exists on the machine being backed up is not a backup."
