// The machine this copy runs on: a stable fingerprint (from the OS machine id, never sent raw) and the
// device details shown to Eleva in ElevaHub. A database or app folder copied to another PC gets
// another fingerprint, so its signed license or trial does not apply there.

const os = require('node:os');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { sha256 } = require('./crypto.cjs');

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', timeout: 5000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

/** The OS machine id: Windows MachineGuid, macOS IOPlatformUUID, Linux /etc/machine-id. */
function machineId() {
  if (process.platform === 'win32') {
    const out = run('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid']);
    const m = out.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]{36})/);
    if (m) return `win:${m[1].toLowerCase()}`;
  } else if (process.platform === 'darwin') {
    const m = run('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice']).match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
    if (m) return `mac:${m[1].toLowerCase()}`;
  } else {
    for (const file of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
      try {
        const id = fs.readFileSync(file, 'utf8').trim();
        if (id) return `linux:${id}`;
      } catch {
        // next
      }
    }
  }
  // Fallback: hardware that rarely changes.
  const macs = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && !i.internal && i.mac && i.mac !== '00:00:00:00:00:00')
    .map((i) => i.mac)
    .sort();
  return `fallback:${os.hostname()}|${(os.cpus()[0] || {}).model}|${os.totalmem()}|${macs[0] || ''}`;
}

/** `snd_` + 40 base64url characters of SHA-256(product + machine id). Tests may override it. */
function fingerprint(product = 'sanad') {
  if (process.env.SANAD_FINGERPRINT) return process.env.SANAD_FINGERPRINT;
  return `snd_${sha256(`${product}:${machineId()}`).toString('base64url').slice(0, 40)}`;
}

/** Details shown in ElevaHub next to the registration (display only). */
function deviceInfo(appVersion) {
  let user = '';
  try {
    user = os.userInfo().username;
  } catch {
    // some sandboxes have no user entry
  }
  const cpu = os.cpus()[0];
  const clip = (s) => String(s || '').slice(0, 200);
  return {
    hostname: clip(process.env.SANAD_HOSTNAME || os.hostname()),
    os: clip(`${typeof os.version === 'function' ? os.version() : os.type()} ${os.release()}`),
    arch: clip(os.arch()),
    cpu: clip(cpu && cpu.model ? cpu.model.trim() : ''),
    cores: os.cpus().length,
    ram_gb: Math.round(os.totalmem() / 1024 ** 3),
    user: clip(user),
    app_version: clip(appVersion),
  };
}

module.exports = { fingerprint, deviceInfo, machineId };
