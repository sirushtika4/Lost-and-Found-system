// This test is deliberately fixed to the isolated test stack, never ports 8080/5000.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const checks = [], network = [], errors = [];
  const base = 'http://localhost:18080';
  const api = 'http://localhost:15000/api';
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(api)) network.push({ method: response.request().method(), url: response.url(), status: response.status() });
  });
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const email = `browser-${Date.now()}@example.invalid`;
  const password = 'A long isolated browser password';
  try {
    await page.goto(`${base}/register`);
    await page.getByPlaceholder('Your full name').fill('Browser Test Member');
    await page.getByPlaceholder('name@campus.edu').fill(email);
    await page.getByPlaceholder('At least 15 characters').fill(password);
    await page.getByPlaceholder('Repeat your password').fill(password);
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await nav.getByRole('link', { name: 'Profile', exact: true }).waitFor();
    checks.push('Real registration establishes a signed-in session');

    const cookies = await context.cookies(api);
    const session = cookies.find(cookie => cookie.name === 'lf_session');
    assert.ok(session);
    assert.equal(session.httpOnly, true);
    assert.equal(session.sameSite, 'Strict');
    assert.equal(session.path, '/api');
    assert.equal(session.secure, false);
    assert.ok(session.expires - Date.now() / 1000 <= 900);
    const storage = await page.evaluate(() => ({ local: localStorage.getItem('lost_found_token'), session: sessionStorage.getItem('lost_found_token'), cookies: document.cookie }));
    assert.equal(storage.local, null);
    assert.equal(storage.session, null);
    assert.equal(storage.cookies.includes('lf_session'), false);
    checks.push('HttpOnly Strict cookie; no JWT in browser storage or document.cookie');

    await nav.getByRole('link', { name: 'Profile', exact: true }).click();
    await page.getByRole('heading', { name: 'Browser Test Member', exact: true }).waitFor();
    await page.route(`${api}/auth/me`, async route => {
      await new Promise(resolve => setTimeout(resolve, 650));
      await route.continue();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('Checking your session...', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/profile');
    await page.getByRole('heading', { name: 'Browser Test Member', exact: true }).waitFor();
    await page.unroute(`${api}/auth/me`);
    checks.push('Protected refresh waits for actual current-user response without redirect');

    await page.route(`${api}/auth/me`, route => route.abort('connectionrefused'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Retry session check' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/profile');
    assert.ok((await context.cookies(api)).some(cookie => cookie.name === 'lf_session'));
    await page.unroute(`${api}/auth/me`);
    await page.getByRole('button', { name: 'Retry session check' }).click();
    await page.getByRole('heading', { name: 'Browser Test Member', exact: true }).waitFor();
    checks.push('Temporary session-check failure preserves cookie and recovers on retry');

    const csrf = await context.request.post(`${api}/auth/logout`, { data: {} });
    assert.equal(csrf.status(), 403);
    await page.route(`${api}/auth/logout`, route => route.abort('connectionrefused'));
    await nav.getByRole('button', { name: 'Logout', exact: true }).click();
    await page.getByRole('alert').waitFor();
    assert.ok((await context.cookies(api)).some(cookie => cookie.name === 'lf_session'));
    await page.unroute(`${api}/auth/logout`);
    await nav.getByRole('button', { name: 'Logout', exact: true }).click();
    await nav.getByRole('link', { name: 'Login', exact: true }).waitFor();
    assert.equal((await context.cookies(api)).some(cookie => cookie.name === 'lf_session'), false);
    await page.goto(`${base}/profile`);
    await page.getByRole('heading', { name: 'Login', exact: true }).waitFor();
    checks.push('CSRF blocks logout; network failure does not pretend success; real logout clears cookie');

    await page.getByPlaceholder('name@campus.edu').fill(email);
    await page.getByPlaceholder('Enter your password').fill('incorrect');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.getByText('Invalid email or password.', { exact: true }).waitFor();
    await page.getByPlaceholder('Enter your password').fill(password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await nav.getByRole('link', { name: 'Profile', exact: true }).waitFor();
    await page.goto(`${base}/admin`);
    await page.getByRole('heading', { name: 'Lost Something? Found Something?', exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/');
    checks.push('Invalid login is reported; valid login works; ordinary user cannot enter admin UI');

    const validCookie = (await context.cookies(api)).find(cookie => cookie.name === 'lf_session');
    await context.addCookies([{ ...validCookie, value: 'invalid-session' }]);
    await page.goto(`${base}/profile`);
    await page.getByRole('heading', { name: 'Login', exact: true }).waitFor();
    checks.push('Invalid session clears authentication and redirects protected route');
    await page.getByPlaceholder('name@campus.edu').fill('legacy@example.invalid');
    await page.getByPlaceholder('Enter your password').fill('legacy-password');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await nav.getByRole('link', { name: 'Admin Dashboard', exact: true }).waitFor();
    await nav.getByRole('link', { name: 'Admin Dashboard', exact: true }).click();
    await page.getByRole('heading', { name: 'Admin Dashboard', exact: true }).waitFor();
    await page.route(`${api}/auth/me`, async route => {
      await new Promise(resolve => setTimeout(resolve, 650));
      await route.continue();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('Checking your session...', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/admin');
    await page.getByRole('heading', { name: 'Admin Dashboard', exact: true }).waitFor();
    await page.unroute(`${api}/auth/me`);
    checks.push('Existing-style cost-10 bcrypt account retains its admin role');
    assert.deepEqual(errors, []);
    checks.push('No uncaught JavaScript errors');
    const results = { checks, network, errors };
    if (process.env.AUTH_BROWSER_ARTIFACT_DIR) {
      fs.mkdirSync(process.env.AUTH_BROWSER_ARTIFACT_DIR, { recursive: true });
      fs.writeFileSync(path.join(process.env.AUTH_BROWSER_ARTIFACT_DIR, 'auth-browser-results.json'), JSON.stringify(results, null, 2));
    }
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
