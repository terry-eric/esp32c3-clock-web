# Cloudflare Pages Static Deployment

Cloudflare Pages hosts only static files:

- React helper UI
- `public/devices/*.json`

No Pages Functions, KV, database, or API secret is required.

## Build Settings

```text
Framework preset: None
Build command: npm run build
Build output directory: dist
```

## Secret Handling

Do not put the HMAC secret in Cloudflare Pages, GitHub, frontend JS, or JSON. Use it only on your computer when signing JSON and in MCU `arduino_secrets.h`.
