/**
 * Cryptid Fates - Shared Game Engine (ES Module for Cloudflare Workers)
 * 
 * This is the SINGLE SOURCE OF TRUTH for game logic.
 * Used by BOTH the server (Cloudflare Worker) and client.
 * 
 * Key principles:
 * 1. All operations are synchronous
 * 2. All state changes emit events
 * 3. Events drive animations (on client)
 * 4. RNG is deterministic (seeded)
 * 5. NO DOM, NO WINDOW, NO SETTIMEOUT
 */

// ==================== SEEDED RNG ====================
export class SeededRNG {
    constructor(seed = Date.now()) {
        this.seed = seed;
        this.state = seed;
    }
    
    // Simple mulberry32 PRNG
    next() {
        let t = this.state += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    
    int(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
    
    pick(array) {
        if (!array || array.length === 0) return null;
        return array[this.int(0, array.length - 1)];
    }
    
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = this.int(0, i);
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    
    getState() { return this.state; }
    setState(state) { this.state = state; }
}

// ==================== GAME EVENT TYPES ====================
export const GameEventTypes = {
    // Match lifecycle
    MATCH_START: 'matchStart',
    MATCH_END: 'matchEnd',
    TURN_START: 'turnStart',
    TURN_END: 'turnEnd',
    PHASE_CHANGE: 'phaseChange',
    
    // Cards
    CARD_DRAWN: 'cardDrawn',
    CARD_PLAYED: 'cardPlayed',
    CARD_DISCARDED: 'cardDiscarded',
    CARD_BURNED: 'cardBurned',
    
    // Field actions
    CRYPTID_SUMMONED: 'cryptidSummoned',
    CRYPTID_EVOLVED: 'cryptidEvolved',
    CRYPTID_PROMOTED: 'cryptidPromoted',
    CRYPTID_DIED: 'cryptidDied',
    
    // Combat
    ATTACK_DECLARED: 'attackDeclared',
    DAMAGE_DEALT: 'damageDealt',
    HEALING_DONE: 'healingDone',
    
    // Status effects
    STATUS_APPLIED: 'statusApplied',
    STATUS_TICKED: 'statusTicked',
    STATUS_REMOVED: 'statusRemoved',
    
    // Stats
    STAT_CHANGED: 'statChanged',
    PYRE_CHANGED: 'pyreChanged',
    
    // Spells
    BURST_CAST: 'burstCast',
    TRAP_SET: 'trapSet',
    TRAP_TRIGGERED: 'trapTriggered',
    TRAP_DESTROYED: 'trapDestroyed',
    AURA_APPLIED: 'auraApplied',
    AURA_REMOVED: 'auraRemoved',
    
    // Abilities
    ABILITY_TRIGGERED: 'abilityTriggered',
    
    // UI hints
    MESSAGE: 'message',
};

// ==================== ACTION TYPES ====================
export const ActionTypes = {
    END_PHASE: 'endPhase',
    SUMMON_CRYPTID: 'summon',
    SUMMON_KINDLING: 'summonKindling',
    PLAY_BURST: 'playBurst',
    PLAY_TRAP: 'playTrap',
    PLAY_AURA: 'playAura',
    PLAY_PYRE: 'playPyre',
    EVOLVE: 'evolve',
    ATTACK: 'attack',
    BURN_FOR_PYRE: 'burnForPyre',
    ACTIVATE_ABILITY: 'activateAbility',
    SELECT_TARGET: 'selectTarget',
    SELECT_OPTION: 'selectOption',
};

// ==================== GAME STATE CLASS ====================
export class GameState {
    constructor() {
        // Fields: [col][row] - Server uses col 0=combat for player, col 1=combat for enemy
        this.playerField = [[null, null, null], [null, null, null]];
        this.enemyField = [[null, null, null], [null, null, null]];
        
        // Hands
        this.playerHand = [];
        this.enemyHand = [];
        
        // Kindling pools
        this.playerKindling = [];
        this.enemyKindling = [];
        
        // Resources
        this.playerPyre = 0;
        this.enemyPyre = 0;
        
        // Turn tracking
        this.currentTurn = 'player';
        this.phase = 'conjure1';
        this.turnNumber = 1;
        
        // Traps
        this.playerTraps = [null, null, null];
        this.enemyTraps = [null, null, null];
        
        // Decks
        this.playerDeck = [];
        this.enemyDeck = [];
        
        // Discard/Burn piles
        this.playerBurnPile = [];
        this.playerDiscardPile = [];
        this.enemyBurnPile = [];
        this.enemyDiscardPile = [];
        
        // Per-turn flags
        this.playerKindlingPlayedThisTurn = false;
        this.enemyKindlingPlayedThisTurn = false;
        this.playerPyreCardPlayedThisTurn = false;
        this.enemyPyreCardPlayedThisTurn = false;
        this.playerPyreBurnUsed = false;
        this.enemyPyreBurnUsed = false;
        
        // Death tracking
        this.playerDeaths = 0;
        this.enemyDeaths = 0;
        
        // Toxic tiles
        this.playerToxicTiles = [[0, 0, 0], [0, 0, 0]];
        this.enemyToxicTiles = [[0, 0, 0], [0, 0, 0]];
        
        // Game end
        this.gameOver = false;
        this.winner = null;
        
        // ID counters
        this.nextCryptidId = 1;
        this.nextCardId = 1;
    }
    
    getField(owner) {
        return owner === 'player' ? this.playerField : this.enemyField;
    }
    
    getCryptid(owner, col, row) {
        return this.getField(owner)[col]?.[row] || null;
    }
    
    setCryptid(owner, col, row, cryptid) {
        this.getField(owner)[col][row] = cryptid;
        if (cryptid) {
            cryptid.owner = owner;
            cryptid.col = col;
            cryptid.row = row;
        }
    }
    
    // Combat column conventions (server-side):
    // Player: col 0 = combat, col 1 = support
    // Enemy: col 1 = combat, col 0 = support
    getCombatCol(owner) {
        return owner === 'player' ? 0 : 1;
    }
    
    getSupportCol(owner) {
        return owner === 'player' ? 1 : 0;
    }
    
    isSlotEmpty(owner, col, row) {
        return !this.getCryptid(owner, col, row);
    }
    
    getAllCryptids(owner) {
        const cryptids = [];
        const field = this.getField(owner);
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                if (field[col][row]) {
                    cryptids.push(field[col][row]);
                }
            }
        }
        return cryptids;
    }
    
