# ESP32-C3 Clock Web

ESP32-C3 鬧鐘控制專案，現在採用 **無後端** 架構：

- Cloudflare Pages 只部署 React 靜態前端
- 前端直接連到 ESP32-C3 的本機 API：`http://<MCU-IP>/api/local/*`
- WiFi SSID、WiFi 密碼、Local API Token 只放在 `arduino_secrets.h`
- `arduino_secrets.h` 已被 `.gitignore` 忽略，不會推上 GitHub

## Project Layout

```text
src/                                      React static web UI
esp32c3_alarm_external_api_complete/      ESP32-C3 Arduino firmware
esp32c3_alarm_external_api_complete/
  arduino_secrets.example.h               public placeholder example
docs/                                     setup and MCU notes
wrangler.toml                             Cloudflare Pages static config
```

There is no backend in this repo. The old Cloudflare Pages Functions API was removed.

## Web Setup

Install and build:

```bash
npm install
npm run build
```

Cloudflare Pages settings:

```text
Framework preset: None
Build command: npm run build
Build output directory: dist
```

After deploy, open the site and fill:

```text
MCU Base URL: http://<MCU-IP>
Local API Token: blank, unless you set ALARM_LOCAL_API_TOKEN
Device ID: alarm_c3_001
```

Important browser note: a Cloudflare site is HTTPS. Some browsers block HTTPS pages from calling `http://192.168.x.x`. If that happens, open the MCU local website directly:

```text
http://<MCU-IP>/
```

or run the web UI locally with:

```bash
npm run dev
```

## MCU Secrets

Copy the example file before flashing:

```powershell
copy esp32c3_alarm_external_api_complete\arduino_secrets.example.h esp32c3_alarm_external_api_complete\arduino_secrets.h
```

Then edit only `arduino_secrets.h`:

```cpp
#define ALARM_WIFI_SSID "YOUR_WIFI_SSID"
#define ALARM_WIFI_PASS "YOUR_WIFI_PASSWORD"
#define ALARM_ENABLE_CLOUD_SYNC false
#define ALARM_ENABLE_LOCAL_API true
// #define ALARM_LOCAL_API_TOKEN "local-only-token"
```

Do not commit `arduino_secrets.h`.

## MCU Local API

The web UI calls:

```text
GET  /api/local/status
POST /api/local/config
POST /api/local/command
```

When the MCU is online, Serial Monitor prints:

```text
[LocalAPI] Listening at http://192.168.x.x/
```

Use that IP in the web UI.
