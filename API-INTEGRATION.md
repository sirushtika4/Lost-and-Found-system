# API integration status

This is a historical integration-stage report. Current cookie authentication,
API routes and tests are documented in `AUTHENTICATION.md`.

Historical health-only integration report. See `MONGODB-GUIDE.md` for the later
MongoDB connection restoration in `Lost-and-Found-Recovered`; the live health
response replaces the earlier `not connected yet` placeholder described below.

This increment stays on `docker-setup-mine`. It connects the home page to the
existing health API and improves error handling for the existing authentication
requests. No backend routes, database, authentication implementation, Docker
configuration, dependencies, or preview item data were added or replaced.

## Endpoints on this branch

| Method and path | Current behavior | Frontend usage |
| --- | --- | --- |
| `GET /` | 200, API startup message | Manual smoke check |
| `GET /api/health` | 200, `{ status: 'OK', service: 'Lost and Found API', database: 'not connected yet' }` | Home page service status panel |
| `POST /api/auth/login` | 404, not implemented here | Existing LoginPage request; now reports unavailable feature |
| `POST /api/auth/register` | 404, not implemented here | Existing RegisterPage request; now catches and displays the error |
| `GET /api/auth/me` | Not implemented here | Existing AuthContext session restore; failed sessions are cleared |
| `/api/items`, `/api/items/:id`, `/api/items/:id/claims`, `/api/claims` | Not implemented here | Item/claim service methods exist but are not connected to page actions |

The health endpoint confirms API reachability only. Its database field remains
`not connected yet`; it does not establish that reporting, accounts, or claims work.

## Frontend behavior

- `api.js` retains the existing `VITE_API_URL` value, ten-second timeout and
  bearer-token interceptor. A shared error formatter distinguishes missing routes,
  server validation messages, network errors, and timeouts.
- `healthService.js` uses that same Axios instance for `/health` and rejects
  unexpected response shapes rather than treating arbitrary HTML as success.
- `BackendStatus` checks on mount, cancels on unmount, shows loading and error
  states, clears stale success on retry, and displays the actual service/database
  response. It uses existing panels, buttons and loading styles.
- Login/register continue to call their existing service methods. Registration
  now catches rejected requests and keeps the form visible; both pages announce
  API errors with `role="alert"`. No accounts or tokens are fabricated.
- Home statistics and recent items, BrowseItemsPage, ItemDetailPage, MyItemsPage,
  MyClaimsPage and AdminDashboardPage retain their existing preview data. Report
  and edit handlers still log locally and navigate; the claim dialog still closes
  without submitting. Contact/delete/resolve actions remain placeholders. These
  are not completed API features. The home status panel explicitly labels the
  sample previews and unsaved reporting/claims.

## Team work inspected without merging

Remote references were fetched and inspected on 2026-11-07. No team branch was
checked out, modified, merged or cherry-picked.

- `feature/backend-auth` at `eaa3063`: existing MongoDB User model, password hashing,
  JWT generation/middleware and `/api/auth/register`, `/api/auth/login`,
  `/api/auth/me`. Its user/token response matches the frontend's expected shape.
  Server startup requires MongoDB. This code is not present or tested on this branch.
- `feature/docker-setup` at `d1a1399`: MongoDB startup and a database-aware health
  response (503 when disconnected). This differs from this branch's health contract.
- `feature/backend`, `feature/database`, `feature/authentication/login`,
  `Branch-name-feature/authentication/login`, `feature/devops`, and `frontend`
  currently point to initial project setup (`e3fb17e`).
- `feature/frontend` has the existing frontend services and preview UI.
  `docker-fix` and `docker-fix-clean` still expose the basic root/health backend.

## Docker and browser verification

Run from the repository root:

```powershell
docker compose build --builder campus-build-recovery
docker compose up -d
docker compose ps
docker compose logs --tail=50
docker compose exec -T backend npm test
```

The frontend build runs `npm run build` in the existing Dockerfile. To run its
available lint script with the same installed dependencies:

```powershell
docker buildx build --builder campus-build-recovery --target build --load -t lost-found-client-checks:local ./client
docker run --rm lost-found-client-checks:local npm run lint
```

The backend `npm test` currently only prints `No backend tests yet`; passing it
does not provide backend unit-test coverage. There is no frontend test script.

Final verification on 2026-11-07: both images built, both application containers
were running on ports 8080/5000, root/health returned 200, and CORS preflight
returned 204 for the configured frontend origin. Frontend lint exited 0 with
13 warnings in existing code and no errors; no new component warnings remained.
`git diff --check` passed. No secrets, environment files or generated artifacts
were added to the Git changes.

Browser verification uses the actual Docker UI at `http://localhost:8080` in
Chrome, with Chrome DevTools Network protocol capture (automated rather than a
manual Network tab session):

1. Open Home: observe loading, then `API reachable` and `Database: not connected yet`.
2. Check the browser Network tab for `GET http://localhost:5000/api/health`:
   response 200, actual JSON body, CORS origin `http://localhost:8080`.
3. Click **Check again**: another real health request must complete.
4. Switch browser networking offline and retry: show a connection error and
   remove stale success; restore networking and retry to recover.
5. Delay the health request beyond ten seconds: show the timeout message; restore
   normal networking and retry. This is fault injection in the test, not a mock API.
6. Submit valid-format test login/register forms: the current server returns 404;
   show an unavailable-feature error, re-enable the button, and stay on the form.
   No account is created. Do not interpret these expected failures as working auth.

On 2026-11-07, these eight automated browser assertions passed: initial loading,
real health/database labels, retry/CORS, offline recovery, timeout recovery,
registration 404 handling, login 404 handling, and no uncaught JavaScript errors.
All health responses used real Express responses; no synthetic success data was used.

## Next steps requiring team coordination

1. Review the existing auth/database branches together before integrating them.
   Configure a real MongoDB service or connection and `JWT_SECRET` outside Git,
   then test registration/login/session restore against that implementation.
   Once that code is integrated, update the backend Dockerfile: it currently copies
   only `server.js`, so it will also need the new routes/models/config/middleware.
   Compose will need the agreed database/auth environment configuration.
2. Agree item/claim routes, authorization and response schemas, including the
   form's `date` versus the cards' `dateLostOrFound`, ownership and pagination.
   Implement database-backed item/report/claim operations before wiring their
   page handlers or replacing preview data. Image inputs currently create browser
   blob URLs; a real upload contract is also needed.
3. Replace sample statistics/matches/admin data only when corresponding real
   backend functionality exists. Add regression tests for the agreed API contracts.

## Review and Git commands

No changes are staged, committed or pushed automatically. Review first:

```powershell
git branch --show-current
git status --short
git diff --check
git diff
Get-Content client/src/services/healthService.js
Get-Content client/src/components/common/BackendStatus.jsx
Get-Content API-INTEGRATION.md
```

After approval, stage only these files:

```powershell
git add API-INTEGRATION.md client/src/services/api.js client/src/services/authService.js client/src/services/healthService.js client/src/components/common/BackendStatus.jsx client/src/pages/HomePage.jsx client/src/pages/LoginPage.jsx client/src/pages/RegisterPage.jsx
git diff --cached --check
git diff --cached
git commit -m "Connect frontend health status and handle unavailable API features"
git push -u origin docker-setup-mine
```

Review the staged diff before committing. `.env` files, `node_modules`, browser
tooling and generated Docker images are not part of these changes.
