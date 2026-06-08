# ESP32-C3 Alarm Project Instructions

After receiving any user message that you will answer in this project, including casual conversation, notify the ESP32-C3 MCU by running:

```powershell
python scripts\notify_mcu.py --state message-sent
```

If `python` is unavailable, try:

```powershell
py scripts\notify_mcu.py --state message-sent
```

After successfully completing the answer, and only after requested checks, commits, or pushes are finished, notify the ESP32-C3 MCU by running:

```powershell
python scripts\notify_mcu.py --state answer-done
```

If `python` is unavailable, try:

```powershell
py scripts\notify_mcu.py --state answer-done
```

The notifier uses auto-detected USB serial. Use only these local environment variables:

- `MCU_NOTIFY_MODE`
- `MCU_NOTIFY_PORT`
- `MCU_NOTIFY_DEVICE_ID`
- `MCU_NOTIFY_EFFECT`

Do not print the token. Do not commit real MCU URLs, Wi-Fi details, signing secrets, or local API tokens. If the notification command fails once, summarize the failure and stop.
