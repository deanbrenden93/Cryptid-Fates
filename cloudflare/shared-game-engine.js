/**
 * Cryptid Fates - Shared Game Engine
 * This is the authoritative game logic used by both server and client.
 * Contains pure game state and logic with NO browser/DOM dependencies.
 * 
 * Architecture:
 * - Server creates instance, processes actions, sends state to clients
 * - Clients receive state and render it (no local game logic in multiplayer)
 */

// ==================== SEEDED RANDOM NUMBER GENERATOR ====================
// Used for deterministic randomness (same seed = same sequence)
export class SeededRNG {
    constructor(seed = Date.now()) {
        this.seed = seed;
        this.m = 0x80000000; // 2^31
        this.a = 1103515245;
        this.c = 12345;
        this.state = seed;
    }
    
    nextInt() {
        this.state = (this.a * this.state + this.c) % this.m;
        return this.state;
    }
    
    nextFloat() {
        return this.nextInt() / (this.m - 1);
    }
    
    nextRange(min, max) {
        return min + Math.floor(this.nextFloat() * (max - min + 1));
    }
    
    shuffle(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(this.nextFloat() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}

// ==================== EVENT TYPES ====================
// Events emitted by the game engine (for animation sync)
export const GameEventTypes = {
    // Combat
    ATTACK_DECLARED: 'attackDeclared',
    DAMAGE_TAKEN: 'damageTaken',
    DEATH: 'death',
    
    // Field changes
    SUMMON: 'summon',
    PROMOTION: 'promotion',
    EVOLUTION: 'evolution',
    
    // Status effects
    STATUS_APPLIED: 'statusApplied',
    STATUS_TICK: 'statusTick',
    STATUS_REMOVED: 'statusRemoved',
    
    // Resources
    PYRE_CHANGED: 'pyreChanged',
    CARD_DRAWN: 'cardDrawn',
    
    // Turn management
    TURN_START: 'turnStart',
    TURN_END: 'turnEnd',
    PHASE_CHANGE: 'phaseChange',
    
    // Game state
    GAME_OVER: 'gameOver'
};

// ==================== ACTION TYPES ====================
// Actions that can be sent to the server
export const ActionTypes = {
    SUMMON: 'summon',
    SUMMON_KINDLING: 'summonKindling',
    ATTACK: 'attack',
    EVOLVE: 'evolve',
    PLAY_PYRE: 'playPyre',
    PLAY_BURST: 'playBurst',
    PLAY_AURA: 'playAura',
    PLAY_TRAP: 'playTrap',  // Client sends playTrap
    END_PHASE: 'endPhase',
    CONCEDE: 'concede'
};

// ==================== SHARED GAME ENGINE ====================
export class SharedGameEngine {
    constructor(cardRegistry = null) {
        // Card registry is injected - server and client can use different implementations
        this.cardRegistry = cardRegistry;
        
        // Initialize empty state
        this.state = this.createInitialState();
        
        // Event queue for animation sync
        this.eventQueue = [];
        
        // RNG for deterministic randomness
        this.rng = null;
    }
    
    // ==================== STATE INITIALIZATION ====================
    createInitialState() {
        return {
            // Fields: [col][row] where col 0/1, row 0/1/2
            playerField: [[null, null, null], [null, null, null]],
            enemyField: [[null, null, null], [null, null, null]],
            
            // Hands and decks
            playerHand: [],
            enemyHand: [],
            playerDeck: [],
            enemyDeck: [],
            playerKindling: [],
            enemyKindling: [],
            
            // Resources
            playerPyre: 0,
            enemyPyre: 0,
            
            // Death counters (win condition: first to 10 kills)
            playerDeaths: 0,
            enemyDeaths: 0,
            
            // Turn tracking
            currentTurn: 'player',
            phase: 'conjure1', // conjure1 -> combat -> conjure2 -> end
            turnNumber: 0,
            
            // Per-turn flags
            playerKindlingPlayedThisTurn: false,
            enemyKindlingPlayedThisTurn: false,
            playerPyreCardPlayedThisTurn: false,
            enemyPyreCardPlayedThisTurn: false,
            
            // Traps: [slot0, slot1] for each player
            playerTraps: [null, null],
            enemyTraps: [null, null],
            
            // Toxic tiles: [col][row] = turns remaining
            playerToxicTiles: [[0, 0, 0], [0, 0, 0]],
            enemyToxicTiles: [[0, 0, 0], [0, 0, 0]],
            
            // Evolution tracking (prevent multiple evolutions same position)
            evolvedThisTurn: {},
            
            // Game over flag
            gameOver: false,
            winner: null,
            
            // Match statistics
            matchStats: {
                startTime: Date.now(),
                damageDealt: 0,
                damageTaken: 0,
                spellsCast: 0,
                evolutions: 0,
                kindlingSummoned: 0
            }
        };
    }
    
    // ==================== COLUMN HELPERS ====================
    // These are CRITICAL for correct field operations
    // Player: support=0, combat=1
    // Enemy: support=1, combat=0
    getSupportCol(owner) {
        return owner === 'player' ? 0 : 1;
    }
    
    getCombatCol(owner) {
        return owner === 'player' ? 1 : 0;
    }
    
    // ==================== FIELD OPERATIONS ====================
    getFieldCryptid(owner, col, row) {
        const field = owner === 'player' ? this.state.playerField : this.state.enemyField;
        return field[col]?.[row] || null;
    }
    
    setFieldCryptid(owner, col, row, cryptid) {
        const field = owner === 'player' ? this.state.playerField : this.state.enemyField;
        field[col][row] = cryptid;
    }
    
    isFieldEmpty(owner) {
        const field = owner === 'player' ? this.state.playerField : this.state.enemyField;
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                if (field[c][r]) return false;
            }
        }
        return true;
    }
    
    // Get combatant in same row as a support
    getCombatant(cryptid) {
        if (!cryptid) return null;
        const owner = cryptid.owner;
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        
        if (cryptid.col === supportCol) {
            return this.getFieldCryptid(owner, combatCol, cryptid.row);
        }
        return null;
    }
    
