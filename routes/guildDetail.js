const express = require('express');
const { state } = require('../lib/state');
const { isWebBackendAuthorized } = require('../lib/auth');
const { requestGuildDetail } = require('../lib/botSocket');

const router = express.Router();

// POST /guild-detail
// Headers: Authorization: Bearer <WEB_RELAY_SECRET>
// Body:    { guildId }
//
// Serves the cached roles+members snapshot instantly if we already have
// one (kept warm by live gateway events pushed from the bot), and only
// falls back to asking the bot — a multi-second round trip for large
// guilds — when nothing is cached yet. A background refresh is kicked
// off after serving a cache hit so the data doesn't go stale forever
// without the caller having to wait for it.
router.post('/guild-detail', async (req, res) => {
  if (!isWebBackendAuthorized(req.headers.authorization)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  }

  const { guildId } = req.body || {};
  if (!guildId) return res.status(400).json({ ok: false, error: 'Missing guildId.' });

  const cached = state.guildDetails.get(guildId);
  if (cached) {
    res.json({ ok: true, detail: cached });
    // Fire-and-forget refresh so the cache doesn't drift too far from
    // reality — the CALLER already got their fast response above.
    requestGuildDetail(guildId).catch(() => { /* next request will retry */ });
    return;
  }

  try {
    const detail = await requestGuildDetail(guildId);
    res.json({ ok: true, detail });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

module.exports = router;
