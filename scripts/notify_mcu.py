import argparse
import json
from urllib import error, request


def main():
    parser = argparse.ArgumentParser(description="Notify the ESP32-C3 alarm device that coding is done.")
    parser.add_argument("--url", required=True, help="MCU base URL, for example http://192.168.1.23")
    parser.add_argument("--token", default="", help="Optional ALARM_LOCAL_API_TOKEN")
    parser.add_argument("--effect", type=int, default=10, help="Haptic effect, 0-10")
    args = parser.parse_args()

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
