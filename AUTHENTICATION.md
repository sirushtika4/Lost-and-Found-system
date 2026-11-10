# Authentication implementation

Work stays in `Lost-and-Found-Recovered` on `docker-setup-mine`. The teammate
authentication branch was inspected as a reference, not merged. Existing MongoDB
connection safeguards and the live health endpoint remain in place.

## API contract

Profile updates are now supported through `PATCH /api/auth/me`: an authenticated,
CSRF-protected JSON request containing only `name` (trimmed, 1–100 characters)
and/or `phoneNumber` (trimmed, up to 30 characters, empty string clears it).
At least one field is required. Email, IDs, role, password/hash, timestamps and
profile image are rejected. The server atomically updates only the session user's
permitted fields and returns `{ success: true, user }` using the existing safe-user
allowlist. Omitted fields remain unchanged; the endpoint neither rehashes passwords
nor changes the JWT/cookie. The profile form provides loading, success and retryable
error states. See [INTEGRATION-FIXES.md](INTEGRATION-FIXES.md) for regression results.

| Route | Success | Failure examples |
| --- | --- | --- |
| `POST /api/auth/register` | 201, `{ success: true, user }`, session cookie | 400 validation/role injection, 409 duplicate email, 429 throttle |
| `POST /api/auth/login` | 200, `{ success: true, user }`, session cookie | 400 malformed input, generic 401 invalid credentials, 429 throttle |
| `GET /api/auth/me` | 200, `{ success: true, user }` | 401 missing/invalid/expired/deleted-user session; 503 database outage |
| `POST /api/auth/logout` | 204 and cookie removal | 403 invalid CSRF/origin; network errors must not pretend logout succeeded |

Every auth POST requires all of:

- `Origin` exactly equal to the configured `CLIENT_URL` origin;
- `Content-Type: application/json`;
- `X-CSRF-Protection: 1`.

Axios sends credentials and the custom header automatically. Native test/API
clients must supply these headers too. Missing or `null` origins fail closed.
This is the [OWASP custom-header CSRF pattern](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html),
layered with exact origin validation and SameSite cookies. The header is not an
authentication secret. Do not expand CORS to arbitrary origins. Future unsafe
API routes must use equivalent CSRF middleware; CORS alone is not authentication.

Auth responses use `Cache-Control: no-store`. Safe user responses contain only
`_id`, `name`, `email`, `phoneNumber`, `phone`, `role`, `profileImage`, and `joinedAt`.
No password, hash, JWT or internal version field is returned in JSON.

## User records and password rules

The model explicitly maps to `lost_found_db.users`. It disables automatic index
and collection creation and excludes `password` from ordinary queries. The
existing unique email index supplies race-safe duplicate rejection (including
MongoDB error 11000). There are no password save hooks or login writes.

