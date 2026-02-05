/**
 * Cryptid Fates - Cloudflare Worker + Durable Object
 * 
 * This is the complete multiplayer server that runs on Cloudflare's edge network.
 * Copy this entire file into your Cloudflare Worker.
 * 
 * Features:
 * - WebSocket connections for real-time gameplay
 * - Durable Object maintains game state
 * - Validates all player actions server-side
 * - Broadcasts events to both players
 */

// ==================== MAIN WORKER ====================
// Routes incoming requests to the appropriate handler

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }
    
    // Route based on path
    if (url.pathname.startsWith('/match/')) {
      // WebSocket connection to a game room
      return handleMatchConnection(request, env, url);
    }
    
    if (url.pathname === '/matchmaking') {
      // Matchmaking queue
      return handleMatchmaking(request, env);
    }
    
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }
    
    // Default: return API info
    return new Response(JSON.stringify({
      name: 'Cryptid Fates Multiplayer Server',
      version: '1.0.0',
      endpoints: {
        '/match/:matchId': 'WebSocket - Connect to a game room',
        '/matchmaking': 'POST - Find or create a match',
        '/health': 'GET - Health check'
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};

// ==================== CORS HANDLING ====================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function handleCORS() {
  return new Response(null, { headers: corsHeaders });
}

// ==================== MATCH CONNECTION ====================

async function handleMatchConnection(request, env, url) {
  // Extract match ID from URL: /match/abc123
  const matchId = url.pathname.split('/')[2];
  
  if (!matchId) {
    return new Response('Match ID required', { status: 400 });
  }
  
  // Check for WebSocket upgrade
  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 });
  }
  
  // Check if this is a quick matchmaking request (QUEUE_ prefix)
  if (matchId.startsWith('QUEUE_')) {
    // Route to the matchmaking lobby
    const lobbyId = env.GAME_ROOMS.idFromName('__MATCHMAKING_LOBBY__');
    const lobby = env.GAME_ROOMS.get(lobbyId);
    return lobby.fetch(request);
  }
  
  // Get the Durable Object for this match
  const roomId = env.GAME_ROOMS.idFromName(matchId);
  const room = env.GAME_ROOMS.get(roomId);
  
  // Forward the WebSocket request to the Durable Object
  return room.fetch(request);
}

// ==================== SIMPLE MATCHMAKING ====================

