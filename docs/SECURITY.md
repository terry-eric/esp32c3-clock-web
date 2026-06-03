# Security Notes

這個 repo 可以公開到 GitHub，但正式推送前請確認不要提交私人資訊。

## 不要提交的資訊

- Wi-Fi SSID 與密碼
- `DEVICE_TOKEN`
- MCU 的 `API_TOKEN`
- 私人 API domain 的管理密鑰
- Render/Railway/VPS 的部署 token

## MCU 設定

Arduino 檔案目前使用 placeholder：

```cpp
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* API_TOKEN = "";
```

燒錄 MCU 前，請在本機改成實際值；如果 repo 要公開，不要把真實密碼 commit。

## API Token

若 API server 設定：

```text
DEVICE_TOKEN=your-secret-token
```

則 Web UI 的 `API Token` 與 MCU 的 `API_TOKEN` 必須一致。

## GitHub Pages

GitHub Pages 的前端會存取外部 API。API 必須使用 HTTPS，否則瀏覽器會阻擋請求。
