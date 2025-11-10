#!/usr/bin/env bash
set -euo pipefail

usage() {
    cat <<'EOF'
Usage: cancel_running_projects.sh [-d path/to/aim.db] [-r "reason"]

Options:
  -d, --db       Path to the SQLite database (defaults to $DATABASE_PATH or ./aim.db)
  -r, --reason   Reason stored in the projects.error column
  -h, --help     Show this help text
EOF
}

DB_PATH="${DATABASE_PATH:-aim.db}"
REASON="Manually canceled via script"

while [[ $# -gt 0 ]]; do
    case "$1" in
        -d|--db)
            [[ $# -lt 2 ]] && { echo "error: missing value for $1" >&2; exit 1; }
            DB_PATH="$2"
            shift 2
            ;;
        -r|--reason)
            [[ $# -lt 2 ]] && { echo "error: missing value for $1" >&2; exit 1; }
            REASON="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "error: unknown argument $1" >&2
            usage
            exit 1
            ;;
    esac
done

if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "error: sqlite3 is required but not installed" >&2
    exit 1
fi

if [[ ! -f "$DB_PATH" ]]; then
    echo "error: database file '$DB_PATH' not found" >&2
    exit 1
fi

timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
escaped_reason="${REASON//\'/\'\'}"
escaped_timestamp="${timestamp//\'/\'\'}"

rows=$(sqlite3 -batch -noheader "$DB_PATH" <<SQL
BEGIN;
UPDATE projects
SET status='canceled',
    error='${escaped_reason}',
    last_active='${escaped_timestamp}'
WHERE status='running';
SELECT changes();
COMMIT;
SQL
)

rows="$(echo "$rows" | tail -n1)"
echo "Marked ${rows:-0} running project(s) as canceled in '$DB_PATH'."