    // Get support in same row as a combatant
    getSupport(cryptid) {
        if (!cryptid) return null;
        const owner = cryptid.owner;
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        
        if (cryptid.col === combatCol) {
            return this.getFieldCryptid(owner, supportCol, cryptid.row);
        }
        return null;
    }
    
    isInCombat(cryptid) {
        return cryptid && cryptid.col === this.getCombatCol(cryptid.owner);
    }
    
    isInSupport(cryptid) {
        return cryptid && cryptid.col === this.getSupportCol(cryptid.owner);
    }
    
    // ==================== GAME INITIALIZATION ====================
    initMatch(player1Id, player2Id, seed = Date.now(), player1GoesFirst = true) {
        console.log('[Engine] initMatch called with:', { player1Id, player2Id, seed, player1GoesFirst });
        
        this.state = this.createInitialState();
        this.rng = new SeededRNG(seed);
        
        // Store player IDs
        this.state.player1Id = player1Id;
        this.state.player2Id = player2Id;
        
        // Pyre starts at 0, +1 at each turn start
        this.state.playerPyre = 0;
        this.state.enemyPyre = 0;
        
        // Set who goes first based on matchmaker's coin flip
        // 'player' means player1's turn, 'enemy' means player2's turn
        this.state.currentTurn = player1GoesFirst ? 'player' : 'enemy';
        this.state.turnNumber = 0;
        
        this.eventQueue = [];
        
        console.log('[Engine] initMatch complete. State:', {
            player1Id: this.state.player1Id,
            player2Id: this.state.player2Id,
            currentTurn: this.state.currentTurn,
            currentTurnMeansPlayer: this.state.currentTurn === 'player' ? 'player1' : 'player2'
        });
    }
    
    // Initialize decks from client-provided data
    // Client sends: { mainDeck, kindling, hand }
    // We use the exact hand client provides (same IDs) for consistency
    initializeDecks(playerId, deckData) {
        const isPlayer1 = playerId === this.state.player1Id;
        
        if (isPlayer1) {
            this.state.playerDeck = deckData.mainDeck || [];
            this.state.playerKindling = deckData.kindling || [];
            
            // Use provided hand if available (client already drew these)
            // Otherwise shuffle and draw
            if (deckData.hand && deckData.hand.length > 0) {
                this.state.playerHand = deckData.hand;
            } else {
                this.state.playerDeck = this.rng.shuffle(this.state.playerDeck);
                this.state.playerHand = [];
                for (let i = 0; i < 7 && this.state.playerDeck.length > 0; i++) {
                    this.state.playerHand.push(this.state.playerDeck.shift());
                }
            }
        } else {
            this.state.enemyDeck = deckData.mainDeck || [];
            this.state.enemyKindling = deckData.kindling || [];
            
            // Use provided hand if available
            if (deckData.hand && deckData.hand.length > 0) {
                this.state.enemyHand = deckData.hand;
            } else {
                this.state.enemyDeck = this.rng.shuffle(this.state.enemyDeck);
                this.state.enemyHand = [];
                for (let i = 0; i < 7 && this.state.enemyDeck.length > 0; i++) {
                    this.state.enemyHand.push(this.state.enemyDeck.shift());
                }
            }
        }
    }
    
    // ==================== TURN MANAGEMENT ====================
    startTurn(owner) {
        this.state.currentTurn = owner;
        this.state.phase = 'conjure1';
        this.state.turnNumber++;
        this.state.evolvedThisTurn = {};
        
        // Grant 1 pyre at turn start
        if (owner === 'player') {
            this.state.playerPyre++;
            this.state.playerKindlingPlayedThisTurn = false;
            this.state.playerPyreCardPlayedThisTurn = false;
        } else {
            this.state.enemyPyre++;
            this.state.enemyKindlingPlayedThisTurn = false;
            this.state.enemyPyreCardPlayedThisTurn = false;
        }
        
        // Draw a card
        this.drawCard(owner);
        
        // Process start-of-turn effects
        this.processStatusEffects(owner);
        this.untapCryptids(owner);
        
        // Emit event
        this.emitEvent(GameEventTypes.TURN_START, {
            owner,
            turnNumber: this.state.turnNumber,
            pyre: owner === 'player' ? this.state.playerPyre : this.state.enemyPyre
        });
    }
    
    endPhase() {
        const currentPhase = this.state.phase;
        const owner = this.state.currentTurn;
        
        if (currentPhase === 'conjure1') {
            this.state.phase = 'combat';
        } else if (currentPhase === 'combat') {
            this.state.phase = 'conjure2';
        } else if (currentPhase === 'conjure2') {
            // End turn, switch to opponent
            this.endTurn();
            return;
        }
        
        this.emitEvent(GameEventTypes.PHASE_CHANGE, {
            owner,
            newPhase: this.state.phase,
            oldPhase: currentPhase
        });
    }
    
    endTurn() {
        const owner = this.state.currentTurn;
        
        // Process end-of-turn effects
        this.processEndOfTurnEffects(owner);
        
        this.emitEvent(GameEventTypes.TURN_END, {
            owner,
            turnNumber: this.state.turnNumber
        });
        
        // Switch to opponent
        const nextOwner = owner === 'player' ? 'enemy' : 'player';
        this.startTurn(nextOwner);
    }
    
    drawCard(owner) {
        const deck = owner === 'player' ? this.state.playerDeck : this.state.enemyDeck;
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        
        if (deck.length > 0) {
            const card = deck.shift();
            hand.push(card);
            
            this.emitEvent(GameEventTypes.CARD_DRAWN, {
                owner,
                cardId: card.id,
                handSize: hand.length
            });
        }
    }
    
