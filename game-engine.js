/**
 * Cryptid Fates - Headless Game Engine
 * 
 * PURE GAME LOGIC - NO DOM, NO WINDOW, NO SETTIMEOUT
 * This runs on BOTH server (Cloudflare Worker) and client
 * 
 * Key principles:
 * 1. All operations are synchronous
 * 2. All state changes emit events
 * 3. Events drive animations (on client)
 * 4. RNG is deterministic (seeded)
 */

// ==================== SEEDED RNG ====================
class SeededRNG {
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
    
    // Random integer in range [min, max]
    int(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
    
    // Random element from array
    pick(array) {
        if (!array || array.length === 0) return null;
        return array[this.int(0, array.length - 1)];
    }
    
    // Shuffle array in place
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = this.int(0, i);
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    
    // Get current state for serialization
    getState() {
        return this.state;
    }
    
    // Restore state
    setState(state) {
        this.state = state;
    }
}

// ==================== GAME EVENT TYPES ====================
const GameEventTypes = {
    // Match lifecycle
    MATCH_START: 'matchStart',
    MATCH_END: 'matchEnd',
    TURN_START: 'turnStart',
    TURN_END: 'turnEnd',
    PHASE_CHANGE: 'phaseChange',
    
    // Cards
    CARD_DRAWN: 'cardDrawn',           // Private to owner
    CARD_PLAYED: 'cardPlayed',
    CARD_DISCARDED: 'cardDiscarded',
    CARD_BURNED: 'cardBurned',         // Burned for pyre
    
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
    STATUS_APPLIED: 'statusApplied',   // Burn, bleed, paralyze, etc.
    STATUS_TICKED: 'statusTicked',     // Periodic effect triggered
    STATUS_REMOVED: 'statusRemoved',
    
    // Stats
    STAT_CHANGED: 'statChanged',       // ATK/HP modification
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
const ActionTypes = {
    // Turn structure
    END_PHASE: 'endPhase',
    
    // Card play
    SUMMON_CRYPTID: 'summonCryptid',
    SUMMON_KINDLING: 'summonKindling',
    PLAY_BURST: 'playBurst',
    PLAY_TRAP: 'playTrap',
    PLAY_AURA: 'playAura',
    PLAY_PYRE: 'playPyre',
    EVOLVE: 'evolve',
    
    // Combat
    ATTACK: 'attack',
    
    // Resources
    BURN_FOR_PYRE: 'burnForPyre',
    
    // Abilities
    ACTIVATE_ABILITY: 'activateAbility',
    
    // Targeting (for prompted choices)
    SELECT_TARGET: 'selectTarget',
    SELECT_OPTION: 'selectOption',
};

// ==================== GAME STATE CLASS ====================
class GameState {
    constructor() {
        // Fields: [col][row] where col 0=combat, col 1=support
        this.playerField = [[null, null, null], [null, null, null]];
        this.enemyField = [[null, null, null], [null, null, null]];
        
        // Hands (array of cards)
        this.playerHand = [];
        this.enemyHand = [];
        
        // Kindling pools
        this.playerKindling = [];
        this.enemyKindling = [];
        
        // Resources
        this.playerPyre = 0;
        this.enemyPyre = 0;
        
        // Turn tracking
        this.currentTurn = 'player'; // or 'enemy'
        this.phase = 'conjure1';     // conjure1, combat, conjure2
        this.turnNumber = 0;
        
        // Traps: [row] for each row
        this.playerTraps = [null, null, null];
        this.enemyTraps = [null, null, null];
        
        // Decks (array of cards, index 0 = top)
        this.playerDeck = [];
        this.enemyDeck = [];
        
        // Piles
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
        this.deathsThisTurn = { player: 0, enemy: 0 };
        
        // Toxic tiles
        this.playerToxicTiles = [[0, 0, 0], [0, 0, 0]];
        this.enemyToxicTiles = [[0, 0, 0], [0, 0, 0]];
        
        // Game end
        this.gameOver = false;
        this.winner = null;
        
        // Unique ID counter for cryptids
        this.nextCryptidId = 1;
    }
    
    // Clone state for branching/rollback
    clone() {
        const copy = new GameState();
        copy.playerField = this.playerField.map(col => [...col]);
        copy.enemyField = this.enemyField.map(col => [...col]);
        copy.playerHand = [...this.playerHand];
        copy.enemyHand = [...this.enemyHand];
        copy.playerKindling = [...this.playerKindling];
        copy.enemyKindling = [...this.enemyKindling];
        copy.playerPyre = this.playerPyre;
        copy.enemyPyre = this.enemyPyre;
        copy.currentTurn = this.currentTurn;
        copy.phase = this.phase;
        copy.turnNumber = this.turnNumber;
        copy.playerTraps = [...this.playerTraps];
        copy.enemyTraps = [...this.enemyTraps];
        copy.playerDeck = [...this.playerDeck];
        copy.enemyDeck = [...this.enemyDeck];
        copy.playerBurnPile = [...this.playerBurnPile];
        copy.playerDiscardPile = [...this.playerDiscardPile];
        copy.enemyBurnPile = [...this.enemyBurnPile];
        copy.enemyDiscardPile = [...this.enemyDiscardPile];
        copy.playerKindlingPlayedThisTurn = this.playerKindlingPlayedThisTurn;
        copy.enemyKindlingPlayedThisTurn = this.enemyKindlingPlayedThisTurn;
        copy.playerPyreCardPlayedThisTurn = this.playerPyreCardPlayedThisTurn;
        copy.enemyPyreCardPlayedThisTurn = this.enemyPyreCardPlayedThisTurn;
        copy.playerPyreBurnUsed = this.playerPyreBurnUsed;
        copy.enemyPyreBurnUsed = this.enemyPyreBurnUsed;
        copy.playerDeaths = this.playerDeaths;
        copy.enemyDeaths = this.enemyDeaths;
        copy.deathsThisTurn = { ...this.deathsThisTurn };
        copy.playerToxicTiles = this.playerToxicTiles.map(col => [...col]);
        copy.enemyToxicTiles = this.enemyToxicTiles.map(col => [...col]);
        copy.gameOver = this.gameOver;
        copy.winner = this.winner;
        copy.nextCryptidId = this.nextCryptidId;
        return copy;
    }
    
    // Get field for owner
    getField(owner) {
        return owner === 'player' ? this.playerField : this.enemyField;
    }
    
    // Get cryptid at position
    getCryptid(owner, col, row) {
        return this.getField(owner)[col]?.[row] || null;
    }
    
    // Set cryptid at position
    setCryptid(owner, col, row, cryptid) {
        this.getField(owner)[col][row] = cryptid;
        if (cryptid) {
            cryptid.owner = owner;
            cryptid.col = col;
            cryptid.row = row;
        }
    }
    
    // Get combat column for owner (0 for player, 1 for enemy)
    getCombatCol(owner) {
        return owner === 'player' ? 0 : 1;
    }
    
    // Get support column for owner
    getSupportCol(owner) {
        return owner === 'player' ? 1 : 0;
    }
    
    // Check if slot is empty
    isSlotEmpty(owner, col, row) {
        return !this.getCryptid(owner, col, row);
    }
    
    // Get all cryptids for owner
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
    
    // Get opponent owner string
    getOpponent(owner) {
        return owner === 'player' ? 'enemy' : 'player';
    }
}

// ==================== CRYPTID CLASS ====================
class Cryptid {
    constructor(cardData, id) {
        this.id = id;
        this.key = cardData.key;
        this.name = cardData.name;
        this.baseAtk = cardData.atk;
        this.baseHp = cardData.hp;
        this.currentAtk = cardData.atk;
        this.currentHp = cardData.hp;
        this.maxHp = cardData.hp;
        this.cost = cardData.cost || 0;
        this.element = cardData.element;
        this.rarity = cardData.rarity || 'common';
        this.set = cardData.set;
        this.isKindling = cardData.isKindling || false;
        
        // Position (set when placed)
        this.owner = null;
        this.col = null;
        this.row = null;
        
        // Abilities (references to ability functions)
        this.abilities = cardData.abilities || {};
        
        // Status flags
        this.tapped = false;
        this.canAttack = true;
        this.justSummoned = true;
        this.attackedThisTurn = false;
        
        // Status effects
        this.burnStacks = 0;
        this.bleedStacks = 0;
        this.paralyzed = false;
        this.terrified = false;
        this.cursed = false;
        this.curseTokens = 0;
        this.hasProtection = false;
        this.protectionSource = null;
        
        // Debuffs
        this.atkDebuff = 0;
        this.hpDebuff = 0;
        
        // Special flags
        this.hasDestroyer = false;
        this.hasFlight = false;
        this.isHidden = false;
        
        // Evolution tracking
        this.evolutionChain = [cardData.key];
        this.evolvedThisTurn = false;
        
        // Attached auras
        this.attachedAuras = [];
    }
    
    // Calculate effective ATK (including support bonus)
    getEffectiveAtk(state) {
        let atk = this.currentAtk - this.atkDebuff - this.curseTokens;
        
        // Add support bonus if we're in combat position
        if (this.col === state.getCombatCol(this.owner)) {
            const supportCol = state.getSupportCol(this.owner);
            const support = state.getCryptid(this.owner, supportCol, this.row);
            if (support) {
                atk += support.currentAtk - support.atkDebuff - support.curseTokens;
            }
        }
        
        return Math.max(0, atk);
    }
    
    // Calculate effective HP (including support)
    getEffectiveHp(state) {
        let hp = this.currentHp;
        
        if (this.col === state.getCombatCol(this.owner)) {
            const supportCol = state.getSupportCol(this.owner);
            const support = state.getCryptid(this.owner, supportCol, this.row);
            if (support) {
                hp += support.currentHp;
            }
        }
        
        return hp;
    }
    
    // Check if cryptid is dead
    isDead() {
        return this.currentHp <= 0;
    }
    
    // Clone cryptid
    clone() {
        const copy = new Cryptid({
            key: this.key,
            name: this.name,
            atk: this.baseAtk,
            hp: this.baseHp,
            cost: this.cost,
            element: this.element,
            rarity: this.rarity,
            set: this.set,
            isKindling: this.isKindling,
            abilities: this.abilities
        }, this.id);
        
        // Copy all mutable state
        Object.assign(copy, {
            currentAtk: this.currentAtk,
            currentHp: this.currentHp,
            maxHp: this.maxHp,
            owner: this.owner,
            col: this.col,
            row: this.row,
            tapped: this.tapped,
            canAttack: this.canAttack,
            justSummoned: this.justSummoned,
            attackedThisTurn: this.attackedThisTurn,
            burnStacks: this.burnStacks,
            bleedStacks: this.bleedStacks,
            paralyzed: this.paralyzed,
            terrified: this.terrified,
            cursed: this.cursed,
            curseTokens: this.curseTokens,
            hasProtection: this.hasProtection,
            protectionSource: this.protectionSource,
            atkDebuff: this.atkDebuff,
            hpDebuff: this.hpDebuff,
            hasDestroyer: this.hasDestroyer,
            hasFlight: this.hasFlight,
            isHidden: this.isHidden,
            evolutionChain: [...this.evolutionChain],
            evolvedThisTurn: this.evolvedThisTurn,
            attachedAuras: [...this.attachedAuras]
        });
        
        return copy;
    }
}

// ==================== GAME ENGINE ====================
class GameEngine {
    constructor(cardRegistry) {
        this.cardRegistry = cardRegistry;
        this.state = new GameState();
        this.rng = new SeededRNG();
        this.events = [];         // Events for current action
        this.pendingEffects = []; // Triggered effects to resolve
    }
    
    // ==================== INITIALIZATION ====================
    
    initMatch(player1Deck, player2Deck, seed = Date.now(), firstPlayer = null) {
        this.state = new GameState();
        this.rng = new SeededRNG(seed);
        this.events = [];
        
        // Build decks
        this.state.playerDeck = this.buildDeck(player1Deck);
        this.state.enemyDeck = this.buildDeck(player2Deck);
        
        // Shuffle decks
        this.rng.shuffle(this.state.playerDeck);
        this.rng.shuffle(this.state.enemyDeck);
        
        // Build kindling pools
        this.state.playerKindling = this.buildKindling(player1Deck);
        this.state.enemyKindling = this.buildKindling(player2Deck);
        
        // Determine first player
        this.state.currentTurn = firstPlayer || (this.rng.next() < 0.5 ? 'player' : 'enemy');
        this.state.phase = 'conjure1';
        this.state.turnNumber = 1;
        
        // Draw starting hands
        this.drawCards('player', 5);
        this.drawCards('enemy', 5);
        
        this.emit(GameEventTypes.MATCH_START, {
            firstPlayer: this.state.currentTurn,
            seed: seed
        });
        
        this.emit(GameEventTypes.TURN_START, {
            player: this.state.currentTurn,
            turnNumber: this.state.turnNumber
        });
        
        return this.getResult();
    }
    
    buildDeck(deckConfig) {
        // Build deck from config, assigning unique IDs
        const deck = [];
        // ... implementation depends on deck format
        return deck;
    }
    
    buildKindling(deckConfig) {
        const kindling = [];
        // ... implementation depends on deck format
        return kindling;
    }
    
    // ==================== ACTION PROCESSING ====================
    
    /**
     * Process an action from a player
     * Returns { valid: bool, events: [], state: GameState, error?: string }
     */
    processAction(playerId, action) {
        this.events = [];
        
        // Validate it's this player's turn
        const isPlayerTurn = (playerId === 'player1' && this.state.currentTurn === 'player') ||
                            (playerId === 'player2' && this.state.currentTurn === 'enemy');
        
        if (!isPlayerTurn && action.type !== ActionTypes.SELECT_TARGET) {
            return this.error('Not your turn');
        }
        
        // Dispatch to appropriate handler
        let result;
        switch (action.type) {
            case ActionTypes.END_PHASE:
                result = this.handleEndPhase();
                break;
            case ActionTypes.SUMMON_CRYPTID:
                result = this.handleSummonCryptid(action);
                break;
            case ActionTypes.SUMMON_KINDLING:
                result = this.handleSummonKindling(action);
                break;
            case ActionTypes.ATTACK:
                result = this.handleAttack(action);
                break;
            case ActionTypes.PLAY_BURST:
                result = this.handlePlayBurst(action);
                break;
            case ActionTypes.PLAY_TRAP:
                result = this.handlePlayTrap(action);
                break;
            case ActionTypes.PLAY_AURA:
                result = this.handlePlayAura(action);
                break;
            case ActionTypes.PLAY_PYRE:
                result = this.handlePlayPyre(action);
                break;
            case ActionTypes.EVOLVE:
                result = this.handleEvolve(action);
                break;
            case ActionTypes.BURN_FOR_PYRE:
                result = this.handleBurnForPyre(action);
                break;
            case ActionTypes.ACTIVATE_ABILITY:
                result = this.handleActivateAbility(action);
                break;
            default:
                return this.error('Unknown action type: ' + action.type);
        }
        
        if (!result.valid) {
            return result;
        }
        
        // Process any triggered effects
        this.processPendingEffects();
        
        // Check for game end
        this.checkGameEnd();
        
        return this.getResult();
    }
    
    // ==================== ACTION HANDLERS ====================
    
    handleEndPhase() {
        const owner = this.state.currentTurn;
        const phases = ['conjure1', 'combat', 'conjure2'];
        const currentIndex = phases.indexOf(this.state.phase);
        
        if (currentIndex === phases.length - 1) {
            // End of turn
            this.endTurn();
        } else {
            // Advance to next phase
            this.state.phase = phases[currentIndex + 1];
            
            this.emit(GameEventTypes.PHASE_CHANGE, {
                player: owner,
                phase: this.state.phase
            });
            
            // Handle phase-specific effects
            if (this.state.phase === 'combat') {
                this.processCombatPhaseStart();
            }
        }
        
        return { valid: true };
    }
    
    handleSummonCryptid(action) {
        const { cardId, col, row } = action;
        const owner = this.state.currentTurn;
        
        // Find card in hand
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return this.error('Card not in hand');
        }
        
        const card = hand[cardIndex];
        
        // Validate it's a cryptid
        if (card.type !== 'cryptid') {
            return this.error('Card is not a cryptid');
        }
        
        // Validate pyre cost
        const pyre = owner === 'player' ? this.state.playerPyre : this.state.enemyPyre;
        if (pyre < card.cost) {
            return this.error('Not enough pyre');
        }
        
        // Validate position
        if (!this.state.isSlotEmpty(owner, col, row)) {
            return this.error('Slot is occupied');
        }
        
        // Validate conjure phase
        if (this.state.phase !== 'conjure1' && this.state.phase !== 'conjure2') {
            return this.error('Can only summon during conjure phase');
        }
        
        // Execute summon
        hand.splice(cardIndex, 1);
        
        // Deduct pyre
        if (owner === 'player') {
            this.state.playerPyre -= card.cost;
        } else {
            this.state.enemyPyre -= card.cost;
        }
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner,
            amount: -card.cost,
            newValue: owner === 'player' ? this.state.playerPyre : this.state.enemyPyre
        });
        
