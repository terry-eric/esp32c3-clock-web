# Security

The JSON file is public. Security comes from signature verification, not secrecy of the JSON.

Public:

- JSON config
- `signature`
- Device ID

Private:

- WiFi SSID/password
- `ALARM_CONFIG_HMAC_SECRET`
- `arduino_secrets.h`

If someone edits the public JSON without the secret, the MCU recalculates HMAC-SHA256 and rejects it.

Never put `ALARM_CONFIG_HMAC_SECRET` in:

- `src/`
- `public/`
- GitHub docs
- Cloudflare Pages variables
- browser localStorage

Use a long random secret. Keep the same value in:

- your local shell environment when running `npm run sign:config`
- `esp32c3_alarm_external_api_complete/arduino_secrets.h`

If you package the signer as an EXE, do not compile your real secret into the program. The EXE should ask the user to type the secret or read it from that user's environment variable.
