# Windows MongoDB connection from the recovered project

Authentication is now implemented separately in `AUTHENTICATION.md`. The
connection safeguards below remain current; references to the earlier absence
of auth routes and earlier test counts describe the connection-only stage.
The current Compose setup also requires a private JWT_SECRET; see that guide.

Work from `D:\Lost-and-Found-system-main (1)\Lost-and-Found-Recovered` on
`docker-setup-mine`. The old corrupted checkout is not used or modified.

The backend connects to the existing Windows database `lost_found_db`. This
change does not add a MongoDB container, models, migrations, seeds, authentication,
registration, item-management or claim APIs.

## Configuration and preservation

Compose supplies:

```text
MONGODB_URI=mongodb://host.docker.internal:27017/lost_found_db
```

`host.docker.internal` reaches Windows from Docker Desktop. Do not use container
`localhost` for the host database. The existing browser-facing API URL remains
`http://localhost:5000/api`; ports 8080/5000, image/service names, CORS and the
frontend source are preserved.

`server/config/db.js` validates that the URI explicitly selects `lost_found_db`
before opening a connection. Mongoose also pins `dbName` to that database.
Automatic collection creation and indexing are disabled. No user or item models
are registered, and the application issues no document writes, index creation,
seed, reset, migration or deletion commands.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Required by Express; Compose defaults to the host URI above |
| `PORT` | Existing Docker value: `5000` |
| `CLIENT_URL` | Existing Docker value: `http://localhost:8080` |
| `NODE_ENV` | Existing Docker value: `production` |
| `RUN_MONGODB_INTEGRATION` | Set to `1` only for the opt-in read-only integration test |

For direct Windows development, `server/.env.example` uses
`mongodb://localhost:27017/lost_found_db`. A private `server/.env` is loaded by
Express outside Docker, but is excluded from the Docker build. Compose overrides
its default URI from a shell variable or an ignored `.env` at the repository root.
A `server/.env` is not automatically passed into Compose containers.

The inspected Windows database permits unauthenticated reads, with authorization
disabled and `bindIp` set to `127.0.0.1`. No MongoDB security or firewall changes
are part of this task. If authentication is enabled later, use an existing
authorized account and store its URI only in the private environment. Select
`/lost_found_db`, use the correct `authSource`, and percent-encode credentials.
Never commit real credentials or weaken binding/firewall rules to bypass errors.

## Startup and health

Express starts listening only after the initial MongoDB connection succeeds.
Initial failure times out after five seconds, logs a sanitized error and exits
with code 1. The existing Compose restart policy retries startup. There is no HTTP
health endpoint until startup succeeds.

Once running, `/api/health` checks Mongoose's current connection state and performs
a read-only ping against `lost_found_db` with a two-second timeout. It sends
`Cache-Control: no-store`:

| Condition | HTTP | Response |
| --- | --- | --- |
| Connected, successful ping | 200 | `{ "status": "OK", "service": "Lost and Found API", "database": "connected" }` |
| Disconnected or failed ping | 503 | `{ "status": "DEGRADED", "service": "Lost and Found API", "database": "disconnected" }` |

The unchanged frontend displays the successful database status, or its existing
error/retry state if the API returns 503 or is unreachable. Sample listings and
other placeholder application features are not completed by this connection.

## Build and run

```powershell
Set-Location 'D:\Lost-and-Found-system-main (1)\Lost-and-Found-Recovered'
docker compose build --builder campus-build-recovery
docker compose up -d
docker compose ps
docker compose logs backend --tail=50
Invoke-RestMethod http://localhost:5000/api/health
```

Open `http://localhost:8080` and verify `API reachable` and `Database: connected`.
The backend image includes `config/`, installs production dependencies, and runs
as the existing non-root `node` user. Private `.env` files and host `node_modules`
remain excluded by the existing `.dockerignore`.

If the old checkout still owns containers named `lost-found-backend` and
`lost-found-frontend`, inspect their Compose labels and mounts first. Recreate only
those application containers for the recovered project. Do not remove database
storage, Docker volumes, or the recovery builder. No old source files need changes.

## Tests

The backend now uses Node's built-in test runner instead of its old placeholder:

```powershell
npm --prefix server test
```

Without the opt-in flag, tests use controlled connection outcomes and never open
a database connection. The integration test is skipped. To run all tests against
the real database inside a disposable container:

```powershell
$testDirectory = (Resolve-Path ./server/test).Path
docker compose run --rm --no-deps -T -e RUN_MONGODB_INTEGRATION=1 -v "${testDirectory}:/app/test:ro" backend npm test
```

Tests are mounted read-only and not copied into the production image. The live
test checks a real connection and 200 health, closes only its own Mongoose
connection, then verifies 503. It never stops Windows MongoDB or changes records.

Test unavailable-database startup without touching Windows MongoDB:

```powershell
docker compose run --rm --no-deps -T -e MONGODB_URI=mongodb://127.0.0.1:1/lost_found_db backend
```

Expected: sanitized startup error and exit 1. The override applies only to that
disposable container. Normal containers and the real database remain running.

Frontend checks with the build-stage dependencies:

```powershell
docker buildx build --builder campus-build-recovery --target build --load -t lost-found-recovered-client-checks:local ./client
docker run --rm lost-found-recovered-client-checks:local npm run build
docker run --rm lost-found-recovered-client-checks:local npm run lint
```

Verification compares collection names, document counts and content fingerprints
before and after testing using read-only queries. Fingerprints and user contents
are not committed. No database restoration/reinitialization is performed.

## Review and commit later

Verification results:

- Both images built with `campus-build-recovery`. Containers now belong to the
  recovered Compose project and run on ports 8080/5000; the backend uses UID 1000.
- The real health endpoint returned 200 with `database: connected`, and CORS
  allowed `http://localhost:8080`.
- Local tests: 12 passed, with the live integration test skipped by default.
  Docker tests with the opt-in flag: all 13 passed, including real connection
  success and 503 after closing only the test connection.
- Unavailable-database startup exited 1 as expected without stopping Windows MongoDB.
- Six browser checks passed: loading, real connected status, retry/CORS, offline
  error, recovery and no uncaught JavaScript errors. Frontend production build
  passed; lint reported 0 errors and 13 warnings in existing code.
- Before/after snapshots had identical collection names, document counts and
  content fingerprints. The existing `users` collection still contained one
  unchanged document. No other collections were created or removed.
- Frontend source had no diff. Private `.env` and `node_modules` remain ignored.
- Docker Desktop required a normal restart initially. Old checkout application
  containers had no mounted volumes and were replaced; old repository files,
  database storage and the recovery builder were not modified or removed.

No branch, commit, push or merge is automatic. Review the complete diff and new
files first. Private `.env`, `node_modules`, MongoDB files and Docker images must
remain outside Git.

```powershell
git branch --show-current
git status
git diff --check
git diff
git add -- docker-compose.yml server/server.js server/config/db.js server/Dockerfile server/package.json server/package-lock.json server/.env.example server/test MONGODB-GUIDE.md DOCKER-GUIDE.md API-INTEGRATION.md
git diff --cached --check
git diff --cached
git commit -m "Restore MongoDB connection in recovered Docker project"
git push -u origin docker-setup-mine
```
