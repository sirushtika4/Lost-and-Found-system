# Item management

Implemented on `docker-setup-mine` starting from `4c8327c`. Remote branches were fetched and inspected without checkout or merging. None contained item models/routes; `feature/backend-auth` contains authentication reference work only.

## Data and API contract

The `items` collection uses the existing Mongoose connection to `lost_found_db`. No seed, migration, user update, automatic collection creation or automatic index creation runs at startup. MongoDB creates `items` on the first real report. Existing collections/documents are left intact.

| Field | Rules |
| --- | --- |
| title | Required trimmed string, 1–150 characters |
| description | Required trimmed string, 1–4000 characters |
| type | `lost` or `found` |
| category | Electronics, Wallets, Bags, Keys, Documents, Books, Jewellery, Clothing, ID Cards, Other |
| location | Required trimmed string, 1–200 characters |
| dateLostOrFound | Required valid `YYYY-MM-DD`, no later than the current UTC date |
| color / brand | Optional trimmed strings, up to 80 / 100 characters |
| image | Optional HTTPS URL, up to 2000 characters, no URL credentials |
| status | Server sets `open` on creation; PATCH accepts `open` / `resolved` |
| userId | Immutable owner ObjectId from authenticated user, never accepted as input |
| _id / createdAt / updatedAt | Server generated |

The frontend form's `date` is translated to `dateLostOrFound` by `itemPayload`. Optional images use an HTTPS URL and preview. The previous file picker produced only a transient `blob:` URL; durable file uploads are not implemented. Image URLs are rendered by the browser with no referrer; the server never fetches them. External hosting availability and content are not guaranteed.

| Endpoint | Access | Result |
| --- | --- | --- |
| POST `/api/items` | Authenticated + CSRF | 201 `{ success: true, item }` |
| GET `/api/items` | Public | 200 `{ success: true, items, pagination }` |
| GET `/api/items/mine` | Authenticated | Same list envelope, restricted to session user |
| GET `/api/items/:id` | Public | 200 `{ success: true, item }` |
| PATCH `/api/items/:id` | Owner or stored exact `admin` role + CSRF | Updated single-item envelope |
| DELETE `/api/items/:id` | Owner or stored exact `admin` role + CSRF | 204 empty response |

Creation accepts only the editable descriptive fields. PATCH additionally accepts status and requires at least one field. Unknown fields, Mongo operators, owner IDs, timestamps and arbitrary roles are rejected. No administrator creation/management API was added. Owner authorization is repeated in the atomic write filter.

Both lists accept `search`, `location` (literal case-insensitive substring, each max 100 characters), `type`, `category`, `status`, `sort=newest|oldest`, `page=1..1000`, `limit=1..50`. Defaults are page 1, limit 12, newest. Search matches title/description/location. Ordering uses createdAt and _id for stable ties. Pagination contains numeric `page`, `limit`, `total`, `pages`; zero results has zero pages. Unexpected query keys, arrays and objects are rejected. Regex metacharacters are escaped; database list operations have a 3-second execution limit.

Errors return `{ message }`: 400 invalid input/ID, 401 missing/expired session, 403 ownership/CSRF, 404 missing item, existing 413 oversized body, and sanitized 503/500 failures. GET requests never create data. Public responses expose descriptive fields and owner ID only, never account email/password/contact information.

Cookie settings, HTTPS/proxy policy, CORS and 16 KB request limit remain those in [AUTHENTICATION.md](AUTHENTICATION.md). All state-changing item requests require the exact configured Origin, `X-CSRF-Protection: 1`, and JSON Content-Type. The Axios DELETE sends an empty JSON object to retain Content-Type.

## Frontend and remaining previews

Report Lost/Found routes require sign-in and create real records. Browse filters/search/pagination, details, My Items, edits, delete and resolve/reopen use the reusable Axios service. Network operations show loading, errors/retry or resubmission guidance, empty results and disabled mutation controls. Old responses cannot replace newer filter/detail requests. Missing IDs never fall back to sample records. Edit retains the item's actual type.

Home's recent reports use real records. Its illustration/statistics and the existing claims/admin pages are explicitly labelled previews. Claims, matching, reporter contact, administrator management and file upload storage remain unavailable. The mock data file is retained for those labelled previews; it is never substituted for failed item requests.

## Docker and tests

No dependency, Dockerfile or Compose changes are needed: the backend Dockerfile already copies the full models/routes directories, and Axios already includes cookies/CSRF headers.

```powershell
docker compose build --builder campus-build-recovery
docker compose up -d
docker compose ps
docker compose logs --tail=50
Invoke-RestMethod http://localhost:5000/api/health
Invoke-RestMethod http://localhost:5000/api/items
```

