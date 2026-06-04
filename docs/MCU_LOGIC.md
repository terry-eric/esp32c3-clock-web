# MCU Logic

The ESP32-C3 firmware has four main jobs:

- Maintain Wi-Fi with low-power retry behavior.
- Keep local alarm config in NVS.
- Run the alarm state machine and hardware outputs.
- Optionally sync with Cloudflare or serve local MCU APIs.

## Startup Flow

```mermaid
flowchart TD
  A["Power on / reset"] --> B["Init Serial, GPIO, LEDs"]
  B --> C["Load config from NVS"]
  C --> D["Init DRV2605L over I2C"]
  D --> E["Start Wi-Fi connection window"]
  E --> F{"Wi-Fi connected?"}
  F -- "Yes" --> G["Start local MCU Web/API"]
  G --> H["Sync NTP time"]
  H --> I{"Cloud sync enabled?"}
  I -- "Yes" --> J["POST /api/sync: upload status, receive config"]
  I -- "No" --> K["Skip cloud sync"]
  J --> L{"Time OK and driver OK?"}
  K --> L
  F -- "No" --> M["Turn Wi-Fi radio off, wait retry backoff"]
  M --> N["Enter TIME_INVALID until time is available"]
  L -- "Yes" --> O["Enter IDLE"]
  L -- "No time" --> N
  L -- "Driver failed" --> P["Enter DRV_FAIL"]
```

## Main Loop

```mermaid
flowchart TD
  A["loop()"] --> B["Maintain Wi-Fi"]
  B --> C["Handle local MCU Web/API request"]
  C --> D{"Wi-Fi connected?"}
  D -- "Yes" --> E["Ensure local Web/API server is started"]
  D -- "No" --> F["Continue local alarm logic"]
  E --> G{"Time invalid?"}
  G -- "Yes" --> H["Try NTP sync"]
  G -- "No" --> I["Skip NTP"]
  H --> F
  I --> F
  F --> J["Read button"]
  J --> K["Update alarm state machine"]
  K --> L["Update LED pattern"]
  L --> M{"Cloud sync due?"}
  M -- "Yes" --> N["POST /api/sync"]
  M -- "No" --> O["Print heartbeat if due"]
  N --> O
  O --> P["delay 5 ms"]
  P --> A
```

## Alarm State Machine

```mermaid
stateDiagram-v2
  [*] --> BOOT
  BOOT --> TIME_INVALID: Time not available
  BOOT --> DRV_FAIL: DRV2605L failed
  BOOT --> IDLE: Time and driver OK
  TIME_INVALID --> IDLE: NTP time becomes valid
  IDLE --> PREALARM: Within prealert window
  IDLE --> RINGING: Alarm time reached
  PREALARM --> RINGING: Alarm time reached
  PREALARM --> IDLE: Prealert cancelled
  RINGING --> SNOOZE: Button / command snooze
  RINGING --> STOPPED: Button / command stop or max ring timeout
  SNOOZE --> RINGING: Snooze time reached
  SNOOZE --> IDLE: Snooze cancelled
  STOPPED --> IDLE: Short settle time
  DRV_FAIL --> DRV_FAIL: Hardware fault remains
```

## Wi-Fi Power Strategy

The firmware does not scan for SSIDs before connecting. It directly attempts `WiFi.begin()` because scanning costs time and power, and phone hotspots can change state between scan and connect.

Connection behavior:

- Open a short connection window.
- Use `ALARM_WIFI_CONNECT_TX_POWER` only while associating.
- After getting an IP, switch back to the configured low-power TX power and modem sleep setting.
- If connection fails, disconnect and turn Wi-Fi radio off.
- Wait with exponential backoff before the next attempt.

This means the MCU can still run the alarm locally even when Wi-Fi is unavailable, while avoiding constant high-power connection attempts.

Tuning knobs in `arduino_secrets.h`:

```cpp
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

If the device still sometimes cannot connect:

- Raise `ALARM_WIFI_CONNECT_TX_POWER` one step.
- Increase `ALARM_WIFI_CONNECT_TIMEOUT_MS` to `15000UL` or `20000UL` for slow phone hotspots.
- Keep `ALARM_WIFI_RETRY_INTERVAL_MS` long enough to avoid repeated high-power connection attempts.
- `STA_DISCONNECTED reason=2` means auth expired. The firmware now treats this as a short fast retry case before falling back to long exponential retry.
- If your router is strictly WPA2-only and you want stricter security, set `ALARM_WIFI_MIN_SECURITY WIFI_AUTH_WPA2_PSK`. The default `WIFI_AUTH_WPA_PSK` is more compatible with WPA/WPA2 mixed hotspots.

If battery/power is more important than fast reconnect:

- Increase `ALARM_WIFI_RETRY_INTERVAL_MS`.
- Increase `ALARM_WIFI_RETRY_MAX_INTERVAL_MS`.
- Disable cloud sync with `ALARM_ENABLE_CLOUD_SYNC false` and use local MCU mode only.
