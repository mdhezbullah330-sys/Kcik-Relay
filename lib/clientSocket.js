const { state, addSubscriber, removeClientEverywhere } = require('./state');
const { verifyDashboardToken } = require('./auth');
const { requestGuildDetail } = require('./botSocket');

function log(...args) {
  console.log('[ClientSocket]', ...args);
}

// url is the request URL the client connected with, e.g.
// "/client?token=<jwt>&guildId=123456789012345678"
async function attachClientSocket(ws, url) {
  const params = new URL(url, 'http://relay.internal').searchParams;
  const token = params.get('token');
  const guildId = params.get('guildId');

  const payload = verifyDashboardToken(token);
  if (!payload) {
    ws.close(4401, 'Invalid or expired session.');
    return;
  }
  if (!guildId) {
    ws.close(4400, 'Missing guildId.');
    return;
  }

  const hasAccess = payload.isSuperAccess || (payload.guildIds || []).includes(guildId);
  if (!hasAccess) {
    ws.close(4403, 'No access to this guild.');
    return;
  }

  log(`Dashboard client connected — user ${payload.userId}, guild ${guildId}`);
  addSubscriber(guildId, ws);
  ws.__guildId = guildId; // stashed for cleanup on close

  // Send whatever we already have immediately so the UI isn't blank
  // while we wait on the bot for a fresh detail fetch.
  const cachedSummary = state.guildSummaries.get(guildId) || null;
  const cachedDetail = state.guildDetails.get(guildId) || null;
  ws.send(JSON.stringify({ type: 'init', summary: cachedSummary, detail: cachedDetail }));

  // Always refresh detail from the bot on open so role/member lists
  // aren't stale from a previous session.
  try {
    const freshDetail = await requestGuildDetail(guildId);
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'detailRefresh', detail: freshDetail }));
    }
  } catch (err) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  }

  ws.on('close', () => {
    removeClientEverywhere(ws);
    log(`Dashboard client disconnected — user ${payload.userId}, guild ${guildId}`);
  });

  ws.on('error', (err) => log('Client socket error:', err.message));
}

module.exports = { attachClientSocket };
