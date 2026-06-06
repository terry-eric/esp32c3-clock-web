import argparse
import os
import subprocess
import time
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


def load_local_env():
    env_path = REPO_ROOT / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue

        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def clamp_effect(value):
    return min(10, max(0, int(value)))


def env_bool(name, default):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def ping_matcher(device_id):
    device_id = (device_id or "").strip()
    return f"codex_pong {device_id}" if device_id else "codex_pong"


def serial_ports(preferred_port):
    if preferred_port:
        return [preferred_port]
    return [f"COM{index}" for index in range(1, 33)]


def ps_quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def run_serial_command(port, command, read_reply=False, matcher="codex_pong", timeout_ms=1800):
    read_block = ""
    if read_reply:
        read_block = (
            f"$deadline=(Get-Date).AddMilliseconds({timeout_ms});"
            "$reply='';"
            f"while((Get-Date) -lt $deadline -and -not $reply.Contains('{matcher}')){{"
            "try{$reply += $p.ReadExisting()}catch{};"
            "Start-Sleep -Milliseconds 80;"
            "};"
            "Write-Output $reply;"
        )

    ps_script = (
        "$ErrorActionPreference='Stop';"
        f"$p=New-Object System.IO.Ports.SerialPort('{port}',115200,'None',8,'One');"
        "$p.ReadTimeout=250;"
        "$p.WriteTimeout=1000;"
        "$p.DtrEnable=$false;"
        "$p.RtsEnable=$false;"
        "$p.Open();"
        "Start-Sleep -Milliseconds 600;"
        f"$p.WriteLine('{command}');"
        f"{read_block}"
        "Start-Sleep -Milliseconds 150;"
        "$p.Close();"
    )
    return subprocess.run(
        ["powershell", "-NoProfile", "-Command", ps_script],
        check=True,
        capture_output=True,
        text=True,
        timeout=max(8, int(timeout_ms / 1000) + 3),
    )


def run_serial_sequence(port, steps):
    step_blocks = []
    total_timeout_ms = 0

    for command, matcher, timeout_ms in steps:
        total_timeout_ms += timeout_ms
        step_blocks.append(
            "$p.DiscardInBuffer();"
            f"$p.WriteLine({ps_quote(command)});"
            f"$deadline=(Get-Date).AddMilliseconds({timeout_ms});"
            "$reply='';"
            f"while((Get-Date) -lt $deadline -and -not $reply.Contains({ps_quote(matcher)})){{"
            "try{$reply += $p.ReadExisting()}catch{};"
            "Start-Sleep -Milliseconds 80;"
            "};"
            f"if(-not $reply.Contains({ps_quote(matcher)})){{"
            f"throw ('No {matcher} reply after {command}: ' + $reply)"
            "};"
            "Write-Output $reply;"
        )

    ps_script = (
        "$ErrorActionPreference='Stop';"
        f"$p=New-Object System.IO.Ports.SerialPort({ps_quote(port)},115200,'None',8,'One');"
        "$p.ReadTimeout=250;"
        "$p.WriteTimeout=1000;"
        "$p.DtrEnable=$false;"
        "$p.RtsEnable=$false;"
        "$p.Open();"
        "try{"
        "Start-Sleep -Milliseconds 700;"
        + "".join(step_blocks) +
        "}finally{"
        "Start-Sleep -Milliseconds 150;"
        "$p.Close();"
        "}"
    )

    return subprocess.run(
        ["powershell", "-NoProfile", "-Command", ps_script],
        check=True,
        capture_output=True,
        text=True,
        timeout=max(8, int(total_timeout_ms / 1000) + 6),
    )


def probe_usb(port):
    result = run_serial_command(port, "codex_ping", read_reply=True, matcher="codex_pong")
    reply = (result.stdout or "").strip()
    if "codex_pong" not in reply:
        return ""
    return " ".join(reply.split())


def sync_usb_time(port):
    epoch_seconds = int(time.time())
    result = run_serial_command(
        port,
        f"set_time {epoch_seconds}",
        read_reply=True,
        matcher="usb_time_",
        timeout_ms=2500,
    )
    reply = " ".join((result.stdout or "").split())
    if "usb_time_ok" not in reply:
        raise RuntimeError(f"time sync rejected or timed out: {reply or 'no reply'}")
    print(f"MCU time synced by USB serial: {port} -> set_time {epoch_seconds}")
    return reply


