# Security Notes

這個 repo 可以公開到 GitHub，但正式推送前請確認不要提交私人資訊。

## 不要提交的資訊

- Wi-Fi SSID 與密碼
- `DEVICE_TOKEN`
- MCU 的 `API_TOKEN`
- 私人 API domain 的管理密鑰
- Cloudflare API token 或部署 token

## MCU 設定

Arduino 主程式目前會自動讀取同資料夾的 `arduino_secrets.h`。請複製範例檔：

```bash
copy esp32c3_alarm_external_api_complete\arduino_secrets.example.h esp32c3_alarm_external_api_complete\arduino_secrets.h
```

然後在 `arduino_secrets.h` 填入實際值：

```cpp
#define ALARM_WIFI_SSID "YOUR_WIFI_SSID"
#define ALARM_WIFI_PASS "YOUR_WIFI_PASSWORD"
#define ALARM_API_TOKEN ""
```

`arduino_secrets.h` 已被 `.gitignore` 排除，不會被 commit。若檔案不存在，主程式會使用 placeholder 預設值。

## MCU Device Token

若 API server 設定：

```text
DEVICE_TOKEN=your-secret-token
```

則 MCU 的 `API_TOKEN` 必須一致。

Web UI 不應保存 `DEVICE_TOKEN`。部署到 Cloudflare 時，請使用 Cloudflare Access 保護網站與 `/api/web/*`，讓瀏覽器不需要知道管理 token。

## Cloudflare Pages

Cloudflare Pages 的前端會存取同源 `/api`。API 必須使用 HTTPS，否則瀏覽器會阻擋請求。

Web UI 只會把 API Base URL 與 Device ID 存在瀏覽器 localStorage，不保存 API token。
