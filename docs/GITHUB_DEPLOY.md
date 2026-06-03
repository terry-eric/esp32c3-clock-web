# GitHub Repository Checklist

這份清單用來把目前專案推到 GitHub。前端與後端部署請使用 Cloudflare Pages，詳見 `docs/CLOUDFLARE_DEPLOY.md`。

## 1. 建立 GitHub Repo

目前 repo 已推送到：

```text
https://github.com/terry-eric/esp32c3-clock-web
```

## 2. 推送本機 Repo

本機 repo 路徑：

```text
C:\Users\eric2\Downloads\Clock_test
```

推送指令：

```bash
git push origin main
```

## 3. GitHub CI

推到 `main` 後，`.github/workflows/ci.yml` 會自動執行：

```bash
npm install
npm test
npm run build
```

成功後代表 repo 可以安裝、測試與 build。實際部署請到 Cloudflare Pages 連接此 GitHub repo。

## 4. Cloudflare Deploy

Cloudflare Pages 設定：

```text
Build command: npm run build
Build output directory: dist
Root directory: /
```

需要新增：

```text
KV binding: ALARM_KV
Secret: DEVICE_TOKEN
Variable: REQUIRE_CF_ACCESS=true
```

完整流程請看：

```text
docs/CLOUDFLARE_DEPLOY.md
docs/DEPLOYMENT_MODES.md
```

## 5. MCU 設定

複製 secrets 範例：

```bash
copy esp32c3_alarm_external_api_complete\arduino_secrets.example.h esp32c3_alarm_external_api_complete\arduino_secrets.h
```

在 `arduino_secrets.h` 設定：

```cpp
#define ALARM_WIFI_SSID "YOUR_WIFI_SSID"
#define ALARM_WIFI_PASS "YOUR_WIFI_PASSWORD"
#define ALARM_CONFIG_URL_BASE "https://你的-pages-domain.pages.dev/api/clock"
#define ALARM_STATUS_URL "https://你的-pages-domain.pages.dev/api/state"
#define ALARM_SYNC_URL "https://你的-pages-domain.pages.dev/api/sync"
#define ALARM_API_TOKEN "與 Cloudflare DEVICE_TOKEN 相同"
```

`arduino_secrets.h` 已在 `.gitignore` 中，不會被 commit。

## 6. 驗證

Web 端：

```text
GET /api/web/status
POST /api/web/config
POST /api/web/command
```

MCU 端：

```text
POST /api/sync
GET /api/clock
POST /api/state
```

Health check:

```text
GET /api/health
```
