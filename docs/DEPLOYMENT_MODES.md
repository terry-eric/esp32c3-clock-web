# Deployment Mode

This repo uses one mode: signed static config.

```mermaid
flowchart LR
  A["Static website"] --> B["Public signed JSON"]
  C["ESP32-C3"] --> B
  C --> D["Verify HMAC signature"]
  D --> E["Apply config"]
```

This gives you:

- no backend
- no MQTT broker
- no API key in the website
- protection against unauthorized changes

It does not hide the JSON contents. Anyone can read the alarm settings if the JSON URL is public.
