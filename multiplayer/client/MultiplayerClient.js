/**
 * Cryptid Fates - Multiplayer Client
 * 
 * Manages WebSocket connection to game server, processes events,
 * and coordinates with the existing game UI/animation systems.
 * 
 * Usage:
 *   const mp = new MultiplayerClient();
 *   await mp.connect(matchId, authToken);
 *   mp.sendAction('SUMMON_CRYPTID', { cardId: 'hellhound_3', targetSlot: {col: 1, row: 0} });
 */

class MultiplayerClient {
    constructor() {
        this.socket = null;
        this.matchId = null;
        this.authToken = null;
        this.playerRole = null;  // 'player' or 'enemy' (server perspective)
        this.opponentInfo = null;
        
        // Event processing
        this.eventQueue = [];
        this.processingEvents = false;
        this.lastSequence = -1;
        
        // Action tracking
        this.pendingActions = new Map();
        this.actionTimeout = 10000; // 10 seconds
        
        // Connection state
        this.connected = false;
        this.reconnecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // Callbacks
        this.onConnectionChange = null;
        this.onGameStart = null;
        this.onGameEnd = null;
        this.onOpponentDisconnect = null;
        this.onActionRejected = null;
        this.onTurnChange = null;
        this.onError = null;
        
        // Matchmaking callbacks
        this.onQueueJoined = null;
        this.onQueueUpdate = null;
        this.onMatchFound = null;
        this.onMatchStart = null;
        
        // Game room callbacks
        this.onBothPlayersConnected = null;
        this.onOpponentReady = null;
        this.onMultiplayerGameStart = null;
        
        // Timing
        this.serverTimeOffset = 0; // Difference between server and client time
        this.latency = 0;
        
        // Keepalive
        this.keepaliveInterval = null;
    }
    
    // ==================== CONNECTION ====================
    
    async connect(matchId, authToken) {
        this.matchId = matchId;
        this.authToken = authToken;
        
        return new Promise((resolve, reject) => {
            try {
                // In production, use wss:// and your actual server
                const serverUrl = window.MULTIPLAYER_SERVER_URL || 'ws://localhost:8080';
                this.socket = new WebSocket(`${serverUrl}/match/${matchId}?token=${authToken}`);
                
                this.socket.onopen = () => {
                    console.log('[MP Client] Connected to server');
                    this.connected = true;
                    this.reconnecting = false;
                    this.reconnectAttempts = 0;
                    this.onConnectionChange?.(true);
                    
                    // Start keepalive pings to prevent connection timeout
                    this.startKeepalive();
                    
                    resolve();
                };
                
                this.socket.onmessage = (event) => {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                };
                
                this.socket.onclose = (event) => {
                    console.log('[MP Client] Disconnected:', event.code, event.reason);
                    this.connected = false;
                    this.onConnectionChange?.(false);
                    
                    if (!event.wasClean && !this.reconnecting) {
                        this.attemptReconnect();
                    }
                };
                
                this.socket.onerror = (error) => {
                    console.error('[MP Client] WebSocket error:', error);
                    reject(error);
                };
            } catch (error) {
                reject(error);
            }
        });
    }
    
    disconnect() {
        this.stopKeepalive();
        if (this.socket) {
            this.socket.close(1000, 'Client disconnect');
            this.socket = null;
        }
        this.connected = false;
    }
    
