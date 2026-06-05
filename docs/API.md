# USB Control API

The primary control path is USB serial at `115200` baud. No Wi-Fi, IP address, or cloud deploy is required.

## Commands

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

The web console uses Web Serial in Chrome or Edge to send the same commands.

## Persisted Settings

When `set_config` changes alarm/output settings, the MCU saves them to ESP32 NVS (`Preferences`) so they survive reboot and power loss. Unchanged payloads skip the NVS write.

## Legacy HTTP/Cloud

The firmware still contains local HTTP and signed static JSON support for reference, but the starter config sets:

```cpp
#define ALARM_ENABLE_CLOUD_SYNC false
```

Use USB unless you intentionally re-enable Wi-Fi/cloud sync.
