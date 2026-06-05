# Signed Static Config

There is no backend API. The MCU fetches one public JSON file:

```text
GET https://esp32c3-clock-web.pages.dev/devices/alarm_c3_001.json
```

Example:

```json
{
  "deviceId": "alarm_c3_001",
  "enabled": true,
  "hour": 7,
  "minute": 30,
  "repeatMask": 62,
  "prealertSec": 60,
  "snoozeMin": 5,
  "maxRingSec": 300,
  "hapticEffect": 17,
  "version": 1,
  "commandId": 0,
  "command": "none",
  "signature": "..."
}
```

## Signed Payload

The signature is HMAC-SHA256 over this exact payload:

```text
deviceId|enabled|hour|minute|repeatMask|prealertSec|snoozeMin|maxRingSec|hapticEffect|version|commandId|command
```

`enabled` is encoded as `1` or `0`.

For the example above:

```text
alarm_c3_001|1|7|30|62|60|5|300|17|1|0|none
```

## Commands

Supported command values:

```text
none
test_led
test_haptic
stop_alarm
snooze
```

Increase `commandId` whenever `command` is not `none`. The MCU executes each command ID once.
