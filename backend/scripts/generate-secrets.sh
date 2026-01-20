#!/bin/bash
# Generate cryptographically secure secrets for JWT, session, and admin password
# Usage: ./scripts/generate-secrets.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SECRETS_DIR="$BACKEND_DIR/secrets"

echo "🔐 Generating secrets for time-tracker backend..."
echo ""

# Create secrets directory
mkdir -p "$SECRETS_DIR"

# Generate JWT secret (64 bytes = 128 hex characters)
echo "Generating JWT secret (64 bytes)..."
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" > "$SECRETS_DIR/jwt_secret.txt"

# Generate session secret (32 bytes = 64 hex characters)
echo "Generating session secret (32 bytes)..."
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" > "$SECRETS_DIR/session_secret.txt"

# Generate admin password hash with bcrypt
echo ""
echo "Setting up admin password..."
read -sp "Enter admin password: " ADMIN_PASSWORD
echo ""

if [ -z "$ADMIN_PASSWORD" ]; then
  echo "❌ Error: Password cannot be empty"
  exit 1
fi

# Hash password with bcrypt (12 rounds)
echo "Hashing password with bcrypt (12 rounds)..."
node -e "
const bcrypt = require('bcrypt');
const password = process.argv[1];
bcrypt.hash(password, 12).then(hash => {
  console.log(hash);
}).catch(err => {
  console.error('Error hashing password:', err.message);
  process.exit(1);
});
" "$ADMIN_PASSWORD" > "$SECRETS_DIR/admin_password_hash.txt"

# Set secure file permissions (owner read/write only)
chmod 600 "$SECRETS_DIR/jwt_secret.txt"
chmod 600 "$SECRETS_DIR/session_secret.txt"
chmod 600 "$SECRETS_DIR/admin_password_hash.txt"

echo ""
echo "✅ Secrets generated successfully in $SECRETS_DIR/"
echo ""
echo "Files created:"
echo "  - jwt_secret.txt (128 characters)"
echo "  - session_secret.txt (64 characters)"
echo "  - admin_password_hash.txt (bcrypt hash)"
echo ""
echo "⚠️  IMPORTANT SECURITY NOTES:"
echo "  1. Add 'secrets/' to .gitignore (DO NOT commit secrets!)"
echo "  2. File permissions set to 600 (owner read/write only)"
echo "  3. Keep these files secure and backed up separately"
echo ""
echo "For Docker deployment, these files will be mounted as Docker Secrets."
echo ""
