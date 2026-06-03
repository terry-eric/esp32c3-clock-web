# API Specification

前端可以放在 GitHub Pages，但 API 必須部署在可執行 Node.js 的 HTTPS host。

建議正式網址：

```text
https://your-api-domain.com
```

GitHub Pages 是 HTTPS，因此 API 也必須是 HTTPS，否則瀏覽器會因 mixed content 擋掉請求。

## Authentication

如果 API server 有設定 `DEVICE_TOKEN`，所有 MCU 與 Web 請求都要帶：

```text
X-Device-Token: your-token
```

未設定 `DEVICE_TOKEN` 時，server 不檢查 token，適合本機測試。

## MCU Endpoints

### GET `/clock`

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

### POST `/state`

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

### GET `/web/status`

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

### POST `/web/config`

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

### POST `/web/command`

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

Response:

```json
{
  "success": true,
  "commandId": 1,
  "config": {}
}
```