async function handleMatchmaking(request, env) {
  if (request.method !== 'POST') {
    return new Response('POST required', { status: 405 });
  }
  
  try {
    const body = await request.json();
    const { playerId, playerName } = body;
    
    if (!playerId) {
      return new Response(JSON.stringify({ error: 'playerId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // Simple matchmaking: generate a random match ID
    // In production, you'd use a separate Durable Object to manage a queue
    const matchId = generateMatchId();
    
    return new Response(JSON.stringify({
      matchId,
      wsUrl: `wss://${new URL(request.url).host}/match/${matchId}`,
      message: 'Share this match ID with your opponent'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

function generateMatchId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ==================== GAME ROOM DURABLE OBJECT ====================
// This is where the magic happens - each match is a Durable Object

export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    
    // Connected players - will be restored from WebSockets on wake
    this.players = new Map(); // WebSocket -> { role: 'player1'|'player2', info: {...} }
    
    // Player slots - persisted to storage, survives WebSocket close
    // This tracks which roles are filled and their state, independent of WebSocket lifecycle
    this.playerSlots = {
      player1: null, // { connected: bool, deckSelected: bool, deckData: obj, joinedAt: timestamp }
      player2: null
    };
    
    // Game state - persisted to storage
    this.gameState = null;
    this.sequence = 0;
    this.actionHistory = [];
    
    // Match state - persisted to storage
    this.matchStarted = false;
    this.matchEnded = false;
    
    // Turn timer
    this.turnTimerTimeout = null;
    this.turnTimeLimit = 90000; // 90 seconds per turn
    
    // Matchmaking lobby mode
    this.isLobby = false;
    this.matchmakingQueue = []; // Array of { ws, joinedAt }
    
    // Note: blockConcurrencyWhile doesn't work in constructor
    // State will be loaded lazily when needed
  }
  
  // Load persisted state from storage (called on wake from hibernation)
  async loadStateFromStorage() {
    // Only load once
    if (this._stateLoaded) return;
    this._stateLoaded = true;
    
    try {
      const stored = await this.state.storage.get([
        'gameState', 'matchStarted', 'matchEnded', 'sequence',
        'playerSlots' // Store player slot info separately
      ]);
      
      if (stored && stored.get) {
        if (stored.get('gameState')) {
          this.gameState = stored.get('gameState');
          console.log('[GameRoom] Restored gameState from storage');
        }
        if (stored.get('matchStarted') !== undefined) {
          this.matchStarted = stored.get('matchStarted');
        }
        if (stored.get('matchEnded') !== undefined) {
          this.matchEnded = stored.get('matchEnded');
        }
        if (stored.get('sequence') !== undefined) {
          this.sequence = stored.get('sequence');
        }
        // Restore player slots info
        if (stored.get('playerSlots')) {
          this.playerSlots = stored.get('playerSlots');
          console.log('[GameRoom] Restored playerSlots:', this.playerSlots);
        }
      }
      
      // Initialize playerSlots if not present
      if (!this.playerSlots) {
        this.playerSlots = {
          player1: null, // { connected: bool, deckSelected: bool, deckData: obj }
          player2: null
        };
      }
      
      // Restore player connections from hibernated WebSockets
      try {
        const webSockets = this.state.getWebSockets();
        
        for (const ws of webSockets) {
          try {
            // Get attachment data set when WebSocket was accepted
            const attachment = ws.deserializeAttachment();
            if (attachment && attachment.role) {
              // Get deckData from playerSlots (attachments are limited to 2KB, can't store full deck)
              const slotData = this.playerSlots?.[attachment.role];
              this.players.set(ws, {
                role: attachment.role,
                connected: true,
                deckSelected: attachment.deckSelected || slotData?.deckSelected || false,
                deckData: slotData?.deckData || null
              });
              
              // Update playerSlots to mark this player as connected
              if (this.playerSlots[attachment.role]) {
                this.playerSlots[attachment.role].connected = true;
              }
              
              console.log(`[GameRoom] Restored player ${attachment.role} from hibernation`);
            }
          } catch (wsError) {
            console.error('[GameRoom] Error restoring WebSocket:', wsError);
          }
        }
      } catch (wsError) {
        console.log('[GameRoom] No hibernated WebSockets to restore');
      }
      
      console.log(`[GameRoom] State loaded. Players: ${this.players.size}, Match started: ${this.matchStarted}`);
    } catch (error) {
      console.error('[GameRoom] Error loading state from storage:', error);
    }
  }
  
  // Save state to storage (call after important changes)
  async saveStateToStorage() {
    try {
      await this.state.storage.put({
        gameState: this.gameState,
        matchStarted: this.matchStarted,
        matchEnded: this.matchEnded,
        sequence: this.sequence,
        playerSlots: this.playerSlots
      });
    } catch (error) {
      console.error('[GameRoom] Error saving state to storage:', error);
    }
  }
  
  // Handle incoming WebSocket connections
  async fetch(request) {
    // Load state from storage if waking from hibernation
    await this.loadStateFromStorage();
    
    try {
      const url = new URL(request.url);
      const matchId = url.pathname.split('/')[2];
      
      console.log(`[GameRoom] Fetch received for matchId: ${matchId}`);
      
      // Check if this is the matchmaking lobby
      if (matchId && matchId.startsWith('QUEUE_')) {
        this.isLobby = true;
        return this.handleLobbyConnection(request);
      }
      
      // Regular game room handling
      return this.handleGameRoomConnection(request);
    } catch (error) {
      console.error('[GameRoom] Error in fetch handler:', error);
      return new Response(`Server error: ${error.message}`, { status: 500 });
    }
  }
  
  // Handle matchmaking lobby connections
  async handleLobbyConnection(request) {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    
    this.state.acceptWebSocket(server);
    
    // Add to matchmaking queue
    const queueEntry = {
      ws: server,
      joinedAt: Date.now(),
      id: Math.random().toString(36).substring(2, 8) // For debugging
    };
    this.matchmakingQueue.push(queueEntry);
    
    console.log(`[Lobby] Player ${queueEntry.id} joined queue. Queue size: ${this.matchmakingQueue.length}`);
    
    // Send queue status after a small delay to ensure socket is ready
    try {
      server.send(JSON.stringify({
        type: 'QUEUE_JOINED',
        position: this.matchmakingQueue.length,
        queueSize: this.matchmakingQueue.length,
        playerId: queueEntry.id
      }));
    } catch (e) {
      console.error('[Lobby] Failed to send QUEUE_JOINED:', e);
    }
    
    // Try to match players (with small delay to ensure both sockets are ready)
    setTimeout(() => {
      this.tryMatchPlayers();
    }, 100);
    
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
  
  // Try to pair players in the queue
  tryMatchPlayers() {
    console.log(`[Lobby] tryMatchPlayers called. Queue size: ${this.matchmakingQueue.length}`);
    
    // Need at least 2 players
    if (this.matchmakingQueue.length < 2) {
      console.log('[Lobby] Not enough players to match');
      return;
    }
    
    while (this.matchmakingQueue.length >= 2) {
      const player1 = this.matchmakingQueue.shift();
      const player2 = this.matchmakingQueue.shift();
      
      console.log(`[Lobby] Attempting to match players: ${player1.id} vs ${player2.id}`);
      
      try {
        // Generate a new match ID
        const matchId = this.generateQuickMatchId();
        
        console.log(`[Lobby] Generated match ID: ${matchId}`);
        
        // Send GAME_START directly to both players with all needed info
        const host = this.env.WORKER_HOST || 'cryptid-new.brenden-6ce.workers.dev';
        
        // Player 1 is "player" (goes first), Player 2 is "enemy"
        const player1StartMsg = JSON.stringify({
          type: 'GAME_START',
          matchId: matchId,
          yourRole: 'player',
          wsUrl: `wss://${host}/match/${matchId}`,
          reconnectRequired: true
        });
        
        const player2StartMsg = JSON.stringify({
          type: 'GAME_START',
          matchId: matchId,
          yourRole: 'enemy', 
          wsUrl: `wss://${host}/match/${matchId}`,
          reconnectRequired: true
        });
        
        // Send to player 1
        try {
          player1.ws.send(player1StartMsg);
          console.log(`[Lobby] Sent GAME_START to player1 (${player1.id})`);
        } catch (e) {
          console.error(`[Lobby] Failed to send to player1 (${player1.id}):`, e.message);
          throw e;
        }
        
        // Send to player 2
        try {
          player2.ws.send(player2StartMsg);
          console.log(`[Lobby] Sent GAME_START to player2 (${player2.id})`);
        } catch (e) {
          console.error(`[Lobby] Failed to send to player2 (${player2.id}):`, e.message);
          throw e;
        }
        
        console.log(`[Lobby] Successfully matched players for game ${matchId}`);
        
        // Mark these websockets as "matched"
        player1.matched = true;
        player2.matched = true;
        
      } catch (error) {
        console.error('[Lobby] Error matching players:', error);
        // Put players back in queue if something went wrong
        this.matchmakingQueue.unshift(player2);
        this.matchmakingQueue.unshift(player1);
        break;
      }
    }
    
    // Update queue positions for remaining players
    this.matchmakingQueue.forEach((entry, index) => {
      if (!entry.matched) {
        try {
          entry.ws.send(JSON.stringify({
            type: 'QUEUE_UPDATE',
            position: index + 1,
            queueSize: this.matchmakingQueue.length
          }));
        } catch (e) {
          // Player disconnected, will be cleaned up
        }
      }
    });
  }
  
  generateQuickMatchId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = 'QM';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }
  
  // Handle regular game room connections
  async handleGameRoomConnection(request) {
    try {
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);
      
      console.log(`[GameRoom] Creating WebSocket pair for game room`);
      
      // Initialize playerSlots if not present
      if (!this.playerSlots) {
        this.playerSlots = {
          player1: null,
          player2: null
        };
      }
      
      // Check for reconnecting players using playerSlots (persisted state)
      // This survives WebSocket close and DO hibernation
      let disconnectedRole = null;
      for (const role of ['player1', 'player2']) {
        const slot = this.playerSlots[role];
        if (slot && !slot.connected) {
          disconnectedRole = role;
          console.log(`[GameRoom] Found disconnected player slot: ${role}`);
          break;
        }
      }
      
      let role;
      let isReconnect = false;
      let playerData;
      
      if (disconnectedRole) {
        // Handle reconnection - player is rejoining their slot
        role = disconnectedRole;
        isReconnect = true;
        
        const slotData = this.playerSlots[role];
        playerData = {
          role,
          connected: true,
          reconnectedAt: Date.now(),
          deckSelected: slotData.deckSelected || false,
          deckData: slotData.deckData || null
        };
        
        // Update the slot to show connected
        this.playerSlots[role].connected = true;
        this.playerSlots[role].reconnectedAt = Date.now();
        
        console.log(`[GameRoom] Player ${role} reconnected`);
      } else {
        // New connection - determine player role from playerSlots
        // Count how many slots are filled
        const player1Filled = this.playerSlots.player1 !== null;
        const player2Filled = this.playerSlots.player2 !== null;
        
        console.log(`[GameRoom] New connection. Slots: player1=${player1Filled}, player2=${player2Filled}`);
        
        if (!player1Filled) {
          role = 'player1';
        } else if (!player2Filled) {
          role = 'player2';
        } else {
          // Both slots filled and no disconnected players - room is full
          console.log(`[GameRoom] Room is full, rejecting connection`);
          this.state.acceptWebSocket(server);
          server.close(4000, 'Room is full');
          return new Response(null, {
            status: 101,
            webSocket: client,
          });
        }
        
        playerData = {
          role,
          connected: true,
          joinedAt: Date.now(),
          deckSelected: false,
          deckData: null
        };
        
        // Fill the slot
        this.playerSlots[role] = {
          connected: true,
          joinedAt: Date.now(),
          deckSelected: false,
          deckData: null
        };
        
        console.log(`[GameRoom] Player joined as ${role}`);
      }
      
      // Save the updated playerSlots to storage
      await this.saveStateToStorage();
      
      // Accept the WebSocket with attachment for hibernation recovery
      // NOTE: Attachments are limited to 2048 bytes, so don't store deckData here
      // deckData is stored in playerSlots which is persisted to storage
      server.serializeAttachment({
        role: role,
        deckSelected: playerData.deckSelected
      });
      this.state.acceptWebSocket(server);
      
      // Store player info in memory
      this.players.set(server, playerData);
      console.log(`[GameRoom] Total players: ${this.players.size}`);
      
      const yourRole = role === 'player1' ? 'player' : 'enemy';
      
      // Send initial message
      try {
        // If match already started and this is a reconnect, send game state
        if (this.matchStarted && isReconnect && this.gameState) {
          console.log(`[GameRoom] Sending reconnect state to ${role}`);
          server.send(JSON.stringify({
            type: 'RECONNECTED',
            yourRole: yourRole,
            gameState: this.getStateForPlayer(yourRole),
            matchStarted: true,
            isYourTurn: this.gameState.currentTurn === yourRole
          }));
          
          // Notify opponent of reconnection
          this.broadcastToOthers(server, {
            type: 'OPPONENT_RECONNECTED'
          });
        } else if (isReconnect && !this.matchStarted) {
          // Reconnecting during deck selection phase
          console.log(`[GameRoom] Player ${role} reconnecting during deck selection`);
          
          // Check if this player had already selected a deck before disconnecting
          const hadDeckSelected = this.playerSlots[role]?.deckSelected || false;
          
          server.send(JSON.stringify({
            type: 'RECONNECTED',
            yourRole: yourRole,
            matchStarted: false,
            deckSelected: hadDeckSelected,
            message: hadDeckSelected ? 'Reconnected! Waiting for opponent.' : 'Reconnected! Please select your deck.'
          }));
          
          // Notify opponent of reconnection
          this.broadcastToOthers(server, {
            type: 'OPPONENT_RECONNECTED'
          });
          
          // Check if both players are now connected again
          const bothConnected = this.playerSlots.player1?.connected && this.playerSlots.player2?.connected;
          if (bothConnected) {
            console.log('[GameRoom] Both players reconnected during deck selection');
            
            // Check if both players had already selected decks - if so, start the match
            const bothHaveDecks = this.playerSlots.player1?.deckSelected && this.playerSlots.player2?.deckSelected;
            if (bothHaveDecks) {
              console.log('[GameRoom] Both players already have decks, starting match!');
              this.startMatchWithDecks();
            } else {
              this.notifyBothPlayersConnected();
            }
          }
        } else {
          // Send welcome message for new connection
          server.send(JSON.stringify({
            type: 'MATCH_JOINED',
            yourRole: yourRole,
            playersConnected: this.players.size,
            waitingForOpponent: this.players.size < 2,
            matchStarted: this.matchStarted
          }));
          
          // If both players are now connected, notify them (but don't start the game yet - wait for deck selection)
          const bothConnected = this.playerSlots.player1?.connected && this.playerSlots.player2?.connected;
          if (bothConnected && !this.matchStarted) {
            console.log('[GameRoom] Both players connected, notifying...');
            this.notifyBothPlayersConnected();
          }
        }
      } catch (sendError) {
        console.error('[GameRoom] Error sending initial message:', sendError);
      }
      
      console.log(`[GameRoom] Returning WebSocket response`);
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
      
    } catch (error) {
      console.error('[GameRoom] Error in handleGameRoomConnection:', error);
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }
  
  notifyBothPlayersConnected() {
    // Tell both players that they're both in the room
    for (const [ws, player] of this.players) {
      try {
        ws.send(JSON.stringify({
          type: 'BOTH_PLAYERS_CONNECTED',
          yourRole: player.role === 'player1' ? 'player' : 'enemy',
          message: 'Both players connected! Select your deck.'
        }));
      } catch (e) {
        console.error('[GameRoom] Failed to notify player:', e);
      }
    }
  }
  
  handleDeckSelected(ws, player, deckData) {
    console.log(`[GameRoom] Player ${player.role} selected deck:`, deckData);
    
    player.deckSelected = true;
    player.deckData = deckData;
    
    // Update WebSocket attachment for hibernation recovery
    // NOTE: Attachments are limited to 2048 bytes, so don't store deckData here
    // deckData is stored in playerSlots which is persisted to storage
    ws.serializeAttachment({
      role: player.role,
      deckSelected: true
    });
    
    // Also update playerSlots (persisted state)
    if (this.playerSlots && this.playerSlots[player.role]) {
      this.playerSlots[player.role].deckSelected = true;
      this.playerSlots[player.role].deckData = deckData;
      this.saveStateToStorage(); // Persist the change
    }
    
    // Notify opponent that this player is ready
    for (const [otherWs, otherPlayer] of this.players) {
      if (otherWs !== ws) {
        try {
          otherWs.send(JSON.stringify({
            type: 'OPPONENT_DECK_SELECTED',
            message: 'Opponent has selected their deck!'
          }));
        } catch (e) {
          console.error('[GameRoom] Failed to notify opponent:', e);
        }
      }
    }
    
    // Check if both players have selected decks AND are connected
    let allReady = false;
    if (this.playerSlots) {
      const p1Ready = this.playerSlots.player1?.deckSelected && this.playerSlots.player1?.connected;
      const p2Ready = this.playerSlots.player2?.deckSelected && this.playerSlots.player2?.connected;
      allReady = p1Ready && p2Ready;
    } else {
      allReady = [...this.players.values()].every(p => p.deckSelected && p.connected);
    }
    
    if (allReady && !this.matchStarted) {
      console.log('[GameRoom] Both players have selected decks and are connected, starting match!');
      this.startMatchWithDecks();
    }
  }
  
  startMatchWithDecks() {
    // Safety check - ensure both players are connected
    const connectedPlayers = [...this.players.values()].filter(p => p.connected);
    if (connectedPlayers.length < 2) {
      console.log('[GameRoom] Cannot start match - not all players connected');
      return;
    }
    
    this.matchStarted = true;
    
    // Randomly determine who goes first
    const firstPlayer = Math.random() < 0.5 ? 'player' : 'enemy';
    
    console.log(`[GameRoom] First player: ${firstPlayer}`);
    
    // Initialize game state
    this.gameState = this.createInitialGameState();
    this.gameState.currentTurn = firstPlayer;
    this.gameState.turnNumber = 1;
    
    // Populate decks from player data
    for (const [ws, player] of this.players) {
      const role = player.role === 'player1' ? 'player' : 'enemy';
      const deckData = player.deckData || {};
      
      // Shuffle and set deck
      const mainDeck = this.shuffleDeck([...(deckData.cards || [])]);
      const kindlingDeck = [...(deckData.kindling || [])];
      
      if (role === 'player') {
        this.gameState.playerDeck = mainDeck;
        this.gameState.playerKindling = kindlingDeck;
        // Draw initial hand (5 cards)
        this.gameState.playerHand = mainDeck.splice(0, 5);
        // First player starts with 0 pyre, second starts with 1
        this.gameState.playerPyre = (firstPlayer === 'player') ? 0 : 1;
      } else {
        this.gameState.enemyDeck = mainDeck;
        this.gameState.enemyKindling = kindlingDeck;
        this.gameState.enemyHand = mainDeck.splice(0, 5);
        this.gameState.enemyPyre = (firstPlayer === 'enemy') ? 0 : 1;
      }
      
      console.log(`[GameRoom] ${role} deck: ${mainDeck.length} cards remaining, hand: ${role === 'player' ? this.gameState.playerHand.length : this.gameState.enemyHand.length}`);
    }
    
    // Send game start to both players
    for (const [ws, player] of this.players) {
      const yourRole = player.role === 'player1' ? 'player' : 'enemy';
      const isYourTurn = firstPlayer === yourRole;
      
      try {
        ws.send(JSON.stringify({
          type: 'BOTH_DECKS_SELECTED',
          yourRole: yourRole,
          firstPlayer: firstPlayer,
          isYourTurn: isYourTurn,
          initialState: this.getStateForPlayer(yourRole),
          message: 'Both players ready! Starting game...'
        }));
      } catch (e) {
        console.error('[GameRoom] Failed to send game start:', e);
      }
    }
    
    // Save state to storage for hibernation recovery
    this.saveStateToStorage();
    
    // Start turn timer for first player
    this.startTurnTimer();
  }
  
  shuffleDeck(deck) {
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }
  
  // Handle WebSocket messages
  async webSocketMessage(ws, message) {
    // Load state from storage if waking from hibernation
    await this.loadStateFromStorage();
    
    // Handle lobby mode messages
    if (this.isLobby) {
      try {
        const data = JSON.parse(message);
        if (data.type === 'PING') {
          ws.send(JSON.stringify({
            type: 'PONG',
            clientTime: data.timestamp,
            serverTime: Date.now(),
            queueSize: this.matchmakingQueue.length
          }));
        } else if (data.type === 'LEAVE_QUEUE') {
          this.removeFromQueue(ws);
        }
      } catch (e) {
        // Ignore parse errors in lobby
      }
      return;
    }
    
    const player = this.players.get(ws);
    if (!player) return;
    
    // Parse message
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error('[GameRoom] Failed to parse message:', e);
      return;
    }
    
    try {
      switch (data.type) {
        // Handle deck selection (before game starts)
        case 'DECK_SELECTED':
          if (!this.matchStarted) {
            this.handleDeckSelected(ws, player, data.deck);
          }
          break;
          
        case 'ACTION':
          this.handleAction(ws, player, data);
          break;
          
        case 'PING':
          ws.send(JSON.stringify({
            type: 'PONG',
            clientTime: data.timestamp,
            serverTime: Date.now()
          }));
          break;
          
        case 'REQUEST_SYNC':
          this.sendStateSync(ws, player);
          break;
          
        case 'CHAT':
          this.broadcastChat(player, data.message);
          break;
          
        case 'KEEPALIVE':
          // Just acknowledge keepalive to prevent connection timeout
          ws.send(JSON.stringify({ type: 'KEEPALIVE_ACK' }));
          break;
          
        default:
          console.log('[GameRoom] Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('[GameRoom] Error handling message:', error);
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: error.message
      }));
    }
  }
  
  // Handle WebSocket close
  async webSocketClose(ws, code, reason) {
    // Load state from storage if waking from hibernation
    await this.loadStateFromStorage();
    
    // Handle lobby mode disconnections
    if (this.isLobby) {
      this.removeFromQueue(ws);
      console.log(`Player left matchmaking queue. Queue size: ${this.matchmakingQueue.length}`);
      return;
    }
    
    const player = this.players.get(ws);
    if (player) {
      console.log(`Player ${player.role} disconnected: ${code} ${reason}`);
      
      // Mark as disconnected in playerSlots (persisted)
      if (this.playerSlots && this.playerSlots[player.role]) {
        this.playerSlots[player.role].connected = false;
        this.playerSlots[player.role].disconnectedAt = Date.now();
        // Save to storage so reconnection can find this player
        await this.saveStateToStorage();
        console.log(`[GameRoom] Saved disconnected state for ${player.role}`);
      }
      
      // Remove from the WebSocket-based players map
      this.players.delete(ws);
      
      // Notify other player
      this.broadcastToOthers(ws, {
        type: 'OPPONENT_DISCONNECTED',
        reconnectWindow: 60000
      });
      
      // Set timeout to forfeit if no reconnect
      // Note: This won't survive hibernation, but the client can also timeout
      const disconnectedRole = player.role;
      setTimeout(async () => {
        await this.loadStateFromStorage();
        // Check if player is still disconnected using playerSlots
        if (this.playerSlots && this.playerSlots[disconnectedRole] && 
            !this.playerSlots[disconnectedRole].connected) {
          this.handleForfeit(disconnectedRole);
        }
      }, 60000);
    }
  }
  
  // Remove a player from the matchmaking queue
  removeFromQueue(ws) {
    const index = this.matchmakingQueue.findIndex(entry => entry.ws === ws);
    if (index !== -1) {
      this.matchmakingQueue.splice(index, 1);
      // Update positions for remaining players
      this.matchmakingQueue.forEach((entry, i) => {
        try {
          entry.ws.send(JSON.stringify({
            type: 'QUEUE_UPDATE',
            position: i + 1,
            queueSize: this.matchmakingQueue.length
          }));
        } catch (e) {
          // Player already disconnected
        }
      });
    }
  }
  
  // Handle WebSocket error
  async webSocketError(ws, error) {
    console.error('WebSocket error:', error);
  }
  
  // ==================== GAME LOGIC ====================
  
  startMatch() {
    console.log('Starting match!');
    this.matchStarted = true;
    
    // Initialize game state
    this.gameState = this.createInitialGameState();
    
    // Randomly determine who goes first
    const firstPlayer = Math.random() < 0.5 ? 'player' : 'enemy';
    this.gameState.currentTurn = firstPlayer;
    
    // Send game start to both players
    for (const [ws, player] of this.players) {
      const yourRole = player.role === 'player1' ? 'player' : 'enemy';
      const isYourTurn = firstPlayer === yourRole;
      
      ws.send(JSON.stringify({
        type: 'GAME_STARTED',
        yourRole,
        firstPlayer: isYourTurn ? 'you' : 'opponent',
        initialState: this.getStateForPlayer(yourRole),
        turnTimeLimit: this.turnTimeLimit
      }));
    }
    
    // Broadcast turn start
    this.broadcast({
      type: 'TURN_STARTED',
      owner: firstPlayer,
      turnNumber: 1
    });
    
    // Start turn timer
    this.startTurnTimer();
  }
  
  createInitialGameState() {
    return {
      // Fields: 2 columns x 3 rows each
      playerField: [[null, null, null], [null, null, null]],
      enemyField: [[null, null, null], [null, null, null]],
      
      // Hands (will be populated when decks are submitted)
      playerHand: [],
      enemyHand: [],
      
      // Decks
      playerDeck: [],
      enemyDeck: [],
      
      // Kindling pools
      playerKindling: [],
      enemyKindling: [],
      
      // Resources
      playerPyre: 0,
      enemyPyre: 0,
      
      // Death counters (10 = loss)
      playerDeaths: 0,
      enemyDeaths: 0,
      
      // Traps (2 slots each)
      playerTraps: [null, null],
      enemyTraps: [null, null],
      
      // Turn state
      currentTurn: 'player',
      phase: 'conjure1',
      turnNumber: 0,
      
      // Per-turn flags
      playerKindlingPlayedThisTurn: false,
      enemyKindlingPlayedThisTurn: false,
      playerPyreBurnUsed: false,
      enemyPyreBurnUsed: false
    };
  }
  
  // Handle player action
  handleAction(ws, player, action) {
    const playerRole = player.role === 'player1' ? 'player' : 'enemy';
    
    // Check if game state exists
    if (!this.gameState) {
      console.error('[GameRoom] handleAction called but gameState is null');
      return this.rejectAction(ws, action.actionId, 'GAME_NOT_INITIALIZED');
    }
    
    // Check if game is active
    if (!this.matchStarted || this.matchEnded) {
      return this.rejectAction(ws, action.actionId, 'GAME_NOT_ACTIVE');
    }
    
    // Check if it's this player's turn (for turn-based actions)
    if (this.requiresTurn(action.actionType) && this.gameState.currentTurn !== playerRole) {
      return this.rejectAction(ws, action.actionId, 'NOT_YOUR_TURN');
    }
    
    // Check if action is valid for current phase
    if (!this.isValidForPhase(action.actionType, this.gameState.phase)) {
      return this.rejectAction(ws, action.actionId, 'WRONG_PHASE');
    }
    
    // Validate and execute the action
    const result = this.executeAction(playerRole, action);
    
    if (!result.success) {
      return this.rejectAction(ws, action.actionId, result.reason);
    }
    
    // Record action
    this.actionHistory.push({
      sequence: this.sequence,
      player: playerRole,
      action,
      timestamp: Date.now()
    });
    
    // Broadcast results to both players
    this.broadcastActionResult(action.actionId, playerRole, result.events);
    
    // Save state after action
    this.saveStateToStorage();
    
    // Check for game over
    this.checkGameOver();
    
    // Reset turn timer if turn-based action
    if (this.requiresTurn(action.actionType)) {
      this.resetTurnTimer();
    }
  }
  
  executeAction(playerRole, action) {
    const events = [];
    const gs = this.gameState;
    
    const collectEvent = (eventType, data) => {
      events.push({
        type: eventType,  // Use 'type' for client compatibility
        ...data,
        owner: data.owner || playerRole,
        sequence: this.sequence++
      });
    };
    
    let result;
    
    switch (action.actionType) {
      case 'SUMMON_CRYPTID':
        result = this.executeSummon(playerRole, action.payload, collectEvent);
        break;
        
      case 'SUMMON_KINDLING':
        result = this.executeSummonKindling(playerRole, action.payload, collectEvent);
        break;
        
      case 'ATTACK':
        result = this.executeAttack(playerRole, action.payload, collectEvent);
        break;
        
      case 'EVOLVE_CRYPTID':
        result = this.executeEvolution(playerRole, action.payload, collectEvent);
        break;
        
      case 'PLAY_BURST':
        result = this.executePlayBurst(playerRole, action.payload, collectEvent);
        break;
        
      case 'PLAY_TRAP':
        result = this.executePlayTrap(playerRole, action.payload, collectEvent);
        break;
        
      case 'USE_ABILITY':
        result = this.executeUseAbility(playerRole, action.payload, collectEvent);
        break;
        
      case 'PYRE_BURN':
        result = this.executePyreBurn(playerRole, collectEvent);
        break;
        
      case 'END_CONJURE1':
        result = this.executeEndConjure1(playerRole, collectEvent);
        break;
        
      case 'END_COMBAT':
        result = this.executeEndCombat(playerRole, collectEvent);
        break;
        
      case 'END_TURN':
        result = this.executeEndTurn(playerRole, collectEvent);
        break;
        
      case 'CONCEDE':
        result = this.executeConcede(playerRole, collectEvent);
        break;
        
      default:
        return { success: false, reason: 'UNKNOWN_ACTION' };
    }
    
    // Merge the collected events into the result
    if (result.success) {
      result.events = events;
    }
    
    return result;
  }
  
  // ==================== ACTION EXECUTORS ====================
  
  executeSummon(playerRole, payload, collectEvent) {
    const gs = this.gameState;
    // Handle both formats: {cardId, col, row} and {cardId, targetSlot: {col, row}}
    const cardId = payload.cardId;
    let col = payload.col ?? payload.targetSlot?.col;
    let row = payload.row ?? payload.targetSlot?.row;
    
    // Get hand and pyre
    const hand = playerRole === 'player' ? gs.playerHand : gs.enemyHand;
    const pyre = playerRole === 'player' ? gs.playerPyre : gs.enemyPyre;
    const field = playerRole === 'player' ? gs.playerField : gs.enemyField;
    
    // Find card in hand
    let cardIndex = hand.findIndex(c => c.id === cardId);
    
    // If not found by ID, try matching by card data if provided
    if (cardIndex === -1 && payload.cardData) {
      // Use the card data from client for initial summon
      const cardData = payload.cardData;
      hand.push({ ...cardData, id: cardId });
      cardIndex = hand.length - 1;
    }
    
    if (cardIndex === -1) {
      console.log('[GameRoom] Card not in hand:', cardId, 'Hand:', hand.map(c => c.id));
      return { success: false, reason: 'CARD_NOT_IN_HAND' };
    }
    
    const card = hand[cardIndex];
    
    // Check pyre cost
    if ((card.cost || 0) > pyre) {
      return { success: false, reason: 'INSUFFICIENT_PYRE' };
    }
    
    // Check slot is valid
    if (col < 0 || col > 1 || row < 0 || row > 2) {
      return { success: false, reason: 'INVALID_SLOT' };
    }
    
    // Check slot is empty (or find valid slot)
    const combatCol = playerRole === 'player' ? 1 : 0;
    const supportCol = playerRole === 'player' ? 0 : 1;
    
    // Auto-place: combat first, then support
    if (field[col][row] !== null) {
      // Try the other column
      const otherCol = col === combatCol ? supportCol : combatCol;
      if (field[otherCol][row] === null) {
        col = otherCol;
      } else {
        return { success: false, reason: 'SLOT_OCCUPIED' };
      }
    }
    
    // Execute summon
    hand.splice(cardIndex, 1);
    
    if (playerRole === 'player') {
      gs.playerPyre -= card.cost || 0;
    } else {
      gs.enemyPyre -= card.cost || 0;
    }
    
    // Create field cryptid
    const summonedCryptid = {
      ...card,
      owner: playerRole,
      col: col,
      row: row,
      currentHp: card.hp || 1,
      currentAtk: card.atk || card.attack || 0,
      maxHp: card.hp || 1,
      baseAtk: card.atk || card.attack || 0,
      tapped: false,
      canAttack: false, // Summoning sickness
      justSummoned: true,
      burnTurns: 0,
      bleedTurns: 0,
      paralyzed: false
    };
    
    field[col][row] = summonedCryptid;
    
    console.log('[GameRoom] Cryptid summoned:', summonedCryptid.name, 'at', col, row, 'by', playerRole);
    
    collectEvent('PYRE_CHANGED', {
      owner: playerRole,
      amount: -(card.cost || 0),
      newPyre: playerRole === 'player' ? gs.playerPyre : gs.enemyPyre
    });
    
    collectEvent('CRYPTID_SUMMONED', {
      cardId: cardId,
      cardName: summonedCryptid.name,
      cryptid: this.serializeCryptid(summonedCryptid),
      col: col,
      row: row,
      owner: playerRole,
      hp: summonedCryptid.currentHp,
      attack: summonedCryptid.currentAtk
    });
    
    return { success: true };
  }
  
  executeSummonKindling(playerRole, payload, collectEvent) {
    const gs = this.gameState;
    // Handle both formats
    const cardId = payload.cardId;
    const col = payload.col ?? payload.targetSlot?.col;
    const row = payload.row ?? payload.targetSlot?.row;
    
    // Check if kindling already played this turn
    const playedFlag = playerRole === 'player' ? 'playerKindlingPlayedThisTurn' : 'enemyKindlingPlayedThisTurn';
    if (gs[playedFlag]) {
      return { success: false, reason: 'KINDLING_ALREADY_PLAYED' };
    }
    
    // Get kindling pool
    const kindlingPool = playerRole === 'player' ? gs.playerKindling : gs.enemyKindling;
    const field = playerRole === 'player' ? gs.playerField : gs.enemyField;
    
    // Find kindling in pool
    let kindlingIndex = kindlingPool.findIndex(c => c.id === cardId);
    
    // If not found by ID, add from cardData
    if (kindlingIndex === -1 && payload.cardData) {
      kindlingPool.push({ ...payload.cardData, id: cardId });
      kindlingIndex = kindlingPool.length - 1;
    }
    
    if (kindlingIndex === -1) {
      console.log('[GameRoom] Kindling not found:', cardId, 'Pool:', kindlingPool.map(c => c.id));
      return { success: false, reason: 'CARD_NOT_IN_KINDLING' };
    }
    
    const kindling = kindlingPool[kindlingIndex];
    
    // Validate slot
    if (field[col]?.[row] !== null) {
      return { success: false, reason: 'SLOT_OCCUPIED' };
    }
    
    // Execute summon
    kindlingPool.splice(kindlingIndex, 1);
    gs[playedFlag] = true;
    
    const summonedKindling = {
      ...kindling,
      owner: playerRole,
      col,
      row,
      currentHp: kindling.hp || 1,
      currentAtk: kindling.atk || kindling.attack || 1,
      maxHp: kindling.hp || 1,
      baseAtk: kindling.atk || kindling.attack || 1,
      tapped: false,
      canAttack: false,
      justSummoned: true,
      isKindling: true
    };
    
    field[col][row] = summonedKindling;
    
    console.log('[GameRoom] Kindling summoned:', summonedKindling.name, 'at', col, row, 'by', playerRole);
    
    collectEvent('KINDLING_SUMMONED', {
      cardId: cardId,
      cardName: summonedKindling.name,
      cryptid: this.serializeCryptid(summonedKindling),
      col: col,
      row: row,
      owner: playerRole,
      hp: summonedKindling.currentHp,
      attack: summonedKindling.currentAtk
    });
    
    return { success: true };
  }
  
  executeAttack(playerRole, payload, collectEvent) {
    const gs = this.gameState;
    const { attackerCol, attackerRow, targetCol, targetRow } = payload;
    
    const attackerField = playerRole === 'player' ? gs.playerField : gs.enemyField;
    const targetField = playerRole === 'player' ? gs.enemyField : gs.playerField;
    const targetOwner = playerRole === 'player' ? 'enemy' : 'player';
    
    // Get attacker
    const attacker = attackerField[attackerCol]?.[attackerRow];
    if (!attacker) {
      console.log('[GameRoom] No attacker at', attackerCol, attackerRow);
      return { success: false, reason: 'NO_ATTACKER' };
    }
    
    // Check attacker can attack (more lenient for multiplayer sync)
    if (attacker.tapped) {
      console.log('[GameRoom] Attacker is tapped');
      return { success: false, reason: 'ATTACKER_TAPPED' };
    }
    
    // Get target
    const target = targetField[targetCol]?.[targetRow];
    if (!target) {
      console.log('[GameRoom] No target at', targetCol, targetRow);
      return { success: false, reason: 'INVALID_TARGET' };
    }
    
    // Calculate damage
    let damage = attacker.currentAtk || attacker.attack || 1;
    
    // Add support bonus
    const supportCol = playerRole === 'player' ? 0 : 1;
    const support = attackerField[supportCol]?.[attackerRow];
    if (support && attackerCol !== supportCol) {
      damage += support.currentAtk || support.attack || 0;
    }
    
    // Apply bleed (doubles damage)
    if (target.bleedTurns > 0) {
      damage *= 2;
    }
    
    console.log('[GameRoom] Attack:', attacker.name, 'vs', target.name, 'damage:', damage);
    
    collectEvent('ATTACK_DECLARED', {
      attacker: this.serializeCryptid(attacker),
      attackerCol,
      attackerRow,
      targetCol,
      targetRow,
      attackerOwner: playerRole,
      targetOwner
    });
    
    // Apply damage
    const hpBefore = target.currentHp;
    target.currentHp -= damage;
    
    collectEvent('DAMAGE_DEALT', {
      targetId: target.id,
      targetName: target.name,
      target: this.serializeCryptid(target),
      damage,
      isCritical: damage >= 5,
      targetCol,
      targetRow,
      targetOwner,
      hpBefore,
      hpAfter: target.currentHp
    });
    
    // Tap attacker
    attacker.tapped = true;
    attacker.canAttack = false;
    
    // Check for death
    if (target.currentHp <= 0) {
      this.processDeath(target, targetOwner, targetCol, targetRow, attacker, collectEvent);
    }
    
    return { success: true };
  }
  
  processDeath(cryptid, owner, col, row, killer, collectEvent) {
    const gs = this.gameState;
    const field = owner === 'player' ? gs.playerField : gs.enemyField;
    
    // Remove from field
    field[col][row] = null;
    
    // Increment death counter
    if (owner === 'player') {
      gs.playerDeaths++;
    } else {
      gs.enemyDeaths++;
    }
    
    collectEvent('CRYPTID_DIED', {
      cryptid: this.serializeCryptid(cryptid),
      slot: { col, row },
      owner,
      killedBy: killer ? 'attack' : 'effect',
      newDeathCount: owner === 'player' ? gs.playerDeaths : gs.enemyDeaths
    });
    
    // Check for support promotion
    const combatCol = owner === 'player' ? 1 : 0;
    const supportCol = owner === 'player' ? 0 : 1;
    
    if (col === combatCol) {
      const support = field[supportCol][row];
      if (support) {
        // Promote support to combat
        field[combatCol][row] = support;
        field[supportCol][row] = null;
        support.col = combatCol;
        
        collectEvent('CRYPTID_PROMOTED', {
          cryptid: this.serializeCryptid(support),
          fromSlot: { col: supportCol, row },
          toSlot: { col: combatCol, row },
          owner
        });
      }
    }
  }
  
  executeEvolution(playerRole, payload, collectEvent) {
    // Simplified evolution - you'd expand based on your card registry
    return { success: false, reason: 'NOT_IMPLEMENTED' };
  }
  
  executePlayBurst(playerRole, payload, collectEvent) {
    // Simplified burst playing
    return { success: false, reason: 'NOT_IMPLEMENTED' };
  }
  
  executePlayTrap(playerRole, payload, collectEvent) {
    const gs = this.gameState;
    const { cardId, slotRow } = payload;
    
    const hand = playerRole === 'player' ? gs.playerHand : gs.enemyHand;
    const traps = playerRole === 'player' ? gs.playerTraps : gs.enemyTraps;
    const pyre = playerRole === 'player' ? gs.playerPyre : gs.enemyPyre;
    
    // Find trap in hand
    const cardIndex = hand.findIndex(c => c.id === cardId && c.type === 'trap');
    if (cardIndex === -1) {
      return { success: false, reason: 'CARD_NOT_IN_HAND' };
    }
    
    const trap = hand[cardIndex];
    
    // Check pyre
    if ((trap.cost || 0) > pyre) {
      return { success: false, reason: 'INSUFFICIENT_PYRE' };
    }
    
    // Check slot
    if (slotRow < 0 || slotRow > 1 || traps[slotRow] !== null) {
      return { success: false, reason: 'INVALID_SLOT' };
    }
    
    // Execute
    hand.splice(cardIndex, 1);
    if (playerRole === 'player') {
      gs.playerPyre -= trap.cost || 0;
    } else {
      gs.enemyPyre -= trap.cost || 0;
    }
    
    traps[slotRow] = { ...trap, faceDown: true };
    
    console.log('[GameRoom] Trap set by', playerRole, 'at slot', slotRow);
    
    collectEvent('TRAP_SET', {
      owner: playerRole,
      slotRow,
      // Don't reveal trap identity to opponent
    });
    
    return { success: true };
  }
  
  executeUseAbility(playerRole, payload, collectEvent) {
    // Simplified ability use
    return { success: false, reason: 'NOT_IMPLEMENTED' };
  }
  
  executePyreBurn(playerRole, collectEvent) {
    const gs = this.gameState;
    
    const usedFlag = playerRole === 'player' ? 'playerPyreBurnUsed' : 'enemyPyreBurnUsed';
    if (gs[usedFlag]) {
      return { success: false, reason: 'PYRE_BURN_ALREADY_USED' };
    }
    
    const deaths = playerRole === 'player' ? gs.playerDeaths : gs.enemyDeaths;
    if (deaths === 0) {
      return { success: false, reason: 'NO_DEATHS' };
    }
    
    // Gain pyre equal to deaths
    if (playerRole === 'player') {
      gs.playerPyre += deaths;
    } else {
      gs.enemyPyre += deaths;
    }
    gs[usedFlag] = true;
    
    collectEvent('PYRE_BURN_USED', {
      owner: playerRole,
      pyreGained: deaths,
      newTotal: playerRole === 'player' ? gs.playerPyre : gs.enemyPyre
    });
    
    // Draw cards equal to deaths
    for (let i = 0; i < deaths; i++) {
      this.drawCard(playerRole, collectEvent);
    }
    
    console.log('[GameRoom] Pyre burn used by', playerRole, 'gained:', deaths, 'pyre');
    
    return { success: true };
  }
  
  executeEndConjure1(playerRole, collectEvent) {
    const gs = this.gameState;
    
    if (gs.phase !== 'conjure1') {
      return { success: false, reason: 'WRONG_PHASE' };
    }
    
    gs.phase = 'combat';
    
    // Untap and enable attacks for owner's cryptids
    const field = playerRole === 'player' ? gs.playerField : gs.enemyField;
    for (let col = 0; col < 2; col++) {
      for (let row = 0; row < 3; row++) {
        const cryptid = field[col][row];
        if (cryptid && !cryptid.justSummoned) {
          cryptid.canAttack = true;
        }
        if (cryptid) {
          cryptid.justSummoned = false;
        }
      }
    }
    
    collectEvent('PHASE_CHANGED', {
      phase: 'combat',
      owner: playerRole
    });
    
    console.log('[GameRoom] Conjure1 ended by', playerRole, '- moving to combat phase');
    
    return { success: true };
  }
  
  executeEndCombat(playerRole, collectEvent) {
    const gs = this.gameState;
    
    if (gs.phase !== 'combat') {
      return { success: false, reason: 'WRONG_PHASE' };
    }
    
    gs.phase = 'conjure2';
    
    collectEvent('PHASE_CHANGED', {
      phase: 'conjure2',
      owner: playerRole
    });
    
    console.log('[GameRoom] Combat ended by', playerRole, '- moving to conjure2 phase');
    
    return { success: true };
  }
  
  executeEndTurn(playerRole, collectEvent) {
    const gs = this.gameState;
    
    // Process end of turn effects
    // (Simplified - you'd process radiance, regen, etc.)
    
    // Switch turn
    const nextPlayer = playerRole === 'player' ? 'enemy' : 'player';
    gs.currentTurn = nextPlayer;
    gs.phase = 'conjure1';
    gs.turnNumber++;
    
    // Reset turn flags
    gs.playerKindlingPlayedThisTurn = false;
    gs.enemyKindlingPlayedThisTurn = false;
    
    // Give pyre to next player
    if (nextPlayer === 'player') {
      gs.playerPyre++;
    } else {
      gs.enemyPyre++;
    }
    
    collectEvent('TURN_ENDED', {
      owner: playerRole
    });
    
    collectEvent('PYRE_CHANGED', {
      owner: nextPlayer,
      amount: 1,
      newTotal: nextPlayer === 'player' ? gs.playerPyre : gs.enemyPyre
    });
    
    // Draw card for next player
    this.drawCard(nextPlayer, collectEvent);
    
    // Untap next player's cryptids
    const nextField = nextPlayer === 'player' ? gs.playerField : gs.enemyField;
    for (let col = 0; col < 2; col++) {
      for (let row = 0; row < 3; row++) {
        const cryptid = nextField[col][row];
        if (cryptid) {
          if (!cryptid.paralyzed) {
            cryptid.tapped = false;
            cryptid.canAttack = true;
          }
        }
      }
    }
    
    collectEvent('TURN_STARTED', {
      owner: nextPlayer,
      turnNumber: gs.turnNumber
    });
    
    console.log('[GameRoom] Turn ended by', playerRole, '- now', nextPlayer, 'turn', gs.turnNumber);
    
    return { success: true };
  }
  
  executeConcede(playerRole, collectEvent) {
    const winner = playerRole === 'player' ? 'enemy' : 'player';
    
    collectEvent('PLAYER_CONCEDED', {
      conceded: playerRole,
      winner: winner
    });
    
    console.log('[GameRoom]', playerRole, 'conceded - winner:', winner);
    
    this.endMatch(winner, 'concede');
    return { success: true };
  }
  
  // ==================== HELPERS ====================
  
  drawCard(playerRole, collectEvent) {
    const gs = this.gameState;
    const deck = playerRole === 'player' ? gs.playerDeck : gs.enemyDeck;
    const hand = playerRole === 'player' ? gs.playerHand : gs.enemyHand;
    
    if (deck.length === 0) return;
    
    const card = deck.shift();
    hand.push(card);
    
    collectEvent('CARD_DRAWN', {
      card: this.serializeCryptid(card),
      owner: playerRole
    });
  }
  
  serializeCryptid(cryptid) {
    if (!cryptid) return null;
    
    return {
      id: cryptid.id,
      key: cryptid.key,
      name: cryptid.name,
      type: cryptid.type,
      cost: cryptid.cost,
      hp: cryptid.hp,
      atk: cryptid.atk,
      currentHp: cryptid.currentHp,
      currentAtk: cryptid.currentAtk,
      maxHp: cryptid.maxHp,
      baseAtk: cryptid.baseAtk,
      owner: cryptid.owner,
      col: cryptid.col,
      row: cryptid.row,
      tapped: cryptid.tapped,
      canAttack: cryptid.canAttack,
      burnTurns: cryptid.burnTurns || 0,
      bleedTurns: cryptid.bleedTurns || 0,
      paralyzed: cryptid.paralyzed || false,
      rarity: cryptid.rarity,
      isKindling: cryptid.isKindling
    };
  }
  
  requiresTurn(actionType) {
    const alwaysValid = ['CONCEDE', 'SEND_EMOTE', 'CHAT'];
    return !alwaysValid.includes(actionType);
  }
  
  isValidForPhase(actionType, phase) {
    const phaseActions = {
      conjure1: ['SUMMON_CRYPTID', 'SUMMON_KINDLING', 'PLAY_BURST', 'PLAY_TRAP', 'PLAY_AURA', 'EVOLVE_CRYPTID', 'PYRE_BURN', 'END_CONJURE1', 'CONCEDE'],
      combat: ['ATTACK', 'USE_ABILITY', 'PLAY_BURST', 'END_COMBAT', 'CONCEDE'],
      conjure2: ['SUMMON_CRYPTID', 'SUMMON_KINDLING', 'PLAY_BURST', 'PLAY_TRAP', 'PLAY_AURA', 'EVOLVE_CRYPTID', 'PYRE_BURN', 'END_TURN', 'CONCEDE']
    };
    
    return phaseActions[phase]?.includes(actionType) ?? false;
  }
  
  rejectAction(ws, actionId, reason) {
    ws.send(JSON.stringify({
      type: 'ACTION_REJECTED',
      actionId,
      reason
    }));
  }
  
  broadcastActionResult(actionId, actor, events) {
    const message = {
      type: 'ACTION_RESULT',
      actionId,
      success: true,
      actor,
      events,
      sequence: this.sequence,
      stateChecksum: this.calculateChecksum()
    };
    
    this.broadcast(message);
  }
  
  broadcast(message) {
    const msgStr = JSON.stringify(message);
    for (const [ws, player] of this.players) {
      if (player.connected) {
        try {
          ws.send(msgStr);
        } catch (e) {
          console.error('Failed to send to player:', e);
        }
      }
    }
  }
  
  broadcastToOthers(excludeWs, message) {
    const msgStr = JSON.stringify(message);
    for (const [ws, player] of this.players) {
      if (ws !== excludeWs && player.connected) {
        try {
          ws.send(msgStr);
        } catch (e) {
          console.error('Failed to send to player:', e);
        }
      }
    }
  }
  
  broadcastChat(player, message) {
    this.broadcast({
      type: 'CHAT',
      from: player.role,
      message: message.substring(0, 200) // Limit length
    });
  }
  
  sendStateSync(ws, player) {
    const playerRole = player.role === 'player1' ? 'player' : 'enemy';
    
    // Check if game state exists
    if (!this.gameState) {
      console.warn('[GameRoom] sendStateSync called but game not started');
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'Game not started yet'
      }));
      return;
    }
    
    const fullState = this.getStateForPlayer(playerRole);
    if (!fullState) {
      console.error('[GameRoom] Failed to get state for player');
      return;
    }
    
    ws.send(JSON.stringify({
      type: 'STATE_SYNC',
      sequence: this.sequence,
      fullState: fullState,
      matchStarted: this.matchStarted,
      isYourTurn: this.gameState.currentTurn === playerRole
    }));
  }
  
  getStateForPlayer(playerRole) {
    const gs = this.gameState;
    
    // Return null if game state not initialized
    if (!gs) {
      console.error('[GameRoom] getStateForPlayer called but gameState is null');
      return null;
    }
    
    // Map perspective - player always sees themselves as 'player'
    if (playerRole === 'player') {
      return {
        playerField: this.serializeField(gs.playerField),
        enemyField: this.serializeField(gs.enemyField),
        yourHand: gs.playerHand.map(c => this.serializeCryptid(c)),
        opponentHandCount: gs.enemyHand.length,
        playerPyre: gs.playerPyre,
        enemyPyre: gs.enemyPyre,
        playerDeaths: gs.playerDeaths,
        enemyDeaths: gs.enemyDeaths,
        currentTurn: gs.currentTurn,
        phase: gs.phase,
        turnNumber: gs.turnNumber,
        yourTraps: gs.playerTraps,
        opponentTrapCount: gs.enemyTraps.filter(t => t).length,
        yourDeckCount: gs.playerDeck.length,
        opponentDeckCount: gs.enemyDeck.length,
        yourKindling: gs.playerKindling.map(c => this.serializeCryptid(c)),
        kindlingPlayedThisTurn: gs.playerKindlingPlayedThisTurn,
        pyreBurnUsed: gs.playerPyreBurnUsed
      };
    } else {
      // Flip perspective for enemy
      return {
        playerField: this.serializeField(gs.enemyField),
        enemyField: this.serializeField(gs.playerField),
        yourHand: gs.enemyHand.map(c => this.serializeCryptid(c)),
        opponentHandCount: gs.playerHand.length,
        playerPyre: gs.enemyPyre,
        enemyPyre: gs.playerPyre,
        playerDeaths: gs.enemyDeaths,
        enemyDeaths: gs.playerDeaths,
        currentTurn: gs.currentTurn === 'player' ? 'enemy' : 'player',
        phase: gs.phase,
        turnNumber: gs.turnNumber,
        yourTraps: gs.enemyTraps,
        opponentTrapCount: gs.playerTraps.filter(t => t).length,
        yourDeckCount: gs.enemyDeck.length,
        opponentDeckCount: gs.playerDeck.length,
        yourKindling: gs.enemyKindling.map(c => this.serializeCryptid(c)),
        kindlingPlayedThisTurn: gs.enemyKindlingPlayedThisTurn,
        pyreBurnUsed: gs.enemyPyreBurnUsed
      };
    }
  }
  
  serializeField(field) {
    // Return same 2D structure: field[col][row]
    const result = [
      [null, null, null],
      [null, null, null]
    ];
    for (let col = 0; col < 2; col++) {
      for (let row = 0; row < 3; row++) {
        const cryptid = field[col]?.[row];
        if (cryptid) {
          result[col][row] = this.serializeCryptid(cryptid);
        }
      }
    }
    return result;
  }
  
  calculateChecksum() {
    const gs = this.gameState;
    const data = JSON.stringify({
      pp: gs.playerPyre,
      ep: gs.enemyPyre,
      pd: gs.playerDeaths,
      ed: gs.enemyDeaths,
      t: gs.currentTurn,
      p: gs.phase,
      tn: gs.turnNumber
    });
    
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(16);
  }
  
  // ==================== GAME END ====================
  
  checkGameOver() {
    const gs = this.gameState;
    
    if (gs.playerDeaths >= 10) {
      this.endMatch('enemy', 'deaths');
    } else if (gs.enemyDeaths >= 10) {
      this.endMatch('player', 'deaths');
    }
  }
  
  endMatch(winner, reason) {
    this.matchEnded = true;
    this.clearTurnTimer();
    
    this.broadcast({
      type: 'GAME_ENDED',
      winner,
      reason,
      finalState: this.gameState ? {
        playerDeaths: this.gameState.playerDeaths,
        enemyDeaths: this.gameState.enemyDeaths,
        turnNumber: this.gameState.turnNumber
      } : null
    });
  }
  
  handleForfeit(disconnectedRole) {
    const winner = disconnectedRole === 'player1' ? 'enemy' : 'player';
    this.endMatch(winner, 'forfeit');
  }
  
  // ==================== TURN TIMER ====================
  
  startTurnTimer() {
    this.clearTurnTimer();
    
    this.turnTimerTimeout = setTimeout(() => {
      this.handleTurnTimeout();
    }, this.turnTimeLimit);
  }
  
  resetTurnTimer() {
    this.startTurnTimer();
  }
  
  clearTurnTimer() {
    if (this.turnTimerTimeout) {
      clearTimeout(this.turnTimerTimeout);
      this.turnTimerTimeout = null;
    }
  }
  
  handleTurnTimeout() {
    if (this.matchEnded || !this.gameState) return;
    
    const currentPlayer = this.gameState.currentTurn;
    
    this.broadcast({
      type: 'TURN_TIMEOUT',
      player: currentPlayer
    });
    
    // Auto-end turn
    const collectEvent = (type, data) => {};
    this.executeEndTurn(currentPlayer, collectEvent);
    
    // Broadcast the turn change
    this.broadcast({
      type: 'TURN_STARTED',
      owner: this.gameState.currentTurn,
      turnNumber: this.gameState.turnNumber
    });
    
    this.startTurnTimer();
  }
}
