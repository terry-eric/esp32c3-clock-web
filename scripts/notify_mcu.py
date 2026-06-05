import argparse
import json
import os
from urllib import error, request


def main():
    parser = argparse.ArgumentParser(description="Notify the ESP32-C3 alarm device that coding is done.")
    parser.add_argument("--url", default=os.environ.get("MCU_NOTIFY_URL", ""), help="MCU base URL, for example http://192.168.1.23")
    parser.add_argument("--token", default=os.environ.get("MCU_NOTIFY_TOKEN", ""), help="Optional ALARM_LOCAL_API_TOKEN")
    parser.add_argument("--effect", type=int, default=int(os.environ.get("MCU_NOTIFY_EFFECT", "10")), help="Haptic effect, 0-10")
    args = parser.parse_args()

    if not args.url:
        raise SystemExit("Missing MCU URL. Pass --url or set MCU_NOTIFY_URL.")

    base_url = args.url.rstrip("/")
    endpoint = f"{base_url}/api/local/command"
    effect = min(10, max(0, args.effect))

    body = json.dumps({"command": "notify_done", "hapticEffect": effect}).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if args.token:
        headers["X-Local-Token"] = args.token

    req = request.Request(endpoint, data=body, headers=headers, method="POST")

    try:
        with request.urlopen(req, timeout=8) as response:
            payload = response.read().decode("utf-8", errors="replace")
            print(f"MCU notified: HTTP {response.status}")
            if payload:
                print(payload)
    except error.HTTPError as exc:
        payload = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"MCU notify failed: HTTP {exc.code}\n{payload}") from exc
    except error.URLError as exc:
        raise SystemExit(f"MCU notify failed: {exc}") from exc


if __name__ == "__main__":
    main()
