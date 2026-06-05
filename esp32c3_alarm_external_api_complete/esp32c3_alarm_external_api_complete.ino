/*
  ESP32-C3 Super Mini Alarm Device - USB Control Version

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
  USB serial control
  ------------------------------------------------------------

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

  USB serial commands at 115200:

    set_time 1780702200
    set_config {"enabled":true,"hour":7,"minute":30,...}
    usb_keepalive
    codex_busy
    codex_idle
    notify_done 10
    test_led
    test_haptic 10
*/

#include <WiFi.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_DRV2605.h>
#include <Preferences.h>
#include <sys/time.h>
#include <time.h>

#if __has_include("esp_arduino_version.h")
#include "esp_arduino_version.h"
#endif

#if __has_include("arduino_secrets.h")
#include "arduino_secrets.h"
#endif

// ============================================================
// User settings
// ============================================================

#ifndef ALARM_BOOT_STABILIZE_MS
#define ALARM_BOOT_STABILIZE_MS 1000UL
#endif

#ifndef ALARM_DEVICE_ID
#define ALARM_DEVICE_ID "alarm_c3_001"
#endif

#ifndef ALARM_DEVICE_NAME
#define ALARM_DEVICE_NAME "Codex Done Light"
#endif

const char* DEVICE_ID = ALARM_DEVICE_ID;
const char* DEVICE_NAME = ALARM_DEVICE_NAME;

// Pin settings
// ============================================================

#define PIN_I2C_SDA      8
#define PIN_I2C_SCL      9

#define PIN_LED_A        5
#define PIN_LED_B        6
#define PIN_LED_FLASH    7
#define PIN_TOUCH        3

#define LED_PWM_FREQ       5000
#define LED_PWM_RES_BITS   8
#define LED_A_PWM_CHANNEL  0
#define LED_B_PWM_CHANNEL  1
#define LED_F_PWM_CHANNEL  2

// 觸控模組如果「觸碰時輸出 HIGH」，設 true。
// 如果是一般按鈕「按下接 GND」，設 false。
const bool TOUCH_ACTIVE_HIGH = false;

// ============================================================
// Timing settings
// ============================================================

const unsigned long HEARTBEAT_PRINT_INTERVAL_MS   = 10000;
const unsigned long USB_TIME_SYNC_TIMEOUT_MS      = 65UL * 60UL * 1000UL;

const unsigned long BUTTON_DEBOUNCE_MS            = 35;
const unsigned long LONG_PRESS_MS                 = 2000;

const unsigned long HAPTIC_REPEAT_MS              = 900;
const unsigned long PREALARM_HAPTIC_INTERVAL_MS   = 15000;

// ============================================================
// Objects
// ============================================================

Adafruit_DRV2605 drv;
Preferences prefs;

// ============================================================
// Alarm data
// ============================================================

