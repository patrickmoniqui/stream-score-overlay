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

## Worker routes

- `/api/schedule/now`
- `/api/score/now`

These proxy the NHL public web endpoints with short cache windows and permissive CORS for the GitHub Pages frontend.
