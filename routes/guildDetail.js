const express = require('express');
const { isWebBackendAuthorized } = require('../lib/auth');
const { requestGuildDetail } = require('../lib/botSocket');

const router = express.Router();

// POST /guild-detail
// Headers: Authorization: Bearer <WEB_RELAY_SECRET>
// Body:    { guildId }
// Asks the bot for a fresh roles+members snapshot of one guild. Used by
// Next.js server components (e.g. the Moderators page) that need this
// data at render time, not just by WS-connected dashboard clients.
router.post('/guild-detail', async (req, res) => {
  if (!isWebBackendAuthorized(req.headers.authorization)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  }

  const { guildId } = req.body || {};
  if (!guildId) return res.status(400).json({ ok: false, error: 'Missing guildId.' });

  try {
    const detail = await requestGuildDetail(guildId);
    res.json({ ok: true, detail });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

module.exports = router;
