# x-signal-drafts

X signal alerts and drafts for people who want to participate thoughtfully without turning their account into a bot.

It watches a small set of X accounts, finds new original posts, filters out low-signal noise with an OpenAI model, and drafts only substantive replies. It also runs a tiny local web UI so you can review the feed in a browser, or you can run it headless and hand the JSONL output to your coding agent. It never publishes to X.

## What it does

- Polls the official X recent-search API for original posts from selected accounts.
- Uses an OpenAI model to reject low-signal posts and surface only substantive ones.
- Caps alerts per run and per day, then sends one review batch rather than an inbox firehose.
- Generates at most one original post per local day from a small JSONL context file you control.
- Serves an optional local feed UI at `http://127.0.0.1:3210` when you run it.
- Persists state and feed on disk, so restarts do not resend or resurface old alerts.

## What it deliberately does not do

- Log into X with cookies or browser automation.
- Post, like, follow, or reply on your behalf.
- Invent achievements, metrics, customers, or personal experiences for your daily post.
- Send your X token, OpenAI key, or email credentials to the model.

## Quick start

You need Node 20+, an X API bearer token with recent-search access, and an OpenAI API key. AgentMail is optional; without it, alerts print to stdout.

```sh
npm install -g @puffle/x-signal-drafts
x-signal-drafts --help
```

Create your config and env files:

```sh
x-signal-drafts help                           # show usage
cp .env.example .env                          # fill in your keys
cp config.example.json config.json            # replace the example accounts
mkdir -p data
```

Set the required values in `.env`, replace the example accounts in `config.json`, then give the daily writer some real evidence:

```sh
printf '%s\n' '{"at":"2026-08-04T16:00:00Z","source":"operator note","text":"We learned the review surface matters more than generating another agent run."}' >> data/context.jsonl
npm test
x-signal-drafts reply-scan
x-signal-drafts daily-draft
```

`reply-scan` and `daily-draft` are safe to rerun: the state file suppresses duplicate delivery. The first run will print instead of email until all three AgentMail variables are set.

## Run it continuously with the local feed

```sh
x-signal-drafts run
```

The daemon scans on `config.reply.pollEveryMinutes`, checks the configured local-time minute for the daily post, and serves the feed at `http://127.0.0.1:3210`. Durable state ensures exactly one delivery per day. Use a persistent disk for `data/`.

Or run just the local UI and trigger scans manually:

```sh
x-signal-drafts serve
```

You can also run it with Docker, which keeps only the state and context files mounted outside the container:

```sh
docker compose up -d --build
docker compose logs -f
```

## Configuration

`config.json`:

```json
{
  "targets": ["swyx", "danshipper"],
  "reply": {
    "pollEveryMinutes": 10,
    "lookbackMinutes": 20,
    "maxDraftsPerRun": 2,
    "maxDraftsPerDay": 4
  },
  "daily": { "hour": 8, "minute": 15, "timezone": "America/Los_Angeles" },
  "voice": {
    "bio": "technical founder building AI products",
    "style": "lowercase when natural, direct, specific, and conversational",
    "interests": ["agents", "developer tools"]
  }
}
```

Set `maxDraftsPerDay` low at first. A tight target list and a hard cap are much better than a busy-looking account or an email flood.

## Daily-post context

The daily post writer only sees `data/context.jsonl`. Add one factual line per real thing worth saying:

```json
{"at":"2026-08-04T16:00:00Z","source":"shipping note","text":"We found that a persisted work queue mattered more than another planner prompt."}
```

Context older than 14 days is ignored. If there is no fresh evidence, the job fails instead of generating generic founder content.

## Email delivery

To email through AgentMail, set:

```sh
AGENTMAIL_API_KEY=...
AGENTMAIL_INBOX_ID=you@agentmail.to
EMAIL_TO=you@example.com
```

Keep `.env` and `data/` out of git. The project does not send email if the delivery variables are absent; it writes the drafts to stdout and the feed to `data/feed.jsonl` instead.

## Local feed API

When `serve` or `run` is active:

- `GET /` — the feed UI.
- `GET /api/health` — health check.
- `GET /api/config` — current target list and limits.
- `GET /api/feed?limit=50&offset=0` — recent alerts.
- `POST /api/scan` — trigger a scan in the background.

## API notes

- X recent-search access, rate limits, and historical coverage depend on your X API plan. This project uses `GET /2/tweets/search/recent`, not scraping.
- OpenAI model availability differs by account. Set `OPENAI_MODEL` explicitly instead of relying on a package default.
- This is a review tool, not an autoposter. If you later add posting, make that a separate explicit approval workflow.
- Requests set `store: false` on the OpenAI Responses API call; review your own provider retention settings before sharing sensitive context.

## Development

```sh
npm test
npm run check
```

No npm dependencies are required. The project uses Node's built-in `fetch`, test runner, filesystem APIs, and HTTP server.