    getOpponent(owner) {
        return owner === 'player' ? 'enemy' : 'player';
    }
}

// ==================== SHARED GAME ENGINE ====================
export class SharedGameEngine {
    constructor(cardRegistry = null) {
        this.cardRegistry = cardRegistry;
        this.state = new GameState();
        this.rng = new SeededRNG();
        this.events = [];
        this.animationSequence = [];
        this.pendingEffects = [];
        this.pendingPromotions = [];
    }
    
    // ==================== INITIALIZATION ====================
    
    initMatch(config) {
        const { player1Deck, player2Deck, player1Kindling, player2Kindling, seed, firstPlayer } = config;
        
        this.state = new GameState();
        this.rng = new SeededRNG(seed || Date.now());
        this.events = [];
        this.animationSequence = [];
        
        // Set up decks (already processed by client)
        this.state.playerDeck = player1Deck || [];
        this.state.enemyDeck = player2Deck || [];
        this.state.playerKindling = player1Kindling || [];
        this.state.enemyKindling = player2Kindling || [];
        
        // First player
        this.state.currentTurn = firstPlayer || (this.rng.next() < 0.5 ? 'player' : 'enemy');
        this.state.phase = 'conjure1';
        this.state.turnNumber = 1;
        
        // Starting pyre (player who goes first gets 1, other gets 2)
        if (this.state.currentTurn === 'player') {
            this.state.playerPyre = 1;
            this.state.enemyPyre = 2;
        } else {
            this.state.playerPyre = 2;
            this.state.enemyPyre = 1;
        }
        
        this.emit(GameEventTypes.MATCH_START, {
            firstPlayer: this.state.currentTurn,
            seed: this.rng.seed
        });
        
        return { valid: true, state: this.state };
    }
    
    initializeDecksFromClient(playerId, deckData, isPlayer1) {
        // Client sends their deck data; server trusts it
        if (isPlayer1) {
            if (deckData.mainDeck) this.state.playerDeck = deckData.mainDeck;
            if (deckData.kindling) this.state.playerKindling = deckData.kindling;
            if (deckData.hand) this.state.playerHand = deckData.hand;
            this.state.playerDeckInitialized = true;
        } else {
            if (deckData.mainDeck) this.state.enemyDeck = deckData.mainDeck;
            if (deckData.kindling) this.state.enemyKindling = deckData.kindling;
            if (deckData.hand) this.state.enemyHand = deckData.hand;
            this.state.enemyDeckInitialized = true;
        }
    }
    
    // ==================== COLUMN NORMALIZATION ====================
    
    /**
     * Normalize column from client perspective to server perspective.
     * 
     * Client always sees themselves as 'player' with:
     *   - combat col = 1 (right side), support col = 0 (left side)
     * Client sends cols after transformation: serverCol = 1 - clientCol
     * So client sends col 0 for their combat position.
     * 
     * Server has different conventions:
     *   - 'player': combat = col 0, support = col 1
     *   - 'enemy': combat = col 1, support = col 0
     * 
     * For 'player' owner: received col 0 (client combat) = server col 0 ✓
     * For 'enemy' owner: received col 0 (client combat) should = server col 1
     * 
     * Solution: flip column for 'enemy' owner
     */
    normalizeClientCol(col, owner) {
        if (col === undefined || col === null) return col;
        return owner === 'enemy' ? 1 - col : col;
    }
    
    // ==================== ACTION PROCESSING ====================
    
    processAction(owner, action) {
        this.events = [];
        this.animationSequence = [];
        this.pendingPromotions = [];
        
        let result;
        
        switch (action.type) {
            case 'endPhase':
                result = this.handleEndPhase(owner);
                break;
            case 'summon':
                result = this.handleSummon(owner, action);
                break;
            case 'summonKindling':
                result = this.handleSummonKindling(owner, action);
                break;
            case 'attack':
                result = this.handleAttack(owner, action);
                break;
            case 'evolve':
                result = this.handleEvolve(owner, action);
                break;
            case 'playBurst':
                result = this.handlePlayBurst(owner, action);
                break;
            case 'playTrap':
                result = this.handlePlayTrap(owner, action);
                break;
            case 'playAura':
                result = this.handlePlayAura(owner, action);
                break;
            case 'playPyre':
                result = this.handlePlayPyre(owner, action);
                break;
            case 'burnForPyre':
                result = this.handleBurnForPyre(owner, action);
                break;
            case 'activateAbility':
                result = this.handleActivateAbility(owner, action);
                break;
            default:
                return { valid: false, error: 'Unknown action type: ' + action.type };
        }
        
        if (!result.valid) {
            return result;
        }
        
        // Process pending promotions
        this.processPendingPromotions();
        
        // Check game end
        this.checkGameEnd();
        
        return {
            valid: true,
            events: this.events,
            animationSequence: this.animationSequence,
            state: this.state
        };
    }
    
    // ==================== ACTION HANDLERS ====================
    
    handleEndPhase(owner) {
        const phases = ['conjure1', 'combat', 'conjure2'];
        const currentIndex = phases.indexOf(this.state.phase);
        
        if (currentIndex === phases.length - 1) {
            this.endTurn(owner);
        } else {
            this.state.phase = phases[currentIndex + 1];
            this.emit(GameEventTypes.PHASE_CHANGE, { owner, phase: this.state.phase });
            this.addAnimation('phaseChange', { owner, phase: this.state.phase });
        }
        
        return { valid: true };
    }
    
    handleSummon(owner, action) {
        const { cardId, row } = action;
        const col = this.normalizeClientCol(action.col, owner);
        
        // Validate phase
        if (this.state.phase !== 'conjure1' && this.state.phase !== 'conjure2') {
            return { valid: false, error: 'Can only summon during conjure phase' };
        }
        
        // Get hand
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return { valid: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        
        // Validate pyre cost
        const pyre = owner === 'player' ? this.state.playerPyre : this.state.enemyPyre;
        if (pyre < card.cost) {
            return { valid: false, error: 'Not enough pyre' };
        }
        
        // Validate slot is empty
        const field = owner === 'player' ? this.state.playerField : this.state.enemyField;
        if (field[col][row]) {
            return { valid: false, error: 'Slot is occupied' };
        }
        
        // Execute summon
        hand.splice(cardIndex, 1);
        
        // Deduct pyre
        if (owner === 'player') {
            this.state.playerPyre -= card.cost;
        } else {
            this.state.enemyPyre -= card.cost;
        }
        
        // Create cryptid
        const cryptid = this.createCryptid(card, owner, col, row);
        field[col][row] = cryptid;
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner,
            amount: -card.cost,
            newValue: owner === 'player' ? this.state.playerPyre : this.state.enemyPyre
        });
        
