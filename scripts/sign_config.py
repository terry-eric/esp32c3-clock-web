import argparse
import getpass
import hmac
import hashlib
import json
import os
from pathlib import Path


SIGNED_FIELDS = [
    "deviceId",
    "enabled",
    "hour",
    "minute",
    "repeatMask",
    "prealertSec",
    "snoozeMin",
    "maxRingSec",
    "hapticEffect",
    "version",
]


def require_int(config, key):
    value = config.get(key)
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"{key} must be an integer")
    return str(value)


def require_zero_to_ten(config, key):
    value = config.get(key)
    if not isinstance(value, int) or isinstance(value, bool) or value < 0 or value > 10:
        raise ValueError(f"{key} must be an integer from 0 to 10")
    return str(value)


def build_payload(config):
    if not isinstance(config.get("deviceId"), str) or not config["deviceId"]:
        raise ValueError("deviceId must be a non-empty string")

    if not isinstance(config.get("enabled"), bool):
        raise ValueError("enabled must be a boolean")

    return "|".join(
        [
            config["deviceId"],
            "1" if config["enabled"] else "0",
            require_int(config, "hour"),
            require_int(config, "minute"),
            require_int(config, "repeatMask"),
            require_zero_to_ten(config, "prealertSec"),
            require_zero_to_ten(config, "snoozeMin"),
            require_zero_to_ten(config, "maxRingSec"),
            require_zero_to_ten(config, "hapticEffect"),
            require_zero_to_ten(config, "version"),
        ]
    )


def sign(payload, secret):
    return hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def main():
    parser = argparse.ArgumentParser(description="Sign ESP32-C3 alarm JSON config with HMAC-SHA256.")
    parser.add_argument(
        "-i",
        "--input",
        default="public/devices/alarm_c3_001.json",
        help="JSON config path",
    )
    parser.add_argument(
        "-s",
        "--secret",
        default=os.environ.get("ALARM_CONFIG_HMAC_SECRET", ""),
        help="Signing secret. Prefer ALARM_CONFIG_HMAC_SECRET or prompt input.",
    )
    args = parser.parse_args()

    secret = args.secret or getpass.getpass("Signing secret: ")
    if not secret:
        raise SystemExit("Missing signing secret")

    input_path = Path(args.input)
    config = json.loads(input_path.read_text(encoding="utf-8"))

    for key in SIGNED_FIELDS:
        if key not in config:
            raise ValueError(f"Missing signed field: {key}")

    payload = build_payload(config)
    signature = sign(payload, secret)
    config["signature"] = signature

    input_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Signed {input_path}")
    print(f"Payload: {payload}")
    print(f"Signature: {signature}")


if __name__ == "__main__":
    main()
