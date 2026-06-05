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
  "prealertSec": 10,
  "snoozeMin": 5,
  "maxRingSec": 10,
  "hapticEffect": 10,
  "version": 1,
  "signature": "..."
}
```

## Signed Payload

The signature is HMAC-SHA256 over this exact payload:

```text
deviceId|enabled|hour|minute|repeatMask|prealertSec|snoozeMin|maxRingSec|hapticEffect|version
```

`enabled` is encoded as `1` or `0`.

For the example above:

```text
alarm_c3_001|1|7|30|62|10|5|10|10|1
```

## Commands

Signed static JSON is not real time, so remote one-time commands were removed from the public JSON format.