    // ==================== ACTION PROCESSING ====================
    processAction(playerId, action) {
        // DEBUG: Log player ID matching
        console.log('[Engine] processAction called:', {
            playerId,
            player1Id: this.state.player1Id,
            player2Id: this.state.player2Id,
            currentTurn: this.state.currentTurn,
            actionType: action?.type
        });
        
        // Determine if this is player or enemy from the server's perspective
        const isPlayer1 = playerId === this.state.player1Id;
        const actorOwner = isPlayer1 ? 'player' : 'enemy';
        
        console.log('[Engine] Turn check:', { isPlayer1, actorOwner, currentTurn: this.state.currentTurn });
        
        // Validate it's this player's turn (except for concede)
        if (action.type !== ActionTypes.CONCEDE && this.state.currentTurn !== actorOwner) {
            console.log('[Engine] REJECTED - not your turn');
            return { success: false, error: `Not your turn (you are ${actorOwner}, current turn is ${this.state.currentTurn})` };
        }
        
        // Clear event queue for this action
        this.eventQueue = [];
        
        let result;
        switch (action.type) {
            case ActionTypes.SUMMON:
                result = this.handleSummon(actorOwner, action);
                break;
            case ActionTypes.SUMMON_KINDLING:
                result = this.handleSummonKindling(actorOwner, action);
                break;
            case ActionTypes.ATTACK:
                result = this.handleAttack(actorOwner, action);
                break;
            case ActionTypes.EVOLVE:
                result = this.handleEvolve(actorOwner, action);
                break;
            case ActionTypes.PLAY_PYRE:
                result = this.handlePlayPyre(actorOwner, action);
                break;
            case ActionTypes.PLAY_BURST:
                result = this.handlePlayBurst(actorOwner, action);
                break;
            case ActionTypes.PLAY_AURA:
                result = this.handlePlayAura(actorOwner, action);
                break;
            case ActionTypes.PLAY_TRAP:
                result = this.handleSetTrap(actorOwner, action);
                break;
            case ActionTypes.END_PHASE:
                result = this.handleEndPhase(actorOwner);
                break;
            case ActionTypes.CONCEDE:
                result = this.handleConcede(actorOwner);
                break;
            default:
                result = { success: false, error: `Unknown action type: ${action.type}` };
        }
        
        return {
            ...result,
            events: this.eventQueue,
            state: this.state
        };
    }
    
    // ==================== ACTION HANDLERS ====================
    
    handleSummon(owner, action) {
        const { cardIndex, col, row } = action;
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        const pyre = owner === 'player' ? this.state.playerPyre : this.state.enemyPyre;
        
        // Validate phase
        if (this.state.phase !== 'conjure1' && this.state.phase !== 'conjure2') {
            return { success: false, error: 'Can only summon during conjure phases' };
        }
        
        // Validate card exists in hand
        if (cardIndex < 0 || cardIndex >= hand.length) {
            return { success: false, error: 'Invalid card index' };
        }
        
        const card = hand[cardIndex];
        
        // Validate it's a cryptid
        if (card.type !== 'cryptid') {
            return { success: false, error: 'Can only summon cryptids' };
        }
        
        // Validate cost
        if (card.cost > pyre) {
            return { success: false, error: 'Not enough pyre' };
        }
        
        // Validate position is empty
        if (this.getFieldCryptid(owner, col, row)) {
            return { success: false, error: 'Position occupied' };
        }
        
        // Validate it's a valid summon slot (combat first, then support)
        const validSlots = this.getValidSummonSlots(owner);
        const isValid = validSlots.some(s => s.col === col && s.row === row);
        if (!isValid) {
            return { success: false, error: 'Invalid summon position' };
        }
        
        // Perform summon
        hand.splice(cardIndex, 1);
        if (owner === 'player') {
            this.state.playerPyre -= card.cost;
        } else {
            this.state.enemyPyre -= card.cost;
        }
        
        const cryptid = this.summonCryptid(owner, col, row, card);
        
        return {
            success: true,
            cryptid,
            action: { ...action, cryptid }
        };
    }
    
    handleSummonKindling(owner, action) {
        const { kindlingIndex, col, row } = action;
        const kindling = owner === 'player' ? this.state.playerKindling : this.state.enemyKindling;
        
        // Validate phase
        if (this.state.phase !== 'conjure1' && this.state.phase !== 'conjure2') {
            return { success: false, error: 'Can only summon during conjure phases' };
        }
        
        // Validate one kindling per turn
        const playedThisTurn = owner === 'player' 
            ? this.state.playerKindlingPlayedThisTurn 
            : this.state.enemyKindlingPlayedThisTurn;
        if (playedThisTurn) {
            return { success: false, error: 'Already played kindling this turn' };
        }
        
        // Validate kindling exists
        if (kindlingIndex < 0 || kindlingIndex >= kindling.length) {
            return { success: false, error: 'Invalid kindling index' };
        }
        
        // Validate position is empty
        if (this.getFieldCryptid(owner, col, row)) {
            return { success: false, error: 'Position occupied' };
        }
        
        // Perform summon
        const kindlingCard = kindling.splice(kindlingIndex, 1)[0];
        if (owner === 'player') {
            this.state.playerKindlingPlayedThisTurn = true;
        } else {
            this.state.enemyKindlingPlayedThisTurn = true;
        }
        
        const cryptid = this.summonKindling(owner, col, row, kindlingCard);
        
        this.state.matchStats.kindlingSummoned++;
        
        return {
            success: true,
            cryptid,
            action: { ...action, cryptid, kindlingCard }
        };
    }
    
