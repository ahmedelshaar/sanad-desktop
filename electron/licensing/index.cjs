// Licensing of the desktop app through ElevaHub (ElevaHub docs/DESKTOP-LICENSING.md).
//
// 1. First run: the user registers with an email; the app sends its fingerprint and device details to
//    the license-api Worker, which starts a 14-day trial counted on the server (reinstalling the app or
//    deleting its data does not restart it).
// 2. Every answer from the server is a signed document (Ed25519). The app keeps the last one and checks
//    it on every start against the public keys it ships, its own fingerprint and a clock that never
//    goes back. Editing the database, copying it to another PC or setting the clock back does not help.
// 3. The owner activates the device in ElevaHub; the next check returns `active` (bound to this
//    fingerprint). Without activation the app locks when the trial ends.
//
// Not DRM: someone who patches the app's code can remove the check. It keeps honest buyers honest and
// makes a copy useless on another machine without Eleva's activation.

const { verifyEnvelope, requestSignature, sha256, randomId } = require('./crypto.cjs');
const device = require('./device.cjs');

const DAY = 86_400_000;
const USABLE = new Set(['trial', 'active']);

/**
 * @param {object} o
 * @param {{get(k:string):string|null, set(values:object):void, clear(keys:string[]):void}} o.store
 * @param {{apiUrl:string, product:string, publicKeys:{kid:string, public_key:string}[]}} o.config
 * @param {string} o.appVersion
 * @param {(s:string)=>string} [o.protect]   encrypt the device secret at rest (Electron safeStorage)
 * @param {(s:string)=>string} [o.unprotect]
 * @param {typeof fetch} [o.fetchImpl]
 * @param {()=>number} [o.now]
 */
