#!/bin/bash
set -e  # Exit on error

echo "========================================="
echo "  Production Deployment Script"
echo "========================================="
echo ""

# Configuration
PROJECT_DIR="/var/www/track.vihais.com/time-tracker"
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml"
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Navigate to project directory
cd "$PROJECT_DIR"

# Step 1: Create backup
echo -e "${YELLOW}[1/6] Creating backup...${NC}"
mkdir -p "$BACKUP_DIR"

if docker-compose $COMPOSE_FILES exec -T db pg_dump -U timetracker timetracker | gzip > "$BACKUP_DIR/database_backup.sql.gz"; then
    echo -e "${GREEN}✓ Database backup created: $BACKUP_DIR/database_backup.sql.gz${NC}"
else
    echo -e "${RED}✗ Backup failed! Aborting deployment.${NC}"
    exit 1
fi

# Step 2: Pull latest changes
echo -e "${YELLOW}[2/6] Pulling latest changes from git...${NC}"
git pull origin main
echo -e "${GREEN}✓ Code updated${NC}"

# Step 3: Stop containers
echo -e "${YELLOW}[3/6] Stopping containers...${NC}"
docker-compose $COMPOSE_FILES down
echo -e "${GREEN}✓ Containers stopped${NC}"

# Step 4: Build new images
echo -e "${YELLOW}[4/6] Building new images...${NC}"
docker-compose $COMPOSE_FILES build --no-cache
echo -e "${GREEN}✓ Images built${NC}"

# Step 5: Start containers
echo -e "${YELLOW}[5/6] Starting containers...${NC}"
docker-compose $COMPOSE_FILES up -d
echo -e "${GREEN}✓ Containers started${NC}"

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
sleep 5

# Step 6: Check status
echo -e "${YELLOW}[6/6] Checking container status...${NC}"
docker-compose $COMPOSE_FILES ps

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "Backup saved to: ${YELLOW}$BACKUP_DIR${NC}"
echo ""
echo "To view logs, run:"
echo "  docker-compose $COMPOSE_FILES logs -f --tail=50"
echo ""
echo "To restore backup if needed, run:"
echo "  gunzip < $BACKUP_DIR/database_backup.sql.gz | docker-compose $COMPOSE_FILES exec -T db psql -U timetracker timetracker"
echo ""
