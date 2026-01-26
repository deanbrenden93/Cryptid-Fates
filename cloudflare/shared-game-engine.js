/**
 * Shared Game Engine - Clean Rewrite
 * 
 * ARCHITECTURE PRINCIPLE:
 * - Store state by PLAYER ID, not 'player'/'enemy'
 * - Each player's field uses THEIR convention: combat=col1, support=col0
 * - When referencing opponent's field, flip columns (enemy combat appears as col0)
 * - Server validates, processes, returns state - client handles display
 */

// ==================== ACTION TYPES ====================
const ActionTypes = {
    SUMMON: 'summon',
    SUMMON_KINDLING: 'summonKindling',
    ATTACK: 'attack',
    EVOLVE: 'evolve',
    PLAY_PYRE: 'playPyre',
    PLAY_BURST: 'playBurst',
    PLAY_AURA: 'playAura',
    SET_TRAP: 'setTrap',
    END_PHASE: 'endPhase',
    CONCEDE: 'concede'
};

const GameEventTypes = {
    SUMMON: 'onSummon',
    KINDLING_SUMMON: 'onKindlingSummon',
    ATTACK: 'onAttack',
    DAMAGE: 'onDamage',
    DEATH: 'onDeath',
    EVOLVE: 'onEvolve',
    PYRE_CHANGED: 'onPyreChanged',
    PHASE_CHANGE: 'onPhaseChange',
    TURN_START: 'onTurnStart',
    TURN_END: 'onTurnEnd',
    GAME_OVER: 'onGameOver'
};

// ==================== SHARED GAME ENGINE ====================
class SharedGameEngine {
    constructor() {
        this.state = null;
        this.eventQueue = [];
    }

    // ==================== INITIALIZATION ====================
    
    /**
     * Initialize a new match
     * @param {string} player1Id - First player's ID
     * @param {string} player2Id - Second player's ID  
     * @param {number} seed - Random seed
     * @param {string} firstPlayerId - Who goes first (from coin flip)
     */
    initMatch(player1Id, player2Id, seed = Date.now(), firstPlayerId = null) {
        console.log('[Engine] initMatch:', { player1Id, player2Id, seed, firstPlayerId });
        
        this.state = {
            // Player IDs
            player1Id,
            player2Id,
            
            // Fields - stored by player ID
            // Each uses consistent convention: col 0 = support, col 1 = combat
            fields: {
                [player1Id]: [[null, null, null], [null, null, null]],
                [player2Id]: [[null, null, null], [null, null, null]]
            },
            
            // Hands
            hands: {
                [player1Id]: [],
                [player2Id]: []
            },
            
            // Decks
            decks: {
                [player1Id]: [],
                [player2Id]: []
            },
            
            // Kindling pools
            kindling: {
                [player1Id]: [],
                [player2Id]: []
            },
            
            // Resources
            pyre: {
                [player1Id]: 0,
                [player2Id]: 0
            },
            
            // Death counts
            deaths: {
                [player1Id]: 0,
                [player2Id]: 0
            },
            
            // Traps (2 slots each)
            traps: {
                [player1Id]: [null, null],
                [player2Id]: [null, null]
            },
            
            // Per-turn flags
            kindlingPlayedThisTurn: {
                [player1Id]: false,
                [player2Id]: false
            },
            pyreCardPlayedThisTurn: {
                [player1Id]: false,
                [player2Id]: false
            },
            evolvedThisTurn: {},
            
            // Turn management
            currentTurn: firstPlayerId || player1Id,
            phase: 'conjure1',
            turnNumber: 1,
            
            // Game end
            gameOver: false,
            winner: null,
            
            // Stats
            matchStats: {
                cryptidsSummoned: 0,
                kindlingSummoned: 0,
                attacks: 0,
                evolutions: 0
            }
        };
        
        console.log('[Engine] Match initialized. First turn:', this.state.currentTurn);
        return this.state;
    }

