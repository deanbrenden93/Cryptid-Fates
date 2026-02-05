/**
 * Cryptid Fates - Cloudflare Worker + Durable Object
 * 
 * This is the complete multiplayer server that runs on Cloudflare's edge network.
 * Copy this entire file into your Cloudflare Worker.
 * 
 * Features:
 * - WebSocket connections for real-time gameplay
 * - Durable Object maintains game state
 * - Validates all player actions server-side using SHARED game logic
 * - Broadcasts events to both players
 * 
 * IMPORTANT: This version uses the shared game logic module for consistent
 * game state management between client and server.
 */

// ==================== SHARED GAME LOGIC (INLINE BUNDLE) ====================
// This is the bundled shared module - same logic runs on client and server

const CryptidShared = (function() {
    'use strict';

    // Events Module
    function createGameEvents(options = {}) {
        const debug = options.debug || false;
        const logger = options.logger || console.log;
        const listeners = new Map();

        function log(...args) { if (debug) logger('[Events]', ...args); }

        function on(eventType, callback) {
            if (!listeners.has(eventType)) listeners.set(eventType, new Set());
            listeners.get(eventType).add(callback);
            return () => off(eventType, callback);
        }

        function off(eventType, callback) {
            const set = listeners.get(eventType);
            if (set) set.delete(callback);
        }

        function emit(eventType, data = {}) {
            log('Emit:', eventType);
            const set = listeners.get(eventType);
            if (set) {
                for (const callback of set) {
                    try { callback(data); } catch (e) { console.error('Event error:', e); }
                }
            }
        }

        function clear() { listeners.clear(); }

        return { on, off, emit, clear };
    }

    // Schema Constants
    const GamePhases = {
        CONJURE_1: 'conjure1',
        DEPLOY: 'deploy',
        CONJURE_2: 'conjure2',
        COMBAT: 'combat',
        END_PHASE: 'endPhase'
    };

    // Game State Module
    function createGameState(options = {}) {
        const debug = options.debug || false;
        const logger = options.logger || console.log;
        let events = options.events;

        function log(...args) { if (debug) logger('[GameState]', ...args); }

        const state = {
            playerField: [[null, null, null], [null, null, null]],
            enemyField: [[null, null, null], [null, null, null]],
            playerHand: [],
            enemyHand: [],
            playerKindling: [],
            enemyKindling: [],
            playerDeck: [],
            enemyDeck: [],
            playerPyre: 0,
            enemyPyre: 0,
            playerDeaths: 0,
            enemyDeaths: 0,
            playerTraps: [null, null],
            enemyTraps: [null, null],
            traps: { player: [], enemy: [] },
            currentTurn: 'player',
            phase: GamePhases.CONJURE_1,
            turnNumber: 0,
            gameOver: false,
            winner: null,
            playerKindlingPlayedThisTurn: false,
            enemyKindlingPlayedThisTurn: false,
            playerPyreCardPlayedThisTurn: false,
            enemyPyreCardPlayedThisTurn: false,
            playerPyreBurnUsed: false,
            enemyPyreBurnUsed: false
        };

        function getCombatCol(owner) { return owner === 'player' ? 1 : 0; }
        function getSupportCol(owner) { return owner === 'player' ? 0 : 1; }
        function getField(owner) { return owner === 'player' ? state.playerField : state.enemyField; }
        
        function getFieldCryptid(owner, col, row) {
            const field = getField(owner);
            return field[col]?.[row] || null;
        }
        
        function setFieldCryptid(owner, col, row, cryptid) {
            const field = getField(owner);
            if (field[col]) {
                field[col][row] = cryptid;
                if (cryptid) {
                    cryptid.owner = owner;
                    cryptid.col = col;
                    cryptid.row = row;
                }
            }
        }

        function getSupport(cryptid) {
            if (!cryptid) return null;
            const { owner, row } = cryptid;
            if (cryptid.col === getCombatCol(owner)) {
                return getFieldCryptid(owner, getSupportCol(owner), row);
            }
            return null;
        }

        function isInCombat(cryptid) {
            return cryptid && cryptid.col === getCombatCol(cryptid.owner);
        }

        function getAllCryptids(owner) {
            const field = getField(owner);
            const cryptids = [];
            for (let col = 0; col < 2; col++) {
                for (let row = 0; row < 3; row++) {
                    if (field[col][row]) cryptids.push(field[col][row]);
                }
            }
            return cryptids;
        }

        function isFieldEmpty(owner) {
            return getAllCryptids(owner).length === 0;
        }

        function hasAilments(cryptid) {
            if (!cryptid) return false;
            return (cryptid.burnTurns > 0 || cryptid.bleedTurns > 0 || 
                    cryptid.paralyzed || cryptid.calamityCounters > 0 || cryptid.curseTokens > 0);
        }

        function getEffectiveAtk(cryptid) {
            let atk = cryptid?.currentAtk ?? cryptid?.atk ?? 0;
            if (cryptid?.curseTokens > 0) atk = Math.max(0, atk - cryptid.curseTokens);
            return atk;
        }

        function isSupportNegated(support) {
            return support?.paralyzed || support?.negated;
        }

        function getPyre(owner) {
            return owner === 'player' ? state.playerPyre : state.enemyPyre;
        }

        function modifyPyre(owner, amount) {
            if (owner === 'player') {
                state.playerPyre = Math.max(0, state.playerPyre + amount);
            } else {
                state.enemyPyre = Math.max(0, state.enemyPyre + amount);
            }
            if (events) events.emit('onPyreChange', { owner, amount, newPyre: getPyre(owner) });
        }

        function getHand(owner) {
            return owner === 'player' ? state.playerHand : state.enemyHand;
        }

        function getDeck(owner) {
            return owner === 'player' ? state.playerDeck : state.enemyDeck;
        }

        function getKindling(owner) {
            return owner === 'player' ? state.playerKindling : state.enemyKindling;
        }

        function drawCard(owner) {
            const deck = getDeck(owner);
            const hand = getHand(owner);
            if (deck.length === 0) return null;
            const card = deck.shift();
            hand.push(card);
            if (events) events.emit('onCardDrawn', { card, owner });
            return card;
        }

        function removeFromHand(owner, cardIdOrIndex) {
            const hand = getHand(owner);
            let index = typeof cardIdOrIndex === 'number' ? cardIdOrIndex : 
                        hand.findIndex(c => c.id === cardIdOrIndex);
            if (index >= 0 && index < hand.length) {
                return hand.splice(index, 1)[0];
            }
            return null;
        }

        function findCardInHand(owner, cardId) {
            const hand = getHand(owner);
            return hand.find(c => c.id === cardId) || null;
        }

        function summonCryptid(owner, col, row, cardData) {
            const field = getField(owner);
            if (col < 0 || col > 1 || row < 0 || row > 2) {
                return { success: false, error: 'INVALID_SLOT' };
            }
            if (field[col][row] !== null) {
                return { success: false, error: 'SLOT_OCCUPIED' };
            }
            
            const cryptid = {
                ...cardData,
                owner,
                col,
                row,
                currentHp: cardData.currentHp ?? cardData.hp ?? 1,
                maxHp: cardData.maxHp ?? cardData.hp ?? 1,
                currentAtk: cardData.currentAtk ?? cardData.atk ?? cardData.attack ?? 0,
                baseAtk: cardData.baseAtk ?? cardData.atk ?? cardData.attack ?? 0,
                tapped: false,
                canAttack: false,
                justSummoned: true,
                burnTurns: 0,
                bleedTurns: 0,
                paralyzed: false,
                calamityCounters: 0,
                curseTokens: 0
            };
            
            field[col][row] = cryptid;
            
            if (events) {
                events.emit('onSummon', { cryptid, owner, col, row });
            }
            
            log('Cryptid summoned:', cryptid.name, 'at', col, row);
            return { success: true, cryptid };
        }

        function applyDamage(cryptid, amount) {
            if (!cryptid || amount <= 0) return { dealt: 0, died: false };
            const actualDamage = Math.min(amount, cryptid.currentHp);
            cryptid.currentHp -= actualDamage;
            if (events) events.emit('onDamage', { cryptid, damage: actualDamage });
            return { dealt: actualDamage, died: cryptid.currentHp <= 0 };
        }

        function killCryptid(cryptid, killerOwner = null) {
            if (!cryptid) return null;
            const { owner, col, row } = cryptid;
            const field = getField(owner);
            field[col][row] = null;
            
            if (owner === 'player') state.playerDeaths++;
            else state.enemyDeaths++;
            
            if (events) events.emit('onDeath', { cryptid, owner, col, row, killerOwner });
            
            log('Cryptid killed:', cryptid.name);
            return { cryptid, owner, col, row };
        }

        function promoteSupport(owner, row) {
            const combatCol = getCombatCol(owner);
            const supportCol = getSupportCol(owner);
            const field = getField(owner);
            
            if (field[combatCol][row]) return null;
            const support = field[supportCol][row];
            if (!support) return null;
            
            field[supportCol][row] = null;
            field[combatCol][row] = support;
            support.col = combatCol;
            support.canAttack = true;
            support.tapped = false;
            
            return support;
        }

        function exportState() {
            return {
                playerField: state.playerField.map(col => col.map(c => c ? { ...c } : null)),
                enemyField: state.enemyField.map(col => col.map(c => c ? { ...c } : null)),
                playerHand: state.playerHand.map(c => ({ ...c })),
                enemyHand: state.enemyHand.map(c => ({ ...c })),
                playerKindling: state.playerKindling.map(c => ({ ...c })),
                enemyKindling: state.enemyKindling.map(c => ({ ...c })),
                playerPyre: state.playerPyre,
                enemyPyre: state.enemyPyre,
                playerDeaths: state.playerDeaths,
                enemyDeaths: state.enemyDeaths,
                currentTurn: state.currentTurn,
                phase: state.phase,
                turnNumber: state.turnNumber,
                gameOver: state.gameOver,
                winner: state.winner,
                playerTraps: state.playerTraps.map(t => t ? { ...t } : null),
                enemyTraps: state.enemyTraps.map(t => t ? { ...t } : null),
                playerKindlingPlayedThisTurn: state.playerKindlingPlayedThisTurn,
                enemyKindlingPlayedThisTurn: state.enemyKindlingPlayedThisTurn,
                playerPyreCardPlayedThisTurn: state.playerPyreCardPlayedThisTurn,
                enemyPyreCardPlayedThisTurn: state.enemyPyreCardPlayedThisTurn,
                playerPyreBurnUsed: state.playerPyreBurnUsed,
                enemyPyreBurnUsed: state.enemyPyreBurnUsed
            };
        }

        function importState(data) {
            Object.assign(state, data);
            for (const owner of ['player', 'enemy']) {
                const field = getField(owner);
                for (let col = 0; col < 2; col++) {
                    for (let row = 0; row < 3; row++) {
                        const cryptid = field[col]?.[row];
                        if (cryptid) {
                            cryptid.owner = owner;
                            cryptid.col = col;
                            cryptid.row = row;
                        }
                    }
                }
            }
        }

        return {
            state,
            getCombatCol, getSupportCol, getField, getFieldCryptid, setFieldCryptid,
            getSupport, isInCombat, getAllCryptids, isFieldEmpty, hasAilments,
            getEffectiveAtk, isSupportNegated, getPyre, modifyPyre,
            getHand, getDeck, getKindling, drawCard, removeFromHand, findCardInHand,
            summonCryptid, applyDamage, killCryptid, promoteSupport,
            exportState, importState, events
        };
    }

    // Combat Engine
    function createCombatEngine(options = {}) {
        let gameState = options.gameState;

        function setGameState(gs) { gameState = gs; }

        function validateAttack(attacker, target) {
            if (!attacker) return { valid: false, reason: 'NO_ATTACKER' };
            if (!target) return { valid: false, reason: 'NO_TARGET' };
            if (!gameState) return { valid: false, reason: 'NO_GAME_STATE' };
            if (!gameState.isInCombat(attacker)) return { valid: false, reason: 'ATTACKER_NOT_IN_COMBAT' };
            if (attacker.owner === target.owner) return { valid: false, reason: 'SAME_TEAM' };
            if (attacker.tapped) return { valid: false, reason: 'ATTACKER_TAPPED' };
            if (attacker.paralyzed) return { valid: false, reason: 'ATTACKER_PARALYZED' };
            return { valid: true };
        }

        function calculateDamage(attacker, target) {
            if (!gameState) return { finalDamage: 0 };
            
            let damage = gameState.getEffectiveAtk(attacker);
            
            // Support bonus
            const support = gameState.getSupport(attacker);
            if (support && !gameState.isSupportNegated(support)) {
                damage += support.currentAtk ?? support.atk ?? 0;
            }
            
            // Bleed doubles damage
            if (target.bleedTurns > 0) damage *= 2;
            
            return { finalDamage: Math.max(0, damage) };
        }

        function resolveAttack(attacker, targetOwner, targetCol, targetRow) {
            if (!gameState) return { success: false, error: 'NO_GAME_STATE' };
            
            const target = gameState.getFieldCryptid(targetOwner, targetCol, targetRow);
            const validation = validateAttack(attacker, target);
            if (!validation.valid) return { success: false, error: validation.reason };
            
            const damageCalc = calculateDamage(attacker, target);
            
            // Apply damage
            target.currentHp -= damageCalc.finalDamage;
            
            // Tap attacker
            attacker.tapped = true;
            attacker.canAttack = false;
            
            const result = {
                success: true,
                attacker: { id: attacker.id, name: attacker.name, owner: attacker.owner, col: attacker.col, row: attacker.row },
                target: { id: target.id, name: target.name, owner: target.owner, col: target.col, row: target.row },
                damage: damageCalc.finalDamage,
                targetDied: target.currentHp <= 0
            };
            
            // Process death
            if (result.targetDied) {
                gameState.killCryptid(target, attacker.owner);
                // Auto-promote support
                gameState.promoteSupport(targetOwner, targetRow);
            }
            
            return result;
        }

        return { setGameState, validateAttack, calculateDamage, resolveAttack };
    }

    // Turn Processor
    function createTurnProcessor(options = {}) {
        let gameState = options.gameState;
        let events = options.events;

        function setGameState(gs) { gameState = gs; }
        function setEvents(ev) { events = ev; }

        function processStartTurn(turnOwner) {
            if (!gameState) return { success: false };
            
            gameState.state.turnNumber++;
            gameState.state.currentTurn = turnOwner;
            gameState.state.phase = GamePhases.CONJURE_1;
            
            // Reset flags
            if (turnOwner === 'player') {
                gameState.state.playerKindlingPlayedThisTurn = false;
                gameState.state.playerPyreCardPlayedThisTurn = false;
                gameState.state.playerPyreBurnUsed = false;
            } else {
                gameState.state.enemyKindlingPlayedThisTurn = false;
                gameState.state.enemyPyreCardPlayedThisTurn = false;
                gameState.state.enemyPyreBurnUsed = false;
            }
            
            // Untap cryptids
            const cryptids = gameState.getAllCryptids(turnOwner);
            for (const cryptid of cryptids) {
                if (!cryptid.paralyzed) {
                    cryptid.tapped = false;
                    cryptid.canAttack = true;
                }
                cryptid.justSummoned = false;
                if (cryptid.paralyzed) {
                    cryptid.paralyzed = false;
                }
            }
            
            // Gain pyre
            gameState.modifyPyre(turnOwner, 1);
            
            // Draw card
            gameState.drawCard(turnOwner);
            
            if (events) events.emit('onTurnStart', { turn: gameState.state.turnNumber, owner: turnOwner });
            
            return { success: true, turnNumber: gameState.state.turnNumber };
        }

        function processEndTurn(turnOwner) {
            if (!gameState) return { success: false };
            
            // Process burn/bleed
            const cryptids = gameState.getAllCryptids(turnOwner);
            const deaths = [];
            
            for (const cryptid of cryptids) {
                if (cryptid.burnTurns > 0) {
                    cryptid.currentHp -= 2;
                    cryptid.burnTurns--;
                    if (cryptid.currentHp <= 0) deaths.push(cryptid);
                }
                if (cryptid.bleedTurns > 0) {
                    cryptid.currentHp -= 1;
                    cryptid.bleedTurns--;
                    if (cryptid.currentHp <= 0 && !deaths.includes(cryptid)) deaths.push(cryptid);
                }
                if (cryptid.calamityCounters > 0) {
                    cryptid.calamityCounters--;
                    if (cryptid.calamityCounters <= 0) {
                        cryptid.currentHp = 0;
                        if (!deaths.includes(cryptid)) deaths.push(cryptid);
                    }
                }
            }
            
            // Process deaths
            for (const cryptid of deaths) {
                gameState.killCryptid(cryptid);
                gameState.promoteSupport(cryptid.owner, cryptid.row);
            }
            
            if (events) events.emit('onTurnEnd', { turn: gameState.state.turnNumber, owner: turnOwner });
            
            return { success: true, deaths: deaths.length };
        }

        function advancePhase() {
            if (!gameState) return { success: false };
            
            const current = gameState.state.phase;
            let next;
            
            switch (current) {
                case GamePhases.CONJURE_1: next = GamePhases.COMBAT; break;
                case GamePhases.COMBAT: next = GamePhases.CONJURE_2; break;
                case GamePhases.CONJURE_2: next = GamePhases.END_PHASE; break;
                default: next = GamePhases.CONJURE_1;
            }
            
            gameState.state.phase = next;
            if (events) events.emit('onPhaseChange', { from: current, to: next });
            
            return { success: true, previousPhase: current, currentPhase: next };
        }

        function checkGameOver() {
            if (!gameState) return { gameOver: false };
            
            if (gameState.state.playerDeaths >= 10) {
                return { gameOver: true, winner: 'enemy', reason: 'DEATHS' };
            }
            if (gameState.state.enemyDeaths >= 10) {
                return { gameOver: true, winner: 'player', reason: 'DEATHS' };
            }
            return { gameOver: false };
        }

        return { setGameState, setEvents, processStartTurn, processEndTurn, advancePhase, checkGameOver };
    }

    // Create Game Context
    function createGameContext(options = {}) {
        const events = createGameEvents(options);
        const gameState = createGameState({ ...options, events });
        const combatEngine = createCombatEngine({ gameState });
        const turnProcessor = createTurnProcessor({ gameState, events });
        
        return {
            events,
            gameState,
            combatEngine,
            turnProcessor,
            GamePhases,
            
            reset() {
                gameState.state.playerField = [[null, null, null], [null, null, null]];
                gameState.state.enemyField = [[null, null, null], [null, null, null]];
                gameState.state.playerHand = [];
                gameState.state.enemyHand = [];
                gameState.state.playerDeck = [];
                gameState.state.enemyDeck = [];
                gameState.state.playerKindling = [];
                gameState.state.enemyKindling = [];
                gameState.state.playerPyre = 0;
                gameState.state.enemyPyre = 0;
                gameState.state.playerDeaths = 0;
                gameState.state.enemyDeaths = 0;
                gameState.state.turnNumber = 0;
                gameState.state.gameOver = false;
                gameState.state.winner = null;
            },
            
            exportState() {
                return gameState.exportState();
            },
            
            importState(data) {
                gameState.importState(data);
            }
        };
    }

    return { createGameContext, createGameState, createCombatEngine, createTurnProcessor, GamePhases };
})();

