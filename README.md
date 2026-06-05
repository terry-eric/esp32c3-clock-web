# ESP32-C3 Alarm USB Console

USB-first alarm controller for an ESP32-C3 alarm device. The browser console talks to the MCU over Web Serial, so alarm settings, LED brightness, haptic strength, and coding-done notifications can work without an MCU IP address.

## Files

```text
src/                                      USB alarm console
scripts/notify_mcu.py                    Codex/Gemini done notifier
public/devices/alarm_c3_001.json          Legacy signed config example
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
#define ALARM_ENABLE_CLOUD_SYNC false
#define ALARM_ENABLE_LOCAL_API false
```

Wi-Fi is disabled in the firmware runtime. Control and time sync are done over USB. Do not commit `arduino_secrets.h`.

## USB Console

Open the web console in Chrome or Edge, press `Connect`, choose the ESP32-C3 serial port, then use:

- `Time` to sync the MCU clock from the computer over USB
- `Apply` to save alarm/output settings to MCU NVS
- `Done alert` to flash/vibrate immediately
- `Test LEDs` and `Test haptic` for hardware checks

After the USB console connects, it automatically syncs the MCU clock once per hour while the page stays connected.

The MCU accepts these USB serial commands at `115200` baud:

```text
codex_ping
set_time 1780000000
notify_done 10
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

Optional local `.env`:

```text
MCU_NOTIFY_MODE=usb
MCU_NOTIFY_PORT=
MCU_NOTIFY_EFFECT=10
```

Leave `MCU_NOTIFY_PORT` empty to auto-detect the MCU with `codex_ping`. Set it to `COM4` only if you want to force one port.

## Legacy Signed Config

The repo still includes `public/devices/alarm_c3_001.json` and signing scripts as an old reference. The current firmware runtime does not use Wi-Fi/cloud sync.

## Cloudflare Pages

```text
Framework preset: None
Build command: npm run build
Build output directory: dist
```
