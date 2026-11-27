// Eleva license format helpers (ElevaHub docs/LICENSE-FORMAT.md): canonical JSON, Ed25519 verification
// with the public keys the app ships, and the HMAC request signature. Must match the Hub and the
// license-api Worker byte for byte (tests/licensing.test.cjs runs the shared test vectors).

const crypto = require('node:crypto');

const KEY = /^[\x20-\x7e]+$/;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

class CanonicalError extends Error {}

function canonicalize(value) {
  if (value === null) return 'null';
  if (value === true) return 'true';
  if (value === false) return 'false';
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new CanonicalError('Only safe integers are allowed.');
    return String(value === 0 ? 0 : value);
  }
  if (typeof value === 'string') {
    if (LONE_SURROGATE.test(value)) throw new CanonicalError('Strings must be valid Unicode.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    for (const k of keys) if (!KEY.test(k)) throw new CanonicalError(`Object keys must be printable ASCII: ${k}`);
    keys.sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
  }
  throw new CanonicalError(`Unsupported value: ${typeof value}`);
}

// DER prefix of an Ed25519 SubjectPublicKeyInfo; the raw 32-byte key follows.
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function publicKeyFromRaw(base64) {
  const raw = Buffer.from(base64, 'base64');
  if (raw.length !== 32) throw new Error('An Ed25519 public key is 32 bytes.');
  return crypto.createPublicKey({ key: Buffer.concat([SPKI_ED25519_PREFIX, raw]), format: 'der', type: 'spki' });
}

/**
 * Verifies a signed envelope {kid, payload, signature} against the shipped keys ([{kid, public_key}]).
 * Returns the payload, or null when the kid is unknown, the payload cannot be canonicalised or the
 * signature does not match.
 */
function verifyEnvelope(envelope, publicKeys) {
  if (!envelope || typeof envelope !== 'object') return null;
  const { kid, payload, signature } = envelope;
  if (typeof kid !== 'string' || typeof signature !== 'string' || !payload || typeof payload !== 'object') return null;
  const entry = (publicKeys || []).find((k) => k.kid === kid);
  if (!entry) return null;
  let message;
  try {
    message = canonicalize(payload);
  } catch {
    return null;
  }
  let ok = false;
  try {
    ok = crypto.verify(null, Buffer.from(message, 'utf8'), publicKeyFromRaw(entry.public_key), Buffer.from(signature, 'base64'));
  } catch {
    return null;
  }
  if (!ok || payload.kid !== kid) return null;
  return payload;
}

const sha256 = (data) => crypto.createHash('sha256').update(data).digest();

/** `v1=` + hex HMAC-SHA256(key, timestamp \n METHOD \n path \n body). */
function requestSignature(keyBytes, timestamp, method, path, body) {
  return `v1=${crypto.createHmac('sha256', keyBytes).update(`${timestamp}\n${method.toUpperCase()}\n${path}\n${body}`).digest('hex')}`;
}

const randomId = (prefix, bytes = 12) => prefix + crypto.randomBytes(bytes).toString('base64url');

module.exports = { canonicalize, CanonicalError, verifyEnvelope, requestSignature, sha256, randomId, publicKeyFromRaw };
