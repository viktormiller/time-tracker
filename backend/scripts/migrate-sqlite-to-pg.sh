#!/bin/bash
set -e

# Configuration
SQLITE_PATH="${SQLITE_PATH:-./backend/dev.db}"
DATABASE_URL="${DATABASE_URL:?DATABASE_URL environment variable required}"

echo "==================================="
echo "SQLite to PostgreSQL Migration"
echo "==================================="
echo "Source: ${SQLITE_PATH}"
echo "Target: ${DATABASE_URL}"
echo ""

# Check if SQLite database exists
if [ ! -f "${SQLITE_PATH}" ]; then
  echo "Error: SQLite database not found at ${SQLITE_PATH}"
  exit 1
fi

# Check if pgloader is installed
if ! command -v pgloader &> /dev/null; then
  echo "Error: pgloader is not installed"
  echo "Install with: brew install pgloader (macOS) or apt-get install pgloader (Linux)"
  exit 1
fi

# Parse PostgreSQL URL components for validation
# Basic validation - just check format
if [[ ! "${DATABASE_URL}" =~ ^postgresql:// ]]; then
  echo "Error: DATABASE_URL must start with postgresql://"
  exit 1
fi

# Create pgloader configuration
cat > /tmp/migrate.load << EOF
LOAD DATABASE
  FROM sqlite://${SQLITE_PATH}
  INTO ${DATABASE_URL}

WITH include drop, create tables, create indexes, reset sequences,
     encoding 'utf-8'

SET work_mem to '256MB', maintenance_work_mem to '512MB'

CAST type integer when (= precision 1) to boolean drop typemod;

EOF

echo "Starting migration..."
echo ""

# Run pgloader
if pgloader /tmp/migrate.load; then
  echo ""
  echo "==================================="
  echo "Migration completed successfully"
  echo "==================================="

  # Backup SQLite file
  echo ""
  echo "Creating backup of SQLite database..."
  mv "${SQLITE_PATH}" "${SQLITE_PATH}.backup"
  echo "SQLite backup created at ${SQLITE_PATH}.backup"

  # Run validation script
  echo ""
  echo "Running post-migration validation..."
  cd backend && npx ts-node ./scripts/validate-migration.ts

else
  echo ""
  echo "==================================="
  echo "Migration failed"
  echo "==================================="
  echo "SQLite database unchanged"
  exit 1
fi
