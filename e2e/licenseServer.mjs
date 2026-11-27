// A local stand-in for the license-api Worker's desktop endpoints, signing with the public TEST key
// from the ElevaHub vectors. Same rules as workers/license-api/src/desktop.ts.
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const vectors = require('../tests/fixtures/license-test-vectors.json');
const { canonicalize, requestSignature, sha256 } = require('../electron/licensing/crypto.cjs');

const PRIVATE = crypto.createPrivateKey({ key: Buffer.from(vectors.test_key.pkcs8_der_base64, 'base64'), format: 'der', type: 'pkcs8' });
const DAY = 86_400_000;
const iso = (ms) => new Date(Math.floor(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z');

export const TEST_KEYS = JSON.stringify([{ kid: vectors.test_key.kid, public_key: vectors.test_key.public_key_base64 }]);

export async function startLicenseServer() {
  const devices = new Map();

  const sign = (payload) => {
    const full = { ...payload, kid: vectors.test_key.kid };
    return { kid: full.kid, payload: full, signature: crypto.sign(null, Buffer.from(canonicalize(full)), PRIVATE).toString('base64') };
  };

  const doc = (d, nonce, fingerprint) => {
    const now = Date.now();
    let status;
    let validUntil = now + DAY;
    if (fingerprint !== undefined && fingerprint !== d.fingerprint) status = 'device_mismatch';
    else if (d.blocked) status = 'blocked';
    else if (d.license) {
      status = 'active';
      validUntil = now + 30 * DAY;
    } else if (Date.parse(d.trial_ends_at) > now) {
      status = 'trial';
      validUntil = Date.parse(d.trial_ends_at);
    } else status = 'trial_expired';
    return sign({
      typ: 'desktop', status, device_id: d.id, product: 'sanad', fingerprint: d.fingerprint, email: d.email, nonce,
      server_time: iso(now), valid_until: iso(validUntil), trial_started_at: d.trial_started_at, trial_ends_at: d.trial_ends_at,
      license: d.license ? { license_id: '0b9e7c1e-5d2a-4f7e-9c3b-2a1d4e5f6a7b', customer: d.license.customer, issued_at: iso(now), expires_at: null, limits: {}, features: {}, policy: {}, version: 1 } : null,
    });
  };

  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const send = (status, json) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(json));
      };
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return send(400, { error: 'invalid_request' });
      }
      if (req.url === '/v1/desktop/register') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email || '')) return send(400, { error: 'invalid_email' });
        let d = [...devices.values()].find((x) => x.fingerprint === body.fingerprint);
        const secret = crypto.randomBytes(32).toString('base64url');
        if (!d) {
          const now = Date.now();
          d = { id: `dev_${crypto.randomBytes(12).toString('base64url')}`, fingerprint: body.fingerprint, trial_started_at: iso(now), trial_ends_at: iso(now + 14 * DAY) };
          devices.set(d.id, d);
        }
        Object.assign(d, { email: body.email.toLowerCase(), secret, info: body });
        return send(200, { device_id: d.id, device_secret: secret, ...doc(d, body.nonce) });
      }
      if (req.url === '/v1/desktop/status') {
        const d = devices.get(body.device_id);
        if (!d) return send(404, { error: 'unknown_device' });
        const expected = requestSignature(sha256(d.secret), req.headers['x-eleva-timestamp'], 'POST', req.url, raw);
        if (req.headers['x-eleva-signature'] !== expected) return send(401, { error: 'bad_signature' });
        return send(200, doc(d, body.nonce, body.fingerprint));
      }
      return send(404, { error: 'not_found' });
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    devices,
    byEmail: (email) => [...devices.values()].find((d) => d.email === email),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
