const express = require('express');
const { state } = require('../lib/state');

const router = express.Router();

// GET /health — UptimeRobot pings this every few minutes to keep the
// free Render instance awake. No auth needed; it returns nothing
// sensitive.
router.get('/health', (req, res) => {
  res.status(200).json({ ok: true, uptimeSeconds: process.uptime() });
});

// GET /status — same idea, but also reports whether the bot's
// WebSocket is currently connected, so the dashboard can show a
// "bot offline" banner if something's wrong.
router.get('/status', (req, res) => {
  const botConnected = Boolean(state.botSocket && state.botSocket.readyState === state.botSocket.OPEN);
  res.status(200).json({ ok: true, botConnected, guildCount: state.guildSummaries.size });
});

module.exports = router;
