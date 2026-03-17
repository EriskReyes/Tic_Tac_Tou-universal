# Tic Tac Toe Multiplayer

Ein Echtzeit-Mehrspieler-Tic-Tac-Toe-Spiel, erstellt mit Flask und SocketIO.

## Features

- Echtzeit-Gameplay mittels WebSockets
- Mehrere gleichzeitig laufende Spiele
- Automatische Spieler-Zuordnung
- Responsives Design

## Installation

1. Repository klonen
2. Abhängigkeiten installieren:
    ```bash
    pip install -r requirements.txt
    ```

## Lokal ausführen

```bash
python app.py
```

Öffnen Sie dann Ihren Browser unter `http://localhost:5000`

## Bereitstellung auf Vercel

**Wichtiger Hinweis**: Die Unterstützung für WebSockets (erforderlich für Echtzeitfunktionen) bei Vercel befindet sich derzeit in der Beta-Phase und hat Einschränkungen. Für den Produktivbetrieb sollten Sie in Betracht ziehen:

1. Eine andere Plattform zu verwenden, die vollständige WebSocket-Unterstützung bietet (wie Render, Railway oder Heroku)
2. Wenn Sie Vercel unbedingt verwenden müssen, müssen Sie Folgendes tun:
   - WebSocket-Unterstützung in den Einstellungen Ihres Vercel-Projekts aktivieren (Beta-Funktion)
   - Den `@vercel/node` Runtime für SocketIO verwenden (dieses Beispiel verwendet Python)
   - Erwägen Sie, die App anzupassen, um die WebSocket-Beta von Vercel mit einem Node.js-Server zu verwenden

Für einen schnellen Test auf Vercel mit begrenzter Funktionalität könnten Sie die App so ändern, dass sie statt WebSockets Polling verwendet, aber dies wird für Echtzeit-Spiele nicht empfohlen.

## Funktionsweise

1. Spieler treten dem Spiel bei und werden automatisch zusammengepaart
2. Erster Spieler erhält 'X', zweiter erhält 'O'
3. Spieler wechseln sich beim Klicken auf das Spielfeld ab
4. Das Spiel erkennt Siege, Niederlagen und Unentschieden
5. Wenn ein Spieler die Verbindung trennt, endet das Spiel für den Gegner

## Dateien

- `app.py`: Haupt-Flask/SocketIO-Anwendung
- `templates/index.html`: Spieloberfläche
- `requirements.txt`: Python-Abhängigkeiten

## Lizenz

MIT