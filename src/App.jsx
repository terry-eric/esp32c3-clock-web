import React, { useEffect, useMemo, useState } from 'react';

const defaultConfig = {
  deviceId: 'alarm_c3_001',
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

const defaultStatus = {
  deviceId: 'alarm_c3_001',
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
  heap: 0
};

const modes = [
  {
    id: 'backend',
    title: 'Cloudflare 後端',
    badge: '安全遠端',
    summary: 'Web 只呼叫 /api/web/*，MCU 用 DEVICE_TOKEN 同步 /api/sync。'
  },
  {
    id: 'direct',
    title: '直接連 MCU',
    badge: '無後端',
    summary: 'Web 直接呼叫 MCU 的 /api/local/*，適合同 Wi-Fi 或手機熱點。'
  },
  {
    id: 'mcu',
    title: 'MCU 開網站',
    badge: '最簡單',
    summary: '瀏覽器打開 MCU IP，網站與 API 都由 ESP32-C3 提供。'
  }
];

const commands = [
  ['test_led', '測試 LED'],
  ['test_haptic', '測試震動'],
  ['start_alarm', '啟動鬧鐘'],
  ['stop_alarm', '停止鬧鐘'],
  ['snooze', '貪睡']
];

const days = [
  ['日', 0],
  ['一', 1],
  ['二', 2],
  ['三', 3],
  ['四', 4],
  ['五', 5],
  ['六', 6]
];

function cleanUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/+$/, '');
}

function readSetting(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  return window.localStorage.getItem(key) || fallback;
}

function statusColor(status) {
  if (!status.online) return 'bg-rose-500';
  if (!status.wifiOk || !status.timeOk || !status.drvOk) return 'bg-amber-400';
  return 'bg-emerald-400';
}

function buildPrompt(mode, deviceId, backendBase, mcuBase) {
  if (mode === 'backend') {
    return [
      '請幫我設定 ESP32-C3 鬧鐘專案使用 Cloudflare 後端模式。',
      `Device ID: ${deviceId}`,
      `Web API Base URL: ${backendBase || '/api'}`,
      '前端不要保存 DEVICE_TOKEN；Cloudflare Pages Function 使用 DEVICE_TOKEN 保護 /api/sync、/api/clock、/api/state。',
      'MCU 的 arduino_secrets.h 需要填 ALARM_SYNC_URL 與 ALARM_API_TOKEN。'
    ].join('\n');
  }

  if (mode === 'direct') {
    return [
      '請幫我設定 ESP32-C3 鬧鐘專案使用無後端直連模式。',
      `Device ID: ${deviceId}`,
      `MCU Base URL: ${mcuBase || 'http://<MCU-IP>'}`,
      'Web 端呼叫 MCU 的 /api/local/status、/api/local/config、/api/local/command。',
      'LOCAL_API_TOKEN 存在 MCU 的 arduino_secrets.h；如果有設定，瀏覽器直連時才輸入本機 token。'
    ].join('\n');
  }

  return [
    '請幫我設定 ESP32-C3 鬧鐘專案使用 MCU 自架網站模式。',
    `Device ID: ${deviceId}`,
    '瀏覽器直接開 http://<MCU-IP>/',
    'MCU 提供簡易網站與 /api/local/* API。',
    '不需要 Cloudflare 後端；LOCAL_API_TOKEN 存在 MCU 的 arduino_secrets.h。'
  ].join('\n');
}

