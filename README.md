# ESP32-C3 Alarm USB Console

USB-first alarm controller for an ESP32-C3 alarm device. The browser console talks to the MCU over Web Serial, so alarm settings, LED brightness, haptic strength, and coding-done notifications can work without an MCU IP address.

## Files

```text
src/                                      USB alarm console
scripts/notify_mcu.py                    Codex/Gemini done notifier
esp32c3_alarm_external_api_complete/      ESP32-C3 firmware
  arduino_secrets.example.h               Public starter settings
  arduino_secrets.h                       Local settings, ignored by git
```

## First Run

Copy the starter settings:

```powershell
copy esp32c3_alarm_external_api_complete\arduino_secrets.example.h esp32c3_alarm_external_api_complete\arduino_secrets.h
```

Edit only `arduino_secrets.h`:

```cpp
#define ALARM_DEVICE_ID "alarm_c3_001"
#define ALARM_DEVICE_NAME "Codex Done Light"
```

Wi-Fi is disabled in the firmware runtime. Control and time sync are done over USB. Do not commit `arduino_secrets.h`.

## USB Console

Open the web console in Chrome or Edge, press `Connect`, choose the ESP32-C3 serial port, then use:

- `Time` to sync the MCU clock from the computer over USB
- `Apply` to save alarm/output settings to MCU NVS
- `Done alert` to flash/vibrate immediately
- `Test LEDs` and `Test haptic` for hardware checks

The first Web Serial use must be selected by hand because the browser requires device permission. After permission is granted, the console reuses the remembered device automatically.

The console opens USB only for the current action, then closes the port again. This keeps the browser from holding COM busy and blocking Codex/Gemini done notifications.

You can also sync time once without opening the web console:

```powershell
python scripts\notify_mcu.py --mode usb --state sync-time
```

The MCU accepts these USB serial commands at `115200` baud:

```text
codex_ping
usb_keepalive
set_time 1780000000
codex_busy
notify_done 10
codex_idle
test_led
test_haptic 10
stop_alarm
snooze
set_config {"enabled":true,"hour":7,"minute":30,"repeatMask":62,"ledPairBrightness":4}
```

`set_config` writes changed settings to ESP32 NVS so they survive reboot and power loss.
`set_time` uses Unix epoch seconds from the computer/browser. It replaces NTP for normal use.

## Codex Done Notification

Codex/Gemini can notify the MCU when a coding task is done:

```powershell
python scripts\notify_mcu.py --mode usb
```

Use `--state busy` when Codex starts a coding task and `--state done` when the task finishes:

```powershell
python scripts\notify_mcu.py --mode usb --state busy
python scripts\notify_mcu.py --mode usb --state done
```

By default, the notifier sends `set_time` before `busy` and `done`, so Codex status notifications also refresh the MCU clock. The MCU resets its USB time-sync timer when `set_time` succeeds. Add `--no-sync-time` if you only want to send the status command.

Optional local `.env`:

```text
MCU_NOTIFY_MODE=usb
MCU_NOTIFY_PORT=
MCU_NOTIFY_DEVICE_ID=alarm_c3_001
MCU_NOTIFY_EFFECT=10
MCU_NOTIFY_STATE=done
MCU_SYNC_TIME_BEFORE_NOTIFY=true
```

Leave `MCU_NOTIFY_PORT` empty to scan COM ports. The notifier only continues on a port whose `codex_ping` reply contains `MCU_NOTIFY_DEVICE_ID`, so it will not send alerts to unrelated serial devices. Set `MCU_NOTIFY_PORT` only if you want to force one port.
