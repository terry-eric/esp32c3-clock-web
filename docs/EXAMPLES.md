# Examples

## Cloudflare Pages

```text
Project name: esp32c3-clock-web
Production branch: main
Build command: npm run build
Build output directory: dist
Root directory: /
```

## Cloudflare KV Binding

```text
KV namespace name: esp32_alarm_kv
Binding variable name: ALARM_KV
```

## Cloudflare Variables / Secrets

```text
DEVICE_TOKEN=replace-with-a-long-random-token
REQUIRE_CF_ACCESS=true
```

Do not put `DEVICE_TOKEN` in frontend code or commit it to GitHub.

## Cloudflare Access

```text
Application type: Self-hosted
Application domain: esp32c3-clock-web.pages.dev
Path: /api/web/*
Policy: Allow your email
```

MCU endpoints use `DEVICE_TOKEN`; Web management endpoints use Cloudflare Access.

## Arduino Secrets

File:

```text
esp32c3_alarm_external_api_complete/arduino_secrets.h
```

Example:

```cpp
#pragma once

#define ALARM_WIFI_SSID "MyWiFi"
#define ALARM_WIFI_PASS "MyWiFiPassword"

#define ALARM_DEVICE_ID "alarm_c3_001"

#define ALARM_CONFIG_URL_BASE "https://esp32c3-clock-web.pages.dev/api/clock"
#define ALARM_STATUS_URL "https://esp32c3-clock-web.pages.dev/api/state"
#define ALARM_SYNC_URL "https://esp32c3-clock-web.pages.dev/api/sync"

#define ALARM_ENABLE_CLOUD_SYNC true
#define ALARM_ENABLE_LOCAL_API true
// #define ALARM_LOCAL_API_TOKEN "local-only-token"

#define ALARM_WIFI_SLEEP true
#define ALARM_WIFI_TX_POWER WIFI_POWER_11dBm

#define ALARM_API_TOKEN "replace-with-cloudflare-DEVICE_TOKEN"
#define ALARM_HTTPS_INSECURE true
```

For no-backend local mode:

```cpp
#define ALARM_ENABLE_CLOUD_SYNC false
#define ALARM_ENABLE_LOCAL_API true
#define ALARM_LOCAL_API_TOKEN "local-only-token"
```

## Web UI Modes

Cloudflare backend:

```text
Connection mode: Cloudflare 後端
Cloudflare API Base URL: blank, or /api
Device ID: alarm_c3_001
```

Direct MCU mode:

```text
Connection mode: 直接連 MCU
MCU Base URL: http://192.168.x.x
Local API Token: same as ALARM_LOCAL_API_TOKEN, or blank if not set
```

MCU-hosted mode:

```text
Open: http://192.168.x.x/
The MCU serves a small built-in local dashboard.
```

## curl Tests

Health:

```bash
curl https://esp32c3-clock-web.pages.dev/api/health
```

Cloudflare MCU sync:

```bash
curl -X POST "https://esp32c3-clock-web.pages.dev/api/sync" \
  -H "Content-Type: application/json" \
  -H "X-Device-Token: replace-with-cloudflare-DEVICE_TOKEN" \
  -d "{\"deviceId\":\"alarm_c3_001\",\"online\":true,\"state\":\"IDLE\",\"heap\":200000}"
```

Cloudflare MCU config:

```bash
curl -H "X-Device-Token: replace-with-cloudflare-DEVICE_TOKEN" \
  "https://esp32c3-clock-web.pages.dev/api/clock?device_id=alarm_c3_001"
```

Cloudflare MCU status:

```bash
curl -X POST "https://esp32c3-clock-web.pages.dev/api/state" \
  -H "Content-Type: application/json" \
  -H "X-Device-Token: replace-with-cloudflare-DEVICE_TOKEN" \
  -d "{\"deviceId\":\"alarm_c3_001\",\"online\":true,\"state\":\"IDLE\",\"heap\":200000}"
```

Local MCU status:

```bash
curl -H "X-Local-Token: local-only-token" \
  "http://192.168.x.x/api/local/status"
```

Local MCU config:

```bash
curl -X POST "http://192.168.x.x/api/local/config" \
  -H "Content-Type: application/json" \
  -H "X-Local-Token: local-only-token" \
  -d "{\"hour\":7,\"minute\":30,\"enabled\":true,\"repeatMask\":62,\"hapticEffect\":17}"
```

Web command:

```bash
curl -X POST "https://esp32c3-clock-web.pages.dev/api/web/command" \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\":\"alarm_c3_001\",\"command\":\"test_haptic\",\"hapticEffect\":17}"
```

When `REQUIRE_CF_ACCESS=true`, `/api/web/*` requires Cloudflare Access login, so plain curl may be rejected.
