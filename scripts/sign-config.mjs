import { createHmac } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SIGNED_FIELDS = [
  'deviceId',
  'enabled',
  'hour',
  'minute',
  'repeatMask',
  'prealertSec',
  'snoozeMin',
  'maxRingSec',
  'hapticEffect',
  'ledPairBrightness',
  'flashLedBrightness',
  'version',
  'commandId',
  'command'
];

function parseArgs(argv) {
  const args = {
    input: '',
    secret: process.env.ALARM_CONFIG_HMAC_SECRET || ''
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if ((arg === '--input' || arg === '-i') && next) {
      args.input = next;
      index += 1;
    } else if (arg === '--secret' && next) {
      args.secret = next;
      index += 1;
    }
  }

  return args;
}

function requiredNumber(config, key) {
  if (!Number.isInteger(config[key])) {
    throw new Error(`${key} must be an integer`);
  }
  return String(config[key]);
}

function requiredZeroToTen(config, key) {
  const value = config[key];
  if (!Number.isInteger(value) || value < 0 || value > 10) {
    throw new Error(`${key} must be an integer from 0 to 10`);
  }
  return String(value);
}

function buildPayload(config) {
  if (typeof config.deviceId !== 'string' || config.deviceId.length === 0) {
    throw new Error('deviceId must be a non-empty string');
  }

  if (typeof config.enabled !== 'boolean') {
    throw new Error('enabled must be a boolean');
  }

  if (typeof config.command !== 'string') {
    throw new Error('command must be a string');
  }

  return [
    config.deviceId,
    config.enabled ? '1' : '0',
    requiredNumber(config, 'hour'),
    requiredNumber(config, 'minute'),
    requiredNumber(config, 'repeatMask'),
    requiredZeroToTen(config, 'prealertSec'),
    requiredZeroToTen(config, 'snoozeMin'),
    requiredZeroToTen(config, 'maxRingSec'),
    requiredZeroToTen(config, 'hapticEffect'),
    requiredZeroToTen(config, 'ledPairBrightness'),
    requiredZeroToTen(config, 'flashLedBrightness'),
    requiredZeroToTen(config, 'version'),
    requiredNumber(config, 'commandId'),
    config.command
  ].join('|');
}

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

const args = parseArgs(process.argv);

if (!args.input) {
  console.error('Usage: node scripts/sign-config.mjs --input public/devices/alarm_c3_001.json');
  process.exit(1);
}

if (!args.secret) {
  console.error('Missing secret. Set ALARM_CONFIG_HMAC_SECRET or pass --secret for local testing.');
  process.exit(1);
}

const inputPath = resolve(args.input);
const config = JSON.parse(await readFile(inputPath, 'utf8'));

for (const key of SIGNED_FIELDS) {
  if (!(key in config)) {
    throw new Error(`Missing signed field: ${key}`);
  }
}

const payload = buildPayload(config);
const signature = sign(payload, args.secret);
const signedConfig = { ...config, signature };

await writeFile(inputPath, `${JSON.stringify(signedConfig, null, 2)}\n`, 'utf8');

console.log(`Signed ${args.input}`);
console.log(`Payload: ${payload}`);
console.log(`Signature: ${signature}`);
