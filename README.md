# NHL Live Feed

Static React app for an OBS/Twitch-friendly NHL score overlay, with a settings page that generates a shareable browser-source URL.

## V1 scope

- `index.html`: settings page
- `overlay.html`: transparent overlay page
- default mode is schedule-driven auto selection
- optional team targeting in auto mode
- manual game override
- playoffs-only toggle
- show clock toggle
- Cloudflare Worker proxy for NHL schedule and score feeds

## Local development

1. Install dependencies:

```bash
npm install
```

2. Run the frontend:

```bash
npm run dev
```

The Vite dev server proxies `/api/*` to the live NHL API, so the settings page and overlay work locally without the Worker.

## Local frontend + Worker

To run the frontend against the local Cloudflare Worker instead of the direct NHL proxy:

```bash
npm run dev:all
```

This starts:

- Vite on `http://localhost:5173`
- Wrangler on `http://127.0.0.1:8787`

In this mode, Vite forwards `/api/*` to the local Worker so the app behaves much closer to production.

## Production setup

GitHub Pages can host the frontend build, but it cannot host the proxy. For production:

1. Deploy the Worker from `worker/`
2. Set `VITE_API_BASE_URL` to your Worker URL with the `/api` suffix
3. Build and deploy the frontend to GitHub Pages

Example:

```bash
VITE_API_BASE_URL=https://your-worker-subdomain.workers.dev/api npm run build
```

## Versioning

The settings page shows two version values when available:

- `vX.Y.Z` comes from `package.json` and is your release version
- `build N` comes from the GitHub Actions run number and increments automatically on each Pages deploy

Recommended workflow:

- use `npm run version:patch` for fixes and small polish
- use `npm run version:minor` for new user-facing features
- use `npm run version:major` only for breaking URL or config changes

Example:

```bash
npm run version:patch
git add package.json package-lock.json
git commit -m "Bump version to v0.1.1"
git push
```

## Worker routes

- `/api/schedule/now`
- `/api/score/now`

These proxy the NHL public web endpoints with short cache windows and permissive CORS for the GitHub Pages frontend.

## Optional Twitch gate

The Twitch follower gate is scaffolded behind feature flags and is off by default.

Frontend env:

```bash
VITE_ENABLE_TWITCH_GATE=false
VITE_TWITCH_AUTH_BASE=https://your-worker-subdomain.workers.dev
```

Worker vars:

```toml
TWITCH_GATE_ENABLED = "false"
TWITCH_ALLOWED_ORIGIN = "https://<your-user>.github.io"
TWITCH_BROADCASTER_ID = "<your-twitch-broadcaster-id>"
TWITCH_CLIENT_ID = "<twitch-client-id>"
TWITCH_CLIENT_SECRET = "<twitch-client-secret>"
TWITCH_REDIRECT_URI = "https://your-worker-subdomain.workers.dev/auth/twitch/callback"
TWITCH_SESSION_SECRET = "<long-random-secret>"
TWITCH_SUCCESS_REDIRECT_URL = "https://<your-user>.github.io/<repo>/"
```

When both flags are turned on, the settings page can unlock supporter-only options in the future. The current overlay always shows creator credit.
