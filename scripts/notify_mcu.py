import argparse
import hashlib
import hmac
import json
import os
import subprocess
from pathlib import Path
from urllib import error, request


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = REPO_ROOT / "public" / "devices" / "alarm_c3_001.json"


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


def build_signed_payload(config):
    return "|".join(
        [
            config["deviceId"],
            "1" if config["enabled"] else "0",
            str(config["hour"]),
            str(config["minute"]),
            str(config["repeatMask"]),
            str(config["prealertSec"]),
            str(config["snoozeMin"]),
            str(config["maxRingSec"]),
            str(config["hapticEffect"]),
            str(config["ledPairBrightness"]),
            str(config["flashLedBrightness"]),
            str(config["version"]),
            str(config["commandId"]),
            config["command"],
        ]
    )


def sign_config(config, secret):
    payload = build_signed_payload(config)
    signature = hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return payload, signature


def notify_http(url, token, effect):
    base_url = url.rstrip("/")
    endpoint = f"{base_url}/api/local/command"
    body = json.dumps({"command": "notify_done", "hapticEffect": effect}).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["X-Local-Token"] = token

    req = request.Request(endpoint, data=body, headers=headers, method="POST")
    with request.urlopen(req, timeout=8) as response:
        payload = response.read().decode("utf-8", errors="replace")
        print(f"MCU notified by HTTP: {endpoint} HTTP {response.status}")
        if payload:
            print(payload)


def serial_ports(preferred_port):
    if preferred_port:
        return [preferred_port]
    return [f"COM{index}" for index in range(1, 33)]


def notify_usb(port, effect):
    command = f"notify_done {effect}"
    ps_script = (
        "$ErrorActionPreference='Stop';"
        f"$p=New-Object System.IO.Ports.SerialPort('{port}',115200,'None',8,'One');"
        "$p.ReadTimeout=1000;"
        "$p.WriteTimeout=1000;"
        "$p.DtrEnable=$false;"
        "$p.RtsEnable=$false;"
        "$p.Open();"
        "Start-Sleep -Milliseconds 1200;"
        f"$p.WriteLine('{command}');"
        "Start-Sleep -Milliseconds 200;"
        "$p.Close();"
    )
    subprocess.run(
        ["powershell", "-NoProfile", "-Command", ps_script],
        check=True,
        capture_output=True,
        text=True,
        timeout=8,
    )
    print(f"MCU notified by USB serial: {port} -> {command}")


def notify_usb_auto(preferred_port, effect):
    failures = []
    for port in serial_ports(preferred_port):
        try:
            notify_usb(port, effect)
            return
        except Exception as exc:
            failures.append(f"{port}: {exc}")

    hint = "Close Arduino Serial Monitor/Plotter and check the selected COM port."
    raise SystemExit(f"USB notify failed. {hint}")


def queue_cloud_command(config_path, secret, effect):
    if not secret:
        raise SystemExit("Missing ALARM_CONFIG_HMAC_SECRET for cloud mode.")

    config = json.loads(config_path.read_text(encoding="utf-8"))
    config["hapticEffect"] = effect
    config["commandId"] = int(config.get("commandId", 0)) + 1
    config["command"] = "notify_done"
    payload, signature = sign_config(config, secret)
    config["signature"] = signature

    config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Queued signed cloud command in {config_path}")
    print(f"Payload: {payload}")
    print(f"Signature: {signature}")
    print("Deploy this JSON to the website; the MCU will run it on the next cloud sync.")


def main():
    load_local_env()

    parser = argparse.ArgumentParser(description="Notify the ESP32-C3 alarm device that coding is done.")
    parser.add_argument("--mode", choices=["auto", "http", "usb", "cloud"], default=os.environ.get("MCU_NOTIFY_MODE", "auto"))
    parser.add_argument("--url", default=os.environ.get("MCU_NOTIFY_URL", ""), help="MCU base URL, for example http://192.168.1.23")
    parser.add_argument("--token", default=os.environ.get("MCU_NOTIFY_TOKEN", ""), help="Optional ALARM_LOCAL_API_TOKEN")
    parser.add_argument("--port", default=os.environ.get("MCU_NOTIFY_PORT", ""), help="USB serial port, for example COM4")
    parser.add_argument("--effect", type=int, default=int(os.environ.get("MCU_NOTIFY_EFFECT", "10")), help="Haptic effect, 0-10")
    parser.add_argument("--config", default=os.environ.get("MCU_NOTIFY_CONFIG", str(DEFAULT_CONFIG_PATH)), help="Signed JSON config path for cloud mode")
    parser.add_argument("--secret", default=os.environ.get("ALARM_CONFIG_HMAC_SECRET", ""), help="HMAC secret for cloud mode")
    args = parser.parse_args()

    effect = clamp_effect(args.effect)

    if args.mode in {"auto", "http"} and args.url:
        try:
            notify_http(args.url, args.token, effect)
            return
        except error.HTTPError as exc:
            payload = exc.read().decode("utf-8", errors="replace")
            if args.mode == "http":
                raise SystemExit(f"MCU HTTP notify failed: HTTP {exc.code}\n{payload}") from exc
            print(f"HTTP notify failed, trying USB: HTTP {exc.code}")
        except error.URLError as exc:
            if args.mode == "http":
                raise SystemExit(f"MCU HTTP notify failed: {exc}") from exc
            print(f"HTTP notify failed, trying USB: {exc}")

    if args.mode in {"auto", "usb"}:
        notify_usb_auto(args.port, effect)
        return

    if args.mode == "cloud":
        queue_cloud_command(Path(args.config), args.secret, effect)
        return

    raise SystemExit("No notification method configured. Set MCU_NOTIFY_URL, MCU_NOTIFY_PORT, or use --mode cloud.")


if __name__ == "__main__":
    main()