struct AlarmConfig {
  bool enabled = true;
  int hour = 7;
  int minute = 30;
  uint8_t repeatMask = 127;
  int prealertSec = 10;
  int snoozeMin = 5;
  int maxRingSec = 10;
  int hapticEffect = 10;
  int ledPairBrightness = 4;
  int flashLedBrightness = 10;
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


unsigned long lastHeartbeatPrintMs = 0;

unsigned long stateEnterMs = 0;
unsigned long lastHapticMs = 0;

int lastAlarmYday = -1;
time_t snoozeUntil = 0;

int lastCommandId = 0;
String lastAction = "BOOT";
unsigned long lastUsbSeenMs = 0;
unsigned long lastUsbTimeSyncMs = 0;
bool codexBusyLight = false;
bool codexDoneLight = false;

bool isAllowedLocalCommand(const String& command);

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

uint8_t brightnessToDuty(int value) {
  int clamped = constrain(value, 0, 10);
  return (uint8_t)map(clamped, 0, 10, 0, 255);
}

uint8_t flashBrightnessToDuty(int value) {
  static const uint8_t dutyByLevel[] = {0, 4, 8, 14, 24, 38, 58, 88, 130, 185, 255};
  int clamped = constrain(value, 0, 10);
  return dutyByLevel[clamped];
}

void writePwmPin(uint8_t pin, uint8_t channel, uint8_t duty) {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(pin, duty);
#else
  ledcWrite(channel, duty);
#endif
}

void setupLedPwm() {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(PIN_LED_A, LED_PWM_FREQ, LED_PWM_RES_BITS);
  ledcAttach(PIN_LED_B, LED_PWM_FREQ, LED_PWM_RES_BITS);
  ledcAttach(PIN_LED_FLASH, LED_PWM_FREQ, LED_PWM_RES_BITS);
#else
  ledcSetup(LED_A_PWM_CHANNEL, LED_PWM_FREQ, LED_PWM_RES_BITS);
  ledcSetup(LED_B_PWM_CHANNEL, LED_PWM_FREQ, LED_PWM_RES_BITS);
  ledcSetup(LED_F_PWM_CHANNEL, LED_PWM_FREQ, LED_PWM_RES_BITS);
  ledcAttachPin(PIN_LED_A, LED_A_PWM_CHANNEL);
  ledcAttachPin(PIN_LED_B, LED_B_PWM_CHANNEL);
  ledcAttachPin(PIN_LED_FLASH, LED_F_PWM_CHANNEL);
#endif
}

void writeLedA(bool on) {
  writePwmPin(PIN_LED_A, LED_A_PWM_CHANNEL, on ? brightnessToDuty(alarmConfig.ledPairBrightness) : 0);
}

void writeLedB(bool on) {
  writePwmPin(PIN_LED_B, LED_B_PWM_CHANNEL, on ? brightnessToDuty(alarmConfig.ledPairBrightness) : 0);
}

void writeLedFlash(bool on) {
  writePwmPin(PIN_LED_FLASH, LED_F_PWM_CHANNEL, on ? flashBrightnessToDuty(alarmConfig.flashLedBrightness) : 0);
}

void writeStatusGreen(bool on) {
  writeLedA(on);
}

void writeStatusRed(bool on) {
  writeLedB(on);
}

void allLedOff() {
  writeLedA(false);
  writeLedB(false);
  writeLedFlash(false);
}

bool usbTimeRecentlySynced() {
  return timeOK && lastUsbTimeSyncMs > 0 && millis() - lastUsbTimeSyncMs <= USB_TIME_SYNC_TIMEOUT_MS;
}

void previewLedBrightness() {
  writeLedA(true);
  writeLedB(true);
  writeLedFlash(true);
  delay(220);
  allLedOff();
}

void playHaptic(uint8_t effect) {
  if (!drvOK) return;
  if (effect == 0) return;

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
  prefs.putInt("ledPair", alarmConfig.ledPairBrightness);
  prefs.putInt("ledFlash", alarmConfig.flashLedBrightness);
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
  alarmConfig.prealertSec = prefs.getInt("prealertSec", 10);
  alarmConfig.snoozeMin = prefs.getInt("snoozeMin", 5);
  alarmConfig.maxRingSec = prefs.getInt("maxRingSec", 10);
  alarmConfig.hapticEffect = prefs.getInt("effect", 10);
  alarmConfig.ledPairBrightness = prefs.getInt("ledPair", 4);
  alarmConfig.flashLedBrightness = prefs.getInt("ledFlash", 10);
  alarmConfig.version = prefs.getInt("version", 0);
  lastCommandId = prefs.getInt("lastCmd", 0);
  prefs.end();

  Serial.println("[NVS] Alarm config loaded");
  Serial.printf("      enabled=%d time=%02d:%02d repeatMask=%u prealert=%d snooze=%d maxRing=%d effect=%d ledPair=%d ledFlash=%d version=%d lastCmd=%d\n",
                alarmConfig.enabled,
                alarmConfig.hour,
                alarmConfig.minute,
                alarmConfig.repeatMask,
                alarmConfig.prealertSec,
                alarmConfig.snoozeMin,
                alarmConfig.maxRingSec,
                alarmConfig.hapticEffect,
                alarmConfig.ledPairBrightness,
                alarmConfig.flashLedBrightness,
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

void setupLocalTimezone() {
  setenv("TZ", "CST-8", 1);
  tzset();
}

bool setTimeFromEpoch(time_t epochSeconds) {
  if (epochSeconds < 1704067200) {
    return false;
  }

  timeval now;
  now.tv_sec = epochSeconds;
  now.tv_usec = 0;

  if (settimeofday(&now, nullptr) != 0) {
    return false;
  }

  setupLocalTimezone();
  timeOK = true;
  lastUsbTimeSyncMs = millis();

  if (stateNow == STATE_TIME_INVALID || stateNow == STATE_BOOT) {
    enterState(drvOK ? STATE_IDLE : STATE_DRV_FAIL);
  }

  struct tm t;
  if (getLocalTimeSafe(&t)) {
    Serial.printf("[USB] Time set: %04d-%02d-%02d %02d:%02d:%02d\n",
                  t.tm_year + 1900, t.tm_mon + 1, t.tm_mday,
                  t.tm_hour, t.tm_min, t.tm_sec);
  }

  return true;
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
// USB commands
// ============================================================

// Commands from website
// ============================================================

void runLedTest() {
  Serial.println("[CMD] test_led");
  lastAction = "TEST_LED";

  for (int i = 0; i < 3; i++) {
    writeLedA(true);
    writeLedB(false);
    writeLedFlash(true);
    delay(150);

    writeLedA(false);
    writeLedB(true);
    writeLedFlash(false);
    delay(150);
  }

  allLedOff();
}

void runDoneNotification(int effectFromCommand) {
  Serial.println("[CMD] notify_done");
  lastAction = "VIBE_CODE_DONE";
  codexBusyLight = false;
  codexDoneLight = true;

  int effect = effectFromCommand > 0 ? effectFromCommand : alarmConfig.hapticEffect;

  for (int i = 0; i < 3; i++) {
    writeLedA(true);
    writeLedB(true);
    writeLedFlash(true);
    playHaptic((uint8_t)effect);
    delay(180);

    allLedOff();
    delay(140);
  }
}

void setCodexBusyLight() {
  Serial.println("[CMD] codex_busy");
  lastAction = "CODEX_BUSY";
  codexBusyLight = true;
  codexDoneLight = false;
}

void clearCodexLight() {
  Serial.println("[CMD] codex_idle");
  lastAction = "CODEX_IDLE";
  codexBusyLight = false;
  codexDoneLight = false;
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
  } else if (command == "notify_done") {
    runDoneNotification(effectFromCommand);
  } else if (command == "codex_busy") {
    setCodexBusyLight();
  } else if (command == "codex_idle") {
    clearCodexLight();
  } else if (command == "stop_alarm") {
    stopAlarm();
  } else if (command == "snooze") {
    snoozeAlarm();
  } else {
    Serial.println("[CMD] Unknown command");
  }
}

// ============================================================
// Config apply helpers
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

  bool previousEnabled = alarmConfig.enabled;
  int previousHour = alarmConfig.hour;
  int previousMinute = alarmConfig.minute;
  uint8_t previousRepeatMask = alarmConfig.repeatMask;
  int previousPrealertSec = alarmConfig.prealertSec;
  int previousSnoozeMin = alarmConfig.snoozeMin;
  int previousMaxRingSec = alarmConfig.maxRingSec;
  int previousHapticEffect = alarmConfig.hapticEffect;
  int previousLedPairBrightness = alarmConfig.ledPairBrightness;
  int previousFlashLedBrightness = alarmConfig.flashLedBrightness;
  int previousVersion = alarmConfig.version;

  alarmConfig.enabled = doc["enabled"] | alarmConfig.enabled;
  alarmConfig.hour = doc["hour"] | alarmConfig.hour;
  alarmConfig.minute = doc["minute"] | alarmConfig.minute;
  alarmConfig.repeatMask = doc["repeatMask"] | alarmConfig.repeatMask;
  alarmConfig.prealertSec = doc["prealertSec"] | alarmConfig.prealertSec;
  alarmConfig.snoozeMin = doc["snoozeMin"] | alarmConfig.snoozeMin;
  alarmConfig.maxRingSec = doc["maxRingSec"] | alarmConfig.maxRingSec;
  alarmConfig.hapticEffect = doc["hapticEffect"] | alarmConfig.hapticEffect;
  alarmConfig.ledPairBrightness = doc["ledPairBrightness"] | alarmConfig.ledPairBrightness;
  alarmConfig.flashLedBrightness = doc["flashLedBrightness"] | alarmConfig.flashLedBrightness;
  alarmConfig.version = incomingVersion;

  alarmConfig.hour = constrain(alarmConfig.hour, 0, 23);
  alarmConfig.minute = constrain(alarmConfig.minute, 0, 59);
  alarmConfig.repeatMask = constrain(alarmConfig.repeatMask, 0, 127);
  alarmConfig.prealertSec = constrain(alarmConfig.prealertSec, 0, 10);
  alarmConfig.snoozeMin = constrain(alarmConfig.snoozeMin, 0, 10);
  alarmConfig.maxRingSec = constrain(alarmConfig.maxRingSec, 0, 10);
  alarmConfig.hapticEffect = constrain(alarmConfig.hapticEffect, 0, 10);
  alarmConfig.ledPairBrightness = constrain(alarmConfig.ledPairBrightness, 0, 10);
  alarmConfig.flashLedBrightness = constrain(alarmConfig.flashLedBrightness, 0, 10);

  bool configChanged =
    previousEnabled != alarmConfig.enabled ||
    previousHour != alarmConfig.hour ||
    previousMinute != alarmConfig.minute ||
    previousRepeatMask != alarmConfig.repeatMask ||
    previousPrealertSec != alarmConfig.prealertSec ||
    previousSnoozeMin != alarmConfig.snoozeMin ||
    previousMaxRingSec != alarmConfig.maxRingSec ||
    previousHapticEffect != alarmConfig.hapticEffect ||
    previousLedPairBrightness != alarmConfig.ledPairBrightness ||
    previousFlashLedBrightness != alarmConfig.flashLedBrightness ||
    previousVersion != alarmConfig.version;

  bool brightnessChanged =
    previousLedPairBrightness != alarmConfig.ledPairBrightness ||
    previousFlashLedBrightness != alarmConfig.flashLedBrightness;

  if (configChanged) {
    saveConfigToNVS();
    Serial.println("[NVS] Config changed, saved");
  } else {
    Serial.println("[NVS] Config unchanged, skipped save");
  }

  Serial.printf("[API] Config updated: enabled=%d time=%02d:%02d repeatMask=%u prealert=%d snooze=%d maxRing=%d effect=%d ledPair=%d ledFlash=%d version=%d\n",
                alarmConfig.enabled,
                alarmConfig.hour,
                alarmConfig.minute,
                alarmConfig.repeatMask,
                alarmConfig.prealertSec,
                alarmConfig.snoozeMin,
                alarmConfig.maxRingSec,
                alarmConfig.hapticEffect,
                alarmConfig.ledPairBrightness,
                alarmConfig.flashLedBrightness,
                alarmConfig.version);

  if (brightnessChanged) {
    previewLedBrightness();
  }

  return true;
}

void handleUsbCommandLine(String line) {
  line.trim();
  if (line.length() == 0) {
    return;
  }
  lastUsbSeenMs = millis();

  String command = line;
  int effect = alarmConfig.hapticEffect;
  int separatorIndex = line.indexOf(' ');

  if (separatorIndex > 0) {
    command = line.substring(0, separatorIndex);
    String effectText = line.substring(separatorIndex + 1);
    effectText.trim();
    if (effectText.length() > 0) {
      effect = constrain(effectText.toInt(), 0, 10);
    }
  }

  command.trim();
  if (command == "codex_ping") {
    Serial.print("codex_pong ");
    Serial.print(DEVICE_ID);
    Serial.print(" ");
    Serial.println(DEVICE_NAME);
    return;
  }

  if (command == "usb_keepalive") {
    return;
  }

  if (command == "set_time") {
    String epochText = separatorIndex > 0 ? line.substring(separatorIndex + 1) : "";
    epochText.trim();
    time_t epochSeconds = (time_t)epochText.toInt();

    if (setTimeFromEpoch(epochSeconds)) {
      Serial.println("usb_time_ok");
    } else {
      Serial.println("usb_time_rejected");
    }
    return;
  }

  if (command == "set_config") {
    String jsonText = separatorIndex > 0 ? line.substring(separatorIndex + 1) : "";
    jsonText.trim();

    StaticJsonDocument<768> doc;
    DeserializationError err = deserializeJson(doc, jsonText);
    if (err) {
      Serial.print("[USB] Config JSON parse error: ");
      Serial.println(err.c_str());
      return;
    }

    doc["deviceId"] = DEVICE_ID;
    doc["version"] = alarmConfig.version + 1;

    if (applyConfigFromJson(doc.as<JsonVariantConst>())) {
      Serial.println("usb_config_ok");
    } else {
      Serial.println("usb_config_rejected");
    }
    return;
  }

  if (!isAllowedLocalCommand(command)) {
    Serial.print("[USB] Unsupported command: ");
    Serial.println(command);
    return;
  }

  Serial.print("[USB] Command: ");
  Serial.println(command);
  executeCommand(lastCommandId + 1, command, effect);
}

void maintainUsbCommands() {
  if (!Serial.available()) {
    return;
  }

  String line = Serial.readStringUntil('\n');
  handleUsbCommandLine(line);
}

bool isAllowedLocalCommand(const String& command) {
  return command == "none" ||
         command == "test_led" ||
         command == "test_haptic" ||
         command == "notify_done" ||
         command == "codex_busy" ||
         command == "codex_idle" ||
         command == "stop_alarm" ||
         command == "snooze";
}

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
      playHaptic((uint8_t)alarmConfig.hapticEffect);
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
  Serial.println("[BTN] Long press ignored");
  playHaptic(1);
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

  if (!usbTimeRecentlySynced()) {
    writeStatusGreen(false);
    writeStatusRed((nowMs / 500) % 2);
    writeLedFlash(false);
    return;
  }

  if (stateNow == STATE_IDLE || stateNow == STATE_TIME_INVALID || stateNow == STATE_BOOT || stateNow == STATE_STOPPED) {
    if (codexBusyLight) {
      writeStatusGreen(false);
      writeStatusRed(true);
      writeLedFlash(false);
      return;
    }

    if (codexDoneLight) {
      writeStatusGreen(true);
      writeStatusRed(false);
      writeLedFlash(false);
      return;
    }
  }

  switch (stateNow) {
    case STATE_BOOT:
      writeLedA((nowMs / 200) % 2);
      writeLedB(false);
      writeLedFlash(false);
      break;

    case STATE_TIME_INVALID:
      writeLedA(false);
      writeLedB((nowMs / 1000) % 2);
      writeLedFlash(false);
      break;

    case STATE_IDLE:
      // slow heartbeat
      writeLedA((nowMs % 10000) < 80);
      writeLedB(false);
      writeLedFlash(false);
      break;

    case STATE_PREALARM:
      writeLedA((nowMs / 500) % 2);
      writeLedB(false);
      writeLedFlash((nowMs % 5000) < 120);
      break;

    case STATE_RINGING:
      writeLedA(true);
      writeLedB((nowMs / 250) % 2);
      writeLedFlash((nowMs / 125) % 2);
      break;

    case STATE_SNOOZE: {
      unsigned long p = nowMs % 10000;
      bool doubleBlink = (p < 100) || (p > 250 && p < 350);
      writeLedA(doubleBlink);
      writeLedB(false);
      writeLedFlash(false);
      break;
    }

    case STATE_STOPPED:
      writeLedA((nowMs - stateEnterMs) < 1000);
      writeLedB((nowMs - stateEnterMs) < 1000);
      writeLedFlash(false);

      if (nowMs - stateEnterMs > 1200) {
        enterState(STATE_IDLE);
      }
      break;

    case STATE_DRV_FAIL:
      writeLedA(false);
      writeLedB(true);
      writeLedFlash((nowMs / 200) % 2);
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
    Serial.printf("[HB] %04d-%02d-%02d %02d:%02d:%02d, state=%s, USB=time, DRV=%s, alarm=%02d:%02d, ver=%d\n",
                  t.tm_year + 1900, t.tm_mon + 1, t.tm_mday,
                  t.tm_hour, t.tm_min, t.tm_sec,
                  stateToString(stateNow).c_str(),
                  drvOK ? "OK" : "FAIL",
                  alarmConfig.hour,
                  alarmConfig.minute,
                  alarmConfig.version);
  } else {
    Serial.printf("[HB] time invalid, state=%s, USB time sync needed, DRV=%s\n",
                  stateToString(stateNow).c_str(),
                  drvOK ? "OK" : "FAIL");
  }
}

// ============================================================
// Arduino setup / loop
// ============================================================

void setup() {
  Serial.begin(115200);
  delay(600);
  if (ALARM_BOOT_STABILIZE_MS > 0) {
    Serial.print("[BOOT] Stabilize power = ");
    Serial.print(ALARM_BOOT_STABILIZE_MS);
    Serial.println(" ms");
    delay(ALARM_BOOT_STABILIZE_MS);
  }

  Serial.println();
  Serial.println("======================================================");
  Serial.println(" ESP32-C3 Super Mini Alarm - USB Control Version");
  Serial.print(" Device: ");
  Serial.println(DEVICE_NAME);
  Serial.println("======================================================");

  setupLocalTimezone();
  WiFi.mode(WIFI_OFF);
  Serial.println("[WiFi] Disabled; USB control only");

  pinMode(PIN_LED_A, OUTPUT);
  pinMode(PIN_LED_B, OUTPUT);
  pinMode(PIN_LED_FLASH, OUTPUT);
  setupLedPwm();

  if (TOUCH_ACTIVE_HIGH) {
    pinMode(PIN_TOUCH, INPUT_PULLDOWN);
  } else {
    pinMode(PIN_TOUCH, INPUT_PULLUP);
  }

  allLedOff();
  enterState(STATE_BOOT);

  loadConfigFromNVS();
  initDRV2605L();

  if (!timeOK) {
    enterState(STATE_TIME_INVALID);
  } else if (!drvOK) {
    enterState(STATE_DRV_FAIL);
  } else {
    enterState(STATE_IDLE);
  }
}

void loop() {
  maintainUsbCommands();

  updateButton();
  updateAlarmEngine();
  updateLedPattern();

  printHeartbeat();

  delay(5);
}
