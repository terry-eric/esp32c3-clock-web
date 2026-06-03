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
  External website/API format
  ------------------------------------------------------------

  MCU will periodically call:

    GET http://YOUR_SERVER/api/device/config?device_id=alarm_c3_001

  Expected JSON response:

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
      "command": "none"
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
    "start_alarm"
    "stop_alarm"
    "snooze"

  If command is not "none", commandId should increase every time.
  MCU only executes a command once when commandId is new.

  MCU will periodically post status:

    POST http://YOUR_SERVER/api/device/status

  JSON body example:

    {
      "deviceId": "alarm_c3_001",
      "online": true,
      "state": "IDLE",
      "wifiOk": true,
      "wifiRssi": -56,
      "ip": "192.168.43.20",
      "timeOk": true,
      "time": "2026-06-03 15:03:23",
      "drvOk": true,
      "alarmEnabled": true,
      "alarmTime": "07:30",
      "repeatMask": 62,
      "lastAction": "STOPPED",
      "configVersion": 12,
      "lastCommandId": 0,
      "heap": 197812
    }
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_DRV2605.h>
#include <Preferences.h>
#include <time.h>

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

// 每一台裝置都要不同 ID。
// 例如第二台改成 alarm_c3_002，第三台改成 alarm_c3_003。
#ifndef ALARM_DEVICE_ID
#define ALARM_DEVICE_ID "alarm_c3_001"
#endif

const char* DEVICE_ID = ALARM_DEVICE_ID;

// 外部網站 API。
// 先用 http 比較好測試；如果你的網站是 https，也可以直接填 https://...
#ifndef ALARM_CONFIG_URL_BASE
#define ALARM_CONFIG_URL_BASE "https://esp32c3-clock-web.pages.dev/api/clock"
#endif

#ifndef ALARM_STATUS_URL
#define ALARM_STATUS_URL "https://esp32c3-clock-web.pages.dev/api/state"
#endif

const char* CONFIG_URL_BASE = ALARM_CONFIG_URL_BASE;
const char* STATUS_URL      = ALARM_STATUS_URL;

// 可選：如果網站需要簡單 token 驗證，就填入 token。
// 不需要就保持空字串。
#ifndef ALARM_API_TOKEN
#define ALARM_API_TOKEN ""
#endif

const char* API_TOKEN = ALARM_API_TOKEN;

// 如果使用 https 且沒有安裝憑證，設 true 會略過憑證驗證。
// 做專題測試可以先 true；正式產品不建議。
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

const unsigned long WIFI_CONNECT_TIMEOUT_MS       = 20000;
const unsigned long WIFI_RETRY_INTERVAL_MS        = 30000;
const unsigned long CONFIG_SYNC_INTERVAL_MS       = 30000;
const unsigned long STATUS_POST_INTERVAL_MS       = 30000;
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

unsigned long lastConfigSyncMs = 0;
unsigned long lastStatusPostMs = 0;
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

void startWiFiConnect() {
  Serial.println("[WiFi] Preparing connection...");

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);

  // 清掉舊狀態，避免 sta is connecting 重複錯誤
  WiFi.disconnect(false, false);
  delay(200);

  Serial.println("[WiFi] Scanning target SSID...");
  int n = WiFi.scanNetworks(false, true);

  bool found = false;
  int targetChannel = 0;

  if (n <= 0) {
    Serial.println("[WiFi] No network found");
  } else {
    for (int i = 0; i < n; i++) {
      String ssid = WiFi.SSID(i);
      int rssi = WiFi.RSSI(i);
      int ch = WiFi.channel(i);

      Serial.printf("  SSID=\"%s\" RSSI=%d CH=%d\n", ssid.c_str(), rssi, ch);

      if (ssid == WIFI_SSID) {
        found = true;
        targetChannel = ch;
      }
    }
  }

  Serial.print("[WiFi] Connecting to ");
  Serial.print(WIFI_SSID);

  if (found) {
    Serial.print(" on CH=");
    Serial.println(targetChannel);
    WiFi.begin(WIFI_SSID, WIFI_PASS, targetChannel);
  } else {
    Serial.println(" without scan match");
    Serial.println("[WiFi] Scan did not see target SSID. Trying direct connect anyway.");
    WiFi.begin(WIFI_SSID, WIFI_PASS);
  }

  wifiConnecting = true;
  wifiConnectStartMs = millis();
  lastWifiTryMs = millis();
}

void maintainWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnecting = false;
    return;
  }

  if (wifiConnecting) {
    if (millis() - wifiConnectStartMs < WIFI_CONNECT_TIMEOUT_MS) {
      return;
    }

    Serial.println("[WiFi] Connect timeout, disconnect first");
    WiFi.disconnect(false, false);
    wifiConnecting = false;
    lastWifiTryMs = millis();
    return;
  }

  if (millis() - lastWifiTryMs >= WIFI_RETRY_INTERVAL_MS) {
    lastWifiTryMs = millis();
    startWiFiConnect();
  }
}

bool waitWiFiConnected(unsigned long timeoutMs) {
  unsigned long startMs = millis();

  while (millis() - startMs < timeoutMs) {
    if (WiFi.status() == WL_CONNECTED) {
      wifiConnecting = false;

      Serial.println();
      Serial.println("[WiFi] Connected!");
      Serial.print("[WiFi] IP = ");
      Serial.println(WiFi.localIP());
      return true;
    }

    Serial.print(".");
    delay(400);
  }

  Serial.println();
  Serial.println("[WiFi] Initial connect failed");
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
  String url = String(CONFIG_URL_BASE);
  url += "?device_id=";
  url += DEVICE_ID;
  return url;
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

void forceStartAlarm() {
  lastAction = "MANUAL_START";
  enterState(STATE_RINGING);
  playHaptic(alarmConfig.hapticEffect);
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
  } else if (command == "start_alarm") {
    forceStartAlarm();
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

  // Optional: confirm deviceId if the server provides it.
  const char* returnedDeviceId = doc["deviceId"] | "";
  if (strlen(returnedDeviceId) > 0 && String(returnedDeviceId) != String(DEVICE_ID)) {
    Serial.println("[API] deviceId mismatch, ignored");
    return false;
  }

  int incomingVersion = doc["version"] | alarmConfig.version;

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

  // Command fields can be top-level.
  int commandId = doc["commandId"] | 0;
  const char* commandCstr = doc["command"] | "none";
  int commandEffect = doc["hapticEffect"] | alarmConfig.hapticEffect;

  executeCommand(commandId, String(commandCstr), commandEffect);

  return true;
}

// ============================================================
// Status POST to website
// ============================================================

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

  String body;
  serializeJson(doc, body);

  Serial.print("[API] POST status: ");
  Serial.println(body);

  int code = http.POST(body);
  http.end();

  Serial.printf("[API] Status POST code=%d\n", code);

  return code >= 200 && code < 300;
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
    forceStartAlarm();
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
    Serial.printf("[HB] time invalid, state=%s, WiFi=%s, DRV=%s\n",
                  stateToString(stateNow).c_str(),
                  WiFi.status() == WL_CONNECTED ? "OK" : "OFF",
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
    setupTimeNTP();
    syncConfigFromServer();
    postStatusToServer();
  }

  lastConfigSyncMs = millis();
  lastStatusPostMs = millis();

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

  // 如果 Wi-Fi 原本斷線後又連上，補做 NTP
  if (WiFi.status() == WL_CONNECTED && !timeOK) {
    setupTimeNTP();
  }

  updateButton();
  updateAlarmEngine();
  updateLedPattern();

  if (WiFi.status() == WL_CONNECTED && millis() - lastConfigSyncMs >= CONFIG_SYNC_INTERVAL_MS) {
    lastConfigSyncMs = millis();
    syncConfigFromServer();
  }

  if (WiFi.status() == WL_CONNECTED && millis() - lastStatusPostMs >= STATUS_POST_INTERVAL_MS) {
    lastStatusPostMs = millis();
    postStatusToServer();
  }

  printHeartbeat();

  delay(5);
}
