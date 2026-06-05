# GitHub Deploy Checklist

Safe to commit:

- `src/`
- `public/devices/*.json`
- `scripts/sign-config.mjs`
- firmware source
- docs
- `arduino_secrets.example.h`

Never commit:

- `arduino_secrets.h`
- WiFi password
- `ALARM_CONFIG_HMAC_SECRET`

Before pushing, sign JSON locally:

```powershell
$env:ALARM_CONFIG_HMAC_SECRET="your-private-signing-secret"
npm run sign:config
git add public/devices/alarm_c3_001.json
git commit -m "Update signed alarm config"
git push origin main
```
