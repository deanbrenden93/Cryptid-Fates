/**
 * Cryptid Fates - Shared Game State
 * 
 * Isomorphic game state management that runs identically on
 * both client (browser) and server (Cloudflare Worker).
 * 
 * This module contains:
 * - Pure game state initialization
 * - State query methods (getCombatCol, getSupport, etc.)
 * - State mutation methods that return change descriptors
 * - Turn and phase management
 * - Damage calculation formulas
 * - Ailment processing
 * 
 * NO DOM operations, NO animations - those are handled by the caller.
 */

(function() {
'use strict';

// Import dependencies if in Node.js environment
let _eventsModule, _schemaModule;
if (typeof require !== 'undefined') {
    try {
        _eventsModule = require('./events.js');
        _schemaModule = require('./schema.js');
    } catch (e) {
        // Running in browser, modules will be on window
    }
}

/**
 * Create a new GameState instance
 * @param {Object} options - Configuration options
 * @param {Object} options.events - GameEvents instance (optional, creates one if not provided)
 * @param {Object} options.registry - CardRegistry instance (optional)
 * @param {boolean} options.debug - Enable debug logging
 * @param {Function} options.logger - Custom logging function
 * @returns {Object} GameState instance
 */
function createGameState(options = {}) {
    const debug = options.debug || false;
    const logger = options.logger || console.log;
    
    // Get events from options or create new
    let events = options.events;
    if (!events) {
        const createGameEvents = _eventsModule?.createGameEvents || 
            (typeof window !== 'undefined' && window.SharedGameEvents?.createGameEvents);
        if (createGameEvents) {
            events = createGameEvents({ debug, logger });
        }
    }
    
    // Get schema constants
    const GamePhases = _schemaModule?.GamePhases || 
        (typeof window !== 'undefined' && window.SharedEffectSchema?.Phases) ||
        { CONJURE1: 'conjure1', COMBAT: 'combat', CONJURE2: 'conjure2', END: 'end' };
    
    // ==================== STATE INITIALIZATION ====================
    
    const state = {
        // Fields: [col][row] - col 0 is support for player, col 1 is combat for player (reversed for enemy)
        playerField: [[null, null, null], [null, null, null]],
        enemyField: [[null, null, null], [null, null, null]],
        
        // Hands
        playerHand: [],
        enemyHand: [],
        
        // Kindling pools (separate from main hand)
        playerKindling: [],
        enemyKindling: [],
        
        // Decks
        playerDeck: [],
        enemyDeck: [],
        
        // Resources
        playerPyre: 0,
        enemyPyre: 0,
        
        // Turn tracking
        playerKindlingPlayedThisTurn: false,
        enemyKindlingPlayedThisTurn: false,
        playerPyreCardPlayedThisTurn: false,
        enemyPyreCardPlayedThisTurn: false,
        playerPyreBurnUsed: false,
        enemyPyreBurnUsed: false,
        
        // Death counters
        playerDeaths: 0,
        enemyDeaths: 0,
        playerDeathCount: 0,
        enemyDeathCount: 0,
        
        // Death tracking for pyre cards
        deathsThisTurn: { player: 0, enemy: 0 },
        deathsLastEnemyTurn: { player: 0, enemy: 0 },
        
        // Attack tracking
        attackersThisTurn: { player: [], enemy: [] },
        lastTurnAttackers: { player: [], enemy: [] },
        
        // Traps (2 slots per player)
        playerTraps: [null, null],
        enemyTraps: [null, null],
        
        // Toxic tiles
        playerToxicTiles: [[0, 0, 0], [0, 0, 0]],
        enemyToxicTiles: [[0, 0, 0], [0, 0, 0]],
        
        // Discard piles
        playerBurnPile: [],
        playerDiscardPile: [],
        enemyBurnPile: [],
        enemyDiscardPile: [],
        
        // Turn state
        currentTurn: 'player',
        phase: GamePhases.CONJURE1,
        turnNumber: 0,
        gameOver: false,
        winner: null,
        
        // Tracking
        evolvedThisTurn: {},
        
        // Match stats
        matchStats: {
            startTime: Date.now(),
            damageDealt: 0,
            damageTaken: 0,
            spellsCast: 0,
            evolutions: 0,
            trapsTriggered: 0,
            kindlingSummoned: 0
        }
    };
    
    // ==================== POSITION HELPERS ====================
    
    /**
     * Get combat column for an owner
     * @param {string} owner - 'player' or 'enemy'
     * @returns {number} Column index (1 for player, 0 for enemy)
     */
    function getCombatCol(owner) {
        return owner === 'player' ? 1 : 0;
    }
    
    /**
     * Get support column for an owner
     * @param {string} owner - 'player' or 'enemy'
     * @returns {number} Column index (0 for player, 1 for enemy)
     */
    function getSupportCol(owner) {
        return owner === 'player' ? 0 : 1;
    }
    
    /**
     * Get field for an owner
     * @param {string} owner - 'player' or 'enemy'
     * @returns {Array} Field array reference
     */
    function getField(owner) {
        return owner === 'player' ? state.playerField : state.enemyField;
    }
    
    /**
     * Get cryptid at position
     * @param {string} owner - 'player' or 'enemy'
     * @param {number} col - Column index
     * @param {number} row - Row index
     * @returns {Object|null} Cryptid or null
     */
    function getFieldCryptid(owner, col, row) {
        const field = getField(owner);
        return field[col]?.[row] || null;
    }
    
    /**
     * Set cryptid at position
     * @param {string} owner - 'player' or 'enemy'
     * @param {number} col - Column index
     * @param {number} row - Row index
     * @param {Object|null} cryptid - Cryptid or null
     */
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
    
    /**
     * Get support cryptid for a combatant
     * @param {Object} cryptid - Combatant cryptid
     * @returns {Object|null} Support cryptid or null
     */
    function getSupport(cryptid) {
        if (!cryptid) return null;
        const { owner, row } = cryptid;
        const combatCol = getCombatCol(owner);
        const supportCol = getSupportCol(owner);
        
        if (cryptid.col === combatCol) {
            return getFieldCryptid(owner, supportCol, row);
        }
        return null;
    }
    
    /**
     * Get combatant cryptid for a support
     * @param {Object} cryptid - Support cryptid
     * @returns {Object|null} Combatant cryptid or null
     */
    function getCombatant(cryptid) {
        if (!cryptid) return null;
        const { owner, row } = cryptid;
        const combatCol = getCombatCol(owner);
        const supportCol = getSupportCol(owner);
        
        if (cryptid.col === supportCol) {
            return getFieldCryptid(owner, combatCol, row);
        }
        return null;
    }
    
    /**
     * Get combatant at a specific row for an owner
     * @param {string} owner - 'player' or 'enemy'
     * @param {number} row - Row index (0-2)
     * @returns {Object|null} Combatant cryptid or null
     */
    function getCombatantAtRow(owner, row) {
        const combatCol = getCombatCol(owner);
        return getFieldCryptid(owner, combatCol, row);
    }
    
    /**
     * Get support at a specific row for an owner
     * @param {string} owner - 'player' or 'enemy'
     * @param {number} row - Row index (0-2)
     * @returns {Object|null} Support cryptid or null
     */
    function getSupportAtRow(owner, row) {
        const supportCol = getSupportCol(owner);
        return getFieldCryptid(owner, supportCol, row);
    }
    
    /**
     * Check if cryptid is in combat position
     * @param {Object} cryptid - Cryptid to check
     * @returns {boolean} True if in combat column
     */
    function isInCombat(cryptid) {
        if (!cryptid) return false;
        return cryptid.col === getCombatCol(cryptid.owner);
    }
    
    /**
     * Check if cryptid is in support position
     * @param {Object} cryptid - Cryptid to check
     * @returns {boolean} True if in support column
     */
    function isInSupport(cryptid) {
        if (!cryptid) return false;
        return cryptid.col === getSupportCol(cryptid.owner);
    }
    
    /**
     * Get all cryptids on a field
     * @param {string} owner - 'player' or 'enemy'
     * @returns {Object[]} Array of cryptids
     */
    function getAllCryptids(owner) {
        const field = getField(owner);
        const cryptids = [];
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                if (field[col]?.[row]) {
                    cryptids.push(field[col][row]);
                }
            }
        }
        return cryptids;
    }
    
    /**
     * Get all cryptids in a column
     * @param {string} owner - 'player' or 'enemy'
     * @param {number} col - Column index
     * @returns {Object[]} Array of cryptids
     */
    function getColumnCryptids(owner, col) {
        const field = getField(owner);
        const cryptids = [];
        for (let row = 0; row < 3; row++) {
            if (field[col]?.[row]) {
                cryptids.push(field[col][row]);
            }
        }
        return cryptids;
    }
    
    /**
     * Check if field is empty
     * @param {string} owner - 'player' or 'enemy'
     * @returns {boolean} True if no cryptids on field
     */
    function isFieldEmpty(owner) {
        return getAllCryptids(owner).length === 0;
    }
    
    /**
     * Get valid summon slots
     * @param {string} owner - 'player' or 'enemy'
     * @returns {Object[]} Array of { col, row } for empty slots
     */
    function getValidSummonSlots(owner) {
        const field = getField(owner);
        const slots = [];
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                if (field[col][row] === null) {
                    slots.push({ col, row });
                }
            }
        }
        return slots;
    }
    
    // ==================== AILMENT HELPERS ====================
    
    /**
     * Check if cryptid has any ailments
     * @param {Object} cryptid - Cryptid to check
     * @returns {boolean} True if has ailments
     */
    function hasAilments(cryptid) {
        if (!cryptid) return false;
        return getAilmentStacks(cryptid) > 0;
    }
    
    /**
     * Get total ailment stacks
     * @param {Object} cryptid - Cryptid to check
     * @returns {number} Total stacks
     */
    function getAilmentStacks(cryptid) {
        if (!cryptid) return 0;
        let stacks = 0;
        if (cryptid.paralyzed) stacks += 1;
        if (cryptid.burnTurns > 0) stacks += cryptid.burnTurns;
        if (cryptid.bleedTurns > 0) stacks += cryptid.bleedTurns;
        if (cryptid.calamityCounters > 0) stacks += cryptid.calamityCounters;
        if (cryptid.curseTokens > 0) stacks += cryptid.curseTokens;
        return stacks;
    }
    
    /**
     * Get list of ailment types on cryptid
     * @param {Object} cryptid - Cryptid to check
     * @returns {string[]} Array of ailment names
     */
    function getStatusAilments(cryptid) {
        if (!cryptid) return [];
        const ailments = [];
        if (cryptid.burnTurns > 0) ailments.push('burn');
        if (cryptid.paralyzed) ailments.push('paralyze');
        if (cryptid.bleedTurns > 0) ailments.push('bleed');
        if (cryptid.calamityCounters > 0) ailments.push('calamity');
        if (cryptid.curseTokens > 0) ailments.push('curse');
        return ailments;
    }
    
    // ==================== STAT CALCULATIONS ====================
    
    /**
     * Get effective HP (includes support HP for combatants)
     * @param {Object} cryptid - Cryptid to check
     * @returns {number} Effective HP
     */
    function getEffectiveHp(cryptid) {
        if (!cryptid) return 0;
        let hp = cryptid.currentHp ?? cryptid.hp;
        
        // If combatant, add support HP
        if (isInCombat(cryptid)) {
            const support = getSupport(cryptid);
            if (support) {
                hp += support.currentHp ?? support.hp;
            }
        }
        return hp;
    }
    
    /**
     * Get effective ATK
     * @param {Object} cryptid - Cryptid to check
     * @returns {number} Effective ATK
     */
    function getEffectiveAtk(cryptid) {
        if (!cryptid) return 0;
        let atk = cryptid.currentAtk ?? cryptid.atk;
        
        // Apply Gremlin debuff
        if (cryptid.gremlinAtkDebuff) {
            atk = Math.max(0, atk - cryptid.gremlinAtkDebuff);
        }
        
        // Apply curse debuff
        if (cryptid.curseTokens > 0) {
            atk = Math.max(0, atk - cryptid.curseTokens);
        }
        
        return atk;
    }
    
    /**
     * Calculate attack damage for a cryptid
     * @param {Object} attacker - Attacking cryptid
     * @param {Object} target - Target cryptid (optional, for bonuses)
     * @returns {number} Base damage
     */
    function calculateAttackDamage(attacker, target = null) {
        if (!attacker) return 0;
        
        let damage = getEffectiveAtk(attacker);
        
        // Support bonus
        const support = getSupport(attacker);
        if (support && !isSupportNegated(support)) {
            // Support ATK adds to combatant damage
            const supportAtk = support.currentAtk ?? support.atk ?? 0;
            damage += supportAtk;
        }
        
        // Conditional bonuses (if target provided)
        if (target) {
            if (target.paralyzed && attacker.bonusVsParalyzed) {
                damage += attacker.bonusVsParalyzed;
            }
            if (hasAilments(target) && attacker.bonusVsAilment) {
                damage += attacker.bonusVsAilment;
            }
            if (target.burnTurns > 0 && attacker.bonusVsBurning) {
                damage += attacker.bonusVsBurning;
            }
            if (target.tapped && attacker.doubleDamageVsTapped) {
                damage *= 2;
            }
        }
        
        return Math.max(0, damage);
    }
    
    /**
     * Check if support's abilities are negated
     * @param {Object} support - Support cryptid
     * @returns {boolean} True if negated
     */
    function isSupportNegated(support) {
        if (!support) return false;
        
        // Check if enemy has Bogeyman across negating support abilities
        const enemyOwner = support.owner === 'player' ? 'enemy' : 'player';
        const enemyCombatCol = getCombatCol(enemyOwner);
        const enemyAcross = getFieldCryptid(enemyOwner, enemyCombatCol, support.row);
        
        return enemyAcross?.negatesEnemySupport === true;
    }
    
    // ==================== RESOURCE MANAGEMENT ====================
    
    /**
     * Get pyre count
     * @param {string} owner - 'player' or 'enemy'
     * @returns {number} Pyre count
     */
    function getPyre(owner) {
        return owner === 'player' ? state.playerPyre : state.enemyPyre;
    }
    
    /**
     * Modify pyre count
     * @param {string} owner - 'player' or 'enemy'
     * @param {number} amount - Amount to add (negative to subtract)
     * @returns {Object} Change descriptor
     */
    function modifyPyre(owner, amount) {
        const before = getPyre(owner);
        if (owner === 'player') {
            state.playerPyre = Math.max(0, state.playerPyre + amount);
        } else {
            state.enemyPyre = Math.max(0, state.enemyPyre + amount);
        }
        const after = getPyre(owner);
        
        if (events && amount !== 0) {
            events.emit(amount > 0 ? 'onPyreGained' : 'onPyreSpent', {
                owner,
                amount: Math.abs(amount),
                before,
                after
            });
        }
        
        return { owner, before, after, change: amount };
    }
    
    /**
     * Get hand
     * @param {string} owner - 'player' or 'enemy'
     * @returns {Object[]} Hand array reference
     */
    function getHand(owner) {
        return owner === 'player' ? state.playerHand : state.enemyHand;
    }
    
    /**
     * Get deck
     * @param {string} owner - 'player' or 'enemy'
     * @returns {Object[]} Deck array reference
     */
    function getDeck(owner) {
        return owner === 'player' ? state.playerDeck : state.enemyDeck;
    }
    
    /**
     * Get kindling pool
     * @param {string} owner - 'player' or 'enemy'
     * @returns {Object[]} Kindling array reference
     */
    function getKindling(owner) {
        return owner === 'player' ? state.playerKindling : state.enemyKindling;
    }
    
    // ==================== CARD OPERATIONS ====================
    
    /**
     * Draw a card from deck to hand
     * @param {string} owner - 'player' or 'enemy'
     * @param {string} source - Source of draw (for events)
     * @returns {Object|null} Drawn card or null if deck empty
     */
    function drawCard(owner, source = 'normal') {
        const deck = getDeck(owner);
        const hand = getHand(owner);
        
        if (deck.length === 0) {
            return null;
        }
        
        const card = deck.shift();
        hand.push(card);
        
        if (events) {
            events.emit('onCardDrawn', { card, owner, source, handSize: hand.length });
        }
        
        return card;
    }
    
    /**
     * Draw a kindling card to kindling pool
     * @param {string} owner - 'player' or 'enemy'
     * @returns {Object|null} Drawn kindling or null if pool full/empty
     */
    function drawKindling(owner) {
        const kindling = getKindling(owner);
        const kindlingDeck = owner === 'player' ? state.playerKindlingDeck : state.enemyKindlingDeck;
        
        // If no separate kindling deck, just return null (kindling may be pre-populated)
        if (!kindlingDeck || kindlingDeck.length === 0) {
            return null;
        }
        
        const card = kindlingDeck.shift();
        kindling.push(card);
        
        if (events) {
            events.emit('onKindlingDrawn', { card, owner, poolSize: kindling.length });
        }
        
        return card;
    }
    
    /**
     * Remove card from hand
     * @param {string} owner - 'player' or 'enemy'
     * @param {string|number} cardIdOrIndex - Card ID or index
     * @returns {Object|null} Removed card or null
     */
    function removeFromHand(owner, cardIdOrIndex) {
        const hand = getHand(owner);
        let index = -1;
        
        if (typeof cardIdOrIndex === 'number') {
            index = cardIdOrIndex;
        } else {
            index = hand.findIndex(c => c.id === cardIdOrIndex);
        }
        
        if (index >= 0 && index < hand.length) {
            return hand.splice(index, 1)[0];
        }
        return null;
    }
    
    /**
     * Find card in hand by ID or key
     * @param {string} owner - 'player' or 'enemy'
     * @param {string} identifier - Card ID or key
     * @returns {Object|null} Card or null
     */
    function findCardInHand(owner, identifier) {
        const hand = getHand(owner);
        return hand.find(c => c.id === identifier || c.key === identifier) || null;
    }
    
    // ==================== SUMMON OPERATIONS ====================
    
    /**
     * Summon a cryptid to the field
     * @param {string} owner - 'player' or 'enemy'
     * @param {number} col - Column
     * @param {number} row - Row
     * @param {Object} cardData - Card to summon
     * @returns {Object} Result { success, cryptid?, error? }
     */
    function summonCryptid(owner, col, row, cardData) {
        const field = getField(owner);
        
        // Validate slot
        if (col < 0 || col > 1 || row < 0 || row > 2) {
            return { success: false, error: 'INVALID_SLOT' };
        }
        
        if (field[col][row] !== null) {
            return { success: false, error: 'SLOT_OCCUPIED' };
        }
        
        // Initialize cryptid state
        const cryptid = {
            ...cardData,
            owner,
            col,
            row,
            currentHp: cardData.currentHp ?? cardData.hp,
            maxHp: cardData.maxHp ?? cardData.hp,
            currentAtk: cardData.currentAtk ?? cardData.atk,
            baseAtk: cardData.baseAtk ?? cardData.atk,
            baseHp: cardData.baseHp ?? cardData.hp,
            tapped: false,
            canAttack: false, // Can't attack on summon turn
            justSummoned: true,
            burnTurns: 0,
            bleedTurns: 0,
            paralyzed: false,
            paralyzeTurns: 0,
            calamityCounters: 0,
            curseTokens: 0,
            protectionCharges: 0,
            auras: [],
            evolutionChain: cardData.evolutionChain || [cardData.key]
        };
        
        // Place on field
        field[col][row] = cryptid;
        
        // Emit events
        if (events) {
            events.emit('onSummon', { cryptid, owner, col, row });
            
            const combatCol = getCombatCol(owner);
            if (col === combatCol) {
                events.emit('onEnterCombat', { cryptid, owner, col, row });
            } else {
                events.emit('onEnterSupport', { cryptid, owner, col, row });
            }
        }
        
        return { success: true, cryptid };
    }
    
    /**
     * Summon a kindling to the field
     * @param {string} owner - 'player' or 'enemy'
     * @param {number} col - Column
     * @param {number} row - Row
     * @param {string|number} kindlingIdOrIndex - Kindling ID or pool index
     * @returns {Object} Result { success, cryptid?, error? }
     */
    function summonKindling(owner, col, row, kindlingIdOrIndex) {
        const kindling = getKindling(owner);
        
        // Check if already played kindling this turn
        const playedFlag = owner === 'player' ? 'playerKindlingPlayedThisTurn' : 'enemyKindlingPlayedThisTurn';
        if (state[playedFlag]) {
            return { success: false, error: 'KINDLING_ALREADY_PLAYED' };
        }
        
        // Find kindling
        let index = -1;
        if (typeof kindlingIdOrIndex === 'number') {
            index = kindlingIdOrIndex;
        } else {
            index = kindling.findIndex(k => k.id === kindlingIdOrIndex);
        }
        
        if (index < 0 || index >= kindling.length) {
            return { success: false, error: 'KINDLING_NOT_FOUND' };
        }
        
        // Remove from pool
        const cardData = kindling.splice(index, 1)[0];
        
        // Summon
        const result = summonCryptid(owner, col, row, cardData);
        
        if (result.success) {
            state[playedFlag] = true;
            state.matchStats.kindlingSummoned++;
        } else {
            // Put back if summon failed
            kindling.splice(index, 0, cardData);
        }
        
        return result;
    }
    
    // ==================== AILMENT OPERATIONS ====================
    
    /**
     * Apply an ailment to a cryptid
     * @param {Object} cryptid - Target cryptid
     * @param {string} ailmentType - Type of ailment
     * @param {number} stacks - Number of stacks (default 1)
     * @returns {Object} Result { success, blocked?, reason? }
     */
    function applyAilment(cryptid, ailmentType, stacks = 1) {
        if (!cryptid) {
            return { success: false, reason: 'NO_TARGET' };
        }
        
        // Check immunity
        if (cryptid.ailmentImmune || cryptid.hasMothmanAilmentImmunity) {
            if (events) {
                events.emit('onAilmentBlocked', { 
                    cryptid, 
                    ailment: ailmentType, 
                    source: cryptid.hasMothmanAilmentImmunity ? 'Mothman' : 'immunity' 
                });
            }
            return { success: false, blocked: true, reason: 'IMMUNE' };
        }
        
        let applied = false;
        
        switch (ailmentType) {
            case 'burn':
                cryptid.burnTurns = (cryptid.burnTurns || 0) + stacks;
                applied = true;
                break;
                
            case 'bleed':
                cryptid.bleedTurns = (cryptid.bleedTurns || 0) + stacks;
                applied = true;
                break;
                
            case 'paralyze':
                if (!cryptid.paralyzed) {
                    cryptid.paralyzed = true;
                    cryptid.paralyzeTurns = 1;
                    cryptid.tapped = true;
                    cryptid.canAttack = false;
                    applied = true;
                }
                break;
                
            case 'calamity':
                cryptid.calamityCounters = (cryptid.calamityCounters || 0) + stacks;
                cryptid.hadCalamity = true;
                applied = true;
                break;
                
            case 'curse':
                cryptid.curseTokens = (cryptid.curseTokens || 0) + stacks;
                applied = true;
                break;
                
            default:
                return { success: false, reason: 'UNKNOWN_AILMENT' };
        }
        
        if (applied && events) {
            events.emit('onAilmentApplied', { 
                cryptid, 
                ailment: ailmentType, 
                stacks,
                owner: cryptid.owner 
            });
        }
        
        return { success: applied };
    }
    
    /**
     * Cleanse ailments from a cryptid
     * @param {Object} cryptid - Target cryptid
     * @param {string|null} ailmentType - Specific ailment or null for all
     * @returns {Object} Result { success, cleansedCount }
     */
    function cleanse(cryptid, ailmentType = null) {
        if (!cryptid) {
            return { success: false, cleansedCount: 0 };
        }
        
        let count = 0;
        
        if (!ailmentType || ailmentType === 'burn') {
            if (cryptid.burnTurns > 0) {
                cryptid.burnTurns = 0;
                count++;
            }
        }
        
        if (!ailmentType || ailmentType === 'paralyze') {
            if (cryptid.paralyzed) {
                cryptid.paralyzed = false;
                cryptid.paralyzeTurns = 0;
                count++;
            }
        }
        
        if (!ailmentType || ailmentType === 'bleed') {
            if (cryptid.bleedTurns > 0) {
                cryptid.bleedTurns = 0;
                count++;
            }
        }
        
        if (!ailmentType || ailmentType === 'calamity') {
            if (cryptid.calamityCounters > 0) {
                cryptid.calamityCounters = 0;
                count++;
            }
        }
        
        if (!ailmentType || ailmentType === 'curse') {
            if (cryptid.curseTokens > 0) {
                cryptid.curseTokens = 0;
                count++;
            }
        }
        
        if (count > 0 && events) {
            events.emit('onCleanse', { cryptid, owner: cryptid.owner, count });
        }
        
        return { success: count > 0, cleansedCount: count };
    }
    
    // ==================== DAMAGE OPERATIONS ====================
    
    /**
     * Apply damage to a cryptid
     * @param {Object} cryptid - Target cryptid
     * @param {number} damage - Damage amount
     * @param {Object} source - Source of damage (cryptid or null)
     * @param {string} damageType - Type of damage ('attack', 'burn', 'effect', etc.)
     * @returns {Object} Result { success, actualDamage, killed }
     */
    function applyDamage(cryptid, damage, source = null, damageType = 'effect') {
        if (!cryptid || damage <= 0) {
            return { success: false, actualDamage: 0, killed: false };
        }
        
        const hpBefore = cryptid.currentHp;
        cryptid.currentHp -= damage;
        
        if (events) {
            events.emit('onDamageTaken', {
                target: cryptid,
                damage,
                source,
                sourceType: damageType,
                hpBefore,
                hpAfter: cryptid.currentHp,
                owner: cryptid.owner
            });
        }
        
        const killed = getEffectiveHp(cryptid) <= 0;
        
        return { 
            success: true, 
            actualDamage: damage, 
            killed,
            hpBefore,
            hpAfter: cryptid.currentHp
        };
    }
    
    /**
     * Heal a cryptid
     * @param {Object} cryptid - Target cryptid
     * @param {number} amount - Heal amount
     * @param {string} source - Source of healing
     * @returns {Object} Result { success, actualHeal }
     */
    function heal(cryptid, amount, source = 'effect') {
        if (!cryptid || amount <= 0) {
            return { success: false, actualHeal: 0 };
        }
        
        const maxHp = cryptid.maxHp ?? cryptid.hp;
        const hpBefore = cryptid.currentHp;
        cryptid.currentHp = Math.min(maxHp, cryptid.currentHp + amount);
        const actualHeal = cryptid.currentHp - hpBefore;
        
        if (actualHeal > 0 && events) {
            events.emit('onHeal', {
                cryptid,
                amount: actualHeal,
                source,
                owner: cryptid.owner
            });
        }
        
        return { success: actualHeal > 0, actualHeal };
    }
    
    // ==================== DEATH OPERATIONS ====================
    
    /**
     * Kill a cryptid and handle death processing
     * @param {Object} cryptid - Cryptid to kill
     * @param {string} killerOwner - Owner of killer (for events)
     * @param {Object} options - Options { skipPromotion, killedBy }
     * @returns {Object|null} Death result or null if already dead
     */
    function killCryptid(cryptid, killerOwner = null, options = {}) {
        if (!cryptid || cryptid._alreadyKilled) {
            return null;
        }
        
        cryptid._alreadyKilled = true;
        
        const { skipPromotion = false, killedBy = 'unknown' } = options;
        const owner = cryptid.owner;
        const { col, row } = cryptid;
        const combatCol = getCombatCol(owner);
        const supportCol = getSupportCol(owner);
        const deathCount = cryptid.evolutionChain?.length || 1;
        
        // Check for death prevention
        if (cryptid.preventDeath) {
            cryptid.preventDeath = false;
            cryptid._alreadyKilled = false;
            return null;
        }
        
        // Remove from field
        setFieldCryptid(owner, col, row, null);
        
        // Update death counters
        if (owner === 'player') {
            state.playerDeaths += deathCount;
            state.playerDeathCount += 1;
        } else {
            state.enemyDeaths += deathCount;
            state.enemyDeathCount += 1;
        }
        state.deathsThisTurn[owner] += deathCount;
        
        // Emit death event
        if (events) {
            events.emit('onDeath', {
                cryptid,
                owner,
                col,
                row,
                killerOwner,
                killedBy,
                deathCount
            });
        }
        
        // Handle promotion
        let promotedSupport = null;
        if (col === combatCol && !skipPromotion) {
            const support = getFieldCryptid(owner, supportCol, row);
            if (support) {
                // Promote support to combat
                setFieldCryptid(owner, supportCol, row, null);
                support.col = combatCol;
                setFieldCryptid(owner, combatCol, row, support);
                promotedSupport = support;
                
                if (events) {
                    events.emit('onPromotion', {
                        cryptid: support,
                        owner,
                        row,
                        fromCol: supportCol,
                        toCol: combatCol
                    });
                    events.emit('onEnterCombat', {
                        cryptid: support,
                        owner,
                        col: combatCol,
                        row,
                        source: 'promotion'
                    });
                }
            }
        }
        
        // Check game over
        checkGameOver();
        
        return {
            owner,
            col,
            row,
            deathCount,
            promotedSupport
        };
    }
    
    // ==================== TURN MANAGEMENT ====================
    
    /**
     * Start a new turn
     * @param {string} owner - Whose turn it is
     */
    function startTurn(owner) {
        state.currentTurn = owner;
        state.phase = GamePhases.CONJURE1;
        
        if (owner === 'player') {
            state.turnNumber++;
        }
        
        // Reset turn flags
        const prefix = owner === 'player' ? 'player' : 'enemy';
        state[`${prefix}KindlingPlayedThisTurn`] = false;
        state[`${prefix}PyreCardPlayedThisTurn`] = false;
        state[`${prefix}PyreBurnUsed`] = false;
        
        // Reset death tracking
        state.deathsThisTurn[owner] = 0;
        
        // Untap and refresh cryptids
        const cryptids = getAllCryptids(owner);
        for (const cryptid of cryptids) {
            // Handle paralyze - skip untap if paralyzed
            if (cryptid.paralyzed && cryptid.paralyzeTurns > 0) {
                cryptid.paralyzeTurns--;
                if (cryptid.paralyzeTurns <= 0) {
                    cryptid.paralyzed = false;
                }
            } else if (!cryptid.justSummoned) {
                cryptid.tapped = false;
                cryptid.canAttack = true;
            }
            
            cryptid.justSummoned = false;
            cryptid.attackedThisTurn = false;
            cryptid.restedThisTurn = false;
        }
        
        if (events) {
            events.emit('onTurnStart', { owner, turnNumber: state.turnNumber });
        }
    }
    
    /**
     * End the current turn
     */
    function endTurn() {
        const owner = state.currentTurn;
        
        // Process end of turn effects
        processBurnDamage(owner);
        processCalamityCounters(owner);
        
        // Store death info for next turn
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        state.deathsLastEnemyTurn = { ...state.deathsThisTurn };
        
        if (events) {
            events.emit('onTurnEnd', { owner, turnNumber: state.turnNumber });
        }
        
        // Switch turn
        const nextOwner = owner === 'player' ? 'enemy' : 'player';
        startTurn(nextOwner);
    }
    
    /**
     * Change phase
     * @param {string} newPhase - New phase
     */
    function setPhase(newPhase) {
        const oldPhase = state.phase;
        state.phase = newPhase;
        
        if (events) {
            events.emit('onPhaseChange', {
                owner: state.currentTurn,
                oldPhase,
                newPhase
            });
        }
    }
    
    /**
     * Process burn damage at end of turn
     * @param {string} owner - Field owner
     * @returns {Object[]} Array of cryptids that died from burn
     */
    function processBurnDamage(owner) {
        const cryptids = getAllCryptids(owner);
        const deaths = [];
        
        for (const cryptid of cryptids) {
            if (cryptid.burnTurns > 0) {
                cryptid.currentHp -= 1;
                cryptid.burnTurns--;
                
                if (events) {
                    events.emit('onBurnDamage', {
                        cryptid,
                        owner,
                        damage: 1,
                        turnsRemaining: cryptid.burnTurns
                    });
                }
                
                if (getEffectiveHp(cryptid) <= 0) {
                    deaths.push(cryptid);
                }
            }
        }
        
        return deaths;
    }
    
    /**
     * Process calamity counters at end of turn
     * @param {string} owner - Field owner
     * @returns {Object[]} Array of cryptids that died from calamity
     */
    function processCalamityCounters(owner) {
        const cryptids = getAllCryptids(owner);
        const deaths = [];
        
        for (const cryptid of cryptids) {
            if (cryptid.calamityCounters > 0) {
                cryptid.calamityCounters--;
                
                if (events) {
                    events.emit('onCalamityTick', {
                        cryptid,
                        owner,
                        countersRemaining: cryptid.calamityCounters
                    });
                }
                
                if (cryptid.calamityCounters === 0 && cryptid.hadCalamity) {
                    deaths.push(cryptid);
                    
                    if (events) {
                        events.emit('onCalamityDeath', { cryptid, owner });
                    }
                }
            }
        }
        
        return deaths;
    }
    
    // ==================== GAME END ====================
    
    /**
     * Check if game is over
     * @returns {boolean} True if game ended
     */
    function checkGameOver() {
        if (state.gameOver) return true;
        
        const playerEmpty = isFieldEmpty('player');
        const enemyEmpty = isFieldEmpty('enemy');
        
        if (playerEmpty && enemyEmpty) {
            // Draw - but enemy wins (defender advantage)
            state.gameOver = true;
            state.winner = 'enemy';
        } else if (playerEmpty) {
            state.gameOver = true;
            state.winner = 'enemy';
        } else if (enemyEmpty) {
            state.gameOver = true;
            state.winner = 'player';
        }
        
        if (state.gameOver && events) {
            events.emit('onGameEnd', {
                winner: state.winner,
                turnNumber: state.turnNumber
            });
        }
        
        return state.gameOver;
    }
    
    // ==================== SERIALIZATION ====================
    
    /**
     * Export state for serialization (e.g., sending to clients)
     * @returns {Object} Serializable state
     */
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
            enemyPyreBurnUsed: state.enemyPyreBurnUsed,
        };
    }
    
    /**
     * Import state from serialized data
     * @param {Object} data - Serialized state
     */
    function importState(data) {
        if (data.playerField) state.playerField = data.playerField;
        if (data.enemyField) state.enemyField = data.enemyField;
        if (data.playerHand) state.playerHand = data.playerHand;
        if (data.enemyHand) state.enemyHand = data.enemyHand;
        if (data.playerKindling) state.playerKindling = data.playerKindling;
        if (data.enemyKindling) state.enemyKindling = data.enemyKindling;
        if (data.playerPyre !== undefined) state.playerPyre = data.playerPyre;
        if (data.enemyPyre !== undefined) state.enemyPyre = data.enemyPyre;
        if (data.playerDeaths !== undefined) state.playerDeaths = data.playerDeaths;
        if (data.enemyDeaths !== undefined) state.enemyDeaths = data.enemyDeaths;
        if (data.currentTurn) state.currentTurn = data.currentTurn;
        if (data.phase) state.phase = data.phase;
        if (data.turnNumber !== undefined) state.turnNumber = data.turnNumber;
        if (data.gameOver !== undefined) state.gameOver = data.gameOver;
        if (data.winner !== undefined) state.winner = data.winner;
        if (data.playerTraps) state.playerTraps = data.playerTraps;
        if (data.enemyTraps) state.enemyTraps = data.enemyTraps;
        if (data.playerKindlingPlayedThisTurn !== undefined) state.playerKindlingPlayedThisTurn = data.playerKindlingPlayedThisTurn;
        if (data.enemyKindlingPlayedThisTurn !== undefined) state.enemyKindlingPlayedThisTurn = data.enemyKindlingPlayedThisTurn;
        if (data.playerPyreCardPlayedThisTurn !== undefined) state.playerPyreCardPlayedThisTurn = data.playerPyreCardPlayedThisTurn;
        if (data.enemyPyreCardPlayedThisTurn !== undefined) state.enemyPyreCardPlayedThisTurn = data.enemyPyreCardPlayedThisTurn;
        if (data.playerPyreBurnUsed !== undefined) state.playerPyreBurnUsed = data.playerPyreBurnUsed;
        if (data.enemyPyreBurnUsed !== undefined) state.enemyPyreBurnUsed = data.enemyPyreBurnUsed;
        
        // Re-link owner/col/row for field cryptids
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
    
    /**
     * Reset state to initial values for a new game
     */
    function reset() {
        // Clear fields
        state.playerField = [[null, null, null], [null, null, null]];
        state.enemyField = [[null, null, null], [null, null, null]];
        
        // Clear hands and resources
        state.playerHand = [];
        state.enemyHand = [];
        state.playerKindling = [];
        state.enemyKindling = [];
        state.playerDeck = [];
        state.enemyDeck = [];
        
        // Reset pyre
        state.playerPyre = 0;
        state.enemyPyre = 0;
        
        // Reset turn tracking flags
        state.playerKindlingPlayedThisTurn = false;
        state.enemyKindlingPlayedThisTurn = false;
        state.playerPyreCardPlayedThisTurn = false;
        state.enemyPyreCardPlayedThisTurn = false;
        state.playerPyreBurnUsed = false;
        state.enemyPyreBurnUsed = false;
        
        // Reset death counters
        state.playerDeaths = 0;
        state.enemyDeaths = 0;
        state.playerDeathCount = 0;
        state.enemyDeathCount = 0;
        state.deathsThisTurn = { player: 0, enemy: 0 };
        state.deathsLastEnemyTurn = { player: 0, enemy: 0 };
        
        // Reset attack tracking
        state.attackersThisTurn = { player: [], enemy: [] };
        state.lastTurnAttackers = { player: [], enemy: [] };
        
        // Clear traps
        state.playerTraps = [null, null];
        state.enemyTraps = [null, null];
        
        // Clear toxic tiles
        state.playerToxicTiles = [[0, 0, 0], [0, 0, 0]];
        state.enemyToxicTiles = [[0, 0, 0], [0, 0, 0]];
        
        // Clear discard piles
        state.playerBurnPile = [];
        state.playerDiscardPile = [];
        state.enemyBurnPile = [];
        state.enemyDiscardPile = [];
        
        // Reset turn state
        state.currentTurn = 'player';
        state.phase = GamePhases.CONJURE1;
        state.turnNumber = 0;
        state.gameOver = false;
        state.winner = null;
        
        // Reset tracking
        state.evolvedThisTurn = {};
        
        // Reset match stats
        state.matchStats = {
            startTime: Date.now(),
            damageDealt: 0,
            damageTaken: 0,
            spellsCast: 0,
            evolutions: 0,
            trapsTriggered: 0,
            kindlingSummoned: 0
        };
        
        if (events) {
            events.emit('onReset', {});
        }
    }
    
    // ==================== PUBLIC API ====================
    
    return {
        // State access
        state,
        
        // Position helpers
        getCombatCol,
        getSupportCol,
        getField,
        getFieldCryptid,
        setFieldCryptid,
        getSupport,
        getCombatant,
        getCombatantAtRow,
        getSupportAtRow,
        isInCombat,
        isInSupport,
        getAllCryptids,
        getColumnCryptids,
        isFieldEmpty,
        getValidSummonSlots,
        
        // Ailment helpers
        hasAilments,
        getAilmentStacks,
        getStatusAilments,
        
        // Stat calculations
        getEffectiveHp,
        getEffectiveAtk,
        calculateAttackDamage,
        isSupportNegated,
        
        // Resource management
        getPyre,
        modifyPyre,
        getHand,
        getDeck,
        getKindling,
        
        // Card operations
        drawCard,
        drawKindling,
        removeFromHand,
        findCardInHand,
        
        // Summon operations
        summonCryptid,
        summonKindling,
        
        // Ailment operations
        applyAilment,
        cleanse,
        
        // Damage operations
        applyDamage,
        heal,
        
        // Death operations
        killCryptid,
        
        // Turn management
        startTurn,
        endTurn,
        setPhase,
        processBurnDamage,
        processCalamityCounters,
        
        // Game end
        checkGameOver,
        
        // Serialization
        exportState,
        importState,
        reset,
        
        // Events access
        events
    };
}

// ==================== EXPORTS ====================

// CommonJS export (for Node.js / Cloudflare Worker)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createGameState
    };
}

// Browser global export
if (typeof window !== 'undefined') {
    window.SharedGameState = {
        createGameState
    };
}

})(); // End IIFE
