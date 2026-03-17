let gameState = {
    playerId: null,
    room: null,
    symbol: null,
    gameStarted: false,
    pollingInterval: null
};

function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenName).classList.add('active');
}

async function joinGame() {
    const username = document.getElementById('usernameInput').value.trim();

    if (!username) {
        alert('Por favor ingresa tu nombre');
        return;
    }

    try {
        const response = await fetch('/api/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username })
        });

        const data = await response.json();

        gameState.playerId = data.player_id;
        gameState.room = data.room;
        gameState.symbol = data.symbol;

        if (data.game_started) {
            gameState.gameStarted = true;
            showScreen('gameScreen');
            startPolling();
        } else {
            showScreen('waitingScreen');
            document.getElementById('yourSymbol').textContent = data.symbol;
            document.getElementById('roomCode').innerHTML = `Sala: <code>${data.room.substring(0, 8)}...</code>`;
            startWaitingPolling();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al unirse al juego');
    }
}

function startWaitingPolling() {
    gameState.pollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/game/${gameState.room}/state`);
            const data = await response.json();

            if (data.game_active) {
                gameState.gameStarted = true;
                clearInterval(gameState.pollingInterval);
                showScreen('gameScreen');
                startPolling();
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 1000);
}

function startPolling() {
    updateGameUI();
    gameState.pollingInterval = setInterval(updateGameUI, 500);
}

async function updateGameUI() {
    try {
        const response = await fetch(`/api/game/${gameState.room}/state`);
        const data = await response.json();

        renderBoard(data.board);
        updateTurnInfo(data);
        updateOpponentInfo(data);

        if (data.winner) {
            clearInterval(gameState.pollingInterval);
            const isWinner = data.winner === gameState.symbol;
            document.getElementById('gameStatus').textContent = isWinner ? '¡Ganaste!' : '¡Perdiste!';
            document.getElementById('gameStatus').style.color = isWinner ? '#3B6D11' : '#a32d2d';
        } else if (data.is_draw) {
            clearInterval(gameState.pollingInterval);
            document.getElementById('gameStatus').textContent = '¡Empate!';
            document.getElementById('gameStatus').style.color = '#666';
        }
    } catch (error) {
        console.error('Error updating game:', error);
    }
}

function renderBoard(board) {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';

    board.forEach((cell, index) => {
        const cellBtn = document.createElement('button');
        cellBtn.className = 'cell';
        cellBtn.textContent = cell;

        if (cell !== '') {
            cellBtn.classList.add(cell.toLowerCase());
            cellBtn.disabled = true;
        } else {
            cellBtn.onclick = () => makeMove(index);
        }

        boardEl.appendChild(cellBtn);
    });
}

async function makeMove(cellIndex) {
    try {
        const response = await fetch(`/api/game/${gameState.room}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player_id: gameState.playerId,
                cell: cellIndex
            })
        });

        const data = await response.json();

        if (!data.success) {
            alert('Error: ' + data.error);
            return;
        }

        updateGameUI();
    } catch (error) {
        console.error('Error making move:', error);
        alert('Error al hacer el movimiento');
    }
}

function updateTurnInfo(data) {
    const players = data.players;
    const currentPlayer = Object.values(players).find(p => p.symbol === data.turn);

    document.getElementById('currentTurn').textContent =
        currentPlayer ? `${currentPlayer.username} (${currentPlayer.symbol})` : '-';
    document.getElementById('playerSymbol').textContent = gameState.symbol;
}

function updateOpponentInfo(data) {
    const players = data.players;
    const opponentSymbol = gameState.symbol === 'X' ? 'O' : 'X';
    const opponent = Object.values(players).find(p => p.symbol === opponentSymbol);

    const opponentInfo = document.getElementById('opponentInfo');
    if (opponent) {
        opponentInfo.innerHTML = `<p>Oponente: <strong>${opponent.username}</strong></p>`;
    }
}

async function resetGame() {
    try {
        await fetch(`/api/game/${gameState.room}/reset`, { method: 'POST' });
        clearInterval(gameState.pollingInterval);
        startPolling();
    } catch (error) {
        console.error('Error resetting game:', error);
    }
}

function goBack() {
    clearInterval(gameState.pollingInterval);
    gameState = {
        playerId: null,
        room: null,
        symbol: null,
        gameStarted: false,
        pollingInterval: null
    };
    document.getElementById('usernameInput').value = '';
    showScreen('joinScreen');
}