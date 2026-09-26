const crypto = require('crypto');
const { state, broadcastToGuild } = require('./state');

const ACTION_TIMEOUT_MS = 15000;

function log(...args) {
  console.log('[BotSocket]', ...args);
}

function attachBotSocket(ws) {
  if (state.botSocket && state.botSocket.readyState === state.botSocket.OPEN) {
    log('A bot connection already exists — closing the old one in favor of the new one.');
    try { state.botSocket.close(); } catch (e) { /* ignore */ }
  }
  state.botSocket = ws;
  log('Bot connected.');

  ws.on('message', (raw) => handleBotMessage(raw));

  ws.on('close', () => {
    log('Bot disconnected.');
    if (state.botSocket === ws) state.botSocket = null;
    // Reject any in-flight action requests — they'll never get an answer now.
    for (const [requestId, pending] of state.pendingRequests) {
      clearTimeout(pending.timeoutHandle);
      pending.reject(new Error('Bot disconnected before responding.'));
      state.pendingRequests.delete(requestId);
    }
  });

  ws.on('error', (err) => log('Bot socket error:', err.message));
}

function handleBotMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch (e) {
    log('Received malformed message from bot, ignoring.');
    return;
  }

  switch (msg.type) {
    case 'heartbeat':
      sendToBot({ type: 'heartbeat_ack' });
      break;

    case 'snapshot':
      for (const guild of msg.guilds) {
        state.guildSummaries.set(guild.id, guild);
      }
      break;

    case 'memberAdd':
    case 'memberUpdate': {
      const detail = state.guildDetails.get(msg.guildId);
      if (detail) {
        const idx = detail.members.findIndex(m => m.id === msg.member.id);
        if (idx >= 0) detail.members[idx] = msg.member;
        else detail.members.push(msg.member);
      }
      broadcastToGuild(msg.guildId, { type: 'memberUpdate', member: msg.member });
      break;
    }

    case 'memberRemove': {
      const detail = state.guildDetails.get(msg.guildId);
      if (detail) detail.members = detail.members.filter(m => m.id !== msg.userId);
      broadcastToGuild(msg.guildId, { type: 'memberRemove', userId: msg.userId });
      break;
    }

    case 'roleCreate':
    case 'roleUpdate': {
      const detail = state.guildDetails.get(msg.guildId);
      if (detail) {
        const idx = detail.roles.findIndex(r => r.id === msg.role.id);
        if (idx >= 0) detail.roles[idx] = msg.role;
        else detail.roles.push(msg.role);
      }
      broadcastToGuild(msg.guildId, { type: 'roleUpdate', role: msg.role });
      break;
    }

    case 'roleDelete': {
      const detail = state.guildDetails.get(msg.guildId);
      if (detail) detail.roles = detail.roles.filter(r => r.id !== msg.roleId);
      broadcastToGuild(msg.guildId, { type: 'roleDelete', roleId: msg.roleId });
      break;
    }

    case 'response': {
      const pending = state.pendingRequests.get(msg.requestId);
      if (!pending) return; // already timed out or unknown — ignore
      clearTimeout(pending.timeoutHandle);
      state.pendingRequests.delete(msg.requestId);
      if (msg.ok) pending.resolve(msg.result);
      else pending.reject(new Error(msg.error || 'Bot reported an error.'));
      break;
    }

    default:
      log('Unhandled message type from bot:', msg.type);
  }
}

function sendToBot(payload) {
  if (state.botSocket && state.botSocket.readyState === state.botSocket.OPEN) {
    state.botSocket.send(JSON.stringify(payload));
    return true;
  }
  return false;
}

// Sends a fire-and-await request to the bot and resolves with its
// result, or rejects on timeout / bot error / bot disconnect.
function sendActionToBot(action, payload) {
  return new Promise((resolve, reject) => {
    if (!sendToBot ) { /* no-op, real check below */ }
    const requestId = crypto.randomUUID();
    const timeoutHandle = setTimeout(() => {
      state.pendingRequests.delete(requestId);
      reject(new Error('Bot did not respond in time.'));
    }, ACTION_TIMEOUT_MS);

    state.pendingRequests.set(requestId, { resolve, reject, timeoutHandle });

    const sent = sendToBot({ type: 'request', requestId, action, payload });
    if (!sent) {
      clearTimeout(timeoutHandle);
      state.pendingRequests.delete(requestId);
      reject(new Error('Bot is not currently connected.'));
    }
  });
}

// Asks the bot for a fresh roles+members snapshot of one guild (used
// when a dashboard viewer opens a guild page that isn't cached yet).
function requestGuildDetail(guildId) {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timeoutHandle = setTimeout(() => {
      state.pendingRequests.delete(requestId);
      reject(new Error('Bot did not respond in time.'));
    }, ACTION_TIMEOUT_MS);

    state.pendingRequests.set(requestId, {
      resolve: (result) => {
        state.guildDetails.set(guildId, result);
        resolve(result);
      },
      reject,
      timeoutHandle,
    });

    const sent = sendToBot({ type: 'fetchGuildDetail', requestId, guildId });
    if (!sent) {
      clearTimeout(timeoutHandle);
      state.pendingRequests.delete(requestId);
      reject(new Error('Bot is not currently connected.'));
    }
  });
}

module.exports = { attachBotSocket, sendActionToBot, requestGuildDetail };
