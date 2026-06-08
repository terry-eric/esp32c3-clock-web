# Codex MCU Status Prompt

Use USB serial for Codex status notifications. No MCU IP address is required.

## Environment Variables

Optional local settings:

```powershell
$env:MCU_NOTIFY_MODE="usb"
$env:MCU_NOTIFY_PORT=""
$env:MCU_NOTIFY_DEVICE_ID="alarm_c3_001"
$env:MCU_NOTIFY_EFFECT="10"
$env:MCU_NOTIFY_STATE="answer-done"
```

Leave `MCU_NOTIFY_PORT` empty to scan COM ports. The notifier only sends commands after `codex_ping` returns the expected `MCU_NOTIFY_DEVICE_ID`.

## Slash Prompt

Create:

```text
~/.codex/prompts/mcu-done.md
```

Content:

````markdown
After you receive a user message that you will answer in this workspace, notify the ESP32-C3 MCU over USB by running:

```powershell
python scripts\notify_mcu.py --mode usb --state message-sent
```

After your answer is complete, and after any requested checks, commits, or pushes are finished, notify the ESP32-C3 MCU over USB by running:

```powershell
python scripts\notify_mcu.py --mode usb --state answer-done
```

Only run this inside the `esp32c3-clock-web` workspace or another workspace that has `scripts/notify_mcu.py`.
If USB notification fails once, report the failure briefly and do not retry repeatedly.
````

## User-Level AGENTS.md

For automatic behavior, add this to the user-level `AGENTS.md`, adjusting the script path for the local machine:

````markdown
After receiving a user message that you will answer in this workspace, run:

```powershell
python "C:\path\to\esp32c3-clock-web\scripts\notify_mcu.py" --mode usb --state message-sent
```

After completing the answer, and only after requested tests/checks/commit/push are done, run:

```powershell
python "C:\path\to\esp32c3-clock-web\scripts\notify_mcu.py" --mode usb --state answer-done --effect 10
```

If the USB notification fails once, summarize the failure and stop.
````
