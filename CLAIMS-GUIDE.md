# Claims management

Implemented on `docker-setup-mine`, based on pushed item commit `a7598ba`. The working tree was clean and `HEAD...origin/docker-setup-mine` was `0 0` after fetching. Remote backend trees and route contents were inspected without checkout or merge; no teammate claims implementation was found.

## Storage and migration review

`server/models/Claim.js` defines an **embedded Mongoose claim schema**, stored in the existing Item document's private `claims` array. There is deliberately no separate `claims` collection. The enclosing item is the reference for every claim; API responses supply `itemId` and the current `itemTitle`.

This design supports atomic decisions on the existing standalone Windows MongoDB instance. A separate claims collection would need multi-document transactions/replica-set configuration to make approval, item resolution and competing rejections atomic together. Neither database configuration nor Docker configuration is changed.

No migration, seed, backfill, collection creation, index creation or existing-record rewrite runs at startup. Existing items without claims remain valid. `claims` defaults to undefined and both private fields use `select: false`; the public item response also uses an explicit allowlist. The first real user claim adds the private fields to its referenced item. Automatic Mongoose collection/index creation remains disabled. No new dependencies are required, and the Dockerfile already copies all model/route files.

Before a future migration to a separate collection or adding indexes, review transaction support, duplicates, existing claims, retention and rollback with the team. No such migration/index operation is included here.

| Claim field | Rule |
| --- | --- |
| _id | Server-generated ObjectId |
| claimantId | Authenticated user's immutable ObjectId |
| explanation | Required trimmed text, 10–2000 characters |
| evidence | Optional trimmed text, up to 1000 characters |
| status | pending / approved / rejected, server-controlled |
| submittedAt | Server submission timestamp |
| reviewedAt | Null until reviewed; server timestamp |
| reviewerId | Null until reviewed; item reporter's ObjectId |

The item also stores a private `approvedClaimId`. A hard cap of **100 total claims per item**, including rejected history, bounds document growth. Capacity never deletes old records. Only text evidence is supported; no identity documents, attachments or unnecessary personal fields are requested. Users are warned against including sensitive information. Text is rendered through React escaping, not HTML.

## API contract and permissions

Every claims endpoint requires the existing HttpOnly JWT cookie. Writes additionally require the configured exact Origin, JSON Content-Type and `X-CSRF-Protection: 1`. Existing HTTPS, proxy, CORS, session expiry and 16 KB body limits remain unchanged.

| Endpoint | Body / query | Access and result |
| --- | --- | --- |
| POST `/api/claims` | `{ itemId, explanation, evidence? }` | 201 `{ success: true, claim }`; authenticated non-reporter, existing open found item |
| GET `/api/claims/mine` | page, limit, status? | 200 `{ success: true, claims, pagination }`; only the caller's claims |
| GET `/api/claims/received` | page, limit, status? | Same envelope; only claims on the caller's reported items |
| GET `/api/claims/:id` | Valid ObjectId | 200 single-claim envelope; claimant or reporter only |
| PATCH `/api/claims/:id/status` | `{ status: "approved" | "rejected" }` | 200 single-claim envelope; item reporter only |

List defaults: page 1, limit 12; page maximum 1000, limit maximum 50. Optional status is pending/approved/rejected. Extra keys, arrays, query operators and malformed IDs are rejected. Lists sort by submittedAt and claim ID descending, with numeric pagination `{ page, limit, total, pages }`. A 3-second MongoDB aggregation execution limit bounds list work.

Safe claim responses contain `_id`, `itemId`, current `itemTitle`, `itemStatus`, `claimantId`, explanation/evidence, status and review timestamps/ID. They never populate account emails, phone numbers, password hashes or other account fields. Public item APIs expose no claim evidence or claimant IDs. A stored administrator role alone does **not** grant claim access/review; administrator management is outside this feature.

Errors use `{ message }`: 400 validation, 401 missing/invalid session, 403 unauthorized access or CSRF, 404 missing item/claim, 409 duplicate/ineligible/conflicting/terminal decision/capacity, and sanitized 503 for database unavailability. The disconnected-connection guard avoids buffering user lookups when MongoDB is already offline. Driver network failures are also sanitized through the existing error handler.

## State transitions and concurrency

Only `pending -> approved` or `pending -> rejected` is permitted. Decisions are final; there is no withdrawal, appeal or reversal API. A rejected claimant can submit a new claim if the item is still open and capacity remains. Two active claims for one claimant/item are prevented by a conditional atomic append, including simultaneous requests.

