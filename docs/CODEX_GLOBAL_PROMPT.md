# Codex MCU Status Prompt

Use USB serial for Codex status notifications. No MCU IP address is required.

## Environment Variables

Optional local settings:

```powershell
$env:MCU_NOTIFY_MODE="usb"
$env:MCU_NOTIFY_PORT=""
$env:MCU_NOTIFY_EFFECT="10"
$env:MCU_NOTIFY_STATE="done"
```

Leave `MCU_NOTIFY_PORT` empty to auto-detect the MCU with `codex_ping`.

## Slash Prompt

Create:

```text
~/.codex/prompts/mcu-done.md
```

Content:

````markdown
When a concrete coding task starts, notify the ESP32-C3 MCU over USB by running:

```powershell
python scripts\notify_mcu.py --mode usb --state busy
```

When the coding task is complete and verification is finished, notify the ESP32-C3 MCU over USB by running:

```powershell
python scripts\notify_mcu.py --mode usb --state done
```

Only run this inside the `esp32c3-clock-web` workspace or another workspace that has `scripts/notify_mcu.py`.
Do not run the notifier for casual chat replies. If USB notification fails once, report the failure briefly and do not retry repeatedly.
````

## User-Level AGENTS.md

For automatic behavior, add this to the user-level `AGENTS.md`, adjusting the script path for the local machine:

````markdown
When starting a concrete coding task, run:

```powershell
python "C:\path\to\esp32c3-clock-web\scripts\notify_mcu.py" --mode usb --state busy
```

After successfully completing a coding task, and only after requested tests/checks/commit/push are done, run:

```powershell
python "C:\path\to\esp32c3-clock-web\scripts\notify_mcu.py" --mode usb --state done --effect 10
```

Do not run the notifier for casual chat replies. If the USB notification fails once, summarize the failure and stop.
````
