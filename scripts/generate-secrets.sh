#!/bin/bash
# Generate production secrets for Docker deployment
# Run this once before first production deployment

set -e

SECRETS_DIR="docker/secrets"

# Create secrets directory if not exists
mkdir -p "$SECRETS_DIR"

echo "Generating production secrets..."

# JWT secret (64 bytes, base64 encoded)
openssl rand -base64 64 | tr -d '\n' > "$SECRETS_DIR/jwt_secret"
echo "Generated jwt_secret"

# Session secret (32 bytes, hex encoded for libsodium)
openssl rand -hex 32 > "$SECRETS_DIR/session_secret"
echo "Generated session_secret"

# Database password (32 random characters)
openssl rand -base64 32 | tr -d '\n' > "$SECRETS_DIR/db_password"
echo "Generated db_password"

# Admin password - prompt user
echo ""
echo "Enter admin password for login:"
read -s ADMIN_PASSWORD

if [ -z "$ADMIN_PASSWORD" ]; then
    echo "Error: Password cannot be empty"
    exit 1
fi

# Generate bcrypt hash using Node.js (bcrypt is already a dependency)
cd backend
HASH=$(node -e "require('bcrypt').hash('$ADMIN_PASSWORD', 12).then(h => console.log(h))")
cd ..
echo "$HASH" > "$SECRETS_DIR/admin_password_hash"
echo "Generated admin_password_hash"

# Secure file permissions
chmod 600 "$SECRETS_DIR"/*

echo ""
echo "Secrets generated successfully in $SECRETS_DIR/"
echo "IMPORTANT: Keep these files secure and never commit them to git!"
