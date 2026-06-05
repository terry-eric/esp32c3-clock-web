# Local MCU API

The project uses only the ESP32-C3 local API. There is no Cloudflare backend API in this repo.

Base URL:

```text
http://<MCU-IP>/api/local
```

If `ALARM_LOCAL_API_TOKEN` is set in `arduino_secrets.h`, requests must include:

```text
X-Local-Token: <local-only-token>
```

## GET `/status`

Returns current status and config.

```bash
curl -H "X-Local-Token: <token-if-enabled>" \
  "http://192.168.x.x/api/local/status?device_id=alarm_c3_001"
```

## POST `/config`

Updates alarm config.

```bash
curl -X POST "http://192.168.x.x/api/local/config" \
  -H "Content-Type: application/json" \
  -H "X-Local-Token: <token-if-enabled>" \
  -d '{"deviceId":"alarm_c3_001","enabled":true,"hour":7,"minute":30,"repeatMask":62,"prealertSec":60,"snoozeMin":5,"maxRingSec":300,"hapticEffect":17}'
```

## POST `/command`

Sends a command.

```bash
curl -X POST "http://192.168.x.x/api/local/command" \
  -H "Content-Type: application/json" \
  -H "X-Local-Token: <token-if-enabled>" \
  -d '{"deviceId":"alarm_c3_001","command":"test_haptic","hapticEffect":17}'
```

Supported commands:

```text
test_led
test_haptic
start_alarm
stop_alarm
snooze
```