        this.emit(GameEventTypes.CRYPTID_SUMMONED, {
            owner, col, row,
            cryptid: this.serializeCryptid(cryptid),
            fromKindling: false
        });
        
        this.addAnimation('summon', {
            owner, col, row,
            key: cryptid.key,
            name: cryptid.name,
            element: cryptid.element,
            rarity: cryptid.rarity
        });
        
        // Trigger abilities
        this.triggerAbility(cryptid, 'onSummon', { owner, col, row });
        
        const combatCol = this.state.getCombatCol(owner);
        const supportCol = this.state.getSupportCol(owner);
        
        if (col === combatCol) {
            this.triggerAbility(cryptid, 'onEnterCombat', { owner, col, row });
            this.triggerAbility(cryptid, 'onCombat', { owner, col, row });
        } else if (col === supportCol) {
            this.triggerAbility(cryptid, 'onSupport', { owner, col, row });
        }
        
        return { valid: true };
    }
    
    handleSummonKindling(owner, action) {
        const { kindlingId, row } = action;
        const col = this.normalizeClientCol(action.col, owner);
        
        // Validate phase
        if (this.state.phase !== 'conjure1' && this.state.phase !== 'conjure2') {
            return { valid: false, error: 'Can only summon during conjure phase' };
        }
        
        // Check if already played kindling this turn
        const playedFlag = owner === 'player' ? 
            this.state.playerKindlingPlayedThisTurn : 
            this.state.enemyKindlingPlayedThisTurn;
        
        if (playedFlag) {
            return { valid: false, error: 'Already played kindling this turn' };
        }
        
        // Find kindling
        const pool = owner === 'player' ? this.state.playerKindling : this.state.enemyKindling;
        
        // DEBUG: Log kindling pool data
        console.log('[SharedEngine] Kindling pool for', owner, '- length:', pool.length);
        console.log('[SharedEngine] Pool contents:', JSON.stringify(pool.map(k => ({ id: k.id, key: k.key, name: k.name }))));
        console.log('[SharedEngine] Looking for kindlingId:', kindlingId, 'type:', typeof kindlingId);
        
        // Use loose comparison to handle string/number type mismatches
        const kindlingIndex = pool.findIndex(k => 
            k.id == kindlingId || k.key === kindlingId || String(k.id) === String(kindlingId)
        );
        
        if (kindlingIndex === -1) {
            console.log('[SharedEngine] Kindling not found! Pool IDs:', pool.map(k => k.id));
            return { valid: false, error: 'Kindling not found in pool of ' + pool.length + ' cards' };
        }
        
        const kindling = pool[kindlingIndex];
        console.log('[SharedEngine] Found kindling at index', kindlingIndex, ':', { id: kindling.id, key: kindling.key, name: kindling.name });
        
        // Validate slot is empty
        const field = owner === 'player' ? this.state.playerField : this.state.enemyField;
        if (field[col][row]) {
            return { valid: false, error: 'Slot is occupied' };
        }
        
        // Execute summon
        pool.splice(kindlingIndex, 1);
        
        // Set flag
        if (owner === 'player') {
            this.state.playerKindlingPlayedThisTurn = true;
        } else {
            this.state.enemyKindlingPlayedThisTurn = true;
        }
        
        // Create cryptid from kindling
        console.log('[SharedEngine] Creating cryptid from kindling:', { key: kindling.key, name: kindling.name });
        const cryptid = this.createCryptid({ ...kindling, isKindling: true }, owner, col, row);
        console.log('[SharedEngine] Created cryptid:', { id: cryptid.id, key: cryptid.key, name: cryptid.name });
        field[col][row] = cryptid;
        
        this.emit(GameEventTypes.CRYPTID_SUMMONED, {
            owner, col, row,
            cryptid: this.serializeCryptid(cryptid),
            fromKindling: true
        });
        
        this.addAnimation('summon', {
            owner, col, row,
            key: cryptid.key,
            name: cryptid.name,
            element: cryptid.element,
            rarity: cryptid.rarity,
            isKindling: true
        });
        
        // Trigger abilities
        this.triggerAbility(cryptid, 'onSummon', { owner, col, row });
        
        const combatCol = this.state.getCombatCol(owner);
        if (col === combatCol) {
            this.triggerAbility(cryptid, 'onEnterCombat', { owner, col, row });
        }
        
        return { valid: true };
    }
    
    handleAttack(owner, action) {
        const { attackerRow, targetRow } = action;
        const attackerCol = this.normalizeClientCol(action.attackerCol, owner);
        const opponentOwner = this.state.getOpponent(owner);
        
        // Validate combat phase
        if (this.state.phase !== 'combat') {
            return { valid: false, error: 'Can only attack during combat phase' };
        }
        
        // Get attacker
        const attackerField = owner === 'player' ? this.state.playerField : this.state.enemyField;
        const attacker = attackerField[attackerCol]?.[attackerRow];
        
        if (!attacker) {
            return { valid: false, error: 'No attacker at position' };
        }
        
        // Validate attacker can attack
        if (attacker.tapped || attacker.attackedThisTurn) {
            return { valid: false, error: 'Attacker cannot attack' };
        }
        
        // NOTE: No summoning sickness - cryptids can attack immediately after being summoned
        
        if (attacker.paralyzed) {
            return { valid: false, error: 'Attacker is paralyzed' };
        }
        
        // Validate attacker is in combat position
        if (attackerCol !== this.state.getCombatCol(owner)) {
            return { valid: false, error: 'Attacker must be in combat position' };
        }
        
        // Get target
        const targetField = owner === 'player' ? this.state.enemyField : this.state.playerField;
        const targetCombatCol = this.state.getCombatCol(opponentOwner);
        const target = targetField[targetCombatCol]?.[targetRow];
        
        // Execute attack
        attacker.attackedThisTurn = true;
        attacker.tapped = true;
        
        const damage = this.calculateAttackDamage(attacker, owner);
        
        this.emit(GameEventTypes.ATTACK_DECLARED, {
            attackerOwner: owner,
            attackerCol, attackerRow,
            attackerKey: attacker.key,
            targetOwner: opponentOwner,
            targetRow,
            target: target ? this.serializeCryptid(target) : null,
            damage
        });
        
        this.addAnimation('attackMove', {
            attackerOwner: owner,
            attackerCol, attackerRow,
            targetOwner: opponentOwner,
            targetCol: targetCombatCol,
            targetRow,
            attackerKey: attacker.key,
            attackerName: attacker.name
        });
        
        // Trigger onAttack ability
        this.triggerAbility(attacker, 'onAttack', { target, damage });
        
        if (target) {
            // Deal damage to target
            this.dealDamage(target, damage, attacker, 'attack');
            
            // Trigger onHit
            if (!target.isDead) {
                this.triggerAbility(attacker, 'onHit', { target, damage });
            }
        } else {
            // Direct attack - deal damage to pyre or force kindling summon
            // (Implementation depends on game rules)
        }
        
        return { valid: true };
    }
    
    handleEvolve(owner, action) {
        const { cardId, targetRow } = action;
        const targetCol = this.normalizeClientCol(action.targetCol, owner);
        
        // Validate phase
        if (this.state.phase !== 'conjure1' && this.state.phase !== 'conjure2') {
            return { valid: false, error: 'Can only evolve during conjure phase' };
        }
        
        // Find evolution card in hand
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return { valid: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        
        if (!card.evolvesFrom) {
            return { valid: false, error: 'Card cannot evolve' };
        }
        
        // Find target cryptid
        const field = owner === 'player' ? this.state.playerField : this.state.enemyField;
        const target = field[targetCol]?.[targetRow];
        
        if (!target) {
            return { valid: false, error: 'No cryptid at target position' };
        }
        
        // Check evolution chain
        if (target.key !== card.evolvesFrom && !target.evolutionChain?.includes(card.evolvesFrom)) {
            return { valid: false, error: 'Base cryptid does not match evolution requirement' };
        }
        
        // Validate pyre cost
        const pyre = owner === 'player' ? this.state.playerPyre : this.state.enemyPyre;
        if (pyre < card.cost) {
            return { valid: false, error: 'Not enough pyre' };
        }
        
        // Execute evolution
        hand.splice(cardIndex, 1);
        
        if (owner === 'player') {
            this.state.playerPyre -= card.cost;
        } else {
            this.state.enemyPyre -= card.cost;
        }
        
        // Store old values for animation
        const oldKey = target.key;
        const oldName = target.name;
        
        // Transform cryptid - preserve current HP ratio
        const hpRatio = target.currentHp / target.maxHp;
        const newMaxHp = card.hp;
        
        target.key = card.key;
        target.name = card.name;
        target.baseAtk = card.atk;
        target.baseHp = card.hp;
        target.currentAtk = card.atk;
        target.maxHp = newMaxHp;
        target.currentHp = Math.ceil(newMaxHp * hpRatio);
        target.evolutionChain = target.evolutionChain || [];
        target.evolutionChain.push(card.key);
        target.evolvedThisTurn = true;
        
        // Copy new abilities
        if (card.onSummon) target.onSummon = card.onSummon;
        if (card.onCombat) target.onCombat = card.onCombat;
        if (card.onSupport) target.onSupport = card.onSupport;
        if (card.onAttack) target.onAttack = card.onAttack;
        if (card.onKill) target.onKill = card.onKill;
        if (card.onDeath) target.onDeath = card.onDeath;
        if (card.hasDestroyer) target.hasDestroyer = true;
        if (card.hasFlight) target.hasFlight = true;
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner,
            amount: -card.cost,
            newValue: owner === 'player' ? this.state.playerPyre : this.state.enemyPyre
        });
        
        this.emit(GameEventTypes.CRYPTID_EVOLVED, {
            owner,
            col: targetCol,
            row: targetRow,
            fromKey: oldKey,
            fromName: oldName,
            toKey: card.key,
            toName: card.name,
            cryptid: this.serializeCryptid(target)
        });
        
        this.addAnimation('evolve', {
            owner,
            col: targetCol,
            row: targetRow,
            fromKey: oldKey,
            toKey: card.key,
            toName: card.name
        });
        
        // Trigger onEvolve ability
        this.triggerAbility(target, 'onEvolve', { fromKey: oldKey });
        
        return { valid: true };
    }
    
    handlePlayBurst(owner, action) {
        const { cardId, targetOwner, targetRow } = action;
        const targetCol = action.targetCol !== undefined ? 
            this.normalizeClientCol(action.targetCol, targetOwner || this.state.getOpponent(owner)) : undefined;
        
        // Find card in hand
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return { valid: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        
        if (card.type !== 'burst') {
            return { valid: false, error: 'Card is not a burst spell' };
        }
        
        // Validate pyre cost
        const pyre = owner === 'player' ? this.state.playerPyre : this.state.enemyPyre;
        if (pyre < card.cost) {
            return { valid: false, error: 'Not enough pyre' };
        }
        
        // Execute
        hand.splice(cardIndex, 1);
        
        if (owner === 'player') {
            this.state.playerPyre -= card.cost;
            this.state.playerDiscardPile.push(card);
        } else {
            this.state.enemyPyre -= card.cost;
            this.state.enemyDiscardPile.push(card);
        }
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner,
            amount: -card.cost,
            newValue: owner === 'player' ? this.state.playerPyre : this.state.enemyPyre
        });
        
        this.emit(GameEventTypes.BURST_CAST, {
            owner, card: this.serializeCard(card),
            targetOwner, targetCol, targetRow
        });
        
        this.addAnimation('burst', {
            owner, cardKey: card.key, cardName: card.name,
            targetOwner, targetCol, targetRow
        });
        
        // Execute burst effect (handled by ability system)
        if (card.effect && typeof card.effect === 'function') {
            const target = targetOwner && targetCol !== undefined && targetRow !== undefined ?
                this.state.getCryptid(targetOwner, targetCol, targetRow) : null;
            card.effect(owner, target, this);
        }
        
        return { valid: true };
    }
    
    handlePlayTrap(owner, action) {
        const { cardId, row } = action;
        
        // Find card
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return { valid: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        
        if (card.type !== 'trap') {
            return { valid: false, error: 'Card is not a trap' };
        }
        
        // Validate trap slot
        const traps = owner === 'player' ? this.state.playerTraps : this.state.enemyTraps;
        if (traps[row]) {
            return { valid: false, error: 'Trap slot is occupied' };
        }
        
        // Validate pyre
        const pyre = owner === 'player' ? this.state.playerPyre : this.state.enemyPyre;
        if (pyre < card.cost) {
            return { valid: false, error: 'Not enough pyre' };
        }
        
        // Execute
        hand.splice(cardIndex, 1);
        
        if (owner === 'player') {
            this.state.playerPyre -= card.cost;
            this.state.playerTraps[row] = { ...card, faceDown: true, row };
        } else {
            this.state.enemyPyre -= card.cost;
            this.state.enemyTraps[row] = { ...card, faceDown: true, row };
        }
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner,
            amount: -card.cost,
            newValue: owner === 'player' ? this.state.playerPyre : this.state.enemyPyre
        });
        
        this.emit(GameEventTypes.TRAP_SET, { owner, row });
        
        this.addAnimation('trapSet', { owner, row });
        
        return { valid: true };
    }
    
    handlePlayAura(owner, action) {
        const { cardId, targetRow } = action;
        const targetCol = this.normalizeClientCol(action.targetCol, owner);
        
        // Find card
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return { valid: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        
        if (card.type !== 'aura') {
            return { valid: false, error: 'Card is not an aura' };
        }
        
        // Validate pyre
        const pyre = owner === 'player' ? this.state.playerPyre : this.state.enemyPyre;
        if (pyre < card.cost) {
            return { valid: false, error: 'Not enough pyre' };
        }
        
        // Find target
        const target = this.state.getCryptid(owner, targetCol, targetRow);
        if (!target) {
            return { valid: false, error: 'No cryptid at target position' };
        }
        
        // Execute
        hand.splice(cardIndex, 1);
        
        if (owner === 'player') {
            this.state.playerPyre -= card.cost;
        } else {
            this.state.enemyPyre -= card.cost;
        }
        
        // Attach aura to target
        target.auras = target.auras || [];
        target.auras.push({ ...card });
        
        // Apply aura effect
        if (card.onAttach && typeof card.onAttach === 'function') {
            card.onAttach(target, owner, this);
        }
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner,
            amount: -card.cost,
            newValue: owner === 'player' ? this.state.playerPyre : this.state.enemyPyre
        });
        
        this.emit(GameEventTypes.AURA_APPLIED, {
            owner, card: this.serializeCard(card),
            targetCol, targetRow
        });
        
        this.addAnimation('aura', {
            owner, cardKey: card.key, cardName: card.name,
            targetCol, targetRow
        });
        
        return { valid: true };
    }
    
    handlePlayPyre(owner, action) {
        const { cardId } = action;
        
        // Check if already played pyre this turn
        const playedFlag = owner === 'player' ? 
            this.state.playerPyreCardPlayedThisTurn : 
            this.state.enemyPyreCardPlayedThisTurn;
        
        if (playedFlag) {
            return { valid: false, error: 'Already played pyre card this turn' };
        }
        
        // Find card
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return { valid: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        
        if (card.type !== 'pyre') {
            return { valid: false, error: 'Card is not a pyre card' };
        }
        
        // Execute
        hand.splice(cardIndex, 1);
        
        if (owner === 'player') {
            this.state.playerPyreCardPlayedThisTurn = true;
            this.state.playerDiscardPile.push(card);
        } else {
            this.state.enemyPyreCardPlayedThisTurn = true;
            this.state.enemyDiscardPile.push(card);
        }
        
        // Execute pyre effect
        let pyreGained = card.pyreGain || 2;
        if (card.effect && typeof card.effect === 'function') {
            const result = card.effect(owner, this);
            if (result?.pyreGained) pyreGained = result.pyreGained;
        }
        
        if (owner === 'player') {
            this.state.playerPyre += pyreGained;
        } else {
            this.state.enemyPyre += pyreGained;
        }
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner,
            amount: pyreGained,
            newValue: owner === 'player' ? this.state.playerPyre : this.state.enemyPyre,
            source: 'pyreCard',
            cardKey: card.key
        });
        
        this.addAnimation('pyreCard', {
            owner, cardKey: card.key, cardName: card.name,
            amount: pyreGained
        });
        
        return { valid: true };
    }
    
    handleBurnForPyre(owner, action) {
        const { cardId } = action;
        
        // Check if already burned this turn
        const usedFlag = owner === 'player' ? 
            this.state.playerPyreBurnUsed : 
            this.state.enemyPyreBurnUsed;
        
        if (usedFlag) {
            return { valid: false, error: 'Already burned for pyre this turn' };
        }
        
        // Find card
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return { valid: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        
        // Execute
        hand.splice(cardIndex, 1);
        
        if (owner === 'player') {
            this.state.playerPyreBurnUsed = true;
            this.state.playerBurnPile.push(card);
            this.state.playerPyre += 1;
        } else {
            this.state.enemyPyreBurnUsed = true;
            this.state.enemyBurnPile.push(card);
            this.state.enemyPyre += 1;
        }
        
        this.emit(GameEventTypes.CARD_BURNED, {
            owner, card: this.serializeCard(card)
        });
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner,
            amount: 1,
            newValue: owner === 'player' ? this.state.playerPyre : this.state.enemyPyre,
            source: 'burn'
        });
        
        this.addAnimation('burn', { owner, cardKey: card.key });
        
        return { valid: true };
    }
    
    handleActivateAbility(owner, action) {
        const { row, abilityName, targetOwner, targetRow } = action;
        const col = this.normalizeClientCol(action.col, owner);
        const targetCol = action.targetCol !== undefined ? 
            this.normalizeClientCol(action.targetCol, targetOwner || this.state.getOpponent(owner)) : undefined;
        
        const cryptid = this.state.getCryptid(owner, col, row);
        if (!cryptid) {
            return { valid: false, error: 'No cryptid at position' };
        }
        
        // Trigger the ability
        this.triggerAbility(cryptid, abilityName, { targetOwner, targetCol, targetRow });
        
        return { valid: true };
    }
    
    // ==================== GAME LOGIC ====================
    
    createCryptid(card, owner, col, row) {
        return {
            id: this.state.nextCryptidId++,
            key: card.key,
            name: card.name,
            baseAtk: card.atk,
            baseHp: card.hp,
            currentAtk: card.atk,
            currentHp: card.hp,
            maxHp: card.hp,
            cost: card.cost || 0,
            element: card.element,
            rarity: card.rarity || 'common',
            isKindling: card.isKindling || false,
            owner, col, row,
            tapped: false,
            canAttack: true,
            justSummoned: true,
            attackedThisTurn: false,
            attackedLastTurn: false,
            burnStacks: 0,
            bleedStacks: 0,
            curseTokens: 0,
            calamityCounters: 0,
            paralyzed: false,
            paralyzedTurns: 0,
            hasProtection: false,
            hasMothmanImmunity: false,
            evolutionChain: [card.key],
            hasDestroyer: card.hasDestroyer || false,
            hasFlight: card.hasFlight || false,
            bonusVsBurning: card.bonusVsBurning || 0,
            attacksAllCombatants: card.attacksAllCombatants || false,
            canTargetAny: card.canTargetAny || false,
            auras: [],
            // Copy ability references
            onSummon: card.onSummon,
            onCombat: card.onCombat,
            onSupport: card.onSupport,
            onEnterCombat: card.onEnterCombat,
            onAttack: card.onAttack,
            onHit: card.onHit,
            onKill: card.onKill,
            onDeath: card.onDeath,
            onEvolve: card.onEvolve,
            onTurnStart: card.onTurnStart,
            onTurnEnd: card.onTurnEnd,
            onDamageTaken: card.onDamageTaken
        };
    }
    
    calculateAttackDamage(attacker, owner) {
        let damage = attacker.currentAtk - (attacker.atkDebuff || 0);
        
        // Add support bonus
        const supportCol = this.state.getSupportCol(owner);
        const field = owner === 'player' ? this.state.playerField : this.state.enemyField;
        const support = field[supportCol]?.[attacker.row];
        
        if (support) {
            damage += support.currentAtk - (support.atkDebuff || 0);
        }
        
        return Math.max(0, damage);
    }
    
    dealDamage(target, amount, source, damageType) {
        if (amount <= 0) return 0;
        
        // Check protection
        if (target.hasProtection) {
            target.hasProtection = false;
            this.emit(GameEventTypes.STATUS_REMOVED, {
                owner: target.owner,
                col: target.col,
                row: target.row,
                status: 'protection'
            });
            this.addAnimation('protectionBlock', {
                targetOwner: target.owner,
                targetCol: target.col,
                targetRow: target.row
            });
            return 0;
        }
        
        // Apply damage
        target.currentHp -= amount;
        
        this.emit(GameEventTypes.DAMAGE_DEALT, {
            target: this.serializeCryptid(target),
            amount,
            source: source ? this.serializeCryptid(source) : null,
            damageType,
            newHp: target.currentHp
        });
        
        this.addAnimation('damage', {
            targetOwner: target.owner,
            targetCol: target.col,
            targetRow: target.row,
            amount,
            damageType
        });
        
        // Trigger onDamageTaken
        this.triggerAbility(target, 'onDamageTaken', { amount, source, damageType });
        
        // Check for death
        if (target.currentHp <= 0) {
            this.killCryptid(target, source?.owner, source);
        }
        
        return amount;
    }
    
    killCryptid(cryptid, killerOwner = null, killerCryptid = null) {
        const { owner, col, row } = cryptid;
        
        // Trigger onDeath ability (may prevent death)
        this.triggerAbility(cryptid, 'onDeath', { killerOwner, killerCryptid });
        
        // Check if death was prevented
        if (cryptid.preventDeath) {
            delete cryptid.preventDeath;
            return null; // Death prevented
        }
        
        // Remove from field
        this.state.setCryptid(owner, col, row, null);
        
        // Increment death counters
        if (owner === 'player') {
            this.state.playerDeaths++;
        } else {
            this.state.enemyDeaths++;
        }
        
        this.emit(GameEventTypes.CRYPTID_DIED, {
            owner, col, row,
            cryptid: this.serializeCryptid(cryptid),
            killerOwner
        });
        
        this.addAnimation('death', {
            owner, col, row,
            key: cryptid.key,
            name: cryptid.name
        });
        
        // Trigger onKill for the killer
        if (killerCryptid) {
            this.triggerAbility(killerCryptid, 'onKill', { target: cryptid });
        }
        
        // Queue promotion check
        this.pendingPromotions.push({ owner, row });
        
        return cryptid;
    }
    
    processPendingPromotions() {
        while (this.pendingPromotions.length > 0) {
            const { owner, row } = this.pendingPromotions.shift();
            this.checkPromotion(owner, row);
        }
    }
    
    checkPromotion(owner, row) {
        const combatCol = this.state.getCombatCol(owner);
        const supportCol = this.state.getSupportCol(owner);
        
        // If combat slot is empty, promote support
        if (this.state.isSlotEmpty(owner, combatCol, row)) {
            const support = this.state.getCryptid(owner, supportCol, row);
            if (support) {
                // Move support to combat
                this.state.setCryptid(owner, supportCol, row, null);
                this.state.setCryptid(owner, combatCol, row, support);
                
                this.emit(GameEventTypes.CRYPTID_PROMOTED, {
                    owner,
                    fromCol: supportCol,
                    toCol: combatCol,
                    row,
                    cryptid: this.serializeCryptid(support)
                });
                
                this.addAnimation('promote', {
                    owner,
                    fromCol: supportCol,
                    toCol: combatCol,
                    row,
                    key: support.key
                });
                
                // Trigger onEnterCombat
                this.triggerAbility(support, 'onEnterCombat', { promoted: true });
            }
        }
    }
    
    applyBurn(target, stacks = 1) {
        target.burnStacks = (target.burnStacks || 0) + stacks;
        
        this.emit(GameEventTypes.STATUS_APPLIED, {
            target: this.serializeCryptid(target),
            status: 'burn',
            stacks
        });
        
        this.addAnimation('burn', {
            targetOwner: target.owner,
            targetCol: target.col,
            targetRow: target.row,
            stacks
        });
    }
    
    applyBleed(target, stacks = 1) {
        target.bleedStacks = (target.bleedStacks || 0) + stacks;
        
        this.emit(GameEventTypes.STATUS_APPLIED, {
            target: this.serializeCryptid(target),
            status: 'bleed',
            stacks
        });
    }
    
    applyParalyze(target, turns = 1) {
        target.paralyzed = true;
        target.paralyzedTurns = (target.paralyzedTurns || 0) + turns;
        
        this.emit(GameEventTypes.STATUS_APPLIED, {
            target: this.serializeCryptid(target),
            status: 'paralyze',
            turns
        });
    }
    
    grantProtection(target, source = null) {
        target.hasProtection = true;
        
        this.emit(GameEventTypes.STATUS_APPLIED, {
            target: this.serializeCryptid(target),
            status: 'protection',
            source
        });
    }
    
    drawCard(owner) {
        const deck = owner === 'player' ? this.state.playerDeck : this.state.enemyDeck;
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        
        if (deck.length > 0) {
            const card = deck.shift();
            hand.push(card);
            
            this.emit(GameEventTypes.CARD_DRAWN, {
                owner,
                card: this.serializeCard(card)
            });
        }
    }
    
    // ==================== TURN MANAGEMENT ====================
    
    endTurn(owner) {
        this.emit(GameEventTypes.TURN_END, {
            owner,
            turnNumber: this.state.turnNumber
        });
        
        this.addAnimation('turnEnd', { owner });
        
        // Switch turn
        this.state.currentTurn = this.state.currentTurn === 'player' ? 'enemy' : 'player';
        this.state.phase = 'conjure1';
        
        if (this.state.currentTurn === 'player') {
            this.state.turnNumber++;
        }
        
        // Reset per-turn flags
        this.resetTurnFlags(this.state.currentTurn);
        
        // Process turn start effects
        this.processTurnStartEffects(this.state.currentTurn);
        
        // Give 1 pyre at turn start
        const newOwner = this.state.currentTurn;
        if (newOwner === 'player') {
            this.state.playerPyre += 1;
        } else {
            this.state.enemyPyre += 1;
        }
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner: newOwner,
            amount: 1,
            newValue: newOwner === 'player' ? this.state.playerPyre : this.state.enemyPyre,
            source: 'turnStart'
        });
        
        this.addAnimation('pyreGain', {
            owner: newOwner,
            amount: 1,
            source: 'turnStart'
        });
        
        // Draw card
        this.drawCard(this.state.currentTurn);
        
        this.emit(GameEventTypes.TURN_START, {
            owner: this.state.currentTurn,
            turnNumber: this.state.turnNumber
        });
        
        this.addAnimation('turnStart', {
            owner: this.state.currentTurn,
            turnNumber: this.state.turnNumber
        });
    }
    
    resetTurnFlags(owner) {
        if (owner === 'player') {
            this.state.playerKindlingPlayedThisTurn = false;
            this.state.playerPyreCardPlayedThisTurn = false;
            this.state.playerPyreBurnUsed = false;
        } else {
            this.state.enemyKindlingPlayedThisTurn = false;
            this.state.enemyPyreCardPlayedThisTurn = false;
            this.state.enemyPyreBurnUsed = false;
        }
        
        // Reset cryptid flags
        for (const cryptid of this.state.getAllCryptids(owner)) {
            cryptid.attackedLastTurn = cryptid.attackedThisTurn;
            cryptid.attackedThisTurn = false;
            cryptid.justSummoned = false;
            cryptid.evolvedThisTurn = false;
            cryptid.tapped = false;
        }
    }
    
    processTurnStartEffects(owner) {
        for (const cryptid of this.state.getAllCryptids(owner)) {
            // Process burn damage
            if (cryptid.burnStacks > 0) {
                const damage = 1;
                cryptid.burnStacks--;
                
                this.emit(GameEventTypes.STATUS_TICKED, {
                    owner: cryptid.owner,
                    col: cryptid.col,
                    row: cryptid.row,
                    status: 'burn',
                    damage,
                    stacksRemaining: cryptid.burnStacks
                });
                
                this.dealDamage(cryptid, damage, null, 'burn');
            }
            
            // Clear paralysis
            if (cryptid.paralyzed && cryptid.paralyzedTurns > 0) {
                cryptid.paralyzedTurns--;
                if (cryptid.paralyzedTurns <= 0) {
                    cryptid.paralyzed = false;
                    this.emit(GameEventTypes.STATUS_REMOVED, {
                        owner: cryptid.owner,
                        col: cryptid.col,
                        row: cryptid.row,
                        status: 'paralyze'
                    });
                }
            }
            
            // Trigger onTurnStart abilities
            this.triggerAbility(cryptid, 'onTurnStart', {});
        }
    }
    
    // ==================== ABILITY SYSTEM ====================
    
    triggerAbility(cryptid, abilityName, context) {
        const ability = cryptid?.[abilityName];
        if (!ability || typeof ability !== 'function') return;
        
        this.emit(GameEventTypes.ABILITY_TRIGGERED, {
            owner: cryptid.owner,
            col: cryptid.col,
            row: cryptid.row,
            cryptidKey: cryptid.key,
            abilityName,
            context
        });
        
        // Execute ability
        try {
            ability(cryptid, cryptid.owner, this, context);
        } catch (e) {
            console.error(`Error executing ability ${abilityName} for ${cryptid.key}:`, e);
        }
    }
    
    // ==================== GAME END ====================
    
    checkGameEnd() {
        const playerCryptids = this.state.getAllCryptids('player');
        const enemyCryptids = this.state.getAllCryptids('enemy');
        
        // Check for total elimination
        if (enemyCryptids.length === 0 && this.state.enemyKindling.length === 0) {
            this.state.gameOver = true;
            this.state.winner = 'player';
            this.emit(GameEventTypes.MATCH_END, { winner: 'player', reason: 'elimination' });
        } else if (playerCryptids.length === 0 && this.state.playerKindling.length === 0) {
            this.state.gameOver = true;
            this.state.winner = 'enemy';
            this.emit(GameEventTypes.MATCH_END, { winner: 'enemy', reason: 'elimination' });
        }
    }
    
    // ==================== HELPERS ====================
    
    emit(type, data) {
        this.events.push({ type, ...data, timestamp: Date.now() });
    }
    
    addAnimation(type, data) {
        this.animationSequence.push({ type, ...data });
    }
    
    // Get field reference (for ability use)
    getField(owner) {
        return owner === 'player' ? this.state.playerField : this.state.enemyField;
    }
    
    // Get combatant across from a cryptid (for ability use)
    getEnemyCombatantAcross(cryptid) {
        const enemyOwner = this.state.getOpponent(cryptid.owner);
        const enemyCombatCol = this.state.getCombatCol(enemyOwner);
        return this.state.getCryptid(enemyOwner, enemyCombatCol, cryptid.row);
    }
    
    // Get combatant in same row (for support abilities)
    getCombatant(support) {
        const combatCol = this.state.getCombatCol(support.owner);
        return this.state.getCryptid(support.owner, combatCol, support.row);
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
            currentAtk: cryptid.currentAtk,
            currentHp: cryptid.currentHp,
            maxHp: cryptid.maxHp,
            baseAtk: cryptid.baseAtk,
            baseHp: cryptid.baseHp,
            tapped: cryptid.tapped,
            justSummoned: cryptid.justSummoned,
            attackedThisTurn: cryptid.attackedThisTurn,
            burnStacks: cryptid.burnStacks,
            bleedStacks: cryptid.bleedStacks,
            paralyzed: cryptid.paralyzed,
            curseTokens: cryptid.curseTokens,
            hasProtection: cryptid.hasProtection,
            hasDestroyer: cryptid.hasDestroyer,
            hasFlight: cryptid.hasFlight,
            isKindling: cryptid.isKindling,
            evolutionChain: cryptid.evolutionChain,
            element: cryptid.element,
            rarity: cryptid.rarity
        };
    }
    
    serializeCard(card) {
        if (!card) return null;
        return {
            id: card.id,
            key: card.key,
            name: card.name,
            type: card.type,
            cost: card.cost,
            element: card.element,
            rarity: card.rarity,
            atk: card.atk,
            hp: card.hp,
            evolvesFrom: card.evolvesFrom
        };
    }
    
    getStateForPlayer(playerId, isPlayer1) {
        const isPlayer = isPlayer1;
        
        const myHand = isPlayer ? this.state.playerHand : this.state.enemyHand;
        const myKindling = isPlayer ? this.state.playerKindling : this.state.enemyKindling;
        const myPyre = isPlayer ? this.state.playerPyre : this.state.enemyPyre;
        const opponentPyre = isPlayer ? this.state.enemyPyre : this.state.playerPyre;
        const myTraps = isPlayer ? this.state.playerTraps : this.state.enemyTraps;
        const opponentTraps = isPlayer ? this.state.enemyTraps : this.state.playerTraps;
        const opponentHand = isPlayer ? this.state.enemyHand : this.state.playerHand;
        const opponentKindling = isPlayer ? this.state.enemyKindling : this.state.playerKindling;
        
        const currentTurn = this.state.currentTurn;
        const isMyTurn = (isPlayer && currentTurn === 'player') || (!isPlayer && currentTurn === 'enemy');
        
        // Normalize field columns for sending to client
        // Server stores: playerField combat=0, enemyField combat=1
        // Client expects: both fields with combat in position 0
        // So we swap enemyField columns before sending
        const serializeField = (field, needsSwap) => {
            const serialized = field.map(col => col.map(c => c ? this.serializeCryptid(c) : null));
            if (needsSwap) {
                // Swap columns: [col0, col1] -> [col1, col0]
                return [serialized[1], serialized[0]];
            }
            return serialized;
        };
        
        // Server storage: playerField=[combat,support], enemyField=[support,combat]
        // Client expects after its swap: playerField=[support,combat], enemyField=[combat,support]
        // Client swap does: [received[1], received[0]]
        // So server must send: playerField=[combat,support], enemyField=[support,combat]
        // 
        // For Player 1: send fields as-is (no swap)
        // For Player 2: swap both fields (so their perspective matches client expectations)
        const myField = isPlayer ? this.state.playerField : this.state.enemyField;
        const opponentField = isPlayer ? this.state.enemyField : this.state.playerField;
        const myFieldNeedsSwap = !isPlayer;       // Player 2 needs swap
        const opponentFieldNeedsSwap = !isPlayer; // Player 2 needs swap
        
        // Only send hand/kindling if this player's deck has been initialized
        // Otherwise the client would overwrite their local hand with empty data
        const myDeckInitialized = isPlayer ? this.state.playerDeckInitialized : this.state.enemyDeckInitialized;
        
        return {
            playerField: serializeField(myField, myFieldNeedsSwap),
            enemyField: serializeField(opponentField, opponentFieldNeedsSwap),
            
            // Only include hand/kindling if server has authoritative data for this player
            hand: myDeckInitialized ? myHand.map(c => this.serializeCard(c)) : null,
            kindling: myDeckInitialized ? myKindling.map(c => this.serializeCard(c)) : null,
            deckInitialized: myDeckInitialized || false,
            
            opponentHandCount: opponentHand.length,
            opponentKindlingCount: opponentKindling.length,
            
            playerPyre: myPyre,
            enemyPyre: opponentPyre,
            
            playerTraps: myTraps,
            enemyTraps: opponentTraps.map(t => t ? { type: 'trap', faceDown: true, row: t.row } : null),
            
            isMyTurn,
            phase: this.state.phase,
            turnNumber: this.state.turnNumber,
            
            kindlingPlayed: isPlayer ? this.state.playerKindlingPlayedThisTurn : this.state.enemyKindlingPlayedThisTurn,
            pyreCardPlayed: isPlayer ? this.state.playerPyreCardPlayedThisTurn : this.state.enemyPyreCardPlayedThisTurn,
            pyreBurnUsed: isPlayer ? this.state.playerPyreBurnUsed : this.state.enemyPyreBurnUsed,
            
            gameOver: this.state.gameOver,
            winner: this.state.winner ? 
                ((isPlayer && this.state.winner === 'player') || (!isPlayer && this.state.winner === 'enemy') ? 'player' : 'enemy') 
                : null
        };
    }
    
    filterEventsForPlayer(events, isPlayer1) {
        const myOwner = isPlayer1 ? 'player' : 'enemy';
        
        return events.map(event => {
            // Card draws are private
            if (event.type === GameEventTypes.CARD_DRAWN && event.owner !== myOwner) {
                return { type: event.type, owner: event.owner, cardCount: 1 };
            }
            
            // Flip owner perspective for player 2
            if (!isPlayer1 && event.owner) {
                return {
                    ...event,
                    owner: event.owner === 'player' ? 'enemy' : 'player'
                };
            }
            
            return event;
        });
    }
    
    filterAnimationsForPlayer(animations, isPlayer1) {
        const myOwner = isPlayer1 ? 'player' : 'enemy';
        
        return animations.map(anim => {
            const flipped = { ...anim };
            
            // Flip owner fields for player 2
            if (!isPlayer1) {
                if (flipped.owner) {
                    flipped.owner = flipped.owner === 'player' ? 'enemy' : 'player';
                }
                if (flipped.targetOwner) {
                    flipped.targetOwner = flipped.targetOwner === 'player' ? 'enemy' : 'player';
                }
                if (flipped.attackerOwner) {
                    flipped.attackerOwner = flipped.attackerOwner === 'player' ? 'enemy' : 'player';
                }
                if (flipped.sourceOwner) {
                    flipped.sourceOwner = flipped.sourceOwner === 'player' ? 'enemy' : 'player';
                }
            }
            
            return flipped;
        });
    }
}

