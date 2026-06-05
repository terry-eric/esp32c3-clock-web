import React, { useMemo, useState } from 'react';

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

const commandOptions = [
  ['none', '無命令'],
  ['test_led', '測試 LED'],
  ['test_haptic', '測試震動'],
  ['stop_alarm', '停止鬧鐘'],
  ['snooze', '稍後提醒']
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

function signedPayload(config) {
  return [
    config.deviceId,
    config.enabled ? '1' : '0',
    config.hour,
    config.minute,
    config.repeatMask,
    config.prealertSec,
    config.snoozeMin,
    config.maxRingSec,
    config.hapticEffect,
    config.version,
    config.commandId,
    config.command
  ].join('|');
}

function toJson(config) {
  return JSON.stringify({ ...config, signature: '<run sign-config.mjs>' }, null, 2);
}

export default function App() {
  const [config, setConfig] = useState(defaultConfig);

  const publicPath = useMemo(() => `/devices/${config.deviceId}.json`, [config.deviceId]);
  const payload = useMemo(() => signedPayload(config), [config]);
  const jsonText = useMemo(() => toJson(config), [config]);
  const alarmTime = `${String(config.hour).padStart(2, '0')}:${String(config.minute).padStart(2, '0')}`;

  function update(patch) {
    setConfig((current) => ({ ...current, ...patch }));
  }

  function bumpVersion(patch = {}) {
    setConfig((current) => ({
      ...current,
      ...patch,
      version: current.version + 1
    }));
  }

  function setCommand(command) {
    setConfig((current) => ({
      ...current,
      command,
      commandId: command === 'none' ? current.commandId : current.commandId + 1,
      version: current.version + 1
    }));
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="border-b border-neutral-800 bg-neutral-900">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <h1 className="text-xl font-semibold">ESP32-C3 Signed Config</h1>
          <p className="mt-1 text-sm text-neutral-400">
            無後端模式：MCU 抓公開 JSON，但只接受 HMAC 簽章正確的設定。
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5 lg:grid-cols-[1fr_1fr]">
        <section className="space-y-5">
          <Panel title="設定內容">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Device ID" value={config.deviceId} onChange={(value) => update({ deviceId: value })} />
              <NumberField label="Version" value={config.version} onChange={(value) => update({ version: value })} min={1} />
              <label className="text-sm">
                <span className="mb-1 block text-neutral-400">時間</span>
                <input
                  type="time"
                  value={alarmTime}
                  onChange={(event) => {
                    const [hour, minute] = event.target.value.split(':').map(Number);
                    bumpVersion({ hour, minute });
                  }}
                  className="h-11 w-full rounded border border-neutral-700 bg-neutral-950 px-3 text-neutral-100"
                />
              </label>
              <NumberField label="震動效果" value={config.hapticEffect} onChange={(value) => bumpVersion({ hapticEffect: value })} min={1} max={123} />
              <NumberField label="預提醒秒數" value={config.prealertSec} onChange={(value) => bumpVersion({ prealertSec: value })} min={0} />
              <NumberField label="貪睡分鐘" value={config.snoozeMin} onChange={(value) => bumpVersion({ snoozeMin: value })} min={1} />
              <NumberField label="最長響鈴秒數" value={config.maxRingSec} onChange={(value) => bumpVersion({ maxRingSec: value })} min={10} />
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
                      onClick={() => bumpVersion({ repeatMask: config.repeatMask ^ (1 << bit) })}
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
                onClick={() => bumpVersion({ enabled: !config.enabled })}
                className={`h-10 rounded px-4 text-sm font-semibold ${
                  config.enabled ? 'bg-emerald-500 text-neutral-950' : 'bg-neutral-800 text-neutral-300'
                }`}
              >
                {config.enabled ? '已啟用' : '已關閉'}
              </button>
            </div>
          </Panel>

          <Panel title="一次性命令">
            <div className="grid gap-2 sm:grid-cols-3">
              {commandOptions.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCommand(value)}
                  className={`h-11 rounded border px-3 text-sm font-medium ${
                    config.command === value
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200'
                      : 'border-neutral-700 bg-neutral-950 text-neutral-300 hover:bg-neutral-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-neutral-400">
              命令不是即時推送。你更新 JSON、簽章、push 後，MCU 下一次抓到新版本才會執行。
            </p>
          </Panel>
        </section>

        <aside className="space-y-5">
          <Panel title="公開 JSON">
            <p className="mb-3 text-sm text-neutral-400">
              將內容放到 <span className="font-mono text-neutral-200">public{publicPath}</span>，再用本機 secret 簽章。
            </p>
            <pre className="max-h-[360px] overflow-auto rounded bg-neutral-950 p-3 text-xs text-neutral-200">{jsonText}</pre>
          </Panel>

          <Panel title="簽章方式">
            <p className="text-sm leading-6 text-neutral-400">
              Secret key 不放網站、不放 JSON、不放 GitHub。只放在你的電腦環境變數和 MCU 的
              <span className="font-mono text-neutral-200"> arduino_secrets.h</span>。
            </p>
            <div className="mt-4 rounded bg-neutral-950 p-3 font-mono text-xs text-neutral-200">
              <p>$env:ALARM_CONFIG_HMAC_SECRET=&quot;你的私密 key&quot;</p>
              <p>npm run sign:config</p>
            </div>
            <div className="mt-4">
              <p className="mb-1 text-sm text-neutral-400">MCU 驗章 payload</p>
              <pre className="overflow-auto rounded bg-neutral-950 p-3 text-xs text-neutral-200">{payload}</pre>
            </div>
          </Panel>

          <Panel title="MCU 抓取路徑">
            <div className="rounded bg-neutral-950 p-3 font-mono text-xs text-neutral-200">
              https://esp32c3-clock-web.pages.dev{publicPath}
            </div>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              JSON 內容大家看得到，但沒有 secret key 的人無法產生正確 signature，所以 MCU 會拒絕被竄改的設定。
            </p>
          </Panel>
        </aside>
      </div>
    </main>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded border border-neutral-800 bg-neutral-900 p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TextField({ label, value, onChange, placeholder = '' }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-neutral-400">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded border border-neutral-700 bg-neutral-950 px-3 text-neutral-100"
      />
    </label>
  );
}

function NumberField({ label, value, onChange, min, max }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-neutral-400">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full rounded border border-neutral-700 bg-neutral-950 px-3 text-neutral-100"
      />
    </label>
  );
}
