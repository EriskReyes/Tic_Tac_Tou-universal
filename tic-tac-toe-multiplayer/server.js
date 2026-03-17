const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(__dirname));

// ─── Constants ───────────────────────────────────────────────────────────────
const WIN_TO_CHAMPION = 5;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ─── State ───────────────────────────────────────────────────────────────────
const players = {};  // socketId → PlayerData
const queue   = [];  // tournament queue
const rooms   = {};  // roomCode → RoomData
const games   = {};  // gameId   → GameData
const chat    = [];  // global history (last 100)
let champCooldown = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeCode() {
  let code;
  do { code = Array.from({length:6}, () => CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]).join(''); }
  while (rooms[code]);
  return code;
}

function makeGameId() { return 'g_' + Math.random().toString(36).slice(2,10); }

function checkWinner(board) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,b,c] of lines)
    if (board[a] && board[a] === board[b] && board[a] === board[c])
      return { winner: board[a], cells: [a,b,c] };
  return null;
}

function sysChat(text) {
  const msg = { type:'system', text, time: Date.now() };
  chat.push(msg);
  if (chat.length > 100) chat.shift();
  io.emit('chat', msg);
}

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

function startGame(id1, id2, roomCode) {
  const gameId = roomCode || makeGameId();
  games[gameId] = {
    board: Array(9).fill(''),
    players: { X:id1, O:id2 },
    turn: 'X', over: false,
    scores: { X:0, O:0 },
    mode: roomCode ? 'room' : 'tournament',
    roomCode
  };
  players[id1].game = gameId; players[id1].symbol = 'X';
  players[id2].game = gameId; players[id2].symbol = 'O';

  const payload = (sym) => ({
    gameId, mySymbol: sym,
    mode: roomCode ? 'room' : 'tournament',
    roomCode: roomCode || null,
    players: {
      X: { name: players[id1].name, wins: players[id1].wins },
      O: { name: players[id2].name, wins: players[id2].wins }
    },
    board: Array(9).fill(''), turn: 'X', scores: { X:0, O:0 }
  });
  io.to(id1).emit('game_start', payload('X'));
  io.to(id2).emit('game_start', payload('O'));
  sysChat(`⚔️ ${players[id1].name} gegen ${players[id2].name}`);
  broadcastStats();
}

// ─── Game Over ───────────────────────────────────────────────────────────────
function handleGameOver(gameId, winnerId, winnerSym, winCells, isDraw) {
  const game = games[gameId];
  if (!game || game.over) return;
  game.over = true;

  const loserSym = winnerSym === 'X' ? 'O' : 'X';
  const loserId  = game.players[loserSym];

  if (!isDraw && winnerId) {
    game.scores[winnerSym]++;
    if (players[winnerId]) players[winnerId].wins++;
    if (players[loserId])  players[loserId].losses++;
  }

  const updatedPlayers = {
    X: { name: players[game.players.X]?.name, wins: players[game.players.X]?.wins || 0 },
    O: { name: players[game.players.O]?.name, wins: players[game.players.O]?.wins || 0 }
  };

  [game.players.X, game.players.O].forEach(id => {
    if (players[id]) {
      io.to(id).emit('game_over', {
        board: game.board,
        winner: isDraw ? null : winnerSym,
        winnerName: isDraw ? null : players[winnerId]?.name,
        winning_cells: winCells || [],
        is_draw: isDraw,
        scores: game.scores,
        updatedPlayers,
        iWon: !isDraw && id === winnerId,
        mode: game.mode
      });
    }
  });

  if (!isDraw && winnerId) {
    const wname = players[winnerId]?.name || '?';
    const lname = players[loserId]?.name  || '?';
    sysChat(`🏅 ${wname} besiegte ${lname}! (${players[winnerId]?.wins} Siege)`);
    // Champion check
    if (game.mode === 'tournament' && !champCooldown && players[winnerId]?.wins >= WIN_TO_CHAMPION) {
      champCooldown = true;
      const cName = players[winnerId].name;
      const cWins = players[winnerId].wins;
      setTimeout(() => {
        io.emit('champion', { name: cName, wins: cWins });
        sysChat(`🏆🏆🏆 ${cName} IST DER WELTMEISTER mit ${cWins} Siegen! 🏆🏆🏆`);
        setTimeout(() => {
          Object.values(players).forEach(p => { p.wins = 0; p.losses = 0; });
          io.emit('tournament_reset');
          sysChat('🔄 Neues Turnier gestartet. Auf geht\'s!');
          champCooldown = false;
        }, 15000);
      }, 3000);
    }
  } else if (isDraw) {
    const xn = players[game.players.X]?.name || '?';
    const on = players[game.players.O]?.name || '?';
    sysChat(`🤝 Unentschieden zwischen ${xn} und ${on}`);
  }

  const delay = 4000;
  if (game.mode === 'room' && game.roomCode && rooms[game.roomCode]) {
    setTimeout(() => {
      [game.players.X, game.players.O].forEach(id => {
        if (players[id]) {
          players[id].game = null; players[id].symbol = null;
          io.to(id).emit('room_waiting', { roomCode: game.roomCode });
        }
      });
      rooms[game.roomCode].gameId = null;
      delete games[gameId];
      broadcastStats();
    }, delay);
  } else {
    delete games[gameId];
    const pX = game.players.X, pO = game.players.O;
    setTimeout(() => {
      if (isDraw) {
        [pX, pO].forEach(id => {
          if (players[id] && !players[id].game) {
            players[id].game = null; players[id].symbol = null;
            queue.push(id);
            io.to(id).emit('back_to_queue', { wins: players[id].wins });
          }
        });
        tryMatchmaking();
      } else {
        if (players[winnerId] && !players[winnerId].game) {
          players[winnerId].game = null; players[winnerId].symbol = null;
          queue.push(winnerId);
          io.to(winnerId).emit('back_to_queue', { wins: players[winnerId].wins });
          tryMatchmaking();
        }
        if (players[loserId] && !players[loserId].game) {
          players[loserId].game = null; players[loserId].symbol = null;
          io.to(loserId).emit('eliminated', { losses: players[loserId].losses });
        }
      }
      broadcastStats();
    }, delay);
  }
}

