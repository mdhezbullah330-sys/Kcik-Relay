// ─────────────────────────────────────────────
//  SHARED IN-MEMORY STATE
//  A single Render instance holds all of this in memory. That's fine
//  here — there is exactly one bot connection and a modest number of
//  concurrent dashboard viewers, so no external store (Redis etc.) is
//  needed. If this were ever scaled to multiple relay instances, this
//  state would need to move to something shared like Redis.
// ─────────────────────────────────────────────

const state = {
  // The bot's single persistent WebSocket connection (or null if not
  // currently connected).
  botSocket: null,

  // guildId -> { id, name, iconURL, memberCount, ownerId, isSuperAccessGuild }
  guildSummaries: new Map(),

  // guildId -> { roles: [...], members: [...] } — populated on demand
  // when a dashboard viewer opens that guild, refreshed by live push
  // events from the bot afterwards.
  guildDetails: new Map(),

  // guildId -> Set of client WebSocket connections currently viewing
  // that guild's dashboard page (for targeted broadcast of updates).
  guildSubscribers: new Map(),

  // requestId -> { resolve, reject, timeout } — action requests sent to
  // the bot that are awaiting a response, used by the REST /action route
  // so an HTTP call can "await" a WebSocket round trip to the bot.
  pendingRequests: new Map(),
};

function getSubscribers(guildId) {
  if (!state.guildSubscribers.has(guildId)) {
    state.guildSubscribers.set(guildId, new Set());
  }
  return state.guildSubscribers.get(guildId);
}

function addSubscriber(guildId, ws) {
  getSubscribers(guildId).add(ws);
}

function removeSubscriber(guildId, ws) {
  const set = state.guildSubscribers.get(guildId);
  if (set) set.delete(ws);
}

// Removes a disconnected client from every guild it was subscribed to
// (a client only subscribes to one guild at a time in practice, but this
// is defensive in case that ever changes).
function removeClientEverywhere(ws) {
  for (const set of state.guildSubscribers.values()) {
    set.delete(ws);
  }
}

function broadcastToGuild(guildId, payload) {
  const subscribers = state.guildSubscribers.get(guildId);
  if (!subscribers || subscribers.size === 0) return;
  const raw = JSON.stringify(payload);
  for (const client of subscribers) {
    if (client.readyState === client.OPEN) client.send(raw);
  }
}

module.exports = {
  state,
  getSubscribers,
  addSubscriber,
  removeSubscriber,
  removeClientEverywhere,
  broadcastToGuild,
};
