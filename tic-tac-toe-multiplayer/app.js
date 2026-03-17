const state = {
    board: Array(9).fill(''),
    turn: 'X',
    scores: { X: 0, O: 0, draws: 0 },
    names: { X: 'Spieler X', O: 'Spieler O' },
    gameOver: false
};

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function setStatus(text, type = '') {
    const el = document.getElementById('gameStatus');
    el.className = 'status-banner' + (type ? ' ' + type : '');
    el.textContent = text;
}

function startGame() {
    const x = document.getElementById('xNameInput').value.trim() || 'Spieler X';
    const o = document.getElementById('oNameInput').value.trim() || 'Spieler O';
    state.names = { X: x, O: o };
    state.board = Array(9).fill('');
    state.turn = 'X';
    state.gameOver = false;
    document.getElementById('xName').textContent = x;
    document.getElementById('oName').textContent = o;
    updateScoreDisplay();
    renderBoard();
    updateStatus();
    showScreen('gameScreen');
}

function checkWinner(board) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { winner: board[a], cells: [a, b, c] };
        }
    }
    return null;
}

function makeMove(i) {
    if (state.gameOver || state.board[i]) return;
    state.board[i] = state.turn;

    const result = checkWinner(state.board);
    if (result) {
        state.gameOver = true;
        state.scores[result.winner]++;
        updateScoreDisplay();
        renderBoard(result.cells);
        const won = result.winner === 'X';
        setStatus(state.names[result.winner] + ' hat gewonnen! 🎉', won ? 'win' : 'lose');
        return;
    }

    if (!state.board.includes('')) {
        state.gameOver = true;
        state.scores.draws++;
        updateScoreDisplay();
        renderBoard();
        setStatus('Unentschieden!', 'draw');
        return;
    }

    state.turn = state.turn === 'X' ? 'O' : 'X';
    renderBoard();
    updateStatus();
}

function updateStatus() {
    const type = state.turn === 'X' ? 'your-turn' : 'opponent-turn';
    setStatus('Zug von ' + state.names[state.turn], type);
}

function renderBoard(winCells = []) {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';
    state.board.forEach((cell, i) => {
        const btn = document.createElement('button');
        btn.className = 'cell';
        if (cell) {
            btn.classList.add(cell.toLowerCase());
            btn.textContent = cell;
            btn.disabled = true;
        } else if (!state.gameOver) {
            btn.onclick = () => makeMove(i);
        } else {
            btn.disabled = true;
        }
        if (winCells.includes(i)) btn.classList.add('winning');
        boardEl.appendChild(btn);
    });
}

function updateScoreDisplay() {
    document.getElementById('xScore').textContent = state.scores.X;
    document.getElementById('oScore').textContent = state.scores.O;
    document.getElementById('drawsScore').textContent = state.scores.draws;
}

function resetGame() {
    state.board = Array(9).fill('');
    state.turn = 'X';
    state.gameOver = false;
    renderBoard();
    updateStatus();
}

function goBack() {
    state.scores = { X: 0, O: 0, draws: 0 };
    state.board = Array(9).fill('');
    state.gameOver = false;
    document.getElementById('xNameInput').value = '';
    document.getElementById('oNameInput').value = '';
    showScreen('joinScreen');
}
