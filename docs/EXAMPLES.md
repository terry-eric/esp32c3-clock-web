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

Python signer:

```powershell
py scripts\sign_config.py --input public\devices\alarm_c3_001.json
```

Windows EXE packaging:

```powershell
py -m pip install pyinstaller
py -m PyInstaller --onefile --name esp32c3-config-signer scripts\sign_config.py
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
