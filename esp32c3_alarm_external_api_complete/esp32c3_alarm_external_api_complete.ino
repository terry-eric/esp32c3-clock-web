/*
  ESP32-C3 Super Mini Alarm Device - External Website/API Control Version

  Hardware:
    ESP32-C3 Super Mini
    DRV2605L haptic driver via I2C
    LED A          -> GPIO5
    LED B          -> GPIO6
    Flashing LED   -> GPIO7
    Touch/Button   -> GPIO3
    I2C SDA        -> GPIO8
    I2C SCL        -> GPIO9

  Required Arduino libraries:
    1. Adafruit DRV2605 Library
    2. Adafruit BusIO
    3. ArduinoJson

  Arduino IDE board suggestion:
    Board: ESP32C3 Dev Module / ESP32-C3 Super Mini
    USB CDC On Boot: Enabled
    Serial Monitor: 115200

  ------------------------------------------------------------
  Signed static website config
  ------------------------------------------------------------

  MCU periodically fetches a public static JSON file:

    GET https://YOUR_SITE/devices/alarm_c3_001.json

  The JSON is public, but the MCU only applies it when the HMAC-SHA256
  signature matches ALARM_CONFIG_HMAC_SECRET from arduino_secrets.h.

  Expected JSON:

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
      "version": 12,

      "commandId": 0,
      "command": "none",
      "signature": "..."
    }

  repeatMask:
    bit0 = Sunday
    bit1 = Monday
    bit2 = Tuesday
    bit3 = Wednesday
    bit4 = Thursday
    bit5 = Friday
    bit6 = Saturday

    127 = every day
    62  = Monday to Friday
    65  = Saturday + Sunday

  command:
    "none"
    "test_led"
    "test_haptic"
    "stop_alarm"
    "snooze"

  If command is not "none", commandId should increase every time.
  MCU only executes a command once when commandId is new.

  Signature payload:

    deviceId|enabled|hour|minute|repeatMask|prealertSec|snoozeMin|maxRingSec|hapticEffect|version|commandId|command
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_DRV2605.h>
#include <Preferences.h>
#include <time.h>
#include "mbedtls/md.h"

#if __has_include("arduino_secrets.h")
#include "arduino_secrets.h"
#endif

// ============================================================
// User settings
// ============================================================

// Wi-Fi
#ifndef ALARM_WIFI_SSID
#define ALARM_WIFI_SSID "YOUR_WIFI_SSID"
#endif

#ifndef ALARM_WIFI_PASS
#define ALARM_WIFI_PASS "YOUR_WIFI_PASSWORD"
#endif

const char* WIFI_SSID = ALARM_WIFI_SSID;
const char* WIFI_PASS = ALARM_WIFI_PASS;

#ifndef ALARM_WIFI_SLEEP
#define ALARM_WIFI_SLEEP true
#endif

#ifndef ALARM_WIFI_TX_POWER
#define ALARM_WIFI_TX_POWER WIFI_POWER_11dBm
#endif

#ifndef ALARM_WIFI_CONNECT_TX_POWER
#define ALARM_WIFI_CONNECT_TX_POWER WIFI_POWER_15dBm
#endif

#ifndef ALARM_WIFI_CONNECT_TIMEOUT_MS
#define ALARM_WIFI_CONNECT_TIMEOUT_MS 12000UL
#endif

#ifndef ALARM_WIFI_RETRY_INTERVAL_MS
#define ALARM_WIFI_RETRY_INTERVAL_MS 60000UL
#endif

#ifndef ALARM_WIFI_RETRY_MAX_INTERVAL_MS
#define ALARM_WIFI_RETRY_MAX_INTERVAL_MS 300000UL
#endif

#ifndef ALARM_WIFI_AUTH_FAST_RETRY_MS
#define ALARM_WIFI_AUTH_FAST_RETRY_MS 15000UL
#endif

#ifndef ALARM_WIFI_AUTH_FAST_RETRY_MAX
#define ALARM_WIFI_AUTH_FAST_RETRY_MAX 3
#endif

#ifndef ALARM_WIFI_MIN_SECURITY
#define ALARM_WIFI_MIN_SECURITY WIFI_AUTH_WPA_PSK
#endif

const bool WIFI_SLEEP = ALARM_WIFI_SLEEP;

// 每一台裝置都要不同 ID。
// 例如第二台改成 alarm_c3_002，第三台改成 alarm_c3_003。
// #ifndef ALARM_DEVICE_ID
#ifndef ALARM_DEVICE_ID
#define ALARM_DEVICE_ID "alarm_c3_001"
#endif

const char* DEVICE_ID = ALARM_DEVICE_ID;

// 外部網站 API。
// 先用 http 比較好測試；如果你的網站是 https，也可以直接填 https://...
#ifndef ALARM_CONFIG_URL_BASE
#define ALARM_CONFIG_URL_BASE "https://example.invalid/api/clock"
#endif

#ifndef ALARM_STATUS_URL
#define ALARM_STATUS_URL "https://example.invalid/api/state"
#endif

#ifndef ALARM_SYNC_URL
#define ALARM_SYNC_URL "https://example.invalid/api/sync"
#endif

const char* CONFIG_URL_BASE = ALARM_CONFIG_URL_BASE;
const char* STATUS_URL      = ALARM_STATUS_URL;
const char* SYNC_URL        = ALARM_SYNC_URL;

#ifndef ALARM_SIGNED_CONFIG_URL
#define ALARM_SIGNED_CONFIG_URL "https://esp32c3-clock-web.pages.dev/devices/alarm_c3_001.json"
#endif

#ifndef ALARM_CONFIG_HMAC_SECRET
#define ALARM_CONFIG_HMAC_SECRET ""
#endif

#ifndef ALARM_REQUIRE_CONFIG_SIGNATURE
#define ALARM_REQUIRE_CONFIG_SIGNATURE true
#endif

const char* SIGNED_CONFIG_URL = ALARM_SIGNED_CONFIG_URL;
const char* CONFIG_HMAC_SECRET = ALARM_CONFIG_HMAC_SECRET;
const bool REQUIRE_CONFIG_SIGNATURE = ALARM_REQUIRE_CONFIG_SIGNATURE;

#ifndef ALARM_ENABLE_CLOUD_SYNC
#define ALARM_ENABLE_CLOUD_SYNC false
#endif

const bool CLOUD_SYNC_ENABLED = ALARM_ENABLE_CLOUD_SYNC;

// 可選：如果網站需要簡單 token 驗證，就填入 token。
// 不需要就保持空字串。
// #ifndef ALARM_API_TOKEN
#ifndef ALARM_API_TOKEN
#define ALARM_API_TOKEN ""
#endif

const char* API_TOKEN = ALARM_API_TOKEN;

#ifndef ALARM_ENABLE_LOCAL_API
#define ALARM_ENABLE_LOCAL_API true
#endif

#ifndef ALARM_LOCAL_API_TOKEN
#define ALARM_LOCAL_API_TOKEN ALARM_API_TOKEN
#endif

const bool LOCAL_API_ENABLED = ALARM_ENABLE_LOCAL_API;
const char* LOCAL_API_TOKEN = ALARM_LOCAL_API_TOKEN;

// 如果使用 https 且沒有安裝憑證，設 true 會略過憑證驗證。
// 做專題測試可以先 true；正式產品不建議。
// #ifndef ALARM_HTTPS_INSECURE
#ifndef ALARM_HTTPS_INSECURE
#define ALARM_HTTPS_INSECURE true
#endif

const bool HTTPS_INSECURE = ALARM_HTTPS_INSECURE;

// Taiwan timezone: UTC+8
const long GMT_OFFSET_SEC = 8 * 3600;
const int DAYLIGHT_OFFSET_SEC = 0;

// ============================================================
// Pin settings
// ============================================================

#define PIN_I2C_SDA      8
#define PIN_I2C_SCL      9

#define PIN_LED_A        5
#define PIN_LED_B        6
#define PIN_LED_FLASH    7
#define PIN_TOUCH        3

// 觸控模組如果「觸碰時輸出 HIGH」，設 true。
// 如果是一般按鈕「按下接 GND」，設 false。
const bool TOUCH_ACTIVE_HIGH = false;

// ============================================================
// Timing settings
// ============================================================

const unsigned long WIFI_CONNECT_TIMEOUT_MS       = ALARM_WIFI_CONNECT_TIMEOUT_MS;
const unsigned long WIFI_RETRY_INTERVAL_MS        = ALARM_WIFI_RETRY_INTERVAL_MS;
const unsigned long WIFI_RETRY_MAX_INTERVAL_MS    = ALARM_WIFI_RETRY_MAX_INTERVAL_MS;
const unsigned long WIFI_AUTH_FAST_RETRY_MS       = ALARM_WIFI_AUTH_FAST_RETRY_MS;
const unsigned long SYNC_INTERVAL_MS              = 60000;
const unsigned long HEARTBEAT_PRINT_INTERVAL_MS   = 10000;

const unsigned long BUTTON_DEBOUNCE_MS            = 35;
const unsigned long LONG_PRESS_MS                 = 2000;

const unsigned long HAPTIC_REPEAT_MS              = 900;
const unsigned long PREALARM_HAPTIC_INTERVAL_MS   = 15000;

// ============================================================
// Objects
// ============================================================

Adafruit_DRV2605 drv;
Preferences prefs;
WiFiClientSecure secureClient;
WebServer localServer(80);

// ============================================================
// Alarm data
// ============================================================

struct AlarmConfig {
  bool enabled = true;
  int hour = 7;
  int minute = 30;
  uint8_t repeatMask = 127;
  int prealertSec = 60;
  int snoozeMin = 5;
  int maxRingSec = 300;
  int hapticEffect = 17;
  int version = 0;
};

AlarmConfig alarmConfig;

// ============================================================
// State machine
// ============================================================

enum SystemState {
  STATE_BOOT,
  STATE_TIME_INVALID,
  STATE_IDLE,
  STATE_PREALARM,
  STATE_RINGING,
  STATE_SNOOZE,
  STATE_STOPPED,
  STATE_DRV_FAIL
};

SystemState stateNow = STATE_BOOT;

// ============================================================
// Runtime variables
// ============================================================

bool drvOK = false;
bool timeOK = false;

bool wifiConnecting = false;
unsigned long wifiConnectStartMs = 0;
unsigned long lastWifiTryMs = 0;
uint8_t wifiFailCount = 0;
bool localApiStarted = false;
bool wifiRadioOffBetweenRetries = false;
uint8_t wifiAuthFastRetryCount = 0;
int lastWiFiDisconnectReason = 0;

unsigned long lastSyncMs = 0;
unsigned long lastHeartbeatPrintMs = 0;

unsigned long stateEnterMs = 0;
unsigned long lastHapticMs = 0;

int lastAlarmYday = -1;
time_t snoozeUntil = 0;

int lastCommandId = 0;
String lastAction = "BOOT";

// Button debounce
bool stableButtonNow = false;
bool lastStableButton = false;
unsigned long lastButtonChangeMs = 0;
unsigned long pressStartMs = 0;
bool longPressHandled = false;

// ============================================================
// String helpers
// ============================================================

String stateToString(SystemState s) {
  switch (s) {
    case STATE_BOOT: return "BOOT";
    case STATE_TIME_INVALID: return "TIME_INVALID";
    case STATE_IDLE: return "IDLE";
    case STATE_PREALARM: return "PREALARM";
    case STATE_RINGING: return "RINGING";
    case STATE_SNOOZE: return "SNOOZE";
    case STATE_STOPPED: return "STOPPED";
    case STATE_DRV_FAIL: return "DRV_FAIL";
    default: return "UNKNOWN";
  }
}

String getTimeString() {
  struct tm t;
  if (!getLocalTime(&t, 50)) return "";

  char buf[24];
  snprintf(buf, sizeof(buf), "%04d-%02d-%02d %02d:%02d:%02d",
           t.tm_year + 1900, t.tm_mon + 1, t.tm_mday,
           t.tm_hour, t.tm_min, t.tm_sec);
  return String(buf);
}

String getAlarmTimeString() {
  char buf[8];
  snprintf(buf, sizeof(buf), "%02d:%02d", alarmConfig.hour, alarmConfig.minute);
  return String(buf);
}

// ============================================================
// Basic hardware helpers
// ============================================================

void enterState(SystemState s) {
  stateNow = s;
  stateEnterMs = millis();
  lastHapticMs = 0;

  Serial.print("[STATE] ");
  Serial.println(stateToString(s));
}

void allLedOff() {
  digitalWrite(PIN_LED_A, LOW);
  digitalWrite(PIN_LED_B, LOW);
  digitalWrite(PIN_LED_FLASH, LOW);
}

void playHaptic(uint8_t effect) {
  if (!drvOK) return;

  drv.setWaveform(0, effect);
  drv.setWaveform(1, 0);
  drv.go();
}

bool isPressedRaw() {
  int v = digitalRead(PIN_TOUCH);

  if (TOUCH_ACTIVE_HIGH) {
    return v == HIGH;
  } else {
    return v == LOW;
  }
}

// ============================================================
// NVS storage
// ============================================================

void saveConfigToNVS() {
  prefs.begin("alarm", false);
  prefs.putBool("enabled", alarmConfig.enabled);
  prefs.putInt("hour", alarmConfig.hour);
  prefs.putInt("minute", alarmConfig.minute);
  prefs.putUChar("repeatMask", alarmConfig.repeatMask);
  prefs.putInt("prealertSec", alarmConfig.prealertSec);
  prefs.putInt("snoozeMin", alarmConfig.snoozeMin);
  prefs.putInt("maxRingSec", alarmConfig.maxRingSec);
  prefs.putInt("effect", alarmConfig.hapticEffect);
  prefs.putInt("version", alarmConfig.version);
  prefs.putInt("lastCmd", lastCommandId);
  prefs.end();
}

void loadConfigFromNVS() {
  prefs.begin("alarm", true);
  alarmConfig.enabled = prefs.getBool("enabled", true);
  alarmConfig.hour = prefs.getInt("hour", 7);
  alarmConfig.minute = prefs.getInt("minute", 30);
  alarmConfig.repeatMask = prefs.getUChar("repeatMask", 127);
  alarmConfig.prealertSec = prefs.getInt("prealertSec", 60);
  alarmConfig.snoozeMin = prefs.getInt("snoozeMin", 5);
  alarmConfig.maxRingSec = prefs.getInt("maxRingSec", 300);
  alarmConfig.hapticEffect = prefs.getInt("effect", 17);
  alarmConfig.version = prefs.getInt("version", 0);
  lastCommandId = prefs.getInt("lastCmd", 0);
  prefs.end();

  Serial.println("[NVS] Alarm config loaded");
  Serial.printf("      enabled=%d time=%02d:%02d repeatMask=%u prealert=%d snooze=%d maxRing=%d effect=%d version=%d lastCmd=%d\n",
                alarmConfig.enabled,
                alarmConfig.hour,
                alarmConfig.minute,
                alarmConfig.repeatMask,
                alarmConfig.prealertSec,
                alarmConfig.snoozeMin,
                alarmConfig.maxRingSec,
                alarmConfig.hapticEffect,
                alarmConfig.version,
                lastCommandId);
}

// ============================================================
// Time helpers
// ============================================================

bool getLocalTimeSafe(struct tm* outInfo) {
  if (!getLocalTime(outInfo, 50)) return false;

  int year = outInfo->tm_year + 1900;
  return year >= 2024;
}

time_t todayTime(int hour, int minute, int second) {
  struct tm nowInfo;
  if (!getLocalTimeSafe(&nowInfo)) return 0;

  nowInfo.tm_hour = hour;
  nowInfo.tm_min = minute;
  nowInfo.tm_sec = second;

  return mktime(&nowInfo);
}

bool isRepeatDayAllowed(int wday) {
  // tm_wday: Sunday=0, Monday=1, ... Saturday=6
  return (alarmConfig.repeatMask & (1 << wday)) != 0;
}

// ============================================================
// Wi-Fi
// ============================================================

String wifiStatusToString(wl_status_t status) {
  switch (status) {
    case WL_IDLE_STATUS: return "WL_IDLE_STATUS";
    case WL_NO_SSID_AVAIL: return "WL_NO_SSID_AVAIL";
    case WL_SCAN_COMPLETED: return "WL_SCAN_COMPLETED";
    case WL_CONNECTED: return "WL_CONNECTED";
    case WL_CONNECT_FAILED: return "WL_CONNECT_FAILED";
    case WL_CONNECTION_LOST: return "WL_CONNECTION_LOST";
    case WL_DISCONNECTED: return "WL_DISCONNECTED";
    default: return "WL_UNKNOWN";
  }
}

void onWiFiEvent(WiFiEvent_t event, WiFiEventInfo_t info) {
  switch (event) {
    case ARDUINO_EVENT_WIFI_STA_START:
      Serial.println("[WiFiEvent] STA_START");
      break;
    case ARDUINO_EVENT_WIFI_STA_CONNECTED:
      Serial.println("[WiFiEvent] STA_CONNECTED");
      break;
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      Serial.print("[WiFiEvent] GOT_IP ");
      Serial.println(WiFi.localIP());
      WiFi.setSleep(WIFI_SLEEP);
      WiFi.setTxPower(ALARM_WIFI_TX_POWER);
      wifiFailCount = 0;
      wifiAuthFastRetryCount = 0;
      lastWiFiDisconnectReason = 0;
      wifiRadioOffBetweenRetries = false;
      break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
      lastWiFiDisconnectReason = info.wifi_sta_disconnected.reason;
      Serial.print("[WiFiEvent] STA_DISCONNECTED reason=");
      Serial.println(lastWiFiDisconnectReason);
      break;
    default:
      break;
  }
}

void stopWiFiUntilNextRetry() {
  Serial.println("[WiFi] Radio off until next retry");
  WiFi.disconnect(false, false);
  WiFi.mode(WIFI_OFF);
  wifiConnecting = false;
  localApiStarted = false;
  wifiRadioOffBetweenRetries = true;
}

unsigned long currentWifiRetryIntervalMs() {
  if (lastWiFiDisconnectReason == 2 && wifiAuthFastRetryCount < ALARM_WIFI_AUTH_FAST_RETRY_MAX) {
    return WIFI_AUTH_FAST_RETRY_MS;
  }

  unsigned long interval = WIFI_RETRY_INTERVAL_MS;
  for (uint8_t i = 0; i < wifiFailCount && interval < WIFI_RETRY_MAX_INTERVAL_MS; i++) {
    interval *= 2;
    if (interval > WIFI_RETRY_MAX_INTERVAL_MS) {
      interval = WIFI_RETRY_MAX_INTERVAL_MS;
    }
  }
  return interval;
}

void recordWiFiConnectFailure() {
  if (lastWiFiDisconnectReason == 2 && wifiAuthFastRetryCount < ALARM_WIFI_AUTH_FAST_RETRY_MAX) {
    wifiAuthFastRetryCount++;
    Serial.print("[WiFi] Auth expire fast retry ");
    Serial.print(wifiAuthFastRetryCount);
    Serial.print("/");
    Serial.println(ALARM_WIFI_AUTH_FAST_RETRY_MAX);
    return;
  }

  if (wifiFailCount < 5) {
    wifiFailCount++;
  }
}

void startWiFiConnect() {
  Serial.println("[WiFi] Preparing connection...");

  WiFi.persistent(false);
  WiFi.disconnect(true, true);
  WiFi.mode(WIFI_OFF);
  delay(500);

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setTxPower(ALARM_WIFI_CONNECT_TX_POWER);
  WiFi.setAutoReconnect(false);
  WiFi.setMinSecurity(ALARM_WIFI_MIN_SECURITY);

  // 清掉舊狀態，避免 sta is connecting 重複錯誤
  Serial.print("[WiFi] Connecting to ");
  Serial.print(WIFI_SSID);
  Serial.println(" using direct connect");
  Serial.print("[WiFi] Sleep = ");
  Serial.println("OFF while connecting");
  Serial.print("[WiFi] Connect TX power enum = ");
  Serial.println((int)ALARM_WIFI_CONNECT_TX_POWER);
  Serial.print("[WiFi] Steady TX power enum = ");
  Serial.println((int)ALARM_WIFI_TX_POWER);
  Serial.print("[WiFi] Min security enum = ");
  Serial.println((int)ALARM_WIFI_MIN_SECURITY);
  Serial.print("[WiFi] Retry wait after failure = ");
  Serial.print(currentWifiRetryIntervalMs() / 1000);
  Serial.println(" sec");
  Serial.print("[WiFi] Password length = ");
  Serial.println(strlen(WIFI_PASS));

  WiFi.begin(WIFI_SSID, WIFI_PASS);

  wifiConnecting = true;
  wifiRadioOffBetweenRetries = false;
  wifiConnectStartMs = millis();
  lastWifiTryMs = millis();
}

void maintainWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnecting = false;
    wifiFailCount = 0;
    wifiRadioOffBetweenRetries = false;
    return;
  }

  if (wifiConnecting) {
    if (millis() - wifiConnectStartMs < WIFI_CONNECT_TIMEOUT_MS) {
      return;
    }

    Serial.println("[WiFi] Connect timeout, disconnect first");
    Serial.print("[WiFi] Timeout status = ");
    Serial.print(WiFi.status());
    Serial.print(" (");
    Serial.print(wifiStatusToString(WiFi.status()));
    Serial.println(")");
    recordWiFiConnectFailure();
    lastWifiTryMs = millis();
    stopWiFiUntilNextRetry();
    return;
  }

  if (millis() - lastWifiTryMs >= currentWifiRetryIntervalMs()) {
    lastWifiTryMs = millis();
    startWiFiConnect();
  }
}

bool waitWiFiConnected(unsigned long timeoutMs) {
  unsigned long startMs = millis();
  unsigned long lastStatusPrintMs = 0;

  while (millis() - startMs < timeoutMs) {
    if (WiFi.status() == WL_CONNECTED) {
      wifiConnecting = false;

      Serial.println();
      Serial.println("[WiFi] Connected!");
      Serial.print("[WiFi] IP = ");
      Serial.println(WiFi.localIP());
      wifiFailCount = 0;
      wifiRadioOffBetweenRetries = false;
      WiFi.setSleep(WIFI_SLEEP);
      WiFi.setTxPower(ALARM_WIFI_TX_POWER);
      return true;
    }

    if (millis() - lastStatusPrintMs >= 1000) {
      lastStatusPrintMs = millis();
      Serial.print("[WiFi] Waiting, status=");
      Serial.print(WiFi.status());
      Serial.print(" (");
      Serial.print(wifiStatusToString(WiFi.status()));
      Serial.println(")");
    }

    delay(400);
  }

  Serial.println();
  Serial.println("[WiFi] Initial connect failed");
  Serial.print("[WiFi] Final status code = ");
  Serial.print(WiFi.status());
  Serial.print(" (");
  Serial.print(wifiStatusToString(WiFi.status()));
  Serial.println(")");
  recordWiFiConnectFailure();
  lastWifiTryMs = millis();
  stopWiFiUntilNextRetry();
  return false;
}

void setupWiFi() {
  startWiFiConnect();
  waitWiFiConnected(WIFI_CONNECT_TIMEOUT_MS);
}

void setupTimeNTP() {
  if (WiFi.status() != WL_CONNECTED) {
    timeOK = false;
    return;
  }

  Serial.println("[NTP] Config time...");
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC,
             "pool.ntp.org",
             "time.nist.gov",
             "time.google.com");

  Serial.print("[NTP] Syncing");

  struct tm t;
  unsigned long startMs = millis();

  while (!getLocalTimeSafe(&t) && millis() - startMs < 10000) {
    Serial.print(".");
    delay(300);
  }

  Serial.println();

  timeOK = getLocalTimeSafe(&t);

  if (timeOK) {
    Serial.printf("[NTP] Time OK: %04d-%02d-%02d %02d:%02d:%02d\n",
                  t.tm_year + 1900, t.tm_mon + 1, t.tm_mday,
                  t.tm_hour, t.tm_min, t.tm_sec);
  } else {
    Serial.println("[NTP] Time invalid");
  }
}

// ============================================================
// I2C / DRV2605L
// ============================================================

bool i2cScanHasDevice(uint8_t address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission() == 0;
}

void scanI2CDevices() {
  Serial.println("[I2C] Scanning...");

  int count = 0;

  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print("[I2C] Found device at 0x");
      if (addr < 16) Serial.print("0");
      Serial.println(addr, HEX);
      count++;
      delay(5);
    }
  }

  if (count == 0) {
    Serial.println("[I2C] No device found");
  }
}

void initDRV2605L() {
  Serial.printf("[DRV2605L] Init SDA=GPIO%d, SCL=GPIO%d\n", PIN_I2C_SDA, PIN_I2C_SCL);

  Wire.setPins(PIN_I2C_SDA, PIN_I2C_SCL);
  Wire.begin();
  Wire.setClock(100000);

  scanI2CDevices();

  if (!i2cScanHasDevice(0x5A)) {
    drvOK = false;
    Serial.println("[DRV2605L] 0x5A not found. Check SDA/SCL/VCC/GND.");
    return;
  }

  if (!drv.begin(&Wire)) {
    drvOK = false;
    Serial.println("[DRV2605L] begin() failed");
    return;
  }

  drvOK = true;
  Serial.println("[DRV2605L] Found");

  // ERM motor library.
  // If using LRA actuator, try drv.selectLibrary(6);
  drv.selectLibrary(1);

  // Internal trigger mode
  drv.setMode(DRV2605_MODE_INTTRIG);

  playHaptic(1);
}

// ============================================================
// HTTP helpers
// ============================================================

bool httpBeginSmart(HTTPClient& http, const String& url) {
  if (url.startsWith("https://")) {
    if (HTTPS_INSECURE) {
      secureClient.setInsecure();
    }
    return http.begin(secureClient, url);
  }

  return http.begin(url);
}

void addCommonHeaders(HTTPClient& http) {
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", DEVICE_ID);

  if (strlen(API_TOKEN) > 0) {
    http.addHeader("X-Device-Token", API_TOKEN);
  }
}

String buildConfigUrl() {
  if (strlen(SIGNED_CONFIG_URL) > 0) {
    return String(SIGNED_CONFIG_URL);
  }

  String url = String(CONFIG_URL_BASE);
  url += "?device_id=";
  url += DEVICE_ID;
  return url;
}

String boolForSignature(bool value) {
  return value ? "1" : "0";
}

String signedConfigPayload(JsonVariantConst doc) {
  const char* deviceId = doc["deviceId"] | "";
  const char* command = doc["command"] | "none";

  if (strlen(deviceId) == 0 ||
      !doc["enabled"].is<bool>() ||
      !doc["hour"].is<int>() ||
      !doc["minute"].is<int>() ||
      !doc["repeatMask"].is<int>() ||
      !doc["prealertSec"].is<int>() ||
      !doc["snoozeMin"].is<int>() ||
      !doc["maxRingSec"].is<int>() ||
      !doc["hapticEffect"].is<int>() ||
      !doc["version"].is<int>() ||
      !doc["commandId"].is<int>()) {
    return "";
  }

  String payload = String(deviceId);
  payload += "|";
  payload += boolForSignature(doc["enabled"].as<bool>());
  payload += "|";
  payload += String(doc["hour"].as<int>());
  payload += "|";
  payload += String(doc["minute"].as<int>());
  payload += "|";
  payload += String(doc["repeatMask"].as<int>());
  payload += "|";
  payload += String(doc["prealertSec"].as<int>());
  payload += "|";
  payload += String(doc["snoozeMin"].as<int>());
  payload += "|";
  payload += String(doc["maxRingSec"].as<int>());
  payload += "|";
  payload += String(doc["hapticEffect"].as<int>());
  payload += "|";
  payload += String(doc["version"].as<int>());
  payload += "|";
  payload += String(doc["commandId"].as<int>());
  payload += "|";
  payload += String(command);
  return payload;
}

String hmacSha256Hex(const char* secret, const String& payload) {
  byte digest[32];
  const mbedtls_md_info_t* mdInfo = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);

  if (mdInfo == nullptr) {
    return "";
  }

  int result = mbedtls_md_hmac(
    mdInfo,
    reinterpret_cast<const unsigned char*>(secret),
    strlen(secret),
    reinterpret_cast<const unsigned char*>(payload.c_str()),
    payload.length(),
    digest
  );

  if (result != 0) {
    return "";
  }

  const char hexChars[] = "0123456789abcdef";
  String hex;
  hex.reserve(64);

  for (byte value : digest) {
    hex += hexChars[(value >> 4) & 0x0F];
    hex += hexChars[value & 0x0F];
  }

  return hex;
}

bool verifyConfigSignature(JsonVariantConst doc) {
  if (!REQUIRE_CONFIG_SIGNATURE) {
    return true;
  }

  if (strlen(CONFIG_HMAC_SECRET) == 0) {
    Serial.println("[SIG] Missing ALARM_CONFIG_HMAC_SECRET, config rejected");
    return false;
  }

  const char* signature = doc["signature"] | "";
  if (strlen(signature) == 0) {
    Serial.println("[SIG] Missing signature, config rejected");
    return false;
  }

  String payload = signedConfigPayload(doc);
  if (payload.length() == 0) {
    Serial.println("[SIG] Missing signed fields, config rejected");
    return false;
  }

  String expected = hmacSha256Hex(CONFIG_HMAC_SECRET, payload);
  if (expected.length() == 0 || !expected.equalsIgnoreCase(String(signature))) {
    Serial.println("[SIG] Signature mismatch, config rejected");
    Serial.print("[SIG] Payload: ");
    Serial.println(payload);
    return false;
  }

  Serial.println("[SIG] Signature OK");
  return true;
}

// ============================================================
// Commands from website
// ============================================================

void runLedTest() {
  Serial.println("[CMD] test_led");
  lastAction = "TEST_LED";

  for (int i = 0; i < 3; i++) {
    digitalWrite(PIN_LED_A, HIGH);
    digitalWrite(PIN_LED_B, LOW);
    digitalWrite(PIN_LED_FLASH, HIGH);
    delay(150);

    digitalWrite(PIN_LED_A, LOW);
    digitalWrite(PIN_LED_B, HIGH);
    digitalWrite(PIN_LED_FLASH, LOW);
    delay(150);
  }

  allLedOff();
}

void stopAlarm() {
  allLedOff();
  if (drvOK) drv.stop();

  lastAction = "STOPPED";
  enterState(STATE_STOPPED);

  playHaptic(24);
}

void snoozeAlarm() {
  if (stateNow != STATE_RINGING && stateNow != STATE_PREALARM) {
    return;
  }

  time_t nowEpoch = time(nullptr);
  snoozeUntil = nowEpoch + alarmConfig.snoozeMin * 60;

  lastAction = "SNOOZE";
  enterState(STATE_SNOOZE);

  playHaptic(27);
}

void executeCommand(int commandId, String command, int effectFromCommand) {
  command.trim();

  if (commandId <= 0) return;
  if (commandId == lastCommandId) return;
  if (command == "" || command == "none") return;

  Serial.printf("[CMD] New command id=%d command=%s\n", commandId, command.c_str());

  lastCommandId = commandId;
  saveConfigToNVS();

  if (command == "test_led") {
    runLedTest();
  } else if (command == "test_haptic") {
    lastAction = "TEST_HAPTIC";
    int effect = effectFromCommand > 0 ? effectFromCommand : alarmConfig.hapticEffect;
    playHaptic((uint8_t)effect);
  } else if (command == "stop_alarm") {
    stopAlarm();
  } else if (command == "snooze") {
    snoozeAlarm();
  } else {
    Serial.println("[CMD] Unknown command");
  }
}

// ============================================================
// Config sync from website
// ============================================================

bool applyConfigFromJson(JsonVariantConst doc) {
  // Optional: confirm deviceId if the server provides it.
  const char* returnedDeviceId = doc["deviceId"] | "";
  if (strlen(returnedDeviceId) > 0 && String(returnedDeviceId) != String(DEVICE_ID)) {
    Serial.println("[API] deviceId mismatch, ignored");
    return false;
  }

  int incomingVersion = doc["version"] | alarmConfig.version;
  if (incomingVersion < alarmConfig.version) {
    Serial.println("[API] Older config version, ignored");
    return false;
  }

  alarmConfig.enabled = doc["enabled"] | alarmConfig.enabled;
  alarmConfig.hour = doc["hour"] | alarmConfig.hour;
  alarmConfig.minute = doc["minute"] | alarmConfig.minute;
  alarmConfig.repeatMask = doc["repeatMask"] | alarmConfig.repeatMask;
  alarmConfig.prealertSec = doc["prealertSec"] | alarmConfig.prealertSec;
  alarmConfig.snoozeMin = doc["snoozeMin"] | alarmConfig.snoozeMin;
  alarmConfig.maxRingSec = doc["maxRingSec"] | alarmConfig.maxRingSec;
  alarmConfig.hapticEffect = doc["hapticEffect"] | alarmConfig.hapticEffect;
  alarmConfig.version = incomingVersion;

  alarmConfig.hour = constrain(alarmConfig.hour, 0, 23);
  alarmConfig.minute = constrain(alarmConfig.minute, 0, 59);
  alarmConfig.repeatMask = constrain(alarmConfig.repeatMask, 0, 127);
  alarmConfig.prealertSec = constrain(alarmConfig.prealertSec, 0, 3600);
  alarmConfig.snoozeMin = constrain(alarmConfig.snoozeMin, 1, 60);
  alarmConfig.maxRingSec = constrain(alarmConfig.maxRingSec, 10, 3600);
  alarmConfig.hapticEffect = constrain(alarmConfig.hapticEffect, 1, 123);

  saveConfigToNVS();

  Serial.printf("[API] Config updated: enabled=%d time=%02d:%02d repeatMask=%u prealert=%d snooze=%d maxRing=%d effect=%d version=%d\n",
                alarmConfig.enabled,
                alarmConfig.hour,
                alarmConfig.minute,
                alarmConfig.repeatMask,
                alarmConfig.prealertSec,
                alarmConfig.snoozeMin,
                alarmConfig.maxRingSec,
                alarmConfig.hapticEffect,
                alarmConfig.version);

  int commandId = doc["commandId"] | 0;
  const char* commandCstr = doc["command"] | "none";
  int commandEffect = doc["hapticEffect"] | alarmConfig.hapticEffect;

  executeCommand(commandId, String(commandCstr), commandEffect);

  return true;
}

bool syncConfigFromServer() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  String url = buildConfigUrl();
  Serial.print("[API] GET ");
  Serial.println(url);

  HTTPClient http;

  if (!httpBeginSmart(http, url)) {
    Serial.println("[API] http.begin failed");
    return false;
  }

  http.setTimeout(7000);
  addCommonHeaders(http);

  int httpCode = http.GET();

  if (httpCode != HTTP_CODE_OK) {
    Serial.printf("[API] Config GET failed, code=%d\n", httpCode);
    http.end();
    return false;
  }

  String payload = http.getString();
  http.end();

  Serial.print("[API] Config payload: ");
  Serial.println(payload);

  StaticJsonDocument<768> doc;
  DeserializationError err = deserializeJson(doc, payload);

  if (err) {
    Serial.print("[API] JSON parse error: ");
    Serial.println(err.c_str());
    return false;
  }

  if (!verifyConfigSignature(doc.as<JsonVariantConst>())) {
    return false;
  }

  return applyConfigFromJson(doc.as<JsonVariantConst>());
}

// ============================================================
// Status POST to website
// ============================================================

void fillConfigJsonObject(JsonObject doc) {
  doc["deviceId"] = DEVICE_ID;
  doc["enabled"] = alarmConfig.enabled;
  doc["hour"] = alarmConfig.hour;
  doc["minute"] = alarmConfig.minute;
  doc["repeatMask"] = alarmConfig.repeatMask;
  doc["prealertSec"] = alarmConfig.prealertSec;
  doc["snoozeMin"] = alarmConfig.snoozeMin;
  doc["maxRingSec"] = alarmConfig.maxRingSec;
  doc["hapticEffect"] = alarmConfig.hapticEffect;
  doc["version"] = alarmConfig.version;
  doc["commandId"] = lastCommandId;
  doc["command"] = "none";
}

void fillStatusJsonObject(JsonObject doc) {
  doc["deviceId"] = DEVICE_ID;
  doc["online"] = true;
  doc["state"] = stateToString(stateNow);

  doc["wifiOk"] = WiFi.status() == WL_CONNECTED;
  doc["wifiRssi"] = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0;
  doc["ip"] = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : "";

  struct tm t;
  timeOK = getLocalTimeSafe(&t);
  doc["timeOk"] = timeOK;
  doc["time"] = timeOK ? getTimeString() : "";

  doc["drvOk"] = drvOK;

  doc["alarmEnabled"] = alarmConfig.enabled;
  doc["alarmTime"] = getAlarmTimeString();
  doc["hour"] = alarmConfig.hour;
  doc["minute"] = alarmConfig.minute;
  doc["repeatMask"] = alarmConfig.repeatMask;
  doc["prealertSec"] = alarmConfig.prealertSec;
  doc["snoozeMin"] = alarmConfig.snoozeMin;
  doc["maxRingSec"] = alarmConfig.maxRingSec;
  doc["hapticEffect"] = alarmConfig.hapticEffect;
  doc["configVersion"] = alarmConfig.version;

  doc["lastAction"] = lastAction;
  doc["lastCommandId"] = lastCommandId;
  doc["heap"] = ESP.getFreeHeap();
}

void fillStatusJson(JsonDocument& doc) {
  fillStatusJsonObject(doc.to<JsonObject>());
}

bool postStatusToServer() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;

  if (!httpBeginSmart(http, String(STATUS_URL))) {
    Serial.println("[API] status http.begin failed");
    return false;
  }

  http.setTimeout(7000);
  addCommonHeaders(http);

  StaticJsonDocument<768> doc;
  fillStatusJson(doc);

  String body;
  serializeJson(doc, body);

  Serial.print("[API] POST status: ");
  Serial.println(body);

  int code = http.POST(body);
  http.end();

  Serial.printf("[API] Status POST code=%d\n", code);

  return code >= 200 && code < 300;
}

bool syncWithServer() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  if (!CLOUD_SYNC_ENABLED || strlen(SYNC_URL) == 0) {
    return false;
  }

  HTTPClient http;

  Serial.print("[API] POST sync: ");
  Serial.println(SYNC_URL);

  if (!httpBeginSmart(http, String(SYNC_URL))) {
    Serial.println("[API] sync http.begin failed");
    return false;
  }

  http.setTimeout(7000);
  addCommonHeaders(http);

  StaticJsonDocument<768> statusDoc;
  fillStatusJson(statusDoc);

  String body;
  serializeJson(statusDoc, body);

  int code = http.POST(body);
  String payload = http.getString();
  http.end();

  Serial.printf("[API] Sync code=%d\n", code);

  if (code < 200 || code >= 300) {
    if (payload.length() > 0) {
      Serial.print("[API] Sync error payload: ");
      Serial.println(payload);
    }
    return false;
  }

  if (payload.length() == 0) {
    return true;
  }

  Serial.print("[API] Sync payload: ");
  Serial.println(payload);

  StaticJsonDocument<1024> responseDoc;
  DeserializationError err = deserializeJson(responseDoc, payload);

  if (err) {
    Serial.print("[API] Sync JSON parse error: ");
    Serial.println(err.c_str());
    return false;
  }

  JsonVariantConst config = responseDoc["config"].as<JsonVariantConst>();
  if (config.isNull()) {
    config = responseDoc.as<JsonVariantConst>();
  }

  return applyConfigFromJson(config);
}

// ============================================================
// Local MCU website/API
// ============================================================

const char LOCAL_WEB_PAGE[] PROGMEM = R"rawliteral(
<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ESP32-C3 Alarm</title>
  <style>
    :root{color-scheme:dark;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0a0a0a;color:#f5f5f5}
    body{margin:0;padding:18px}
    main{max-width:680px;margin:auto}
    section{border:1px solid #262626;background:#171717;border-radius:8px;padding:16px;margin:0 0 14px}
    h1{font-size:22px;margin:0 0 4px}
    h2{font-size:16px;margin:0 0 12px}
    p{color:#a3a3a3;margin:4px 0}
    label{display:block;font-size:13px;color:#a3a3a3;margin:10px 0 4px}
    input{box-sizing:border-box;width:100%;height:42px;border:1px solid #404040;border-radius:6px;background:#050505;color:#f5f5f5;padding:0 10px}
    button{height:40px;border:1px solid #404040;border-radius:6px;background:#0a0a0a;color:#f5f5f5;padding:0 12px;font-weight:600}
    button:hover{background:#262626}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .cmds{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .state{font-size:32px;font-weight:700;color:#67e8f9}
    .row{display:flex;align-items:center;justify-content:space-between;gap:10px}
    pre{white-space:pre-wrap;max-height:220px;overflow:auto;border-radius:6px;background:#050505;padding:12px;color:#d4d4d4}
  </style>
</head>
<body>
<main>
  <section>
    <h1>ESP32-C3 Alarm</h1>
    <p id="meta">Local MCU mode</p>
    <div class="state" id="state">--</div>
    <p id="statusLine">尚未讀取</p>
  </section>
  <section>
    <h2>本機 API</h2>
    <label>Local API Token</label>
    <input id="token" type="password" placeholder="ALARM_LOCAL_API_TOKEN，留空代表未啟用">
  </section>
  <section>
    <h2>鬧鐘設定</h2>
    <div class="grid">
      <div><label>小時</label><input id="hour" type="number" min="0" max="23"></div>
      <div><label>分鐘</label><input id="minute" type="number" min="0" max="59"></div>
      <div><label>震動效果</label><input id="effect" type="number" min="1" max="123"></div>
      <div><label>貪睡分鐘</label><input id="snooze" type="number" min="1" max="60"></div>
    </div>
    <label>Repeat mask</label>
    <input id="repeat" type="number" min="0" max="127">
    <label><input id="enabled" type="checkbox" style="width:auto;height:auto"> 啟用鬧鐘</label>
    <button onclick="saveConfig()">儲存設定</button>
  </section>
  <section>
    <h2>控制指令</h2>
    <div class="cmds">
      <button onclick="sendCommand('test_led')">測試 LED</button>
      <button onclick="sendCommand('test_haptic')">測試震動</button>
      <button onclick="sendCommand('stop_alarm')">停止鬧鐘</button>
      <button onclick="sendCommand('snooze')">貪睡</button>
    </div>
  </section>
  <section>
    <div class="row">
      <h2>事件</h2>
      <button onclick="refresh()">重新整理</button>
    </div>
    <pre id="log"></pre>
  </section>
</main>
<script>
const $ = (id) => document.getElementById(id);
function headers(){
  const token = $('token').value.trim();
  const next = {'Content-Type':'application/json'};
  if(token) next['X-Local-Token'] = token;
  return next;
}
function log(text, data){
  $('log').textContent = new Date().toLocaleTimeString() + ' ' + text + (data ? '\n' + JSON.stringify(data, null, 2) : '');
}
async function refresh(){
  try{
    const res = await fetch('/api/local/status', {headers: headers()});
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const c = data.config || {};
    const s = data.status || {};
    $('state').textContent = s.state || '--';
    $('statusLine').textContent = (s.ip || '-') + ' · RSSI ' + (s.wifiRssi || 0) + ' · heap ' + (s.heap || 0);
    $('meta').textContent = c.deviceId || 'alarm_c3_001';
    $('hour').value = c.hour ?? 7;
    $('minute').value = c.minute ?? 30;
    $('effect').value = c.hapticEffect ?? 17;
    $('snooze').value = c.snoozeMin ?? 5;
    $('repeat').value = c.repeatMask ?? 62;
    $('enabled').checked = Boolean(c.enabled);
    log('狀態已更新', data);
  }catch(error){ log('讀取失敗: ' + error.message); }
}
async function saveConfig(){
  const body = {
    enabled: $('enabled').checked,
    hour: Number($('hour').value),
    minute: Number($('minute').value),
    repeatMask: Number($('repeat').value),
    snoozeMin: Number($('snooze').value),
    hapticEffect: Number($('effect').value)
  };
  try{
    const res = await fetch('/api/local/config', {method:'POST',headers:headers(),body:JSON.stringify(body)});
    if(!res.ok) throw new Error('HTTP ' + res.status);
    log('設定已儲存', await res.json());
    refresh();
  }catch(error){ log('儲存失敗: ' + error.message); }
}
async function sendCommand(command){
  try{
    const res = await fetch('/api/local/command', {method:'POST',headers:headers(),body:JSON.stringify({command, hapticEffect:Number($('effect').value)})});
    if(!res.ok) throw new Error('HTTP ' + res.status);
    log('指令已送出: ' + command, await res.json());
    refresh();
  }catch(error){ log('指令失敗: ' + error.message); }
}
refresh();
setInterval(refresh, 15000);
</script>
</body>
</html>
)rawliteral";

void addLocalCorsHeaders() {
  localServer.sendHeader("Access-Control-Allow-Origin", "*");
  localServer.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  localServer.sendHeader("Access-Control-Allow-Headers", "Content-Type,X-Local-Token,X-Device-Token");
}

void sendLocalJson(JsonDocument& doc, int statusCode = 200) {
  String body;
  serializeJson(doc, body);
  addLocalCorsHeaders();
  localServer.send(statusCode, "application/json", body);
}

void sendLocalError(int statusCode, const char* message) {
  StaticJsonDocument<160> doc;
  doc["error"] = message;
  sendLocalJson(doc, statusCode);
}

bool hasLocalApiToken() {
  if (strlen(LOCAL_API_TOKEN) == 0) {
    return true;
  }

  String localToken = localServer.header("X-Local-Token");
  String deviceToken = localServer.header("X-Device-Token");
  return localToken == LOCAL_API_TOKEN || deviceToken == LOCAL_API_TOKEN;
}

bool ensureLocalApiAccess() {
  if (localServer.method() == HTTP_OPTIONS) {
    addLocalCorsHeaders();
    localServer.send(204, "text/plain", "");
    return false;
  }

  if (!hasLocalApiToken()) {
    sendLocalError(401, "Invalid or missing X-Local-Token");
    return false;
  }

  return true;
}

bool isAllowedLocalCommand(const String& command) {
  return command == "none" ||
         command == "test_led" ||
         command == "test_haptic" ||
         command == "stop_alarm" ||
         command == "snooze";
}

void handleLocalHome() {
  localServer.send_P(200, "text/html; charset=utf-8", LOCAL_WEB_PAGE);
}

void handleLocalStatus() {
  if (!ensureLocalApiAccess()) return;

  StaticJsonDocument<1536> doc;
  fillConfigJsonObject(doc.createNestedObject("config"));
  fillStatusJsonObject(doc.createNestedObject("status"));
  sendLocalJson(doc);
}

void handleLocalConfig() {
  if (!ensureLocalApiAccess()) return;

  StaticJsonDocument<768> body;
  DeserializationError err = deserializeJson(body, localServer.arg("plain"));

  if (err) {
    sendLocalError(400, "Invalid JSON body");
    return;
  }

  body["deviceId"] = DEVICE_ID;
  body["version"] = alarmConfig.version + 1;
  body["command"] = "none";
  body["commandId"] = lastCommandId;

  if (!applyConfigFromJson(body.as<JsonVariantConst>())) {
    sendLocalError(400, "Config rejected");
    return;
  }

  StaticJsonDocument<768> response;
  response["success"] = true;
  fillConfigJsonObject(response.createNestedObject("config"));
  sendLocalJson(response);
}

void handleLocalCommand() {
  if (!ensureLocalApiAccess()) return;

  StaticJsonDocument<384> body;
  DeserializationError err = deserializeJson(body, localServer.arg("plain"));

  if (err) {
    sendLocalError(400, "Invalid JSON body");
    return;
  }

  String command = String(body["command"] | "none");
  command.trim();

  if (!isAllowedLocalCommand(command)) {
    sendLocalError(400, "Unsupported command");
    return;
  }

  int effect = body["hapticEffect"] | alarmConfig.hapticEffect;
  int nextCommandId = lastCommandId + 1;
  executeCommand(nextCommandId, command, effect);

  StaticJsonDocument<768> response;
  response["success"] = true;
  response["commandId"] = lastCommandId;
  fillConfigJsonObject(response.createNestedObject("config"));
  sendLocalJson(response);
}

void handleLocalOptions() {
  addLocalCorsHeaders();
  localServer.send(204, "text/plain", "");
}

void setupLocalApiServer() {
  if (!LOCAL_API_ENABLED || localApiStarted || WiFi.status() != WL_CONNECTED) {
    return;
  }

  const char* headers[] = { "X-Local-Token", "X-Device-Token" };
  localServer.collectHeaders(headers, 2);
  localServer.on("/", HTTP_GET, handleLocalHome);
  localServer.on("/api/local/status", HTTP_GET, handleLocalStatus);
  localServer.on("/api/local/status", HTTP_OPTIONS, handleLocalOptions);
  localServer.on("/api/local/config", HTTP_POST, handleLocalConfig);
  localServer.on("/api/local/config", HTTP_OPTIONS, handleLocalOptions);
  localServer.on("/api/local/command", HTTP_POST, handleLocalCommand);
  localServer.on("/api/local/command", HTTP_OPTIONS, handleLocalOptions);
  localServer.begin();
  localApiStarted = true;

  Serial.print("[LocalAPI] Listening at http://");
  Serial.print(WiFi.localIP());
  Serial.println("/");
}

void maintainLocalApiServer() {
  if (LOCAL_API_ENABLED && localApiStarted) {
    localServer.handleClient();
  }
}

// ============================================================
// Alarm engine
// ============================================================

bool shouldEnterPrealarm(struct tm& nowInfo, time_t nowEpoch) {
  if (!alarmConfig.enabled) return false;
  if (!isRepeatDayAllowed(nowInfo.tm_wday)) return false;
  if (lastAlarmYday == nowInfo.tm_yday) return false;

  time_t alarmEpoch = todayTime(alarmConfig.hour, alarmConfig.minute, 0);
  if (alarmEpoch == 0) return false;

  long diff = (long)(alarmEpoch - nowEpoch);

  return diff <= alarmConfig.prealertSec && diff > 0;
}

bool shouldStartAlarm(struct tm& nowInfo, time_t nowEpoch) {
  if (!alarmConfig.enabled) return false;
  if (!isRepeatDayAllowed(nowInfo.tm_wday)) return false;
  if (lastAlarmYday == nowInfo.tm_yday) return false;

  time_t alarmEpoch = todayTime(alarmConfig.hour, alarmConfig.minute, 0);
  if (alarmEpoch == 0) return false;

  long diff = (long)(nowEpoch - alarmEpoch);

  return diff >= 0 && diff < 60;
}

void startRinging(struct tm& nowInfo) {
  lastAlarmYday = nowInfo.tm_yday;
  lastAction = "ALARM_RINGING";
  enterState(STATE_RINGING);
  playHaptic(alarmConfig.hapticEffect);
}

void updateAlarmEngine() {
  struct tm nowInfo;

  if (!getLocalTimeSafe(&nowInfo)) {
    timeOK = false;

    if (stateNow != STATE_TIME_INVALID && stateNow != STATE_BOOT) {
      enterState(STATE_TIME_INVALID);
    }

    return;
  }

  timeOK = true;
  time_t nowEpoch = time(nullptr);

  if (stateNow == STATE_TIME_INVALID || stateNow == STATE_BOOT) {
    enterState(STATE_IDLE);
  }

  if (stateNow == STATE_IDLE) {
    if (shouldEnterPrealarm(nowInfo, nowEpoch)) {
      lastAction = "PREALARM";
      enterState(STATE_PREALARM);
      playHaptic(58);
      return;
    }

    if (shouldStartAlarm(nowInfo, nowEpoch)) {
      startRinging(nowInfo);
      return;
    }
  }

  if (stateNow == STATE_PREALARM) {
    if (shouldStartAlarm(nowInfo, nowEpoch)) {
      startRinging(nowInfo);
      return;
    }

    if (millis() - lastHapticMs >= PREALARM_HAPTIC_INTERVAL_MS) {
      lastHapticMs = millis();
      playHaptic(58);
    }
  }

  if (stateNow == STATE_RINGING) {
    if (millis() - stateEnterMs > (unsigned long)alarmConfig.maxRingSec * 1000UL) {
      Serial.println("[ALARM] Timeout stop");
      stopAlarm();
      return;
    }

    if (millis() - lastHapticMs >= HAPTIC_REPEAT_MS) {
      lastHapticMs = millis();

      static uint8_t effectIndex = 0;
      uint8_t effects[] = {
        17,
        10,
        14,
        (uint8_t)alarmConfig.hapticEffect
      };

      playHaptic(effects[effectIndex % 4]);
      effectIndex++;
    }
  }

  if (stateNow == STATE_SNOOZE) {
    if (nowEpoch >= snoozeUntil) {
      Serial.println("[ALARM] Snooze finished, ringing again");
      lastAction = "SNOOZE_RINGING";
      enterState(STATE_RINGING);
      playHaptic(alarmConfig.hapticEffect);
    }
  }
}

// ============================================================
// Button logic
// ============================================================

void handleButtonEventShort() {
  Serial.println("[BTN] Short press");

  if (stateNow == STATE_RINGING) {
    snoozeAlarm();
  } else if (stateNow == STATE_PREALARM) {
    lastAction = "PREALARM_CANCEL";
    enterState(STATE_IDLE);
  } else if (stateNow == STATE_SNOOZE) {
    Serial.println("[BTN] Already snoozing");
  } else {
    runLedTest();
    playHaptic(1);
  }
}

void handleButtonEventLong() {
  Serial.println("[BTN] Long press");

  if (stateNow == STATE_RINGING || stateNow == STATE_PREALARM || stateNow == STATE_SNOOZE) {
    stopAlarm();
  } else {
    Serial.println("[BTN] Long press ignored outside alarm states");
    playHaptic(1);
  }
}

void updateButton() {
  bool rawNow = isPressedRaw();

  if (rawNow != stableButtonNow) {
    if (millis() - lastButtonChangeMs >= BUTTON_DEBOUNCE_MS) {
      stableButtonNow = rawNow;
      lastButtonChangeMs = millis();
    }
  } else {
    lastButtonChangeMs = millis();
  }

  // pressed edge
  if (stableButtonNow && !lastStableButton) {
    pressStartMs = millis();
    longPressHandled = false;
  }

  // holding
  if (stableButtonNow && !longPressHandled) {
    if (millis() - pressStartMs >= LONG_PRESS_MS) {
      longPressHandled = true;
      handleButtonEventLong();
    }
  }

  // released edge
  if (!stableButtonNow && lastStableButton) {
    if (!longPressHandled) {
      handleButtonEventShort();
    }
  }

  lastStableButton = stableButtonNow;
}

// ============================================================
// LED display patterns
// ============================================================

void updateLedPattern() {
  unsigned long nowMs = millis();

  switch (stateNow) {
    case STATE_BOOT:
      digitalWrite(PIN_LED_A, (nowMs / 200) % 2);
      digitalWrite(PIN_LED_B, LOW);
      digitalWrite(PIN_LED_FLASH, LOW);
      break;

    case STATE_TIME_INVALID:
      digitalWrite(PIN_LED_A, LOW);
      digitalWrite(PIN_LED_B, (nowMs / 1000) % 2);
      digitalWrite(PIN_LED_FLASH, LOW);
      break;

    case STATE_IDLE:
      // slow heartbeat
      digitalWrite(PIN_LED_A, (nowMs % 10000) < 80);
      digitalWrite(PIN_LED_B, LOW);
      digitalWrite(PIN_LED_FLASH, LOW);
      break;

    case STATE_PREALARM:
      digitalWrite(PIN_LED_A, (nowMs / 500) % 2);
      digitalWrite(PIN_LED_B, LOW);
      digitalWrite(PIN_LED_FLASH, (nowMs % 5000) < 120);
      break;

    case STATE_RINGING:
      digitalWrite(PIN_LED_A, HIGH);
      digitalWrite(PIN_LED_B, (nowMs / 250) % 2);
      digitalWrite(PIN_LED_FLASH, (nowMs / 125) % 2);
      break;

    case STATE_SNOOZE: {
      unsigned long p = nowMs % 10000;
      bool doubleBlink = (p < 100) || (p > 250 && p < 350);
      digitalWrite(PIN_LED_A, doubleBlink);
      digitalWrite(PIN_LED_B, LOW);
      digitalWrite(PIN_LED_FLASH, LOW);
      break;
    }

    case STATE_STOPPED:
      digitalWrite(PIN_LED_A, (nowMs - stateEnterMs) < 1000);
      digitalWrite(PIN_LED_B, (nowMs - stateEnterMs) < 1000);
      digitalWrite(PIN_LED_FLASH, LOW);

      if (nowMs - stateEnterMs > 1200) {
        enterState(STATE_IDLE);
      }
      break;

    case STATE_DRV_FAIL:
      digitalWrite(PIN_LED_A, LOW);
      digitalWrite(PIN_LED_B, HIGH);
      digitalWrite(PIN_LED_FLASH, (nowMs / 200) % 2);
      break;
  }
}

// ============================================================
// Debug heartbeat
// ============================================================

void printHeartbeat() {
  if (millis() - lastHeartbeatPrintMs < HEARTBEAT_PRINT_INTERVAL_MS) return;

  lastHeartbeatPrintMs = millis();

  struct tm t;
  bool ok = getLocalTimeSafe(&t);

  if (ok) {
    Serial.printf("[HB] %04d-%02d-%02d %02d:%02d:%02d, state=%s, WiFi=%s, RSSI=%d, DRV=%s, alarm=%02d:%02d, ver=%d\n",
                  t.tm_year + 1900, t.tm_mon + 1, t.tm_mday,
                  t.tm_hour, t.tm_min, t.tm_sec,
                  stateToString(stateNow).c_str(),
                  WiFi.status() == WL_CONNECTED ? "OK" : "OFF",
                  WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0,
                  drvOK ? "OK" : "FAIL",
                  alarmConfig.hour,
                  alarmConfig.minute,
                  alarmConfig.version);
  } else {
    unsigned long retryWaitMs = currentWifiRetryIntervalMs();
    unsigned long retryElapsedMs = millis() - lastWifiTryMs;
    unsigned long retryInSec = WiFi.status() == WL_CONNECTED || retryElapsedMs >= retryWaitMs
                                ? 0
                                : (retryWaitMs - retryElapsedMs) / 1000;

    Serial.printf("[HB] time invalid, state=%s, WiFi=%s, retryIn=%lus, DRV=%s\n",
                  stateToString(stateNow).c_str(),
                  WiFi.status() == WL_CONNECTED ? "OK" : (wifiRadioOffBetweenRetries ? "RADIO_OFF" : "OFF"),
                  retryInSec,
                  drvOK ? "OK" : "FAIL");
  }
}

// ============================================================
// Arduino setup / loop
// ============================================================

void setup() {
  Serial.begin(115200);
  delay(600);

  Serial.println();
  Serial.println("======================================================");
  Serial.println(" ESP32-C3 Super Mini Alarm - External API Version");
  Serial.println("======================================================");

  WiFi.onEvent(onWiFiEvent);

  pinMode(PIN_LED_A, OUTPUT);
  pinMode(PIN_LED_B, OUTPUT);
  pinMode(PIN_LED_FLASH, OUTPUT);

  if (TOUCH_ACTIVE_HIGH) {
    pinMode(PIN_TOUCH, INPUT_PULLDOWN);
  } else {
    pinMode(PIN_TOUCH, INPUT_PULLUP);
  }

  allLedOff();
  enterState(STATE_BOOT);

  loadConfigFromNVS();
  initDRV2605L();

  setupWiFi();

  if (WiFi.status() == WL_CONNECTED) {
    setupLocalApiServer();
    setupTimeNTP();
    if (CLOUD_SYNC_ENABLED) {
      syncConfigFromServer();
    }
  }

  lastSyncMs = millis();

  if (!timeOK) {
    enterState(STATE_TIME_INVALID);
  } else if (!drvOK) {
    enterState(STATE_DRV_FAIL);
  } else {
    enterState(STATE_IDLE);
  }
}

void loop() {
  maintainWiFi();
  maintainLocalApiServer();

  if (WiFi.status() == WL_CONNECTED) {
    setupLocalApiServer();
  }

  // 如果 Wi-Fi 原本斷線後又連上，補做 NTP
  if (WiFi.status() == WL_CONNECTED && !timeOK) {
    setupLocalApiServer();
    setupTimeNTP();
  }

  updateButton();
  updateAlarmEngine();
  updateLedPattern();

  if (WiFi.status() == WL_CONNECTED && CLOUD_SYNC_ENABLED && millis() - lastSyncMs >= SYNC_INTERVAL_MS) {
    lastSyncMs = millis();
    syncConfigFromServer();
  }

  printHeartbeat();

  delay(5);
}