Approval uses one conditional MongoDB Item update pipeline. It requires reporter ownership, an open found item, no approved marker, and the target claim still pending. The same write:

1. Marks the target approved and sets the private winning-claim ID.
2. Marks all other pending claims rejected.
3. Records the initiating reporter and review time for those decisions.
4. Resolves the item.

Two concurrent approvals cannot both match that precondition after one succeeds. The loser gets 409; no compensating multi-document writes or process-local locks are needed. Rejections also compare-and-set only pending claims. Clients are warned that approval rejects competing pending claims.

Item endpoints enforce matching atomic rules: any claim history prevents deletion or changing the item type. Pending claims prevent manual status updates; an approved item cannot be reopened. With only rejected history and no approval, manual status changes remain possible. Descriptive fields remain editable, so displayed item titles reflect current data rather than a historical snapshot. Concurrent create/delete/type/status tests cover these shared-document rules. Existing behavior for items without claims is preserved.

## Frontend

Item Details enables the claim dialog only for open found items reported by somebody else. Anonymous visitors get a sign-in link, reporters get a review link, and lost/resolved reports have no submission button. The dialog collects explanation and optional evidence, disables repeated clicks using both an in-flight guard and button state, and shows success/error guidance. If a response is interrupted, users are told to check My Claims before retrying; the backend still prevents duplicate active claims.

My Claims contains real submitted and received panels with independent loading/error/retry/empty states, status filters and pagination. Reporters can inspect evidence and confirm approval/rejection. Review failures remain visible; the panel refreshes to reconcile a potentially completed decision. Claimants see decisions on reload/navigation; live notifications are not implemented. The existing Axios instance handles cookies and CSRF.

The existing administrator dashboard and homepage statistics retain their explicit preview labels. No administrator management, matching, contact sharing or image uploads were added.

## Docker and tests

```powershell
docker compose build --builder campus-build-recovery
docker compose up -d
docker compose ps
docker compose logs --tail=50
Invoke-RestMethod http://localhost:5000/api/health
```

All integration writes use a guarded temporary Windows mongod on **27018**, not the real service on 27017. No MongoDB container is created. Start a fresh temporary instance before the combined suite because existing auth tests expect fresh fixtures. Claims fixtures use separate temporary user/item collections so authentication/item tests can run concurrently without count/search interference.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Start-AuthTestDatabase.ps1
$statePath = Join-Path ([IO.Path]::GetTempPath()) 'campus-auth-test-state.json'
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
docker compose --env-file $state.EnvFile -p lost-found-auth-test -f docker-compose.auth-test.yml build --builder campus-build-recovery
docker compose --env-file $state.EnvFile -p lost-found-auth-test -f docker-compose.auth-test.yml up -d
docker compose --env-file $state.EnvFile -p lost-found-auth-test -f docker-compose.auth-test.yml exec -T -e RUN_AUTH_INTEGRATION=1 -e RUN_ITEM_INTEGRATION=1 -e RUN_CLAIM_INTEGRATION=1 backend node --test --test-reporter=spec
# Requires existing host server/node_modules/playwright and installed Chrome:
node server/browser-tests/claims.cjs
node server/browser-tests/auth.cjs
node server/browser-tests/items.cjs
# Run LAST: verifies the marked process/path, then stops ONLY test mongod 27018.
$env:CLAIM_TEST_STATE_PATH = $statePath
node server/browser-tests/claims-outage.cjs
docker compose --env-file $state.EnvFile -p lost-found-auth-test -f docker-compose.auth-test.yml down
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Stop-AuthTestDatabase.ps1
```

The integration suite refuses any URI except `mongodb://host.docker.internal:27018/lost_found_db`. The outage test verifies the temporary-directory ownership marker, expected path, process name, matching command line and port before shutdown. It tests the isolated API only, using the legacy fixture created by the auth suite; no project user password is needed.

Normal `npm.cmd --prefix server test` runs unit/failure-injection tests and skips database-writing suites. Frontend checks can run without installing host client dependencies:

```powershell
docker buildx build --builder campus-build-recovery --target build --load -t lost-found-claims-client-checks:local ./client
docker run --rm lost-found-claims-client-checks:local npm run lint
```