All test writes must use the marked temporary Windows MongoDB instance on **27018**, never the existing instance on 27017. Reuse the existing safe lifecycle scripts. Start a fresh instance before the combined suite because auth tests assert a fresh users collection. Item test user fixtures use a separate collection within that temporary instance to avoid racing auth count assertions.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Start-AuthTestDatabase.ps1
$statePath = Join-Path ([IO.Path]::GetTempPath()) 'campus-auth-test-state.json'
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
docker compose --env-file $state.EnvFile -p lost-found-auth-test -f docker-compose.auth-test.yml build --builder campus-build-recovery
docker compose --env-file $state.EnvFile -p lost-found-auth-test -f docker-compose.auth-test.yml up -d
docker compose --env-file $state.EnvFile -p lost-found-auth-test -f docker-compose.auth-test.yml exec -T -e RUN_AUTH_INTEGRATION=1 -e RUN_ITEM_INTEGRATION=1 backend npm test
# Uses installed host server/node_modules/playwright and installed Chrome, test ports only:
node server/browser-tests/items.cjs
node server/browser-tests/auth.cjs
docker compose --env-file $state.EnvFile -p lost-found-auth-test -f docker-compose.auth-test.yml down
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Stop-AuthTestDatabase.ps1
```

The new item integration suite refuses any URI except `mongodb://host.docker.internal:27018/lost_found_db`. It covers create lost/found, public browsing/detail, combined filters, literal search, pagination, mine, owner updates/deletes, exact admin permission, cross-user rejection, authentication, CSRF, input/mass-assignment protection, query bounds and invalid/missing IDs. Browser checks exercise the real UI through the isolated Docker frontend/backend.

Local checks without database writes: `npm.cmd --prefix server test`. For frontend checks without host node_modules:

```powershell
docker buildx build --builder campus-build-recovery --target build --load -t lost-found-client-item-checks:local ./client
docker run --rm lost-found-client-item-checks:local npm run lint
```

Search currently scans escaped substrings without new indexes. Before larger-scale use, agree on indexes/search behavior with the team, add upload storage, and decide retention/moderation policy. List count and page retrieval are separate reads and may differ during concurrent writes. Concurrent item edits currently use last-write-wins. Delete is permanent after UI confirmation.

## Verification results

- Final combined isolated backend suite: 43 passed, 0 failed, 1 deliberately skipped read-only normal-database integration test.
- Final item-only suite: 13 passed, 0 failed (12 scenarios and the suite container).
- Existing normal-connection read-only suite: 18 passed, 0 failed; auth/item write suites skipped.
- Docker UI checks: 10 item checks and 9 existing authentication checks passed, no uncaught JavaScript errors.
- Normal frontend read-only browser checks: real empty browse/recent results and GET-only API communication passed.
- Frontend production build passed. Lint: 0 errors, 4 existing warnings in untouched ThemeContext, AuthContext, PossibleMatches and ProfilePage.
- Both normal images built using `campus-build-recovery`; normal containers run on 8080/5000, with health reporting `database: connected`.
- Existing database still contains exactly the original one-user collection, with the same whole-document fingerprint; no test accounts/items were written there.

During development the first combined run exposed shared test fixture counts; fixtures were separated. Browser tests also caught missing accessible filter labels and Axios dropping JSON Content-Type on empty DELETE requests. These were corrected and the final runs passed. Temporary test data is removed using the existing guarded lifecycle scripts; no MongoDB container is created.

## Review and commit manually

Nothing is automatically staged, committed, pushed or merged. Review the new files as well as tracked diffs:

```powershell
Set-Location 'D:\Lost-and-Found-system-main (1)\Lost-and-Found-Recovered'
git branch --show-current
git status --short --untracked-files=all
git diff --check
git diff
$reviewedFiles = @(
  'ITEMS-GUIDE.md'
  'server/app.js'
  'server/models/Item.js'
  'server/routes/items.js'
  'server/test/items.integration.test.js'
  'server/browser-tests/items.cjs'
  'client/src/App.jsx'
  'client/src/components/forms/ReportItemForm.jsx'
  'client/src/components/items/ItemCard.jsx'
  'client/src/components/items/ItemPagination.jsx'
  'client/src/components/items/ItemRequestState.jsx'
  'client/src/services/itemService.js'
  'client/src/services/useItems.js'
  'client/src/pages/ReportLostPage.jsx'
  'client/src/pages/ReportFoundPage.jsx'
  'client/src/pages/BrowseItemsPage.jsx'
  'client/src/pages/ItemDetailPage.jsx'
  'client/src/pages/MyItemsPage.jsx'
  'client/src/pages/EditItemPage.jsx'
  'client/src/pages/HomePage.jsx'
  'client/src/pages/MyClaimsPage.jsx'
  'client/src/pages/AdminDashboardPage.jsx'
)
git add -- $reviewedFiles
git diff --cached --check
git diff --cached
git commit -m "Add authenticated item management and MongoDB frontend integration"
```

Only execute staging/commit commands after reviewing the changes and confirming the branch is still `docker-setup-mine`. No `.env`, node_modules, database files, test artifacts or Docker images belong in this commit.
