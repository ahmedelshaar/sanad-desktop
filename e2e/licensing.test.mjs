// End-to-end licensing on the real Electron app against a local license server (signed with the
// public TEST key): register → trial → locked → activated, and a copy on another PC.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch, tid } from './helpers.mjs';
import { startLicenseServer, TEST_KEYS } from './licenseServer.mjs';

const MACHINE_A = 'snd_e2e_machine_A_000000000000000000000000';
const MACHINE_B = 'snd_e2e_machine_B_000000000000000000000000';

describe('licensing', () => {
  let server;
  let ctx;
  let page;
  let dir;
  const env = (fingerprint) => ({ SANAD_LICENSE_API: server.url, SANAD_LICENSE_KEYS: TEST_KEYS, SANAD_FINGERPRINT: fingerprint, SANAD_HOSTNAME: 'SHOWROOM-PC' });

  before(async () => {
    server = await startLicenseServer();
    ctx = await launch({ env: env(MACHINE_A) });
    page = ctx.page;
    dir = ctx.dir;
  });

  after(async () => {
    if (ctx) await ctx.close({ keep: true });
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    if (server) await server.close();
  });

  it('asks to register on first run and explains what is sent', async () => {
    await page.locator(tid('lic-email')).waitFor();
    assert.match(await page.locator('.gate').innerText(), /تسجيل البرنامج/);
    assert.match(await page.locator('.gate-privacy').innerText(), /بصمة الجهاز/);
    assert.equal(await page.locator('.sidebar').count(), 0);
    // nothing that changes data works before registering
    const res = await page.evaluate(() => window.sanad.books.create({ name: 'x', count: 5 }));
    assert.equal(res.error, 'LICENSE_LOCKED');
  });

  it('refuses a bad email, then registers and starts a 14-day trial', async () => {
    await page.locator(tid('lic-email')).fill('not-an-email');
    await page.locator(tid('lic-register')).click();
    assert.match(await page.locator('.alert').innerText(), /البريد الالكتروني غير صحيح/);

    await page.locator(tid('lic-email')).fill('Owner@Showroom.sa');
    await page.locator(tid('lic-name')).fill('محمد');
    await page.locator(tid('lic-company')).fill('معرض بن زرعه');
    await page.locator(tid('lic-register')).click();
    await page.locator(tid('trial-banner')).waitFor();
    assert.match(await page.locator(tid('trial-banner')).innerText(), /باقي 14 يوم/);

    const device = server.byEmail('owner@showroom.sa');
    assert.equal(device.fingerprint, MACHINE_A);
    assert.equal(device.info.company, 'معرض بن زرعه');
    assert.equal(device.info.device.hostname, 'SHOWROOM-PC');
    for (const key of ['os', 'cpu', 'ram_gb', 'app_version']) assert.ok(key in device.info.device, key);

    const res = await page.evaluate(() => window.sanad.books.create({ name: 'دفتر 1', count: 5 }));
    assert.equal(res.ok, true);
  });

  it('locks when the trial ends, keeping data readable', async () => {
    server.byEmail('owner@showroom.sa').trial_ends_at = '2020-01-01T00:00:00Z';
    await page.locator(tid('trial-check')).click();
    await page.locator(tid('lic-locked-title')).waitFor();
    assert.match(await page.locator(tid('lic-locked-title')).innerText(), /انتهت الفترة التجريبية/);
    assert.match(await page.locator('.gate').innerText(), /dev_/);

    const create = await page.evaluate(() => window.sanad.books.create({ name: 'x', count: 5 }));
    assert.equal(create.error, 'LICENSE_LOCKED');
    const list = await page.evaluate(() => window.sanad.books.list());
    assert.equal(list.ok, true);
    assert.equal(list.data.length, 1);
  });

  it('becomes active once Eleva activates the device', async () => {
    server.byEmail('owner@showroom.sa').license = { customer: 'معرض بن زرعه' };
    await page.locator(tid('lic-check')).click();
    await page.locator('.sidebar').waitFor();
    assert.equal(await page.locator(tid('trial-banner')).count(), 0);

    await page.locator(tid('nav-settings')).click();
    assert.equal(await page.locator(tid('lic-state')).innerText(), 'مفعل');
    assert.match(await page.locator('.gate-facts').first().innerText(), /معرض بن زرعه/);
    const create = await page.evaluate(() => window.sanad.books.create({ name: 'دفتر 2', count: 5 }));
    assert.equal(create.ok, true);
  });

  it('the same data copied to another PC asks to register again', async () => {
    await ctx.close({ keep: true });
    ctx = await launch({ dir, env: env(MACHINE_B) });
    page = ctx.page;
    await page.locator(tid('lic-email')).waitFor();
    assert.match(await page.locator('.gate').innerText(), /البرنامج على جهاز جديد/);
    const create = await page.evaluate(() => window.sanad.books.create({ name: 'x', count: 5 }));
    assert.equal(create.error, 'LICENSE_LOCKED');
  });

  it('back on the original PC it is still active; a block locks it at startup', async () => {
    await ctx.close({ keep: true });
    server.byEmail('owner@showroom.sa').blocked = true;
    ctx = await launch({ dir, env: env(MACHINE_A) });
    page = ctx.page;
    // the stored signed answer says active; the startup check then brings the block
    await page.locator(tid('lic-locked-title')).waitFor({ timeout: 15000 });
    assert.match(await page.locator(tid('lic-locked-title')).innerText(), /محظور/);
  });
});
