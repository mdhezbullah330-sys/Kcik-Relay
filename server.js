require('dotenv').config();

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

const { isBotAuthorized } = require('./lib/auth');
const { attachBotSocket } = require('./lib/botSocket');
const { attachClientSocket } = require('./lib/clientSocket');
const healthRoutes = require('./routes/health');
const actionRoutes = require('./routes/action');
const guildsRoutes = require('./routes/guilds');
const guildDetailRoutes = require('./routes/guildDetail');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(healthRoutes);
app.use(actionRoutes);
app.use(guildsRoutes);
app.use(guildDetailRoutes);

const server = http.createServer(app);

// noServer: true — we handle the WebSocket upgrade ourselves below so we
// can branch on the path (/bot vs /client) and reject unauthorized
// connections BEFORE they're accepted, rather than accepting first and
// closing after.
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://relay.internal');

  if (url.pathname === '/bot') {
    if (!isBotAuthorized(req.headers['authorization'])) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      attachBotSocket(ws);
    });
    return;
  }

  if (url.pathname === '/client') {
    // Auth for dashboard clients happens per-connection (query-param
    // JWT) inside attachClientSocket, since browsers can't set custom
    // WebSocket headers — the token travels in the URL instead.
    wss.handleUpgrade(req, socket, head, (ws) => {
      attachClientSocket(ws, req.url);
    });
    return;
  }

  socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
  socket.destroy();
});

server.listen(PORT, () => {
  console.log(`[Relay] Listening on port ${PORT}`);
  console.log(`[Relay] Bot endpoint:    wss://<this-host>/bot`);
  console.log(`[Relay] Client endpoint: wss://<this-host>/client?token=...&guildId=...`);
});