    /**
     * Initialize a player's deck data (called when player joins)
     */
    initPlayerDeck(playerId, deckData) {
        if (!this.state) return;
        
        console.log('[Engine] initPlayerDeck:', { playerId, handSize: deckData.hand?.length, kindlingSize: deckData.kindling?.length });
        
        if (deckData.hand) {
            this.state.hands[playerId] = deckData.hand.map((card, i) => ({
                ...card,
                id: card.id || `${playerId}-hand-${i}-${Date.now()}`
            }));
        }
        
        if (deckData.kindling) {
            this.state.kindling[playerId] = deckData.kindling.map((card, i) => ({
                ...card,
                id: card.id || `${playerId}-kindling-${i}-${Date.now()}`
            }));
        }
        
        if (deckData.deck) {
            this.state.decks[playerId] = deckData.deck;
        }
    }

    // ==================== UTILITY FUNCTIONS ====================
    
    getOpponentId(playerId) {
        return playerId === this.state.player1Id ? this.state.player2Id : this.state.player1Id;
    }
    
    /**
     * Get cryptid from a player's field
     */
    getFieldCryptid(playerId, col, row) {
        return this.state.fields[playerId]?.[col]?.[row] || null;
    }
    
    /**
     * Set cryptid on a player's field
     */
    setFieldCryptid(playerId, col, row, cryptid) {
        if (!this.state.fields[playerId]) return;
        this.state.fields[playerId][col][row] = cryptid;
    }
    
