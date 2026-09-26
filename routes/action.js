const express = require('express');
const { isWebBackendAuthorized } = require('../lib/auth');
const { sendActionToBot } = require('../lib/botSocket');

const router = express.Router();

// POST /action
// Headers:  Authorization: Bearer <WEB_RELAY_SECRET>
// Body:     { action: "kickMember" | "removeWarning" | "clearWarnings" |
//                     "setModeratorConfig" | "setWebAccess",
//             payload: { ...action-specific fields... } }
//
// This is the ONLY way the dashboard can cause a real Discord action —
// it always goes web -> (this route) -> bot, never web -> Discord
// directly. The bot re-validates permissions/hierarchy on its side
// regardless of what this layer allows through.
router.post('/action', async (req, res) => {
  if (!isWebBackendAuthorized(req.headers.authorization)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  }

  const { action, payload } = req.body || {};
  if (!action || typeof action !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing action.' });
  }

  try {
    const result = await sendActionToBot(action, payload || {});
    res.json({ ok: true, result });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

module.exports = router;
