# Cloudflare Pages + Functions Deployment

本專案建議用 Cloudflare 同時承載前端與後端：

- Cloudflare Pages：部署 React 前端
- Pages Functions：提供 `/api/*`
- Workers KV：保存裝置設定與狀態
- Variables and Secrets：保存 `DEVICE_TOKEN`
- Cloudflare Access：保護 Web 管理 API

重點：不要把 `DEVICE_TOKEN` 放進瀏覽器。Web UI 不需要 token；MCU 才需要 token。

## 1. 連接 GitHub Repo

Cloudflare Dashboard：

```text
Workers & Pages -> Create application -> Pages -> Connect to Git
```

選擇 repo：

```text
terry-eric/esp32c3-clock-web
```

Build settings：

```text
Framework preset: None 或 Vite
Build command: npm run build
Build output directory: dist
Root directory: /
```

Cloudflare Pages 會從 GitHub 自動部署。之後 push 到 `main` 會觸發部署。

## 2. 建立 KV Namespace

建立 KV namespace，例如：

```text
esp32_alarm_kv
```

到 Pages project：

```text
Settings -> Functions -> KV namespace bindings
```

新增 binding：

```text
Variable name: ALARM_KV
KV namespace: esp32_alarm_kv
```

正式環境一定要設定 `ALARM_KV`。沒有 KV 時，Function 只會用記憶體暫存，重新部署後資料會消失。

## 3. 設定 Variables / Secrets

到 Pages project：

```text
Settings -> Environment variables
```

新增：

```text
DEVICE_TOKEN=<給 MCU 用的強密碼或隨機 token>
REQUIRE_CF_ACCESS=true
```

`DEVICE_TOKEN` 是 MCU 呼叫 `/api/clock` 和 `/api/state` 用的。Web UI 不需要知道這個值。

## 4. 設定 Cloudflare Access

到 Cloudflare Zero Trust 建立 Access Application。

建議先保護 Web 管理 API：

```text
Application domain: esp32c3-clock-web.pages.dev
Path: /api/web/*
```

允許你的 email 登入。

不要只設定 `Path: /*` 然後把整個站都擋住，除非你另外排除 MCU API。MCU 不能互動登入 Access，因此 `/api/clock` 和 `/api/state` 要靠 `DEVICE_TOKEN` 保護。

## 5. MCU 設定

複製 secrets 範例：

```bat
copy esp32c3_alarm_external_api_complete\arduino_secrets.example.h esp32c3_alarm_external_api_complete\arduino_secrets.h
```

修改：

```cpp
#define ALARM_WIFI_SSID "YOUR_WIFI_SSID"
#define ALARM_WIFI_PASS "YOUR_WIFI_PASSWORD"
#define ALARM_CONFIG_URL_BASE "https://esp32c3-clock-web.pages.dev/api/clock"
#define ALARM_STATUS_URL "https://esp32c3-clock-web.pages.dev/api/state"
#define ALARM_API_TOKEN "same-as-cloudflare-DEVICE_TOKEN"
```

## 6. Web UI 設定

部署在 Cloudflare Pages 後，Web UI 的 `API Base URL` 可以留空。

留空代表使用同源 API：

```text
/api
```

Web UI 只保存：

```text
apiBaseUrl
deviceId
```

不保存 `DEVICE_TOKEN`。

## 7. 驗證

Health：

```text
https://esp32c3-clock-web.pages.dev/api/health
```

MCU config：

```bash
curl -H "X-Device-Token: <DEVICE_TOKEN>" "https://esp32c3-clock-web.pages.dev/api/clock?device_id=alarm_c3_001"
```

MCU status：

```bash
curl -X POST "https://esp32c3-clock-web.pages.dev/api/state" \
  -H "Content-Type: application/json" \
  -H "X-Device-Token: <DEVICE_TOKEN>" \
  -d "{\"deviceId\":\"alarm_c3_001\",\"state\":\"IDLE\",\"online\":true}"
```

Web status：

```text
https://esp32c3-clock-web.pages.dev/api/web/status?device_id=alarm_c3_001
```

若 `REQUIRE_CF_ACCESS=true`，瀏覽器必須先通過 Cloudflare Access。