// ─── Socket Events ───────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.emit('chat_history', chat.slice(-30));
  broadcastStats();

  socket.on('join', ({ name }) => {
    if (players[socket.id]) return;
    const n = (name || '').trim().slice(0,20) || `Spieler${Math.floor(Math.random()*9999)}`;
    players[socket.id] = { name:n, wins:0, losses:0, game:null, symbol:null, roomCode:null };
    socket.emit('joined', { name:n });
    sysChat(`👋 ${n} ist dem Turnier beigetreten`);
    broadcastStats();
  });

  socket.on('join_queue', () => {
    const p = players[socket.id];
    if (!p || p.game || queue.includes(socket.id)) return;
    queue.push(socket.id);
    socket.emit('queue_joined', { position: queue.length });
    broadcastStats();
    tryMatchmaking();
  });

  socket.on('leave_queue', () => {
    const i = queue.indexOf(socket.id);
    if (i !== -1) queue.splice(i, 1);
    broadcastStats();
  });

  socket.on('create_room', () => {
    const p = players[socket.id];
    if (!p || p.game) return;
    const code = makeCode();
    rooms[code] = { players: [socket.id], gameId: null };
    p.roomCode = code;
    socket.emit('room_created', { code });
    broadcastStats();
  });

  socket.on('join_room', ({ code }) => {
    const p = players[socket.id];
    if (!p || p.game) return;
    const room = rooms[code?.toUpperCase()];
    if (!room)                          { socket.emit('room_error', { msg:'Raum nicht gefunden ❌' }); return; }
    if (room.players.length >= 2)       { socket.emit('room_error', { msg:'Raum ist voll 🚫' }); return; }
    if (room.players.includes(socket.id)){ socket.emit('room_error', { msg:'Du bist bereits in diesem Raum' }); return; }
    room.players.push(socket.id);
    p.roomCode = code.toUpperCase();
    startGame(room.players[0], room.players[1], code.toUpperCase());
  });

  socket.on('rematch', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.players.length < 2) return;
    const [id1, id2] = room.players;
    if (!players[id1] || !players[id2]) return;
    if (players[id1].game || players[id2].game) return;
    startGame(id1, id2, roomCode);
  });

  socket.on('move', ({ gameId, cell }) => {
    const game = games[gameId];
    const p = players[socket.id];
    if (!game || game.over || !p) return;
    if (p.game !== gameId || game.turn !== p.symbol) return;
    if (typeof cell !== 'number' || cell < 0 || cell > 8 || game.board[cell] !== '') return;
    game.board[cell] = p.symbol;
    const result = checkWinner(game.board);
    if (result) { handleGameOver(gameId, socket.id, p.symbol, result.cells, false); return; }
    if (!game.board.includes('')) { handleGameOver(gameId, null, null, [], true); return; }
    game.turn = game.turn === 'X' ? 'O' : 'X';
    io.to(game.players.X).to(game.players.O).emit('game_update', { board: game.board, turn: game.turn });
  });

  socket.on('chat', ({ text }) => {
    const p = players[socket.id];
    if (!p || !text?.trim()) return;
    const msg = { type:'user', id:socket.id, name:p.name, text:text.trim().slice(0,200), time:Date.now() };
    chat.push(msg);
    if (chat.length > 100) chat.shift();
    io.emit('chat', msg);
  });

  socket.on('rejoin_queue', () => {
    const p = players[socket.id];
    if (!p || p.game || queue.includes(socket.id)) return;
    p.game = null; p.symbol = null;
    queue.push(socket.id);
    socket.emit('back_to_queue', { wins: p.wins });
    broadcastStats();
    tryMatchmaking();
  });

  socket.on('disconnect', () => {
    const p = players[socket.id];
    if (!p) return;
    if (p.game && games[p.game]) {
      const game = games[p.game];
      const oppSym = p.symbol === 'X' ? 'O' : 'X';
      const oppId  = game.players[oppSym];
      if (oppId && players[oppId]) {
        io.to(oppId).emit('opponent_left');
        handleGameOver(p.game, oppId, oppSym, [], false);
      } else { delete games[p.game]; }
    }
    if (p.roomCode && rooms[p.roomCode]) {
      const room = rooms[p.roomCode];
      room.players = room.players.filter(id => id !== socket.id);
      if (room.players.length === 0) delete rooms[p.roomCode];
      else io.to(room.players[0]).emit('partner_left');
    }
    const qi = queue.indexOf(socket.id);
    if (qi !== -1) queue.splice(qi, 1);
    sysChat(`👋 ${p.name} hat das Turnier verlassen`);
    delete players[socket.id];
    broadcastStats();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🎮 Server läuft auf Port ${PORT}`));
