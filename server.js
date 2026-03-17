const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require("path");

const app = express();
const server = http.createServer(app);

// 🔥 Socket.IO Konfiguration (wichtig für Railway)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});

// 🔥 Statische Dateien bereitstellen (CSS, JS, HTML)
app.use(express.static(path.join(__dirname)));

// 🔥 Fallback: Immer index.html zurückgeben (SPA Verhalten)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ─── Konstanten ──────────────────────────────────────────────────────────────
const WIN_TO_CHAMPION = 5;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ─── Zustand (Server-State) ──────────────────────────────────────────────────
const players = {};
const queue   = [];
const rooms   = {};
const games   = {};
const chat    = [];
let champCooldown = false;

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────
function makeCode() {
  let code;
  do {
    code = Array.from({length:6}, () =>
      CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]
    ).join('');
  } while (rooms[code]);
  return code;
}

function makeGameId() {
  return 'g_' + Math.random().toString(36).slice(2,10);
}

function checkWinner(board) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,b,c] of lines)
    if (board[a] && board[a] === board[b] && board[a] === board[c])
      return { winner: board[a], cells: [a,b,c] };
  return null;
}

// ─── Chat-System ─────────────────────────────────────────────────────────────
function sysChat(text) {
  const msg = { type:'system', text, time: Date.now() };
  chat.push(msg);
  if (chat.length > 100) chat.shift();
  io.emit('chat', msg);
}

// ─── Statistiken senden ──────────────────────────────────────────────────────
function broadcastStats() {
  io.emit('stats', {
    online: Object.keys(players).length,
    inQueue: queue.length,
    activeGames: Object.keys(games).length
  });
}

// ─── Matchmaking ─────────────────────────────────────────────────────────────
function tryMatchmaking() {
  while (queue.length >= 2) {
    const id1 = queue.shift();
    const id2 = queue.shift();

    if (!players[id1] || !players[id2]) {
      if (players[id1]) queue.unshift(id1);
      if (players[id2]) queue.unshift(id2);
      break;
    }

    startGame(id1, id2, null);
  }
}

// ─── Spiel starten ───────────────────────────────────────────────────────────
function startGame(id1, id2, roomCode) {
  const gameId = roomCode || makeGameId();

  games[gameId] = {
    board: Array(9).fill(''),
    players: { X:id1, O:id2 },
    turn: 'X',
    over: false,
    scores: { X:0, O:0 },
    mode: roomCode ? 'room' : 'tournament',
    roomCode
  };

  players[id1].game = gameId; players[id1].symbol = 'X';
  players[id2].game = gameId; players[id2].symbol = 'O';

  const payload = (sym) => ({
    gameId,
    mySymbol: sym,
    mode: roomCode ? 'room' : 'tournament',
    roomCode: roomCode || null,
    players: {
      X: { name: players[id1].name, wins: players[id1].wins },
      O: { name: players[id2].name, wins: players[id2].wins }
    },
    board: Array(9).fill(''),
    turn: 'X',
    scores: { X:0, O:0 }
  });

  io.to(id1).emit('game_start', payload('X'));
  io.to(id2).emit('game_start', payload('O'));

  sysChat(`⚔️ ${players[id1].name} gegen ${players[id2].name}`);
  broadcastStats();
}

// ─── Socket Events ───────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  // Chat-Historie senden
  socket.emit('chat_history', chat.slice(-30));
  broadcastStats();

  // Spieler beitreten
  socket.on('join', ({ name }) => {
    if (players[socket.id]) return;

    const n = (name || '').trim().slice(0,20) || `Spieler${Math.floor(Math.random()*9999)}`;

    players[socket.id] = {
      name: n,
      wins: 0,
      losses: 0,
      game: null,
      symbol: null,
      roomCode: null
    };

    socket.emit('joined', { name:n });
    sysChat(`👋 ${n} ist beigetreten`);
    broadcastStats();
  });

});

// ─── Server starten ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🎮 Server läuft auf Port ${PORT}`);
});