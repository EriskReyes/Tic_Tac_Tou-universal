from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import uuid
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = 'your-secret-key-here'

games = {}


class GameState:
    def __init__(self):
        self.board = [''] * 9
        self.players = {}
        self.turn = None
        self.winner = None
        self.is_draw = False
        self.created_at = datetime.now()
        self.last_activity = datetime.now()


def check_winner(board):
    lines = [
        (0, 1, 2), (3, 4, 5), (6, 7, 8),
        (0, 3, 6), (1, 4, 7), (2, 5, 8),
        (0, 4, 8), (2, 4, 6)
    ]
    for a, b, c in lines:
        if board[a] == board[b] == board[c] and board[a] != '':
            return board[a]
    return None


def clean_old_games():
    current_time = datetime.now()
    expired_rooms = [
        room_id for room_id, game in games.items()
        if (current_time - game.last_activity) > timedelta(minutes=30)
    ]
    for room_id in expired_rooms:
        del games[room_id]


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/join', methods=['POST'])
def join_game():
    data = request.json
    username = data.get('username', 'Anonymous')
    player_id = str(uuid.uuid4())

    clean_old_games()

    target_room = None
    for room_id, game in games.items():
        if len(game.players) == 1 and not game.winner and not game.is_draw:
            target_room = room_id
            break

    if target_room is None:
        target_room = str(uuid.uuid4())
        games[target_room] = GameState()

    game = games[target_room]
    symbol = 'X' if len(game.players) == 0 else 'O'
    game.players[player_id] = {
        'username': username,
        'symbol': symbol
    }
    game.last_activity = datetime.now()

    response = {
        'player_id': player_id,
        'room': target_room,
        'symbol': symbol,
        'board': game.board,
        'game_started': len(game.players) == 2,
        'turn': None
    }

    if len(game.players) == 2:
        game.turn = list(game.players.keys())[0]
        response['turn'] = game.turn

    return jsonify(response)


@app.route('/api/game/<room>/state', methods=['GET'])
def get_game_state(room):
    if room not in games:
        return jsonify({'error': 'Game not found'}), 404

    game = games[room]
    game.last_activity = datetime.now()

    return jsonify({
        'board': game.board,
        'players': {pid: {'username': p['username'], 'symbol': p['symbol']}
                    for pid, p in game.players.items()},
        'turn': game.turn,
        'winner': game.winner,
        'is_draw': game.is_draw,
        'game_active': len(game.players) == 2 and not game.winner and not game.is_draw
    })


@app.route('/api/game/<room>/move', methods=['POST'])
def make_move(room):
    if room not in games:
        return jsonify({'error': 'Game not found'}), 404

    data = request.json
    player_id = data.get('player_id')
    cell = data.get('cell')

    game = games[room]
    game.last_activity = datetime.now()

    if player_id not in game.players:
        return jsonify({'error': 'Player not found'}), 400

    if game.turn != player_id:
        return jsonify({'error': 'Not your turn'}), 400

    if game.board[cell] != '':
        return jsonify({'error': 'Cell already occupied'}), 400

    if not (0 <= cell <= 8):
        return jsonify({'error': 'Invalid cell'}), 400

    symbol = game.players[player_id]['symbol']
    game.board[cell] = symbol

    winner = check_winner(game.board)
    if winner:
        game.winner = winner
        return jsonify({
            'success': True,
            'board': game.board,
            'winner': winner,
            'game_over': True
        })

    if '' not in game.board:
        game.is_draw = True
        return jsonify({
            'success': True,
            'board': game.board,
            'is_draw': True,
            'game_over': True
        })

    player_list = list(game.players.keys())
    current_idx = player_list.index(player_id)
    game.turn = player_list[1 - current_idx]

    return jsonify({
        'success': True,
        'board': game.board,
        'turn': game.turn,
        'game_over': False
    })


@app.route('/api/game/<room>/reset', methods=['POST'])
def reset_game(room):
    if room not in games:
        return jsonify({'error': 'Game not found'}), 404

    game = games[room]
    game.board = [''] * 9
    game.winner = None
    game.is_draw = False
    game.turn = list(game.players.keys())[0] if game.players else None
    game.last_activity = datetime.now()

    return jsonify({'success': True})


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

//
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)