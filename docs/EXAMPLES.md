# Examples

## Signed JSON

```json
{
  "deviceId": "alarm_c3_001",
  "enabled": true,
  "hour": 7,
  "minute": 30,
  "repeatMask": 62,
  "prealertSec": 60,
  "snoozeMin": 5,
  "maxRingSec": 300,
  "hapticEffect": 17,
  "version": 1,
  "commandId": 0,
  "command": "none",
  "signature": "..."
}
```

## Sign

PowerShell:

```powershell
$env:ALARM_CONFIG_HMAC_SECRET="your-private-signing-secret"
npm run sign:config
```

## MCU Secrets

```cpp
#define ALARM_WIFI_SSID "YOUR_WIFI_SSID"
#define ALARM_WIFI_PASS "YOUR_WIFI_PASSWORD"
#define ALARM_DEVICE_ID "alarm_c3_001"

#define ALARM_SIGNED_CONFIG_URL "https://esp32c3-clock-web.pages.dev/devices/alarm_c3_001.json"
#define ALARM_ENABLE_CLOUD_SYNC true
#define ALARM_CONFIG_HMAC_SECRET "your-private-signing-secret"
#define ALARM_REQUIRE_CONFIG_SIGNATURE true
```
