 📖 Über das Projekt                                                                                                                                                                                                            
                                                                                                                                                                                                                                 
  Ein vollständig browserbasiertes Echtzeit-Multiplayer Tic Tac Toe, gebaut mit Node.js und Socket.IO. Unterstützt globale Bracket-Turniere mit beliebig vielen Spielern sowie private 1v1-Räume mit Freunden.
                                                                                                                                                                                                                                 
                                                       
  ✨ Features                                                                                                                                                                                                                     
                                                                                                                                                                                                                                ─
  🏆 Globales Bracket-Turnier
                                                                                                                                                                                                                                 
  - Beliebig viele Spieler treten gleichzeitig der Warteschlange bei                                                                                                                                                             
  - 15-Sekunden-Countdown sammelt Spieler bevor das Turnier startet                                                                                                                                                              
  - Alle Spiele einer Runde laufen gleichzeitig (z. B. 8 Spieler → 4 Partien parallel)                                                                                                                                           
  - Gewinner warten auf die nächste Runde, Verlierer scheiden aus                                                                                                                                                                
  - Freilos bei ungerader Spieleranzahl                                                                                                                                                                                          
  - Live-Bracket-Panel zeigt alle laufenden Partien mit Echtzeit-Spielstand                                                                                                                                                      
  - Der letzte verbleibende Spieler wird Turniersieger 🏆                                                                                                                                                                        
                                                                                                                                                                                                                                 
  🚪 Privater Raum                                                                                                                                                                                                               
                                                                                                                                                                                                                                 
  - Raum erstellen und 6-stelligen Code an einen Freund schicken                                                                                                                                                                 
  - Revanche-Abstimmung: Beide Spieler müssen zustimmen, bevor ein neues Spiel startet
  - Unbegrenzte Runden mit demselben Gegner                                                                                                                                                                                      
                                                                                                                                                                                                                                 
  💬 Live-Chat                                                                                                                                                                                                                   
                                                                                                                                                                                                                                 
  - Globaler Turnier-Chat für alle verbundenen Spieler                                                                                                                                                                           
  - Bilder senden per 📎-Button (automatisch komprimiert auf max. 320px)
  - Bilder per Klick in Vollbild-Lightbox öffnen                                                                                                                                                                                 
                                                                                                                                                                                                                                 
  🎉 Animationen                                                                                                                                                                                                                 
                                                                                                                                                                                                                                 
  - Gewonnen: Partikel-Explosion mit Emojis (🎉🏆🌟🔥), grüner Bildschirmblitz                                                                                                                                                   
  - Verloren: Bildschirm-Schütteleffekt, roter Blitz, traurige Emojis (😭💔💀)
  - Unentschieden: Lila Blitz, neutrale Partikel                                                                                                                                                                                 
                                                                                                                                                                                                                                 
                                                                                                                                                                                                                          
  🛠 Tech Stack                                                                                                                                                                                                                  
                                                                                                                                                                                                                                 
  ┌─────────────┬──────────────────────────────────┐
  │ Technologie │            Verwendung            │                                                                                                                                                                             
  ├─────────────┼──────────────────────────────────┤                                                                                                                                                                             
  │ Node.js     │ Server-Runtime                   │                                                                                                                                                                             
  ├─────────────┼──────────────────────────────────┤                                                                                                                                                                             
  │ Express     │ HTTP-Server & statische Dateien  │                                                                                                                                                                             
  ├─────────────┼──────────────────────────────────┤                                                                                                                                                                             
  │ Socket.IO   │ Echtzeit-WebSocket-Kommunikation │                                                                                                                                                                             
  ├─────────────┼──────────────────────────────────┤                                                                                                                                                                             
  │ Vanilla JS  │ Frontend-Logik                   │        
  ├─────────────┼──────────────────────────────────┤                                                                                                                                                                             
  │ CSS3        │ Animationen & responsives Layout │        
  └─────────────┴──────────────────────────────────┘                                                                                                                                                                             
                                                            
                                                                                                                                                                                                                           
  🚀 Installation & Start                                   
                                                                                                                                                                                                                                 
  Voraussetzungen
                                                                                                                                                                                                                                 
  - Node.js ≥ 18                                                                                                                                                                                                                 
                                                                                                                                                                                                                                 
  Lokal starten                                                                                                                                                                                                                  
                                                            
  # Repository klonen                                                                                                                                                                                                            
  git clone https://github.com/DEIN-USERNAME/tic-tac-toe-online.git                                                                                                                                                              
  cd tic-tac-toe-online                                                                                                                                                                                                          
                                                                                                                                                                                                                                 
  # Abhängigkeiten installieren                                                                                                                                                                                                  
  npm install                                               
                                                                                                                                                                                                                                 
  # Server starten
  node server.js                                                                                                                                                                                                                 
                                                                                                                                                                                                                                 
  Dann im Browser öffnen: http://localhost:3000                                                                                                                                                                                  
                                                                                                                                                                                                                                 
                                                                                                                                                                                                                            
  ☁️ Deploy auf Railway                                     
                                                                                                                                                                                                                                 
  # Railway CLI installieren
  npm install -g @railway/cli                                                                                                                                                                                                    
                                                                                                                                                                                                                                 
  # Einloggen & deployen                                                                                                                                                                                                         
  railway login                                                                                                                                                                                                                  
  railway init                                              
  railway up

  Die App läuft auf dem konfigurierten Port via process.env.PORT.                                                                                                                                                                
   
                                                                                                                                                                                                                              
  🗂 Projektstruktur                                        
                                                                                                                                                                                                                                 
  tic-tac-toe-online/
  ├── server.js       # Node.js Server, Socket.IO, Turnier-Logik                                                                                                                                                                 
  ├── app.js          # Frontend-Logik, Socket-Events, Animationen                                                                                                                                                               
  ├── index.html      # Haupt-HTML (Join, Home, Lobby, Spiel, Chat)                                                                                                                                                              
  ├── styles.css      # Gesamtes Styling inkl. Animationen                                                                                                                                                                       
  └── package.json    # Abhängigkeiten                                                                                                                                                                                           
                                                                                                                                                                                                                                 
                                                                                                                                                                                                                           
  🎮 Spielablauf                                                                                                                                                                                                                 
                                                                                                                                                                                                                                 
  Spieler betritt die Seite                                 
         │                                                                                                                                                                                                                       
         ▼                                                                                                                                                                                                                       
    Namen eingeben                                                                                                                                                                                                               
         │                                                                                                                                                                                                                       
         ├─── Turnier beitreten ──► Warteschlange           
         │                               │                                                                                                                                                                                       
         │                    15s Countdown (mehr Spieler sammeln)
         │                               │                                                                                                                                                                                       
         │                    Runde 1: Alle spielen gleichzeitig                                                                                                                                                                 
         │                               │                                                                                                                                                                                       
         │                    Gewinner wartet, Verlierer scheidet aus                                                                                                                                                            
         │                               │                                                                                                                                                                                       
         │                    Nächste Runde mit Gewinnern...                                                                                                                                                                     
         │                               │                                                                                                                                                                                       
         │                    🏆 Turniersieger              
         │                                                                                                                                                                                                                       
         └─── Privaten Raum ──► Code teilen ──► 1v1 mit Freund
                                                                                                                                                                                                                                 
  
  📡 Socket.IO Events                                                                                                                                                                                                            
                                                                                                                                                                                                                                 
  ┌────────────────────────┬─────────────────┬─────────────────────────────────┐
  │         Event          │    Richtung     │          Beschreibung           │                                                                                                                                                 
  ├────────────────────────┼─────────────────┼─────────────────────────────────┤                                                                                                                                                 
  │ join                   │ Client → Server │ Beitreten mit Namen             │                                                                                                                                                 
  ├────────────────────────┼─────────────────┼─────────────────────────────────┤                                                                                                                                                 
  │ join_queue             │ Client → Server │ Turnier-Warteschlange beitreten │                                                                                                                                                 
  ├────────────────────────┼─────────────────┼─────────────────────────────────┤                                                                                                                                                 
  │ tournament_countdown   │ Server → Client │ Countdown-Update                │                                                                                                                                                 
  ├────────────────────────┼─────────────────┼─────────────────────────────────┤                                                                                                                                                 
  │ tournament_round_start │ Server → All    │ Neue Runde startet              │
  ├────────────────────────┼─────────────────┼─────────────────────────────────┤                                                                                                                                                 
  │ tournament_waiting     │ Server → Client │ Runde gewonnen, warte           │
  ├────────────────────────┼─────────────────┼─────────────────────────────────┤                                                                                                                                                 
  │ game_start             │ Server → Client │ Spiel beginnt                   │
  ├────────────────────────┼─────────────────┼─────────────────────────────────┤                                                                                                                                                 
  │ move                   │ Client → Server │ Spielzug machen                 │
  ├────────────────────────┼─────────────────┼─────────────────────────────────┤                                                                                                                                                 
  │ game_over              │ Server → Client │ Spiel beendet                   │
  ├────────────────────────┼─────────────────┼─────────────────────────────────┤                                                                                                                                                 
  │ champion               │ Server → All    │ Turniersieger                   │
  ├────────────────────────┼─────────────────┼─────────────────────────────────┤                                                                                                                                                 
  │ chat                   │ Beide           │ Nachricht senden/empfangen      │
  ├────────────────────────┼─────────────────┼─────────────────────────────────┤                                                                                                                                                 
  │ chat_image             │ Client → Server │ Bild senden                     │
  ├────────────────────────┼─────────────────┼─────────────────────────────────┤                                                                                                                                                 
  │ create_room            │ Client → Server │ Privaten Raum erstellen         │
  ├────────────────────────┼─────────────────┼─────────────────────────────────┤                                                                                                                                                 
  │ rematch_vote           │ Client → Server │ Revanche abstimmen              │
  └────────────────────────┴─────────────────┴─────────────────────────────────┘                                                                                                                                                 
                                                            
                                                                                                                                                                                                                        
  📄 Lizenz                                                 
                                                                                                                                                                                                                                 
  MIT License — frei verwendbar und veränderbar.
                                                                                                                                                                                                                                 
  ---                                                                                                                                                                                                                            
  Gebaut mit ❤️ und Node.js        
