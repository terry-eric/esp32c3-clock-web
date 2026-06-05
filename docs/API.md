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
  "ledPairBrightness": 4,
  "flashLedBrightness": 10,
  "version": 1,
  "commandId": 0,
  "command": "none",
  "signature": "..."
}
```

## Signed Payload

The signature is HMAC-SHA256 over this exact payload:

```text
deviceId|enabled|hour|minute|repeatMask|prealertSec|snoozeMin|maxRingSec|hapticEffect|ledPairBrightness|flashLedBrightness|version|commandId|command
```

`enabled` is encoded as `1` or `0`.

For the example above:

```text
alarm_c3_001|1|7|30|62|10|5|10|10|4|10|1|0|none
```

## Commands

Signed static JSON is not real time. If `commandId` increases and `command` is not `none`, the MCU runs that signed command on its next cloud sync.

## Local Vibe Notification

The MCU exposes immediate local commands by HTTP when its IP is known:

```text
POST http://<MCU-IP>/api/local/command
```

Body:

```json
{
  "command": "notify_done",
  "hapticEffect": 10
}
```

Use it from `scripts/notify_mcu.py` when Codex/Gemini finishes coding.

The same script can also notify over USB serial with no IP:

```powershell
python scripts\notify_mcu.py --mode usb
```

The Cloudflare web console can also connect over USB in Chrome or Edge. It shows connected only after the MCU replies to `codex_ping` with `codex_pong`.

For website delivery, use signed cloud mode:

```powershell
$env:ALARM_CONFIG_HMAC_SECRET="your-private-signing-secret"
python scripts\notify_mcu.py --mode cloud
```

Then deploy the changed `public/devices/alarm_c3_001.json`. The MCU will run `notify_done` on its next cloud sync.
