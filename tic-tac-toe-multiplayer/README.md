# Tic Tac Toe Multiplayer

A real-time multiplayer Tic Tac Toe game built with Flask and SocketIO.

## Features

- Real-time gameplay using WebSockets
- Multiple simultaneous games
- Automatic player matching
- Responsive design

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running Locally

```bash
python app.py
```

Then open your browser to `http://localhost:5000`

## Deployment to Vercel

**Important Note**: Vercel's support for WebSockets (required for real-time features) is currently in beta and has limitations. For production use, consider:

1. Using a different platform that fully supports WebSockets (like Render, Railway, or Heroku)
2. If you must use Vercel, you'll need to:
   - Enable WebSocket support in your Vercel project settings (beta feature)
   - Use the `@vercel/node` runtime for SocketIO (this example uses Python)
   - Consider adapting the app to use Vercel's WebSocket beta with a Node.js server

For a quick test on Vercel with limited functionality, you could modify the app to use polling instead of WebSockets, but this is not recommended for real-time games.

## How It Works

1. Players join the game and are automatically paired
2. First player gets 'X', second gets 'O'
3. Players take turns clicking on the board
4. Game detects wins, losses, and draws
5. If a player disconnects, the game ends for the opponent

## Files

- `app.py`: Main Flask/SocketIO application
- `templates/index.html`: Game interface
- `requirements.txt`: Python dependencies

## License

MIT