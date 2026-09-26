// ─────────────────────────────────────────────
//  AUTH HELPERS
//  Three separate trust boundaries meet at this relay:
//   1) The bot          — authenticates with a long-lived shared secret
//                          (BRIDGE_SECRET), identical value set on the
//                          bot and here.
//   2) Browser clients   — authenticate with a short-lived JWT that the
//                          Next.js backend issues after verifying the
//                          user's Discord OAuth session + guild access.
//                          The relay only verifies the JWT's signature
//                          and expiry — it never talks to MongoDB
//                          itself, keeping it a thin, stateless layer.
//   3) Next.js backend   — authenticates its server-to-server action
//                          calls (POST /action) with its own shared
//                          secret (WEB_RELAY_SECRET), separate from the
//                          bot's secret so the two trust boundaries
//                          can be rotated independently.
// ─────────────────────────────────────────────

const jwt = require('jsonwebtoken');

const BRIDGE_SECRET = process.env.BRIDGE_SECRET;
const WEB_RELAY_SECRET = process.env.WEB_RELAY_SECRET;
const DASHBOARD_JWT_SECRET = process.env.DASHBOARD_JWT_SECRET;

function extractBearer(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim();
}

function isBotAuthorized(authHeader) {
  const token = extractBearer(authHeader);
  return Boolean(token) && Boolean(BRIDGE_SECRET) && token === BRIDGE_SECRET;
}

function isWebBackendAuthorized(authHeader) {
  const token = extractBearer(authHeader);
  return Boolean(token) && Boolean(WEB_RELAY_SECRET) && token === WEB_RELAY_SECRET;
}

// Verifies a dashboard viewer's JWT (issued by the Next.js backend after
// login). Returns the decoded payload ({ userId, guildIds, isSuperAccess })
// on success, or null if invalid/expired.
function verifyDashboardToken(token) {
  if (!token || !DASHBOARD_JWT_SECRET) return null;
  try {
    return jwt.verify(token, DASHBOARD_JWT_SECRET);
  } catch (e) {
    return null;
  }
}

module.exports = {
  isBotAuthorized,
  isWebBackendAuthorized,
  verifyDashboardToken,
};
