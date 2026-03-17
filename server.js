const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling']
});

app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ─── Konstanten ──────────────────────────────────────────────────────────────
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ─── Server-State ─────────────────────────────────────────────────────────────
const players = {};
const queue   = [];
const rooms   = {};
const games   = {};
const chat    = [];

// ─── Turnier-State ────────────────────────────────────────────────────────────
const tournament = {
  phase: 'idle',    // 'idle' | 'lobby' | 'playing'
  round: 0,
  participants: [],
  advancing: [],
  activeGames: new Set(),
  lobbyTimer: null,
  countdown: 0,
  size: 0
};

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────
function makeCode() {
  let code;
  do {
    code = Array.from({ length: 6 }, () =>
      CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join('');
  } while (rooms[code]);
  return code;
}

function makeGameId() {
  return 'g_' + Math.random().toString(36).slice(2, 10);
}

function checkWinner(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a, b, c] of lines)
    if (board[a] && board[a] === board[b] && board[a] === board[c])
      return { winner: board[a], cells: [a, b, c] };
  return null;
}

function sysChat(text) {
  const msg = { type: 'system', text, time: Date.now() };
  chat.push(msg);
  if (chat.length > 100) chat.shift();
  io.emit('chat', msg);
}

function broadcastStats() {
  io.emit('stats', {
    online:      Object.keys(players).length,
    inQueue:     queue.length,
    activeGames: Object.keys(games).length
  });
}

// ─── Turnier-Logik ────────────────────────────────────────────────────────────
function startLobbyCountdown() {
  if (tournament.phase !== 'idle') return;
  tournament.phase = 'lobby';
  tournament.countdown = 15;
  sysChat(`⏱️ Turnier startet in 15 Sekunden! ${queue.length} Spieler bereit. Schnell beitreten!`);
  io.emit('tournament_countdown', { seconds: tournament.countdown, count: queue.length });

  tournament.lobbyTimer = setInterval(() => {
    tournament.countdown--;
    io.emit('tournament_countdown', { seconds: tournament.countdown, count: queue.length });
    if (tournament.countdown <= 0) {
      clearInterval(tournament.lobbyTimer);
      tournament.lobbyTimer = null;
      if (queue.length >= 2) {
        launchTournament();
      } else {
        tournament.phase = 'idle';
      }
    }
  }, 1000);
}

function launchTournament() {
  tournament.participants = [...queue];
  queue.length = 0;
  tournament.size = tournament.participants.length;
  tournament.advancing = [];
  tournament.activeGames.clear();
  tournament.round = 0;
  tournament.phase = 'playing';
  sysChat(`🏆 Turnier startet mit ${tournament.size} Spielern!`);
  startNextRound(tournament.participants);
}

function startNextRound(roundPlayers) {
  const valid = roundPlayers.filter(id => players[id] && !players[id].game);
  if (valid.length <= 1) {
    if (valid.length === 1 && players[valid[0]]) {
      io.emit('champion', { name: players[valid[0]].name, wins: players[valid[0]].wins || 0 });
      sysChat(`🏆🏆🏆 ${players[valid[0]].name} GEWINNT DAS TURNIER! 🏆🏆🏆`);
    }
    resetTournament();
    return;
  }

  tournament.round++;
  tournament.advancing = [];
  tournament.activeGames.clear();

  // Shuffle
  for (let i = valid.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [valid[i], valid[j]] = [valid[j], valid[i]];
  }

  // Freilos bei ungerader Anzahl
  if (valid.length % 2 !== 0) {
    const byeId = valid.pop();
    tournament.advancing.push(byeId);
    io.to(byeId).emit('tournament_bye', { round: tournament.round });
    sysChat(`🎯 Freilos: ${players[byeId]?.name} kommt direkt in Runde ${tournament.round + 1}`);
  }

  const matchups = [];
  for (let i = 0; i < valid.length; i += 2) {
    const [id1, id2] = [valid[i], valid[i + 1]];
    if (!players[id1] || !players[id2]) continue;
    const gid = startGame(id1, id2, null);
    tournament.activeGames.add(gid);
    matchups.push({ p1: players[id1].name, p2: players[id2].name });
  }

  const totalRounds = Math.ceil(Math.log2(tournament.size));
  io.emit('tournament_round_start', { round: tournament.round, totalRounds, matchups, total: tournament.size });
  sysChat(`⚔️ Runde ${tournament.round}/${totalRounds} – ${matchups.length} Spiele laufen gleichzeitig!`);
  broadcastTournamentState();
  broadcastStats();
}