    /**
     * Check if a player's field is empty
     */
    isFieldEmpty(playerId) {
        const field = this.state.fields[playerId];
        if (!field) return true;
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                if (field[col][row]) return false;
            }
        }
        return true;
    }
    
    /**
     * Get valid summon slots for a player
     * Priority: Combat first, then support behind existing combat
     */
    getValidSummonSlots(playerId) {
        const field = this.state.fields[playerId];
        const slots = [];
        
        // Combat column (col 1) slots
        for (let row = 0; row < 3; row++) {
            if (!field[1][row]) {
                slots.push({ col: 1, row });
            }
        }
        
        // Support column (col 0) - only if combat in same row is occupied
        for (let row = 0; row < 3; row++) {
            if (!field[0][row] && field[1][row]) {
                slots.push({ col: 0, row });
            }
        }
        
        return slots;
    }

    // ==================== ACTION PROCESSING ====================
    
    /**
     * Process an action from a player
     * @param {string} playerId - The acting player's ID
     * @param {object} action - The action to process
     */
    processAction(playerId, action) {
        console.log('[Engine] processAction:', { playerId, actionType: action?.type, currentTurn: this.state.currentTurn });
        
        // Validate game is active
        if (this.state.gameOver) {
            return { success: false, error: 'Game is over' };
        }
        
        // Validate it's this player's turn (except for concede)
        if (action.type !== ActionTypes.CONCEDE && this.state.currentTurn !== playerId) {
            console.log('[Engine] REJECTED - not your turn');
            return { success: false, error: `Not your turn (current: ${this.state.currentTurn}, you: ${playerId})` };
        }
        
        // Clear event queue
        this.eventQueue = [];
        
        let result;
        switch (action.type) {
            case ActionTypes.SUMMON:
                result = this.handleSummon(playerId, action);
                break;
            case ActionTypes.SUMMON_KINDLING:
                result = this.handleSummonKindling(playerId, action);
                break;
            case ActionTypes.ATTACK:
                result = this.handleAttack(playerId, action);
                break;
            case ActionTypes.EVOLVE:
                result = this.handleEvolve(playerId, action);
                break;
            case ActionTypes.PLAY_PYRE:
                result = this.handlePlayPyre(playerId, action);
                break;
            case ActionTypes.PLAY_BURST:
                result = this.handlePlayBurst(playerId, action);
                break;
            case ActionTypes.PLAY_AURA:
                result = this.handlePlayAura(playerId, action);
                break;
            case ActionTypes.SET_TRAP:
                result = this.handleSetTrap(playerId, action);
                break;
            case ActionTypes.END_PHASE:
                result = this.handleEndPhase(playerId);
                break;
            case ActionTypes.CONCEDE:
                result = this.handleConcede(playerId);
                break;
            default:
                result = { success: false, error: `Unknown action: ${action.type}` };
        }
        
        return {
            ...result,
            events: this.eventQueue,
            state: this.state
        };
    }

    // ==================== ACTION HANDLERS ====================
    
    handleSummon(playerId, action) {
        const { cardId, col, row } = action;
        const hand = this.state.hands[playerId];
        const pyre = this.state.pyre[playerId];
        
        console.log('[Engine] handleSummon:', { playerId, cardId, col, row, handSize: hand.length });
        
        // Validate phase
        if (this.state.phase !== 'conjure1' && this.state.phase !== 'conjure2') {
            return { success: false, error: `Wrong phase: ${this.state.phase}` };
        }
        
        // Find card in hand
        const cardIndex = hand.findIndex(c => c.id === cardId || c.id == cardId);
        if (cardIndex < 0) {
            return { success: false, error: `Card not in hand: ${cardId}` };
        }
        
        const card = hand[cardIndex];
        
        // Validate type
        if (card.type !== 'cryptid') {
            return { success: false, error: `Not a cryptid: ${card.type}` };
        }
        
        // Validate cost
        if (card.cost > pyre) {
            return { success: false, error: `Not enough pyre: need ${card.cost}, have ${pyre}` };
        }
        
        // Validate position
        if (this.getFieldCryptid(playerId, col, row)) {
            return { success: false, error: 'Position occupied' };
        }
        
        // Validate valid slot
        const validSlots = this.getValidSummonSlots(playerId);
        if (!validSlots.some(s => s.col === col && s.row === row)) {
            return { success: false, error: `Invalid position: col=${col}, row=${row}` };
        }
        
        // Perform summon
        hand.splice(cardIndex, 1);
        this.state.pyre[playerId] -= card.cost;
        
        const cryptid = this.createCryptid(playerId, col, row, card);
        this.setFieldCryptid(playerId, col, row, cryptid);
        
        this.state.matchStats.cryptidsSummoned++;
        
        this.emitEvent(GameEventTypes.SUMMON, {
            owner: playerId,
            cryptid,
            col,
            row
        });
        
        return { success: true, cryptid, action: { ...action, cryptid } };
    }
    
    handleSummonKindling(playerId, action) {
        const { kindlingId, col, row } = action;
        const kindlingPool = this.state.kindling[playerId];
        
        console.log('[Engine] handleSummonKindling:', { playerId, kindlingId, col, row, poolSize: kindlingPool.length });
        
        // Validate phase
        if (this.state.phase !== 'conjure1' && this.state.phase !== 'conjure2') {
            return { success: false, error: `Wrong phase: ${this.state.phase}` };
        }
        
        // Validate one per turn
        if (this.state.kindlingPlayedThisTurn[playerId]) {
            return { success: false, error: 'Already played kindling this turn' };
        }
        
        // Find kindling
        const kindlingIndex = kindlingPool.findIndex(k => k.id === kindlingId || k.id == kindlingId);
        if (kindlingIndex < 0) {
            return { success: false, error: `Kindling not found: ${kindlingId}` };
        }
        
        const kindlingCard = kindlingPool[kindlingIndex];
        
        // Validate position
        if (this.getFieldCryptid(playerId, col, row)) {
            return { success: false, error: 'Position occupied' };
        }
        
        // Perform summon
        kindlingPool.splice(kindlingIndex, 1);
        this.state.kindlingPlayedThisTurn[playerId] = true;
        
        const cryptid = this.createCryptid(playerId, col, row, kindlingCard, true);
        this.setFieldCryptid(playerId, col, row, cryptid);
        
        this.state.matchStats.kindlingSummoned++;
        
        this.emitEvent(GameEventTypes.KINDLING_SUMMON, {
            owner: playerId,
            cryptid,
            col,
            row
        });
        
        return { success: true, cryptid, action: { ...action, cryptid, kindlingCard } };
    }
    
    handleAttack(playerId, action) {
        const { attackerCol, attackerRow, targetCol, targetRow } = action;
        const opponentId = this.getOpponentId(playerId);
        
        console.log('[Engine] handleAttack:', { playerId, attackerCol, attackerRow, targetCol, targetRow });
        
        // Validate phase
        if (this.state.phase !== 'combat') {
            return { success: false, error: `Wrong phase: ${this.state.phase}` };
        }
        
        // Get attacker from player's field
        const attacker = this.getFieldCryptid(playerId, attackerCol, attackerRow);
        if (!attacker) {
            return { success: false, error: 'No attacker at position' };
        }
        
        // Validate attacker can attack
        if (attacker.tapped || attacker.attackedThisTurn) {
            return { success: false, error: 'Attacker cannot attack' };
        }
        
        // Attacker must be in combat position (col 1)
        if (attackerCol !== 1) {
            return { success: false, error: 'Only combat cryptids can attack' };
        }
        
        // IMPORTANT: Target position is from attacker's VIEW of enemy field
        // Client uses enemy conventions: combat=col0, support=col1
        // We need to flip to find it in opponent's storage (combat=col1)
        const actualTargetCol = targetCol === 0 ? 1 : 0;
        
        console.log('[Engine] Target col translation:', { clientCol: targetCol, storageCol: actualTargetCol });
        
        // Get target from opponent's field
        let target = this.getFieldCryptid(opponentId, actualTargetCol, targetRow);
        
        // If no target and field is empty, force a kindling summon
        if (!target && this.isFieldEmpty(opponentId)) {
            target = this.forceKindlingSummon(opponentId, actualTargetCol, targetRow);
            if (!target) {
                return { success: false, error: 'No valid target' };
            }
        }
        
        if (!target) {
            return { success: false, error: 'No target at position' };
        }
        
        // Mark attacker as having attacked
        attacker.attackedThisTurn = true;
        attacker.tapped = true;
        
        // Calculate and apply damage
        const damage = this.calculateDamage(attacker);
        const result = this.applyDamage(target, damage, attacker);
        
        this.state.matchStats.attacks++;
        
        this.emitEvent(GameEventTypes.ATTACK, {
            attacker,
            target,
            damage,
            result
        });
        
        // Check for win condition
        this.checkWinCondition();
        
        return { success: true, attackResult: result, action: { ...action, result } };
    }
    
    handleEvolve(playerId, action) {
        const { cardId, col, row } = action;
        const hand = this.state.hands[playerId];
        const pyre = this.state.pyre[playerId];
        
        console.log('[Engine] handleEvolve:', { playerId, cardId, col, row });
        
        // Validate phase
        if (this.state.phase !== 'conjure1' && this.state.phase !== 'conjure2') {
            return { success: false, error: `Wrong phase: ${this.state.phase}` };
        }
        
        // Find evolution card
        const cardIndex = hand.findIndex(c => c.id === cardId || c.id == cardId);
        if (cardIndex < 0) {
            return { success: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        
        // Validate it's an evolution
        if (!card.evolvesFrom) {
            return { success: false, error: 'Not an evolution card' };
        }
        
        // Validate cost
        if (card.cost > pyre) {
            return { success: false, error: `Not enough pyre: need ${card.cost}, have ${pyre}` };
        }
        
        // Get base cryptid
        const baseCryptid = this.getFieldCryptid(playerId, col, row);
        if (!baseCryptid) {
            return { success: false, error: 'No cryptid at position' };
        }
        
        // Validate base matches
        if (baseCryptid.key !== card.evolvesFrom) {
            return { success: false, error: `Wrong base: need ${card.evolvesFrom}, have ${baseCryptid.key}` };
        }
        
        // Check evolved this turn
        const posKey = `${playerId}-${col}-${row}`;
        if (this.state.evolvedThisTurn[posKey]) {
            return { success: false, error: 'Already evolved this position' };
        }
        
        // Perform evolution
        hand.splice(cardIndex, 1);
        this.state.pyre[playerId] -= card.cost;
        
        const evolved = this.evolveCryptid(baseCryptid, card);
        this.setFieldCryptid(playerId, col, row, evolved);
        this.state.evolvedThisTurn[posKey] = true;
        
        this.state.matchStats.evolutions++;
        
        this.emitEvent(GameEventTypes.EVOLVE, {
            owner: playerId,
            baseCryptid,
            evolved,
            col,
            row
        });
        
        return { success: true, evolved, action: { ...action, evolved, baseCryptid } };
    }
    
    handlePlayPyre(playerId, action) {
        const { cardId } = action;
        const hand = this.state.hands[playerId];
        
        console.log('[Engine] handlePlayPyre:', { playerId, cardId });
        
        // Validate one per turn
        if (this.state.pyreCardPlayedThisTurn[playerId]) {
            return { success: false, error: 'Already played pyre card' };
        }
        
        // Find card
        const cardIndex = hand.findIndex(c => c.id === cardId || c.id == cardId);
        if (cardIndex < 0) {
            return { success: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        
        // Validate type
        if (card.type !== 'pyre') {
            return { success: false, error: `Not a pyre card: ${card.type}` };
        }
        
        // Perform
        hand.splice(cardIndex, 1);
        this.state.pyreCardPlayedThisTurn[playerId] = true;
        const pyreGained = card.pyreValue || 1;
        this.state.pyre[playerId] += pyreGained;
        
        this.emitEvent(GameEventTypes.PYRE_CHANGED, {
            owner: playerId,
            change: pyreGained,
            newValue: this.state.pyre[playerId]
        });
        
        return { success: true, pyreGained, action: { ...action, card } };
    }
    
    handlePlayBurst(playerId, action) {
        const { cardId, targetCol, targetRow, targetOwner } = action;
        const hand = this.state.hands[playerId];
        const pyre = this.state.pyre[playerId];
        
        console.log('[Engine] handlePlayBurst:', { playerId, cardId, targetCol, targetRow, targetOwner });
        
        // Find card
        const cardIndex = hand.findIndex(c => c.id === cardId || c.id == cardId);
        if (cardIndex < 0) {
            return { success: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        
        // Validate type
        if (card.type !== 'burst') {
            return { success: false, error: `Not a burst card: ${card.type}` };
        }
        
        // Validate cost
        if (card.cost > pyre) {
            return { success: false, error: `Not enough pyre: need ${card.cost}, have ${pyre}` };
        }
        
        // Determine target owner (might be self or enemy)
        let actualTargetOwner = playerId;
        let actualTargetCol = targetCol;
        
        if (targetOwner === 'enemy') {
            actualTargetOwner = this.getOpponentId(playerId);
            // Flip column when targeting enemy
            actualTargetCol = targetCol === 0 ? 1 : 0;
        }
        
        // Get target if required
        let target = null;
        if (card.targetRequired !== false && targetCol !== undefined) {
            target = this.getFieldCryptid(actualTargetOwner, actualTargetCol, targetRow);
            if (!target) {
                return { success: false, error: 'No target for burst' };
            }
        }
        
        // Perform
        hand.splice(cardIndex, 1);
        this.state.pyre[playerId] -= card.cost;
        
        // Note: Actual burst effects would need card-specific handlers
        // For now, just record the action
        
        return { success: true, action: { ...action, card, target } };
    }
    
    handlePlayAura(playerId, action) {
        const { cardId, col, row } = action;
        const hand = this.state.hands[playerId];
        const pyre = this.state.pyre[playerId];
        
        console.log('[Engine] handlePlayAura:', { playerId, cardId, col, row });
        
        // Find card
        const cardIndex = hand.findIndex(c => c.id === cardId || c.id == cardId);
        if (cardIndex < 0) {
            return { success: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        
        // Validate type
        if (card.type !== 'aura') {
            return { success: false, error: `Not an aura card: ${card.type}` };
        }
        
        // Validate cost
        if (card.cost > pyre) {
            return { success: false, error: `Not enough pyre: need ${card.cost}, have ${pyre}` };
        }
        
        // Auras target friendly cryptids - no column flip needed
        const target = this.getFieldCryptid(playerId, col, row);
        if (!target) {
            return { success: false, error: 'No target for aura' };
        }
        
        // Perform
        hand.splice(cardIndex, 1);
        this.state.pyre[playerId] -= card.cost;
        
        // Attach aura
        if (!target.auras) target.auras = [];
        target.auras.push({ key: card.key, name: card.name });
        
        return { success: true, action: { ...action, card, target } };
    }
    
    handleSetTrap(playerId, action) {
        const { cardId, slot } = action;
        const hand = this.state.hands[playerId];
        const pyre = this.state.pyre[playerId];
        const traps = this.state.traps[playerId];
        
        console.log('[Engine] handleSetTrap:', { playerId, cardId, slot });
        
        // Find card
        const cardIndex = hand.findIndex(c => c.id === cardId || c.id == cardId);
        if (cardIndex < 0) {
            return { success: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        
        // Validate type
        if (card.type !== 'trap') {
            return { success: false, error: `Not a trap card: ${card.type}` };
        }
        
        // Validate cost
        if (card.cost > pyre) {
            return { success: false, error: `Not enough pyre: need ${card.cost}, have ${pyre}` };
        }
        
        // Validate slot
        if (slot < 0 || slot > 1 || traps[slot]) {
            return { success: false, error: `Trap slot not available: ${slot}` };
        }
        
        // Perform
        hand.splice(cardIndex, 1);
        this.state.pyre[playerId] -= card.cost;
        traps[slot] = { key: card.key, name: card.name, owner: playerId };
        
        return { success: true, action: { ...action, card, slot } };
    }
    
    handleEndPhase(playerId) {
        console.log('[Engine] handleEndPhase:', { playerId, currentPhase: this.state.phase });
        
        const previousPhase = this.state.phase;
        
        if (this.state.phase === 'conjure1') {
            this.state.phase = 'combat';
        } else if (this.state.phase === 'combat') {
            this.state.phase = 'conjure2';
        } else if (this.state.phase === 'conjure2') {
            // End turn
            this.endTurn();
        }
        
        console.log('[Engine] Phase changed:', { from: previousPhase, to: this.state.phase });
        
        this.emitEvent(GameEventTypes.PHASE_CHANGE, {
            previousPhase,
            newPhase: this.state.phase
        });
        
        return { success: true, newPhase: this.state.phase, action: { type: ActionTypes.END_PHASE } };
    }
    
    handleConcede(playerId) {
        const opponentId = this.getOpponentId(playerId);
        this.state.gameOver = true;
        this.state.winner = opponentId;
        
        this.emitEvent(GameEventTypes.GAME_OVER, {
            winner: opponentId,
            reason: 'concede'
        });
        
        return { success: true, winner: opponentId };
    }

    // ==================== GAME LOGIC ====================
    
    createCryptid(ownerId, col, row, cardData, isKindling = false) {
        return {
            id: `${ownerId}-${col}-${row}-${Date.now()}`,
            key: cardData.key,
            name: cardData.name,
            owner: ownerId,
            col,
            row,
            type: 'cryptid',
            cost: cardData.cost || 0,
            atk: cardData.atk || 0,
            hp: cardData.hp || 1,
            currentAtk: cardData.atk || 0,
            currentHp: cardData.hp || 1,
            maxHp: cardData.hp || 1,
            baseAtk: cardData.atk || 0,
            baseHp: cardData.hp || 1,
            tapped: false,
            attackedThisTurn: false,
            isKindling,
            evolutionChain: cardData.evolutionChain || [cardData.key],
            auras: [],
            series: cardData.series,
            element: cardData.element,
            rarity: cardData.rarity
        };
    }
    
    evolveCryptid(baseCryptid, evolutionCard) {
        const hpGain = baseCryptid.currentHp - baseCryptid.baseHp;
        
        return {
            ...baseCryptid,
            key: evolutionCard.key,
            name: evolutionCard.name,
            atk: evolutionCard.atk,
            hp: evolutionCard.hp,
            currentAtk: evolutionCard.atk,
            currentHp: evolutionCard.hp + Math.max(0, hpGain),
            maxHp: evolutionCard.hp,
            baseAtk: evolutionCard.atk,
            baseHp: evolutionCard.hp,
            evolutionChain: [...(baseCryptid.evolutionChain || []), evolutionCard.key],
            evolvedThisTurn: true,
            evolvesFrom: evolutionCard.evolvesFrom
        };
    }
    
    forceKindlingSummon(playerId, col, row) {
        const kindlingPool = this.state.kindling[playerId];
        if (!kindlingPool || kindlingPool.length === 0) return null;
        
        // Random kindling
        const index = Math.floor(Math.random() * kindlingPool.length);
        const kindlingCard = kindlingPool.splice(index, 1)[0];
        
        const cryptid = this.createCryptid(playerId, col, row, kindlingCard, true);
        this.setFieldCryptid(playerId, col, row, cryptid);
        
        this.emitEvent(GameEventTypes.KINDLING_SUMMON, {
            owner: playerId,
            cryptid,
            col,
            row,
            forced: true
        });
        
        return cryptid;
    }
    
    calculateDamage(attacker) {
        let damage = attacker.currentAtk - (attacker.atkDebuff || 0) - (attacker.curseTokens || 0);
        
        // Get support bonus if in combat
        if (attacker.col === 1) {
            const support = this.getFieldCryptid(attacker.owner, 0, attacker.row);
            if (support) {
                damage += support.currentAtk - (support.curseTokens || 0);
            }
        }
        
        return Math.max(0, damage);
    }
    
    applyDamage(target, damage, source) {
        const result = {
            damage,
            targetDied: false,
            supportDied: false
        };
        
        target.currentHp -= damage;
        
        this.emitEvent(GameEventTypes.DAMAGE, {
            target,
            damage,
            source,
            newHp: target.currentHp
        });
        
        if (target.currentHp <= 0) {
            this.killCryptid(target);
            result.targetDied = true;
        }
        
        return result;
    }
    
    killCryptid(cryptid) {
        const { owner, col, row } = cryptid;
        
        // Remove from field
        this.setFieldCryptid(owner, col, row, null);
        
        // Count deaths (evolution chain length)
        const deathCount = cryptid.evolutionChain?.length || 1;
        this.state.deaths[owner] += deathCount;
        
        this.emitEvent(GameEventTypes.DEATH, {
            cryptid,
            owner,
            col,
            row,
            deathCount
        });
        
        // If combat dies, promote support
        if (col === 1) {
            this.promoteSupport(owner, row);
        }
    }
    
    promoteSupport(playerId, row) {
        const support = this.getFieldCryptid(playerId, 0, row);
        if (!support) return null;
        
        // Move to combat
        this.setFieldCryptid(playerId, 0, row, null);
        support.col = 1;
        this.setFieldCryptid(playerId, 1, row, support);
        
        return support;
    }
    
    endTurn() {
        const currentPlayerId = this.state.currentTurn;
        const nextPlayerId = this.getOpponentId(currentPlayerId);
        
        // Reset turn flags
        this.state.kindlingPlayedThisTurn[currentPlayerId] = false;
        this.state.pyreCardPlayedThisTurn[currentPlayerId] = false;
        this.state.evolvedThisTurn = {};
        
        // Reset attack states for current player's cryptids
        for (const col of [0, 1]) {
            for (const row of [0, 1, 2]) {
                const cryptid = this.getFieldCryptid(currentPlayerId, col, row);
                if (cryptid) {
                    cryptid.attackedThisTurn = false;
                    cryptid.tapped = false;
                }
            }
        }
        
        // Switch turn
        this.state.currentTurn = nextPlayerId;
        this.state.phase = 'conjure1';
        this.state.turnNumber++;
        
        // Give pyre to new active player
        this.state.pyre[nextPlayerId]++;
        
        this.emitEvent(GameEventTypes.TURN_START, {
            player: nextPlayerId,
            turnNumber: this.state.turnNumber
        });
        
        this.emitEvent(GameEventTypes.PYRE_CHANGED, {
            owner: nextPlayerId,
            change: 1,
            newValue: this.state.pyre[nextPlayerId]
        });
    }
    
    checkWinCondition() {
        for (const playerId of [this.state.player1Id, this.state.player2Id]) {
            if (this.state.deaths[playerId] >= 10) {
                const winner = this.getOpponentId(playerId);
                this.state.gameOver = true;
                this.state.winner = winner;
                
                this.emitEvent(GameEventTypes.GAME_OVER, {
                    winner,
                    reason: 'deaths',
                    deaths: this.state.deaths
                });
            }
        }
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
            attackedThisTurn: cryptid.attackedThisTurn,
            isKindling: cryptid.isKindling,
            evolutionChain: cryptid.evolutionChain,
            auras: cryptid.auras || [],
            series: cryptid.series,
            element: cryptid.element,
            rarity: cryptid.rarity
        };
    }
    
    serializeField(field) {
        return field.map(col => col.map(cryptid => this.serializeCryptid(cryptid)));
    }
    
    /**
     * Serialize field with column flip for enemy view
     * When viewing opponent's field, their col1 (combat) appears as col0 to us
     */
    serializeFieldFlipped(field) {
        // Swap columns: [col0, col1] -> [col1, col0]
        const flipped = [
            field[1].map(cryptid => {
                if (!cryptid) return null;
                const s = this.serializeCryptid(cryptid);
                s.col = 0; // Was 1, now 0
                return s;
            }),
            field[0].map(cryptid => {
                if (!cryptid) return null;
                const s = this.serializeCryptid(cryptid);
                s.col = 1; // Was 0, now 1
                return s;
            })
        ];
        return flipped;
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
    
    /**
     * Get state formatted for a specific player
     * - playerField: Their field (no flip)
     * - enemyField: Opponent's field (flipped)
     */
    getStateForPlayer(playerId) {
        const opponentId = this.getOpponentId(playerId);
        
        const myField = this.state.fields[playerId];
        const theirField = this.state.fields[opponentId];
        
        console.log('[Engine] getStateForPlayer:', { playerId, opponentId, isMyTurn: this.state.currentTurn === playerId });
        
        return {
            // Fields
            // My field: no transformation
            // Enemy field: flip columns (their combat=col1 appears as col0 to me)
            playerField: this.serializeField(myField),
            enemyField: this.serializeFieldFlipped(theirField),
            
            // Hand & kindling
            hand: this.serializeHand(this.state.hands[playerId]),
            kindling: this.serializeKindling(this.state.kindling[playerId]),
            
            // Resources
            playerPyre: this.state.pyre[playerId],
            enemyPyre: this.state.pyre[opponentId],
            playerDeaths: this.state.deaths[playerId],
            enemyDeaths: this.state.deaths[opponentId],
            
            // Flags
            kindlingPlayed: this.state.kindlingPlayedThisTurn[playerId],
            pyreCardPlayed: this.state.pyreCardPlayedThisTurn[playerId],
            
            // Traps
            playerTraps: this.state.traps[playerId].map(t => t ? { key: t.key, name: t.name } : null),
            enemyTraps: this.state.traps[opponentId].map(t => t ? true : null),
            
            // Game state
            phase: this.state.phase,
            turnNumber: this.state.turnNumber,
            isMyTurn: this.state.currentTurn === playerId,
            gameOver: this.state.gameOver,
            winner: this.state.winner,
            
            // Deck info
            deckSize: this.state.decks[playerId]?.length || 0,
            enemyDeckSize: this.state.decks[opponentId]?.length || 0,
            enemyHandSize: this.state.hands[opponentId]?.length || 0
        };
    }
}

// Export for Cloudflare Worker
export { SharedGameEngine, ActionTypes, GameEventTypes };
