# Codex MCU Done Notification Prompt

Use this with Codex global prompts or a user-level `AGENTS.md` instruction.

## Environment Variables

Set these on your own computer. Do not commit real values.

```powershell
$env:MCU_NOTIFY_URL="http://192.168.1.23"
$env:MCU_NOTIFY_TOKEN="<local-token-if-enabled>"
$env:MCU_NOTIFY_EFFECT="10"
```

## Slash Prompt

Create:

```text
~/.codex/prompts/mcu-done.md
```

Content:

````markdown
When the coding task is complete and verification is finished, notify the ESP32-C3 MCU by running:

```powershell
python scripts\notify_mcu.py
```

If `python` is unavailable, try:

```powershell
py scripts\notify_mcu.py
```

Only run this inside the `esp32c3-clock-web` workspace or another workspace that has `scripts/notify_mcu.py`.
If `MCU_NOTIFY_URL` is missing or the command fails, report the failure briefly and do not retry repeatedly.
````

Then call it in Codex with:

```text
/mcu-done
```

## User-Level AGENTS.md

For a more automatic behavior, add this to your user-level Codex instructions or `~/.codex/AGENTS.md`:

````markdown
After successfully completing a coding task in the ESP32-C3 alarm project, and only after tests/checks/commit/push requested by the user are done, run:

```powershell
python scripts\notify_mcu.py
```

Use environment variables `MCU_NOTIFY_URL`, `MCU_NOTIFY_TOKEN`, and `MCU_NOTIFY_EFFECT`.
Do not print the token. If the notify command fails once, summarize the failure and stop.
````

Important: this is a convenience instruction, not a security boundary. Keep the MCU token in your local environment only.