    handleAttack(owner, action) {
        const { attackerCol, attackerRow, targetRow, targetCol } = action;
        
        // Validate phase
        if (this.state.phase !== 'combat') {
            return { success: false, error: 'Can only attack during combat phase' };
        }
        
        // Get attacker
        const attacker = this.getFieldCryptid(owner, attackerCol, attackerRow);
        if (!attacker) {
            return { success: false, error: 'No attacker at position' };
        }
        
        // Validate attacker can attack
        if (attacker.tapped || !attacker.canAttack) {
            return { success: false, error: 'Attacker cannot attack' };
        }
        
        // Validate attacker is in combat position
        if (!this.isInCombat(attacker)) {
            return { success: false, error: 'Only combatants can attack' };
        }
        
        // Get target owner (always the opponent)
        const targetOwner = owner === 'player' ? 'enemy' : 'player';
        
        // Determine actual target column
        let actualTargetCol = targetCol;
        if (actualTargetCol === undefined || actualTargetCol === null) {
            // Default to combat column
            actualTargetCol = this.getCombatCol(targetOwner);
        }
        
        // Get target
        let target = this.getFieldCryptid(targetOwner, actualTargetCol, targetRow);
        
        // If no target and enemy field is empty, force kindling summon
        if (!target && this.isFieldEmpty(targetOwner)) {
            const forcedKindling = this.forceKindlingSummon(targetOwner, actualTargetCol, targetRow);
            if (forcedKindling) {
                target = forcedKindling;
            } else {
                return { success: false, error: 'No valid target' };
            }
        }
        
        if (!target) {
            return { success: false, error: 'No target at position' };
        }
        
        // Perform attack
        const result = this.attack(attacker, target);
        
        return {
            success: true,
            attackResult: result,
            action: { ...action, result }
        };
    }
    
    handleEvolve(owner, action) {
        const { cardIndex, targetCol, targetRow } = action;
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        const pyre = owner === 'player' ? this.state.playerPyre : this.state.enemyPyre;
        
        // Validate phase
        if (this.state.phase !== 'conjure1' && this.state.phase !== 'conjure2') {
            return { success: false, error: 'Can only evolve during conjure phases' };
        }
        
        // Validate card exists
        if (cardIndex < 0 || cardIndex >= hand.length) {
            return { success: false, error: 'Invalid card index' };
        }
        
        const card = hand[cardIndex];
        
        // Validate it's an evolution
        if (!card.evolvesFrom) {
            return { success: false, error: 'Card is not an evolution' };
        }
        
        // Validate cost
        if (card.cost > pyre) {
            return { success: false, error: 'Not enough pyre' };
        }
        
        // Get base cryptid
        const baseCryptid = this.getFieldCryptid(owner, targetCol, targetRow);
        if (!baseCryptid) {
            return { success: false, error: 'No cryptid at target position' };
        }
        
        // Validate base matches
        if (baseCryptid.key !== card.evolvesFrom) {
            return { success: false, error: 'Base cryptid does not match evolution requirement' };
        }
        
        // Validate not already evolved this turn
        const posKey = `${owner}-${targetCol}-${targetRow}`;
        if (this.state.evolvedThisTurn[posKey]) {
            return { success: false, error: 'Already evolved at this position this turn' };
        }
        
        // Perform evolution
        hand.splice(cardIndex, 1);
        if (owner === 'player') {
            this.state.playerPyre -= card.cost;
        } else {
            this.state.enemyPyre -= card.cost;
        }
        
        const evolved = this.evolveCryptid(baseCryptid, card);
        this.state.evolvedThisTurn[posKey] = true;
        this.state.matchStats.evolutions++;
        
        return {
            success: true,
            evolved,
            action: { ...action, evolved, baseCryptid }
        };
    }
    
    handlePlayPyre(owner, action) {
        const { cardIndex } = action;
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        
        // Validate one pyre card per turn
        const playedThisTurn = owner === 'player' 
            ? this.state.playerPyreCardPlayedThisTurn 
            : this.state.enemyPyreCardPlayedThisTurn;
        if (playedThisTurn) {
            return { success: false, error: 'Already played pyre card this turn' };
        }
        
        // Validate card exists
        if (cardIndex < 0 || cardIndex >= hand.length) {
            return { success: false, error: 'Invalid card index' };
        }
        
        const card = hand[cardIndex];
        
        // Validate it's a pyre card
        if (card.type !== 'pyre') {
            return { success: false, error: 'Not a pyre card' };
        }
        
        // Perform pyre card play
        hand.splice(cardIndex, 1);
        if (owner === 'player') {
            this.state.playerPyreCardPlayedThisTurn = true;
            this.state.playerPyre += (card.pyreValue || 1);
        } else {
            this.state.enemyPyreCardPlayedThisTurn = true;
            this.state.enemyPyre += (card.pyreValue || 1);
        }
        
        this.emitEvent(GameEventTypes.PYRE_CHANGED, {
            owner,
            change: card.pyreValue || 1,
            newValue: owner === 'player' ? this.state.playerPyre : this.state.enemyPyre,
            source: card.name
        });
        
        return {
            success: true,
            pyreGained: card.pyreValue || 1,
            action: { ...action, card }
        };
    }
    
    handlePlayBurst(owner, action) {
        const { cardIndex, targetOwner, targetCol, targetRow } = action;
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        const pyre = owner === 'player' ? this.state.playerPyre : this.state.enemyPyre;
        
        // Validate card exists
        if (cardIndex < 0 || cardIndex >= hand.length) {
            return { success: false, error: 'Invalid card index' };
        }
        
        const card = hand[cardIndex];
        
        // Validate it's a burst
        if (card.type !== 'burst') {
            return { success: false, error: 'Not a burst card' };
        }
        
        // Validate cost
        if (card.cost > pyre) {
            return { success: false, error: 'Not enough pyre' };
        }
        
        // Get target if required
        let target = null;
        if (card.targetRequired !== false) {
            target = this.getFieldCryptid(targetOwner, targetCol, targetRow);
            if (!target) {
                return { success: false, error: 'No target for burst' };
            }
        }
        
        // Perform burst
        hand.splice(cardIndex, 1);
        if (owner === 'player') {
            this.state.playerPyre -= card.cost;
        } else {
            this.state.enemyPyre -= card.cost;
        }
        
        // Execute burst effect
        if (card.onCast) {
            card.onCast(target, owner, this);
        }
        
        this.state.matchStats.spellsCast++;
        
        return {
            success: true,
            action: { ...action, card, target }
        };
    }
    
