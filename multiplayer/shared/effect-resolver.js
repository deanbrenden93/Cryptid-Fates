/**
 * Cryptid Fates - Shared Effect Resolver
 * 
 * Isomorphic effect resolution logic that processes card effects
 * and returns state changes to be applied. No DOM dependencies.
 * 
 * This module handles:
 * - Trigger checking (should this effect fire?)
 * - Condition evaluation (are the conditions met?)
 * - Target resolution (who does this affect?)
 * - Amount calculation (how much damage/healing/etc?)
 * - Action execution (what state changes should occur?)
 * 
 * The caller (client or server) applies the resulting state changes
 * and handles animations/UI separately.
 */

/**
 * Create an EffectResolver instance
 * @param {Object} options - Configuration
 * @param {Object} options.events - GameEvents instance for subscriptions
 * @param {boolean} options.debug - Enable debug logging
 * @param {Function} options.logger - Custom logging function
 * @returns {Object} EffectResolver instance
 */
function createEffectResolver(options = {}) {
    const events = options.events;
    const debug = options.debug || false;
    const logger = options.logger || console.log;
    
    // Track active subscriptions for cleanup
    const subscriptions = new Map(); // cryptid.id -> [unsubscribe functions]
    
    // Track active auras
    const activeAuras = new Map(); // cryptid.id -> [aura effects]
    
    // ==================== TRIGGER MAPPING ====================
    
    const triggerEventMap = {
        onSummon: 'onSummon',
        onEnterCombat: 'onEnterCombat',
        onEnterSupport: 'onEnterSupport',
        onLeaveSupport: 'onLeavingSupport',
        onLeavingSupport: 'onLeavingSupport',
        onDeath: 'onDeath',
        onAllyDeath: 'onDeath',
        onEnemyDeath: 'onDeath',
        onAnyDeath: 'onDeath',
        onCombatantDeath: 'onDeath',
        onCombatantKill: 'onKill',
        onTurnStart: 'onTurnStart',
        onTurnEnd: 'onTurnEnd',
        onDamageDealt: 'onDamageDealt',
        onDamageTaken: 'onDamageTaken',
        onDamagedByAttack: 'onDamageTaken',
        onAttack: 'onAttack',
        onCombatAttack: 'onCombatAttack',
        onBeforeAttack: 'onBeforeAttack',
        onBeforeDefend: 'onBeforeDefend',
        onKill: 'onKill',
    };
    
    // Aura triggers don't need event subscriptions
    const auraTriggers = ['whileInCombat', 'whileInSupport', 'whileAlive', 'onApply', 'onRemove'];
    
    // ==================== HELPER FUNCTIONS ====================
    
    /**
     * Get all cryptids from a field
     * @param {Array} field - 2D field array [col][row]
     * @returns {Object[]} Array of cryptids
     */
    function getAllCryptids(field) {
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
     * Get cryptids in a specific column
     * @param {Array} field - 2D field array
     * @param {number} col - Column index
     * @returns {Object[]} Array of cryptids
     */
    function getColumnCryptids(field, col) {
        const cryptids = [];
        for (let row = 0; row < 3; row++) {
            if (field[col]?.[row]) {
                cryptids.push(field[col][row]);
            }
        }
        return cryptids;
    }
    
    /**
     * Check if a cryptid has any ailments
     * @param {Object} cryptid - Cryptid to check
     * @returns {boolean} True if has ailments
     */
    function hasAilments(cryptid) {
        return getAilmentStacks(cryptid) > 0;
    }
    
    /**
     * Get total ailment stacks on a cryptid
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
     * Count allies on field
     * @param {string} owner - 'player' or 'enemy'
     * @param {Object} gameState - Game state object
     * @returns {number} Count
     */
    function countAllies(owner, gameState) {
        const field = owner === 'player' ? gameState.playerField : gameState.enemyField;
        return getAllCryptids(field).length;
    }
    
    /**
     * Count enemies on field
     * @param {string} owner - 'player' or 'enemy'
     * @param {Object} gameState - Game state object
     * @returns {number} Count
     */
    function countEnemies(owner, gameState) {
        const field = owner === 'player' ? gameState.enemyField : gameState.playerField;
        return getAllCryptids(field).length;
    }
    
    /**
     * Get combat column for an owner
     * @param {string} owner - 'player' or 'enemy'
     * @returns {number} Column index
     */
    function getCombatCol(owner) {
        return owner === 'player' ? 1 : 0;
    }
    
    /**
     * Get support column for an owner
     * @param {string} owner - 'player' or 'enemy'
     * @returns {number} Column index
     */
    function getSupportCol(owner) {
        return owner === 'player' ? 0 : 1;
    }
    
    /**
     * Compare values with different operators
     * @param {number} actual - Actual value
     * @param {number} expected - Expected value
     * @param {string} comparator - Comparison operator
     * @returns {boolean} Result
     */
    function compareValue(actual, expected, comparator) {
        switch (comparator) {
            case 'eq': return actual === expected;
            case 'ne': return actual !== expected;
            case 'gt': return actual > expected;
            case 'gte': return actual >= expected;
            case 'lt': return actual < expected;
            case 'lte': return actual <= expected;
            default: return actual === expected;
        }
    }
    
    // ==================== MAIN RESOLVER ====================
    
    const resolver = {
        
        // ==================== INITIALIZATION ====================
        
        /**
         * Initialize the resolver
         */
        init() {
            if (debug) logger('[EffectResolver] Initializing...');
            subscriptions.clear();
            activeAuras.clear();
        },
        
        /**
         * Register a cryptid's effects when it enters the field
         * @param {Object} cryptid - Cryptid to register
         * @param {string} owner - 'player' or 'enemy'
         * @param {Object} gameState - Current game state
         */
        registerCryptid(cryptid, owner, gameState) {
            if (!cryptid.effects || !Array.isArray(cryptid.effects)) {
                return;
            }
            
            const subs = [];
            
            cryptid.effects.forEach((effect, index) => {
                const sub = this.registerEffect(cryptid, owner, gameState, effect, index);
                if (sub) subs.push(sub);
            });
            
            subscriptions.set(cryptid.id, subs);
            
            if (debug) {
                logger(`[EffectResolver] Registered ${subs.length} effects for ${cryptid.name}`);
            }
        },
        
        /**
         * Unregister a cryptid's effects when it leaves the field
         * @param {Object} cryptid - Cryptid to unregister
         */
        unregisterCryptid(cryptid) {
            const subs = subscriptions.get(cryptid.id);
            if (subs) {
                subs.forEach(unsub => {
                    if (typeof unsub === 'function') unsub();
                });
                subscriptions.delete(cryptid.id);
            }
            
            // Clean up auras
            activeAuras.delete(cryptid.id);
            
            if (debug) {
                logger(`[EffectResolver] Unregistered effects for ${cryptid.name}`);
            }
        },
        
        /**
         * Register a single effect with the event system
         * @param {Object} cryptid - Source cryptid
         * @param {string} owner - 'player' or 'enemy'
         * @param {Object} gameState - Game state
         * @param {Object} effect - Effect definition
         * @param {number} effectIndex - Index for debugging
         * @returns {Function|null} Unsubscribe function
         */
        registerEffect(cryptid, owner, gameState, effect, effectIndex) {
            const trigger = effect.trigger;
            const eventName = triggerEventMap[trigger];
            
            if (!eventName) {
                if (!auraTriggers.includes(trigger)) {
                    if (debug) logger(`[EffectResolver] Unknown trigger: ${trigger}`);
                }
                return null;
            }
            
            if (!events) {
                if (debug) logger('[EffectResolver] No events system provided');
                return null;
            }
            
            const handler = (data) => {
                const result = this.resolveEffect(cryptid, owner, gameState, effect, trigger, data);
                if (result && result.shouldExecute) {
                    // Emit the resolved effect for execution
                    events.emit('effectResolved', {
                        cryptid,
                        owner,
                        effect,
                        result
                    });
                }
            };
            
            return events.on(eventName, handler);
        },
        
        // ==================== TRIGGER CHECKING ====================
        
        /**
         * Check if a trigger should activate for this cryptid
         * @param {Object} cryptid - Source cryptid
         * @param {string} owner - 'player' or 'enemy'
         * @param {Object} gameState - Game state
         * @param {Object} effect - Effect definition
         * @param {string} trigger - Trigger type
         * @param {Object} eventData - Event payload
         * @returns {boolean} True if should trigger
         */
        shouldTrigger(cryptid, owner, gameState, effect, trigger, eventData) {
            // Death triggers - check ownership
            if (trigger === 'onAllyDeath') {
                return eventData.owner === owner && eventData.cryptid?.id !== cryptid.id;
            }
            if (trigger === 'onEnemyDeath') {
                return eventData.owner !== owner;
            }
            if (trigger === 'onAnyDeath') {
                return true;
            }
            if (trigger === 'onDeath') {
                return eventData.cryptid?.id === cryptid.id;
            }
            if (trigger === 'onCombatantDeath') {
                // Check if the dead cryptid was our combatant
                const combatCol = getCombatCol(owner);
                return eventData.owner === owner && 
                       eventData.col === combatCol && 
                       eventData.row === cryptid.row;
            }
            if (trigger === 'onCombatantKill') {
                // Check if our combatant got the kill
                const combatCol = getCombatCol(owner);
                const myField = owner === 'player' ? gameState.playerField : gameState.enemyField;
                const myCombatant = myField[combatCol]?.[cryptid.row];
                return myCombatant && eventData.killer?.id === myCombatant.id;
            }
            
            // Summon/position triggers - check if it's this cryptid
            if (trigger === 'onSummon' || trigger === 'onEnterCombat' || trigger === 'onEnterSupport') {
                return eventData.cryptid?.id === cryptid.id || eventData.card?.id === cryptid.id;
            }
            
            // Leave support trigger
            if (trigger === 'onLeavingSupport' || trigger === 'onLeaveSupport') {
                return eventData.cryptid?.id === cryptid.id;
            }
            
            // Turn triggers - check ownership
            if (trigger === 'onTurnStart' || trigger === 'onTurnEnd') {
                return eventData.owner === owner;
            }
            
            // Damage/attack triggers - check if this cryptid was involved
            if (trigger === 'onDamageDealt' || trigger === 'onCombatAttack' || trigger === 'onBeforeAttack') {
                return eventData.attacker?.id === cryptid.id;
            }
            if (trigger === 'onDamageTaken' || trigger === 'onDamagedByAttack') {
                return eventData.target?.id === cryptid.id;
            }
            
            // Defense triggers
            if (trigger === 'onBeforeDefend') {
                return eventData.cryptid?.id === cryptid.id || eventData.target?.id === cryptid.id;
            }
            
            // Kill trigger
            if (trigger === 'onKill') {
                return eventData.killer?.id === cryptid.id;
            }
            
            return true;
        },
        
        // ==================== CONDITION CHECKING ====================
        
        /**
         * Check if a condition is met
         * @param {Object} cryptid - Source cryptid
         * @param {string} owner - 'player' or 'enemy'
         * @param {Object} gameState - Game state
         * @param {Object} condition - Condition definition
         * @param {Object} eventData - Event payload
         * @returns {boolean} True if condition is met
         */
        checkCondition(cryptid, owner, gameState, condition, eventData) {
            const { check, value, comparator = 'eq' } = condition;
            
            const combatCol = getCombatCol(owner);
            const supportCol = getSupportCol(owner);
            const myField = owner === 'player' ? gameState.playerField : gameState.enemyField;
            const theirField = owner === 'player' ? gameState.enemyField : gameState.playerField;
            
            let result = false;
            
            switch (check) {
                // HP Conditions
                case 'selfHpBelow':
                    result = (cryptid.currentHp || cryptid.hp) < value;
                    break;
                case 'selfHpAbove':
                    result = (cryptid.currentHp || cryptid.hp) > value;
                    break;
                case 'selfHpFull':
                    result = (cryptid.currentHp || cryptid.hp) >= (cryptid.maxHp || cryptid.hp);
                    break;
                case 'selfDamaged':
                    result = (cryptid.currentHp || cryptid.hp) < (cryptid.maxHp || cryptid.hp);
                    break;
                    
                // Ailment Conditions
                case 'selfHasAilment':
                    result = hasAilments(cryptid);
                    break;
                case 'selfNoAilment':
                    result = !hasAilments(cryptid);
                    break;
                case 'targetHasAilment':
                    result = eventData.target && hasAilments(eventData.target);
                    break;
                case 'targetHadAilments':
                    result = eventData.cryptid && (
                        getAilmentStacks(eventData.cryptid) > 0 ||
                        eventData.cryptid.killedBy === 'burn' ||
                        eventData.cryptid.killedBy === 'bleed' ||
                        eventData.cryptid.killedBy === 'calamity'
                    );
                    break;
                case 'victimHadAilment':
                    const victim = eventData.cryptid || eventData.target;
                    result = victim && getAilmentStacks(victim) > 0;
                    break;
                case 'victimWasBurning':
                    const burnVictim = eventData.cryptid || eventData.target;
                    result = burnVictim && (burnVictim.burnTurns > 0 || burnVictim.killedBy === 'burn');
                    break;
                case 'victimWasParalyzed':
                    const paraVictim = eventData.cryptid || eventData.target;
                    result = paraVictim && paraVictim.paralyzed;
                    break;
                case 'attackerHasAilment':
                    result = eventData.attacker && hasAilments(eventData.attacker);
                    break;
                case 'anyEnemyAilmented':
                    result = getAllCryptids(theirField).some(c => hasAilments(c));
                    break;
                case 'ailmentedEnemyCount':
                    const ailmentedCount = getAllCryptids(theirField).filter(c => hasAilments(c)).length;
                    result = condition.min ? ailmentedCount >= condition.min : ailmentedCount >= value;
                    break;
                    
                // Position Conditions
                case 'selfInCombat':
                case 'isCombatant':
                    result = cryptid.col === combatCol;
                    break;
                case 'selfInSupport':
                case 'isSupport':
                    result = cryptid.col === supportCol;
                    break;
                case 'hasSupport':
                    result = myField[supportCol]?.[cryptid.row] != null;
                    break;
                case 'noSupport':
                    result = myField[supportCol]?.[cryptid.row] == null;
                    break;
                case 'noEnemyAcross':
                    const enemyCombatCol = getCombatCol(owner === 'player' ? 'enemy' : 'player');
                    result = theirField[enemyCombatCol]?.[cryptid.row] == null;
                    break;
                case 'isCombatantAndNoKill':
                    result = cryptid.col === combatCol && !cryptid.gotKillThisTurn;
                    break;
                    
                // Count Conditions
                case 'allyCount':
                    result = compareValue(countAllies(owner, gameState), value, comparator);
                    break;
                case 'enemyCount':
                    result = compareValue(countEnemies(owner, gameState), value, comparator);
                    break;
                    
                // Resource Conditions
                case 'pyreAtLeast':
                    const pyre = owner === 'player' ? gameState.playerPyre : gameState.enemyPyre;
                    result = pyre >= value;
                    break;
                case 'pyreBelow':
                    const pyre2 = owner === 'player' ? gameState.playerPyre : gameState.enemyPyre;
                    result = pyre2 < value;
                    break;
                    
                // Combat Conditions
                case 'wasLethal':
                    result = eventData.killed === true;
                    break;
                case 'killerWasAilment':
                    result = ['burn', 'bleed', 'calamity', 'curse'].includes(eventData.cryptid?.killedBy);
                    break;
                case 'killedBy':
                    result = eventData.cryptid?.killedBy === value || cryptid.killedBy === value;
                    break;
                    
                // Flag Conditions
                case 'hasFlag':
                    result = cryptid[condition.flag] === true;
                    break;
                case 'notHasFlag':
                    result = !cryptid[condition.flag];
                    break;
                    
                // Target conditions (for spells)
                case 'targetIsAlly':
                    result = eventData.target && eventData.target.owner === owner;
                    break;
                case 'targetIsEnemy':
                    result = eventData.target && eventData.target.owner !== owner;
                    break;
                    
                default:
                    if (debug) logger(`[EffectResolver] Unknown condition: ${check}`);
                    result = true;
            }
            
            return result;
        },
        
        // ==================== TARGET RESOLUTION ====================
        
        /**
         * Resolve targets for an effect
         * @param {Object} cryptid - Source cryptid
         * @param {string} owner - 'player' or 'enemy'
         * @param {Object} gameState - Game state
         * @param {string} targetType - Target selector
         * @param {Object} eventData - Event payload
         * @returns {Object[]} Array of target cryptids
         */
        resolveTargets(cryptid, owner, gameState, targetType, eventData) {
            const enemyOwner = owner === 'player' ? 'enemy' : 'player';
            const playerField = gameState.playerField;
            const enemyField = gameState.enemyField;
            const myField = owner === 'player' ? playerField : enemyField;
            const theirField = owner === 'player' ? enemyField : playerField;
            const combatCol = getCombatCol(owner);
            const supportCol = getSupportCol(owner);
            const enemyCombatCol = getCombatCol(enemyOwner);
            const enemySupportCol = getSupportCol(enemyOwner);
            
            let targets = [];
            
            switch (targetType) {
                // Self
                case 'self':
                    targets = [cryptid];
                    break;
                    
                // Allies
                case 'allAllies':
                    targets = getAllCryptids(myField);
                    break;
                case 'allyCombatants':
                    targets = getColumnCryptids(myField, combatCol);
                    break;
                case 'allySupports':
                    targets = getColumnCryptids(myField, supportCol);
                    break;
                case 'allyInSameRow':
                    const allyInRow = myField[supportCol]?.[cryptid.row] || myField[combatCol]?.[cryptid.row];
                    if (allyInRow && allyInRow.id !== cryptid.id) targets = [allyInRow];
                    break;
                case 'myCombatant':
                    const myCombatant = myField[combatCol]?.[cryptid.row];
                    if (myCombatant && myCombatant.id !== cryptid.id) targets = [myCombatant];
                    break;
                case 'randomAlly':
                    const allies = getAllCryptids(myField).filter(c => c.id !== cryptid.id);
                    if (allies.length > 0) targets = [allies[Math.floor(Math.random() * allies.length)]];
                    break;
                case 'weakestAlly':
                    const weakAllies = getAllCryptids(myField).filter(c => c.id !== cryptid.id);
                    if (weakAllies.length > 0) {
                        weakAllies.sort((a, b) => (a.currentHp || a.hp) - (b.currentHp || b.hp));
                        targets = [weakAllies[0]];
                    }
                    break;
                    
                // Enemies
                case 'allEnemies':
                    targets = getAllCryptids(theirField);
                    break;
                case 'enemyCombatants':
                    targets = getColumnCryptids(theirField, enemyCombatCol);
                    break;
                case 'enemySupports':
                    targets = getColumnCryptids(theirField, enemySupportCol);
                    break;
                case 'enemyOpposite':
                    const opposite = theirField[enemyCombatCol]?.[cryptid.row];
                    if (opposite) targets = [opposite];
                    break;
                case 'enemyOppositeSupport':
                    const oppSupport = theirField[enemySupportCol]?.[cryptid.row];
                    if (oppSupport) targets = [oppSupport];
                    break;
                case 'enemiesAcross':
                    const acrossCombat = theirField[enemyCombatCol]?.[cryptid.row];
                    const acrossSupport = theirField[enemySupportCol]?.[cryptid.row];
                    if (acrossCombat) targets.push(acrossCombat);
                    if (acrossSupport) targets.push(acrossSupport);
                    break;
                case 'enemyCombatantAcross':
                case 'enemyCombatSlotAcross':
                    const enemyAcross = theirField[enemyCombatCol]?.[cryptid.row];
                    if (enemyAcross) targets = [enemyAcross];
                    break;
                case 'enemyRowAcross':
                    const rowCombat = theirField[enemyCombatCol]?.[cryptid.row];
                    const rowSupport = theirField[enemySupportCol]?.[cryptid.row];
                    if (rowCombat) targets.push(rowCombat);
                    if (rowSupport) targets.push(rowSupport);
                    break;
                case 'randomEnemy':
                    const enemies = getAllCryptids(theirField);
                    if (enemies.length > 0) targets = [enemies[Math.floor(Math.random() * enemies.length)]];
                    break;
                case 'weakestEnemy':
                    const weakEnemies = getAllCryptids(theirField);
                    if (weakEnemies.length > 0) {
                        weakEnemies.sort((a, b) => (a.currentHp || a.hp) - (b.currentHp || b.hp));
                        targets = [weakEnemies[0]];
                    }
                    break;
                case 'strongestEnemy':
                    const strongEnemies = getAllCryptids(theirField);
                    if (strongEnemies.length > 0) {
                        strongEnemies.sort((a, b) => (b.currentAtk || b.atk) - (a.currentAtk || a.atk));
                        targets = [strongEnemies[0]];
                    }
                    break;
                case 'ailmentedEnemies':
                    targets = getAllCryptids(theirField).filter(c => hasAilments(c));
                    break;
                case 'randomAdjacentToVictim':
                    if (eventData.cryptid || eventData.target) {
                        const victimR = eventData.cryptid || eventData.target;
                        const victimRow = victimR.row;
                        const adjacentRows = [victimRow - 1, victimRow + 1].filter(r => r >= 0 && r < 3);
                        const adjacent = [];
                        adjacentRows.forEach(r => {
                            const c1 = theirField[enemyCombatCol]?.[r];
                            const c2 = theirField[enemySupportCol]?.[r];
                            if (c1) adjacent.push(c1);
                            if (c2) adjacent.push(c2);
                        });
                        if (adjacent.length > 0) {
                            targets = [adjacent[Math.floor(Math.random() * adjacent.length)]];
                        }
                    }
                    break;
                    
                // Event-based targets
                case 'attackTarget':
                    if (eventData.target) targets = [eventData.target];
                    else if (eventData.defender) targets = [eventData.defender];
                    break;
                case 'attacker':
                    if (eventData.attacker) targets = [eventData.attacker];
                    break;
                case 'defender':
                    if (eventData.target) targets = [eventData.target];
                    break;
                case 'killer':
                    if (eventData.killer) targets = [eventData.killer];
                    break;
                case 'triggerSource':
                    if (eventData.cryptid) targets = [eventData.cryptid];
                    break;
                case 'spellTarget':
                case 'auraTarget':
                    if (eventData.target) targets = [eventData.target];
                    else if (eventData.targets) targets = eventData.targets;
                    break;
                    
                // Row-based
                case 'sameRow':
                    for (let col = 0; col < 2; col++) {
                        const c1 = playerField[col]?.[cryptid.row];
                        const c2 = enemyField[col]?.[cryptid.row];
                        if (c1) targets.push(c1);
                        if (c2) targets.push(c2);
                    }
                    break;
                    
                // All
                case 'allCards':
                    targets = [...getAllCryptids(playerField), ...getAllCryptids(enemyField)];
                    break;
                    
                // Owner references
                case 'trapOwner':
                case 'cardOwner':
                    // These don't resolve to cryptids
                    break;
                    
                default:
                    if (debug) logger(`[EffectResolver] Unknown target type: ${targetType}`);
            }
            
            // Filter out dead/null targets
            return targets.filter(t => t && (t.currentHp || t.hp) > 0);
        },
        
        // ==================== AMOUNT CALCULATION ====================
        
        /**
         * Calculate the amount for an effect
         * @param {Object} cryptid - Source cryptid
         * @param {string} owner - 'player' or 'enemy'
         * @param {Object} gameState - Game state
         * @param {*} amountDef - Amount definition (number or object)
         * @param {Object[]} targets - Resolved targets
         * @param {Object} eventData - Event payload
         * @returns {number|number[]} Calculated amount(s)
         */
        calculateAmount(cryptid, owner, gameState, amountDef, targets, eventData) {
            // Simple flat value
            if (typeof amountDef === 'number') {
                return amountDef;
            }
            
            // Object with calculation
            if (typeof amountDef === 'object' && amountDef !== null) {
                const { calc, value = 1, multiplier = 1 } = amountDef;
                
                switch (calc) {
                    case 'flat':
                        return value;
                        
                    // Stack-based (returns array for per-target amounts)
                    case 'perAilmentStack':
                    case 'targetAilmentStacks':
                        return targets.map(t => getAilmentStacks(t) * multiplier);
                        
                    case 'perBurnStack':
                        return targets.map(t => (t.burnTurns || 0) * multiplier);
                        
                    case 'perBleedStack':
                        return targets.map(t => (t.bleedTurns || 0) * multiplier);
                        
                    case 'stacksCleansed':
                        return eventData.stacksCleansed || 0;
                        
                    // Stat-based
                    case 'percentMaxHp':
                        return Math.floor((cryptid.maxHp || cryptid.hp) * (value / 100));
                        
                    case 'percentMissingHp':
                        const missing = (cryptid.maxHp || cryptid.hp) - (cryptid.currentHp || cryptid.hp);
                        return Math.floor(missing * (value / 100));
                        
                    case 'selfAtk':
                        return (cryptid.currentAtk || cryptid.atk) * multiplier;
                        
                    case 'victimCost':
                        const victimC = eventData.cryptid || eventData.target;
                        return (victimC?.cost || 0) * multiplier;
                        
                    // Count-based
                    case 'perAllyOnField':
                        return countAllies(owner, gameState) * multiplier;
                        
                    case 'perEnemyOnField':
                        return countEnemies(owner, gameState) * multiplier;
                        
                    case 'perDeathThisGame':
                        return ((gameState.playerDeaths || 0) + (gameState.enemyDeaths || 0)) * multiplier;
                        
                    // Resource-based
                    case 'perPyre':
                        const pyre = owner === 'player' ? gameState.playerPyre : gameState.enemyPyre;
                        return pyre * multiplier;
                        
                    // Damage-based
                    case 'damageDealt':
                        return (eventData.damage || 0) * multiplier;
                        
                    case 'damageTaken':
                        return (eventData.damage || 0) * multiplier;
                        
                    case 'overkillDamage':
                        return (eventData.overkill || 0) * multiplier;
                        
                    default:
                        if (debug) logger(`[EffectResolver] Unknown calculation: ${calc}`);
                        return value;
                }
            }
            
            return 1; // Default
        },
        
        // ==================== EFFECT RESOLUTION ====================
        
        /**
         * Resolve an effect and return the state changes to apply
         * @param {Object} cryptid - Source cryptid
         * @param {string} owner - 'player' or 'enemy'
         * @param {Object} gameState - Game state
         * @param {Object} effect - Effect definition
         * @param {string} trigger - Trigger that fired
         * @param {Object} eventData - Event payload
         * @returns {Object} Resolution result with state changes
         */
        resolveEffect(cryptid, owner, gameState, effect, trigger, eventData) {
            // Check if trigger should fire for this cryptid
            if (!this.shouldTrigger(cryptid, owner, gameState, effect, trigger, eventData)) {
                return { shouldExecute: false, reason: 'trigger_mismatch' };
            }
            
            // Check conditions
            if (effect.condition && !this.checkCondition(cryptid, owner, gameState, effect.condition, eventData)) {
                return { shouldExecute: false, reason: 'condition_failed' };
            }
            
            // Handle multi-action effects
            if (effect.actions && Array.isArray(effect.actions)) {
                const results = effect.actions.map(subAction => 
                    this.resolveSingleAction(cryptid, owner, gameState, subAction, eventData)
                );
                return {
                    shouldExecute: true,
                    isMultiAction: true,
                    actions: results
                };
            }
            
            // Single action
            return this.resolveSingleAction(cryptid, owner, gameState, effect, eventData);
        },
        
        /**
         * Resolve a single action and return state changes
         * @param {Object} cryptid - Source cryptid
         * @param {string} owner - 'player' or 'enemy'
         * @param {Object} gameState - Game state
         * @param {Object} effect - Effect definition
         * @param {Object} eventData - Event payload
         * @returns {Object} Resolution result
         */
        resolveSingleAction(cryptid, owner, gameState, effect, eventData) {
            const targets = this.resolveTargets(cryptid, owner, gameState, effect.target || 'self', eventData);
            const amount = this.calculateAmount(cryptid, owner, gameState, effect.amount, targets, eventData);
            
            return {
                shouldExecute: true,
                action: effect.action,
                source: { id: cryptid.id, name: cryptid.name, owner },
                targets: targets.map(t => ({ id: t.id, name: t.name, owner: t.owner, col: t.col, row: t.row })),
                amount,
                effect: { ...effect }, // Include full effect for reference
                // Additional context for specific actions
                ...this.getActionContext(effect, cryptid, owner, targets, eventData)
            };
        },
        
        /**
         * Get additional context for specific action types
         * @param {Object} effect - Effect definition
         * @param {Object} cryptid - Source cryptid
         * @param {string} owner - 'player' or 'enemy'
         * @param {Object[]} targets - Resolved targets
         * @param {Object} eventData - Event payload
         * @returns {Object} Additional context
         */
        getActionContext(effect, cryptid, owner, targets, eventData) {
            const context = {};
            
            switch (effect.action) {
                case 'applyAilment':
                case 'applyBurn':
                case 'applyBleed':
                case 'applyParalyze':
                    context.ailmentType = effect.ailmentType || effect.action.replace('apply', '').toLowerCase();
                    break;
                    
                case 'buffStats':
                case 'debuffStats':
                case 'gainPermanentStat':
                    context.statChanges = {
                        atk: effect.atk || effect.amount?.atk || 0,
                        hp: effect.hp || effect.amount?.hp || 0
                    };
                    context.permanent = effect.permanent || false;
                    break;
                    
                case 'grantFlag':
                case 'setFlag':
                case 'removeFlag':
                    context.flag = effect.flag;
                    context.flagValue = effect.value !== false;
                    break;
                    
                case 'grantKeyword':
                case 'removeKeyword':
                    context.keyword = effect.keyword;
                    break;
                    
                case 'grantAura':
                case 'removeAura':
                    context.aura = effect.aura;
                    break;
                    
                case 'grantCombatBonus':
                case 'removeCombatBonus':
                    context.bonusType = effect.bonusType;
                    break;
                    
                case 'gainPyre':
                case 'drainPyre':
                    context.pyreOwner = effect.owner === 'self' ? owner : effect.owner;
                    break;
                    
                case 'drawCard':
                    context.drawOwner = effect.owner === 'self' ? owner : effect.owner;
                    break;
                    
                case 'dealDamagePerAilmentStack':
                    context.damagePerStack = effect.damagePerStack || 1;
                    context.damageType = effect.damageType || 'effect';
                    break;
            }
            
            return context;
        },
        
        // ==================== UTILITIES ====================
        
        /**
         * Clear all subscriptions
         */
        clear() {
            subscriptions.forEach((subs, id) => {
                subs.forEach(unsub => {
                    if (typeof unsub === 'function') unsub();
                });
            });
            subscriptions.clear();
            activeAuras.clear();
        },
        
        /**
         * Get ailment stacks (exposed for external use)
         */
        getAilmentStacks,
        
        /**
         * Check if has ailments (exposed for external use)
         */
        hasAilments,
        
        /**
         * Get all cryptids from field (exposed for external use)
         */
        getAllCryptids,
        
        /**
         * Get combat column (exposed for external use)
         */
        getCombatCol,
        
        /**
         * Get support column (exposed for external use)
         */
        getSupportCol,
    };
    
    return resolver;
}

// ==================== EXPORTS ====================

// CommonJS export (for Node.js / Cloudflare Worker)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createEffectResolver
    };
}

// Browser global export
if (typeof window !== 'undefined') {
    window.SharedEffectResolver = {
        createEffectResolver
    };
}
