// Cambia esta URL por la de Railway después de hacer deploy
const socket = io();
// ─── State ───────────────────────────────────────────────────────────────────
let myId       = null;
let mySymbol   = null;
let myGameId   = null;
let myRoomCode = null;
let myMode     = null;
let gameOver   = false;
let currentPlayers = { X: { name: '-', wins: 0 }, O: { name: '-', wins: 0 } };

// ─── Socket: Server → Client ─────────────────────────────────────────────────
socket.on('connect', () => { myId = socket.id; });

socket.on('stats', ({ online, inQueue, activeGames }) => {
  q('#onlineBadge').textContent = `${online} Spieler online`;
  q('#chatOnline').textContent  = `${online} online`;
  q('#statsRow').innerHTML =
    `<span>👥 ${online} online</span><span>⚔️ ${activeGames} Spiele</span><span>⏳ ${inQueue} in Warteschlange</span>`;
});

socket.on('joined', () => {
  q('#joinScreen').classList.add('hidden');
  q('#app').classList.remove('hidden');
  showView('home');
});

socket.on('queue_joined', ({ position }) => {
  showView('lobby');
  q('#lobbyText').textContent = `Suche Gegner... (Position ${position} in der Warteschlange)`;
  q('#lobbyCode').classList.add('hidden');
});

socket.on('room_created', ({ code }) => {
  myRoomCode = code;
  showView('lobby');
  q('#lobbyText').textContent = 'Raum erstellt. Warte auf deinen Freund...';
  const el = q('#lobbyCode');
  el.textContent = `Raumcode: ${code}`;
  el.classList.remove('hidden');
});

socket.on('room_error', ({ msg }) => {
  const el = q('#roomError');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
});

socket.on('game_start', ({ gameId, mySymbol: sym, players, board, turn, scores, mode, roomCode }) => {
  mySymbol = sym; myGameId = gameId; myMode = mode; myRoomCode = roomCode;
  gameOver = false; currentPlayers = players;

  q('#xName').textContent    = players.X.name;
  q('#oName').textContent    = players.O.name;
  q('#xWinsTag').textContent = `${players.X.wins} Siege`;
  q('#oWinsTag').textContent = `${players.O.wins} Siege`;
  updateScores(scores);
  renderBoard(board, [], false);
  updateTurnStatus(turn);
  q('#rematchBar').classList.add('hidden');
  showView('game');
});

socket.on('game_update', ({ board, turn }) => {
  renderBoard(board, [], false);
  updateTurnStatus(turn);
});

socket.on('game_over', ({ board, winner, winnerName, winning_cells, is_draw, scores, updatedPlayers, iWon, mode }) => {
  gameOver = true;
  currentPlayers = updatedPlayers;
  updateScores(scores);
  renderBoard(board, winning_cells, true);
  q('#xWinsTag').textContent = `${updatedPlayers.X.wins} Siege`;
  q('#oWinsTag').textContent = `${updatedPlayers.O.wins} Siege`;

  if (is_draw)   setStatus('Unentschieden! 🤝', 'draw');
  else if (iWon) setStatus('Du hast gewonnen! 🎉', 'win');
  else           setStatus(`${winnerName} hat gewonnen`, 'lose');

  if (mode === 'room') q('#rematchBar').classList.remove('hidden');
});

socket.on('back_to_queue', ({ wins }) => {
  gameOver = false; myGameId = null;
  showView('lobby');
  q('#lobbyText').textContent = wins > 0
    ? `${wins} Siege — suche nächsten Gegner...`
    : 'Suche Gegner...';
  q('#lobbyCode').classList.add('hidden');
});

socket.on('room_waiting', ({ roomCode }) => {
  gameOver = false; myGameId = null;
  showView('lobby');
  q('#lobbyText').textContent = 'Warte auf Revanche...';
  const el = q('#lobbyCode');
  el.textContent = `Raumcode: ${roomCode}`;
  el.classList.remove('hidden');
  q('#rematchBar').classList.remove('hidden');
});

socket.on('eliminated', ({ losses }) => {
  gameOver = false; myGameId = null;
  q('#elimMsg').textContent = `${losses} Niederlage${losses !== 1 ? 'n' : ''} · Du kannst zurück ins Turnier`;
  showView('eliminated');
});

socket.on('opponent_left',    () => setStatus('Dein Gegner hat das Spiel verlassen', 'win'));
socket.on('partner_left',     () => { myRoomCode = null; showView('home'); });
socket.on('champion',         ({ name, wins }) => showTrophy(name, wins));
socket.on('tournament_reset', () => {
  addChat({ type: 'system', text: '🔄 Neues Turnier · Siege zurückgesetzt', time: Date.now() });
});
socket.on('chat_history', (msgs) => msgs.forEach(addChat));
socket.on('chat',          (msg)  => addChat(msg));

// ─── UI Helpers ──────────────────────────────────────────────────────────────
const q = (sel) => document.querySelector(sel);

