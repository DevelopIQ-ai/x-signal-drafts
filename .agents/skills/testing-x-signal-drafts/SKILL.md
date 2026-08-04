---
name: testing-x-signal-drafts
description: How to end-to-end test the @puffle/x-signal-drafts package locally without real X or OpenAI credentials.
---

# Testing x-signal-drafts locally

This skill covers the fastest way to exercise the CLI, local server, X-style feed UI, and marketing website without touching real X or OpenAI APIs.

## No-secrets smoke test

All of these can run without `X_BEARER_TOKEN` or `OPENAI_API_KEY`:

- `npm install`
- `npm run lint`
- `npm test`
- `npm pack --dry-run`

## Local server with fake data

1. Copy `config.example.json` to a temp config and set `targets` to fake handles.
2. Write a fake `/tmp/xs-feed.jsonl` with one JSON object per line. Each line should contain `{ tweet: { id, text, createdAt, metrics, author: { username, name }, url }, rationale }`.
3. Run:

```sh
X_SIGNAL_CONFIG=/tmp/xs-config.json \
X_SIGNAL_STATE=/tmp/xs-state.json \
X_SIGNAL_FEED=/tmp/xs-feed.jsonl \
PORT=3456 \
node src/cli.mjs serve
```

4. Open `http://127.0.0.1:3456/` in Chrome.

The server reads the feed in `src/lib/feed.mjs` and reverses the JSONL lines, so the newest alert is written last and appears first in the UI.

## API endpoints to exercise

- `GET /api/health` -> `{"status":"ok"}`
- `GET /api/config` -> target list and limits
- `GET /api/feed?limit=50` -> `{ alerts: [...] }`
- `POST /api/scan` -> `202 { "status": "started" }` (background scan will error without X/OpenAI creds, but the server must stay up)

## Marketing site

Open `file:///path/to/repo/website/index.html` in Chrome. It is a static HTML file using Tailwind CDN.

## Useful artifacts

- `/tmp/xs-server.log` — server output
- `/tmp/xs-health.json`, `/tmp/xs-config-response.json`, `/tmp/xs-feed-response.json`, `/tmp/xs-scan-response.json` — curl outputs if you tee them there
