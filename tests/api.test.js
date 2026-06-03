import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import app from '../server/server.js';

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('ESP32-C3 alarm API', () => {
  it('returns MCU config from /clock', async () => {
    const response = await fetch(`${baseUrl}/clock?device_id=alarm_c3_001`);
    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.deviceId, 'alarm_c3_001');
    assert.equal(typeof data.commandId, 'number');
    assert.equal(data.command, 'none');
  });

  it('accepts MCU status and exposes it to web status', async () => {
    const statusResponse = await fetch(`${baseUrl}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'alarm_c3_001',
        online: true,
        state: 'IDLE',
        wifiOk: true,
        wifiRssi: -50,
        timeOk: true,
        drvOk: true,
        heap: 123456
      })
    });

    assert.equal(statusResponse.status, 200);

    const webResponse = await fetch(`${baseUrl}/web/status?device_id=alarm_c3_001`);
    assert.equal(webResponse.status, 200);

    const data = await webResponse.json();
    assert.equal(data.status.state, 'IDLE');
    assert.equal(data.status.heap, 123456);
    assert.equal(data.config.deviceId, 'alarm_c3_001');
  });

  it('updates config and increments command id for web commands', async () => {
    const configResponse = await fetch(`${baseUrl}/web/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'alarm_c3_001',
        enabled: false,
        hour: 9,
        minute: 15,
        repeatMask: 127,
        hapticEffect: 24
      })
    });

    assert.equal(configResponse.status, 200);
    const configData = await configResponse.json();
    assert.equal(configData.config.enabled, false);
    assert.equal(configData.config.hour, 9);
    assert.equal(configData.config.minute, 15);

    const commandResponse = await fetch(`${baseUrl}/web/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'alarm_c3_001',
        command: 'test_haptic',
        hapticEffect: 17
      })
    });

    assert.equal(commandResponse.status, 200);
    const commandData = await commandResponse.json();
    assert.equal(commandData.config.command, 'test_haptic');
    assert.equal(commandData.config.hapticEffect, 17);
    assert.ok(commandData.commandId > 0);
  });
});
