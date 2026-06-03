# GitHub Deployment Checklist

這份清單用來把目前專案推到 GitHub，並讓前端與 MCU/API 正確對接。

## 1. 建立 GitHub Repo

在 GitHub 建立一個空 repo，例如：

```text
esp32-c3-alarm-hub
```

不要勾選產生 README、`.gitignore` 或 license，因為本機專案已經有檔案與 initial commit。

## 2. 推送本機 Repo

在 `C:\Users\eric2\Downloads\Clock_test` 執行：

```bash
git remote add origin https://github.com/<你的帳號>/esp32-c3-alarm-hub.git
git push -u origin main
```

## 3. 啟用 GitHub Pages

到 GitHub repo：

```text
Settings -> Pages -> Source -> GitHub Actions
```

推到 `main` 後，`.github/workflows/deploy-pages.yml` 會自動執行：

```bash
npm install
npm test
npm run build
```

成功後前端會部署到 GitHub Pages。

## 4. 部署 API Server

GitHub Pages 不能執行 Node.js API，因此要把 API server 放到 Render、Railway、Fly.io、VPS 或其他 Node host。

Render 可使用根目錄的 `render.yaml`。

需要設定環境變數：

```text
PORT=8000
DEVICE_TOKEN=<可留空，正式建議設定>
FRONTEND_ORIGIN=https://<你的帳號>.github.io
```

部署完成後記下 API 網址，例如：

```text
https://esp32-c3-alarm-api.onrender.com
```

## 5. 設定 Web UI

打開 GitHub Pages 前端，在右側 API 設定欄填入：

```text
API Base URL = https://esp32-c3-alarm-api.onrender.com
Device ID = alarm_c3_001
API Token = 與 DEVICE_TOKEN 相同，若 server 未設定 token 可留空
```

## 6. 設定 MCU

在 Arduino 檔案：

```text
esp32c3_alarm_external_api_complete/esp32c3_alarm_external_api_complete.ino
```

建議先複製 secrets 範例：

```bash
copy esp32c3_alarm_external_api_complete\arduino_secrets.example.h esp32c3_alarm_external_api_complete\arduino_secrets.h
```

然後在 `arduino_secrets.h` 設定：

```cpp
#define ALARM_WIFI_SSID "YOUR_WIFI_SSID"
#define ALARM_WIFI_PASS "YOUR_WIFI_PASSWORD"
#define ALARM_CONFIG_URL_BASE "https://esp32-c3-alarm-api.onrender.com/clock"
#define ALARM_STATUS_URL "https://esp32-c3-alarm-api.onrender.com/state"
#define ALARM_API_TOKEN ""
```

若 API server 有 `DEVICE_TOKEN`，`API_TOKEN` 必須填同一組值。

## 7. 驗證

Web 端：

```text
GET /web/status
POST /web/config
POST /web/command
```

MCU 端：

```text
GET /clock
POST /state
```

如果網站能看到 MCU 狀態，且按下測試震動後 MCU 執行一次 `test_haptic`，代表整合成功。
