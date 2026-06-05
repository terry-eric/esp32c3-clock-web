# USB Control API

The primary control path is USB serial at `115200` baud. No Wi-Fi, IP address, or cloud deploy is required.

## Commands

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

`codex_ping` returns:

```text
codex_pong alarm_c3_001 Codex Done Light
```

`set_config` returns one of:

```text
usb_config_ok
usb_config_rejected
```

`set_time` returns one of:

```text
usb_time_ok
usb_time_rejected
```

The web console uses Web Serial in Chrome or Edge to send the same commands. It sends `set_time` on connect and once per hour while USB stays connected.

The console command buttons are editable. Button labels and command mappings are saved in browser storage and reused for later clicks/page loads. MCU alarm/output settings are still persisted on the device through `set_config`.

## Command Behavior

| Command | Behavior |
| --- | --- |
| `codex_ping` | Probes the MCU and returns `codex_pong alarm_c3_001 Codex Done Light`. |
| `usb_keepalive` | Refreshes the USB-connected timer. If the MCU does not receive USB traffic for about 15 seconds, it blinks the red status LED. |
| `set_time` | Sets the MCU clock from Unix epoch seconds. |
| `set_config` | Applies alarm/output fields and writes changed values to NVS. |
| `codex_busy` | Shows solid red while Codex is working. |
| `notify_done` | Clears busy, flashes/vibrates, then shows solid green. |
| `codex_idle` | Clears Codex red/green status and returns to normal LED patterns. |
| `test_led` | Runs the LED hardware test with current brightness settings. |
| `test_haptic` | Plays one haptic effect using current haptic settings. |
| `stop_alarm` | Stops the active alarm. |
| `snooze` | Snoozes only while alarm/pre-alert is active. |

## Persisted Settings

When `set_config` changes alarm/output settings, the MCU saves them to ESP32 NVS (`Preferences`) so they survive reboot and power loss. Unchanged payloads skip the NVS write.

## Legacy HTTP/Cloud

The repository still contains old local HTTP and signed static JSON references, but the current MCU runtime keeps Wi-Fi off and the starter config sets:

```cpp
#define ALARM_ENABLE_CLOUD_SYNC false
#define ALARM_ENABLE_LOCAL_API false
```

Use USB for config, commands, and time sync.