def notify_usb(port, state, effect):
    commands = {
        "busy": "codex_busy",
        "done": f"notify_done {effect}",
        "idle": "codex_idle",
        "keepalive": "usb_keepalive",
    }
    command = commands[state]
    matcher = "usb_keepalive_ok" if state == "keepalive" else "usb_command_ok"
    timeout_ms = 10000 if state == "done" else 2500
    result = run_serial_command(
        port,
        command,
        read_reply=True,
        matcher=matcher,
        timeout_ms=timeout_ms,
    )
    reply = " ".join((result.stdout or "").split())
    if matcher not in reply:
        raise RuntimeError(f"notification was not acknowledged: {reply or 'no reply'}")
    print(f"MCU notified by USB serial: {port} -> {command} ({reply})")


def notify_usb_session(port, state, effect, sync_time_before_notify, device_id):
    commands = {
        "busy": "codex_busy",
        "done": f"notify_done {effect}",
        "idle": "codex_idle",
        "keepalive": "usb_keepalive",
    }
    command = commands[state]
    matcher = "usb_keepalive_ok" if state == "keepalive" else "usb_command_ok"
    timeout_ms = 10000 if state == "done" else 2500
    steps = [("codex_ping", ping_matcher(device_id), 1800)]

    if sync_time_before_notify and state in {"busy", "done"}:
        steps.append((f"set_time {int(time.time())}", "usb_time_ok", 2500))

    steps.append((command, matcher, timeout_ms))
    result = run_serial_sequence(port, steps)
    reply = " ".join((result.stdout or "").split())
    print(f"Found MCU on {port}: {reply}")
    print(f"MCU notified by USB serial: {port} -> {command}")


def find_mcu_port(preferred_port):
    failures = []
    if preferred_port:
        reply = probe_usb(preferred_port)
        if not reply:
            raise SystemExit(f"USB notify failed: {preferred_port} did not reply to codex_ping.")
        return preferred_port, reply

    for port in serial_ports(preferred_port):
        try:
            reply = probe_usb(port)
            if not reply:
                continue
            return port, reply
        except Exception as exc:
            failures.append(f"{port}: {exc}")

    hint = "Close Arduino Serial Monitor/Plotter, plug in the MCU, or pass --port COMx."
    raise SystemExit(f"USB notify failed: no Codex MCU replied to codex_ping. {hint}")


def notify_usb_auto(preferred_port, state, effect, sync_time_before_notify, device_id):
    failures = []
    for port in serial_ports(preferred_port):
        try:
            notify_usb_session(port, state, effect, sync_time_before_notify, device_id)
            return
        except Exception as exc:
            failures.append(f"{port}: {exc}")
            if preferred_port:
                break

    hint = "Close Arduino Serial Monitor/Plotter, plug in the MCU, or pass --port COMx."
    raise SystemExit(f"USB notify failed: no Codex MCU accepted the notification. {hint}")


def sync_usb_time_auto(preferred_port, device_id):
    failures = []
    for port in serial_ports(preferred_port):
        try:
            result = run_serial_sequence(
                port,
                [
                    ("codex_ping", ping_matcher(device_id), 1800),
                    (f"set_time {int(time.time())}", "usb_time_ok", 2500),
                ],
            )
            reply = " ".join((result.stdout or "").split())
            print(f"MCU time synced by USB serial: {port} ({reply})")
            return
        except Exception as exc:
            failures.append(f"{port}: {exc}")
            if preferred_port:
                break

    hint = "Close Arduino Serial Monitor/Plotter, plug in the MCU, or pass --port COMx."
    raise SystemExit(f"USB time sync failed: no Codex MCU accepted set_time. {hint}")


def main():
    load_local_env()

    parser = argparse.ArgumentParser(description="Notify the ESP32-C3 alarm device about Codex status.")
    parser.add_argument("--mode", choices=["usb"], default=os.environ.get("MCU_NOTIFY_MODE", "usb"))
    parser.add_argument("--port", default=os.environ.get("MCU_NOTIFY_PORT", ""), help="USB serial port, for example COM4")
    parser.add_argument("--device-id", default=os.environ.get("MCU_NOTIFY_DEVICE_ID", "alarm_c3_001"), help="Expected MCU device id from codex_pong")
    parser.add_argument("--state", choices=["busy", "done", "idle", "keepalive", "sync-time"], default=os.environ.get("MCU_NOTIFY_STATE", "done"))
    parser.add_argument("--effect", type=int, default=int(os.environ.get("MCU_NOTIFY_EFFECT", "10")), help="Haptic effect, 0-10")
    parser.add_argument("--no-sync-time", action="store_false", dest="sync_time", default=env_bool("MCU_SYNC_TIME_BEFORE_NOTIFY", True), help="Skip set_time before busy/done notification")
    args = parser.parse_args()

    effect = clamp_effect(args.effect)
    if args.state == "sync-time":
        sync_usb_time_auto(args.port, args.device_id)
        return

    notify_usb_auto(args.port, args.state, effect, args.sync_time, args.device_id)


if __name__ == "__main__":
    main()
