#pragma once

// Copy this file to arduino_secrets.h before flashing the MCU.
// arduino_secrets.h is ignored by git so private values stay local.

#define ALARM_WIFI_SSID "YOUR_WIFI_SSID"
#define ALARM_WIFI_PASS "YOUR_WIFI_PASSWORD"

#define ALARM_DEVICE_ID "alarm_c3_001"

#define ALARM_CONFIG_URL_BASE "https://your-cloudflare-pages-domain.pages.dev/api/clock"
#define ALARM_STATUS_URL "https://your-cloudflare-pages-domain.pages.dev/api/state"

// Leave empty when the API server has no DEVICE_TOKEN.
#define ALARM_API_TOKEN ""

// For production, prefer a trusted HTTPS certificate and set this to false.
#define ALARM_HTTPS_INSECURE true
