import React, { useMemo, useState } from 'react';

const defaultConfig = {
  deviceId: 'alarm_c3_001',
  deviceName: 'Codex Done Light',
  enabled: true,
  hour: 7,
  minute: 30,
  repeatMask: 62,
  prealertSec: 10,
  snoozeMin: 5,
  maxRingSec: 10,
  hapticEffect: 10,
  ledPairBrightness: 4,
  flashLedBrightness: 10,
  version: 1,
  commandId: 0,
  command: 'none'
};

const days = [
  ['Sun', 0],
  ['Mon', 1],
  ['Tue', 2],
  ['Wed', 3],
  ['Thu', 4],
  ['Fri', 5],
  ['Sat', 6]
];

const commandOptions = [
  ['none', 'No command'],
  ['notify_done', 'Done alert'],
  ['test_led', 'Test LEDs'],
  ['test_haptic', 'Test haptic'],
  ['stop_alarm', 'Stop alarm'],
  ['snooze', 'Snooze']
];

function clampZeroToTen(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(10, Math.max(0, Math.round(value)));
}

function clampHour(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(23, Math.max(0, Math.round(value)));
}

function clampMinute(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(59, Math.max(0, Math.round(value)));
}

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
    config.ledPairBrightness,
    config.flashLedBrightness,
    config.version,
    config.commandId,
    config.command
  ].join('|');
}

function toJson(config) {
  const { deviceName, ...signedConfig } = config;
  return JSON.stringify({ ...signedConfig, signature: '<run sign-config.mjs>' }, null, 2);
}

function formatTime(config) {
  return `${String(config.hour).padStart(2, '0')}:${String(config.minute).padStart(2, '0')}`;
}