    startKeepalive() {
        this.stopKeepalive(); // Clear any existing
        
        // Send keepalive every 20 seconds to prevent connection timeout
        this.keepaliveInterval = setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({ 
                    type: 'KEEPALIVE',
                    timestamp: Date.now()
                }));
            }
        }, 20000);
    }
    
    stopKeepalive() {
        if (this.keepaliveInterval) {
            clearInterval(this.keepaliveInterval);
            this.keepaliveInterval = null;
        }
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[MP Client] Max reconnection attempts reached');
            this.showConnectionLostUI();
            return;
        }
        
        this.reconnecting = true;
        this.reconnectAttempts++;
        
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
        console.log(`[MP Client] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        this.showReconnectingUI();
        
        setTimeout(async () => {
            try {
                await this.connect(this.matchId, this.authToken);
                this.hideReconnectingUI();
                
                // Request state sync after reconnection
                this.requestStateSync();
            } catch (error) {
                this.attemptReconnect();
            }
        }, delay);
    }
    
    // ==================== MESSAGE HANDLING ====================
    
    handleMessage(message) {
        // Update latency estimate from pong responses
        if (message.type === 'PONG' && message.clientTime) {
            this.latency = (Date.now() - message.clientTime) / 2;
            this.serverTimeOffset = message.serverTime - Date.now() + this.latency;
        }
        
        switch (message.type) {
            case 'MATCH_JOINED':
                this.handleMatchJoined(message);
                break;
                
            // Matchmaking events
            case 'QUEUE_JOINED':
                this.handleQueueJoined(message);
                break;
                
            case 'QUEUE_UPDATE':
                this.handleQueueUpdate(message);
                break;
                
            case 'MATCH_FOUND':
                this.handleMatchFound(message);
                break;
                
            case 'REDIRECT_TO_MATCH':
                this.handleRedirectToMatch(message);
                break;
                
            case 'GAME_START':
                // From matchmaking lobby - match found, reconnect to game room
                this.handleGameStartFromLobby(message);
                break;
                
            case 'GAME_STARTED':
                // From game room - both players connected, game begins
                this.handleGameStarted(message);
                break;
            
            case 'BOTH_PLAYERS_CONNECTED':
                // Both players are now in the game room
                this.handleBothPlayersConnected(message);
                break;
                
            case 'OPPONENT_DECK_SELECTED':
                // Opponent has selected their deck
                this.handleOpponentDeckSelected(message);
                break;
                
            case 'BOTH_DECKS_SELECTED':
                // Both players ready, start the game
                this.handleBothDecksSelected(message);
                break;
                
            case 'ACTION_RESULT':
                this.handleActionResult(message);
                // Also notify the game bridge
                if (typeof MultiplayerGameBridge !== 'undefined' && MultiplayerGameBridge.enabled) {
                    MultiplayerGameBridge.handleActionResult(message);
                }
                break;
                
            case 'GAME_EVENT':
                // Server is broadcasting a game event (from opponent's action)
                if (typeof MultiplayerGameBridge !== 'undefined' && MultiplayerGameBridge.enabled) {
                    MultiplayerGameBridge.handleServerEvent(message.event);
                }
                break;
                
            case 'ACTION_REJECTED':
                this.handleActionRejected(message);
                break;
                
            case 'STATE_SYNC':
                this.handleStateSync(message);
                break;
                
            case 'OPPONENT_DISCONNECTED':
                this.handleOpponentDisconnected(message);
                break;
                
            case 'OPPONENT_RECONNECTED':
                this.handleOpponentReconnected(message);
                break;
                
            case 'RECONNECTED':
                this.handleReconnected(message);
                break;
                
            case 'GAME_ENDED':
                this.handleGameEnded(message);
                break;
                
            case 'TURN_TIMER_START':
                this.handleTurnTimerStart(message);
                break;
                
            case 'TURN_TIMEOUT':
                this.handleTurnTimeout(message);
                break;
                
            case 'PONG':
                // Handled above for latency
                break;
                
            case 'KEEPALIVE_ACK':
                // Server acknowledged keepalive, connection is healthy
                break;
                
            case 'ERROR':
                this.handleError(message);
                break;
                
            default:
                console.warn('[MP Client] Unknown message type:', message.type);
        }
    }
    
    handleMatchJoined(message) {
        console.log('[MP Client] Match joined:', message);
        
        this.playerRole = message.yourRole;
        this.opponentInfo = message.opponent;
        
        // If match already started, this is likely a reconnect that wasn't detected
        // Don't trigger deck selection again
        if (message.matchStarted) {
            console.log('[MP Client] Match already started, requesting state sync');
            this.requestStateSync();
            return;
        }
        
        // MATCH_JOINED just means we're in the room - NOT that the game has started.
        // Don't call onGameStart here - wait for BOTH_DECKS_SELECTED.
        // The BOTH_PLAYERS_CONNECTED message will trigger deck selection.
        if (message.waitingForOpponent) {
            console.log('[MP Client] Waiting for opponent...');
        } else {
            console.log('[MP Client] Both players in room, waiting for deck selection');
        }
    }
    
    // ==================== MATCHMAKING HANDLERS ====================
    
    handleQueueJoined(message) {
        console.log('[MP Client] Joined matchmaking queue:', message);
        this.onQueueJoined?.(message);
    }
    
    handleQueueUpdate(message) {
        console.log('[MP Client] Queue update:', message);
        this.onQueueUpdate?.(message);
    }
    
    handleMatchFound(message) {
        console.log('[MP Client] Match found!', message);
        this.onMatchFound?.(message);
    }
    
    handleRedirectToMatch(message) {
        console.log('[MP Client] Redirecting to match:', message.matchId);
        
        // Disconnect from lobby
        if (this.socket) {
            this.socket.close(1000, 'Redirecting to match');
        }
        
        // Connect to the actual game room
        setTimeout(async () => {
            try {
                await this.connect(message.matchId, this.authToken);
                console.log('[MP Client] Connected to game room');
            } catch (error) {
                console.error('[MP Client] Failed to connect to game room:', error);
                this.onError?.(error);
            }
        }, 600);
    }
    
    handleGameStartFromLobby(message) {
        // This is sent from the matchmaking lobby when a match is found
        // We need to: 1) store the match info, 2) notify the UI
        // NOTE: The UI (home-screen.js) will handle the reconnection to the game room
        console.log('[MP Client] Game start from lobby:', message);
        
        this.playerRole = message.yourRole;
        this.matchId = message.matchId;
        
        // Store for reconnection
        const matchId = message.matchId;
        const role = message.yourRole;
        
        // Immediately notify that match was found (so UI updates)
        // The onGameStart callback will resolve the findMatch promise
        // The UI will then handle connecting to the game room
        this.onGameStart?.({
            yourRole: role,
            matchId: matchId,
            role: role,
            fromLobby: true,
            reconnectRequired: message.reconnectRequired
        });
        
        // Don't reconnect here - let the UI handle it via MultiplayerManager.connectToGameRoom()
    }
    
    handleGameStarted(message) {
        // This is from the game room when both players are connected
        console.log('[MP Client] Game started (from room):', message);
        
        this.playerRole = message.yourRole;
        
        // Initialize game with the provided state
        this.initializeGame(message.initialState);
        
        // Notify listeners - this handles the case where we connected directly to a room
        this.onGameStart?.({
            yourRole: message.yourRole,
            initialState: message.initialState,
            firstPlayer: message.firstPlayer,
            matchId: this.matchId
        });
    }
    
    handleError(message) {
        console.error('[MP Client] Server error:', message.message);
        this.onError?.(message);
    }
    
    handleBothPlayersConnected(message) {
        console.log('[MP Client] Both players connected to game room');
        this.onBothPlayersConnected?.(message);
    }
    
    handleOpponentDeckSelected(message) {
        console.log('[MP Client] Opponent selected their deck');
        this.onOpponentReady?.(message);
    }
    
    handleBothDecksSelected(message) {
        console.log('[MP Client] Both decks selected, starting game!', message);
        this.onMultiplayerGameStart?.(message);
    }
    
    handleActionResult(message) {
        console.log('[MP Client] Action result:', message.actionId, message.success);
        
        // Clear pending action
        const pending = this.pendingActions.get(message.actionId);
        if (pending) {
            clearTimeout(pending.timeoutId);
            this.pendingActions.delete(message.actionId);
        }
        
        // Queue all events for processing
        if (message.events && message.events.length > 0) {
            message.events.forEach(event => {
                this.eventQueue.push(event);
            });
            
            // Start processing if not already
            this.processEventQueue();
        }
        
        // Verify state checksum (optional but recommended)
        if (message.stateChecksum) {
            const localChecksum = this.calculateLocalChecksum();
            if (localChecksum !== message.stateChecksum) {
                console.warn('[MP Client] State desync detected, requesting sync');
                this.requestStateSync();
            }
        }
    }
    
    handleActionRejected(message) {
        console.warn('[MP Client] Action rejected:', message.actionId, message.reason);
        
        // Clear pending action
        this.pendingActions.delete(message.actionId);
        
        // Show feedback to player
        const reasonMessages = {
            'NOT_YOUR_TURN': "It's not your turn!",
            'WRONG_PHASE': "You can't do that in this phase.",
            'INSUFFICIENT_PYRE': "Not enough Pyre!",
            'CARD_NOT_IN_HAND': "Card not in hand.",
            'INVALID_SLOT': "Invalid target slot.",
            'INVALID_TARGET': "Invalid target.",
            'CANNOT_ATTACK': "This unit can't attack right now.",
            'ABILITY_ON_COOLDOWN': "Ability is on cooldown.",
            'RATE_LIMITED': "Slow down!"
        };
        
        const displayMessage = reasonMessages[message.reason] || "Action not allowed.";
        if (typeof showMessage === 'function') {
            showMessage(displayMessage, 2000);
        }
        
        this.onActionRejected?.(message);
    }
    
    handleStateSync(message) {
        console.log('[MP Client] State sync received:', message);
        
        // Apply full state
        this.applyFullState(message.fullState);
        
        // Update sequence counter
        this.lastSequence = message.sequence;
        
        // Update turn state in bridge
        if (typeof MultiplayerGameBridge !== 'undefined' && message.isYourTurn !== undefined) {
            MultiplayerGameBridge.isMyTurn = message.isYourTurn;
            MultiplayerGameBridge.updateTurnUI();
        }
        
        // Re-render
        if (typeof renderAll === 'function') {
            renderAll();
        }
        if (typeof renderHand === 'function') {
            renderHand();
        }
    }
    
    handleOpponentDisconnected(message) {
        console.log('[MP Client] Opponent disconnected, reconnect window:', message.reconnectWindow);
        
        if (typeof showMessage === 'function') {
            showMessage('Opponent disconnected. Waiting for reconnection...', 5000);
        }
        
        this.onOpponentDisconnect?.(true, message.reconnectWindow);
    }
    
    handleOpponentReconnected(message) {
        console.log('[MP Client] Opponent reconnected');
        
        if (typeof showMessage === 'function') {
            showMessage('Opponent reconnected!', 2000);
        }
        
        this.onOpponentDisconnect?.(false);
    }
    
    handleReconnected(message) {
        console.log('[MP Client] Reconnection successful:', message);
        
        // Update role from server
        if (message.yourRole) {
            window.multiplayerRole = message.yourRole;
            this.playerRole = message.yourRole;
        }
        
        // Handle reconnect during deck selection (matchStarted = false)
        if (message.matchStarted === false) {
            console.log('[MP Client] Reconnected during deck selection');
            
            this.hideReconnectingUI();
            
            // If deck was already selected before disconnect, just show waiting message
            if (message.deckSelected) {
                if (typeof showMessage === 'function') {
                    showMessage('Reconnected! Waiting for opponent deck selection...', 3000);
                }
            } else {
                // Need to select deck - trigger deck selection UI
                if (typeof showMessage === 'function') {
                    showMessage('Reconnected! Please select your deck.', 3000);
                }
                // The BOTH_PLAYERS_CONNECTED message should arrive shortly to show deck selection
            }
            return;
        }
        
        // Apply game state from server (match is in progress)
        if (message.gameState && window.game) {
            // Use HomeScreen's applyServerState if available
            if (typeof HomeScreen !== 'undefined' && HomeScreen.applyServerState) {
                HomeScreen.applyServerState(message.gameState);
            } else {
                // Manual state application
                const game = window.game;
                const state = message.gameState;
                
                if (state.yourHand) game.playerHand = state.yourHand;
                if (state.playerField) game.playerField = state.playerField;
                if (state.enemyField) game.enemyField = state.enemyField;
                if (state.playerPyre !== undefined) game.playerPyre = state.playerPyre;
                if (state.enemyPyre !== undefined) game.enemyPyre = state.enemyPyre;
                if (state.playerDeaths !== undefined) game.playerDeaths = state.playerDeaths;
                if (state.enemyDeaths !== undefined) game.enemyDeaths = state.enemyDeaths;
                if (state.phase) game.phase = state.phase;
                if (state.turnNumber !== undefined) game.turnNumber = state.turnNumber;
            }
        }
        
        // Update turn state
        if (typeof MultiplayerGameBridge !== 'undefined') {
            MultiplayerGameBridge.isMyTurn = message.isYourTurn;
            MultiplayerGameBridge.updateTurnUI();
        }
        
        this.lastSequence = message.lastSequence;
        
        if (typeof renderAll === 'function') {
            renderAll();
        }
        
        this.hideReconnectingUI();
        
        if (typeof showMessage === 'function') {
            showMessage('Reconnected!', 2000);
        }
    }
    
    handleGameEnded(message) {
        console.log('[MP Client] Game ended:', message.winner);
        
        const isWin = this.mapOwner(message.winner) === 'player';
        
        this.onGameEnd?.({
            isWin,
            reason: message.reason,
            stats: message.stats
        });
    }
    
    handleTurnTimerStart(message) {
        // Update turn timer UI
        const isMyTurn = this.mapOwner(message.player) === 'player';
        
        if (typeof updateTurnTimer === 'function') {
            updateTurnTimer(message.mainTime, message.bonusTime, isMyTurn);
        }
    }
    
    handleTurnTimeout(message) {
        const isMyTimeout = this.mapOwner(message.player) === 'player';
        
        if (isMyTimeout) {
            if (typeof showMessage === 'function') {
                showMessage('Turn timed out!', 2000);
            }
        }
    }
    
    // ==================== SENDING ACTIONS ====================
    
    sendAction(actionType, payload = {}) {
        if (!this.connected) {
            console.error('[MP Client] Not connected');
            return null;
        }
        
        const actionId = this.generateActionId();
        
        const action = {
            type: 'ACTION',
            actionId,
            actionType,
            timestamp: Date.now(),
            payload
        };
        
        // Track pending action with timeout
        const timeoutId = setTimeout(() => {
            if (this.pendingActions.has(actionId)) {
                console.warn('[MP Client] Action timed out:', actionType);
                this.pendingActions.delete(actionId);
                
                if (typeof showMessage === 'function') {
                    showMessage('Connection slow, please try again.', 2000);
                }
            }
        }, this.actionTimeout);
        
        this.pendingActions.set(actionId, {
            action,
            sentAt: Date.now(),
            timeoutId
        });
        
        this.socket.send(JSON.stringify(action));
        
        console.log('[MP Client] Sent action:', actionType, payload);
        return actionId;
    }
    
    // Convenience methods for common actions
    
    summonCryptid(cardId, col, row) {
        return this.sendAction('SUMMON_CRYPTID', {
            cardId,
            targetSlot: { col, row }
        });
    }
    
    summonKindling(cardId, col, row) {
        return this.sendAction('SUMMON_KINDLING', {
            cardId,
            targetSlot: { col, row }
        });
    }
    
    attack(attackerCol, attackerRow, targetCol, targetRow) {
        return this.sendAction('ATTACK', {
            attackerCol,
            attackerRow,
            targetCol,
            targetRow
        });
    }
    
    playBurst(cardId, targets = []) {
        return this.sendAction('PLAY_BURST', {
            cardId,
            targets
        });
    }
    
    playTrap(cardId, slotRow) {
        return this.sendAction('PLAY_TRAP', {
            cardId,
            slotRow
        });
    }
    
    evolveCryptid(evolutionCardId, baseCol, baseRow) {
        return this.sendAction('EVOLVE_CRYPTID', {
            evolutionCardId,
            baseSlot: { col: baseCol, row: baseRow }
        });
    }
    
    useAbility(cryptidCol, cryptidRow, abilityId, targets = []) {
        return this.sendAction('USE_ABILITY', {
            cryptidSlot: { col: cryptidCol, row: cryptidRow },
            abilityId,
            targets
        });
    }
    
    pyreBurn() {
        return this.sendAction('PYRE_BURN', {});
    }
    
    endConjure1() {
        return this.sendAction('END_CONJURE1', {});
    }
    
    endCombat() {
        return this.sendAction('END_COMBAT', {});
    }
    
    endTurn() {
        return this.sendAction('END_TURN', {});
    }
    
    concede() {
        return this.sendAction('CONCEDE', {});
    }
    
    requestStateSync() {
        if (this.socket && this.connected) {
            this.socket.send(JSON.stringify({
                type: 'REQUEST_SYNC'
            }));
        }
    }
    
    // ==================== EVENT PROCESSING ====================
    
    async processEventQueue() {
        if (this.processingEvents || this.eventQueue.length === 0) {
            return;
        }
        
        this.processingEvents = true;
        
        while (this.eventQueue.length > 0) {
            const event = this.eventQueue.shift();
            
            // Skip already-processed events (from reconnection)
            if (event.sequence <= this.lastSequence) {
                continue;
            }
            this.lastSequence = event.sequence;
            
            // Process event with animation
            await this.processEvent(event);
        }
        
        this.processingEvents = false;
    }
    
    processEvent(event) {
        return new Promise((resolve) => {
            const processor = this.getEventProcessor(event.eventType);
            
            if (processor) {
                processor.call(this, event.data, event.animations || [], resolve);
            } else {
                // Unknown event - just apply state and continue
                console.warn('[MP Client] No processor for event:', event.eventType);
                resolve();
            }
        });
    }
    
    getEventProcessor(eventType) {
        const processors = {
            'CRYPTID_SUMMONED': this.processCryptidSummoned,
            'KINDLING_SUMMONED': this.processKindlingSummoned,
            'CRYPTID_EVOLVED': this.processCryptidEvolved,
            'CRYPTID_DIED': this.processCryptidDied,
            'CRYPTID_PROMOTED': this.processCryptidPromoted,
            'CARD_DRAWN': this.processCardDrawn,
            'ATTACK_DECLARED': this.processAttackDeclared,
            'DAMAGE_DEALT': this.processDamageDealt,
            'DAMAGE_BLOCKED': this.processDamageBlocked,
            'EFFECT_TRIGGERED': this.processEffectTriggered,
            'AILMENT_APPLIED': this.processAilmentApplied,
            'AILMENT_REMOVED': this.processAilmentRemoved,
            'BUFF_APPLIED': this.processBuffApplied,
            'HEAL_APPLIED': this.processHealApplied,
            'PYRE_CHANGED': this.processPyreChanged,
            'PHASE_CHANGED': this.processPhaseChanged,
            'TURN_STARTED': this.processTurnStarted,
            'TURN_ENDED': this.processTurnEnded,
            'BURN_DAMAGE': this.processBurnDamage,
            'TRAP_TRIGGERED': this.processTrapTriggered
        };
        
        return processors[eventType];
    }
    
    // ==================== EVENT PROCESSORS ====================
    
    processCryptidSummoned(data, animations, onComplete) {
        const { cryptid, slot, owner } = data;
        const localOwner = this.mapOwner(owner);
        
        // Update local state
        const field = localOwner === 'player' ? game.playerField : game.enemyField;
        const summonedCryptid = this.deserializeCryptid(cryptid);
        summonedCryptid.owner = localOwner;
        summonedCryptid.col = slot.col;
        summonedCryptid.row = slot.row;
        field[slot.col][slot.row] = summonedCryptid;
        
        // Render to show the card
        if (typeof renderSprites === 'function') {
            renderSprites();
        }
        
        // Play summon animation
        const sprite = this.getSprite(localOwner, slot.col, slot.row);
        if (sprite) {
            sprite.classList.add('summoning');
            setTimeout(() => {
                sprite.classList.remove('summoning');
                onComplete();
            }, 500);
        } else {
            onComplete();
        }
    }
    
    processKindlingSummoned(data, animations, onComplete) {
        // Same as cryptid summon
        this.processCryptidSummoned(data, animations, onComplete);
    }
    
    processCryptidEvolved(data, animations, onComplete) {
        const { baseCryptid, evolved, slot, owner } = data;
        const localOwner = this.mapOwner(owner);
        
        // Update local state
        const field = localOwner === 'player' ? game.playerField : game.enemyField;
        const evolvedCryptid = this.deserializeCryptid(evolved);
        evolvedCryptid.owner = localOwner;
        evolvedCryptid.col = slot.col;
        evolvedCryptid.row = slot.row;
        field[slot.col][slot.row] = evolvedCryptid;
        
        // Play evolution animation
        const sprite = this.getSprite(localOwner, slot.col, slot.row);
        if (sprite && typeof CombatEffects !== 'undefined') {
            sprite.classList.add('evolving');
            setTimeout(() => {
                sprite.classList.remove('evolving');
                if (typeof renderSprites === 'function') renderSprites();
                onComplete();
            }, 800);
        } else {
            if (typeof renderSprites === 'function') renderSprites();
            onComplete();
        }
    }
    
    processCryptidDied(data, animations, onComplete) {
        const { cryptid, slot, owner, killedBy } = data;
        const localOwner = this.mapOwner(owner);
        
        const sprite = this.getSprite(localOwner, slot.col, slot.row);
        const field = localOwner === 'player' ? game.playerField : game.enemyField;
        
        // Play death animation
        if (sprite && typeof CombatEffects !== 'undefined' && CombatEffects.playDramaticDeath) {
            CombatEffects.playDramaticDeath(sprite, localOwner, cryptid.rarity || 'common', () => {
                // Remove from field after animation
                field[slot.col][slot.row] = null;
                
                // Update death counter
                if (localOwner === 'player') {
                    game.playerDeaths = data.newDeathCount || (game.playerDeaths + 1);
                } else {
                    game.enemyDeaths = data.newDeathCount || (game.enemyDeaths + 1);
                }
                
                if (typeof renderAll === 'function') renderAll();
                onComplete();
            });
        } else {
            field[slot.col][slot.row] = null;
            if (typeof renderAll === 'function') renderAll();
            onComplete();
        }
    }
    
    processCryptidPromoted(data, animations, onComplete) {
        const { cryptid, fromSlot, toSlot, owner } = data;
        const localOwner = this.mapOwner(owner);
        const field = localOwner === 'player' ? game.playerField : game.enemyField;
        
        // Move cryptid in local state
        const promoted = field[fromSlot.col][fromSlot.row];
        field[fromSlot.col][fromSlot.row] = null;
        field[toSlot.col][toSlot.row] = promoted;
        if (promoted) {
            promoted.col = toSlot.col;
            promoted.row = toSlot.row;
        }
        
        // Play promotion animation
        if (typeof animateSupportPromotion === 'function') {
            animateSupportPromotion(localOwner, toSlot.row);
        }
        
        setTimeout(() => {
            if (typeof renderSprites === 'function') renderSprites();
            onComplete();
        }, 400);
    }
    
    processCardDrawn(data, animations, onComplete) {
        const { card, owner } = data;
        const localOwner = this.mapOwner(owner);
        
        if (localOwner === 'player') {
            // Add card to hand (we see full card info)
            const drawnCard = this.deserializeCryptid(card);
            game.playerHand.push(drawnCard);
        } else {
            // Opponent drew - we just see the count increase
            // Card is hidden from us
        }
        
        if (typeof renderHand === 'function') renderHand();
        onComplete();
    }
    
    processAttackDeclared(data, animations, onComplete) {
        const { attacker, attackerSlot, targetSlot, targetOwner } = data;
        const localAttackerOwner = this.mapOwner(attacker.owner);
        const localTargetOwner = this.mapOwner(targetOwner);
        
        // Get sprites for animation
        const attackerSprite = this.getSprite(localAttackerOwner, attackerSlot.col, attackerSlot.row);
        const targetSprite = this.getSprite(localTargetOwner, targetSlot.col, targetSlot.row);
        
        if (attackerSprite && targetSprite && typeof CombatEffects !== 'undefined') {
            // Play attack animation
            attackerSprite.classList.add('attacking');
            setTimeout(() => {
                attackerSprite.classList.remove('attacking');
                onComplete();
            }, 450);
        } else {
            onComplete();
        }
    }
    
    processDamageDealt(data, animations, onComplete) {
        const { target, damage, isCritical, slot, owner } = data;
        const localOwner = this.mapOwner(owner);
        
        // Update local HP
        const field = localOwner === 'player' ? game.playerField : game.enemyField;
        const localTarget = field[slot.col]?.[slot.row];
        if (localTarget) {
            localTarget.currentHp = target.currentHp;
        }
        
        // Play hit effect
        const sprite = this.getSprite(localOwner, slot.col, slot.row);
        if (sprite) {
            if (window.playHitEffectOnSprite) {
                playHitEffectOnSprite(sprite, { owner: localOwner }, {
                    intensity: isCritical || damage >= 5 ? 'heavy' : 'normal'
                });
            }
            
            if (typeof CombatEffects !== 'undefined' && CombatEffects.showDamageNumber) {
                CombatEffects.showDamageNumber(localTarget || target, damage, isCritical);
            }
        }
        
        setTimeout(() => {
            if (typeof renderSprites === 'function') renderSprites();
            onComplete();
        }, 300);
    }
    
    processDamageBlocked(data, animations, onComplete) {
        const { target, blockedAmount, slot, owner } = data;
        const localOwner = this.mapOwner(owner);
        
        const sprite = this.getSprite(localOwner, slot.col, slot.row);
        if (sprite) {
            // Show block animation
            if (typeof showMessage === 'function') {
                showMessage('🛡️ Blocked!', 800);
            }
        }
        
        setTimeout(onComplete, 400);
    }
    
    processEffectTriggered(data, animations, onComplete) {
        const { effectName, source, message } = data;
        
        if (message && typeof showMessage === 'function') {
            showMessage(message, 1000);
        }
        
        setTimeout(onComplete, 600);
    }
    
    processAilmentApplied(data, animations, onComplete) {
        const { target, ailmentType, stacks, slot, owner } = data;
        const localOwner = this.mapOwner(owner);
        
        // Update local state
        const field = localOwner === 'player' ? game.playerField : game.enemyField;
        const localTarget = field[slot.col]?.[slot.row];
        if (localTarget) {
            switch (ailmentType) {
                case 'burn':
                    localTarget.burnTurns = (localTarget.burnTurns || 0) + stacks;
                    break;
                case 'bleed':
                    localTarget.bleedTurns = (localTarget.bleedTurns || 0) + stacks;
                    break;
                case 'paralyze':
                    localTarget.paralyzed = true;
                    break;
                case 'calamity':
                    localTarget.calamityCounters = (localTarget.calamityCounters || 0) + stacks;
                    break;
                case 'curse':
                    localTarget.curseTokens = (localTarget.curseTokens || 0) + stacks;
                    break;
            }
        }
        
        // Play ailment animation
        const sprite = this.getSprite(localOwner, slot.col, slot.row);
        if (sprite) {
            sprite.classList.add(`${ailmentType}-applied`);
            setTimeout(() => sprite.classList.remove(`${ailmentType}-applied`), 500);
        }
        
        setTimeout(() => {
            if (typeof renderSprites === 'function') renderSprites();
            onComplete();
        }, 400);
    }
    
    processAilmentRemoved(data, animations, onComplete) {
        const { target, ailmentType, slot, owner } = data;
        const localOwner = this.mapOwner(owner);
        
        // Update local state
        const field = localOwner === 'player' ? game.playerField : game.enemyField;
        const localTarget = field[slot.col]?.[slot.row];
        if (localTarget) {
            switch (ailmentType) {
                case 'burn':
                    localTarget.burnTurns = 0;
                    break;
                case 'bleed':
                    localTarget.bleedTurns = 0;
                    break;
                case 'paralyze':
                    localTarget.paralyzed = false;
                    break;
            }
        }
        
        if (typeof renderSprites === 'function') renderSprites();
        onComplete();
    }
    
    processBuffApplied(data, animations, onComplete) {
        const { target, buffType, amount, slot, owner } = data;
        const localOwner = this.mapOwner(owner);
        
        // Update local state
        const field = localOwner === 'player' ? game.playerField : game.enemyField;
        const localTarget = field[slot.col]?.[slot.row];
        if (localTarget) {
            if (buffType === 'atk') {
                localTarget.currentAtk = (localTarget.currentAtk || localTarget.atk) + amount;
            } else if (buffType === 'hp') {
                localTarget.currentHp = (localTarget.currentHp || localTarget.hp) + amount;
                localTarget.maxHp = (localTarget.maxHp || localTarget.hp) + amount;
            }
        }
        
        // Play buff animation
        const sprite = this.getSprite(localOwner, slot.col, slot.row);
        if (sprite) {
            sprite.classList.add('buffed');
            setTimeout(() => sprite.classList.remove('buffed'), 600);
        }
        
        setTimeout(() => {
            if (typeof renderSprites === 'function') renderSprites();
            onComplete();
        }, 500);
    }
    
    processHealApplied(data, animations, onComplete) {
        const { target, amount, slot, owner } = data;
        const localOwner = this.mapOwner(owner);
        
        // Update local state
        const field = localOwner === 'player' ? game.playerField : game.enemyField;
        const localTarget = field[slot.col]?.[slot.row];
        if (localTarget) {
            const maxHp = localTarget.maxHp || localTarget.hp;
            localTarget.currentHp = Math.min(maxHp, (localTarget.currentHp || localTarget.hp) + amount);
        }
        
        // Play heal animation
        const sprite = this.getSprite(localOwner, slot.col, slot.row);
        if (sprite) {
            sprite.classList.add('healing');
            setTimeout(() => sprite.classList.remove('healing'), 500);
            
            if (typeof CombatEffects !== 'undefined' && CombatEffects.showHealNumber) {
                CombatEffects.showHealNumber(localTarget, amount);
            }
        }
        
        setTimeout(() => {
            if (typeof renderSprites === 'function') renderSprites();
            onComplete();
        }, 500);
    }
    
    processPyreChanged(data, animations, onComplete) {
        const { owner, amount, newTotal } = data;
        const localOwner = this.mapOwner(owner);
        
        if (localOwner === 'player') {
            game.playerPyre = newTotal;
        } else {
            game.enemyPyre = newTotal;
        }
        
        if (typeof renderAll === 'function') renderAll();
        onComplete();
    }
    
    processPhaseChanged(data, animations, onComplete) {
        const { phase, owner } = data;
        
        game.phase = phase;
        
        // Update UI for phase
        if (typeof updatePhaseIndicator === 'function') {
            updatePhaseIndicator(phase);
        }
        
        setTimeout(onComplete, 300);
    }
    
    processTurnStarted(data, animations, onComplete) {
        const { owner, turnNumber } = data;
        const localOwner = this.mapOwner(owner);
        const isMyTurn = localOwner === 'player';
        
        game.currentTurn = localOwner;
        game.turnNumber = turnNumber;
        game.phase = 'conjure1';
        
        // Show turn message
        if (typeof showMessage === 'function') {
            showMessage(isMyTurn ? "Your Turn!" : "Opponent's Turn", 1500);
        }
        
        // Update controls
        this.setControlsEnabled(isMyTurn);
        this.onTurnChange?.(isMyTurn);
        
        setTimeout(() => {
            if (typeof renderAll === 'function') renderAll();
            onComplete();
        }, 1500);
    }
    
    processTurnEnded(data, animations, onComplete) {
        // Processed via TURN_STARTED of next player
        onComplete();
    }
    
    processBurnDamage(data, animations, onComplete) {
        const { cryptid, damage, slot, owner, turnsRemaining } = data;
        const localOwner = this.mapOwner(owner);
        
        // Update local state
        const field = localOwner === 'player' ? game.playerField : game.enemyField;
        const localTarget = field[slot.col]?.[slot.row];
        if (localTarget) {
            localTarget.currentHp = cryptid.currentHp;
            localTarget.burnTurns = turnsRemaining;
        }
        
        // Show burn damage animation
        const sprite = this.getSprite(localOwner, slot.col, slot.row);
        if (sprite && typeof CombatEffects !== 'undefined') {
            CombatEffects.showDamageNumber(localTarget || cryptid, damage, false);
        }
        
        setTimeout(() => {
            if (typeof renderSprites === 'function') renderSprites();
            onComplete();
        }, 400);
    }
    
    processTrapTriggered(data, animations, onComplete) {
        const { trap, owner, slotRow, effect } = data;
        const localOwner = this.mapOwner(owner);
        
        // Remove trap from local state
        const traps = localOwner === 'player' ? game.playerTraps : game.enemyTraps;
        traps[slotRow] = null;
        
        // Show trap reveal message
        if (typeof showMessage === 'function') {
            showMessage(`⚡ ${trap.name} triggered!`, 1000);
        }
        
        setTimeout(() => {
            if (typeof renderAll === 'function') renderAll();
            onComplete();
        }, 700);
    }
    
    // ==================== STATE MANAGEMENT ====================
    
    initializeGame(initialState) {
        // Set up the local game instance for multiplayer
        if (typeof window.game === 'undefined') {
            window.game = new Game();
        }
        
        this.applyFullState(initialState);
        
        // Mark as multiplayer mode
        window.isMultiplayer = true;
        window.multiplayerClient = this;
    }
    
    applyFullState(state) {
        if (!state) return;
        
        console.log('[MP Client] Applying full state:', state);
        
        // Server already maps state to our perspective, so:
        // - state.playerField = OUR field (from our view)
        // - state.enemyField = OPPONENT's field (from our view)
        // No flipping needed!
        
        // Apply field state (already perspective-mapped by server)
        if (state.playerField) {
            game.playerField = this.deserializeField(state.playerField, 'player');
        }
        if (state.enemyField) {
            game.enemyField = this.deserializeField(state.enemyField, 'enemy');
        }
        
        // Apply hand (we only see our own cards)
        if (state.yourHand) {
            game.playerHand = state.yourHand.map(c => this.deserializeCryptid(c));
        }
        
        // Apply kindling pool
        if (state.yourKindling) {
            game.playerKindling = state.yourKindling.map(c => this.deserializeCryptid(c));
        }
        
        // Apply resources - server already sends from our perspective
        game.playerPyre = state.playerPyre ?? game.playerPyre;
        game.enemyPyre = state.enemyPyre ?? game.enemyPyre;
        game.playerDeaths = state.playerDeaths ?? game.playerDeaths;
        game.enemyDeaths = state.enemyDeaths ?? game.enemyDeaths;
        
        // Apply turn state - map server's raw currentTurn to local perspective
        // Server sends raw currentTurn ('player' or 'enemy' from server perspective)
        // Client expects: 'player' = my turn, 'enemy' = opponent's turn
        if (state.currentTurn !== undefined) {
            const myRole = this.playerRole || window.multiplayerRole || 'player';
            const isMyTurn = state.currentTurn === myRole;
            game.currentTurn = isMyTurn ? 'player' : 'enemy';
            console.log('[MP Client] Mapped currentTurn - server:', state.currentTurn, 'myRole:', myRole, 'local:', game.currentTurn);
        }
        game.phase = state.phase ?? game.phase;
        game.turnNumber = state.turnNumber ?? game.turnNumber;
        
        console.log('[MP Client] State applied - Hand:', game.playerHand?.length, 'Pyre:', game.playerPyre);
    }
    
    deserializeField(fieldData, owner) {
        const field = [[null, null, null], [null, null, null]];
        
        if (!fieldData) return field;
        
        // Handle both formats:
        // 1. 2D array: fieldData[col][row] = cryptid or null
        // 2. Flat array of cryptids with positions
        
        if (Array.isArray(fieldData) && fieldData.length === 2 && Array.isArray(fieldData[0])) {
            // 2D array format from server's serializeField
            for (let col = 0; col < 2; col++) {
                for (let row = 0; row < 3; row++) {
                    const cryptidData = fieldData[col]?.[row];
                    if (cryptidData) {
                        const cryptid = this.deserializeCryptid(cryptidData);
                        cryptid.owner = owner;
                        cryptid.col = col;
                        cryptid.row = row;
                        field[col][row] = cryptid;
                    }
                }
            }
        } else if (Array.isArray(fieldData)) {
            // Flat array format (legacy)
            fieldData.forEach(cryptidInfo => {
                if (cryptidInfo && cryptidInfo.col !== undefined && cryptidInfo.row !== undefined) {
                    const cryptid = this.deserializeCryptid(cryptidInfo);
                    cryptid.owner = owner;
                    field[cryptidInfo.col][cryptidInfo.row] = cryptid;
                }
            });
        }
        
        return field;
    }
    
    deserializeCryptid(data) {
        if (!data) return null;
        
        // Start with base card from registry if available
        let base = {};
        if (data.key) {
            base = CardRegistry?.getCryptid(data.key) || 
                   CardRegistry?.getKindling(data.key) || {};
        }
        
        // Merge server state over base
        return {
            ...base,
            ...data,
            currentHp: data.currentHp ?? data.hp ?? base.hp,
            currentAtk: data.currentAtk ?? data.atk ?? base.atk,
            maxHp: data.maxHp ?? data.hp ?? base.hp,
            baseAtk: data.baseAtk ?? data.atk ?? base.atk
        };
    }
    
    calculateLocalChecksum() {
        // Simple checksum for state verification
        // In production, use a proper hash function
        const stateStr = JSON.stringify({
            pf: this.serializeFieldSimple(game.playerField),
            ef: this.serializeFieldSimple(game.enemyField),
            pp: game.playerPyre,
            ep: game.enemyPyre,
            pd: game.playerDeaths,
            ed: game.enemyDeaths,
            t: game.currentTurn,
            p: game.phase
        });
        
        let hash = 0;
        for (let i = 0; i < stateStr.length; i++) {
            const chr = stateStr.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0;
        }
        return hash.toString(16);
    }
    
    serializeFieldSimple(field) {
        const result = [];
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                const c = field[col]?.[row];
                if (c) {
                    result.push({
                        k: c.key,
                        h: c.currentHp,
                        a: c.currentAtk,
                        b: c.burnTurns || 0
                    });
                }
            }
        }
        return result;
    }
    
    // ==================== UTILITY ====================
    
    /**
     * Map server owner to local perspective
     * If we're the 'enemy' role on server, we see ourselves as 'player' locally
     */
    mapOwner(serverOwner) {
        if (this.playerRole === 'player') {
            return serverOwner;
        } else {
            return serverOwner === 'player' ? 'enemy' : 'player';
        }
    }
    
    getSprite(owner, col, row) {
        return document.querySelector(
            `.cryptid-sprite[data-owner="${owner}"][data-col="${col}"][data-row="${row}"]`
        );
    }
    
    generateActionId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    setControlsEnabled(enabled) {
        // Enable/disable player interaction based on turn
        const controls = document.querySelectorAll('.player-control, .hand-card, .end-turn-btn');
        controls.forEach(el => {
            if (enabled) {
                el.classList.remove('disabled');
            } else {
                el.classList.add('disabled');
            }
        });
    }
    
    // ==================== UI HELPERS ====================
    
    showReconnectingUI() {
        let overlay = document.getElementById('mp-reconnecting-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'mp-reconnecting-overlay';
            overlay.innerHTML = `
                <div class="mp-reconnecting-content">
                    <div class="mp-spinner"></div>
                    <p>Reconnecting...</p>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    }
    
    hideReconnectingUI() {
        const overlay = document.getElementById('mp-reconnecting-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
    
    showConnectionLostUI() {
        if (typeof showMessage === 'function') {
            showMessage('Connection lost. Please refresh the page.', 10000);
        }
    }
}

// Make available globally
window.MultiplayerClient = MultiplayerClient;

console.log('[MultiplayerClient] Multiplayer client loaded');
