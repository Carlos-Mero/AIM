#!/bin/bash

# This script migrates the AIM database to ensure all project configurations
# include a 'reviewer' field. Old projects that lack this field will have it
# set to "simple", which corresponds to the previous default reviewer behavior.
#
# Usage:
#   ./scripts/migrate_reviewer.sh [DB_PATH]
#
#   DB_PATH: Optional. Path to the SQLite database file (e.g., "aim.db").
#            Defaults to "aim.db" in the current directory if not provided.
#
# Requirements:
#   - sqlite3 command-line tool
#   - jq command-line JSON processor (for older SQLite versions or if json_extract/json_set are not available)

DB_PATH=${1:-"aim.db"}

# --- Sanity Checks ---
if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database file '$DB_PATH' does not exist."
    exit 1
fi

if ! command -v sqlite3 &> /dev/null; then
    echo "Error: 'sqlite3' command not found. Please install SQLite."
    exit 1
fi

echo "Starting database migration for: $DB_PATH"

# --- Determine SQLite Version for JSON functions ---
# SQLite JSON functions (json_extract, json_set) are available from version 3.38.0.
SQLITE_VERSION_STRING=$(sqlite3 --version | awk '{print $1}')
REQUIRED_JSON_VERSION="3.38.0"

# Function to compare versions (major.minor.patch)
# Returns 0 if version1 >= version2, 1 otherwise
version_ge() {
    [ "$(printf '%s\n' "$1" "$2" | sort -V | head -n 1)" = "$2" ]
}

if version_ge "$SQLITE_VERSION_STRING" "$REQUIRED_JSON_VERSION"; then
    echo "SQLite version $SQLITE_VERSION_STRING supports JSON functions. Using optimized migration."
    # Optimized update for modern SQLite versions
    sqlite3 "$DB_PATH" "
        UPDATE projects
        SET config = json_set(config, '$.reviewer', 'simple')
        WHERE json_extract(config, '$.reviewer') IS NULL OR json_extract(config, '$.reviewer') = '';
    "
    UPDATED_COUNT=$(sqlite3 "$DB_PATH" "SELECT changes();")
    echo "Migration completed. Updated $UPDATED_COUNT projects."
else
    echo "SQLite version $SQLITE_VERSION_STRING is older than $REQUIRED_JSON_VERSION. Using bash/jq fallback."
    if ! command -v jq &> /dev/null; then
        echo "Error: 'jq' command not found, and SQLite version is too old for built-in JSON functions."
        echo "Please install 'jq' (e.g., 'brew install jq' on macOS, 'sudo apt-get install jq' on Debian/Ubuntu)."
        exit 1
    fi

    UPDATED_COUNT=0

    # Export IDs and config JSON strings, using tab as separator
    echo -e ".mode list\n.separator '\\t'\nSELECT id, config FROM projects;" | sqlite3 "$DB_PATH" | \
    while IFS=$'\t' read -r PROJECT_ID CONFIG_STR; do
        # Check if 'reviewer' field exists or is empty in the JSON string using jq
        # -e: exit 1 if expression fails (e.g., key not found)
        # Using `.` to parse as string and then re-evaluate with `jq` to ensure it's JSON
        if ! echo "$CONFIG_STR" | jq -e '.reviewer' &> /dev/null || [ "$(echo "$CONFIG_STR" | jq -r '.reviewer')" == "" ]; then
            echo "Updating project $PROJECT_ID: setting 'reviewer': 'simple'"
            NEW_CONFIG_STR=$(echo "$CONFIG_STR" | jq '.reviewer = "simple"')

            # Sanitize single quotes for SQL UPDATE statement
            NEW_CONFIG_STR_SQL=$(echo "$NEW_CONFIG_STR" | sed "s/'/''/g")

            sqlite3 "$DB_PATH" "UPDATE projects SET config = '$NEW_CONFIG_STR_SQL' WHERE id = $PROJECT_ID;"
            UPDATED_COUNT=$((UPDATED_COUNT+1))
        fi
    done
    echo "Migration completed. Updated $UPDATED_COUNT projects."
fi
