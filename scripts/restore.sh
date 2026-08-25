#!/usr/bin/env bash
#
# Restores a data-only backup, refusing to run against a database that already
# holds records.
#
# Why the guard matters: every id in this schema is a random UUID, so restoring
# an old dump into a populated database does NOT collide. The rows simply
# append. You would end up with two sets of customers silently merged, and
# nothing would error to tell you.
#
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v psql >/dev/null 2>&1; then
  for candidate in /opt/homebrew/opt/libpq/bin /usr/local/opt/libpq/bin; do
    [ -x "$candidate/psql" ] && export PATH="$candidate:$PATH" && break
  done
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install with: brew install libpq" >&2
  exit 1
fi

FILE="${1:-}"
if [ -z "$FILE" ]; then
  echo "Usage: npm run db:restore -- backups/asy-YYYYMMDD-HHMM.sql" >&2
  echo >&2
  echo "Available:" >&2
  ls -lh backups/*.sql 2>/dev/null | sed 's/^/  /' >&2 || echo "  (none)" >&2
  exit 1
fi

[ -f "$FILE" ] || { echo "No such file: $FILE" >&2; exit 1; }

if [ -f .env.local ]; then set -a; . ./.env.local; set +a; fi
[ -n "${SUPABASE_DB_URL:-}" ] || { echo "SUPABASE_DB_URL is not set. See docs/BACKUP.md" >&2; exit 1; }

# ─── Refuse to append into a populated database ────────────────────────────
EXISTING=$(psql "$SUPABASE_DB_URL" -tAc "
  select (select count(*) from customers)
       + (select count(*) from treatments)
       + (select count(*) from ledger_entries)")

if [ "${EXISTING:-0}" -ne 0 ]; then
  cat >&2 <<MSG

Refusing to restore: the target database already holds $EXISTING rows across
customers, treatments and ledger_entries.

Restoring on top would NOT overwrite them. Ids are random UUIDs, so the old
rows would append and you would silently end up with two merged sets of
clients.

If you genuinely want to replace the contents, clear it first:

    psql "\$SUPABASE_DB_URL" -f scripts/clear-test-data.sql

(that script has its own safety block you must remove by hand), then re-run
this restore.

MSG
  exit 1
fi

# ─── Show what is about to go in ──────────────────────────────────────────
echo "Restoring $FILE into the database in SUPABASE_DB_URL"
echo
awk '
  /^COPY /   { t=$2; sub(/^public\./, "", t); n=0; inblock=1; next }
  inblock && /^\\\.$/ { printf "  %-22s %6d\n", t, n; inblock=0; next }
  inblock    { n++ }
' "$FILE" | sort -k2 -rn
echo

printf 'Type RESTORE to proceed: '
read -r CONFIRM
[ "$CONFIRM" = "RESTORE" ] || { echo "Aborted."; exit 1; }

psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$FILE"

echo
echo "Restored. Verifying:"
psql "$SUPABASE_DB_URL" -c "
  select 'customers' as table_name, count(*) from customers
  union all select 'treatments', count(*) from treatments
  union all select 'followup_nodes', count(*) from followup_nodes
  union all select 'ledger_entries', count(*) from ledger_entries
  union all select 'stock_movements', count(*) from stock_movements
  order by 1"
