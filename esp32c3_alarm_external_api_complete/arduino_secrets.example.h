#pragma once

// Copy this file to arduino_secrets.h before flashing the MCU.
// arduino_secrets.h is ignored by git so private values stay local.

#define ALARM_WIFI_SSID "YOUR_WIFI_SSID"
#define ALARM_WIFI_PASS "YOUR_WIFI_PASSWORD"

// Wait briefly after boot before WiFi starts. This helps unstable USB/battery
// power rails and phone hotspots that need a moment before accepting auth.
#define ALARM_BOOT_STABILIZE_MS 1000UL

#define ALARM_DEVICE_ID "alarm_c3_001"
#define ALARM_DEVICE_NAME "Codex Done Light"

// USB-first starter: cloud sync is off by default. Turn it on only if you
// intentionally want the MCU to fetch signed JSON from a website.
#define ALARM_SIGNED_CONFIG_URL "https://esp32c3-clock-web.pages.dev/devices/alarm_c3_001.json"
#define ALARM_ENABLE_CLOUD_SYNC false

// Demo-only signing secret. This public example matches the checked-in JSON,
// so the sample can run after you copy this file. Change it for real use.
#define ALARM_CONFIG_HMAC_SECRET "demo-only-change-me"
#define ALARM_REQUIRE_CONFIG_SIGNATURE true

// Legacy/private API placeholders. Not used by the signed static JSON flow.
#define ALARM_CONFIG_URL_BASE "https://example.invalid/api/clock"
#define ALARM_STATUS_URL "https://example.invalid/api/state"
#define ALARM_SYNC_URL "https://example.invalid/api/sync"

#define ALARM_ENABLE_LOCAL_API true
// Leave commented to reuse ALARM_API_TOKEN, or set a different local-only key.
// #define ALARM_LOCAL_API_TOKEN "replace-with-local-mcu-token"

// Lower power WiFi defaults. Raise TX power if the AP is far away.
#define ALARM_WIFI_SLEEP true
#define ALARM_WIFI_TX_POWER WIFI_POWER_11dBm
#define ALARM_WIFI_CONNECT_TX_POWER WIFI_POWER_15dBm
#define ALARM_WIFI_CONNECT_TIMEOUT_MS 12000UL
#define ALARM_WIFI_RETRY_INTERVAL_MS 60000UL
#define ALARM_WIFI_RETRY_MAX_INTERVAL_MS 300000UL
#define ALARM_WIFI_AUTH_FAST_RETRY_MS 15000UL
#define ALARM_WIFI_AUTH_FAST_RETRY_MAX 3
#define ALARM_WIFI_MIN_SECURITY WIFI_AUTH_WPA_PSK

// Leave empty for no-backend local mode. Do not commit real tokens.
#define ALARM_API_TOKEN ""

// For production, prefer a trusted HTTPS certificate and set this to false.
#define ALARM_HTTPS_INSECURE true
