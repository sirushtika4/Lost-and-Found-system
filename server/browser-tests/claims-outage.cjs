// Run LAST: stops only the verified marked temporary mongod on 27018.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
(async () => {
  assert.ok(process.env.CLAIM_TEST_STATE_PATH, 'Pass the state file from Start-AuthTestDatabase.ps1');
  const state = JSON.parse(fs.readFileSync(process.env.CLAIM_TEST_STATE_PATH, 'utf8').replace(/^\uFEFF/, ''));
  const directory = path.resolve(state.DataDirectory);
  assert.ok(directory.toLowerCase().startsWith(path.resolve(os.tmpdir()).toLowerCase() + path.sep));
  assert.match(path.basename(directory), /^campus-auth-test-[a-f0-9-]{36}$/);
  assert.ok(fs.existsSync(path.join(directory, '.auth-test-owned')));
  assert.ok(Number.isSafeInteger(state.ProcessId) && state.ProcessId > 0);
  const processInfo = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter 'ProcessId=${state.ProcessId}' | Select-Object Name,CommandLine | ConvertTo-Json -Compress`], { encoding: 'utf8', windowsHide: true }));
  assert.equal(processInfo.Name, 'mongod.exe');
  assert.ok(processInfo.CommandLine.includes(directory));
  assert.match(processInfo.CommandLine, /--port\s+27018/);
  const api = 'http://localhost:15000/api';
  const login = await fetch(`${api}/auth/login`, { method: 'POST', headers: { Origin: 'http://localhost:18080', 'X-CSRF-Protection': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'legacy@example.invalid', password: 'legacy-password' }) });
  assert.equal(login.status, 200, 'Run auth integration fixtures first');
  const cookie = login.headers.get('set-cookie').split(';')[0];
  // Successful MongoDB shutdown can close mongosh's connection with ECONNRESET.
  try { execFileSync('mongosh.exe', ['--quiet', 'mongodb://127.0.0.1:27018/admin?serverSelectionTimeoutMS=3000', '--eval', 'db.shutdownServer()'], { stdio: 'ignore', windowsHide: true, timeout: 15000 }); } catch {}
  let health;
  for (let attempt = 0; attempt < 20; attempt++) {
    health = await fetch(`${api}/health`);
    if (health.status === 503) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(health.status, 503);
  const response = await fetch(`${api}/claims/mine`, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { message: 'Service temporarily unavailable. Please try again.' });
  console.log(JSON.stringify({ checks: ['Verified marked temporary mongod on 27018 before shutdown', 'Temporary database outage makes health return 503', 'Authenticated claims request returns prompt sanitized 503'], productionDatabaseTouched: false }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
