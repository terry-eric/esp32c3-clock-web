import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';

const app = express();
const PORT = Number(process.env.PORT || 8000);
const DEVICE_TOKEN = process.env.DEVICE_TOKEN || '';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';

app.use(cors({
  origin: FRONTEND_ORIGIN === '*' ? true : FRONTEND_ORIGIN.split(',').map((origin) => origin.trim()),
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Device-Id', 'X-Device-Token']
}));
app.use(express.json({ limit: '64kb' }));

const defaultDeviceId = 'alarm_c3_001';
const allowedCommands = new Set([
  'none',
  'test_led',
  'test_haptic',
  'start_alarm',
  'stop_alarm',
  'snooze'
]);
const deviceConfigs = new Map();
const deviceStatuses = new Map();

function defaultConfig(deviceId = defaultDeviceId) {
  return {
    deviceId,
    enabled: true,
    hour: 7,
    minute: 30,
    repeatMask: 62,
    prealertSec: 60,
    snoozeMin: 5,
    maxRingSec: 300,
    hapticEffect: 17,
    version: 1,
    commandId: 0,
    command: 'none'
  };
}

function defaultStatus(deviceId = defaultDeviceId) {
  return {
    deviceId,
    online: false,
    state: 'BOOT',
    wifiOk: false,
    wifiRssi: 0,
    ip: '',
    timeOk: false,
    time: '',
    drvOk: false,
    alarmEnabled: false,
    alarmTime: '00:00',
    repeatMask: 0,
    lastAction: 'NONE',
    configVersion: 0,
    lastCommandId: 0,
    heap: 0,
    lastSeen: null
  };
}

function getConfig(deviceId) {
  if (!deviceConfigs.has(deviceId)) {
    deviceConfigs.set(deviceId, defaultConfig(deviceId));
  }
  return deviceConfigs.get(deviceId);
}

function requireToken(req, res, next) {
  if (!DEVICE_TOKEN) {
    return next();
  }

  const token = req.get('X-Device-Token') || '';
  if (token !== DEVICE_TOKEN) {
    return res.status(401).json({ error: 'Invalid or missing X-Device-Token' });
  }

  return next();
}

function numberIn(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normalizeConfig(input, previous) {
  return {
    ...previous,
    enabled: typeof input.enabled === 'boolean' ? input.enabled : previous.enabled,
    hour: numberIn(input.hour, previous.hour, 0, 23),
    minute: numberIn(input.minute, previous.minute, 0, 59),
    repeatMask: numberIn(input.repeatMask, previous.repeatMask, 0, 127),
    prealertSec: numberIn(input.prealertSec, previous.prealertSec, 0, 3600),
    snoozeMin: numberIn(input.snoozeMin, previous.snoozeMin, 1, 60),
    maxRingSec: numberIn(input.maxRingSec, previous.maxRingSec, 10, 3600),
    hapticEffect: numberIn(input.hapticEffect, previous.hapticEffect, 1, 123)
  };
}

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'esp32-c3-alarm-api' });
});

// MCU endpoint: GET /clock?device_id=alarm_c3_001
app.get('/clock', requireToken, (req, res) => {
  const deviceId = String(req.query.device_id || defaultDeviceId);
  res.json(getConfig(deviceId));
});

// MCU endpoint: POST /state
app.post('/state', requireToken, (req, res) => {
  const status = req.body || {};
  const deviceId = String(status.deviceId || req.get('X-Device-Id') || defaultDeviceId);

  deviceStatuses.set(deviceId, {
    ...status,
    deviceId,
    online: true,
    lastSeen: new Date().toISOString()
  });

  res.json({ success: true });
});

// Web endpoint: GET /web/status?device_id=alarm_c3_001
app.get('/web/status', requireToken, (req, res) => {
  const deviceId = String(req.query.device_id || defaultDeviceId);
  res.json({
    config: getConfig(deviceId),
    status: deviceStatuses.get(deviceId) || defaultStatus(deviceId)
  });
});

// Web endpoint: POST /web/config
app.post('/web/config', requireToken, (req, res) => {
  const body = req.body || {};
  const deviceId = String(body.deviceId || defaultDeviceId);
  const previous = getConfig(deviceId);
  const next = {
    ...normalizeConfig(body, previous),
    deviceId,
    version: previous.version + 1
  };

  deviceConfigs.set(deviceId, next);
  res.json({ success: true, config: next });
});

// Web endpoint: POST /web/command
app.post('/web/command', requireToken, (req, res) => {
  const body = req.body || {};
  const deviceId = String(body.deviceId || defaultDeviceId);
  const previous = getConfig(deviceId);
  const command = String(body.command || 'none');

  if (!allowedCommands.has(command)) {
    return res.status(400).json({
      error: 'Unsupported command',
      allowedCommands: Array.from(allowedCommands)
    });
  }

  const next = {
    ...previous,
    command,
    commandId: previous.commandId + 1,
    hapticEffect: numberIn(body.hapticEffect, previous.hapticEffect, 1, 123),
    version: previous.version + 1
  };

  deviceConfigs.set(deviceId, next);
  res.json({ success: true, commandId: next.commandId, config: next });
});

const isDirectRun = fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ESP32-C3 alarm API listening on port ${PORT}`);
    console.log('MCU endpoints: GET /clock, POST /state');
    console.log('Web endpoints: GET /web/status, POST /web/config, POST /web/command');
  });
}

export default app;
