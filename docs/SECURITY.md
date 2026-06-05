# Security

This project is designed so private values stay out of GitHub.

## Do Not Commit

- WiFi SSID
- WiFi password
- `ALARM_LOCAL_API_TOKEN`
- `arduino_secrets.h`
- Cloudflare account tokens

## Where Secrets Go

Put private values only in:

```text
esp32c3_alarm_external_api_complete/arduino_secrets.h
```

This file is ignored by git.

## Local API Token

The MCU can protect local API calls with:

```cpp
#define ALARM_LOCAL_API_TOKEN "local-only-token"
```

When enabled, the browser sends:

```text
X-Local-Token: local-only-token
```

This protects against casual local-network access, but anyone who controls the same browser can see values they type into the page. For a school project or local prototype this is usually enough; for a product, use a stronger provisioning flow.

## No Backend

There is no server-side secret storage in this repo. Cloudflare Pages hosts static files only.
