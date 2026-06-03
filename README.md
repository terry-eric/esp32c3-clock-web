# ESP32-C3 Alarm Hub

這個專案把兩個部分整理在同一個 repo：

- `esp32c3_alarm_external_api_complete/`：ESP32-C3 MCU 韌體。
- `src/App.jsx`：GitHub Pages 使用的 React 網站控制面板。
- `esp32_c3_alarm_controller_hub.tsx`：原始控制面板參考檔，目前不作為 build 入口。
- `server/`：給 MCU 與網站共用的 Node.js API server。
- `docs/API.md`：MCU 與 Web 共用的 API 規格。
- `docs/GITHUB_DEPLOY.md`：推 GitHub、啟用 Pages、部署 API、設定 MCU 的完整清單。
- `docs/SECURITY.md`：公開 GitHub 前的 Wi-Fi、token 與 HTTPS 安全注意事項。
- `render.yaml`：Render 部署 API server 的參考設定。

## API 對接

MCU 使用：

- `GET /clock?device_id=alarm_c3_001` 取得鬧鐘設定與待執行指令。
- `POST /state` 回傳 MCU 狀態。

網站使用：

- `GET /web/status?device_id=alarm_c3_001` 讀取目前設定與狀態。
- `POST /web/config` 更新鬧鐘設定。
- `POST /web/command` 發送 `test_led`、`test_haptic`、`start_alarm`、`stop_alarm`、`snooze` 等指令。

如果 API server 設定了 `DEVICE_TOKEN`，MCU 和網站都要在 header 帶：

```text
X-Device-Token: your-token
```

## 本機執行

```bash
npm install
npm run server
npm run dev
```

前端預設會在 `http://localhost:5173`，API 預設在 `http://localhost:8000`。

網站 build 入口是：

```text
index.html -> src/main.jsx -> src/App.jsx
```

`src/App.jsx` 會呼叫外部 API server，不會把 Node server 包進 GitHub Pages。這是因為 GitHub Pages 只能提供靜態檔案。

## GitHub Pages 部署

GitHub Pages 只能放靜態前端，不能執行 Node.js API server。因此建議：

1. 將此 repo 推上 GitHub。
2. 用 GitHub Pages 部署前端 `dist/`。
3. 將 `server/` 部署到 Render、Railway、Fly.io、VPS 或其他 Node.js host。
4. 在網站控制面板的 API 網址填入你的 API domain，例如 `https://api.example.com`。
5. 在 MCU `.ino` 裡把 `CONFIG_URL_BASE` 和 `STATUS_URL` 改成同一個 API domain。

注意：GitHub Pages 是 HTTPS 網站，所以 API 也必須是 HTTPS。若 API 只有 `http://`，瀏覽器會擋掉網站請求。

GitHub repo 設定：

1. 到 GitHub repo 的 `Settings -> Pages`。
2. Source 選 `GitHub Actions`。
3. 推到 `main` 後，`.github/workflows/deploy-pages.yml` 會自動 build 並部署前端。

API server 部署設定：

```text
PORT=8000
DEVICE_TOKEN=可留空或填入你的安全 token
FRONTEND_ORIGIN=https://YOUR_GITHUB_USERNAME.github.io
```

如果 `DEVICE_TOKEN` 有設定，網站控制面板的 `API Token` 欄位與 MCU 的 `API_TOKEN` 必須填同一組值。

API 細節請看 `docs/API.md`。完整 GitHub 上線流程請看 `docs/GITHUB_DEPLOY.md`。
公開 repo 前請看 `docs/SECURITY.md`，確認沒有提交 Wi-Fi 密碼或 token。

## MCU 端需要確認的欄位

在 `esp32c3_alarm_external_api_complete/esp32c3_alarm_external_api_complete.ino`：

```cpp
const char* CONFIG_URL_BASE = "https://your-api-domain.com/clock";
const char* STATUS_URL      = "https://your-api-domain.com/state";
const char* API_TOKEN       = "";
```

`STATUS_URL` 不能留空，否則 MCU 只會讀設定，不會把狀態回傳給網站。
