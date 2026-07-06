# Production Deployment

The deploy host is at `/var/www/track.vihais.com/time-tracker`. From there:

```bash
./deploy-prod.sh
```

The script disk-checks → `pg_dump` backup → `git pull origin main` → `docker compose down/build/up` → status report. It uses **docker compose v2** (`docker compose`, space — not the hyphenated v1).

## Adding a new API-token sync provider

Adding a third-party sync (Toggl / Tempo / Clockify / ...) requires code **plus** a one-time per-environment ops step. Code alone is not enough — production will return *"<PROVIDER>_API_TOKEN not configured"* until the secret is wired through Docker.

### 1. Backend reads it via `loadSecret`

```ts
const token = loadSecret('<provider>_api_token', { required: false });
```

`loadSecret` checks `/run/secrets/<provider>_api_token` first, then falls back to `process.env.<PROVIDER>_API_TOKEN`.

### 2. Local dev: env var

Add to `backend/.env`:

```
<PROVIDER>_API_TOKEN="..."
```

The env-var fallback only activates when there is no Docker secret mount, which is the normal case during local dev.

### 3. Production: Docker secret (three places must align)

**a) Host file** at `docker/secrets/<provider>_api_token`. **Mode MUST be `644`** — the container runs as the `node` user (UID 1000), not root, and a `600` file would be unreadable. All other tokens in the repo are 644; match them.

```bash
echo -n "<api-key>" > docker/secrets/<provider>_api_token
chmod 644 docker/secrets/<provider>_api_token
```

**b) Backend service mount** in `docker-compose.prod.yml`:

```yaml
  backend:
    secrets:
      - ...existing...
      - <provider>_api_token
```

**c) Top-level secret declaration** in the same file:

```yaml
secrets:
  ...existing...
  <provider>_api_token:
    file: ./docker/secrets/<provider>_api_token
```

### 4. Recreate the backend container

`restart` is NOT enough — the secret mount only takes effect on container *create*. Force-recreate just the backend:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate backend
```

### 5. Verify

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend ls -la /run/secrets/
# the new file must appear at -rw-r--r-- (644)
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend cat /run/secrets/<provider>_api_token
# should print exactly the token
```

Then hit the Sync button in the UI; it should return the entry count instead of the *not configured* toast.

## Jira issue-key resolution (Tempo)

The Tempo v4 API only returns numeric issue IDs, so the backend resolves them to
issue keys / summaries / project names via the Jira REST API (cached in the
`JiraIssueCache` table — one Jira call per issue, ever). Without these
credentials Tempo entries fall back to `Issue #<id>` and the sync toast says so.

Three values are needed:

1. **`JIRA_BASE_URL`** (e.g. `https://schubwerk.atlassian.net`) and **`JIRA_EMAIL`**
   (the Atlassian account email) — plain env vars, not secrets. Local dev:
   `backend/.env`. Production: the `.env` file next to the compose files on the
   deploy host (compose v2 reads it automatically and passes both through).
2. **`jira_api_token`** — an Atlassian API token, created at
   <https://id.atlassian.com/manage-profile/security/api-tokens>. Wire it exactly
   like a provider token per the playbook above (`docker/secrets/jira_api_token`,
   mode 644, mount + declaration in `docker-compose.prod.yml` — already committed).

After recreating the backend, run a Tempo sync: new entries get real keys, and a
one-time backfill rewrites all historic `Issue #<id>` entries in the database.

## Common pitfalls

- **502s after `--force-recreate backend`.** The frontend's nginx resolves the `backend` hostname once at startup and keeps proxying to the old container IP after a recreate. Always follow up with `docker compose -f docker-compose.yml -f docker-compose.prod.yml restart frontend`. (The full `deploy-prod.sh` is unaffected — it recreates everything.)
- **644 vs 600.** Docker mirrors the host file's mode into `/run/secrets/`. Permissions narrower than 644 lock out the non-root container user.
- **`docker compose restart` doesn't pick up new secrets.** Force-recreate the affected service.
- **`backend/.env` is irrelevant in prod.** That file is on the host filesystem, but the backend runs inside the container with only the env vars defined by `docker-compose.prod.yml`. The env-var path is only for local dev.
- **docker-compose v1 (`docker-compose`, hyphenated) is dead on this host.** Its `KeyError: 'ContainerConfig'` crash on modern Docker engines made `--force-recreate` unusable. Always use `docker compose` (v2, space).

## docker compose v2 install reference

If you ever provision a new deploy host, install v2 as a Docker CLI plugin:

```bash
# Option A — Docker's apt repo (cleanest)
apt update && apt install docker-compose-plugin
docker compose version

# Option B — direct binary
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m) \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
docker compose version
```

You can keep `docker-compose` v1 installed alongside without conflict — they're separate binaries. `deploy-prod.sh` only calls v2.