    handlePlayAura(owner, action) {
        const { cardIndex, targetCol, targetRow } = action;
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        const pyre = owner === 'player' ? this.state.playerPyre : this.state.enemyPyre;
        
        // Validate card exists
        if (cardIndex < 0 || cardIndex >= hand.length) {
            return { success: false, error: 'Invalid card index' };
        }
        
        const card = hand[cardIndex];
        
        // Validate it's an aura
        if (card.type !== 'aura') {
            return { success: false, error: 'Not an aura card' };
        }
        
        // Validate cost
        if (card.cost > pyre) {
            return { success: false, error: 'Not enough pyre' };
        }
        
        // Get target (auras target friendly cryptids)
        const target = this.getFieldCryptid(owner, targetCol, targetRow);
        if (!target) {
            return { success: false, error: 'No target for aura' };
        }
        
        // Perform aura attachment
        hand.splice(cardIndex, 1);
        if (owner === 'player') {
            this.state.playerPyre -= card.cost;
        } else {
            this.state.enemyPyre -= card.cost;
        }
        
        this.applyAura(target, card);
        
        return {
            success: true,
            action: { ...action, card, target }
        };
    }
    
    handleSetTrap(owner, action) {
        const { cardIndex, slot } = action;
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        const pyre = owner === 'player' ? this.state.playerPyre : this.state.enemyPyre;
        const traps = owner === 'player' ? this.state.playerTraps : this.state.enemyTraps;
        
        // Validate card exists
        if (cardIndex < 0 || cardIndex >= hand.length) {
            return { success: false, error: 'Invalid card index' };
        }
        
        const card = hand[cardIndex];
        
        // Validate it's a trap
        if (card.type !== 'trap') {
            return { success: false, error: 'Not a trap card' };
        }
        
        // Validate cost
        if (card.cost > pyre) {
            return { success: false, error: 'Not enough pyre' };
        }
        
        // Validate slot is available
        if (slot < 0 || slot > 1 || traps[slot] !== null) {
            return { success: false, error: 'Trap slot not available' };
        }
        
        // Set trap
        hand.splice(cardIndex, 1);
        if (owner === 'player') {
            this.state.playerPyre -= card.cost;
        } else {
            this.state.enemyPyre -= card.cost;
        }
        
        traps[slot] = { ...card, owner };
        
        return {
            success: true,
            action: { ...action, card, slot }
        };
    }
    
    handleEndPhase(owner) {
        this.endPhase();
        return {
            success: true,
            newPhase: this.state.phase,
            action: { type: ActionTypes.END_PHASE }
        };
    }
    
    handleConcede(owner) {
        const winner = owner === 'player' ? 'enemy' : 'player';
        this.endGame(winner);
        return {
            success: true,
            winner,
            action: { type: ActionTypes.CONCEDE }
        };
    }
    
    // ==================== GAME LOGIC ====================
    
    summonCryptid(owner, col, row, cardData) {
        const supportCol = this.getSupportCol(owner);
        const combatCol = this.getCombatCol(owner);
        
        const cryptid = {
            ...cardData,
            owner,
            col,
            row,
            currentHp: cardData.hp,
            maxHp: cardData.hp,
            currentAtk: cardData.atk,
            baseAtk: cardData.atk,
            baseHp: cardData.hp,
            tapped: false,
            canAttack: true,
            extraTapTurns: 0,
            evolutionChain: cardData.evolutionChain || [cardData.key],
            evolvedThisTurn: false,
            justSummoned: true,
            burnTurns: 0,
            stunned: false,
            paralyzed: false,
            paralyzeTurns: 0,
            bleedTurns: 0,
            protectionCharges: 0,
            curseTokens: 0,
            latchedTo: null,
            latchedBy: null,
            auras: [],
            attackedThisTurn: false,
            restedThisTurn: false
        };
        
        this.setFieldCryptid(owner, col, row, cryptid);
        
        // Trigger onSummon callback if exists
        if (cryptid.onSummon) {
            cryptid.onSummon(cryptid, owner, this);
        }
        
        // Trigger position-specific callbacks
        if (col === supportCol && cryptid.onSupport) {
            cryptid.onSupport(cryptid, owner, this);
        }
        if (col === combatCol && cryptid.onCombat) {
            cryptid.onCombat(cryptid, owner, this);
        }
        
        this.emitEvent(GameEventTypes.SUMMON, {
            owner,
            col,
            row,
            cryptid: this.serializeCryptid(cryptid),
            isKindling: cardData.isKindling || false
        });
        
        return cryptid;
    }
    
    summonKindling(owner, col, row, kindlingCard) {
        if (!kindlingCard) return null;
        
        const cryptid = this.summonCryptid(owner, col, row, {
            ...kindlingCard,
            isKindling: true
        });
        
        return cryptid;
    }
    
    forceKindlingSummon(owner, col, row) {
        // When attacked with empty field, defender must summon random kindling
        const kindling = owner === 'player' ? this.state.playerKindling : this.state.enemyKindling;
        
        if (kindling.length === 0) return null;
        
        const idx = Math.floor(this.rng.nextFloat() * kindling.length);
        const kindlingCard = kindling.splice(idx, 1)[0];
        
        return this.summonKindling(owner, col, row, kindlingCard);
    }
    
    getValidSummonSlots(owner) {
        const field = owner === 'player' ? this.state.playerField : this.state.enemyField;
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        const slots = [];
        
        // Combat slots have priority
        for (let r = 0; r < 3; r++) {
            if (field[combatCol][r] === null) {
                slots.push({ col: combatCol, row: r });
            } else if (field[supportCol][r] === null) {
                slots.push({ col: supportCol, row: r });
            }
        }
        
        return slots;
    }
    
    calculateAttackDamage(attacker) {
        const { owner, col, row } = attacker;
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        
        let damage = attacker.currentAtk 
            - (attacker.atkDebuff || 0) 
            - (attacker.curseTokens || 0)
            - (attacker.gremlinAtkDebuff || 0)
            - (attacker.decayRatAtkDebuff || 0);
        
        // Add support ATK if in combat
        if (col === combatCol) {
            const support = this.getFieldCryptid(owner, supportCol, row);
            if (support) {
                damage += support.currentAtk 
                    - (support.atkDebuff || 0) 
                    - (support.curseTokens || 0)
                    - (support.decayRatAtkDebuff || 0);
            }
        }
        
        // Bonus damage
        if (attacker.bonusDamage) damage += attacker.bonusDamage;
        
        // Toxic tile penalty
        if (this.isTileToxic(owner, col, row)) damage -= 1;
        
        return Math.max(0, damage);
    }
    
