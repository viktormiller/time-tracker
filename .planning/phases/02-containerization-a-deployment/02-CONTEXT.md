# Phase 2: Containerization & Deployment - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the authenticated time tracker application to production using Docker containers on Hetzner infrastructure. Application runs in separate containers (frontend, backend, database) with proper orchestration, secret management, and deployment workflow.

</domain>

<decisions>
## Implementation Decisions

### Container strategy
- Build images directly on Hetzner server (no registry needed for single-server deployment)
- Claude's discretion on multi-stage builds, base image selection (alpine vs slim), and layer caching optimization

### Service orchestration
- Reverse proxy (nginx) routes requests: serves frontend static files, proxies /api to backend
- Custom bridge network for service discovery (services reference each other by name)
- Claude's discretion on startup dependencies (health checks vs retry logic) and restart policies

### Secrets management
- Different approaches for dev and prod: .env files for development, Docker Secrets for production
- Periodic secret rotation (quarterly schedule) with documented procedure
- Claude's discretion on initial secret generation/storage method and backup strategy

### Deployment workflow
- Tagged rollback capability maintained (tag working versions for quick rollback)
- Brief downtime acceptable during deployments (1-2 min) — stop, update, restart workflow
- Standard Docker logs only (no persistent log files, use docker-compose logs for debugging)
- Claude's discretion on deployment method (git pull + rebuild, CI/CD, or manual)

</decisions>

<specifics>
## Specific Ideas

- Single-server Hetzner deployment (not distributed/clustered)
- Nginx handles both static file serving and API proxying
- Development continues to use existing .env pattern established in Phase 1

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-containerization-a-deployment*
*Context gathered: 2026-01-21*