// ==================== MAIN WORKER ====================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }
    
    if (url.pathname.startsWith('/match/')) {
      return handleMatchConnection(request, env, url);
    }
    
    if (url.pathname === '/matchmaking') {
      return handleMatchmaking(request, env);
    }
    
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }
    
    return new Response(JSON.stringify({
      name: 'Cryptid Fates Multiplayer Server',
      version: '2.0.0 (Shared Logic)',
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
  const matchId = url.pathname.split('/')[2];
  
  if (!matchId) {
    return new Response('Match ID required', { status: 400 });
  }
  
  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 });
  }
  
  if (matchId.startsWith('QUEUE_')) {
    const lobbyId = env.GAME_ROOMS.idFromName('__MATCHMAKING_LOBBY__');
    const lobby = env.GAME_ROOMS.get(lobbyId);
    return lobby.fetch(request);
  }
  
  const roomId = env.GAME_ROOMS.idFromName(matchId);
  const room = env.GAME_ROOMS.get(roomId);
  return room.fetch(request);
}

// ==================== MATCHMAKING ====================

async function handleMatchmaking(request, env) {
  if (request.method !== 'POST') {
    return new Response('POST required', { status: 405 });
  }
  
  try {
    const body = await request.json();
    const { playerId } = body;
    
    if (!playerId) {
      return new Response(JSON.stringify({ error: 'playerId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
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

export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    
    this.players = new Map();
    this.playerSlots = { player1: null, player2: null };
    
    // Game context using shared modules
    this.gameContext = null;
    this.sequence = 0;
    this.actionHistory = [];
    
    this.matchStarted = false;
    this.matchEnded = false;
    
    this.turnTimerTimeout = null;
    this.turnTimeLimit = 90000;
    
    this.isLobby = false;
    this.matchmakingQueue = [];
  }
  
  async loadStateFromStorage() {
    if (this._stateLoaded) return;
    this._stateLoaded = true;
    
    try {
      const stored = await this.state.storage.get([
        'gameState', 'matchStarted', 'matchEnded', 'sequence', 'playerSlots'
      ]);
      
      if (stored && stored.get) {
        if (stored.get('gameState')) {
          // Restore game context with saved state
          this.gameContext = CryptidShared.createGameContext({ debug: false });
          this.gameContext.importState(stored.get('gameState'));
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
        if (stored.get('playerSlots')) {
          this.playerSlots = stored.get('playerSlots');
        }
      }
      
      if (!this.playerSlots) {
        this.playerSlots = { player1: null, player2: null };
      }
      
      // Restore WebSocket connections
      try {
        const webSockets = this.state.getWebSockets();
        for (const ws of webSockets) {
          try {
            const attachment = ws.deserializeAttachment();
            if (attachment && attachment.role) {
              const slotData = this.playerSlots?.[attachment.role];
              this.players.set(ws, {
                role: attachment.role,
                connected: true,
                deckSelected: attachment.deckSelected || slotData?.deckSelected || false,
                deckData: slotData?.deckData || null
              });
              if (this.playerSlots[attachment.role]) {
                this.playerSlots[attachment.role].connected = true;
              }
            }
          } catch (wsError) {
            console.error('[GameRoom] Error restoring WebSocket:', wsError);
          }
        }
      } catch (wsError) {
        console.log('[GameRoom] No hibernated WebSockets');
      }
      
    } catch (error) {
      console.error('[GameRoom] Error loading state:', error);
    }
  }
  
  async saveStateToStorage() {
    try {
      await this.state.storage.put({
        gameState: this.gameContext ? this.gameContext.exportState() : null,
        matchStarted: this.matchStarted,
        matchEnded: this.matchEnded,
        sequence: this.sequence,
        playerSlots: this.playerSlots
      });
    } catch (error) {
      console.error('[GameRoom] Error saving state:', error);
    }
  }
  
  async fetch(request) {
    await this.loadStateFromStorage();
    
    try {
      const url = new URL(request.url);
      const matchId = url.pathname.split('/')[2];
      
      if (matchId && matchId.startsWith('QUEUE_')) {
        this.isLobby = true;
        return this.handleLobbyConnection(request);
      }
      
      return this.handleGameRoomConnection(request);
    } catch (error) {
      console.error('[GameRoom] Error in fetch:', error);
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }
  
  async handleLobbyConnection(request) {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    
    this.state.acceptWebSocket(server);
    
    const queueEntry = {
      ws: server,
      joinedAt: Date.now(),
      id: Math.random().toString(36).substring(2, 8)
    };
    this.matchmakingQueue.push(queueEntry);
    
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
    
    setTimeout(() => this.tryMatchPlayers(), 100);
    
    return new Response(null, { status: 101, webSocket: client });
  }
  
  tryMatchPlayers() {
    if (this.matchmakingQueue.length < 2) return;
    
    const player1 = this.matchmakingQueue.shift();
    const player2 = this.matchmakingQueue.shift();
    
    const matchId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const matchInfo = {
      type: 'MATCH_FOUND',
      matchId,
      message: 'Match found! Connecting...'
    };
    
    try {
      player1.ws.send(JSON.stringify({ ...matchInfo, yourRole: 'player1' }));
      player2.ws.send(JSON.stringify({ ...matchInfo, yourRole: 'player2' }));
    } catch (e) {
      console.error('[Lobby] Failed to send match info:', e);
    }
  }
  
  async handleGameRoomConnection(request) {
    try {
      await this.loadStateFromStorage();
      
      // Determine role
      let role = null;
      let isReconnect = false;
      
      // Check for reconnection
      for (const slotRole of ['player1', 'player2']) {
        const slot = this.playerSlots[slotRole];
        if (slot && !slot.connected) {
          role = slotRole;
          isReconnect = true;
          break;
        }
      }
      
      // Assign new slot if not reconnecting
      if (!role) {
        if (!this.playerSlots.player1) {
          role = 'player1';
          this.playerSlots.player1 = { connected: true, deckSelected: false, deckData: null, joinedAt: Date.now() };
        } else if (!this.playerSlots.player2) {
          role = 'player2';
          this.playerSlots.player2 = { connected: true, deckSelected: false, deckData: null, joinedAt: Date.now() };
        } else if (!this.playerSlots.player1.connected) {
          role = 'player1';
          isReconnect = true;
        } else if (!this.playerSlots.player2.connected) {
          role = 'player2';
          isReconnect = true;
        }
      }
      
      if (!role) {
        return new Response('Room is full', { status: 403 });
      }
      
      // Create WebSocket pair
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);
      
      this.state.acceptWebSocket(server);
      server.serializeAttachment({ role, deckSelected: false });
      
      this.playerSlots[role].connected = true;
      
      this.players.set(server, {
        role,
        connected: true,
        deckSelected: this.playerSlots[role]?.deckSelected || false,
        deckData: this.playerSlots[role]?.deckData || null
      });
      
      await this.saveStateToStorage();
      
      const yourRole = role === 'player1' ? 'player' : 'enemy';
      
      // Send appropriate message
      if (isReconnect && this.matchStarted && this.gameContext) {
        server.send(JSON.stringify({
          type: 'RECONNECTED',
          yourRole,
          gameState: this.getStateForPlayer(yourRole),
          matchStarted: true,
          isYourTurn: this.gameContext.gameState.state.currentTurn === yourRole
        }));
        this.broadcastToOthers(server, { type: 'OPPONENT_RECONNECTED' });
      } else if (isReconnect && !this.matchStarted) {
        const hadDeckSelected = this.playerSlots[role]?.deckSelected || false;
        server.send(JSON.stringify({
          type: 'RECONNECTED',
          yourRole,
          matchStarted: false,
          deckSelected: hadDeckSelected
        }));
        this.broadcastToOthers(server, { type: 'OPPONENT_RECONNECTED' });
        
        const bothConnected = this.playerSlots.player1?.connected && this.playerSlots.player2?.connected;
        if (bothConnected) {
          const bothHaveDecks = this.playerSlots.player1?.deckSelected && this.playerSlots.player2?.deckSelected;
          if (bothHaveDecks) {
            this.startMatchWithDecks();
          } else {
            this.notifyBothPlayersConnected();
          }
        }
      } else {
        server.send(JSON.stringify({
          type: 'MATCH_JOINED',
          yourRole,
          playersConnected: this.players.size,
          waitingForOpponent: this.players.size < 2,
          matchStarted: this.matchStarted
        }));
        
        const bothConnected = this.playerSlots.player1?.connected && this.playerSlots.player2?.connected;
        if (bothConnected && !this.matchStarted) {
          this.notifyBothPlayersConnected();
        }
      }
      
      return new Response(null, { status: 101, webSocket: client });
      
    } catch (error) {
      console.error('[GameRoom] Error:', error);
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }
  
  notifyBothPlayersConnected() {
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
    console.log(`[GameRoom] Player ${player.role} selected deck`);
    
    player.deckSelected = true;
    player.deckData = deckData;
    
    ws.serializeAttachment({ role: player.role, deckSelected: true });
    
    if (this.playerSlots[player.role]) {
      this.playerSlots[player.role].deckSelected = true;
      this.playerSlots[player.role].deckData = deckData;
      this.saveStateToStorage();
    }
    
    this.broadcastToOthers(ws, {
      type: 'OPPONENT_DECK_SELECTED',
      message: 'Opponent has selected their deck!'
    });
    
    const p1Ready = this.playerSlots.player1?.deckSelected && this.playerSlots.player1?.connected;
    const p2Ready = this.playerSlots.player2?.deckSelected && this.playerSlots.player2?.connected;
    
    if (p1Ready && p2Ready && !this.matchStarted) {
      this.startMatchWithDecks();
    }
  }
  
  startMatchWithDecks() {
    const connectedPlayers = [...this.players.values()].filter(p => p.connected);
    if (connectedPlayers.length < 2) return;
    
    this.matchStarted = true;
    
    // Create game context using shared modules
    this.gameContext = CryptidShared.createGameContext({ debug: false });
    const gs = this.gameContext.gameState.state;
    
    // Randomly determine first player
    const firstPlayer = Math.random() < 0.5 ? 'player' : 'enemy';
    gs.currentTurn = firstPlayer;
    gs.turnNumber = 1;
    
    // Populate decks from player data
    for (const [ws, player] of this.players) {
      const role = player.role === 'player1' ? 'player' : 'enemy';
      const deckData = this.playerSlots[player.role]?.deckData || player.deckData || {};
      
      const mainCards = (deckData.cards || []).filter(c => !c.isKindling && c.type !== 'kindling');
      const kindlingCards = (deckData.kindling || []).map(k => ({ ...k, isKindling: true }));
      
      const mainDeck = this.shuffleDeck([...mainCards]);
      
      if (role === 'player') {
        gs.playerDeck = mainDeck;
        gs.playerKindling = kindlingCards;
        gs.playerHand = mainDeck.splice(0, 5);
        gs.playerPyre = (firstPlayer === 'player') ? 0 : 1;
      } else {
        gs.enemyDeck = mainDeck;
        gs.enemyKindling = kindlingCards;
        gs.enemyHand = mainDeck.splice(0, 5);
        gs.enemyPyre = (firstPlayer === 'enemy') ? 0 : 1;
      }
    }
    
    // Send game start to both players
    for (const [ws, player] of this.players) {
      const yourRole = player.role === 'player1' ? 'player' : 'enemy';
      const isYourTurn = firstPlayer === yourRole;
      
      try {
        ws.send(JSON.stringify({
          type: 'BOTH_DECKS_SELECTED',
          yourRole,
          firstPlayer,
          isYourTurn,
          initialState: this.getStateForPlayer(yourRole),
          message: 'Both players ready! Starting game...'
        }));
      } catch (e) {
        console.error('[GameRoom] Failed to send game start:', e);
      }
    }
    
    this.saveStateToStorage();
    this.startTurnTimer();
  }
  
  shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }
  
  // Handle WebSocket messages
  async webSocketMessage(ws, message) {
    await this.loadStateFromStorage();
    
    if (this.isLobby) {
      try {
        const data = JSON.parse(message);
        if (data.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', serverTime: Date.now(), queueSize: this.matchmakingQueue.length }));
        } else if (data.type === 'LEAVE_QUEUE') {
          this.removeFromQueue(ws);
        }
      } catch (e) {}
      return;
    }
    
    const player = this.players.get(ws);
    if (!player) return;
    
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      return;
    }
    
    try {
      switch (data.type) {
        case 'DECK_SELECTED':
          if (!this.matchStarted) {
            this.handleDeckSelected(ws, player, data.deck);
          }
          break;
          
        case 'ACTION':
          this.handleAction(ws, player, data);
          break;
          
        case 'PING':
          ws.send(JSON.stringify({ type: 'PONG', serverTime: Date.now() }));
          break;
          
        case 'REQUEST_SYNC':
          this.sendStateSync(ws, player);
          break;
          
        case 'CHAT':
          this.broadcastChat(player, data.message);
          break;
          
        case 'KEEPALIVE':
          ws.send(JSON.stringify({ type: 'KEEPALIVE_ACK' }));
          break;
      }
    } catch (error) {
      console.error('[GameRoom] Error handling message:', error);
      ws.send(JSON.stringify({ type: 'ERROR', message: error.message }));
    }
  }
  
  async webSocketClose(ws, code, reason) {
    await this.loadStateFromStorage();
    
    if (this.isLobby) {
      this.removeFromQueue(ws);
      return;
    }
    
    const player = this.players.get(ws);
    if (player) {
      if (this.playerSlots[player.role]) {
        this.playerSlots[player.role].connected = false;
        this.playerSlots[player.role].disconnectedAt = Date.now();
        await this.saveStateToStorage();
      }
      
      this.players.delete(ws);
      this.broadcastToOthers(ws, { type: 'OPPONENT_DISCONNECTED', reconnectWindow: 60000 });
      
      const disconnectedRole = player.role;
      setTimeout(async () => {
        await this.loadStateFromStorage();
        if (this.playerSlots?.[disconnectedRole] && !this.playerSlots[disconnectedRole].connected) {
          this.handleForfeit(disconnectedRole);
        }
      }, 60000);
    }
  }
  
  removeFromQueue(ws) {
    const index = this.matchmakingQueue.findIndex(entry => entry.ws === ws);
    if (index !== -1) {
      this.matchmakingQueue.splice(index, 1);
    }
  }
  
  async webSocketError(ws, error) {
    console.error('WebSocket error:', error);
  }
  
  // ==================== GAME LOGIC (USING SHARED MODULES) ====================
  
  handleAction(ws, player, action) {
    const playerRole = player.role === 'player1' ? 'player' : 'enemy';
    
    if (!this.gameContext) {
      return this.rejectAction(ws, action.actionId, 'GAME_NOT_INITIALIZED');
    }
    
    const gs = this.gameContext.gameState.state;
    
    if (!this.matchStarted || this.matchEnded) {
      return this.rejectAction(ws, action.actionId, 'GAME_NOT_ACTIVE');
    }
    
    if (this.requiresTurn(action.actionType) && gs.currentTurn !== playerRole) {
      return this.rejectAction(ws, action.actionId, 'NOT_YOUR_TURN');
    }
    
    if (!this.isValidForPhase(action.actionType, gs.phase)) {
      return this.rejectAction(ws, action.actionId, 'WRONG_PHASE');
    }
    
    const result = this.executeAction(playerRole, action);
    
    if (!result.success) {
      return this.rejectAction(ws, action.actionId, result.reason);
    }
    
    this.actionHistory.push({
      sequence: this.sequence,
      player: playerRole,
      action,
      timestamp: Date.now()
    });
    
    this.broadcastActionResult(action.actionId, playerRole, result.events);
    this.saveStateToStorage();
    this.checkGameOver();
    
    if (this.requiresTurn(action.actionType)) {
      this.resetTurnTimer();
    }
  }
  
  executeAction(playerRole, action) {
    const events = [];
    const gs = this.gameContext.gameState;
    const state = gs.state;
    
    const collectEvent = (eventType, data) => {
      events.push({
        type: eventType,
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
        
      case 'PLAY_PYRE_CARD':
        result = this.executePlayPyreCard(playerRole, action.payload, collectEvent);
        break;
        
      case 'PYRE_BURN':
        result = this.executePyreBurn(playerRole, collectEvent);
        break;
        
      case 'EVOLVE_CRYPTID':
        result = this.executeEvolution(playerRole, action.payload, collectEvent);
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
    
    if (result.success) {
      result.events = events;
    }
    
    return result;
  }
  
  // ==================== ACTION EXECUTORS ====================
  
  executeSummon(playerRole, payload, collectEvent) {
    const gs = this.gameContext.gameState;
    const state = gs.state;
    
    const cardId = payload.cardId;
    let col = payload.col ?? payload.targetSlot?.col;
    let row = payload.row ?? payload.targetSlot?.row;
    
    const hand = gs.getHand(playerRole);
    const pyre = gs.getPyre(playerRole);
    const field = gs.getField(playerRole);
    
    let cardIndex = hand.findIndex(c => c.id === cardId);
    
    if (cardIndex === -1 && payload.cardData) {
      hand.push({ ...payload.cardData, id: cardId });
      cardIndex = hand.length - 1;
    }
    
    if (cardIndex === -1) {
      return { success: false, reason: 'CARD_NOT_IN_HAND' };
    }
    
    const card = hand[cardIndex];
    
    if ((card.cost || 0) > pyre) {
      return { success: false, reason: 'INSUFFICIENT_PYRE' };
    }
    
    if (col < 0 || col > 1 || row < 0 || row > 2) {
      return { success: false, reason: 'INVALID_SLOT' };
    }
    
    const combatCol = gs.getCombatCol(playerRole);
    const supportCol = gs.getSupportCol(playerRole);
    
    if (field[col][row] !== null) {
      const otherCol = col === combatCol ? supportCol : combatCol;
      if (field[otherCol][row] === null) {
        col = otherCol;
      } else {
        return { success: false, reason: 'SLOT_OCCUPIED' };
      }
    }
    
    // Execute summon using shared module
    hand.splice(cardIndex, 1);
    gs.modifyPyre(playerRole, -(card.cost || 0));
    
    const summonResult = gs.summonCryptid(playerRole, col, row, card);
    if (!summonResult.success) {
      return { success: false, reason: summonResult.error };
    }
    
    collectEvent('PYRE_CHANGED', {
      owner: playerRole,
      amount: -(card.cost || 0),
      newPyre: gs.getPyre(playerRole)
    });
    
    collectEvent('CRYPTID_SUMMONED', {
      cardId,
      cardName: summonResult.cryptid.name,
      cryptid: this.serializeCryptid(summonResult.cryptid),
      col, row,
      owner: playerRole
    });
    
    return { success: true };
  }
  
  executeSummonKindling(playerRole, payload, collectEvent) {
    const gs = this.gameContext.gameState;
    const state = gs.state;
    
    const cardId = payload.cardId;
    const col = payload.col ?? payload.targetSlot?.col;
    const row = payload.row ?? payload.targetSlot?.row;
    
    const playedFlag = playerRole === 'player' ? 'playerKindlingPlayedThisTurn' : 'enemyKindlingPlayedThisTurn';
    if (state[playedFlag]) {
      return { success: false, reason: 'KINDLING_ALREADY_PLAYED' };
    }
    
    const kindlingPool = gs.getKindling(playerRole);
    const field = gs.getField(playerRole);
    
    let kindlingIndex = kindlingPool.findIndex(c => c.id === cardId);
    
    if (kindlingIndex === -1 && payload.cardData) {
      kindlingPool.push({ ...payload.cardData, id: cardId });
      kindlingIndex = kindlingPool.length - 1;
    }
    
    if (kindlingIndex === -1) {
      return { success: false, reason: 'CARD_NOT_IN_KINDLING' };
    }
    
    const kindling = kindlingPool[kindlingIndex];
    
    if (field[col]?.[row] !== null) {
      return { success: false, reason: 'SLOT_OCCUPIED' };
    }
    
    kindlingPool.splice(kindlingIndex, 1);
    state[playedFlag] = true;
    
    const summonResult = gs.summonCryptid(playerRole, col, row, { ...kindling, isKindling: true });
    if (!summonResult.success) {
      return { success: false, reason: summonResult.error };
    }
    
    collectEvent('KINDLING_SUMMONED', {
      cardId,
      cardName: summonResult.cryptid.name,
      cryptid: this.serializeCryptid(summonResult.cryptid),
      col, row,
      owner: playerRole
    });
    
    return { success: true };
  }
  
  executeAttack(playerRole, payload, collectEvent) {
    const gs = this.gameContext.gameState;
    const combat = this.gameContext.combatEngine;
    
    const { attackerCol, attackerRow, targetCol, targetRow } = payload;
    
    const attackerField = gs.getField(playerRole);
    const targetOwner = playerRole === 'player' ? 'enemy' : 'player';
    
    const attacker = attackerField[attackerCol]?.[attackerRow];
    if (!attacker) {
      return { success: false, reason: 'NO_ATTACKER' };
    }
    
    // Use shared combat engine
    const attackResult = combat.resolveAttack(attacker, targetOwner, targetCol, targetRow);
    
    if (!attackResult.success) {
      return { success: false, reason: attackResult.error };
    }
    
    collectEvent('ATTACK_DECLARED', {
      attacker: this.serializeCryptid(attacker),
      attackerCol, attackerRow,
      targetCol, targetRow,
      attackerOwner: playerRole,
      targetOwner
    });
    
    const target = gs.getFieldCryptid(targetOwner, targetCol, targetRow);
    
    collectEvent('DAMAGE_DEALT', {
      targetId: attackResult.target.id,
      targetName: attackResult.target.name,
      target: target ? this.serializeCryptid(target) : attackResult.target,
      damage: attackResult.damage,
      targetCol, targetRow,
      targetOwner,
      hpAfter: target?.currentHp ?? 0
    });
    
    if (attackResult.targetDied) {
      collectEvent('CRYPTID_DIED', {
        cryptid: attackResult.target,
        slot: { col: targetCol, row: targetRow },
        owner: targetOwner,
        killedBy: 'attack',
        newDeathCount: targetOwner === 'player' ? gs.state.playerDeaths : gs.state.enemyDeaths
      });
      
      // Check for promotion
      const promoted = gs.promoteSupport(targetOwner, targetRow);
      if (promoted) {
        collectEvent('CRYPTID_PROMOTED', {
          cryptid: this.serializeCryptid(promoted),
          fromSlot: { col: gs.getSupportCol(targetOwner), row: targetRow },
          toSlot: { col: gs.getCombatCol(targetOwner), row: targetRow },
          owner: targetOwner
        });
      }
    }
    
    return { success: true };
  }
  
  executePlayPyreCard(playerRole, payload, collectEvent) {
    const gs = this.gameContext.gameState;
    const state = gs.state;
    
    const cardId = payload.cardId;
    const usedFlag = playerRole === 'player' ? 'playerPyreCardPlayedThisTurn' : 'enemyPyreCardPlayedThisTurn';
    
    if (state[usedFlag]) {
      return { success: false, reason: 'PYRE_CARD_ALREADY_PLAYED' };
    }
    
    const hand = gs.getHand(playerRole);
    const cardIndex = hand.findIndex(c => c.id === cardId);
    
    if (cardIndex === -1) {
      return { success: false, reason: 'CARD_NOT_IN_HAND' };
    }
    
    const card = hand[cardIndex];
    if (card.type !== 'pyre') {
      return { success: false, reason: 'NOT_A_PYRE_CARD' };
    }
    
    hand.splice(cardIndex, 1);
    
    let pyreGained = 1;
    gs.modifyPyre(playerRole, pyreGained);
    state[usedFlag] = true;
    
    collectEvent('PYRE_CARD_PLAYED', {
      owner: playerRole,
      cardId,
      cardName: card.name,
      pyreGained,
      newTotal: gs.getPyre(playerRole)
    });
    
    return { success: true };
  }
  
  executePyreBurn(playerRole, collectEvent) {
    const gs = this.gameContext.gameState;
    const state = gs.state;
    
    const usedFlag = playerRole === 'player' ? 'playerPyreBurnUsed' : 'enemyPyreBurnUsed';
    if (state[usedFlag]) {
      return { success: false, reason: 'PYRE_BURN_ALREADY_USED' };
    }
    
    const deaths = playerRole === 'player' ? state.playerDeaths : state.enemyDeaths;
    if (deaths === 0) {
      return { success: false, reason: 'NO_DEATHS' };
    }
    
    gs.modifyPyre(playerRole, deaths);
    state[usedFlag] = true;
    
    collectEvent('PYRE_BURN_USED', {
      owner: playerRole,
      pyreGained: deaths,
      newTotal: gs.getPyre(playerRole)
    });
    
    // Draw cards equal to deaths
    for (let i = 0; i < deaths; i++) {
      const card = gs.drawCard(playerRole);
      if (card) {
        collectEvent('CARD_DRAWN', { card: this.serializeCryptid(card), owner: playerRole });
      }
    }
    
    return { success: true };
  }
  
  executeEvolution(playerRole, payload, collectEvent) {
    return { success: false, reason: 'NOT_IMPLEMENTED' };
  }
  
  executeEndConjure1(playerRole, collectEvent) {
    const result = this.gameContext.turnProcessor.advancePhase();
    
    if (!result.success) {
      return { success: false, reason: 'PHASE_ERROR' };
    }
    
    // Enable attacks for cryptids
    const cryptids = this.gameContext.gameState.getAllCryptids(playerRole);
    for (const cryptid of cryptids) {
      if (!cryptid.justSummoned) {
        cryptid.canAttack = true;
      }
      cryptid.justSummoned = false;
    }
    
    collectEvent('PHASE_CHANGED', { phase: 'combat', owner: playerRole });
    
    return { success: true };
  }
  
  executeEndCombat(playerRole, collectEvent) {
    const gs = this.gameContext.gameState.state;
    
    if (gs.phase !== 'combat') {
      return { success: false, reason: 'WRONG_PHASE' };
    }
    
    gs.phase = 'conjure2';
    
    collectEvent('PHASE_CHANGED', { phase: 'conjure2', owner: playerRole });
    
    return { success: true };
  }
  
  executeEndTurn(playerRole, collectEvent) {
    const tp = this.gameContext.turnProcessor;
    const gs = this.gameContext.gameState;
    const state = gs.state;
    
    // Process end of turn effects
    const endResult = tp.processEndTurn(playerRole);
    
    // Switch turn
    const nextPlayer = playerRole === 'player' ? 'enemy' : 'player';
    state.currentTurn = nextPlayer;
    state.phase = 'conjure1';
    state.turnNumber++;
    
    // Reset flags
    state.playerKindlingPlayedThisTurn = false;
    state.enemyKindlingPlayedThisTurn = false;
    state.playerPyreBurnUsed = false;
    state.enemyPyreBurnUsed = false;
    state.playerPyreCardPlayedThisTurn = false;
    state.enemyPyreCardPlayedThisTurn = false;
    
    // Give pyre to next player
    gs.modifyPyre(nextPlayer, 1);
    
    collectEvent('TURN_ENDED', { owner: playerRole });
    
    collectEvent('PYRE_CHANGED', {
      owner: nextPlayer,
      amount: 1,
      newTotal: gs.getPyre(nextPlayer)
    });
    
    // Draw card
    const card = gs.drawCard(nextPlayer);
    if (card) {
      collectEvent('CARD_DRAWN', { card: this.serializeCryptid(card), owner: nextPlayer });
    }
    
    // Untap cryptids
    const cryptids = gs.getAllCryptids(nextPlayer);
    for (const cryptid of cryptids) {
      if (!cryptid.paralyzed) {
        cryptid.tapped = false;
        cryptid.canAttack = true;
      }
    }
    
    collectEvent('TURN_STARTED', { owner: nextPlayer, turnNumber: state.turnNumber });
    
    return { success: true };
  }
  
  executeConcede(playerRole, collectEvent) {
    const winner = playerRole === 'player' ? 'enemy' : 'player';
    
    collectEvent('PLAYER_CONCEDED', { conceded: playerRole, winner });
    
    this.endMatch(winner, 'concede');
    return { success: true };
  }
  
  // ==================== HELPERS ====================
  
  serializeCryptid(cryptid) {
    if (!cryptid) return null;
    
    const hp = cryptid.hp || 1;
    const atk = cryptid.atk || cryptid.attack || 0;
    
    return {
      id: cryptid.id,
      key: cryptid.key,
      name: cryptid.name,
      type: cryptid.type || 'cryptid',
      cost: cryptid.cost || 0,
      hp, atk,
      attack: atk,
      currentHp: cryptid.currentHp ?? hp,
      currentAtk: cryptid.currentAtk ?? atk,
      maxHp: cryptid.maxHp ?? hp,
      baseAtk: cryptid.baseAtk ?? atk,
      owner: cryptid.owner,
      col: cryptid.col,
      row: cryptid.row,
      tapped: cryptid.tapped || false,
      canAttack: cryptid.canAttack ?? true,
      burnTurns: cryptid.burnTurns || 0,
      bleedTurns: cryptid.bleedTurns || 0,
      paralyzed: cryptid.paralyzed || false,
      rarity: cryptid.rarity,
      element: cryptid.element,
      effects: cryptid.effects || [],
      art: cryptid.art,
      isKindling: cryptid.isKindling || false
    };
  }
  
  requiresTurn(actionType) {
    return !['CONCEDE', 'CHAT'].includes(actionType);
  }
  
  isValidForPhase(actionType, phase) {
    const phaseActions = {
      conjure1: ['SUMMON_CRYPTID', 'SUMMON_KINDLING', 'PLAY_BURST', 'PLAY_TRAP', 'PLAY_AURA', 'EVOLVE_CRYPTID', 'PYRE_BURN', 'PLAY_PYRE_CARD', 'END_CONJURE1', 'CONCEDE'],
      combat: ['ATTACK', 'USE_ABILITY', 'PLAY_BURST', 'END_COMBAT', 'CONCEDE'],
      conjure2: ['SUMMON_CRYPTID', 'SUMMON_KINDLING', 'PLAY_BURST', 'PLAY_TRAP', 'PLAY_AURA', 'EVOLVE_CRYPTID', 'PYRE_BURN', 'PLAY_PYRE_CARD', 'END_TURN', 'CONCEDE']
    };
    
    return phaseActions[phase]?.includes(actionType) ?? false;
  }
  
  rejectAction(ws, actionId, reason) {
    ws.send(JSON.stringify({ type: 'ACTION_REJECTED', actionId, reason }));
  }
  
  broadcastActionResult(actionId, actor, events) {
    this.broadcast({
      type: 'ACTION_RESULT',
      actionId,
      success: true,
      actor,
      events,
      sequence: this.sequence,
      stateChecksum: this.calculateChecksum()
    });
  }
  
  broadcast(message) {
    const msgStr = JSON.stringify(message);
    for (const [ws, player] of this.players) {
      if (player.connected) {
        try { ws.send(msgStr); } catch (e) {}
      }
    }
  }
  
  broadcastToOthers(excludeWs, message) {
    const msgStr = JSON.stringify(message);
    for (const [ws, player] of this.players) {
      if (ws !== excludeWs && player.connected) {
        try { ws.send(msgStr); } catch (e) {}
      }
    }
  }
  
  broadcastChat(player, message) {
    this.broadcast({
      type: 'CHAT',
      from: player.role,
      message: message.substring(0, 200)
    });
  }
  
  sendStateSync(ws, player) {
    const playerRole = player.role === 'player1' ? 'player' : 'enemy';
    
    if (!this.gameContext) {
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Game not started yet' }));
      return;
    }
    
    ws.send(JSON.stringify({
      type: 'STATE_SYNC',
      sequence: this.sequence,
      fullState: this.getStateForPlayer(playerRole),
      matchStarted: this.matchStarted,
      isYourTurn: this.gameContext.gameState.state.currentTurn === playerRole
    }));
  }
  
  getStateForPlayer(playerRole) {
    if (!this.gameContext) return null;
    
    const gs = this.gameContext.gameState.state;
    
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
    const result = [[null, null, null], [null, null, null]];
    for (let col = 0; col < 2; col++) {
      for (let row = 0; row < 3; row++) {
        const cryptid = field[col]?.[row];
        if (cryptid) result[col][row] = this.serializeCryptid(cryptid);
      }
    }
    return result;
  }
  
  calculateChecksum() {
    if (!this.gameContext) return '0';
    const gs = this.gameContext.gameState.state;
    const data = JSON.stringify({
      pp: gs.playerPyre, ep: gs.enemyPyre,
      pd: gs.playerDeaths, ed: gs.enemyDeaths,
      t: gs.currentTurn, p: gs.phase, tn: gs.turnNumber
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
    if (!this.gameContext) return;
    
    const result = this.gameContext.turnProcessor.checkGameOver();
    
    if (result.gameOver) {
      this.endMatch(result.winner, result.reason);
    }
  }
  
  endMatch(winner, reason) {
    this.matchEnded = true;
    this.clearTurnTimer();
    
    this.broadcast({
      type: 'GAME_ENDED',
      winner,
      reason,
      finalState: this.gameContext ? {
        playerDeaths: this.gameContext.gameState.state.playerDeaths,
        enemyDeaths: this.gameContext.gameState.state.enemyDeaths,
        turnNumber: this.gameContext.gameState.state.turnNumber
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
    this.turnTimerTimeout = setTimeout(() => this.handleTurnTimeout(), this.turnTimeLimit);
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
    if (this.matchEnded || !this.gameContext) return;
    
    const currentPlayer = this.gameContext.gameState.state.currentTurn;
    
    this.broadcast({ type: 'TURN_TIMEOUT', player: currentPlayer });
    
    const collectEvent = () => {};
    this.executeEndTurn(currentPlayer, collectEvent);
    
    this.broadcast({
      type: 'TURN_STARTED',
      owner: this.gameContext.gameState.state.currentTurn,
      turnNumber: this.gameContext.gameState.state.turnNumber
    });
    
    this.startTurnTimer();
  }
}
