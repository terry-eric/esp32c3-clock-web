# Examples

## USB Done Notification

```powershell
python scripts\notify_mcu.py --mode usb
```

Force a port only when auto-detect cannot find the MCU:

```powershell
python scripts\notify_mcu.py --mode usb --port COM4
```

## USB Config

Raw serial line at `115200` baud:

```text
set_config {"enabled":true,"hour":7,"minute":30,"repeatMask":62,"prealertSec":10,"snoozeMin":5,"maxRingSec":10,"hapticEffect":10,"ledPairBrightness":4,"flashLedBrightness":10}
```

The MCU replies:

```text
usb_config_ok
```

## Legacy Signed JSON

The checked-in starter JSON uses this public demo signing secret:

```text
demo-only-change-me
```

It is intentionally not private. Use it only if you intentionally re-enable cloud sync for testing, then replace it and sign the JSON again.
