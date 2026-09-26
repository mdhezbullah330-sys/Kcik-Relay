# BENJA HEX Dashboard Relay

Sits between the Discord bot (Pterodactyl) and the web dashboard
(Vercel/Next.js). The bot has the only live Discord gateway session, so
this relay never talks to Discord directly — it just moves data and
action requests back and forth.

## Endpoints

- `wss://<host>/bot` — the bot's persistent connection.
  Auth: `Authorization: Bearer <BRIDGE_SECRET>` header on the upgrade request.

- `wss://<host>/client?token=<jwt>&guildId=<id>` — a dashboard viewer's
  connection. `token` is the short-lived JWT the Next.js backend issues
  after login (signed with `DASHBOARD_JWT_SECRET`). Browsers can't send
  custom headers on a WebSocket handshake, so the token travels in the
  query string instead.

- `POST /action` — called by the Next.js backend (server-side only,
  never from the browser) to trigger a real Discord action. Forwards the
  request to the bot over the existing `/bot` connection and waits for
  its response.
  Auth: `Authorization: Bearer <WEB_RELAY_SECRET>` header.
  Body: `{ "action": "kickMember", "payload": { ... } }`

- `GET /status` — `{ ok, botConnected, guildCount }`, no auth. Useful for
  the dashboard to show a "bot offline" banner.

- `GET /health` — plain 200 OK, no auth. Point UptimeRobot at this on a
  5-minute interval so Render's free tier doesn't spin the instance down.

## Environment variables

| Variable | Must match |
|---|---|
| `BRIDGE_SECRET` | Same value as the bot's `.env` |
| `WEB_RELAY_SECRET` | Same value as the Next.js project's env |
| `DASHBOARD_JWT_SECRET` | Same value as the Next.js project's env |
| `PORT` | Set automatically by Render — don't override in production |

## Deploying on Render

1. Push this folder to its own GitHub repo (`.env` is gitignored — never
   commit it).
2. On Render: **New → Web Service**, connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Add the three secrets above under **Environment** in the Render
   dashboard (paste the same values from your local `.env`).
5. Once deployed, Render gives a URL like
   `https://benja-hex-relay.onrender.com`. The bot's `RELAY_WS_URL`
   becomes `wss://benja-hex-relay.onrender.com/bot`.
6. Add `https://benja-hex-relay.onrender.com/health` to UptimeRobot,
   5-minute interval, so the free instance stays awake.
