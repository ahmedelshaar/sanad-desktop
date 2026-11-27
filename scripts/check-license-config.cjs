// Refuses a release build whose licensing config is empty or ships the public TEST key.
// Set SANAD_ALLOW_UNLICENSED=1 to build a copy without licensing on purpose.
const config = require('../electron/license-config.json');

const problems = [];
if (!config.apiUrl) problems.push('apiUrl is empty (licensing would be off)');
if (!Array.isArray(config.publicKeys) || config.publicKeys.length === 0) problems.push('publicKeys is empty');
if ((config.publicKeys || []).some((k) => /^test-/.test(k.kid))) problems.push('publicKeys contains the TEST key');

if (problems.length) {
  const msg = `electron/license-config.json: ${problems.join('; ')}`;
  if (process.env.SANAD_ALLOW_UNLICENSED === '1') {
    console.warn(`WARNING ${msg} — building anyway (SANAD_ALLOW_UNLICENSED=1).`);
  } else {
    console.error(`ERROR ${msg}. Fix the config or set SANAD_ALLOW_UNLICENSED=1.`);
    process.exit(1);
  }
}
