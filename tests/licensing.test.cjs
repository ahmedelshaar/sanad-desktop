const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const vectors = require('./fixtures/license-test-vectors.json');
const { canonicalize, verifyEnvelope, requestSignature, sha256 } = require('../electron/licensing/crypto.cjs');
const { createLicensing } = require('../electron/licensing/index.cjs');
const { fingerprint, deviceInfo } = require('../electron/licensing/device.cjs');

const KEYS = [{ kid: vectors.test_key.kid, public_key: vectors.test_key.public_key_base64 }];
const PRIVATE = crypto.createPrivateKey({ key: Buffer.from(vectors.test_key.pkcs8_der_base64, 'base64'), format: 'der', type: 'pkcs8' });
const DAY = 86_400_000;
const iso = (ms) => new Date(Math.floor(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z');

function sign(payload) {
  const full = { ...payload, kid: vectors.test_key.kid };
  return { kid: full.kid, payload: full, signature: crypto.sign(null, Buffer.from(canonicalize(full)), PRIVATE).toString('base64') };
}

describe('shared ElevaHub vectors', () => {
  test('canonical JSON', () => {
    for (const v of vectors.canonical_json.valid) {
      assert.equal(canonicalize(JSON.parse(v.input_json)), v.canonical, v.name);
    }
    assert.throws(() => canonicalize({ a: 1.5 }));
  });

  test('verifies a signed check response and refuses tampering / unknown keys', () => {
    const env = vectors.check_response.envelope;
    const payload = verifyEnvelope(env, KEYS);
    assert.equal(payload.typ, 'check');
    assert.equal(verifyEnvelope({ ...env, payload: { ...env.payload, status: 'revoked' } }, KEYS), null);
    assert.equal(verifyEnvelope(env, [{ kid: 'other', public_key: KEYS[0].public_key }]), null);
    assert.equal(verifyEnvelope(env, []), null);
  });

  test('request signature matches the Worker', () => {
    const v = vectors.client_request_signature;
    const key = JSON.parse(v.body).license_key;
    assert.equal(requestSignature(sha256(key), v.timestamp, v.method, v.path, v.body), v.signature);
  });
});

describe('device', () => {
  test('fingerprint is stable and well formed', () => {
    delete process.env.SANAD_FINGERPRINT;
    const a = fingerprint('sanad');
    assert.match(a, /^snd_[A-Za-z0-9_-]{40}$/);
    assert.equal(fingerprint('sanad'), a);
    assert.notEqual(fingerprint('other'), a);
  });

  test('device info has the details ElevaHub shows', () => {
    const info = deviceInfo('0.2.0');
    for (const key of ['hostname', 'os', 'cpu', 'cores', 'ram_gb', 'app_version']) assert.ok(key in info, key);
    assert.equal(info.app_version, '0.2.0');
  });
});

/** A fake license-api Worker (same rules as workers/license-api/src/desktop.ts). */
function fakeServer() {
  const devices = new Map();
  const server = {
    devices,
    offline: false,
    calls: [],
    clock: Date.now(),
    async fetch(url, init) {
      if (server.offline) throw new TypeError('fetch failed');
      const path = new URL(url).pathname;
      const body = JSON.parse(init.body);
      server.calls.push(path);
      const respond = (status, json) => ({ status, json: async () => json });
      const doc = (d, nonce) => {
        const now = server.clock;
        let status;
        let validUntil = now + DAY;
        if (d.blocked) status = 'blocked';
        else if (d.license) {
          status = d.license.status || 'active';
          if (status === 'active') validUntil = now + 30 * DAY;
        } else if (Date.parse(d.trial_ends_at) > now) {
          status = 'trial';
          validUntil = Date.parse(d.trial_ends_at);
        } else status = 'trial_expired';
        return sign({
          typ: 'desktop', status, device_id: d.id, product: 'sanad', fingerprint: d.fingerprint, email: d.email, nonce,
          server_time: iso(now), valid_until: iso(validUntil), trial_started_at: d.trial_started_at, trial_ends_at: d.trial_ends_at,
          license: d.license ? { license_id: 'lic-1', customer: d.license.customer, issued_at: iso(now), expires_at: d.license.expires_at || null, limits: {}, features: {}, policy: {}, version: 1 } : null,
        });
      };
      if (path === '/v1/desktop/register') {
        let d = [...devices.values()].find((x) => x.fingerprint === body.fingerprint);
        const secret = crypto.randomBytes(32).toString('base64url');
        if (!d) {
          d = { id: `dev_${crypto.randomBytes(12).toString('base64url')}`, fingerprint: body.fingerprint, trial_started_at: iso(server.clock), trial_ends_at: iso(server.clock + 14 * DAY) };
          devices.set(d.id, d);
        }
        Object.assign(d, { email: body.email.toLowerCase(), secret, device: body.device });
        return respond(200, { device_id: d.id, device_secret: secret, ...doc(d, body.nonce) });
      }
      if (path === '/v1/desktop/status') {
        const d = devices.get(body.device_id);
        if (!d) return respond(404, { error: 'unknown_device' });
        const ts = init.headers['x-eleva-timestamp'];
        if (init.headers['x-eleva-signature'] !== requestSignature(sha256(d.secret), ts, 'POST', path, init.body)) return respond(401, { error: 'bad_signature' });
        if (body.fingerprint !== d.fingerprint) return respond(200, { ...doc({ ...d, blocked: true }, body.nonce) });
        return respond(200, doc(d, body.nonce));
      }
      return respond(404, { error: 'not_found' });
    },
  };
  return server;
}

function memoryStore(initial = {}) {
  const data = { ...initial };
  return {
    data,
    get: (k) => (k in data ? data[k] : null),
    set: (values) => Object.assign(data, values),
    clear: (keys) => keys.forEach((k) => delete data[k]),
  };
}

describe('licensing flow', () => {
  let server;
  let store;
  let clock;
  const make = (overrides = {}) =>
    createLicensing({
      store,
      config: { apiUrl: 'https://license.test', product: 'sanad', publicKeys: KEYS },
      appVersion: '0.2.0',
      fetchImpl: server.fetch,
      now: () => clock,
      ...overrides,
    });

  beforeEach(() => {
    process.env.SANAD_FINGERPRINT = 'snd_machine_A_0000000000000000000000000';
    server = fakeServer();
    store = memoryStore();
    clock = Date.now();
    server.clock = clock;
  });

  test('licensing is off without a server url', () => {
    const lic = createLicensing({ store, config: { apiUrl: '', product: 'sanad', publicKeys: KEYS }, appVersion: '1' });
    assert.equal(lic.status().state, 'off');
    assert.equal(lic.usable(), true);
  });

  test('first run asks to register; registering starts a 14-day trial', async () => {
    const lic = make();
    assert.equal(lic.status().state, 'unregistered');
    assert.equal(lic.usable(), false);
    const s = await lic.register({ email: 'Owner@Example.com', name: 'محمد', company: 'معرض' });
    assert.equal(s.state, 'trial');
    assert.equal(s.daysLeft, 14);
    assert.equal(s.email, 'owner@example.com');
    assert.equal(lic.usable(), true);
    assert.equal([...server.devices.values()][0].device.app_version, '0.2.0');
  });

  test('trial counts down and locks after 14 days, even offline', async () => {
    const lic = make();
    await lic.register({ email: 'a@b.co' });
    clock += 10 * DAY + 3600_000;
    assert.equal(lic.status().daysLeft, 4);
    clock += 4 * DAY;
    server.offline = true;
    const s = await lic.check();
    assert.equal(s.state, 'locked');
    assert.equal(s.reason, 'trial_expired');
    assert.equal(s.checkFailed, 'offline');
  });

  test('setting the clock back does not reopen an ended trial', async () => {
    const lic = make();
    await lic.register({ email: 'a@b.co' });
    clock += 15 * DAY;
    assert.equal(lic.status().state, 'locked');
    clock -= 10 * DAY; // user sets the PC clock back
    assert.equal(lic.status().state, 'locked');
  });

  test('activation in the Hub turns the app active; it stays usable offline for 30 days', async () => {
    const lic = make();
    await lic.register({ email: 'a@b.co' });
    const d = [...server.devices.values()][0];
    d.license = { customer: 'معرض المثال' };
    const s = await lic.check();
    assert.equal(s.state, 'active');
    assert.equal(s.license.customer, 'معرض المثال');

    server.offline = true;
    clock += 29 * DAY;
    assert.equal(lic.status().state, 'active');
    clock += 2 * DAY;
    const late = lic.status();
    assert.equal(late.state, 'locked');
    assert.equal(late.reason, 'offline_too_long');

    server.offline = false;
    server.clock = clock;
    assert.equal((await lic.check()).state, 'active');
  });

  test('suspended / blocked / expired licenses lock the app', async () => {
    const lic = make();
    await lic.register({ email: 'a@b.co' });
    const d = [...server.devices.values()][0];
    d.license = { customer: 'x', status: 'suspended' };
    assert.equal((await lic.check()).reason, 'suspended');
    d.license = { customer: 'x', expires_at: iso(clock + DAY) };
    assert.equal((await lic.check()).state, 'active');
    clock += 2 * DAY;
    assert.equal(lic.status().reason, 'expired');
    d.blocked = true;
    server.clock = clock;
    assert.equal((await lic.check()).reason, 'blocked');
  });

  test('a copy on another PC must register again (and gets its own trial)', async () => {
    const lic = make();
    await lic.register({ email: 'a@b.co' });
    [...server.devices.values()][0].license = { customer: 'x' };
    await lic.check();
    assert.equal(lic.status().state, 'active');

    process.env.SANAD_FINGERPRINT = 'snd_machine_B_0000000000000000000000000';
    const copy = make();
    const s = copy.status();
    assert.equal(s.state, 'unregistered');
    assert.equal(s.reason, 'device_changed');
    assert.equal(copy.usable(), false);
    const registered = await copy.register({ email: 'buyer@x.co' });
    assert.equal(registered.state, 'trial');
    assert.equal(server.devices.size, 2);
  });

  test('re-registering the same PC keeps the server trial (reinstall does not reset it)', async () => {
    const lic = make();
    await lic.register({ email: 'a@b.co' });
    clock += 15 * DAY;
    server.clock = clock;
    store.clear(['device_id', 'device_secret', 'document']); // "reinstall"
    const again = await make().register({ email: 'a@b.co' });
    assert.equal(again.state, 'locked');
    assert.equal(again.reason, 'trial_expired');
  });

  test('an edited document or secret is not trusted', async () => {
    const lic = make();
    await lic.register({ email: 'a@b.co' });
    const doc = JSON.parse(store.get('document'));
    doc.payload.status = 'active';
    doc.payload.valid_until = '2099-01-01T00:00:00Z';
    store.set({ document: JSON.stringify(doc) });
    assert.equal(lic.status().state, 'unregistered');
    assert.equal(lic.status().reason, 'invalid');
  });

  test('a secret that cannot be decrypted (copied database) means register again', async () => {
    const lic = make({ protect: (s) => `enc:${s}`, unprotect: (s) => s.slice(4) });
    await lic.register({ email: 'a@b.co' });
    assert.equal(lic.status().state, 'trial');
    const other = make({ unprotect: () => {
      throw new Error('cannot decrypt');
    } });
    assert.equal(other.status().reason, 'device_changed');
  });

  test('network failures and bad answers never change the state', async () => {
    const lic = make();
    await lic.register({ email: 'a@b.co' });
    server.offline = true;
    const s = await lic.check();
    assert.equal(s.state, 'trial');
    assert.equal(s.checkFailed, 'offline');
    server.offline = false;
    const realFetch = server.fetch;
    const forged = make({
      fetchImpl: async (url, init) => {
        const res = await realFetch(url, init);
        const json = await res.json();
        json.payload.status = 'active';
        return { status: 200, json: async () => json };
      },
    });
    const after = await forged.check();
    assert.equal(after.checkFailed, 'bad_response');
    assert.equal(after.state, 'trial');
  });

  test('an unknown device (deleted at the server) asks to register again', async () => {
    const lic = make();
    await lic.register({ email: 'a@b.co' });
    server.devices.clear();
    assert.equal((await lic.check()).state, 'unregistered');
  });

  test('register reports offline and rate limits', async () => {
    server.offline = true;
    await assert.rejects(make().register({ email: 'a@b.co' }), /LICENSE_OFFLINE/);
    const limited = make({ fetchImpl: async () => ({ status: 429, json: async () => ({ error: 'rate_limited' }) }) });
    await assert.rejects(limited.register({ email: 'a@b.co' }), /LICENSE_RATE_LIMITED/);
  });
});
