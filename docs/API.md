# API Specification

前端建議放在 Cloudflare Pages，API 由 Cloudflare Pages Functions 提供。

建議正式網址：

```text
https://your-cloudflare-pages-domain.pages.dev/api
```

Cloudflare Pages 是 HTTPS，因此 API 也必須是 HTTPS。使用同源 `/api` 可以避免 mixed content 與 CORS 問題。

## Authentication

如果 Cloudflare Pages Function 有設定 `DEVICE_TOKEN`，MCU 請求要帶：

```text
X-Device-Token: your-token
```

Web 管理端不要把 `DEVICE_TOKEN` 放進前端。正式環境建議用 Cloudflare Access 保護 Web UI 與 `/api/web/*`。

## MCU Endpoints

### GET `/api/clock`

MCU 取得設定與待執行指令。

Query:

```text
device_id=alarm_c3_001
```

Response:

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
  "command": "none"
}
```

`commandId` 每次有新指令時會增加。MCU 只在看到新的 `commandId` 時執行一次指令。

### POST `/api/state`

MCU 回傳目前狀態。

Body:

```json
{
  "deviceId": "alarm_c3_001",
  "online": true,
  "state": "IDLE",
  "wifiOk": true,
  "wifiRssi": -56,
  "ip": "192.168.43.20",
  "timeOk": true,
  "time": "2026-06-03 15:03:23",
  "drvOk": true,
  "alarmEnabled": true,
  "alarmTime": "07:30",
  "repeatMask": 62,
  "lastAction": "STOPPED",
  "configVersion": 1,
  "lastCommandId": 0,
  "heap": 197812
}
```

Response:

```json
{
  "success": true
}
```

## Web Endpoints

### GET `/api/web/status`

網站讀取設定與狀態。

Query:

```text
device_id=alarm_c3_001
```

Response:

```json
{
  "config": {},
  "status": {}
}
```

### POST `/api/web/config`

網站更新鬧鐘設定。

Body:

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
  "hapticEffect": 17
}
```

Response:

```json
{
  "success": true,
  "config": {}
}
```

### POST `/api/web/command`

網站送出遠端指令。

Body:

```json
{
  "deviceId": "alarm_c3_001",
  "command": "test_haptic",
  "hapticEffect": 17
}
```

Allowed commands:

```text
none
test_led
test_haptic
start_alarm
stop_alarm
snooze
```

其他 command 會回傳 `400 Unsupported command`，避免 Web UI 打錯字時 MCU 端靜默忽略。

Response:

```json
{
  "success": true,
  "commandId": 1,
  "config": {}
}
```
