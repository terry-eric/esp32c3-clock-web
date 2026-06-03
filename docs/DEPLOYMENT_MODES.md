# Deployment Modes

This project can run with or without a backend.

## Mode 1: Cloudflare Backend

Use this when you want remote control and do not want the browser to know `DEVICE_TOKEN`.

```text
Web UI -> Cloudflare Pages Functions/KV <- ESP32-C3
```

Web UI calls:

```text
GET  /api/web/status
POST /api/web/config
POST /api/web/command
```

MCU calls:

```text
POST /api/sync
```

Secrets:

```cpp
#define ALARM_ENABLE_CLOUD_SYNC true
#define ALARM_SYNC_URL "https://esp32c3-clock-web.pages.dev/api/sync"
#define ALARM_API_TOKEN "same-as-cloudflare-DEVICE_TOKEN"
```

Cloudflare stores `DEVICE_TOKEN`. The browser does not store it.

## Mode 2: Self-hosted Web, Direct MCU API

Use this when the Web UI is hosted anywhere static, but the browser is on the same network as the ESP32-C3.

```text
Self-hosted Web UI -> ESP32-C3 /api/local/*
```

Web UI calls:

```text
GET  http://<MCU-IP>/api/local/status
POST http://<MCU-IP>/api/local/config
POST http://<MCU-IP>/api/local/command
```

Secrets:

```cpp
#define ALARM_ENABLE_CLOUD_SYNC false
#define ALARM_ENABLE_LOCAL_API true
#define ALARM_LOCAL_API_TOKEN "local-only-token"
```

The local token is stored in `arduino_secrets.h` on the MCU side. In direct mode the browser must send it as `X-Local-Token` if you set one.

## Mode 3: MCU-hosted Web

Use this for the simplest local setup.

```text
Browser -> http://<MCU-IP>/ -> ESP32-C3 /api/local/*
```

Secrets:

```cpp
#define ALARM_ENABLE_CLOUD_SYNC false
#define ALARM_ENABLE_LOCAL_API true
// Optional:
#define ALARM_LOCAL_API_TOKEN "local-only-token"
```

After the MCU connects to Wi-Fi, open the IP printed in Serial Monitor:

```text
[LocalAPI] Listening at http://192.168.x.x/
```

## Choosing a Mode

```text
Need remote control outside local Wi-Fi: Cloudflare Backend
Need no backend but can reach MCU IP: Self-hosted Web, Direct MCU API
Need fastest local demo: MCU-hosted Web
```

Do not commit `arduino_secrets.h`. It may contain Wi-Fi credentials and MCU-side tokens.
