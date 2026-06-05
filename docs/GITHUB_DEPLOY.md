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

## Build Signer EXE

For Windows:

```powershell
py -m pip install pyinstaller
py -m PyInstaller --onefile --name esp32c3-config-signer scripts\sign_config.py
```

Run:

```powershell
.\dist\esp32c3-config-signer.exe --input public\devices\alarm_c3_001.json
```

Give the EXE to someone only if they are allowed to sign configs. Do not hard-code your real secret into the EXE.
