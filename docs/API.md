# USB Control API

The primary control path is USB serial at `115200` baud. No Wi-Fi, IP address, or cloud deploy is required.

## Commands

```text
codex_ping
usb_keepalive
set_time 1780000000
get_config
codex_busy
notify_done 10
codex_idle
test_led
test_haptic 10
stop_alarm
snooze
set_config {"enabled":true,"hour":7,"minute":30,"repeatMask":62,"ledPairBrightness":4}
run_pattern {"command":"notify_done","green":"blink","red":"off","flash":"blink","haptic":"on","intervalMs":180,"count":6}
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

`usb_keepalive` returns:

```text
usb_keepalive_ok
```

Direct local commands such as `codex_busy` and `notify_done 10` return this after the command finishes:

```text
usb_command_ok notify_done
```

The web console uses Web Serial in Chrome or Edge to send the same commands. The first use must be selected by hand because the browser requires device permission. After permission exists, each console action opens the remembered device, sends the needed command(s), then closes the USB port so Codex/Gemini notifications can use the same COM port.

The local notifier can sync time without the web console:

```powershell
python scripts\notify_mcu.py --mode usb --state sync-time
```

Normal `message-sent`/`busy` and `answer-done`/`done` notifier commands also send `set_time` first unless `--no-sync-time` is passed. `message-sent` maps to `codex_busy`; `answer-done` sends a `run_pattern` payload whose command is `notify_done`, so the local notifier uses the same blink style as the web console's done button. Pass `--direct-done` or set `MCU_NOTIFY_DIRECT_DONE=true` to send direct `notify_done` instead. The notifier requires the `codex_ping` reply to match the expected device id before it sends time or status commands.

The console command buttons are editable. Button labels, command mappings, and light-pattern settings are saved in browser storage and reused for later clicks/page loads. Browser storage cannot be read by the Python notifier, so use `MCU_NOTIFY_DONE_PATTERN_JSON` in `.env` if the Codex/Gemini done alert should use a custom pattern outside the browser. MCU alarm/output settings are still persisted on the device through `set_config`.

## Command Behavior

| Command | Behavior |
| --- | --- |
| `codex_ping` | Probes the MCU and returns `codex_pong alarm_c3_001 Codex Done Light`. |
| `usb_keepalive` | Keeps the serial session active. On fresh power-up, the red time-sync prompt blinks until USB time sync succeeds. After one successful sync, stale time does not make it blink forever. |
| `set_time` | Sets the MCU clock from Unix epoch seconds. |
| `get_config` | Returns `usb_config_json {...}` with the current MCU NVS-backed alarm/output settings plus `epoch` and `timeText` for browser/computer time comparison. |
| `set_config` | Applies alarm/output fields and writes changed values to NVS. |
| `run_pattern` | Runs editable green/red/flash LED and haptic behavior, then applies the selected command status. Haptic values 0-10 are strength levels. |
| `codex_busy` | Shows solid red while Codex is working. |
| `notify_done` | Clears busy, flashes/vibrates, then shows solid green. |
| `codex_idle` | Clears Codex red/green status and returns to normal LED patterns. |
| `test_led` | Runs the LED hardware test with current brightness settings. |
| `test_haptic` | Plays one haptic pulse using the current 0-10 haptic strength. |
| `stop_alarm` | Stops the active alarm. |
| `snooze` | Snoozes only while alarm/pre-alert is active. |

## Persisted Settings

When `set_config` changes alarm/output settings, the MCU saves them to ESP32 NVS (`Preferences`) so they survive reboot and power loss. Unchanged payloads skip the NVS write.
