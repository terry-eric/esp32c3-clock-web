# GitHub Deploy Checklist

## Public Files

Safe to commit:

- React source in `src/`
- Firmware source `.ino`
- `arduino_secrets.example.h`
- Docs

Never commit:

- `esp32c3_alarm_external_api_complete/arduino_secrets.h`
- WiFi SSID/password
- Local API token
- Cloudflare account/deploy tokens

## Push

```bash
git add .
git commit -m "Update static no-backend mode"
git push origin main
```

## Cloudflare Pages

Cloudflare only builds the static frontend:

```text
Build command: npm run build
Build output directory: dist
```

No backend configuration is needed.
