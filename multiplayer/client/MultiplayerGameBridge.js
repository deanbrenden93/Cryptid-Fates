/**
 * Cryptid Fates - Multiplayer Game Bridge
 * 
 * This bridge intercepts game actions in multiplayer mode and routes them
 * through the server. It also receives server events and applies them locally.
 * 
 * Design: Works WITH the existing game system, not replacing it.
 * - When it's YOUR turn: Actions go to server → server validates → server broadcasts → all clients update
 * - When it's OPPONENT's turn: You can't act, but you receive their actions from server
 */

window.MultiplayerGameBridge = {
    enabled: false,
    isMyTurn: false,
    myRole: null,  // 'player' or 'enemy'
    client: null,
    
    // ==================== INITIALIZATION ====================
    
    init() {
        if (!window.isMultiplayer) {
            console.log('[MPBridge] Not in multiplayer mode, bridge disabled');
            return;
        }
        
        this.enabled = true;
        this.myRole = window.multiplayerRole || 'player';
        this.client = window.MultiplayerManager?.client;
        
        if (!this.client) {
            console.error('[MPBridge] No multiplayer client available!');
            this.enabled = false;
            return;
        }
        
        console.log('[MPBridge] Initialized. My role:', this.myRole);
        
        // Set up event handlers for server messages
        this.setupServerEventHandlers();
        
        // Determine initial turn
        const firstPlayer = window.multiplayerFirstPlayer || 'player';
        this.isMyTurn = (firstPlayer === this.myRole);
        console.log('[MPBridge] First player:', firstPlayer, '| Is my turn:', this.isMyTurn);
        
        // Update UI to show turn status
        this.updateTurnUI();
    },
    
    setupServerEventHandlers() {
        if (!this.client) return;
        
        // Handle game events from server
        this.client.onServerGameEvent = (event) => {
            this.handleServerEvent(event);
        };
        
        // Handle turn changes
        this.client.onTurnChange = (isMyTurn) => {
            this.isMyTurn = isMyTurn;
            this.updateTurnUI();
            console.log('[MPBridge] Turn changed. My turn:', isMyTurn);
        };
        
        // Handle action results
        this.client.onActionResult = (result) => {
            this.handleActionResult(result);
        };
    },
    
    // ==================== ACTION INTERCEPTION ====================
    // These methods are called instead of direct game methods when in multiplayer
    
    // Action ID counter for tracking
    actionIdCounter: 0,
    
    generateActionId() {
        return `${this.myRole}_${Date.now()}_${this.actionIdCounter++}`;
    },
    
    /**
     * Check if WebSocket is connected and ready
     */
    isSocketReady() {
        return this.client && 
               this.client.socket && 
               this.client.socket.readyState === WebSocket.OPEN;
    },
    
    /**
     * Safely send a message through the WebSocket
     */
    safeSend(message) {
        if (!this.isSocketReady()) {
            console.warn('[MPBridge] WebSocket not connected, cannot send message');
            this.showConnectionError();
            return false;
        }
        
        try {
            this.client.socket.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error('[MPBridge] Failed to send message:', error);
            this.showConnectionError();
            return false;
        }
    },
    
    /**
     * Show connection error message
     */
    showConnectionError() {
        if (typeof showMessage === 'function') {
            showMessage('Connection lost. Please wait for reconnection...', 3000);
        }
    },
    
    /**
     * Summon a cryptid - routes through server in multiplayer
     */
    summonCryptid(cardId, col, row, cardData = null) {
        if (!this.enabled) {
            // Single player - use normal game logic
            return this.executeLocalSummon(cardId, col, row);
        }
        
        if (!this.isMyTurn) {
            console.log('[MPBridge] Not your turn!');
            this.showNotYourTurnMessage();
            return false;
        }
        
        console.log('[MPBridge] Sending summon action:', cardId, col, row);
        
        // Send to server in expected format
        const sent = this.safeSend({
            type: 'ACTION',
            actionId: this.generateActionId(),
            actionType: 'SUMMON_CRYPTID',
            payload: {
                cardId: cardId,
                col: col,
                row: row,
                cardData: cardData // Include card data for server
            }
        });
        
        return sent; // Action sent (not yet confirmed)
    },
    
    /**
     * Summon kindling
     */
    summonKindling(cardId, col, row) {
        if (!this.enabled) {
            return this.executeLocalKindlingSummon(cardId, col, row);
        }
        
        if (!this.isMyTurn) {
            this.showNotYourTurnMessage();
            return false;
        }
        
        console.log('[MPBridge] Sending kindling summon:', cardId, col, row);
        
        return this.safeSend({
            type: 'ACTION',
            actionId: this.generateActionId(),
            actionType: 'SUMMON_KINDLING',
            payload: {
                cardId: cardId,
                col: col,
                row: row
            }
        });
    },
    
    /**
     * Attack with a cryptid
     */
    attack(attackerCol, attackerRow, targetCol, targetRow) {
        if (!this.enabled) {
            return this.executeLocalAttack(attackerCol, attackerRow, targetCol, targetRow);
        }
        
        if (!this.isMyTurn) {
            this.showNotYourTurnMessage();
            return false;
        }
        
        console.log('[MPBridge] Sending attack:', attackerCol, attackerRow, '->', targetCol, targetRow);
        
        return this.safeSend({
            type: 'ACTION',
            actionId: this.generateActionId(),
            actionType: 'ATTACK',
            payload: {
                attackerCol: attackerCol,
                attackerRow: attackerRow,
                targetCol: targetCol,
                targetRow: targetRow
            }
        });
    },
    
    /**
     * End current phase / advance to next phase
     */
    endPhase() {
        if (!this.enabled) {
            return this.executeLocalEndPhase();
        }
        
        if (!this.isMyTurn) {
            this.showNotYourTurnMessage();
            return false;
        }
        
        const currentPhase = window.game?.phase || 'conjure1';
        console.log('[MPBridge] Sending end phase:', currentPhase);
        
        // Map to the correct action type based on current phase
        let actionType = 'END_CONJURE1';
        if (currentPhase === 'conjure1') actionType = 'END_CONJURE1';
        else if (currentPhase === 'combat') actionType = 'END_COMBAT';
        else if (currentPhase === 'conjure2') actionType = 'END_TURN';
        
        return this.safeSend({
            type: 'ACTION',
            actionId: this.generateActionId(),
            actionType: actionType,
            payload: {}
        });
    },
    
    /**
     * End turn
     */
    endTurn() {
        if (!this.enabled) {
            return this.executeLocalEndTurn();
        }
        
        if (!this.isMyTurn) {
            this.showNotYourTurnMessage();
            return false;
        }
        
        console.log('[MPBridge] Sending end turn');
        
        return this.safeSend({
            type: 'ACTION',
            actionId: this.generateActionId(),
            actionType: 'END_TURN',
            payload: {}
        });
    },
    
    /**
     * Burn pyre card
     */
    pyreBurn(cardIndex) {
        if (!this.enabled) {
            return this.executeLocalPyreBurn(cardIndex);
        }
        
        if (!this.isMyTurn) {
            this.showNotYourTurnMessage();
            return false;
        }
        
        console.log('[MPBridge] Sending pyre burn:', cardIndex);
        
        return this.safeSend({
            type: 'ACTION',
            actionId: this.generateActionId(),
            actionType: 'PYRE_BURN',
            payload: {
                cardIndex: cardIndex
            }
        });
    },
    
    /**
     * Play a pyre spell card (grants pyre resource)
     */
    playPyreCard(cardId, cardData = null) {
        if (!this.enabled) {
            return this.executeLocalPlayPyreCard(cardId, cardData);
        }
        
        if (!this.isMyTurn) {
            this.showNotYourTurnMessage();
            return false;
        }
        
        console.log('[MPBridge] Sending play pyre card:', cardId, cardData?.name);
        
        const sent = this.safeSend({
            type: 'ACTION',
            actionId: this.generateActionId(),
            actionType: 'PLAY_PYRE_CARD',
            payload: {
                cardId: cardId,
                cardName: cardData?.name
            }
        });
        
        // Only return success if message was actually sent
        if (sent) {
            return { pyreGained: 1 }; // Mock result for the UI (server will confirm)
        }
        return false;
    },
    
    executeLocalPlayPyreCard(cardId, cardData) {
        // Find and use the original function if stored
        if (typeof MultiplayerUIHooks !== 'undefined' && MultiplayerUIHooks.originalFunctions?.playPyreCard) {
            return MultiplayerUIHooks.originalFunctions.playPyreCard('player', cardData);
        }
        // Fallback - shouldn't happen in normal flow
        if (window.game && typeof window.game.playPyreCard === 'function') {
            return window.game.playPyreCard('player', cardData);
        }
        return false;
    },
    
    // ==================== SERVER EVENT HANDLING ====================
    
    handleServerEvent(event) {
        console.log('[MPBridge] Server event:', event.type, event);
        
        switch (event.type) {
            case 'CRYPTID_SUMMONED':
                this.applySummon(event);
                break;
                
            case 'KINDLING_SUMMONED':
                this.applyKindlingSummon(event);
                break;
                
            case 'ATTACK_DECLARED':
            case 'ATTACK_RESOLVED':
                this.applyAttack(event);
                break;
                
            case 'DAMAGE_DEALT':
                this.applyDamage(event);
                break;
                
            case 'CRYPTID_DIED':
                this.applyDeath(event);
                break;
                
            case 'CRYPTID_PROMOTED':
                this.applyPromotion(event);
                break;
                
            case 'PHASE_CHANGED':
                this.applyPhaseChange(event);
                break;
                
            case 'TURN_ENDED':
                // Server sends TURN_ENDED when someone ends their turn
                console.log('[MPBridge] Turn ended by:', event.owner);
                break;
                
            case 'TURN_STARTED':
                this.applyTurnStart(event);
                break;
                
            case 'TURN_CHANGED':
                this.applyTurnChange(event);
                break;
                
            case 'PYRE_CHANGED':
                this.applyPyreChange(event);
                break;
                
            case 'PYRE_BURN_USED':
            case 'PYRE_BURNED':
                this.applyPyreBurn(event);
                break;
                
            case 'PYRE_CARD_PLAYED':
                this.applyPyreCardPlayed(event);
                break;
                
            case 'CARD_DRAWN':
                this.applyCardDrawn(event);
                break;
                
            case 'GAME_ENDED':
            case 'GAME_OVER':
                this.applyGameOver(event);
                break;
                
            case 'PLAYER_CONCEDED':
                this.applyGameOver({
                    winner: event.winner,
                    reason: 'concede'
                });
                break;
                
            default:
                console.log('[MPBridge] Unhandled server event:', event.type, event);
        }
    },
    
    handleActionResult(result) {
        if (!result.success) {
            console.warn('[MPBridge] Action rejected:', result.reason);
            this.showActionRejected(result.reason);
            return;
        }
        
        // Action was accepted - apply all events
        if (result.events) {
            result.events.forEach(event => {
                this.handleServerEvent(event);
            });
        }
    },
    
    // ==================== APPLY SERVER EVENTS LOCALLY ====================
    
    applySummon(event) {
        const game = window.game;
        if (!game) return;
        
        // Determine if this is our summon or opponent's
        const isOurAction = (event.owner === this.myRole);
        
        // Map server perspective to local perspective
        const localOwner = isOurAction ? 'player' : 'enemy';
        const field = localOwner === 'player' ? game.playerField : game.enemyField;
        
        console.log('[MPBridge] Applying summon:', event.cardId, 'at', event.col, event.row, 'owner:', localOwner);
        
        // Create the cryptid object
        const cryptid = this.createCryptidFromEvent(event, localOwner);
        
        // Place on field
        field[event.col][event.row] = cryptid;
        
        // Remove from hand if it's ours
        if (isOurAction) {
            const handIndex = game.playerHand.findIndex(c => c.id === event.cardId);
            if (handIndex >= 0) {
                game.playerHand.splice(handIndex, 1);
            }
        }
        
        // Trigger UI update
        if (typeof renderField === 'function') renderField();
        if (typeof renderHand === 'function') renderHand();
        
        // Emit local event for animations
        GameEvents.emit('onSummon', {
            cryptid: cryptid,
            owner: localOwner,
            col: event.col,
            row: event.row
        });
    },
    
    applyKindlingSummon(event) {
        const game = window.game;
        if (!game) return;
        
        const isOurAction = (event.owner === this.myRole);
        const localOwner = isOurAction ? 'player' : 'enemy';
        const field = localOwner === 'player' ? game.playerField : game.enemyField;
        
        console.log('[MPBridge] Applying kindling summon:', event.cardId, 'owner:', localOwner);
        
        const kindling = this.createKindlingFromEvent(event, localOwner);
        field[event.col][event.row] = kindling;
        
        if (isOurAction) {
            const kindlingPool = game.playerKindling || [];
            const idx = kindlingPool.findIndex(k => k.id === event.cardId);
            if (idx >= 0) {
                kindlingPool.splice(idx, 1);
            }
        }
        
        if (typeof renderField === 'function') renderField();
        
        GameEvents.emit('onSummon', {
            cryptid: kindling,
            owner: localOwner,
            col: event.col,
            row: event.row,
            isKindling: true
        });
    },
    
    applyAttack(event) {
        console.log('[MPBridge] Applying attack:', event);
        
        const game = window.game;
        if (!game) return;
        
        // Get attacker and target positions from event
        const attackerOwner = event.attackerOwner || event.owner;
        const localAttackerOwner = (attackerOwner === this.myRole) ? 'player' : 'enemy';
        const attackerField = localAttackerOwner === 'player' ? game.playerField : game.enemyField;
        
        const attacker = attackerField[event.attackerCol]?.[event.attackerRow];
        
        // Mark attacker as tapped
        if (attacker) {
            attacker.tapped = true;
            attacker.canAttack = false;
            console.log('[MPBridge] Attacker tapped:', attacker.name);
        }
        
        // Trigger animation event
        GameEvents.emit('onAttack', {
            attacker: event.attacker || attacker,
            attackerCol: event.attackerCol,
            attackerRow: event.attackerRow,
            targetCol: event.targetCol,
            targetRow: event.targetRow,
            attackerOwner: localAttackerOwner,
            targetOwner: event.targetOwner
        });
        
        if (typeof renderField === 'function') renderField();
    },
    
    applyDamage(event) {
        const game = window.game;
        if (!game) return;
        
        // Map owner to local perspective - use targetOwner from server
        const targetOwner = event.targetOwner || event.owner;
        const localOwner = (targetOwner === this.myRole) ? 'player' : 'enemy';
        const field = localOwner === 'player' ? game.playerField : game.enemyField;
        
        // Server sends targetCol/targetRow
        const col = event.targetCol ?? event.col;
        const row = event.targetRow ?? event.row;
        
        const cryptid = field[col]?.[row];
        if (cryptid) {
            // Use hpAfter from server if available, otherwise calculate
            if (event.hpAfter !== undefined) {
                cryptid.currentHp = event.hpAfter;
            } else {
                cryptid.currentHp = Math.max(0, (cryptid.currentHp || cryptid.hp) - (event.damage || event.amount || 0));
            }
            
            console.log('[MPBridge] Damage applied to', cryptid.name, '- HP now:', cryptid.currentHp);
            
            GameEvents.emit('onDamage', {
                target: cryptid,
                amount: event.damage || event.amount,
                owner: localOwner,
                col: col,
                row: row
            });
        }
        
        if (typeof renderField === 'function') renderField();
    },
    
    applyDeath(event) {
        const game = window.game;
        if (!game) return;
        
        const localOwner = (event.owner === this.myRole) ? 'player' : 'enemy';
        const field = localOwner === 'player' ? game.playerField : game.enemyField;
        
        // Handle both formats: {col, row} and {slot: {col, row}}
        const col = event.col ?? event.slot?.col;
        const row = event.row ?? event.slot?.row;
        
        const cryptid = field[col]?.[row];
        
        if (cryptid) {
            console.log('[MPBridge] Cryptid died:', cryptid.name, 'at', col, row);
            
            GameEvents.emit('onDeath', {
                cryptid: cryptid,
                owner: localOwner,
                col: col,
                row: row
            });
        }
        
        // Remove from field
        if (field[col]) {
            field[col][row] = null;
        }
        
        // Update death count from server or increment
        if (event.newDeathCount !== undefined) {
            if (localOwner === 'player') {
                game.playerDeaths = event.newDeathCount;
            } else {
                game.enemyDeaths = event.newDeathCount;
            }
        } else {
            if (localOwner === 'player') {
                game.playerDeaths = (game.playerDeaths || 0) + 1;
            } else {
                game.enemyDeaths = (game.enemyDeaths || 0) + 1;
            }
        }
        
        if (typeof renderField === 'function') renderField();
        if (typeof updateDeathCounters === 'function') updateDeathCounters();
    },
    
    applyPhaseChange(event) {
        const game = window.game;
        if (!game) return;
        
        const oldPhase = game.phase;
        const newPhase = event.phase || event.newPhase;
        
        game.phase = newPhase;
        
        console.log('[MPBridge] Phase changed:', oldPhase, '->', newPhase);
        
        GameEvents.emit('onPhaseChange', {
            oldPhase: oldPhase,
            newPhase: newPhase
        });
        
        if (typeof updatePhaseTimeline === 'function') {
            updatePhaseTimeline(newPhase);
        }
        
        // Update UI for phase change
        if (typeof renderPhaseIndicator === 'function') {
            renderPhaseIndicator(newPhase);
        }
    },
    
    applyTurnChange(event) {
        const game = window.game;
        if (!game) return;
        
        // Server says whose turn it is ('player' or 'enemy' from server perspective)
        const newTurnPlayer = event.currentTurn;
        this.isMyTurn = (newTurnPlayer === this.myRole);
        
        // Update local game state
        // Map to local perspective: if it's my turn, game.currentTurn = 'player'
        game.currentTurn = this.isMyTurn ? 'player' : 'enemy';
        game.turnNumber = event.turnNumber || (game.turnNumber + 1);
        game.phase = 'conjure1'; // Reset to first phase
        
        console.log('[MPBridge] Turn changed to:', newTurnPlayer, '| My turn:', this.isMyTurn);
        
        this.updateTurnUI();
        
        GameEvents.emit('onTurnStart', {
            turn: game.currentTurn,
            turnNumber: game.turnNumber
        });
    },
    
    applyTurnStart(event) {
        const game = window.game;
        if (!game) return;
        
        // Server says whose turn it is ('player' or 'enemy' from server perspective)
        const newTurnPlayer = event.owner;
        this.isMyTurn = (newTurnPlayer === this.myRole);
        
        // Update local game state
        game.currentTurn = this.isMyTurn ? 'player' : 'enemy';
        game.turnNumber = event.turnNumber || (game.turnNumber + 1);
        game.phase = 'conjure1';
        
        console.log('[MPBridge] Turn started:', newTurnPlayer, '| Turn #', game.turnNumber, '| My turn:', this.isMyTurn);
        
        this.updateTurnUI();
        
        GameEvents.emit('onTurnStart', {
            turn: game.currentTurn,
            turnNumber: game.turnNumber
        });
    },
    
    applyPyreChange(event) {
        const game = window.game;
        if (!game) return;
        
        const localOwner = (event.owner === this.myRole) ? 'player' : 'enemy';
        const newPyre = event.newPyre ?? event.newTotal;
        
        if (localOwner === 'player') {
            game.playerPyre = newPyre;
        } else {
            game.enemyPyre = newPyre;
        }
        
        console.log('[MPBridge] Pyre changed for', localOwner, '- new total:', newPyre);
        
        if (typeof renderPyre === 'function') renderPyre();
        if (typeof updatePyreDisplay === 'function') updatePyreDisplay();
    },
    
    applyCardDrawn(event) {
        const game = window.game;
        if (!game) return;
        
        const isOurDraw = (event.owner === this.myRole);
        
        if (isOurDraw && event.card) {
            // Add to our hand
            game.playerHand = game.playerHand || [];
            game.playerHand.push(event.card);
            console.log('[MPBridge] Drew card:', event.card.name || event.card.id);
            
            if (typeof renderHand === 'function') renderHand();
        } else if (!isOurDraw) {
            // Opponent drew - just increment their hand count indicator
            console.log('[MPBridge] Opponent drew a card');
        }
        
        GameEvents.emit('onCardDrawn', {
            owner: isOurDraw ? 'player' : 'enemy',
            card: isOurDraw ? event.card : null
        });
    },
    
    applyPromotion(event) {
        const game = window.game;
        if (!game) return;
        
        const localOwner = (event.owner === this.myRole) ? 'player' : 'enemy';
        const field = localOwner === 'player' ? game.playerField : game.enemyField;
        
        const fromCol = event.fromSlot?.col;
        const fromRow = event.fromSlot?.row;
        const toCol = event.toSlot?.col;
        const toRow = event.toSlot?.row;
        
        // Move cryptid from support to combat
        const cryptid = field[fromCol]?.[fromRow];
        if (cryptid) {
            field[toCol][toRow] = cryptid;
            field[fromCol][fromRow] = null;
            cryptid.col = toCol;
            
            console.log('[MPBridge] Cryptid promoted:', cryptid.name, 'from', fromCol, fromRow, 'to', toCol, toRow);
        }
        
        if (typeof renderField === 'function') renderField();
    },
    
    applyPyreBurn(event) {
        const game = window.game;
        if (!game) return;
        
        const localOwner = (event.owner === this.myRole) ? 'player' : 'enemy';
        const newPyre = event.newTotal || event.newPyre;
        
        // Update pyre count
        if (localOwner === 'player') {
            game.playerPyre = newPyre;
        } else {
            game.enemyPyre = newPyre;
        }
        
        console.log('[MPBridge] Pyre burn used by', localOwner, '- new total:', newPyre);
        
        GameEvents.emit('onPyreBurn', {
            owner: localOwner,
            pyreGained: event.pyreGained,
            newPyre: newPyre
        });
        
        if (typeof renderPyre === 'function') renderPyre();
        if (typeof updatePyreDisplay === 'function') updatePyreDisplay();
    },
    
    applyPyreCardPlayed(event) {
        const game = window.game;
        if (!game) return;
        
        const localOwner = (event.owner === this.myRole) ? 'player' : 'enemy';
        const newPyre = event.newTotal || event.newPyre;
        
        // Update pyre count
        if (localOwner === 'player') {
            game.playerPyre = newPyre;
            game.playerPyreCardPlayedThisTurn = true;
            // Remove card from hand
            const idx = game.playerHand.findIndex(c => c.id === event.cardId);
            if (idx > -1) {
                const card = game.playerHand.splice(idx, 1)[0];
                if (card) game.playerDiscardPile = game.playerDiscardPile || [];
                if (card) game.playerDiscardPile.push(card);
            }
        } else {
            game.enemyPyre = newPyre;
        }
        
        console.log('[MPBridge] Pyre card played by', localOwner, '- new total:', newPyre);
        
        // Show message
        if (typeof showMessage === 'function') {
            const msg = localOwner === 'player' 
                ? `${event.cardName || 'Pyre Card'}: +${event.pyreGained} Pyre`
                : `Opponent played ${event.cardName || 'Pyre Card'}: +${event.pyreGained} Pyre`;
            showMessage(msg, 1500);
        }
        
        GameEvents.emit('onPyreGained', {
            owner: localOwner,
            amount: event.pyreGained,
            source: 'pyreCard'
        });
        
        if (typeof renderPyre === 'function') renderPyre();
        if (typeof updatePyreDisplay === 'function') updatePyreDisplay();
        if (typeof renderHand === 'function') renderHand();
    },
    
    applyGameOver(event) {
        const game = window.game;
        
        const iWon = (event.winner === this.myRole);
        
        console.log('[MPBridge] Game over! Winner:', event.winner, '| I won:', iWon, '| Reason:', event.reason);
        
        // Update final state if provided
        if (game && event.finalState) {
            game.playerDeaths = event.finalState.playerDeaths;
            game.enemyDeaths = event.finalState.enemyDeaths;
        }
        
        // Show results
        if (typeof showResultsScreen === 'function') {
            showResultsScreen({
                isWin: iWon,
                reason: event.reason,
                isMultiplayer: true,
                finalState: event.finalState
            });
        } else if (typeof showMatchResults === 'function') {
            showMatchResults(iWon, event.reason);
        } else {
            alert(iWon ? 'Victory!' : 'Defeat!');
        }
        
        // Disable further actions
        this.enabled = false;
    },
    
    // ==================== HELPER METHODS ====================
    
    createCryptidFromEvent(event, owner) {
        // Find the card data from our card database
        const cardData = this.findCardData(event.cardId, event.cardName);
        
        return {
            id: event.cardId,
            name: event.cardName || cardData?.name || 'Unknown',
            type: 'cryptid',
            hp: event.hp || cardData?.hp || 3,
            currentHp: event.currentHp || event.hp || cardData?.hp || 3,
            attack: event.attack || cardData?.attack || 1,
            element: event.element || cardData?.element || 'neutral',
            owner: owner,
            abilities: event.abilities || cardData?.abilities || [],
            effects: event.effects || cardData?.effects || [],
            hasAttacked: false,
            summoningSickness: true,
            ...cardData
        };
    },
    
    createKindlingFromEvent(event, owner) {
        return {
            id: event.cardId,
            name: event.cardName || 'Kindling',
            type: 'kindling',
            hp: 1,
            currentHp: 1,
            attack: 0,
            owner: owner,
            isKindling: true
        };
    },
    
    findCardData(cardId, cardName) {
        // Try to find card in various card sources
        if (typeof CityOfFleshCards !== 'undefined') {
            const card = CityOfFleshCards.cryptids?.find(c => c.id === cardId || c.name === cardName);
            if (card) return card;
        }
        
        if (typeof ForestsOfFearCards !== 'undefined') {
            const card = ForestsOfFearCards.cryptids?.find(c => c.id === cardId || c.name === cardName);
            if (card) return card;
        }
        
        // Check player's hand/deck
        if (window.game) {
            const handCard = window.game.playerHand?.find(c => c.id === cardId);
            if (handCard) return handCard;
        }
        
        return null;
    },
    
    // ==================== LOCAL EXECUTION FALLBACKS ====================
    // These are used in single-player or when multiplayer is disabled
    
    executeLocalSummon(cardId, col, row) {
        // Call existing game summon logic
        if (window.game && typeof window.game.summonCryptid === 'function') {
            return window.game.summonCryptid(cardId, col, row);
        }
        return false;
    },
    
    executeLocalKindlingSummon(cardId, col, row) {
        if (window.game && typeof window.game.summonKindling === 'function') {
            return window.game.summonKindling(cardId, col, row);
        }
        return false;
    },
    
    executeLocalAttack(attackerCol, attackerRow, targetCol, targetRow) {
        if (window.game && typeof window.game.attack === 'function') {
            return window.game.attack(attackerCol, attackerRow, targetCol, targetRow);
        }
        return false;
    },
    
    executeLocalEndPhase() {
        if (typeof advancePhase === 'function') {
            advancePhase();
            return true;
        }
        return false;
    },
    
    executeLocalEndTurn() {
        if (window.game && typeof window.game.endTurn === 'function') {
            window.game.endTurn();
            return true;
        }
        return false;
    },
    
    executeLocalPyreBurn(cardIndex) {
        if (window.game && typeof window.game.pyreBurn === 'function') {
            window.game.pyreBurn(cardIndex);
            return true;
        }
        return false;
    },
    
    // ==================== UI HELPERS ====================
    
    updateTurnUI() {
        // Update visual indicators for whose turn it is
        const turnIndicator = document.getElementById('turn-indicator');
        if (turnIndicator) {
            turnIndicator.textContent = this.isMyTurn ? 'Your Turn' : "Opponent's Turn";
            turnIndicator.className = this.isMyTurn ? 'your-turn' : 'opponent-turn';
        }
        
        // Enable/disable controls based on turn
        const controls = document.querySelectorAll('.end-turn-btn, .advance-phase-btn');
        controls.forEach(btn => {
            btn.disabled = !this.isMyTurn;
            btn.style.opacity = this.isMyTurn ? '1' : '0.5';
        });
        
        // Gray out hand cards if not your turn
        const handCards = document.querySelectorAll('.hand-card, .game-card');
        handCards.forEach(card => {
            if (this.isMyTurn) {
                card.classList.remove('disabled-turn');
            } else {
                card.classList.add('disabled-turn');
            }
        });
    },
    
    showNotYourTurnMessage() {
        if (typeof showMessage === 'function') {
            showMessage("Not your turn!", 1500);
        } else {
            console.log('[MPBridge] Not your turn!');
        }
    },
    
    showActionRejected(reason) {
        if (typeof showMessage === 'function') {
            showMessage(reason || "Action rejected", 2000);
        }
    },
    
    // ==================== CHECK METHODS ====================
    
    canAct() {
        return !this.enabled || this.isMyTurn;
    },
    
    isMultiplayerActive() {
        return this.enabled && this.client && this.client.connected;
    }
};

// Auto-initialize when game starts in multiplayer mode
document.addEventListener('DOMContentLoaded', () => {
    // Will be initialized by initMultiplayerGame in home-screen.js
});

console.log('[MultiplayerGameBridge] Module loaded');