function checkRoundComplete() {
  if (tournament.activeGames.size > 0) return;
  const advancers = tournament.advancing.filter(id => players[id]);
  if (advancers.length <= 1) {
    if (advancers.length === 1 && players[advancers[0]]) {
      io.emit('champion', { name: players[advancers[0]].name, wins: players[advancers[0]].wins || 0 });
      sysChat(`🏆🏆🏆 ${players[advancers[0]].name} GEWINNT DAS TURNIER! 🏆🏆🏆`);
    }
    resetTournament();
  } else {
    const totalRounds = Math.ceil(Math.log2(Math.max(tournament.size, 2)));
    sysChat(`✅ Runde ${tournament.round}/${totalRounds} fertig! ${advancers.length} kommen weiter. Nächste Runde in 5s...`);
    io.emit('tournament_between_rounds', {
      advancing: advancers.map(id => players[id]?.name).filter(Boolean),
      nextIn: 5
    });
    setTimeout(() => {
      if (tournament.phase === 'playing') startNextRound(tournament.advancing);
    }, 5000);
  }
}

function broadcastTournamentState() {
  const matches = [];
  for (const gid of tournament.activeGames) {
    const g = games[gid];
    if (!g) continue;
    matches.push({
      p1: players[g.players.X]?.name || '?',
      p2: players[g.players.O]?.name || '?',
      scores: { X: g.scores.X, O: g.scores.O }
    });
  }
  io.emit('tournament_state', {
    phase: tournament.phase,
    round: tournament.round,
    totalRounds: Math.ceil(Math.log2(Math.max(tournament.size, 2))),
    activeMatches: matches,
    advancing: tournament.advancing.map(id => players[id]?.name).filter(Boolean),
    total: tournament.size
  });
}

function resetTournament() {
  if (tournament.lobbyTimer) { clearInterval(tournament.lobbyTimer); tournament.lobbyTimer = null; }
  tournament.phase = 'idle';
  tournament.round = 0;
  tournament.participants = [];
  tournament.advancing = [];
  tournament.activeGames.clear();
  tournament.size = 0;
  tournament.countdown = 0;
  io.emit('tournament_reset');
  sysChat('🔄 Turnier beendet. Neues Turnier kann beginnen!');
}

// ─── Spiel starten ───────────────────────────────────────────────────────────
function startGame(id1, id2, roomCode) {
  const gameId = roomCode || makeGameId();

  games[gameId] = {
    board:    Array(9).fill(''),
    players:  { X: id1, O: id2 },
    turn:     'X',
    over:     false,
    scores:   { X: 0, O: 0 },
    mode:     roomCode ? 'room' : 'tournament',
    roomCode
  };

  players[id1].game   = gameId;
  players[id1].symbol = 'X';
  players[id2].game   = gameId;
  players[id2].symbol = 'O';

  const payload = (sym) => ({
    gameId,
    mySymbol: sym,
    mode:     roomCode ? 'room' : 'tournament',
    roomCode: roomCode || null,
    players: {
      X: { name: players[id1].name, wins: players[id1].wins },
      O: { name: players[id2].name, wins: players[id2].wins }
    },
    board:  Array(9).fill(''),
    turn:   'X',
    scores: { X: 0, O: 0 }
  });

  io.to(id1).emit('game_start', payload('X'));
  io.to(id2).emit('game_start', payload('O'));

  sysChat(`⚔️ ${players[id1].name} gegen ${players[id2].name}`);
  broadcastStats();
  return gameId;
}