Tests cover successful submission, duplicate/concurrent submission, missing auth, own/lost/resolved/missing items, private lists/details, unauthorized users including unrelated admins, terminal status rules, rejection/resubmission, simultaneous approval, competing auto-rejection, item-update/deletion races, mass assignment, text limits, query bounds, malformed IDs, CSRF, capacity and database failures. Browser checks exercise submission, submitted/received views, error/retry, rejection, resubmission and approval through actual Docker requests. Separate outage checks stop only temporary MongoDB and verify health/claims 503 responses.

## Verification results

- Final combined isolated backend run: **57 passed, 0 failed, 1 skipped** (the separate normal-database health check).
- Normal MongoDB read-only/unit run: **20 passed, 0 failed, 3 skipped** (all integration write suites).
- Claims browser workflow: **7 checks passed**, covering real submission/private views, missing CSRF, error/retry, rejection, resubmission, approval and no browser exceptions.
- Existing authentication browser regression: **9 checks passed**; existing item browser regression: **10 checks passed**.
- Guarded real temporary MongoDB outage: **3 checks passed**, including prompt sanitized 503 on authenticated claims requests. The normal Windows MongoDB service was not stopped.
- Frontend production build passed; lint reported **0 errors, 4 existing warnings** in unchanged AuthContext, ThemeContext, PossibleMatches and ProfilePage.
- Both images built with `campus-build-recovery`; normal containers run on 8080/5000. Normal health reports connected, and anonymous `/api/claims/mine` returns 401.
- Before/after read-only fingerprints of all real database collections/documents match: the original users collection still contains one unchanged document; no test users/items/claims or new collections/indexes were introduced there.

The initial claims browser run had an overly strict evidence-text locator (the UI prefixes it with a field label). The corrected locator passed. Driver-failure unit tests and an actual temporary-process outage both verify database errors. Temporary test containers and the marked data directory are removed after validation.

## Limitations

The 100-record cap includes rejected history; larger histories need a reviewed archival/data-model migration. Claims are embedded for standalone-server atomicity and are not independently indexed. Private claim lookup/list queries may need reviewed indexes at scale. There is no cancellation, appeal, notification, physical handover tracking or administrator override. Evidence is user-provided text, not verified identity; reporters make the ownership decision. Normal MongoDB access controls and production TLS deployment remain separate infrastructure responsibilities.

## Files and manual Git review

| Files | Purpose |
| --- | --- |
| server/models/Claim.js, server/models/Item.js | Embedded private claim schema and approval marker |
| server/routes/claims.js, server/app.js | Validated, authenticated claims APIs and mounting |
| server/routes/items.js | Atomic protection for items with claim history |
| client/src/services/claimService.js | Reusable Axios API contract |
| client/src/components/items/ClaimForm.jsx, client/src/pages/ItemDetailPage.jsx | Real claim submission and eligibility UI |
| client/src/pages/MyClaimsPage.jsx | Private lists and reporter review UI |
| server/test/claims.integration.test.js | Isolated security/concurrency tests and outage unit tests |
| server/browser-tests/claims.cjs, server/browser-tests/claims-outage.cjs | Actual browser workflow and guarded real outage checks |
| CLAIMS-GUIDE.md, ITEMS-GUIDE.md | Current contract, testing, migration and review notes |

No files are automatically staged, committed, pushed or merged. After reviewing all tracked and new files, confirm the branch before these commands:

```powershell
Set-Location 'D:\Lost-and-Found-system-main (1)\Lost-and-Found-Recovered'
git branch --show-current
git status --short --untracked-files=all
git diff --check
git diff
$reviewedFiles = @(
  'CLAIMS-GUIDE.md', 'ITEMS-GUIDE.md',
  'server/app.js', 'server/models/Claim.js', 'server/models/Item.js',
  'server/routes/claims.js', 'server/routes/items.js',
  'server/test/claims.integration.test.js',
  'server/browser-tests/claims.cjs', 'server/browser-tests/claims-outage.cjs',
  'client/src/services/claimService.js',
  'client/src/components/items/ClaimForm.jsx',
  'client/src/pages/ItemDetailPage.jsx', 'client/src/pages/MyClaimsPage.jsx'
)
git add -- $reviewedFiles
git diff --cached --check
git diff --cached
git commit -m "Add private claims submission and atomic reporter review"
git push origin docker-setup-mine
```

The branch must remain `docker-setup-mine`. Keep `.env`, node_modules, database files and generated test artifacts out of Git.
