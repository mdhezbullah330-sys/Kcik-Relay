const express = require('express');
const { state } = require('../lib/state');
const { isWebBackendAuthorized } = require('../lib/auth');

const router = express.Router();

// GET /guilds
// Returns the bot's cached guild summaries (id, name, icon, memberCount,
// ownerId, isSuperAccessGuild). Used by the Next.js backend right after
// login to figure out which of the user's Discord guilds the bot is
// actually in, before computing their dashboard access.
router.get('/guilds', (req, res) => {
  if (!isWebBackendAuthorized(req.headers.authorization)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  }
  res.json({ ok: true, guilds: Array.from(state.guildSummaries.values()) });
});

module.exports = router;
