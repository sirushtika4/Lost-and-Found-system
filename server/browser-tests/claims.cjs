// All writes target only the isolated Docker stack on 18080/15000 -> MongoDB 27018.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const reporterContext = await browser.newContext(), claimantContext = await browser.newContext();
  const reporter = await reporterContext.newPage(), claimant = await claimantContext.newPage();
  const base = 'http://localhost:18080', api = 'http://localhost:15000/api';
  const checks = [], errors = [], network = [];
  const marker = `Claim browser ${Date.now()}`;
  for (const page of [reporter, claimant]) {
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().startsWith(api)) network.push({ method: response.request().method(), url: response.url(), status: response.status() }); });
    page.on('dialog', dialog => dialog.accept());
  }
  const register = async (page, suffix) => {
    await page.goto(`${base}/register`);
    await page.getByPlaceholder('Your full name').fill(`Claims ${suffix}`);
    await page.getByPlaceholder('name@campus.edu').fill(`claims-${suffix}-${Date.now()}@example.invalid`);
    await page.getByPlaceholder('At least 15 characters').fill('A long isolated claims browser password');
    await page.getByPlaceholder('Repeat your password').fill('A long isolated claims browser password');
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Profile', exact: true }).waitFor();
  };
  try {
    await register(reporter, 'reporter');
    await reporter.goto(`${base}/report/found`);
    await reporter.getByLabel('Item title', { exact: true }).fill(marker);
    await reporter.getByLabel('Description', { exact: true }).fill('Found keys for isolated claim testing');
    await reporter.getByLabel('Location', { exact: true }).fill('Campus Library');
    await reporter.getByLabel('Date found', { exact: true }).fill('2026-01-01');
    await reporter.getByRole('button', { name: 'Submit Found Report', exact: true }).click();
    await reporter.getByRole('heading', { name: marker, exact: true }).waitFor();
    const itemId = new URL(reporter.url()).pathname.split('/').pop();
    assert.equal(await reporter.getByRole('button', { name: 'Claim This Item', exact: true }).count(), 0);
    checks.push('Reporter creates real found item and cannot claim it');
    await register(claimant, 'claimant');
    const submit = async () => {
      await claimant.goto(`${base}/items/${itemId}`);
      await claimant.getByRole('button', { name: 'Claim This Item', exact: true }).click();
      await claimant.getByLabel('Ownership explanation', { exact: true }).fill('The key tag has a distinctive blue triangle.');
      await claimant.getByLabel('Additional evidence (optional text)', { exact: true }).fill('A scratch on the reverse side.');
      await claimant.getByRole('button', { name: 'Submit Claim', exact: true }).click();
      await claimant.getByText('Your claim was submitted for review.', { exact: true }).waitFor();
      await claimant.getByRole('link', { name: 'View My Claims', exact: true }).click();
      await claimant.getByRole('region', { name: 'Claims I Submitted', exact: true }).getByText('pending', { exact: true }).waitFor();
    };
    await submit();
    const mine = await (await claimantContext.request.get(`${api}/claims/mine`)).json();
    assert.equal(mine.claims.filter(c => c.itemId === itemId).length, 1);
    const publicItem = await (await claimantContext.request.get(`${api}/items/${itemId}`)).text();
    assert.ok(!publicItem.includes('distinctive blue triangle')); assert.ok(!publicItem.includes('claimantId'));
    checks.push('Claim form submits and My Claims shows real pending record; public item excludes evidence');
    const noCsrf = await claimantContext.request.post(`${api}/claims`, { data: { itemId, explanation: 'A valid explanation' } });
    assert.equal(noCsrf.status(), 403);
    checks.push('Actual browser request missing CSRF protection is rejected');
    await claimant.route(`${api}/claims/mine*`, route => route.abort('connectionrefused'));
    await claimant.reload();
    const submitted = claimant.getByRole('region', { name: 'Claims I Submitted', exact: true });
    await submitted.getByRole('button', { name: 'Retry', exact: true }).waitFor();
    await claimant.unroute(`${api}/claims/mine*`);
    await submitted.getByRole('button', { name: 'Retry', exact: true }).click();
    await submitted.getByText('pending', { exact: true }).waitFor();
    checks.push('Claims loading error is visible and retry restores real results');
    await reporter.goto(`${base}/my-claims`);
    const received = reporter.getByRole('region', { name: 'Claims Received For My Items', exact: true });
    await received.getByText('The key tag has a distinctive blue triangle.').waitFor();
    await reporter.route(`${api}/claims/*/status`, route => route.abort('connectionrefused'));
    await received.getByRole('button', { name: 'Reject', exact: true }).click();
    await received.getByRole('alert').waitFor();
    await reporter.unroute(`${api}/claims/*/status`);
    await received.getByRole('button', { name: 'Reject', exact: true }).click();
    await received.getByText('Claim rejected.', { exact: true }).waitFor();
    await claimant.reload(); await submitted.getByText('rejected', { exact: true }).waitFor();
    checks.push('Reporter can inspect evidence and reject; failed review shows error; claimant sees decision');
    await submit();
    await reporter.reload();
    await received.getByRole('button', { name: 'Approve', exact: true }).click();
    await received.getByText('Claim approved.', { exact: true }).waitFor();
    await claimant.reload(); await submitted.getByText('approved', { exact: true }).waitFor();
    await claimant.goto(`${base}/items/${itemId}`);
    await claimant.getByText('resolved', { exact: true }).waitFor();
    assert.equal(await claimant.getByRole('button', { name: 'Claim This Item', exact: true }).count(), 0);
    checks.push('Rejected user can resubmit; reporter approval resolves item and disables further submission');
    assert.deepEqual(errors, []); checks.push('No uncaught JavaScript errors');
    console.log(JSON.stringify({ checks, network, errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
