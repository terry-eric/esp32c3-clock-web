#pragma once

// Copy this file to arduino_secrets.h before flashing the MCU.
// arduino_secrets.h is ignored by git so private values stay local.

// Wait briefly after boot so USB/battery power rails can settle.
#define ALARM_BOOT_STABILIZE_MS 1000UL

#define ALARM_DEVICE_ID "alarm_c3_001"
#define ALARM_DEVICE_NAME "Codex Done Light"

// Most coin vibration motors are ERM. Set to 1 only when using an LRA motor.
#define ALARM_HAPTIC_USE_LRA 0

// USB-only starter. The MCU does not start WiFi, local API, or cloud sync.
#define ALARM_ENABLE_CLOUD_SYNC false
#define ALARM_ENABLE_LOCAL_API false
