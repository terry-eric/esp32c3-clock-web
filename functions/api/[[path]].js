const defaultDeviceId = 'alarm_c3_001';
const allowedCommands = new Set([
  'none',
  'test_led',
  'test_haptic',
  'start_alarm',
  'stop_alarm',
  'snooze'
]);

const memoryStore = new Map();

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

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
}

function getPath(context) {
  const url = new URL(context.request.url);
  return url.pathname.replace(/^\/api\/?/, '/');
}

function hasToken(request, expectedToken) {
  if (!expectedToken) return true;
  return (request.headers.get('X-Device-Token') || '') === expectedToken;
}

function hasCloudflareAccess(request, env) {
  if (env.REQUIRE_CF_ACCESS !== 'true') return true;
  return Boolean(request.headers.get('CF-Access-Jwt-Assertion'));
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

async function readJson(env, key, fallback) {
  if (env.ALARM_KV) {
    const value = await env.ALARM_KV.get(key, 'json');
    return value || fallback;
  }

  return memoryStore.get(key) || fallback;
}

async function writeJson(env, key, value) {
  if (env.ALARM_KV) {
    await env.ALARM_KV.put(key, JSON.stringify(value));
    return;
  }

  memoryStore.set(key, value);
}

async function getConfig(env, deviceId) {
  const key = `config:${deviceId}`;
  const config = await readJson(env, key, null);
  if (config) return config;

  const initial = defaultConfig(deviceId);
  await writeJson(env, key, initial);
  return initial;
}

async function getStatus(env, deviceId) {
  return readJson(env, `status:${deviceId}`, defaultStatus(deviceId));
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function handleRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = getPath(context);

  if (path === '/health' && request.method === 'GET') {
    return json({
      ok: true,
      service: 'esp32-c3-alarm-api',
      storage: env.ALARM_KV ? 'kv' : 'memory'
    });
  }

  const isMcuEndpoint = path === '/clock' || path === '/state';
  const isWebEndpoint = path.startsWith('/web/');

  if (isMcuEndpoint && !hasToken(request, env.DEVICE_TOKEN || '')) {
    return json({ error: 'Invalid or missing X-Device-Token' }, { status: 401 });
  }

  if (isWebEndpoint && !hasCloudflareAccess(request, env)) {
    return json({ error: 'Cloudflare Access login required' }, { status: 401 });
  }

  if (path === '/clock' && request.method === 'GET') {
    const deviceId = String(url.searchParams.get('device_id') || defaultDeviceId);
    return json(await getConfig(env, deviceId));
  }

  if (path === '/state' && request.method === 'POST') {
    const body = await readBody(request);
    const deviceId = String(body.deviceId || request.headers.get('X-Device-Id') || defaultDeviceId);
    const status = {
      ...body,
      deviceId,
      online: true,
      lastSeen: new Date().toISOString()
    };

    await writeJson(env, `status:${deviceId}`, status);
    return json({ success: true });
  }

  if (path === '/web/status' && request.method === 'GET') {
    const deviceId = String(url.searchParams.get('device_id') || defaultDeviceId);
    return json({
      config: await getConfig(env, deviceId),
      status: await getStatus(env, deviceId)
    });
  }

  if (path === '/web/config' && request.method === 'POST') {
    const body = await readBody(request);
    const deviceId = String(body.deviceId || defaultDeviceId);
    const previous = await getConfig(env, deviceId);
    const next = {
      ...normalizeConfig(body, previous),
      deviceId,
      version: previous.version + 1
    };

    await writeJson(env, `config:${deviceId}`, next);
    return json({ success: true, config: next });
  }

  if (path === '/web/command' && request.method === 'POST') {
    const body = await readBody(request);
    const deviceId = String(body.deviceId || defaultDeviceId);
    const command = String(body.command || 'none');

    if (!allowedCommands.has(command)) {
      return json({
        error: 'Unsupported command',
        allowedCommands: Array.from(allowedCommands)
      }, { status: 400 });
    }

    const previous = await getConfig(env, deviceId);
    const next = {
      ...previous,
      command,
      commandId: previous.commandId + 1,
      hapticEffect: numberIn(body.hapticEffect, previous.hapticEffect, 1, 123),
      version: previous.version + 1
    };

    await writeJson(env, `config:${deviceId}`, next);
    return json({ success: true, commandId: next.commandId, config: next });
  }

  return json({ error: 'Not found' }, { status: 404 });
}

export async function onRequest(context) {
  return handleRequest(context);
}

export const __test = {
  handleRequest,
  memoryStore
};
