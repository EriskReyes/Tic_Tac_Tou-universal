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
  q('#bracketPanel').classList.add('hidden');
  q('#bracketAdvancing').classList.add('hidden');
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
  resetRematchButtons();
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

  if (is_draw) {
    setStatus('Unentschieden! 🤝', 'draw');
    triggerGameAnimation('draw');
  } else if (iWon) {
    setStatus('Du hast gewonnen! 🎉', 'win');
    triggerGameAnimation('win');
  } else {
    setStatus(`${winnerName} hat gewonnen`, 'lose');
    triggerGameAnimation('lose');
  }

  if (mode === 'room') {
    resetRematchButtons();
    q('#rematchBar').classList.remove('hidden');
    q('#rematchBtn').textContent = 'Revanche ↺';
  }
  // Tournament: tournament_waiting or eliminated event handles next step
});

socket.on('back_to_queue', ({ wins }) => {
  gameOver = false; myGameId = null;
  showView('lobby');
  q('#lobbyText').textContent = wins > 0
    ? `${wins} Siege — suche nächsten Gegner...`
    : 'Suche Gegner...';
  q('#lobbyCode').classList.add('hidden');
});

socket.on('rematch_vote_status', ({ myVote, opponentVote }) => {
  const btn = q('#rematchBtn');
  if (myVote && !opponentVote) {
    setStatus('Warte auf die Entscheidung des Gegners... ⏳', 'opponent-turn');
    if (btn) { btn.disabled = true; btn.textContent = 'Warte... ⏳'; }
  } else if (!myVote && opponentVote) {
    setStatus('Dein Gegner will Revanche! Wähle jetzt! 🎮', 'your-turn');
  }
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

socket.on('tournament_countdown', ({ seconds, count }) => {
  if (seconds > 0) {
    q('#lobbyText').textContent = `Turnier startet in ${seconds}s — ${count} Spieler bereit`;
  } else {
    q('#lobbyText').textContent = 'Turnier startet jetzt! 🚀';
  }
  q('#bracketPanel').classList.add('hidden');
  q('#cancelLobbyBtn').classList.remove('hidden');
});

socket.on('tournament_round_start', ({ round, totalRounds, matchups }) => {
  addChat({ type: 'system', text: `⚔️ Runde ${round}/${totalRounds} gestartet — ${matchups.length} Spiele laufen!`, time: Date.now() });
});

socket.on('tournament_waiting', ({ round, remaining, totalRounds }) => {
  showView('lobby');
  q('#lobbyCode').classList.add('hidden');
  q('#cancelLobbyBtn').classList.add('hidden');
  if (remaining > 0) {
    q('#lobbyText').textContent = `Du hast gewonnen! 🏆 Warte auf ${remaining} laufende Spiel${remaining !== 1 ? 'e' : ''}...`;
  } else {
    q('#lobbyText').textContent = `Runde ${round}/${totalRounds} gewonnen! Warte auf nächste Runde... ⏳`;
  }
});

socket.on('tournament_bye', ({ round }) => {
  showView('lobby');
  q('#lobbyText').textContent = `Runde ${round}: Freilos 🎯 Du kommst automatisch weiter!`;
  q('#lobbyCode').classList.add('hidden');
  q('#cancelLobbyBtn').classList.add('hidden');
});

socket.on('tournament_between_rounds', ({ advancing, nextIn }) => {
  q('#lobbyText').textContent = `Alle Spiele fertig! Nächste Runde in ${nextIn}s...`;
  const adv = q('#bracketAdvancing');
  adv.textContent = '✅ Weiter: ' + advancing.join(', ');
  adv.classList.remove('hidden');
});

socket.on('tournament_state', ({ phase, round, totalRounds, activeMatches, advancing }) => {
  const panel = q('#bracketPanel');
  if (phase !== 'playing' || activeMatches.length === 0) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  q('#bracketTitle').textContent = `🔴 Live — Runde ${round}/${totalRounds || '?'}`;
  q('#bracketMatches').innerHTML = activeMatches.map(m => `
    <div class="bracket-match live">
      <span class="bm-name">${esc(m.p1)}</span>
      <span class="bm-vs">vs</span>
      <span class="bm-name">${esc(m.p2)}</span>
      <span class="bm-score">${m.scores.X}:${m.scores.O}</span>
      <span class="bm-live">●</span>
    </div>`).join('');
  if (advancing.length > 0) {
    const adv = q('#bracketAdvancing');
    adv.textContent = '✅ Weiter: ' + advancing.map(n => esc(n)).join(', ');
    adv.classList.remove('hidden');
  }
});

socket.on('tournament_in_progress', ({ round, total }) => {
  showView('lobby');
  q('#lobbyText').textContent = `Turnier läuft (Runde ${round}, ${total} Spieler). Du bist in der Warteschlange für das nächste Turnier.`;
  q('#lobbyCode').classList.add('hidden');
  q('#bracketPanel').classList.add('hidden');
});

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
  if (myMode !== 'room' || !myRoomCode) return;
  socket.emit('rematch_vote', { roomCode: myRoomCode, vote: 'rematch' });
  const btn = q('#rematchBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Warte... ⏳'; }
  q('#leaveBtn').disabled = true;
}

function rejoinQueue() {
  socket.emit('rejoin_queue');
  showView('lobby');
  q('#lobbyText').textContent = 'Warte auf nächstes Turnier...';
  q('#lobbyCode').classList.add('hidden');
  q('#bracketPanel').classList.add('hidden');
  q('#cancelLobbyBtn').classList.remove('hidden');
}

function goHome() {
  if (myMode === 'room' && myRoomCode) {
    socket.emit('rematch_vote', { roomCode: myRoomCode, vote: 'leave' });
  } else {
    socket.emit('leave_queue');
  }
  myGameId = null; mySymbol = null; myMode = null; myRoomCode = null; gameOver = false;
  showView('home');
}

function resetRematchButtons() {
  const btn = q('#rematchBtn');
  const leave = q('#leaveBtn');
  if (btn)   { btn.disabled = false; btn.textContent = 'Revanche ↺'; }
  if (leave) { leave.disabled = false; }
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

    if (!isMe) {
      const sender = document.createElement('span');
      sender.className = 'chat-sender';
      sender.textContent = msg.name;
      bubble.appendChild(sender);
    }

    if (msg.type === 'image') {
      const img = document.createElement('img');
      img.src = msg.data;
      img.className = 'chat-image';
      img.onclick = () => showLightbox(msg.data);
      bubble.appendChild(img);
    } else {
      const p = document.createElement('p');
      p.className = 'chat-text';
      p.textContent = msg.text;
      bubble.appendChild(p);
    }

    const time = document.createElement('span');
    time.className = 'chat-time';
    time.textContent = fmt(msg.time);
    bubble.appendChild(time);

    wrap.appendChild(bubble);
  }

  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}