    attack(attacker, target) {
        const targetOwner = target.owner;
        const targetCol = target.col;
        const targetRow = target.row;
        
        // Calculate damage
        let damage = this.calculateAttackDamage(attacker);
        
        // Apply combat ability damage bonus
        if (attacker.onCombatAttack) {
            damage += attacker.onCombatAttack(attacker, target, this) || 0;
        }
        
        // Bleed doubles damage
        if (target.bleedTurns > 0) {
            damage *= 2;
        }
        
        // Protection check
        let protectionBlocked = false;
        if (target.protectionCharges > 0 && target.blockFirstHit) {
            target.protectionCharges--;
            if (target.protectionCharges === 0) {
                target.blockFirstHit = false;
                target.damageReduction = 0;
            }
            damage = 0;
            protectionBlocked = true;
        }
        
        // Apply damage
        const hpBefore = target.currentHp;
        target.currentHp -= damage;
        
        this.emitEvent(GameEventTypes.DAMAGE_TAKEN, {
            target: this.serializeCryptid(target),
            damage,
            source: this.serializeCryptid(attacker),
            sourceType: 'attack',
            hpBefore,
            hpAfter: target.currentHp
        });
        
        // Track stats
        if (attacker.owner === 'player') {
            this.state.matchStats.damageDealt += damage;
        } else {
            this.state.matchStats.damageTaken += damage;
        }
        
        // Tap attacker
        const support = this.getSupport(attacker);
        const hasFocus = attacker.hasFocus || (support?.grantsFocus);
        const preventTap = support?.preventCombatantTap || attacker.noTapOnAttack;
        
        if (attacker.canAttackAgain) {
            attacker.canAttackAgain = false;
        } else if (hasFocus || preventTap) {
            attacker.canAttack = false;
        } else {
            attacker.tapped = true;
            attacker.canAttack = false;
        }
        attacker.attackedThisTurn = true;
        
        // Check death
        let killed = false;
        if (this.getEffectiveHp(target) <= 0) {
            this.killCryptid(target, attacker);
            killed = true;
        }
        
        return { damage, killed, protectionBlocked };
    }
    
    getEffectiveHp(cryptid) {
        if (!cryptid) return 0;
        let hp = cryptid.currentHp;
        
        // Combat units pool HP with their support
        if (this.isInCombat(cryptid)) {
            const support = this.getSupport(cryptid);
            if (support) hp += support.currentHp;
        }
        
        return hp;
    }
    
    killCryptid(cryptid, killedBy = null) {
        const { owner, col, row } = cryptid;
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        
        // Remove from field
        this.setFieldCryptid(owner, col, row, null);
        
        // Count deaths (evolution chain length)
        const deathCount = cryptid.evolutionChain?.length || 1;
        
        // Update death counters
        if (owner === 'player') {
            this.state.playerDeaths += deathCount;
        } else {
            this.state.enemyDeaths += deathCount;
        }
        
        this.emitEvent(GameEventTypes.DEATH, {
            cryptid: this.serializeCryptid(cryptid),
            owner,
            col,
            row,
            deathCount,
            killedBy: killedBy ? this.serializeCryptid(killedBy) : null
        });
        
        // Promote support if combatant died
        if (col === combatCol) {
            const support = this.getFieldCryptid(owner, supportCol, row);
            if (support) {
                this.promoteSupport(owner, row);
            }
        }
        
        // Check game over
        this.checkGameOver();
        
        return { owner, col, row, deathCount };
    }
    
    promoteSupport(owner, row) {
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        
        const support = this.getFieldCryptid(owner, supportCol, row);
        if (!support) return null;
        
        // Move to combat
        this.setFieldCryptid(owner, supportCol, row, null);
        support.col = combatCol;
        this.setFieldCryptid(owner, combatCol, row, support);
        
        // Trigger combat callbacks
        if (support.onCombat) {
            support.onCombat(support, owner, this);
        }
        if (support.onEnterCombat) {
            support.onEnterCombat(support, owner, this);
        }
        
        this.emitEvent(GameEventTypes.PROMOTION, {
            cryptid: this.serializeCryptid(support),
            owner,
            row,
            fromCol: supportCol,
            toCol: combatCol
        });
        
        return support;
    }
    
    evolveCryptid(baseCryptid, evolutionCard) {
        const { owner, col, row } = baseCryptid;
        
        const evolved = {
            ...evolutionCard,
            owner,
            col,
            row,
            currentHp: evolutionCard.hp,
            maxHp: evolutionCard.hp,
            currentAtk: evolutionCard.atk,
            baseAtk: evolutionCard.atk,
            baseHp: evolutionCard.hp,
            tapped: baseCryptid.tapped,
            canAttack: baseCryptid.canAttack,
            extraTapTurns: 0,
            evolutionChain: [...(baseCryptid.evolutionChain || [baseCryptid.key]), evolutionCard.key],
            evolvedThisTurn: true,
            justSummoned: false,
            burnTurns: 0,
            stunned: false,
            paralyzed: false,
            paralyzeTurns: 0,
            bleedTurns: 0,
            protectionCharges: 0,
            curseTokens: 0,
            latchedTo: null,
            latchedBy: null,
            auras: [],
            attackedThisTurn: baseCryptid.attackedThisTurn || false,
            restedThisTurn: baseCryptid.restedThisTurn || false
        };
        
        this.setFieldCryptid(owner, col, row, evolved);
        
        // Trigger callbacks
        if (evolved.onSummon) {
            evolved.onSummon(evolved, owner, this);
        }
        
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        
        if (col === combatCol && evolved.onCombat) {
            evolved.onCombat(evolved, owner, this);
        }
        if (col === supportCol && evolved.onSupport) {
            evolved.onSupport(evolved, owner, this);
        }
        
        this.emitEvent(GameEventTypes.EVOLUTION, {
            baseCryptid: this.serializeCryptid(baseCryptid),
            evolved: this.serializeCryptid(evolved),
            owner,
            col,
            row
        });
        
        return evolved;
    }
    
