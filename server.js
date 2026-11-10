const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e6, cors: { origin: '*' } });
const rooms = new Map();
app.use(express.static('public'));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.get('/lan-info', (_req, res) => {
  const addresses = [];
  for (const list of Object.values(os.networkInterfaces())) for (const item of (list || [])) {
    if (item.family === 'IPv4' && !item.internal) addresses.push(item.address);
  }
  res.json({ addresses });
});

function makeCode() {
  let code;
  do { code = crypto.randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
  return code;
}
function roomInfo(room) {
  return { code: room.code, players: room.players.size, hasState: !!room.state };
}
function sendRoomInfo(room) { io.to(room.code).emit('room-info', roomInfo(room)); }

io.on('connection', socket => {
  socket.on('create-room', (ack = () => {}) => {
    if (socket.data.room) leaveRoom(socket);
    const code = makeCode();
    const room = { code, host: socket.id, players: new Set([socket.id]), state: null };
    rooms.set(code, room);
    socket.join(code);
    socket.data.room = code;
    ack({ ok: true, code, host: true });
    sendRoomInfo(room);
  });

  socket.on('join-room', (rawCode, ack = () => {}) => {
    const code = String(rawCode || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return ack({ ok: false, error: 'اتاق پیدا نشد؛ کد را بررسی کن.' });
    if (socket.data.room) leaveRoom(socket);
    room.players.add(socket.id);
    socket.join(code);
    socket.data.room = code;
    ack({ ok: true, code, host: room.host === socket.id, state: room.state, info: roomInfo(room) });
    sendRoomInfo(room);
  });

  socket.on('state-update', state => {
    const code = socket.data.room;
    const room = rooms.get(code);
    if (!room || !state || typeof state !== 'object') return;
    let serialized;
    try { serialized = JSON.stringify(state); } catch { return; }
    if (serialized.length > 900000) return;
    room.state = JSON.parse(serialized);
    socket.to(code).emit('state-sync', room.state);
  });

  socket.on('disconnect', () => leaveRoom(socket));
});

function leaveRoom(socket) {
  const code = socket.data.room;
  if (!code) return;
  const room = rooms.get(code);
  socket.leave(code);
  socket.data.room = null;
  if (!room) return;
  room.players.delete(socket.id);
  if (room.players.size === 0) rooms.delete(code);
  else {
    if (room.host === socket.id) room.host = room.players.values().next().value;
    sendRoomInfo(room);
  }
}

const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', () => {
  console.log(`ARCADIA Wi-Fi LAN server listening on port ${port}`);
  for (const list of Object.values(os.networkInterfaces())) for (const item of (list || [])) {
    if (item.family === 'IPv4' && !item.internal) console.log(`Friends on the same Wi-Fi: http://${item.address}:${port}`);
  }
  console.log(`This PC: http://localhost:${port}`);
});
