# Codex MCU Done Notification Prompt

Use USB serial for done notifications. No MCU IP address is required.

## Environment Variables

Optional local settings:

```powershell
$env:MCU_NOTIFY_MODE="usb"
$env:MCU_NOTIFY_PORT=""
$env:MCU_NOTIFY_EFFECT="10"
```

Leave `MCU_NOTIFY_PORT` empty to auto-detect the MCU with `codex_ping`.

## Slash Prompt

Create:

```text
~/.codex/prompts/mcu-done.md
```

Content:

````markdown
When the coding task is complete and verification is finished, notify the ESP32-C3 MCU over USB by running:

```powershell
python scripts\notify_mcu.py --mode usb
```

If `python` is unavailable, try:

```powershell
py scripts\notify_mcu.py --mode usb
```

Only run this inside the `esp32c3-clock-web` workspace or another workspace that has `scripts/notify_mcu.py`.
If USB notification fails once, report the failure briefly and do not retry repeatedly.
````

## User-Level AGENTS.md

For automatic behavior, add:

````markdown
After successfully completing a coding task, and only after requested tests/checks/commit/push are done, run:

```powershell
python "C:\Users\user\Desktop\個人資料專案\電路拼圖\esp32c3-clock-web\scripts\notify_mcu.py" --mode usb --effect 10
```

Do not run the notifier for casual chat replies. If the USB notification fails once, summarize the failure and stop.
````
