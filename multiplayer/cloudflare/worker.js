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
    
    // Connected players
    this.players = new Map(); // WebSocket -> { role: 'player1'|'player2', info: {...} }
    
    // Game state
    this.gameState = null;
    this.sequence = 0;
    this.actionHistory = [];
    
    // Match state
    this.matchStarted = false;
    this.matchEnded = false;
    
    // Turn timer
    this.turnTimerTimeout = null;
    this.turnTimeLimit = 90000; // 90 seconds per turn
    
    // Matchmaking lobby mode
    this.isLobby = false;
    this.matchmakingQueue = []; // Array of { ws, joinedAt }
  }
  
  // Handle incoming WebSocket connections
  async fetch(request) {
    const url = new URL(request.url);
    const matchId = url.pathname.split('/')[2];
    
    // Check if this is the matchmaking lobby
    if (matchId && matchId.startsWith('QUEUE_')) {
      this.isLobby = true;
      return this.handleLobbyConnection(request);
    }
    
    // Regular game room handling
    return this.handleGameRoomConnection(request);
  }
  
  // Handle matchmaking lobby connections
  async handleLobbyConnection(request) {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    
    this.state.acceptWebSocket(server);
    
    // Add to matchmaking queue
    const queueEntry = {
      ws: server,
      joinedAt: Date.now()
    };
    this.matchmakingQueue.push(queueEntry);
    
    console.log(`Player joined matchmaking queue. Queue size: ${this.matchmakingQueue.length}`);
    
    // Send queue status
    server.send(JSON.stringify({
      type: 'QUEUE_JOINED',
      position: this.matchmakingQueue.length,
      queueSize: this.matchmakingQueue.length
    }));
    
    // Try to match players
    this.tryMatchPlayers();
    
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
  
  // Try to pair players in the queue
  tryMatchPlayers() {
    // Need at least 2 players
    while (this.matchmakingQueue.length >= 2) {
      const player1 = this.matchmakingQueue.shift();
      const player2 = this.matchmakingQueue.shift();
      
      // Check both are still connected
      try {
        // Generate a new match ID
        const matchId = this.generateQuickMatchId();
        
        console.log(`Matching players into room: ${matchId}`);
        
        // Send match found to both players
        const matchFoundMsg = JSON.stringify({
          type: 'MATCH_FOUND',
          matchId: matchId,
          message: 'Match found! Connecting to game...'
        });
        
        player1.ws.send(matchFoundMsg);
        player2.ws.send(matchFoundMsg);
        
        // Create the game room and add both players
        // We'll tell clients to reconnect to the new room
        const gameRoomId = this.env.GAME_ROOMS.idFromName(matchId);
        const gameRoom = this.env.GAME_ROOMS.get(gameRoomId);
        
        // Send redirect to both players (they'll reconnect to the actual game room)
        const redirectMsg = JSON.stringify({
          type: 'REDIRECT_TO_MATCH',
          matchId: matchId,
          wsUrl: `wss://${this.env.WORKER_HOST || 'cryptid-new.brenden-6ce.workers.dev'}/match/${matchId}`
        });
        
        player1.ws.send(redirectMsg);
        player2.ws.send(redirectMsg);
        
        // Close lobby connections (players will reconnect to game room)
        setTimeout(() => {
          try { player1.ws.close(1000, 'Match found - reconnecting'); } catch(e) {}
          try { player2.ws.close(1000, 'Match found - reconnecting'); } catch(e) {}
        }, 500);
        
      } catch (error) {
        console.error('Error matching players:', error);
        // Put players back in queue if something went wrong
        this.matchmakingQueue.unshift(player2);
        this.matchmakingQueue.unshift(player1);
        break;
      }
    }
    
    // Update queue positions for remaining players
    this.matchmakingQueue.forEach((entry, index) => {
      try {
        entry.ws.send(JSON.stringify({
          type: 'QUEUE_UPDATE',
          position: index + 1,
          queueSize: this.matchmakingQueue.length
        }));
      } catch (e) {
        // Player disconnected, will be cleaned up
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
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    
    // Accept the WebSocket
    this.state.acceptWebSocket(server);
    
    // Determine player role
    const existingPlayers = [...this.players.values()];
    let role;
    
    if (existingPlayers.length === 0) {
      role = 'player1';
    } else if (existingPlayers.length === 1) {
      role = 'player2';
    } else {
      // Room is full - reject
      server.close(4000, 'Room is full');
      return new Response(null, { status: 400 });
    }
    
    // Store player info
    this.players.set(server, {
      role,
      connected: true,
      joinedAt: Date.now()
    });
    
    console.log(`Player joined as ${role}, total players: ${this.players.size}`);
    
    // Send welcome message
    server.send(JSON.stringify({
      type: 'MATCH_JOINED',
      yourRole: role === 'player1' ? 'player' : 'enemy',
      playersConnected: this.players.size,
      waitingForOpponent: this.players.size < 2
    }));
    
    // If both players are now connected, start the game
    if (this.players.size === 2 && !this.matchStarted) {
      this.startMatch();
    }
    
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
  
  // Handle WebSocket messages
  async webSocketMessage(ws, message) {
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
    
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
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
          
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: error.message
      }));
    }
  }
  
  // Handle WebSocket close
  async webSocketClose(ws, code, reason) {
    // Handle lobby mode disconnections
    if (this.isLobby) {
      this.removeFromQueue(ws);
      console.log(`Player left matchmaking queue. Queue size: ${this.matchmakingQueue.length}`);
      return;
    }
    
    const player = this.players.get(ws);
    if (player) {
      console.log(`Player ${player.role} disconnected: ${code} ${reason}`);
      
      // Mark as disconnected but don't remove yet (allow reconnect)
      player.connected = false;
      player.disconnectedAt = Date.now();
      
      // Notify other player
      this.broadcastToOthers(ws, {
        type: 'OPPONENT_DISCONNECTED',
        reconnectWindow: 60000
      });
      
      // Set timeout to forfeit if no reconnect
      setTimeout(() => {
        if (!player.connected) {
          this.handleForfeit(player.role);
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
        eventType,
        data,
        sequence: this.sequence++
      });
    };
    
    switch (action.actionType) {
      case 'SUMMON_CRYPTID':
        return this.executeSummon(playerRole, action.payload, collectEvent);
        
      case 'SUMMON_KINDLING':
        return this.executeSummonKindling(playerRole, action.payload, collectEvent);
        
      case 'ATTACK':
        return this.executeAttack(playerRole, action.payload, collectEvent);
        
      case 'EVOLVE_CRYPTID':
        return this.executeEvolution(playerRole, action.payload, collectEvent);
        
      case 'PLAY_BURST':
        return this.executePlayBurst(playerRole, action.payload, collectEvent);
        
      case 'PLAY_TRAP':
        return this.executePlayTrap(playerRole, action.payload, collectEvent);
        
      case 'USE_ABILITY':
        return this.executeUseAbility(playerRole, action.payload, collectEvent);
        
      case 'PYRE_BURN':
        return this.executePyreBurn(playerRole, collectEvent);
        
      case 'END_CONJURE1':
        return this.executeEndConjure1(playerRole, collectEvent);
        
      case 'END_COMBAT':
        return this.executeEndCombat(playerRole, collectEvent);
        
      case 'END_TURN':
        return this.executeEndTurn(playerRole, collectEvent);
        
      case 'CONCEDE':
        return this.executeConcede(playerRole, collectEvent);
        
      default:
        return { success: false, reason: 'UNKNOWN_ACTION' };
    }
  }
  
  // ==================== ACTION EXECUTORS ====================
  
  executeSummon(playerRole, payload, collectEvent) {
    const gs = this.gameState;
    const { cardId, targetSlot } = payload;
    
    // Get hand and pyre
    const hand = playerRole === 'player' ? gs.playerHand : gs.enemyHand;
    const pyre = playerRole === 'player' ? gs.playerPyre : gs.enemyPyre;
    const field = playerRole === 'player' ? gs.playerField : gs.enemyField;
    
    // Find card in hand
    const cardIndex = hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      return { success: false, reason: 'CARD_NOT_IN_HAND' };
    }
    
    const card = hand[cardIndex];
    
    // Check pyre cost
    if ((card.cost || 0) > pyre) {
      return { success: false, reason: 'INSUFFICIENT_PYRE' };
    }
    
    // Check slot is valid
    const { col, row } = targetSlot;
    if (col < 0 || col > 1 || row < 0 || row > 2) {
      return { success: false, reason: 'INVALID_SLOT' };
    }
    
    // Check slot is empty (or valid for cryptid placement)
    const combatCol = playerRole === 'player' ? 1 : 0;
    const supportCol = playerRole === 'player' ? 0 : 1;
    
    // Cryptids go to combat first, then support
    if (field[combatCol][row] !== null && col === combatCol) {
      if (field[supportCol][row] !== null) {
        return { success: false, reason: 'INVALID_SLOT' };
      }
      // Redirect to support if combat is full
      targetSlot.col = supportCol;
    } else if (field[col][row] !== null) {
      return { success: false, reason: 'INVALID_SLOT' };
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
      col: targetSlot.col,
      row: targetSlot.row,
      currentHp: card.hp,
      currentAtk: card.atk,
      maxHp: card.hp,
      baseAtk: card.atk,
      tapped: false,
      canAttack: false, // Summoning sickness
      burnTurns: 0,
      bleedTurns: 0,
      paralyzed: false
    };
    
    field[targetSlot.col][targetSlot.row] = summonedCryptid;
    
    collectEvent('PYRE_CHANGED', {
      owner: playerRole,
      amount: -(card.cost || 0),
      newTotal: playerRole === 'player' ? gs.playerPyre : gs.enemyPyre
    });
    
    collectEvent('CRYPTID_SUMMONED', {
      cryptid: this.serializeCryptid(summonedCryptid),
      slot: targetSlot,
      owner: playerRole
    });
    
    // Process onSummon effects (simplified - you'd expand this)
    // this.processOnSummonEffects(summonedCryptid, playerRole, collectEvent);
    
    return { success: true, events: [] };
  }
  
  executeSummonKindling(playerRole, payload, collectEvent) {
    const gs = this.gameState;
    const { cardId, targetSlot } = payload;
    
    // Check if kindling already played this turn
    const playedFlag = playerRole === 'player' ? 'playerKindlingPlayedThisTurn' : 'enemyKindlingPlayedThisTurn';
    if (gs[playedFlag]) {
      return { success: false, reason: 'KINDLING_ALREADY_PLAYED' };
    }
    
    // Get kindling pool
    const kindlingPool = playerRole === 'player' ? gs.playerKindling : gs.enemyKindling;
    const field = playerRole === 'player' ? gs.playerField : gs.enemyField;
    
    // Find kindling in pool
    const kindlingIndex = kindlingPool.findIndex(c => c.id === cardId);
    if (kindlingIndex === -1) {
      return { success: false, reason: 'CARD_NOT_IN_KINDLING' };
    }
    
    const kindling = kindlingPool[kindlingIndex];
    const { col, row } = targetSlot;
    
    // Validate slot
    if (field[col]?.[row] !== null) {
      return { success: false, reason: 'INVALID_SLOT' };
    }
    
    // Execute summon
    kindlingPool.splice(kindlingIndex, 1);
    gs[playedFlag] = true;
    
    const summonedKindling = {
      ...kindling,
      owner: playerRole,
      col,
      row,
      currentHp: kindling.hp,
      currentAtk: kindling.atk,
      maxHp: kindling.hp,
      baseAtk: kindling.atk,
      tapped: false,
      canAttack: false,
      isKindling: true
    };
    
    field[col][row] = summonedKindling;
    
    collectEvent('KINDLING_SUMMONED', {
      cryptid: this.serializeCryptid(summonedKindling),
      slot: targetSlot,
      owner: playerRole
    });
    
    return { success: true, events: [] };
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
      return { success: false, reason: 'NO_ATTACKER' };
    }
    
    // Check attacker can attack
    if (attacker.tapped || !attacker.canAttack) {
      return { success: false, reason: 'CANNOT_ATTACK' };
    }
    
    // Get target
    const target = targetField[targetCol]?.[targetRow];
    if (!target) {
      return { success: false, reason: 'INVALID_TARGET' };
    }
    
    // Validate target is in combat column (unless attacker has flight)
    const targetCombatCol = targetOwner === 'player' ? 1 : 0;
    if (targetCol !== targetCombatCol && !attacker.canTargetAny) {
      return { success: false, reason: 'INVALID_TARGET' };
    }
    
    // Calculate damage
    let damage = attacker.currentAtk;
    
    // Add support bonus
    const supportCol = playerRole === 'player' ? 0 : 1;
    const support = attackerField[supportCol]?.[attackerRow];
    if (support && attackerCol !== supportCol) {
      damage += support.currentAtk;
    }
    
    // Apply bleed (doubles damage)
    if (target.bleedTurns > 0) {
      damage *= 2;
    }
    
    collectEvent('ATTACK_DECLARED', {
      attacker: this.serializeCryptid(attacker),
      attackerSlot: { col: attackerCol, row: attackerRow },
      targetSlot: { col: targetCol, row: targetRow },
      targetOwner
    });
    
    // Apply damage
    const hpBefore = target.currentHp;
    target.currentHp -= damage;
    
    collectEvent('DAMAGE_DEALT', {
      target: this.serializeCryptid(target),
      damage,
      isCritical: damage >= 5,
      slot: { col: targetCol, row: targetRow },
      owner: targetOwner,
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
    
    return { success: true, events: [] };
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
    
    collectEvent('TRAP_SET', {
      owner: playerRole,
      slotRow,
      // Don't reveal trap identity to opponent
    });
    
    return { success: true, events: [] };
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
    
    return { success: true, events: [] };
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
    
    return { success: true, events: [] };
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
    
    return { success: true, events: [] };
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
    
    return { success: true, events: [] };
  }
  
  executeConcede(playerRole, collectEvent) {
    const winner = playerRole === 'player' ? 'enemy' : 'player';
    this.endMatch(winner, 'concede');
    return { success: true, events: [] };
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
    
    ws.send(JSON.stringify({
      type: 'STATE_SYNC',
      sequence: this.sequence,
      fullState: this.getStateForPlayer(playerRole)
    }));
  }
  
  getStateForPlayer(playerRole) {
    const gs = this.gameState;
    
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
    const result = [];
    for (let col = 0; col < 2; col++) {
      for (let row = 0; row < 3; row++) {
        const cryptid = field[col]?.[row];
        if (cryptid) {
          result.push(this.serializeCryptid(cryptid));
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
      finalState: {
        playerDeaths: this.gameState.playerDeaths,
        enemyDeaths: this.gameState.enemyDeaths,
        turnNumber: this.gameState.turnNumber
      }
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
    if (this.matchEnded) return;
    
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