// ─── Spiel beenden ───────────────────────────────────────────────────────────
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

  // Ergebnis an beide Spieler senden
  [game.players.X, game.players.O].forEach(id => {
    if (!players[id]) return;
    io.to(id).emit('game_over', {
      board:         game.board,
      winner:        isDraw ? null : winnerSym,
      winnerName:    isDraw ? null : players[winnerId]?.name,
      winning_cells: winCells || [],
      is_draw:       isDraw,
      scores:        game.scores,
      updatedPlayers,
      iWon:          !isDraw && id === winnerId,
      mode:          game.mode
    });
  });

  // Chat-Nachricht
  if (!isDraw && winnerId) {
    const wn = players[winnerId]?.name || '?';
    const ln = players[loserId]?.name  || '?';
    sysChat(`🏅 ${wn} besiegte ${ln}! (${players[winnerId]?.wins} Siege)`);
  } else if (isDraw) {
    const xn = players[game.players.X]?.name || '?';
    const on = players[game.players.O]?.name || '?';
    sysChat(`🤝 Unentschieden zwischen ${xn} und ${on}`);
  }

  // Weiterleitung nach dem Spiel
  const DELAY = 4000;
  const pX = game.players.X;
  const pO = game.players.O;

  if (game.mode === 'room' && game.roomCode && rooms[game.roomCode]) {
    // Privater Raum: Spieler wählen ob sie Revanche wollen
    setTimeout(() => {
      [pX, pO].forEach(id => {
        if (!players[id]) return;
        players[id].game   = null;
        players[id].symbol = null;
      });
      if (rooms[game.roomCode]) {
        rooms[game.roomCode].gameId      = null;
        rooms[game.roomCode].rematchVotes = {};
      }
      delete games[gameId];
      broadcastStats();
    }, DELAY);

  } else {
    // Turnier-Bracket
    const isTournamentGame = tournament.activeGames.has(gameId);
    delete games[gameId];
    [pX, pO].forEach(id => {
      if (!players[id]) return;
      players[id].game   = null;
      players[id].symbol = null;
    });

    if (isTournamentGame) {
      tournament.activeGames.delete(gameId);
      if (isDraw) {
        setTimeout(() => {
          if (players[pX] && players[pO] && !players[pX].game && !players[pO].game) {
            const gid = startGame(pX, pO, null);
            tournament.activeGames.add(gid);
            broadcastTournamentState();
          } else {
            const survivor = players[pX] ? pX : (players[pO] ? pO : null);
            if (survivor) tournament.advancing.push(survivor);
            broadcastTournamentState();
            if (tournament.activeGames.size === 0) checkRoundComplete();
          }
        }, 3000);
      } else {
        if (winnerId && players[winnerId]) {
          tournament.advancing.push(winnerId);
          io.to(winnerId).emit('tournament_waiting', {
            round: tournament.round,
            remaining: tournament.activeGames.size,
            totalRounds: Math.ceil(Math.log2(Math.max(tournament.size, 2)))
          });
        }
        if (loserId && players[loserId]) {
          io.to(loserId).emit('eliminated', {
            losses: players[loserId]?.losses || 0,
            round: tournament.round
          });
        }
        broadcastTournamentState();
        if (tournament.activeGames.size === 0) checkRoundComplete();
      }
    }
    broadcastStats();
  }
}