function showView(name) {
  ['home', 'lobby', 'game', 'eliminated'].forEach(v =>
    q(`#${v}View`).classList.add('hidden')
  );
  q(`#${name}View`).classList.remove('hidden');
}

function setStatus(text, type = '') {
  const el = q('#gameStatus');
  el.className = 'status-banner' + (type ? ' ' + type : '');
  el.textContent = text;
}

function updateScores(s) {
  q('#scoreX').textContent = s.X || 0;
  q('#scoreO').textContent = s.O || 0;
}

function updateTurnStatus(turn) {
  if (turn === mySymbol) {
    setStatus('Du bist dran ✨', 'your-turn');
  } else {
    const name = turn === 'X' ? currentPlayers.X.name : currentPlayers.O.name;
    setStatus(`${name} ist dran`, 'opponent-turn');
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────────
function joinServer() {
  const name = q('#nameInput').value.trim();
  if (!name) { q('#nameInput').focus(); return; }
  socket.emit('join', { name });
}

function joinTournament() { socket.emit('join_queue'); }
function createRoom()     { socket.emit('create_room'); }

function joinRoomByCode() {
  const code = q('#roomCodeInput').value.trim().toUpperCase();
  if (!code) return;
  socket.emit('join_room', { code });
}

function cancelLobby() {
  socket.emit('leave_queue');
  myRoomCode = null;
  showView('home');
}

function requestRematch() {
  if (myRoomCode) socket.emit('rematch', { roomCode: myRoomCode });
}

function rejoinQueue() {
  socket.emit('rejoin_queue');
  showView('lobby');
  q('#lobbyText').textContent = 'Kehre zum Turnier zurück...';
  q('#lobbyCode').classList.add('hidden');
}

function goHome() {
  socket.emit('leave_queue');
  myGameId = null; mySymbol = null; myMode = null; gameOver = false;
  showView('home');
}

function makeMove(cell) {
  if (!myGameId || gameOver) return;
  socket.emit('move', { gameId: myGameId, cell });
}

function sendChat() {
  const input = q('#chatInput');
  const text = input.value.trim();
  if (!text) return;
  socket.emit('chat', { text });
  input.value = '';
}

// ─── Board ───────────────────────────────────────────────────────────────────
function renderBoard(board, winCells, isOver) {
  const el = q('#board');
  el.innerHTML = '';
  board.forEach((cell, i) => {
    const btn = document.createElement('button');
    btn.className = 'cell';
    if (cell) {
      btn.classList.add(cell.toLowerCase());
      btn.textContent = cell;
      btn.disabled = true;
    } else if (!isOver) {
      btn.onclick = () => makeMove(i);
    } else {
      btn.disabled = true;
    }
    if (winCells.includes(i)) btn.classList.add('winning');
    el.appendChild(btn);
  });
}

// ─── Chat ────────────────────────────────────────────────────────────────────
function addChat(msg) {
  const container = q('#chatMessages');
  const wrap = document.createElement('div');

  if (msg.type === 'system') {
    wrap.className = 'chat-system';
    wrap.textContent = msg.text;
  } else {
    const isMe = msg.id === myId;
    wrap.className = 'chat-row ' + (isMe ? 'chat-me' : 'chat-other');
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.innerHTML = `
      ${!isMe ? `<span class="chat-sender">${esc(msg.name)}</span>` : ''}
      <p class="chat-text">${esc(msg.text)}</p>
      <span class="chat-time">${fmt(msg.time)}</span>`;
    wrap.appendChild(bubble);
  }

  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function fmt(ts) {
  const d = new Date(ts);
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

// ─── Trophy ──────────────────────────────────────────────────────────────────
function showTrophy(name, wins) {
  q('#trophyName').textContent = name;
  q('#trophyWins').textContent = `${wins} Siege im Turnier`;
  q('#trophyOverlay').classList.remove('hidden');
  spawnConfetti();
  setTimeout(() => q('#trophyOverlay').classList.add('hidden'), 14000);
}

function spawnConfetti() {
  const c = q('#confetti');
  c.innerHTML = '';
  const colors = ['#f7d94c','#e74c3c','#3498db','#2ecc71','#9b59b6','#e67e22','#1abc9c','#e91e63','#fff'];
  for (let i = 0; i < 120; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.cssText = `
      left:${Math.random() * 100}%;
      background:${colors[i % colors.length]};
      animation-delay:${Math.random() * 4}s;
      animation-duration:${2 + Math.random() * 3}s;
      width:${5 + Math.random() * 8}px;
      height:${5 + Math.random() * 8}px;
      border-radius:${Math.random() > .5 ? '50%' : '2px'}`;
    c.appendChild(p);
  }
}

// ─── Keyboard ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  q('#nameInput').addEventListener('keydown',     e => { if (e.key === 'Enter') joinServer(); });
  q('#chatInput').addEventListener('keydown',     e => { if (e.key === 'Enter') sendChat(); });
  q('#roomCodeInput').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoomByCode(); });
  q('#roomCodeInput').addEventListener('input',   e => { e.target.value = e.target.value.toUpperCase(); });
});