    // ==================== STATUS EFFECTS ====================
    
    isTileToxic(owner, col, row) {
        const tiles = owner === 'player' ? this.state.playerToxicTiles : this.state.enemyToxicTiles;
        return tiles[col]?.[row] > 0;
    }
    
    applyBurn(target, turns = 2) {
        target.burnTurns = Math.max(target.burnTurns, turns);
        this.emitEvent(GameEventTypes.STATUS_APPLIED, {
            target: this.serializeCryptid(target),
            status: 'burn',
            turns
        });
    }
    
    applyStun(target) {
        target.stunned = true;
        target.extraTapTurns = 1;
        this.emitEvent(GameEventTypes.STATUS_APPLIED, {
            target: this.serializeCryptid(target),
            status: 'stun'
        });
    }
    
    applyParalyze(target) {
        target.paralyzed = true;
        target.paralyzeTurns = 1;
        this.emitEvent(GameEventTypes.STATUS_APPLIED, {
            target: this.serializeCryptid(target),
            status: 'paralyze'
        });
    }
    
    applyBleed(target, turns = 1) {
        target.bleedTurns = Math.max(target.bleedTurns, turns);
        this.emitEvent(GameEventTypes.STATUS_APPLIED, {
            target: this.serializeCryptid(target),
            status: 'bleed',
            turns
        });
    }
    
    applyCurse(target, stacks = 1) {
        target.curseTokens = (target.curseTokens || 0) + stacks;
        this.emitEvent(GameEventTypes.STATUS_APPLIED, {
            target: this.serializeCryptid(target),
            status: 'curse',
            stacks: target.curseTokens
        });
    }
    
    applyProtection(target, charges = 1) {
        target.protectionCharges = (target.protectionCharges || 0) + charges;
        target.blockFirstHit = true;
        target.damageReduction = 999;
        this.emitEvent(GameEventTypes.STATUS_APPLIED, {
            target: this.serializeCryptid(target),
            status: 'protection',
            charges: target.protectionCharges
        });
    }
    
    applyAura(target, auraCard) {
        if (!target.auras) target.auras = [];
        target.auras.push({ ...auraCard });
        
        // Apply aura effects
        if (auraCard.atkBonus) {
            target.currentAtk += auraCard.atkBonus;
        }
        if (auraCard.hpBonus) {
            target.currentHp += auraCard.hpBonus;
            target.maxHp += auraCard.hpBonus;
        }
    }
    
    hasStatusAilment(cryptid) {
        return cryptid.burnTurns > 0 || 
               cryptid.stunned || 
               cryptid.paralyzed || 
               cryptid.bleedTurns > 0 ||
               cryptid.curseTokens > 0;
    }
    