function createLicensing({ store, config, appVersion, protect = (s) => s, unprotect = (s) => s, fetchImpl = fetch, now = Date.now }) {
  const enabled = Boolean(config.apiUrl) && Array.isArray(config.publicKeys) && config.publicKeys.length > 0;
  const fp = device.fingerprint(config.product);

  /**
   * Time that never goes back: the latest of the wall clock, every server time we accepted and every
   * time this copy has seen before (so setting the PC clock back does not reopen an ended trial).
   */
  function trustedNow() {
    const high = Date.parse(store.get('high_water') || '') || 0;
    const t = now();
    if (t > high + 60_000) store.set({ high_water: new Date(t).toISOString() });
    return Math.max(t, high);
  }

  function remember(envelope, payload) {
    const high = Math.max(Date.parse(store.get('high_water') || '') || 0, Date.parse(payload.server_time) || 0, now());
    store.set({ document: JSON.stringify(envelope), high_water: new Date(high).toISOString(), last_check_at: new Date(now()).toISOString() });
  }

  /** A signed document from the server, checked against everything this copy knows. */
  function accept(envelope, expect) {
    const payload = verifyEnvelope(envelope, config.publicKeys);
    if (!payload || payload.typ !== 'desktop' || payload.product !== config.product) return null;
    if (payload.fingerprint !== fp) return null;
    if (expect.nonce !== undefined && payload.nonce !== expect.nonce) return null;
    if (expect.deviceId !== undefined && payload.device_id !== expect.deviceId) return null;
    return payload;
  }

  function secret() {
    const stored = store.get('device_secret');
    if (!stored) return null;
    try {
      return unprotect(stored);
    } catch {
      return null; // encrypted on another machine or user account
    }
  }

  /**
   * The current state, from the stored signed document only (no network).
   * state: off | unregistered | trial | active | locked
   */
  function status() {
    const base = { fingerprint: fp, enabled, apiConfigured: Boolean(config.apiUrl) };
    if (!enabled) return { ...base, state: 'off', usable: true };

    const deviceId = store.get('device_id');
    let envelope = null;
    try {
      envelope = JSON.parse(store.get('document') || 'null');
    } catch {
      envelope = null;
    }
    if (!deviceId || !envelope) return { ...base, state: 'unregistered', usable: false, reason: 'new' };

    const payload = verifyEnvelope(envelope, config.publicKeys);
    if (!payload || payload.typ !== 'desktop' || payload.device_id !== deviceId || payload.product !== config.product) {
      return { ...base, state: 'unregistered', usable: false, reason: 'invalid' };
    }
    if (payload.fingerprint !== fp || secret() === null) {
      return { ...base, state: 'unregistered', usable: false, reason: 'device_changed', email: payload.email };
    }

    const t = trustedNow();
    const info = {
      ...base,
      deviceId,
      email: payload.email,
      trialEndsAt: payload.trial_ends_at,
      validUntil: payload.valid_until,
      serverTime: payload.server_time,
      lastCheckAt: store.get('last_check_at'),
      license: payload.license ? { customer: payload.license.customer, expiresAt: payload.license.expires_at, features: payload.license.features || {} } : null,
    };
    const stale = t > Date.parse(payload.valid_until);

    if (payload.status === 'trial') {
      const left = Date.parse(payload.trial_ends_at) - t;
      if (left <= 0) return { ...info, state: 'locked', usable: false, reason: 'trial_expired' };
      return { ...info, state: 'trial', usable: true, daysLeft: Math.ceil(left / DAY) };
    }
    if (payload.status === 'active') {
      if (stale) return { ...info, state: 'locked', usable: false, reason: 'offline_too_long' };
      if (payload.license && payload.license.expires_at && Date.parse(payload.license.expires_at) <= t) {
        return { ...info, state: 'locked', usable: false, reason: 'expired' };
      }
      return { ...info, state: 'active', usable: true };
    }
    // trial_expired, expired, suspended, revoked, blocked, instance_mismatch, device_mismatch
    return { ...info, state: 'locked', usable: false, reason: payload.status };
  }

  async function post(path, body, keyBytes) {
    const text = JSON.stringify(body);
    const headers = { 'content-type': 'application/json' };
    if (keyBytes) {
      const ts = String(Math.floor(Date.now() / 1000));
      headers['x-eleva-timestamp'] = ts;
      headers['x-eleva-signature'] = requestSignature(keyBytes, ts, 'POST', path, text);
    }
    const res = await fetchImpl(config.apiUrl + path, { method: 'POST', headers, body: text, signal: AbortSignal.timeout(15000) });
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, json };
  }

  /** Registers this machine (first run, or again after a reinstall / a copy). */
  async function register({ email, name, phone, company }) {
    if (!enabled) throw new Error('LICENSE_OFF');
    const nonce = randomId('n-');
    let res;
    try {
      res = await post('/v1/desktop/register', {
        product: config.product,
        fingerprint: fp,
        email,
        name: name || null,
        phone: phone || null,
        company: company || null,
        device: device.deviceInfo(appVersion),
        app_version: appVersion,
        nonce,
      });
    } catch {
      throw new Error('LICENSE_OFFLINE');
    }
    if (res.status !== 200 || !res.json) throw new Error(`LICENSE_${String((res.json && res.json.error) || res.status).toUpperCase()}`);
    const { device_id: deviceId, device_secret: deviceSecret, kid, payload, signature } = res.json;
    const envelope = { kid, payload, signature };
    if (!accept(envelope, { nonce, deviceId }) || typeof deviceSecret !== 'string') throw new Error('LICENSE_BAD_RESPONSE');
    store.set({ device_id: deviceId, device_secret: protect(deviceSecret) });
    remember(envelope, payload);
    return status();
  }

  /** Asks the server for the current status. Network or unsigned errors never change the state. */
  async function check() {
    if (!enabled) return status();
    const deviceId = store.get('device_id');
    const key = secret();
    if (!deviceId || !key) return status();
    const nonce = randomId('n-');
    let res;
    try {
      res = await post('/v1/desktop/status', { device_id: deviceId, fingerprint: fp, nonce, app_version: appVersion }, sha256(key));
    } catch {
      return { ...status(), checkFailed: 'offline' };
    }
    if (res.status === 404 && res.json && res.json.error === 'unknown_device') {
      store.clear(['device_id', 'device_secret', 'document']);
      return status();
    }
    if (res.status !== 200 || !res.json) return { ...status(), checkFailed: (res.json && res.json.error) || String(res.status) };
    const envelope = { kid: res.json.kid, payload: res.json.payload, signature: res.json.signature };
    const payload = accept(envelope, { nonce, deviceId });
    if (!payload) return { ...status(), checkFailed: 'bad_response' };
    remember(envelope, payload);
    return status();
  }

  return { status, register, check, fingerprint: fp, enabled, usable: () => USABLE.has(status().state) || !enabled };
}

module.exports = { createLicensing };
