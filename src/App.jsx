import React, { useMemo, useRef, useState } from 'react';

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
  version: 1
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

function toJson(config) {
  return JSON.stringify(
    {
      enabled: config.enabled,
      hour: config.hour,
      minute: config.minute,
      repeatMask: config.repeatMask,
      prealertSec: config.prealertSec,
      snoozeMin: config.snoozeMin,
      maxRingSec: config.maxRingSec,
      hapticEffect: config.hapticEffect,
      ledPairBrightness: config.ledPairBrightness,
      flashLedBrightness: config.flashLedBrightness
    },
    null,
    2
  );
}

function formatTime(config) {
  return `${String(config.hour).padStart(2, '0')}:${String(config.minute).padStart(2, '0')}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function App() {
  const [config, setConfig] = useState(defaultConfig);
  const [usbState, setUsbState] = useState({
    connected: false,
    supported: typeof navigator !== 'undefined' && 'serial' in navigator,
    label: 'Not connected',
    detail: 'USB status is unknown until you connect from this browser.'
  });
  const serialPortRef = useRef(null);

  const jsonText = useMemo(() => toJson(config), [config]);
  const alarmTime = formatTime(config);

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

  async function writeUsbLine(line) {
    if (!serialPortRef.current || !serialPortRef.current.writable) {
      throw new Error('USB is not connected.');
    }

    const writer = serialPortRef.current.writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(`${line}\n`));
    } finally {
      writer.releaseLock();
    }
  }

  async function readUsbReply(matcher = 'codex_pong', timeoutMs = 1800) {
    if (!serialPortRef.current || !serialPortRef.current.readable) return '';

    const reader = serialPortRef.current.readable.getReader();
    const decoder = new TextDecoder();
    let reply = '';
    const timeoutId = setTimeout(() => {
      reader.cancel().catch(() => {});
    }, timeoutMs);

    try {
      while (!reply.includes(matcher)) {
        const result = await reader.read();
        if (result.done) break;
        if (result.value) reply += decoder.decode(result.value, { stream: true });
      }
    } finally {
      clearTimeout(timeoutId);
      reader.releaseLock();
    }

    return reply.trim();
  }

  async function connectUsb() {
    if (!usbState.supported) {
      setUsbState((current) => ({
        ...current,
        connected: false,
        label: 'Browser unsupported',
        detail: 'Use Chrome or Edge with Web Serial, or run the Python USB notifier.'
      }));
      return;
    }

    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      serialPortRef.current = port;

      await delay(900);
      await writeUsbLine('codex_ping');
      const reply = await readUsbReply('codex_pong');
      const connected = reply.includes('codex_pong');

      setUsbState({
        connected,
        supported: true,
        label: connected ? 'Connected' : 'Opened, no MCU reply',
        detail: connected ? reply.replace(/\s+/g, ' ') : 'Port opened, but no codex_pong was received.'
      });

      if (connected) {
        await syncUsbTime();
      }
    } catch (error) {
      setUsbState((current) => ({
        ...current,
        connected: false,
        label: 'Connection failed',
        detail: error.message
      }));
    }
  }

  async function sendUsbDone() {
    try {
      await writeUsbLine(`notify_done ${config.hapticEffect}`);
      setUsbState((current) => ({
        ...current,
        label: 'Sent',
        detail: `notify_done ${config.hapticEffect}`
      }));
    } catch (error) {
      setUsbState((current) => ({
        ...current,
        connected: false,
        label: 'Send failed',
        detail: error.message
      }));
    }
  }

  async function sendUsbCommand(command) {
    try {
      await writeUsbLine(`${command} ${config.hapticEffect}`);
      setUsbState((current) => ({
        ...current,
        label: 'Sent',
        detail: command
      }));
    } catch (error) {
      setUsbState((current) => ({
        ...current,
        connected: false,
        label: 'Send failed',
        detail: error.message
      }));
    }
  }

  async function syncUsbTime() {
    try {
      const epochSeconds = Math.floor(Date.now() / 1000);
      await writeUsbLine(`set_time ${epochSeconds}`);
      const reply = await readUsbReply('usb_time_', 1800);
      setUsbState((current) => ({
        ...current,
        label: reply.includes('usb_time_ok') ? 'Time synced' : 'Time sent',
        detail: reply || `set_time ${epochSeconds}`
      }));
    } catch (error) {
      setUsbState((current) => ({
        ...current,
        connected: false,
        label: 'Time sync failed',
        detail: error.message
      }));
    }
  }

  async function applyUsbConfig() {
    try {
      const body = {
        enabled: config.enabled,
        hour: config.hour,
        minute: config.minute,
        repeatMask: config.repeatMask,
        prealertSec: config.prealertSec,
        snoozeMin: config.snoozeMin,
        maxRingSec: config.maxRingSec,
        hapticEffect: config.hapticEffect,
        ledPairBrightness: config.ledPairBrightness,
        flashLedBrightness: config.flashLedBrightness
      };
      await writeUsbLine(`set_config ${JSON.stringify(body)}`);
      const reply = await readUsbReply('usb_config_', 1800);
      setUsbState((current) => ({
        ...current,
        label: reply.includes('usb_config_ok') ? 'Settings saved' : 'Settings sent',
        detail: reply || 'set_config sent'
      }));
    } catch (error) {
      setUsbState((current) => ({
        ...current,
        connected: false,
        label: 'Apply failed',
        detail: error.message
      }));
    }
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
            <StatusPill label="Control" value="USB" active />
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${usbState.connected ? 'bg-teal-600' : 'bg-stone-300'}`} />
                      <div className="text-sm font-semibold">USB {usbState.label}</div>
                    </div>
                    <div className="mt-2 break-all text-xs text-stone-500">{usbState.detail}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:w-[315px]">
                    <button type="button" onClick={connectUsb} className="h-10 rounded-md bg-stone-900 px-3 text-sm font-semibold text-white">
                      Connect
                    </button>
                    <button type="button" onClick={syncUsbTime} disabled={!usbState.connected} className={`h-10 rounded-md px-3 text-sm font-semibold ${usbState.connected ? 'bg-white text-stone-700 ring-1 ring-stone-300' : 'bg-stone-200 text-stone-400'}`}>
                      Time
                    </button>
                    <button type="button" onClick={applyUsbConfig} disabled={!usbState.connected} className={`h-10 rounded-md px-3 text-sm font-semibold ${usbState.connected ? 'bg-teal-700 text-white' : 'bg-stone-200 text-stone-400'}`}>
                      Apply
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-stone-300 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel>USB command</FieldLabel>
                  <span className="text-xs font-semibold text-teal-700">Immediate</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {commandOptions.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => sendUsbCommand(value)}
                      disabled={!usbState.connected}
                      className={`h-10 rounded-md border px-2 text-sm font-semibold ${usbState.connected ? 'border-stone-300 bg-white text-stone-600 hover:border-stone-500' : 'border-stone-200 bg-stone-100 text-stone-400'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="USB Config Payload">
            <div className="space-y-3">
              <pre className="max-h-[340px] overflow-auto rounded-md bg-stone-950 p-3 text-xs text-stone-100">{jsonText}</pre>
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
