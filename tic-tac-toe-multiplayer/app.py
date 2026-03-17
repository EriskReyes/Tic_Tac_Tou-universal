from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, leave_room, emit
import uuid

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# Game state storage
games = {}  # room_id -> {'board': [...], 'players': [sid1, sid2], 'turn': sid1, 'symbols': {sid1: 'X', sid2: 'O'}}

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('join')
def handle_join(data):
    username = data.get('username', 'Anonymous')
    # Find a room with one player waiting, or create new
    target_room = None
    for room_id, game in games.items():
        if len(game['players']) == 1:
            target_room = room_id
            break
    if target_room is None:
        target_room = str(uuid.uuid4())
        games[target_room] = {
            'board': [''] * 9,
            'players': [],
            'turn': None,
            'symbols': {}
        }
    game = games[target_room]
    sid = request.sid
    join_room(target_room)
    game['players'].append(sid)
    # Assign symbol
    symbol = 'X' if len(game['players']) == 1 else 'O'
    game['symbols'][sid] = symbol
    # If second player joined, start game
    if len(game['players']) == 2:
        game['turn'] = game['players'][0]  # X starts
        emit('game_start', {
            'room': target_room,
            'board': game['board'],
            'turn': game['turn'],
            'your_symbol': game['symbols'][sid],
            'opponent_username': username if len(game['players']) == 2 else ''
        }, room=target_room)
    else:
        # Waiting for opponent
        emit('waiting', {'room': target_room, 'your_symbol': symbol}, room=sid)

@socketio.on('make_move')
def handle_move(data):
    room = data['room']
    cell = data['cell']
    sid = request.sid
    if room not in games:
        return
    game = games[room]
    if sid != game['turn']:
        emit('error', {'msg': 'No es tu turno'}, room=sid)
        return
    if game['board'][cell] != '':
        emit('error', {'msg': 'Celda ocupada'}, room=sid)
        return
    # Apply move
    symbol = game['symbols'][sid]
    game['board'][cell] = symbol
    # Check win/draw
    winner = check_winner(game['board'])
    if winner:
        emit('game_over', {'winner': winner, 'board': game['board']}, room=room)
        # Clean up game after a delay? keep for replay optional
        # For simplicity, delete game
        del games[room]
        return
    if '' not in game['board']:
        emit('game_over', {'winner': None, 'board': game['board']}, room=room)
        del games[room]
        return
    # Switch turn
    other_sid = game['players'][0] if game['players'][1] == sid else game['players'][1]
    game['turn'] = other_sid
    emit('move_made', {
        'cell': cell,
        'symbol': symbol,
        'board': game['board'],
        'turn': game['turn']
    }, room=room)

def check_winner(board):
    lines = [
        (0,1,2),(3,4,5),(6,7,8),  # rows
        (0,3,6),(1,4,7),(2,5,8),  # cols
        (0,4,8),(2,4,6)           # diagonals
    ]
    for a,b,c in lines:
        if board[a] == board[b] == board[c] and board[a] != '':
            return board[a]
    return None

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    for room_id, game in list(games.items()):
        if sid in game['players']:
            # Notify opponent
            opponent = [p for p in game['players'] if p != sid]
            if opponent:
                emit('opponent_left', {}, room=opponent[0])
            # Clean up
            del games[room_id]
            break

if __name__ == '__main__':
    socketio.run(app, debug=True, allow_unsafe_werkzeug=True)