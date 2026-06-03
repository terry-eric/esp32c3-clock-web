import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { __test } from '../functions/api/[[path]].js';

function request(path, init = {}) {
  return new Request(`https://example.pages.dev/api${path}`, init);
}

async function call(path, init = {}, env = {}) {
  return __test.handleRequest({
    request: request(path, init),
    env
  });
}

beforeEach(() => {
  __test.memoryStore.clear();
});

describe('Cloudflare Pages Function API', () => {
  it('serves health checks', async () => {
    const response = await call('/health');
    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.ok, true);
    assert.equal(data.service, 'esp32-c3-alarm-api');
  });

  it('requires DEVICE_TOKEN for MCU endpoints when configured', async () => {
    const denied = await call('/clock?device_id=alarm_c3_001', {}, { DEVICE_TOKEN: 'secret' });
    assert.equal(denied.status, 401);

    const deniedSync = await call('/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'alarm_c3_001', state: 'IDLE' })
    }, { DEVICE_TOKEN: 'secret' });
    assert.equal(deniedSync.status, 401);

    const allowed = await call('/clock?device_id=alarm_c3_001', {
      headers: { 'X-Device-Token': 'secret' }
    }, { DEVICE_TOKEN: 'secret' });
    assert.equal(allowed.status, 200);
  });

  it('stores MCU status and exposes it to web API', async () => {
    const status = await call('/state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Token': 'device-secret'
      },
      body: JSON.stringify({
        deviceId: 'alarm_c3_001',
        state: 'IDLE',
        heap: 200000
      })
    }, { DEVICE_TOKEN: 'device-secret' });

    assert.equal(status.status, 200);

    const web = await call('/web/status?device_id=alarm_c3_001');
    assert.equal(web.status, 200);

    const data = await web.json();
    assert.equal(data.status.state, 'IDLE');
    assert.equal(data.status.heap, 200000);
  });

  it('syncs MCU status and returns the current config in one request', async () => {
    const update = await call('/web/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'alarm_c3_001',
        hour: 8,
        minute: 15
      })
    });
    assert.equal(update.status, 200);

    const sync = await call('/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Token': 'device-secret'
      },
      body: JSON.stringify({
        deviceId: 'alarm_c3_001',
        state: 'IDLE',
        wifiRssi: -55,
        heap: 190000
      })
    }, { DEVICE_TOKEN: 'device-secret' });

    assert.equal(sync.status, 200);
    const syncData = await sync.json();
    assert.equal(syncData.success, true);
    assert.equal(syncData.config.hour, 8);
    assert.equal(syncData.config.minute, 15);

    const web = await call('/web/status?device_id=alarm_c3_001');
    assert.equal(web.status, 200);

    const data = await web.json();
    assert.equal(data.status.state, 'IDLE');
    assert.equal(data.status.heap, 190000);
  });

  it('rejects unsupported web commands', async () => {
    const response = await call('/web/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'alarm_c3_001',
        command: 'format_flash'
      })
    });

    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(data.error, 'Unsupported command');
  });
});
