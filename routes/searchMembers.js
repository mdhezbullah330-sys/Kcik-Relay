const express = require('express');
const { state } = require('../lib/state');
const { isWebBackendAuthorized } = require('../lib/auth');

const router = express.Router();

// POST /search-members
// Headers: Authorization: Bearer <WEB_RELAY_SECRET>
// Body:    { query, limit? }
//
// Searches the cached member lists of EVERY guild the bot is in (kept
// warm by the bot's cache push) by username / display name / nickname /
// exact user ID, returning one result per user. Used by the Web Access
// page to pick someone to grant dashboard access to, without shipping
// thousands of members to the browser.
router.post('/search-members', (req, res) => {
  if (!isWebBackendAuthorized(req.headers.authorization)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  }

  const query = String(req.body?.query || '').trim().toLowerCase();
  const limit = Math.min(Number(req.body?.limit) || 8, 20);
  if (query.length < 2) return res.json({ ok: true, results: [] });

  const seen = new Set();
  const results = [];

  for (const [guildId, detail] of state.guildDetails) {
    const guildName = state.guildSummaries.get(guildId)?.name || guildId;
    for (const m of detail.members) {
      if (m.bot || seen.has(m.id)) continue;
      const matches =
        m.id === query ||
        [m.username, m.globalName, m.nickname]
          .filter(Boolean)
          .some(s => s.toLowerCase().includes(query));
      if (!matches) continue;

      seen.add(m.id);
      results.push({
        id: m.id,
        username: m.username,
        globalName: m.globalName,
        nickname: m.nickname,
        avatarURL: m.avatarURL,
        guildName,
      });
      if (results.length >= limit) return res.json({ ok: true, results });
    }
  }

  res.json({ ok: true, results });
});

module.exports = router;