// ─── Socket-Events ───────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.emit('chat_history', chat.slice(-30).filter(m => m.type !== 'image'));
  broadcastStats();

  // ── Beitreten ──
  socket.on('join', ({ name }) => {
    if (players[socket.id]) return;
    const n = (name || '').trim().slice(0, 20) || `Spieler${Math.floor(Math.random() * 9999)}`;
    players[socket.id] = { name: n, wins: 0, losses: 0, game: null, symbol: null, roomCode: null };
    socket.emit('joined', { name: n });
    sysChat(`👋 ${n} ist dem Turnier beigetreten`);
    broadcastStats();
  });

  // ── Turnier-Warteschlange ──
  socket.on('join_queue', () => {
    const p = players[socket.id];
    if (!p || p.game || queue.includes(socket.id)) return;
    if (tournament.phase === 'playing') {
      socket.emit('tournament_in_progress', { round: tournament.round, total: tournament.size });
      return;
    }
    queue.push(socket.id);
    socket.emit('queue_joined', { position: queue.length });
    broadcastStats();
    if (tournament.phase === 'idle' && queue.length >= 2) {
      startLobbyCountdown();
    } else if (tournament.phase === 'lobby') {
      io.emit('tournament_countdown', { seconds: tournament.countdown, count: queue.length });
    }
  });

  socket.on('leave_queue', () => {
    const i = queue.indexOf(socket.id);
    if (i !== -1) queue.splice(i, 1);
    if (tournament.phase === 'lobby') {
      io.emit('tournament_countdown', { seconds: tournament.countdown, count: queue.length });
    }
    broadcastStats();
  });

  // ── Privater Raum: erstellen ──
  socket.on('create_room', () => {
    const p = players[socket.id];
    if (!p || p.game) return;
    const code = makeCode();
    rooms[code] = { players: [socket.id], gameId: null };
    p.roomCode = code;
    socket.emit('room_created', { code });
    broadcastStats();
  });

  // ── Privater Raum: beitreten ──
  socket.on('join_room', ({ code }) => {
    const p    = players[socket.id];
    if (!p || p.game) return;
    const key  = code?.toUpperCase().trim();
    const room = rooms[key];
    if (!room)                             { socket.emit('room_error', { msg: 'Raum nicht gefunden ❌' }); return; }
    if (room.players.length >= 2)          { socket.emit('room_error', { msg: 'Raum ist voll 🚫' }); return; }
    if (room.players.includes(socket.id))  { socket.emit('room_error', { msg: 'Du bist bereits in diesem Raum' }); return; }
    room.players.push(socket.id);
    p.roomCode = key;
    startGame(room.players[0], room.players[1], key);
  });

  // ── Revanche-Abstimmung ──
  socket.on('rematch_vote', ({ roomCode, vote }) => {
    const room = rooms[roomCode];
    const p    = players[socket.id];
    if (!room || !p || p.game) return;

    if (!room.rematchVotes) room.rematchVotes = {};

    if (vote === 'leave') {
      room.players = room.players.filter(id => id !== socket.id);
      p.roomCode   = null;
      delete room.rematchVotes[socket.id];
      const otherId = room.players[0];
      if (otherId && players[otherId]) io.to(otherId).emit('partner_left');
      if (room.players.length === 0) delete rooms[roomCode];
      return;
    }

    // vote === 'rematch'
    room.rematchVotes[socket.id] = true;
    const [id1, id2] = room.players;
    const v1 = !!room.rematchVotes[id1];
    const v2 = !!room.rematchVotes[id2];

    if (id1 && players[id1]) io.to(id1).emit('rematch_vote_status', { myVote: v1, opponentVote: v2 });
    if (id2 && players[id2]) io.to(id2).emit('rematch_vote_status', { myVote: v2, opponentVote: v1 });

    if (v1 && v2 && players[id1] && players[id2]) {
      room.rematchVotes = {};
      startGame(id1, id2, roomCode);
    }
  });

  // ── Spielzug ──
  socket.on('move', ({ gameId, cell }) => {
    const game = games[gameId];
    const p    = players[socket.id];
    if (!game || game.over || !p)                           return;
    if (p.game !== gameId || game.turn !== p.symbol)        return;
    if (typeof cell !== 'number' || cell < 0 || cell > 8)  return;
    if (game.board[cell] !== '')                            return;

    game.board[cell] = p.symbol;

    const result = checkWinner(game.board);
    if (result) {
      handleGameOver(gameId, socket.id, p.symbol, result.cells, false);
      return;
    }
    if (!game.board.includes('')) {
      handleGameOver(gameId, null, null, [], true);
      return;
    }

    game.turn = game.turn === 'X' ? 'O' : 'X';
    io.to(game.players.X).to(game.players.O).emit('game_update', {
      board: game.board,
      turn:  game.turn
    });
  });

  // ── Chat Bild ──
  socket.on('chat_image', ({ data }) => {
    const p = players[socket.id];
    if (!p) return;
    if (!data || !data.startsWith('data:image/')) return;
    if (data.length > 180000) return;
    const msg = { type: 'image', id: socket.id, name: p.name, data, time: Date.now() };
    chat.push(msg);
    if (chat.length > 100) chat.shift();
    io.emit('chat', msg);
  });

  // ── Chat ──
  socket.on('chat', ({ text }) => {
    const p = players[socket.id];
    if (!p || !text?.trim()) return;
    const msg = {
      type: 'user',
      id:   socket.id,
      name: p.name,
      text: text.trim().slice(0, 200),
      time: Date.now()
    };
    chat.push(msg);
    if (chat.length > 100) chat.shift();
    io.emit('chat', msg);
  });

  // ── Turnier neu beitreten ──
  socket.on('rejoin_queue', () => {
    const p = players[socket.id];
    if (!p || p.game || queue.includes(socket.id)) return;
    if (tournament.phase === 'playing') {
      socket.emit('tournament_in_progress', { round: tournament.round, total: tournament.size });
      return;
    }
    p.game   = null;
    p.symbol = null;
    queue.push(socket.id);
    socket.emit('queue_joined', { position: queue.length });
    broadcastStats();
    if (tournament.phase === 'idle' && queue.length >= 2) {
      startLobbyCountdown();
    } else if (tournament.phase === 'lobby') {
      io.emit('tournament_countdown', { seconds: tournament.countdown, count: queue.length });
    }
  });

  // ── Verbindung getrennt ──
  socket.on('disconnect', () => {
    const p = players[socket.id];
    if (!p) return;

    // Laufendes Spiel beenden
    if (p.game && games[p.game]) {
      const game   = games[p.game];
      const oppSym = p.symbol === 'X' ? 'O' : 'X';
      const oppId  = game.players[oppSym];
      if (oppId && players[oppId]) {
        io.to(oppId).emit('opponent_left');
        handleGameOver(p.game, oppId, oppSym, [], false);
      } else {
        delete games[p.game];
      }
    }

    // Privaten Raum aufräumen
    if (p.roomCode && rooms[p.roomCode]) {
      const room = rooms[p.roomCode];
      room.players = room.players.filter(id => id !== socket.id);
      if (room.players.length === 0) delete rooms[p.roomCode];
      else io.to(room.players[0]).emit('partner_left');
    }

    // Aus Warteschlange entfernen
    const qi = queue.indexOf(socket.id);
    if (qi !== -1) queue.splice(qi, 1);

    // Aus Turnier entfernen
    const ai = tournament.advancing.indexOf(socket.id);
    if (ai !== -1) {
      tournament.advancing.splice(ai, 1);
      if (tournament.phase === 'playing' && tournament.activeGames.size === 0) {
        setTimeout(() => checkRoundComplete(), 500);
      }
    }
    const pi = tournament.participants.indexOf(socket.id);
    if (pi !== -1) tournament.participants.splice(pi, 1);
    if (tournament.phase === 'lobby') {
      io.emit('tournament_countdown', { seconds: tournament.countdown, count: queue.length });
    }

    sysChat(`👋 ${p.name} hat das Turnier verlassen`);
    delete players[socket.id];
    broadcastStats();
  });
});

// ─── Server starten ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Server läuft auf Port ${PORT}`);
});