export default function App() {
  const [mode, setMode] = useState(() => readSetting('connectionMode', 'backend'));
  const [apiBaseUrl, setApiBaseUrl] = useState(() => readSetting('apiBaseUrl', ''));
  const [mcuBaseUrl, setMcuBaseUrl] = useState(() => readSetting('mcuBaseUrl', ''));
  const [localToken, setLocalToken] = useState(() => readSetting('localToken', ''));
  const [deviceId, setDeviceId] = useState(() => readSetting('deviceId', 'alarm_c3_001'));
  const [config, setConfig] = useState(defaultConfig);
  const [status, setStatus] = useState(defaultStatus);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);

  const backendBase = useMemo(() => cleanUrl(apiBaseUrl) || '/api', [apiBaseUrl]);
  const mcuBase = useMemo(() => cleanUrl(mcuBaseUrl), [mcuBaseUrl]);
  const localApiBase = useMemo(() => `${mcuBase}/api/local`, [mcuBase]);
  const activeMode = modes.find((item) => item.id === mode) || modes[0];
  const prompt = useMemo(
    () => buildPrompt(mode, deviceId, backendBase, mcuBase),
    [mode, deviceId, backendBase, mcuBase]
  );

  const endpoints = useMemo(() => {
    if (mode === 'backend') {
      return {
        status: `${backendBase}/web/status?device_id=${encodeURIComponent(deviceId)}`,
        config: `${backendBase}/web/config`,
        command: `${backendBase}/web/command`
      };
    }

    return {
      status: `${localApiBase}/status?device_id=${encodeURIComponent(deviceId)}`,
      config: `${localApiBase}/config`,
      command: `${localApiBase}/command`
    };
  }, [mode, backendBase, localApiBase, deviceId]);

  useEffect(() => {
    window.localStorage.setItem('connectionMode', mode);
    window.localStorage.setItem('apiBaseUrl', apiBaseUrl);
    window.localStorage.setItem('mcuBaseUrl', mcuBaseUrl);
    window.localStorage.setItem('localToken', localToken);
    window.localStorage.setItem('deviceId', deviceId);
  }, [mode, apiBaseUrl, mcuBaseUrl, localToken, deviceId]);

  function requestHeaders() {
    const next = {
      'Content-Type': 'application/json'
    };

    if (mode !== 'backend' && localToken.trim()) {
      next['X-Local-Token'] = localToken.trim();
    }

    return next;
  }

  function addLog(type, message, data) {
    setLogs((items) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        time: new Date().toLocaleTimeString(),
        type,
        message,
        data
      },
      ...items.slice(0, 24)
    ]);
  }

  async function refreshStatus() {
    setBusy(true);
    try {
      const response = await fetch(endpoints.status, {
        headers: mode === 'backend' ? undefined : requestHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setConfig({ ...defaultConfig, ...(data.config || {}) });
      setStatus({ ...defaultStatus, ...(data.status || {}) });
      addLog('GET', '狀態已更新', data);
    } catch (error) {
      addLog('ERR', `讀取失敗：${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function updateConfig(patch) {
    const next = {
      ...config,
      ...patch,
      deviceId
    };

    setConfig(next);
    try {
      const response = await fetch(endpoints.config, {
        method: 'POST',
        headers: requestHeaders(),
        body: JSON.stringify(next)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setConfig({ ...defaultConfig, ...(data.config || next) });
      addLog('POST', '設定已送出', next);
    } catch (error) {
      addLog('ERR', `設定失敗：${error.message}`);
    }
  }

  async function sendCommand(command) {
    try {
      const response = await fetch(endpoints.command, {
        method: 'POST',
        headers: requestHeaders(),
        body: JSON.stringify({
          deviceId,
          command,
          hapticEffect: config.hapticEffect
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setConfig({ ...defaultConfig, ...(data.config || config) });
      addLog('CMD', `指令已送出：${command}`, data);
    } catch (error) {
      addLog('ERR', `指令失敗：${error.message}`);
    }
  }

  async function copyPrompt() {
    try {
      await window.navigator.clipboard.writeText(prompt);
      addLog('COPY', '提示器內容已複製');
    } catch (error) {
      addLog('ERR', `複製失敗：${error.message}`);
    }
  }

  useEffect(() => {
    refreshStatus();
    const timer = window.setInterval(refreshStatus, 15000);
    return () => window.clearInterval(timer);
  }, [endpoints.status, mode, localToken]);

  const alarmTime = `${String(config.hour).padStart(2, '0')}:${String(config.minute).padStart(2, '0')}`;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="border-b border-neutral-800 bg-neutral-900">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold">ESP32-C3 Alarm Hub</h1>
            <p className="mt-1 text-sm text-neutral-400">{activeMode.title} · {activeMode.summary}</p>
          </div>
          <button
            type="button"
            onClick={refreshStatus}
            className="h-10 rounded border border-neutral-700 bg-neutral-800 px-4 text-sm font-medium hover:bg-neutral-700"
          >
            {busy ? '更新中' : '重新整理'}
          </button>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-5">
          <div className="rounded border border-neutral-800 bg-neutral-900 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-neutral-400">目前狀態</p>
                <div className="mt-2 flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full ${statusColor(status)}`} />
                  <span className="text-3xl font-semibold">{status.state}</span>
                </div>
              </div>
              <div className="text-right text-sm text-neutral-400">
                <p>{status.deviceId || deviceId}</p>
                <p>{status.time || '尚未同步時間'}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <Info label="Wi-Fi" value={status.wifiOk ? `${status.wifiRssi} dBm` : '離線'} />
              <Info label="IP" value={status.ip || '-'} />
              <Info label="DRV2605L" value={status.drvOk ? 'OK' : '異常'} />
              <Info label="Heap" value={status.heap ? `${status.heap}` : '-'} />
            </div>
          </div>

          <div className="rounded border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-base font-semibold">鬧鐘設定</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-neutral-400">時間</span>
                <input
                  type="time"
                  value={alarmTime}
                  onChange={(event) => {
                    const [hour, minute] = event.target.value.split(':').map(Number);
                    updateConfig({ hour, minute });
                  }}
                  className="h-11 w-full rounded border border-neutral-700 bg-neutral-950 px-3 text-neutral-100"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-neutral-400">震動效果</span>
                <input
                  type="number"
                  min="1"
                  max="123"
                  value={config.hapticEffect}
                  onChange={(event) => updateConfig({ hapticEffect: Number(event.target.value) })}
                  className="h-11 w-full rounded border border-neutral-700 bg-neutral-950 px-3 text-neutral-100"
                />
              </label>
              <NumberField label="預提醒秒數" value={config.prealertSec} onChange={(value) => updateConfig({ prealertSec: value })} />
              <NumberField label="貪睡分鐘" value={config.snoozeMin} onChange={(value) => updateConfig({ snoozeMin: value })} />
            </div>

            <div className="mt-4">
              <div className="mb-2 text-sm text-neutral-400">重複日期</div>
              <div className="grid grid-cols-7 gap-2">
                {days.map(([label, bit]) => {
                  const selected = (config.repeatMask & (1 << bit)) !== 0;
                  return (
                    <button
                      key={bit}
                      type="button"
                      onClick={() => updateConfig({ repeatMask: config.repeatMask ^ (1 << bit) })}
                      className={`h-10 rounded border text-sm font-medium ${
                        selected
                          ? 'border-cyan-500 bg-cyan-500 text-neutral-950'
                          : 'border-neutral-700 bg-neutral-950 text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-neutral-800 pt-4">
              <span className="text-sm text-neutral-400">啟用鬧鐘</span>
              <button
                type="button"
                onClick={() => updateConfig({ enabled: !config.enabled })}
                className={`h-10 rounded px-4 text-sm font-semibold ${
                  config.enabled ? 'bg-emerald-500 text-neutral-950' : 'bg-neutral-800 text-neutral-300'
                }`}
              >
                {config.enabled ? '已啟用' : '已停用'}
              </button>
            </div>
          </div>

          <div className="rounded border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-base font-semibold">控制指令</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-5">
              {commands.map(([command, label]) => (
                <button
                  key={command}
                  type="button"
                  onClick={() => sendCommand(command)}
                  className="h-11 rounded border border-neutral-700 bg-neutral-950 px-3 text-sm font-medium hover:bg-neutral-800"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-base font-semibold">連線模式</h2>
            <div className="mt-4 grid gap-2">
              {modes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={`rounded border p-3 text-left ${
                    mode === item.id
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-neutral-800 bg-neutral-950 hover:bg-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{item.title}</span>
                    <span className="text-xs text-neutral-400">{item.badge}</span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-400">{item.summary}</p>
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              <TextField label="Device ID" value={deviceId} onChange={setDeviceId} />
              {mode === 'backend' ? (
                <TextField label="Cloudflare API Base URL" value={apiBaseUrl} onChange={setApiBaseUrl} placeholder="留空使用同源 /api" />
              ) : (
                <>
                  <TextField label="MCU Base URL" value={mcuBaseUrl} onChange={setMcuBaseUrl} placeholder="留空代表 MCU 自架網站" />
                  <TextField label="Local API Token" value={localToken} onChange={setLocalToken} placeholder="留空代表 MCU 未啟用本機 token" />
                </>
              )}
            </div>

            <div className="mt-4 rounded bg-neutral-950 p-3 font-mono text-xs text-neutral-300">
              <p>STATUS {endpoints.status}</p>
              <p>CONFIG {endpoints.config}</p>
              <p>COMMAND {endpoints.command}</p>
            </div>
          </div>

          <div className="rounded border border-neutral-800 bg-neutral-900 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Vibe Coding 提示器</h2>
              <button
                type="button"
                onClick={copyPrompt}
                className="h-9 rounded border border-neutral-700 bg-neutral-950 px-3 text-xs font-medium hover:bg-neutral-800"
              >
                複製
              </button>
            </div>
            <textarea
              readOnly
              value={prompt}
              className="mt-4 min-h-44 w-full resize-y rounded border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs text-neutral-200"
            />
          </div>

          <div className="rounded border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-base font-semibold">事件紀錄</h2>
            <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-sm text-neutral-500">尚無紀錄</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="rounded border border-neutral-800 bg-neutral-950 p-3 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-cyan-300">{log.type}</span>
                      <span className="text-neutral-500">{log.time}</span>
                    </div>
                    <p className="mt-1 text-neutral-200">{log.message}</p>
                    {log.data ? (
                      <pre className="mt-2 max-h-40 overflow-auto rounded bg-neutral-900 p-2 text-neutral-400">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded bg-neutral-950 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function TextField({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-neutral-400">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded border border-neutral-700 bg-neutral-950 px-3 text-neutral-100"
      />
    </label>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-neutral-400">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full rounded border border-neutral-700 bg-neutral-950 px-3 text-neutral-100"
      />
    </label>
  );
}