export default function App() {
  const [config, setConfig] = useState(defaultConfig);

  const publicPath = useMemo(() => `/devices/${config.deviceId}.json`, [config.deviceId]);
  const payload = useMemo(() => signedPayload(config), [config]);
  const jsonText = useMemo(() => toJson(config), [config]);
  const alarmTime = formatTime(config);
  const syncUrl = `https://esp32c3-clock-web.pages.dev${publicPath}`;

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

  function queueCommand(command) {
    setConfig((current) => ({
      ...current,
      command,
      commandId: current.commandId + 1
    }));
  }

  return (
    <main className="min-h-screen bg-[#f4f5f0] text-stone-950">
      <header className="border-b border-stone-300 bg-[#e8eadf]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">ESP32-C3 Alarm Console</p>
            <h1 className="mt-1 text-2xl font-semibold">{config.deviceName}</h1>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs sm:min-w-[360px]">
            <StatusPill label="Alarm" value={config.enabled ? 'On' : 'Off'} active={config.enabled} />
            <StatusPill label="Time" value={alarmTime} />
            <StatusPill label="Cloud cmd" value={config.command === 'none' ? 'Idle' : config.command} active={config.command !== 'none'} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="space-y-5">
          <Panel title="Alarm">
            <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
              <label className="block">
                <FieldLabel>Time</FieldLabel>
                <input
                  type="time"
                  value={alarmTime}
                  onChange={(event) => {
                    const [hour, minute] = event.target.value.split(':').map(Number);
                    bumpVersion({ hour: clampHour(hour), minute: clampMinute(minute) });
                  }}
                  className="h-14 w-full rounded-md border border-stone-300 bg-white px-3 text-2xl font-semibold tabular-nums outline-none focus:border-teal-600"
                />
              </label>
              <div>
                <FieldLabel>Repeat</FieldLabel>
                <div className="grid grid-cols-7 gap-2">
                  {days.map(([label, bit]) => {
                    const selected = (config.repeatMask & (1 << bit)) !== 0;
                    return (
                      <button
                        key={bit}
                        type="button"
                        onClick={() => bumpVersion({ repeatMask: config.repeatMask ^ (1 << bit) })}
                        className={`h-14 rounded-md border text-sm font-semibold transition ${
                          selected
                            ? 'border-teal-700 bg-teal-700 text-white'
                            : 'border-stone-300 bg-white text-stone-600 hover:border-stone-500'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <RangeField label="Pre-alert" unit="sec" value={config.prealertSec} onChange={(value) => bumpVersion({ prealertSec: value })} />
              <RangeField label="Snooze" unit="min" value={config.snoozeMin} onChange={(value) => bumpVersion({ snoozeMin: value })} />
              <RangeField label="Max ring" unit="sec" value={config.maxRingSec} onChange={(value) => bumpVersion({ maxRingSec: value })} />
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-stone-200 pt-4">
              <div>
                <div className="text-sm font-semibold">Alarm enabled</div>
                <div className="text-sm text-stone-500">Version {config.version}</div>
              </div>
              <Toggle checked={config.enabled} onClick={() => bumpVersion({ enabled: !config.enabled })} />
            </div>
          </Panel>

          <Panel title="MCU Outputs">
            <div className="grid gap-4 md:grid-cols-3">
              <RangeField label="Main LEDs" unit="/10" value={config.ledPairBrightness} onChange={(value) => bumpVersion({ ledPairBrightness: value })} />
              <RangeField label="Flash LED" unit="/10" value={config.flashLedBrightness} onChange={(value) => bumpVersion({ flashLedBrightness: value })} />
              <RangeField label="Haptic" unit="/10" value={config.hapticEffect} onChange={(value) => bumpVersion({ hapticEffect: value })} />
            </div>
          </Panel>

          <Panel title="Device">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Friendly name" value={config.deviceName} onChange={(value) => update({ deviceName: value })} />
              <TextField label="Device ID" value={config.deviceId} onChange={(value) => update({ deviceId: value })} />
            </div>
          </Panel>
        </section>

        <aside className="space-y-5">
          <Panel title="Notify">
            <div className="grid gap-3">
              <div className="rounded-md border border-stone-300 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">USB</div>
                    <code className="mt-2 block break-all rounded bg-stone-100 px-2 py-1 text-xs text-stone-700">
                      python scripts\notify_mcu.py --mode usb
                    </code>
                  </div>
                  <span className="rounded-md bg-stone-900 px-3 py-2 text-sm font-semibold text-white">
                    Auto detect
                  </span>
                </div>
              </div>

              <div className="rounded-md border border-stone-300 bg-white p-4">
                <FieldLabel>Website command</FieldLabel>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {commandOptions.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => queueCommand(value)}
                      className={`h-10 rounded-md border px-2 text-sm font-semibold ${
                        config.command === value
                          ? 'border-amber-600 bg-amber-100 text-amber-900'
                          : 'border-stone-300 bg-white text-stone-600 hover:border-stone-500'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-stone-500">Command ID</span>
                  <span className="font-mono font-semibold">{config.commandId}</span>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Signed JSON">
            <div className="space-y-3">
              <div className="rounded-md border border-stone-300 bg-white p-3">
                <FieldLabel>Cloud URL</FieldLabel>
                <code className="block break-all text-xs text-stone-700">{syncUrl}</code>
              </div>
              <pre className="max-h-[340px] overflow-auto rounded-md bg-stone-950 p-3 text-xs text-stone-100">{jsonText}</pre>
            </div>
          </Panel>

          <Panel title="Signature">
            <div className="rounded-md bg-stone-950 p-3 font-mono text-xs text-stone-100">
              <p>$env:ALARM_CONFIG_HMAC_SECRET=&quot;your-private-signing-secret&quot;</p>
              <p>npm run sign:config</p>
            </div>
            <div className="mt-3">
              <FieldLabel>Payload</FieldLabel>
              <pre className="max-h-[120px] overflow-auto rounded-md bg-white p-3 text-xs text-stone-700">{payload}</pre>
            </div>
          </Panel>
        </aside>
      </div>
    </main>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-md border border-stone-300 bg-[#fbfbf7] p-5 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FieldLabel({ children }) {
  return <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{children}</span>;
}

function StatusPill({ label, value, active = false }) {
  return (
    <div className={`rounded-md border px-3 py-2 ${active ? 'border-teal-700 bg-teal-700 text-white' : 'border-stone-300 bg-white text-stone-700'}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-75">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function Toggle({ checked, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-8 w-14 rounded-full transition ${checked ? 'bg-teal-700' : 'bg-stone-300'}`}
      aria-pressed={checked}
    >
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${checked ? 'left-7' : 'left-1'}`} />
    </button>
  );
}

function TextField({ label, value, onChange }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-teal-600"
      />
    </label>
  );
}

function RangeField({ label, unit, value, onChange }) {
  return (
    <label className="block rounded-md border border-stone-300 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        <span className="text-sm font-semibold tabular-nums">
          {value}
          <span className="text-stone-400">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        value={value}
        min={0}
        max={10}
        step={1}
        onChange={(event) => onChange(clampZeroToTen(Number(event.target.value)))}
        className="mt-3 w-full accent-teal-700"
      />
    </label>
  );
}
