# Examples

## `arduino_secrets.h`

```cpp
#pragma once

#define ALARM_WIFI_SSID "YOUR_WIFI_SSID"
#define ALARM_WIFI_PASS "YOUR_WIFI_PASSWORD"
#define ALARM_DEVICE_ID "alarm_c3_001"

#define ALARM_ENABLE_CLOUD_SYNC false
#define ALARM_ENABLE_LOCAL_API true
// #define ALARM_LOCAL_API_TOKEN "local-only-token"

#define ALARM_WIFI_SLEEP true
#define ALARM_WIFI_TX_POWER WIFI_POWER_11dBm
#define ALARM_WIFI_CONNECT_TX_POWER WIFI_POWER_15dBm
#define ALARM_WIFI_CONNECT_TIMEOUT_MS 12000UL
#define ALARM_WIFI_RETRY_INTERVAL_MS 60000UL
#define ALARM_WIFI_RETRY_MAX_INTERVAL_MS 300000UL
#define ALARM_WIFI_AUTH_FAST_RETRY_MS 15000UL
#define ALARM_WIFI_AUTH_FAST_RETRY_MAX 3
#define ALARM_WIFI_MIN_SECURITY WIFI_AUTH_WPA_PSK
```

## Web UI

```text
MCU Base URL: http://192.168.x.x
Local API Token: blank, or same as ALARM_LOCAL_API_TOKEN
Device ID: alarm_c3_001
```

## Curl

```bash
curl "http://192.168.x.x/api/local/status?device_id=alarm_c3_001"
```

```bash
curl -X POST "http://192.168.x.x/api/local/command" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"alarm_c3_001","command":"test_led"}'
```