Registration accepts only name, email, password and optional phoneNumber. Extra
fields, including role, are rejected. New users always receive role `user`.
Email is trimmed/lowercased; passwords are never trimmed or normalized. New
passwords require at least 15 Unicode characters and no more than 72 UTF-8 bytes,
and use bcrypt cost 12. Bcrypt's byte limit is documented in the
[bcrypt implementation](https://github.com/dcodeIO/bcrypt.js).

Login uses bcrypt comparison against the existing hash, including cost-10 legacy
hashes and existing roles. The stronger registration minimum is not imposed on
existing-user login passwords. Existing hashes, fields and timestamps are never
rewritten by login or current-user lookup. Unknown accounts also perform a dummy
hash comparison. Incorrect/unknown credentials receive the same 401 message.

Per-process, per-IP limits: 10 unsuccessful login requests per 15 minutes and
5 registration requests per 15 minutes. Limiters return 429 with Retry-After.
They reset on restart and are not shared across multiple replicas. Shared-store
limits and carefully configured trusted proxies are needed before scaling.
Duplicate registration deliberately returns 409, which can reveal that the
submitted details are already registered; it is not claimed to prevent all
account enumeration. Email verification/MFA/password reset are not implemented.

## Session and logout semantics

- Cookie name: `lf_session`, HttpOnly, host-only (no Domain attribute), Path `/api`,
  SameSite=Strict, Max-Age 900 seconds.
- JWT: HS256 only, issuer `campus-lost-found-api`, audience
  `campus-lost-found-web`, ObjectId subject, issued-at, expiry, random JWT ID.
  Verification checks signature, allowed algorithm, issuer, audience, subject,
  issued-at and a maximum 15-minute lifetime. User identity/role is loaded from
  MongoDB, not trusted from client input.
- No refresh tokens, sliding renewal, long-lived remember-me sessions, or
  server-side token store are introduced. Reauthentication is needed after
  15 minutes. Restarting with the same key does not revoke sessions; key rotation
  invalidates all existing signatures.
- Logout clears the browser cookie using the identical cookie settings. It does
  **not** revoke a previously copied JWT. A copied token can still authenticate
  until its original expiry (up to 15 minutes). No server-side revocation is claimed.
- The frontend neither reads nor stores JWTs in localStorage/sessionStorage.
  It removes the obsolete `lost_found_token` key during session initialization.

## Configuration

| Variable | Meaning |
| --- | --- |
| `JWT_SECRET` | Required private signing key; at least 32 cryptographically random bytes |
| `AUTH_MODE` | `local` for localhost HTTP; `production` for HTTPS and Secure cookies |
| `TRUSTED_PROXY_IP` | Optional exact IP of your controlled TLS ingress; never a wildcard or arbitrary client header |
| `CLIENT_URL` | Exact trusted frontend origin; Docker default `http://localhost:8080` |
| `VITE_API_URL` | Browser-facing API URL; Docker default `http://localhost:5000/api` |
| `MONGODB_URI` | Existing Windows-host connection to `lost_found_db` |

The local Docker container still uses NODE_ENV=production for dependency/runtime
settings, but explicitly sets AUTH_MODE=local for localhost HTTP. Local auth mode
refuses non-loopback frontend origins. Production mode refuses HTTP CLIENT_URL,
always sets Secure cookies, rejects insecure requests with 426, and requires
deployment behind correctly configured HTTPS ingress for both browser-facing
frontend and API. Set TRUSTED_PROXY_IP only to that controlled proxy's source IP;
it must strip/overwrite client-supplied forwarding headers. Without that setting,
spoofed X-Forwarded-Proto headers do not bypass the HTTPS requirement. Do not deploy local mode
to a public environment. This change does not configure a public TLS deployment.

The signing key is validated before opening the database or accepting any
registrations. A private ignored root `.env` was generated for this workspace;
it is not copied into images or included in Git. `.env.example` contains no key.
For a fresh checkout, create a private key without printing it:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
node -e "const fs=require('fs'),c=require('crypto'),p='.env',s=fs.readFileSync(p,'utf8');if(!/^JWT_SECRET=\S+/m.test(s))fs.writeFileSync(p,s.replace(/^JWT_SECRET=.*$/m,'JWT_SECRET='+c.randomBytes(32).toString('hex')))"
docker compose build --builder campus-build-recovery
docker compose up -d
docker compose ps
docker compose logs backend --tail=50
```

For direct npm development, use an ignored `server/.env` with the correct local
MongoDB address, frontend origin, key and AUTH_MODE. Never put the key in a VITE_
variable, Dockerfile, tracked file, command output or request logs.

## Frontend behavior

Login/register reuse the existing forms and routes. Axios uses withCredentials,
and the auth context initializes through `/api/auth/me` regardless of browser
storage. ProtectedRoute and AdminRoute wait for initialization before redirecting.
Session checks are cancellable; stale checks cannot overwrite a newer login.
Checks also run on window focus. A 401 clears auth state; a timeout/network/503
error retains the cookie and displays a retry state on protected pages.

Logout is awaited. A failed request leaves the user visibly signed in and shows
an error, rather than hiding a still-valid cookie. Unsupported remember-me and
password-reset controls are marked unavailable. Existing item/claim/admin
preview data and UI design remain unchanged; no item/claim backend APIs are added.

## Isolated tests (never register accounts in the existing database)

`npm --prefix server test` runs unit tests; database suites require explicit opt-in.
Authentication tests assert an exact URI on **port 27018**, rejecting the existing
Windows MongoDB port 27017 before any fixture write. Test accounts and a unique
email index are created only in a fresh temporary mongod data directory. The
test instance also uses a database named lost_found_db, but it is a different
process and storage directory from the real Windows service.

Requirements: installed `mongod.exe`, `mongosh`, Docker Desktop, and Google Chrome.
The start script accepts `-MongodPath` if the installed binary is elsewhere.
It launches a hidden loopback-only process with a new marked directory under
Windows TEMP and a private random test key. No MongoDB Docker image is required.
Normal application ports remain 8080/5000; isolated test ports are 18080/15000.

```powershell
npm ci --prefix server
./scripts/Start-AuthTestDatabase.ps1
$statePath = Join-Path ([IO.Path]::GetTempPath()) 'campus-auth-test-state.json'
$state = Get-Content $statePath -Raw | ConvertFrom-Json
docker compose build --builder campus-build-recovery
docker compose -p lost-found-auth-test --env-file $state.EnvFile -f docker-compose.auth-test.yml build --builder campus-build-recovery
docker compose -p lost-found-auth-test --env-file $state.EnvFile -f docker-compose.auth-test.yml up -d --wait
docker compose -p lost-found-auth-test --env-file $state.EnvFile -f docker-compose.auth-test.yml exec -T -e RUN_AUTH_INTEGRATION=1 backend npm test
npm --prefix server run test:browser
docker compose -p lost-found-auth-test --env-file $state.EnvFile -f docker-compose.auth-test.yml down
./scripts/Stop-AuthTestDatabase.ps1
```

Use a fresh test instance for each full suite; do not reset/seed the real database.
Stop script verifies the marked TEMP directory and matching process/port before
shutting down and removing only the temporary test data. It never stops the
Windows MongoDB service. StatePath can be overridden on both scripts.

The existing read-only host-MongoDB test can still be run independently:

```powershell
$testDirectory = (Resolve-Path ./server/test).Path
docker compose run --rm --no-deps -T -e RUN_MONGODB_INTEGRATION=1 -v "${testDirectory}:/app/test:ro" backend npm test
```

Do not set RUN_AUTH_INTEGRATION for the normal stack. The auth suite additionally
requires the exact temporary URI and will refuse production port 27017.

## Review before commit

Final verification results:

- Both normal Docker images built with `campus-build-recovery`; frontend/backend
  ran on 8080/5000 and health returned 200 with `database: connected`.
- Isolated API/unit suite: 30 passed, 0 failed, 1 intentionally skipped (the
  separate host-database health test). Covers registration, duplicate races,
  role injection, legacy bcrypt preservation, missing/invalid/expired sessions,
  safe current-user data, logout/replay semantics, CSRF, HTTPS/proxy handling and throttling.
- Normal-stack unit/read-only MongoDB suite: 18 passed, 0 failed, 1 intentionally
  skipped (the account-writing isolated auth suite).
- Nine Chrome auth checks passed, including protected and admin refresh,
  temporary network failure/retry, cookie privacy, registration/login/logout and
  invalid sessions. Six normal-stack browser health checks also passed.
- Frontend production build passed; lint reported 0 errors and 13 pre-existing
  warnings. No new auth-file lint warnings remained.
- All auth fixture writes used a separate temporary mongod process on 27018.
  The real 27017 database's collection/document fingerprints were unchanged.
- No real password was obtained or reset. Existing-hash login compatibility was
  verified using a cost-10 fixture in the isolated database.

Production dependency audit: the prior lockfile contained the
[body-parser DoS advisory](https://github.com/advisories/GHSA-27r3-jxmh-p828) and
[qs DoS advisory](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw). Compatible
lockfile fixes were applied without forced major upgrades. The production audit
then reported zero vulnerabilities. The full development audit still reports
two moderate nodemon/minimatch advisories; development dependencies are omitted
from the backend runtime image. No claim of a universally vulnerability-free
application is made.

No branch switches, merges, commits or pushes are automatic. Review new files as
well as `git diff`. Never stage root/server `.env`, test environment files,
node_modules, MongoDB files, generated images or browser artifacts. Keep the
existing user data unchanged when testing against the real service.

After reviewing all changes, these commands stage only the implementation files:

```powershell
git branch --show-current
git status --short --untracked-files=all
git diff --check
git diff
$reviewedFiles = @(
  '.env.example', 'AUTHENTICATION.md', 'API-INTEGRATION.md', 'DOCKER-GUIDE.md', 'MONGODB-GUIDE.md',
  'docker-compose.yml', 'docker-compose.auth-test.yml',
  'scripts/Start-AuthTestDatabase.ps1', 'scripts/Stop-AuthTestDatabase.ps1',
  'server/app.js', 'server/server.js', 'server/auth/session.js', 'server/config/auth.js',
  'server/models/User.js', 'server/middleware/auth.js', 'server/routes/auth.js',
  'server/Dockerfile', 'server/.env.example', 'server/package.json', 'server/package-lock.json',
  'server/test/auth-config.test.js', 'server/test/auth.integration.test.js',
  'server/test/health.test.js', 'server/test/mongodb.integration.test.js', 'server/browser-tests/auth.cjs',
  'client/src/services/api.js', 'client/src/services/authService.js', 'client/src/context/AuthContext.jsx',
  'client/src/components/common/ProtectedRoute.jsx', 'client/src/components/common/AdminRoute.jsx',
  'client/src/components/common/SessionStatus.jsx', 'client/src/components/layout/Navbar.jsx',
  'client/src/pages/LoginPage.jsx', 'client/src/pages/RegisterPage.jsx'
)
git add -- $reviewedFiles
git diff --cached --check
git diff --cached
git commit -m "Add secure cookie authentication and frontend session handling"
git push -u origin docker-setup-mine
```
