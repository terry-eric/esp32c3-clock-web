# Examples

## Signed JSON

```json
{
  "deviceId": "alarm_c3_001",
  "enabled": true,
  "hour": 7,
  "minute": 30,
  "repeatMask": 62,
  "prealertSec": 10,
  "snoozeMin": 5,
  "maxRingSec": 10,
  "hapticEffect": 10,
  "ledPairBrightness": 4,
  "flashLedBrightness": 10,
  "version": 1,
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

## Vibe Coding Done Notification

Use this when Codex/Gemini finishes a coding task and you want the MCU to flash/vibrate:

```powershell
py scripts\notify_mcu.py --url http://192.168.1.23 --token "<local-token-if-enabled>"
```

Build EXE:

```powershell
py -m PyInstaller --onefile --name esp32c3-notify-mcu scripts\notify_mcu.py
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