    processStatusEffects(owner) {
        const field = owner === 'player' ? this.state.playerField : this.state.enemyField;
        
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = field[c][r];
                if (!cryptid) continue;
                
                // Burn damage
                if (cryptid.burnTurns > 0) {
                    cryptid.currentHp -= 1;
                    cryptid.burnTurns--;
                    
                    this.emitEvent(GameEventTypes.STATUS_TICK, {
                        target: this.serializeCryptid(cryptid),
                        status: 'burn',
                        damage: 1,
                        turnsRemaining: cryptid.burnTurns
                    });
                    
                    if (this.getEffectiveHp(cryptid) <= 0) {
                        this.killCryptid(cryptid, null);
                    }
                }
            }
        }
    }
    
    untapCryptids(owner) {
        const field = owner === 'player' ? this.state.playerField : this.state.enemyField;
        
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = field[c][r];
                if (!cryptid) continue;
                
                cryptid.justSummoned = false;
                cryptid.evolvedThisTurn = false;
                cryptid.attackedThisTurn = false;
                
                if (cryptid.extraTapTurns > 0) {
                    cryptid.extraTapTurns--;
                } else if (cryptid.paralyzed) {
                    cryptid.paralyzeTurns--;
                    if (cryptid.paralyzeTurns <= 0) {
                        cryptid.paralyzed = false;
                        cryptid.paralyzeTurns = 0;
                    }
                } else {
                    cryptid.tapped = false;
                    cryptid.canAttack = true;
                }
            }
        }
    }
    
    processEndOfTurnEffects(owner) {
        // Process any end-of-turn effects here
    }
    
    // ==================== WIN CONDITION ====================
    
    checkGameOver() {
        // First to 10 kills wins
        if (this.state.playerDeaths >= 10) {
            this.endGame('enemy');
        } else if (this.state.enemyDeaths >= 10) {
            this.endGame('player');
        }
    }
    
    endGame(winner) {
        if (this.state.gameOver) return;
        
        this.state.gameOver = true;
        this.state.winner = winner;
        
        this.emitEvent(GameEventTypes.GAME_OVER, {
            winner,
            playerDeaths: this.state.playerDeaths,
            enemyDeaths: this.state.enemyDeaths,
            turnNumber: this.state.turnNumber,
            stats: this.state.matchStats
        });
    }
    
    // ==================== EVENT SYSTEM ====================
    
    emitEvent(type, data) {
        this.eventQueue.push({
            type,
            data,
            timestamp: Date.now()
        });
    }
    
    // ==================== SERIALIZATION ====================
    
    serializeCryptid(cryptid) {
        if (!cryptid) return null;
        
        // Return a clean copy without function references
        return {
            id: cryptid.id,
            key: cryptid.key,
            name: cryptid.name,
            owner: cryptid.owner,
            col: cryptid.col,
            row: cryptid.row,
            type: cryptid.type,
            cost: cryptid.cost,
            atk: cryptid.atk,
            hp: cryptid.hp,
            currentHp: cryptid.currentHp,
            maxHp: cryptid.maxHp,
            currentAtk: cryptid.currentAtk,
            baseAtk: cryptid.baseAtk,
            baseHp: cryptid.baseHp,
            tapped: cryptid.tapped,
            canAttack: cryptid.canAttack,
            justSummoned: cryptid.justSummoned,
            isKindling: cryptid.isKindling,
            evolutionChain: cryptid.evolutionChain,
            evolvedThisTurn: cryptid.evolvedThisTurn,
            burnTurns: cryptid.burnTurns,
            stunned: cryptid.stunned,
            paralyzed: cryptid.paralyzed,
            paralyzeTurns: cryptid.paralyzeTurns,
            bleedTurns: cryptid.bleedTurns,
            protectionCharges: cryptid.protectionCharges,
            curseTokens: cryptid.curseTokens,
            auras: cryptid.auras?.map(a => ({ key: a.key, name: a.name })) || [],
            // Card-specific flags that affect gameplay
            hasCleave: cryptid.hasCleave,
            hasFocus: cryptid.hasFocus,
            hasLifesteal: cryptid.hasLifesteal,
            bonusDamage: cryptid.bonusDamage,
            damageReduction: cryptid.damageReduction,
            regeneration: cryptid.regeneration,
            evolvesFrom: cryptid.evolvesFrom,
            series: cryptid.series,
            element: cryptid.element,
            rarity: cryptid.rarity
        };
    }
    
    serializeField(field) {
        return field.map(col => col.map(cryptid => this.serializeCryptid(cryptid)));
    }
    
    serializeHand(hand) {
        return hand.map(card => ({
            id: card.id,
            key: card.key,
            name: card.name,
            type: card.type,
            cost: card.cost,
            atk: card.atk,
            hp: card.hp,
            evolvesFrom: card.evolvesFrom,
            series: card.series,
            element: card.element,
            rarity: card.rarity,
            pyreValue: card.pyreValue,
            description: card.description
        }));
    }
    
    serializeKindling(kindling) {
        return kindling.map(k => ({
            id: k.id,
            key: k.key,
            name: k.name,
            atk: k.atk,
            hp: k.hp,
            series: k.series,
            element: k.element
        }));
    }
    
    // Get state for a specific player (hides opponent's hand)
    // Returns in CLIENT-EXPECTED format: playerField, enemyField, hand, etc.
    getStateForPlayer(playerId) {
        const isPlayer1 = playerId === this.state.player1Id;
        
        // From each player's perspective:
        // - "playerField" is THEIR field (what they control)
        // - "enemyField" is their OPPONENT's field
        // This matches how the client's Game object works
        
        const myField = isPlayer1 
            ? this.state.playerField 
            : this.state.enemyField;
        const theirField = isPlayer1 
            ? this.state.enemyField 
            : this.state.playerField;
        
        return {
            // Fields - from this player's perspective
            // "playerField" = this player's field
            // "enemyField" = opponent's field
            playerField: this.serializeField(myField),
            enemyField: this.serializeField(theirField),
            
            // Hand (only the requesting player's hand, opponent's is hidden)
            hand: isPlayer1 
                ? this.serializeHand(this.state.playerHand)
                : this.serializeHand(this.state.enemyHand),
            
            // Kindling
            kindling: isPlayer1
                ? this.serializeKindling(this.state.playerKindling)
                : this.serializeKindling(this.state.enemyKindling),
            
            // Resources
            playerPyre: isPlayer1 ? this.state.playerPyre : this.state.enemyPyre,
            enemyPyre: isPlayer1 ? this.state.enemyPyre : this.state.playerPyre,
            playerDeaths: isPlayer1 ? this.state.playerDeaths : this.state.enemyDeaths,
            enemyDeaths: isPlayer1 ? this.state.enemyDeaths : this.state.playerDeaths,
            
            // Per-turn flags
            kindlingPlayed: isPlayer1 
                ? this.state.playerKindlingPlayedThisTurn 
                : this.state.enemyKindlingPlayedThisTurn,
            pyreCardPlayed: isPlayer1
                ? this.state.playerPyreCardPlayedThisTurn
                : this.state.enemyPyreCardPlayedThisTurn,
            
            // Traps
            playerTraps: isPlayer1 
                ? this.state.playerTraps.map(t => t ? { key: t.key, name: t.name } : null)
                : this.state.enemyTraps.map(t => t ? { key: t.key, name: t.name } : null),
            enemyTraps: isPlayer1
                ? this.state.enemyTraps.map(t => t ? true : null) // Only show trap exists
                : this.state.playerTraps.map(t => t ? true : null),
            
            // Game state
            phase: this.state.phase,
            turnNumber: this.state.turnNumber,
            isMyTurn: (isPlayer1 && this.state.currentTurn === 'player') ||
                      (!isPlayer1 && this.state.currentTurn === 'enemy'),
            gameOver: this.state.gameOver,
            winner: this.state.winner,
            
            // Deck sizes
            deckSize: isPlayer1 ? this.state.playerDeck.length : this.state.enemyDeck.length,
            enemyDeckSize: isPlayer1 ? this.state.enemyDeck.length : this.state.playerDeck.length,
            enemyHandSize: isPlayer1 ? this.state.enemyHand.length : this.state.playerHand.length
        };
    }
    
    // Get full state (for server logging/debugging)
    getFullState() {
        return {
            playerField: this.serializeField(this.state.playerField),
            enemyField: this.serializeField(this.state.enemyField),
            playerHand: this.serializeHand(this.state.playerHand),
            enemyHand: this.serializeHand(this.state.enemyHand),
            playerPyre: this.state.playerPyre,
            enemyPyre: this.state.enemyPyre,
            playerDeaths: this.state.playerDeaths,
            enemyDeaths: this.state.enemyDeaths,
            currentTurn: this.state.currentTurn,
            phase: this.state.phase,
            turnNumber: this.state.turnNumber,
            gameOver: this.state.gameOver,
            winner: this.state.winner
        };
    }
}