// ─── Image ───────────────────────────────────────────────────────────────────
function handleImageUpload(input) {
  const file = input.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  if (file.size > 10 * 1024 * 1024) { input.value = ''; return; }

  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('2d');
  const img    = new Image();
  const url    = URL.createObjectURL(file);

  img.onload = () => {
    const MAX = 320;
    let w = img.width, h = img.height;
    if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
    else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
    canvas.width = w; canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const data = canvas.toDataURL('image/jpeg', 0.78);
    if (data.length > 180000) return;
    socket.emit('chat_image', { data });
    input.value = '';
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

function showLightbox(src) {
  const lb  = document.createElement('div');
  lb.className = 'img-lightbox';
  const img = document.createElement('img');
  img.src = src;
  lb.appendChild(img);
  lb.onclick = () => lb.remove();
  document.body.appendChild(lb);
}

// ─── Animaciones ─────────────────────────────────────────────────────────────
function triggerGameAnimation(type) {
  const flash = document.createElement('div');
  flash.className = `anim-flash ${type}`;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 1200);

  if (type === 'win') {
    spawnParticles(['🎉','🎊','✨','⭐','🌟','💫','🔥','🏆','🎯','💥','🥳','🎈'], 24);
  } else if (type === 'lose') {
    const el = q('#gameView');
    el.classList.add('game-shake');
    setTimeout(() => el.classList.remove('game-shake'), 700);
    spawnParticles(['😭','💔','😢','😞','💀','😤','🫠','😵'], 14);
  } else {
    spawnParticles(['🤝','😅','🙃','💜','✨','🌀','🎭','😶'], 14);
  }
}

function spawnParticles(emojis, count) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'game-particle';
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      const x     = 15 + Math.random() * 70;
      const y     = 20 + Math.random() * 55;
      const dx    = ((Math.random() - 0.5) * 55).toFixed(1) + 'vw';
      const dy    = (-(18 + Math.random() * 48)).toFixed(1) + 'vh';
      const dur   = (0.85 + Math.random() * 0.75).toFixed(2) + 's';
      const delay = (i * 0.042).toFixed(2) + 's';
      el.style.cssText = `left:${x}vw;top:${y}vh;--dx:${dx};--dy:${dy};--dur:${dur};--delay:${delay};font-size:${1.1 + Math.random() * 1.3}rem;`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), (parseFloat(dur) + parseFloat(delay) + 0.3) * 1000);
    }, i * 42);
  }
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
