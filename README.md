# ESP32-C3 Clock Web

這個 repo 整合兩個程式：

- MCU 韌體：`esp32c3_alarm_external_api_complete/`
- Web 控制面板：`src/App.jsx`

建議部署方式是 Cloudflare Pages + Pages Functions：

- 前端：Cloudflare Pages
- 後端 API：Cloudflare Pages Functions，路徑 `/api/*`
- 狀態/設定儲存：Cloudflare KV binding `ALARM_KV`
- 私密 token：Cloudflare Variables and Secrets
- Web 管理保護：Cloudflare Access

這樣 Web 前端不需要保存 MCU 的 API token，避免 API key/token 洩漏。

## 專案結構

```text
src/                                  React 前端
functions/api/[[path]].js             Cloudflare Pages Functions API
esp32c3_alarm_external_api_complete/  ESP32-C3 Arduino 韌體
docs/API.md                           API 規格
docs/CLOUDFLARE_DEPLOY.md             Cloudflare 架設流程
docs/EXAMPLES.md                      設定與 API 範例
docs/GITHUB_DEPLOY.md                 GitHub repo 操作
docs/SECURITY.md                      安全注意事項
wrangler.toml                         Cloudflare Pages 設定
```

## API 路徑

MCU 使用：

```text
GET  /api/clock?device_id=alarm_c3_001
POST /api/state
```

Web 使用：

```text
GET  /api/web/status?device_id=alarm_c3_001
POST /api/web/config
POST /api/web/command
```

Health check：

```text
GET /api/health
```

## 本機開發

這台環境目前沒有 `npm`，所以本機未跑完整 build。推到 GitHub 後，CI 會執行：

```bash
npm install
npm test
npm run build
```

若你的電腦有 Node.js/npm，可本機執行：

```bash
npm install
npm test
npm run build
npm run dev
```

## Cloudflare 架設摘要

1. 到 Cloudflare Pages 連接 GitHub repo：

```text
https://github.com/terry-eric/esp32c3-clock-web
```

2. 設定 build：

```text
Build command: npm run build
Build output directory: dist
Root directory: /
```

3. 建立 KV namespace，並在 Pages project 加 binding：

```text
Binding name: ALARM_KV
```

4. 在 Cloudflare Pages 環境變數/secret 設定：

```text
DEVICE_TOKEN=<給 MCU 用的 token>
REQUIRE_CF_ACCESS=true
```

5. 用 Cloudflare Access 保護：

```text
Path: /api/web/*
```

MCU 不走 Cloudflare Access，MCU endpoints 用 `DEVICE_TOKEN` 保護。

完整步驟看：

```text
docs/CLOUDFLARE_DEPLOY.md
```

## MCU 設定

複製範例：

```bat
copy esp32c3_alarm_external_api_complete\arduino_secrets.example.h esp32c3_alarm_external_api_complete\arduino_secrets.h
```

修改 `arduino_secrets.h`：

```cpp
#define ALARM_WIFI_SSID "YOUR_WIFI_SSID"
#define ALARM_WIFI_PASS "YOUR_WIFI_PASSWORD"
#define ALARM_CONFIG_URL_BASE "https://your-pages-domain.pages.dev/api/clock"
#define ALARM_STATUS_URL "https://your-pages-domain.pages.dev/api/state"
#define ALARM_API_TOKEN "same-as-cloudflare-DEVICE_TOKEN"
```

`arduino_secrets.h` 已被 `.gitignore` 排除，不會推到 GitHub。

## 範例

看：

```text
docs/EXAMPLES.md
```

裡面包含 Cloudflare 設定範例、Arduino secrets 範例、curl API 測試範例。