        // Create cryptid
        const cryptid = new Cryptid(card, this.state.nextCryptidId++);
        this.state.setCryptid(owner, col, row, cryptid);
        
        this.emit(GameEventTypes.CRYPTID_SUMMONED, {
            owner,
            col,
            row,
            cryptid: this.serializeCryptid(cryptid),
            fromKindling: false
        });
        
        // Trigger onSummon ability
        this.triggerAbility(cryptid, 'onSummon', { owner, col, row });
        
        // Trigger onEnterCombat if in combat position
        if (col === this.state.getCombatCol(owner)) {
            this.triggerAbility(cryptid, 'onEnterCombat', { owner, col, row });
        }
        
        return { valid: true };
    }
    
    handleSummonKindling(action) {
        const { kindlingId, col, row } = action;
        const owner = this.state.currentTurn;
        
        // Check if already played kindling this turn
        const playedFlag = owner === 'player' ? 
            this.state.playerKindlingPlayedThisTurn : 
            this.state.enemyKindlingPlayedThisTurn;
        
        if (playedFlag) {
            return this.error('Already played kindling this turn');
        }
        
        // Find kindling
        const pool = owner === 'player' ? this.state.playerKindling : this.state.enemyKindling;
        const kindlingIndex = pool.findIndex(k => k.id === kindlingId);
        
        if (kindlingIndex === -1) {
            return this.error('Kindling not found');
        }
        
        const kindling = pool[kindlingIndex];
        
        // Validate position
        if (!this.state.isSlotEmpty(owner, col, row)) {
            return this.error('Slot is occupied');
        }
        
        // Validate conjure phase
        if (this.state.phase !== 'conjure1' && this.state.phase !== 'conjure2') {
            return this.error('Can only summon during conjure phase');
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
        const cryptid = new Cryptid({ ...kindling, isKindling: true }, this.state.nextCryptidId++);
        this.state.setCryptid(owner, col, row, cryptid);
        
        this.emit(GameEventTypes.CRYPTID_SUMMONED, {
            owner,
            col,
            row,
            cryptid: this.serializeCryptid(cryptid),
            fromKindling: true
        });
        
        // Trigger onSummon
        this.triggerAbility(cryptid, 'onSummon', { owner, col, row });
        
        // Trigger onEnterCombat if in combat position
        if (col === this.state.getCombatCol(owner)) {
            this.triggerAbility(cryptid, 'onEnterCombat', { owner, col, row });
        }
        
        return { valid: true };
    }
    
    handleAttack(action) {
        const { attackerCol, attackerRow, targetCol, targetRow } = action;
        const owner = this.state.currentTurn;
        const opponentOwner = this.state.getOpponent(owner);
        
        // Validate combat phase
        if (this.state.phase !== 'combat') {
            return this.error('Can only attack during combat phase');
        }
        
        // Get attacker
        const attacker = this.state.getCryptid(owner, attackerCol, attackerRow);
        if (!attacker) {
            return this.error('No attacker at position');
        }
        
        // Validate attacker can attack
        if (attacker.tapped || !attacker.canAttack || attacker.attackedThisTurn) {
            return this.error('Attacker cannot attack');
        }
        
        // Validate attacker is in combat position
        if (attackerCol !== this.state.getCombatCol(owner)) {
            return this.error('Attacker must be in combat position');
        }
        
        // Get target
        const targetCombatCol = this.state.getCombatCol(opponentOwner);
        
        // Default target is directly across (same row, combat col)
        const target = this.state.getCryptid(opponentOwner, targetCombatCol, targetRow);
        
        // If no target directly across, check if attacker has flight
        if (!target && !attacker.hasFlight) {
            // Check if there's something in combat that could block
            const hasBlocker = this.state.getCryptid(opponentOwner, targetCombatCol, attackerRow);
            if (hasBlocker) {
                return this.error('Must attack the cryptid directly across');
            }
        }
        
        // Execute attack
        this.executeAttack(attacker, target, opponentOwner, targetRow);
        
        return { valid: true };
    }
    
    executeAttack(attacker, target, targetOwner, targetRow) {
        const owner = attacker.owner;
        
        // Mark attacker as having attacked
        attacker.attackedThisTurn = true;
        attacker.tapped = true;
        
        // Calculate damage
        const damage = attacker.getEffectiveAtk(this.state);
        
        this.emit(GameEventTypes.ATTACK_DECLARED, {
            attacker: this.serializeCryptid(attacker),
            target: target ? this.serializeCryptid(target) : null,
            targetOwner,
            targetRow,
            damage
        });
        
        // Trigger onAttack ability
        this.triggerAbility(attacker, 'onAttack', { target, damage });
        
        if (target) {
            // Deal damage to target
            this.dealDamage(target, damage, attacker, 'attack');
            
            // Trigger onHit
            this.triggerAbility(attacker, 'onHit', { target, damage });
        } else {
            // Direct attack to pyre (or however your game handles it)
            // ... 
        }
    }
    
    handlePlayBurst(action) {
        const { cardId, targetOwner, targetCol, targetRow } = action;
        const owner = this.state.currentTurn;
        
        // Find card in hand
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return this.error('Card not in hand');
        }
        
        const card = hand[cardIndex];
        
        if (card.type !== 'burst') {
            return this.error('Card is not a burst spell');
        }
        
        // Validate pyre cost
        const pyre = owner === 'player' ? this.state.playerPyre : this.state.enemyPyre;
        if (pyre < card.cost) {
            return this.error('Not enough pyre');
        }
        
        // Validate targeting requirements
        if (card.requiresTarget) {
            const target = this.state.getCryptid(targetOwner, targetCol, targetRow);
            if (!target) {
                return this.error('Invalid target');
            }
            // Additional targeting validation based on card
        }
        
        // Execute spell
        hand.splice(cardIndex, 1);
        
        // Deduct pyre
        if (owner === 'player') {
            this.state.playerPyre -= card.cost;
        } else {
            this.state.enemyPyre -= card.cost;
        }
        
        // Add to discard
        if (owner === 'player') {
            this.state.playerDiscardPile.push(card);
        } else {
            this.state.enemyDiscardPile.push(card);
        }
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner,
            amount: -card.cost,
            newValue: owner === 'player' ? this.state.playerPyre : this.state.enemyPyre
        });
        
        this.emit(GameEventTypes.BURST_CAST, {
            owner,
            card: this.serializeCard(card),
            targetOwner,
            targetCol,
            targetRow
        });
        
        // Execute burst effect
        if (card.effect) {
            this.executeBurstEffect(card, owner, targetOwner, targetCol, targetRow);
        }
        
        return { valid: true };
    }
    
    handlePlayTrap(action) {
        const { cardId, row } = action;
        const owner = this.state.currentTurn;
        
        // Find card in hand
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return this.error('Card not in hand');
        }
        
        const card = hand[cardIndex];
        
        if (card.type !== 'trap') {
            return this.error('Card is not a trap');
        }
        
        // Validate trap slot is empty
        const traps = owner === 'player' ? this.state.playerTraps : this.state.enemyTraps;
        if (traps[row]) {
            return this.error('Trap slot is occupied');
        }
        
        // Validate pyre cost
        const pyre = owner === 'player' ? this.state.playerPyre : this.state.enemyPyre;
        if (pyre < card.cost) {
            return this.error('Not enough pyre');
        }
        
        // Execute
        hand.splice(cardIndex, 1);
        
        if (owner === 'player') {
            this.state.playerPyre -= card.cost;
            this.state.playerTraps[row] = { ...card, faceDown: true };
        } else {
            this.state.enemyPyre -= card.cost;
            this.state.enemyTraps[row] = { ...card, faceDown: true };
        }
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner,
            amount: -card.cost,
            newValue: owner === 'player' ? this.state.playerPyre : this.state.enemyPyre
        });
        
        this.emit(GameEventTypes.TRAP_SET, {
            owner,
            row,
            // Don't reveal card to opponent
            card: owner === this.state.currentTurn ? this.serializeCard(card) : { type: 'trap', faceDown: true }
        });
        
        return { valid: true };
    }
    
    handlePlayAura(action) {
        const { cardId, targetOwner, targetCol, targetRow } = action;
        const owner = this.state.currentTurn;
        
        // Similar to burst but attaches to target
        // ... implementation
        
        return { valid: true };
    }
    
    handlePlayPyre(action) {
        const { cardId } = action;
        const owner = this.state.currentTurn;
        
        // Find card in hand
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return this.error('Card not in hand');
        }
        
        const card = hand[cardIndex];
        
        if (card.type !== 'pyre') {
            return this.error('Card is not a pyre card');
        }
        
        // Check if already played pyre this turn
        const playedFlag = owner === 'player' ? 
            this.state.playerPyreCardPlayedThisTurn : 
            this.state.enemyPyreCardPlayedThisTurn;
        
        if (playedFlag) {
            return this.error('Already played pyre card this turn');
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
        const pyreGained = this.executePyreEffect(card, owner);
        
        return { valid: true };
    }
    
    handleEvolve(action) {
        const { cardId, targetCol, targetRow } = action;
        const owner = this.state.currentTurn;
        
        // Find evolution card in hand
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return this.error('Card not in hand');
        }
        
        const card = hand[cardIndex];
        
        if (!card.evolvesFrom) {
            return this.error('Card cannot evolve');
        }
        
        // Find base cryptid
        const target = this.state.getCryptid(owner, targetCol, targetRow);
        if (!target) {
            return this.error('No cryptid at target position');
        }
        
        if (target.key !== card.evolvesFrom) {
            return this.error('Base cryptid does not match evolution requirement');
        }
        
        // Validate pyre cost
        const pyre = owner === 'player' ? this.state.playerPyre : this.state.enemyPyre;
        if (pyre < card.cost) {
            return this.error('Not enough pyre');
        }
        
        // Execute evolution
        hand.splice(cardIndex, 1);
        
        if (owner === 'player') {
            this.state.playerPyre -= card.cost;
        } else {
            this.state.enemyPyre -= card.cost;
        }
        
        // Transform cryptid
        const oldKey = target.key;
        const oldName = target.name;
        
        // Update cryptid with evolved stats
        target.key = card.key;
        target.name = card.name;
        target.baseAtk = card.atk;
        target.baseHp = card.hp;
        target.currentAtk = target.currentAtk + (card.atk - target.baseAtk);
        target.currentHp = target.currentHp + (card.hp - target.baseHp);
        target.maxHp = target.maxHp + (card.hp - target.baseHp);
        target.abilities = card.abilities || {};
        target.evolutionChain.push(card.key);
        target.evolvedThisTurn = true;
        
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
        
        // Trigger onEvolve ability
        this.triggerAbility(target, 'onEvolve', { fromKey: oldKey });
        
        return { valid: true };
    }
    
    handleBurnForPyre(action) {
        const { cardId } = action;
        const owner = this.state.currentTurn;
        
        // Check if already burned this turn
        const usedFlag = owner === 'player' ? 
            this.state.playerPyreBurnUsed : 
            this.state.enemyPyreBurnUsed;
        
        if (usedFlag) {
            return this.error('Already burned for pyre this turn');
        }
        
        // Find card in hand
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return this.error('Card not in hand');
        }
        
        const card = hand[cardIndex];
        
        // Execute burn
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
            owner,
            card: this.serializeCard(card)
        });
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner,
            amount: 1,
            newValue: owner === 'player' ? this.state.playerPyre : this.state.enemyPyre
        });
        
        return { valid: true };
    }
    
    handleActivateAbility(action) {
        const { cryptidCol, cryptidRow, abilityName, targetOwner, targetCol, targetRow } = action;
        const owner = this.state.currentTurn;
        
        const cryptid = this.state.getCryptid(owner, cryptidCol, cryptidRow);
        if (!cryptid) {
            return this.error('No cryptid at position');
        }
        
        // Check if ability exists and can be activated
        const ability = cryptid.abilities?.[abilityName];
        if (!ability) {
            return this.error('Cryptid does not have this ability');
        }
        
        // Execute ability
        this.triggerAbility(cryptid, abilityName, { targetOwner, targetCol, targetRow });
        
        return { valid: true };
    }
    
    // ==================== GAME LOGIC ====================
    
    dealDamage(target, amount, source, damageType) {
        if (amount <= 0) return 0;
        
        // Check for protection
        if (target.hasProtection) {
            target.hasProtection = false;
            target.protectionSource = null;
            
            this.emit(GameEventTypes.STATUS_REMOVED, {
                owner: target.owner,
                col: target.col,
                row: target.row,
                status: 'protection',
                reason: 'blocked'
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
        
        // Trigger onDamageTaken
        this.triggerAbility(target, 'onDamageTaken', { amount, source, damageType });
        
        // Check for death
        if (target.isDead()) {
            this.killCryptid(target, source?.owner);
        }
        
        return amount;
    }
    
    healCryptid(target, amount, source) {
        if (amount <= 0) return 0;
        
        const oldHp = target.currentHp;
        target.currentHp = Math.min(target.currentHp + amount, target.maxHp);
        const actualHeal = target.currentHp - oldHp;
        
        if (actualHeal > 0) {
            this.emit(GameEventTypes.HEALING_DONE, {
                target: this.serializeCryptid(target),
                amount: actualHeal,
                source
            });
        }
        
        return actualHeal;
    }
    
    killCryptid(cryptid, killerOwner = null) {
        const { owner, col, row } = cryptid;
        
        // Remove from field
        this.state.setCryptid(owner, col, row, null);
        
        // Increment death counters
        if (owner === 'player') {
            this.state.playerDeaths++;
        } else {
            this.state.enemyDeaths++;
        }
        this.state.deathsThisTurn[owner]++;
        
        this.emit(GameEventTypes.CRYPTID_DIED, {
            owner,
            col,
            row,
            cryptid: this.serializeCryptid(cryptid),
            killerOwner
        });
        
        // Trigger onDeath ability
        this.triggerAbility(cryptid, 'onDeath', { killerOwner });
        
        // Check for promotion
        this.checkPromotion(owner, row);
    }
    
    checkPromotion(owner, row) {
        const combatCol = this.state.getCombatCol(owner);
        const supportCol = this.state.getSupportCol(owner);
        
        // If combat slot is now empty, promote support
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
                
                // Trigger onEnterCombat
                this.triggerAbility(support, 'onEnterCombat', { promoted: true });
            }
        }
    }
    
    applyStatus(target, status, stacks = 1, source = null) {
        switch (status) {
            case 'burn':
                target.burnStacks += stacks;
                break;
            case 'bleed':
                target.bleedStacks += stacks;
                break;
            case 'paralyze':
                target.paralyzed = true;
                break;
            case 'terrify':
                target.terrified = true;
                if (target.currentAtk > 0) {
                    target.savedAtk = target.currentAtk;
                    target.currentAtk = 0;
                }
                break;
            case 'curse':
                target.cursed = true;
                target.curseTokens += stacks;
                break;
            case 'protection':
                target.hasProtection = true;
                target.protectionSource = source;
                break;
        }
        
        this.emit(GameEventTypes.STATUS_APPLIED, {
            target: this.serializeCryptid(target),
            status,
            stacks,
            source
        });
    }
    
    removeStatus(target, status, reason = 'expired') {
        switch (status) {
            case 'burn':
                target.burnStacks = 0;
                break;
            case 'bleed':
                target.bleedStacks = 0;
                break;
            case 'paralyze':
                target.paralyzed = false;
                break;
            case 'terrify':
                target.terrified = false;
                if (target.savedAtk !== undefined) {
                    target.currentAtk = target.savedAtk;
                    delete target.savedAtk;
                }
                break;
            case 'curse':
                target.cursed = false;
                target.curseTokens = 0;
                break;
            case 'protection':
                target.hasProtection = false;
                target.protectionSource = null;
                break;
        }
        
        this.emit(GameEventTypes.STATUS_REMOVED, {
            owner: target.owner,
            col: target.col,
            row: target.row,
            status,
            reason
        });
    }
    
    drawCards(owner, count) {
        const deck = owner === 'player' ? this.state.playerDeck : this.state.enemyDeck;
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        
        for (let i = 0; i < count && deck.length > 0; i++) {
            const card = deck.shift();
            hand.push(card);
            
            this.emit(GameEventTypes.CARD_DRAWN, {
                owner,
                card: this.serializeCard(card),
                deckRemaining: deck.length
            });
        }
    }
    
    // ==================== TURN MANAGEMENT ====================
    
    endTurn() {
        const owner = this.state.currentTurn;
        
        // Process end of turn effects
        this.processEndOfTurnEffects(owner);
        
        this.emit(GameEventTypes.TURN_END, {
            player: owner,
            turnNumber: this.state.turnNumber
        });
        
        // Switch turn
        this.state.currentTurn = this.state.getOpponent(owner);
        this.state.phase = 'conjure1';
        
        if (this.state.currentTurn === 'player') {
            this.state.turnNumber++;
        }
        
        // Reset per-turn flags
        this.resetTurnFlags(this.state.currentTurn);
        
        // Process start of turn effects
        this.processStartOfTurnEffects(this.state.currentTurn);
        
        // Draw card
        this.drawCards(this.state.currentTurn, 1);
        
        this.emit(GameEventTypes.TURN_START, {
            player: this.state.currentTurn,
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
        
        // Reset cryptid per-turn flags
        for (const cryptid of this.state.getAllCryptids(owner)) {
            cryptid.attackedThisTurn = false;
            cryptid.justSummoned = false;
            cryptid.evolvedThisTurn = false;
            cryptid.tapped = false;
        }
        
        this.state.deathsThisTurn[owner] = 0;
    }
    
    processStartOfTurnEffects(owner) {
        // Untap cryptids
        for (const cryptid of this.state.getAllCryptids(owner)) {
            // Process burn damage at start of turn
            if (cryptid.burnStacks > 0) {
                const burnDamage = cryptid.burnStacks;
                cryptid.burnStacks--; // Reduce by 1 each turn
                
                this.emit(GameEventTypes.STATUS_TICKED, {
                    owner: cryptid.owner,
                    col: cryptid.col,
                    row: cryptid.row,
                    status: 'burn',
                    damage: burnDamage,
                    stacksRemaining: cryptid.burnStacks
                });
                
                this.dealDamage(cryptid, burnDamage, null, 'burn');
            }
            
            // Trigger onTurnStart abilities
            this.triggerAbility(cryptid, 'onTurnStart', {});
        }
    }
    
    processEndOfTurnEffects(owner) {
        for (const cryptid of this.state.getAllCryptids(owner)) {
            // Trigger onTurnEnd abilities
            this.triggerAbility(cryptid, 'onTurnEnd', {});
        }
    }
    
    processCombatPhaseStart() {
        // Any combat phase start effects
    }
    
    // ==================== ABILITY SYSTEM ====================
    
    triggerAbility(cryptid, abilityName, context) {
        const ability = cryptid.abilities?.[abilityName];
        if (!ability) return;
        
        this.emit(GameEventTypes.ABILITY_TRIGGERED, {
            owner: cryptid.owner,
            col: cryptid.col,
            row: cryptid.row,
            cryptidKey: cryptid.key,
            abilityName,
            context
        });
        
        // Queue ability effect for resolution
        this.pendingEffects.push({
            cryptid,
            abilityName,
            ability,
            context
        });
    }
    
    processPendingEffects() {
        while (this.pendingEffects.length > 0) {
            const effect = this.pendingEffects.shift();
            this.executeAbility(effect.cryptid, effect.abilityName, effect.ability, effect.context);
        }
    }
    
    executeAbility(cryptid, abilityName, ability, context) {
        // This is where ability logic gets executed
        // The ability function should be pure and use engine methods to modify state
        if (typeof ability === 'function') {
            ability(cryptid, cryptid.owner, this, context);
        }
    }
    
    executeBurstEffect(card, owner, targetOwner, targetCol, targetRow) {
        // Execute burst spell effect
        if (typeof card.effect === 'function') {
            const target = this.state.getCryptid(targetOwner, targetCol, targetRow);
            card.effect(owner, target, this);
        }
    }
    
    executePyreEffect(card, owner) {
        // Execute pyre card effect
        let pyreGained = 1;
        
        if (typeof card.effect === 'function') {
            const result = card.effect(owner, this);
            pyreGained = result?.pyreGained || 1;
        }
        
        if (owner === 'player') {
            this.state.playerPyre += pyreGained;
        } else {
            this.state.enemyPyre += pyreGained;
        }
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner,
            amount: pyreGained,
            newValue: owner === 'player' ? this.state.playerPyre : this.state.enemyPyre
        });
        
        return pyreGained;
    }
    
    // ==================== GAME END ====================
    
    checkGameEnd() {
        // Check win conditions
        // Example: player wins when enemy has no cryptids and no cards to play
        
        const playerCryptids = this.state.getAllCryptids('player');
        const enemyCryptids = this.state.getAllCryptids('enemy');
        
        // Check for total elimination
        if (enemyCryptids.length === 0 && this.state.enemyHand.length === 0 && this.state.enemyKindling.length === 0) {
            this.state.gameOver = true;
            this.state.winner = 'player';
            this.emit(GameEventTypes.MATCH_END, { winner: 'player', reason: 'elimination' });
        } else if (playerCryptids.length === 0 && this.state.playerHand.length === 0 && this.state.playerKindling.length === 0) {
            this.state.gameOver = true;
            this.state.winner = 'enemy';
            this.emit(GameEventTypes.MATCH_END, { winner: 'enemy', reason: 'elimination' });
        }
    }
    
    // ==================== HELPERS ====================
    
    emit(type, data) {
        this.events.push({
            type,
            ...data,
            timestamp: Date.now()
        });
    }
    
    error(message) {
        return { valid: false, error: message, events: [], state: null };
    }
    
    getResult() {
        return {
            valid: true,
            events: this.events,
            state: this.serializeState()
        };
    }
    
    serializeState() {
        // Return public game state
        return {
            playerField: this.state.playerField.map(col => 
                col.map(c => c ? this.serializeCryptid(c) : null)
            ),
            enemyField: this.state.enemyField.map(col => 
                col.map(c => c ? this.serializeCryptid(c) : null)
            ),
            playerPyre: this.state.playerPyre,
            enemyPyre: this.state.enemyPyre,
            currentTurn: this.state.currentTurn,
            phase: this.state.phase,
            turnNumber: this.state.turnNumber,
            playerTraps: this.state.playerTraps.map(t => t ? { type: 'trap', row: t.row } : null),
            enemyTraps: this.state.enemyTraps.map(t => t ? { type: 'trap', row: t.row, faceDown: true } : null),
            playerDeaths: this.state.playerDeaths,
            enemyDeaths: this.state.enemyDeaths,
            gameOver: this.state.gameOver,
            winner: this.state.winner
        };
    }
    
    // Serialize for specific player (filters hidden info)
    serializeStateForPlayer(playerId) {
        const isPlayer = playerId === 'player1';
        const state = this.serializeState();
        
        // Add hand (only your own)
        if (isPlayer) {
            state.hand = this.state.playerHand.map(c => this.serializeCard(c));
            state.kindling = this.state.playerKindling.map(k => this.serializeCard(k));
            state.opponentHandCount = this.state.enemyHand.length;
            state.opponentKindlingCount = this.state.enemyKindling.length;
            state.deckCount = this.state.playerDeck.length;
            state.opponentDeckCount = this.state.enemyDeck.length;
        } else {
            state.hand = this.state.enemyHand.map(c => this.serializeCard(c));
            state.kindling = this.state.enemyKindling.map(k => this.serializeCard(k));
            state.opponentHandCount = this.state.playerHand.length;
            state.opponentKindlingCount = this.state.playerKindling.length;
            state.deckCount = this.state.enemyDeck.length;
            state.opponentDeckCount = this.state.playerDeck.length;
            
            // Flip field perspective
            [state.playerField, state.enemyField] = [state.enemyField, state.playerField];
            [state.playerPyre, state.enemyPyre] = [state.enemyPyre, state.playerPyre];
            [state.playerTraps, state.enemyTraps] = [state.enemyTraps, state.playerTraps];
            [state.playerDeaths, state.enemyDeaths] = [state.enemyDeaths, state.playerDeaths];
            state.currentTurn = state.currentTurn === 'player' ? 'enemy' : 'player';
            if (state.winner) {
                state.winner = state.winner === 'player' ? 'enemy' : 'player';
            }
        }
        
        return state;
    }
    
    // Filter events for specific player (hide opponent's draws, etc.)
    filterEventsForPlayer(events, playerId) {
        const isPlayer = playerId === 'player1';
        const myOwner = isPlayer ? 'player' : 'enemy';
        
        return events.map(event => {
            // Card draws are private
            if (event.type === GameEventTypes.CARD_DRAWN) {
                if (event.owner !== myOwner) {
                    return { 
                        type: event.type, 
                        owner: event.owner,
                        cardCount: 1,
                        // Don't include card details
                    };
                }
            }
            
            // Traps are hidden when set by opponent
            if (event.type === GameEventTypes.TRAP_SET) {
                if (event.owner !== myOwner) {
                    return {
                        type: event.type,
                        owner: event.owner,
                        row: event.row,
                        card: { type: 'trap', faceDown: true }
                    };
                }
            }
            
            return event;
        });
    }
    
    serializeCryptid(cryptid) {
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
            burnStacks: cryptid.burnStacks,
            bleedStacks: cryptid.bleedStacks,
            paralyzed: cryptid.paralyzed,
            terrified: cryptid.terrified,
            cursed: cryptid.cursed,
            curseTokens: cryptid.curseTokens,
            hasProtection: cryptid.hasProtection,
            atkDebuff: cryptid.atkDebuff,
            hpDebuff: cryptid.hpDebuff,
            hasDestroyer: cryptid.hasDestroyer,
            hasFlight: cryptid.hasFlight,
            isKindling: cryptid.isKindling,
            evolutionChain: cryptid.evolutionChain,
            element: cryptid.element,
            rarity: cryptid.rarity
        };
    }
    
    serializeCard(card) {
        return {
            id: card.id,
            key: card.key,
            name: card.name,
            type: card.type,
            cost: card.cost,
            element: card.element,
            rarity: card.rarity,
            // For cryptids
            atk: card.atk,
            hp: card.hp,
            // For evolutions
            evolvesFrom: card.evolvesFrom
        };
    }
}

// ==================== EXPORTS ====================
// For use in both browser (window) and Node.js/Cloudflare Worker

if (typeof module !== 'undefined' && module.exports) {
    // Node.js / Cloudflare Worker
    module.exports = {
        SeededRNG,
        GameEventTypes,
        ActionTypes,
        GameState,
        Cryptid,
        GameEngine
    };
} else if (typeof window !== 'undefined') {
    // Browser
    window.GameEngine = GameEngine;
    window.GameEventTypes = GameEventTypes;
    window.ActionTypes = ActionTypes;
    window.SeededRNG = SeededRNG;
}

