# Examples

這份文件提供 GitHub repo 使用者可以直接照填的範例。

## Cloudflare Pages 設定範例

```text
Project name: esp32c3-clock-web
Production branch: main
Build command: npm run build
Build output directory: dist
Root directory: /
```

## Cloudflare KV Binding 範例

```text
KV namespace name: esp32_alarm_kv
Binding variable name: ALARM_KV
```

## Cloudflare Variables / Secrets 範例

```text
DEVICE_TOKEN=replace-with-a-long-random-token
REQUIRE_CF_ACCESS=true
```

`DEVICE_TOKEN` 不要寫進前端，不要 commit 到 GitHub。

## Cloudflare Access 範例

```text
Application type: Self-hosted
Application domain: esp32c3-clock-web.pages.dev
Path: /api/web/*
Policy: Allow your email
```

這樣 Web 管理 API 需要登入 Cloudflare Access。MCU API 則使用 `DEVICE_TOKEN`。

## Arduino secrets 範例

檔案：

```text
esp32c3_alarm_external_api_complete/arduino_secrets.h
```

內容：

```cpp
#pragma once

#define ALARM_WIFI_SSID "MyWiFi"
#define ALARM_WIFI_PASS "MyWiFiPassword"

#define ALARM_DEVICE_ID "alarm_c3_001"

#define ALARM_CONFIG_URL_BASE "https://esp32c3-clock-web.pages.dev/api/clock"
#define ALARM_STATUS_URL "https://esp32c3-clock-web.pages.dev/api/state"

#define ALARM_API_TOKEN "replace-with-cloudflare-DEVICE_TOKEN"
#define ALARM_HTTPS_INSECURE true
```

## Web UI 範例

部署到 Cloudflare Pages 後：

```text
API Base URL: 留空
Device ID: alarm_c3_001
```

留空會使用：

```text
/api
```

若你在本機測試另一個 API，也可以填：

```text
http://localhost:8000
```

## curl 測試範例

Health：

```bash
curl https://esp32c3-clock-web.pages.dev/api/health
```

讀 MCU config：

```bash
curl -H "X-Device-Token: replace-with-cloudflare-DEVICE_TOKEN" \
  "https://esp32c3-clock-web.pages.dev/api/clock?device_id=alarm_c3_001"
```

送 MCU status：

```bash
curl -X POST "https://esp32c3-clock-web.pages.dev/api/state" \
  -H "Content-Type: application/json" \
  -H "X-Device-Token: replace-with-cloudflare-DEVICE_TOKEN" \
  -d "{\"deviceId\":\"alarm_c3_001\",\"online\":true,\"state\":\"IDLE\",\"heap\":200000}"
```

送 Web command：

```bash
curl -X POST "https://esp32c3-clock-web.pages.dev/api/web/command" \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\":\"alarm_c3_001\",\"command\":\"test_haptic\",\"hapticEffect\":17}"
```

若 `REQUIRE_CF_ACCESS=true`，`/api/web/*` 需要先通過 Cloudflare Access，所以這個 curl 會被擋；請用瀏覽器登入後從 Web UI 操作。
